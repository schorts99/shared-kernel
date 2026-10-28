import { HTTPProvider } from "../http";
import { ConversionError } from "./exceptions";

export interface ConversionOptions {
  maxSize?: number;
  signal?: AbortSignal;
  cache?: boolean;
  expectedMimeTypes?: string[];
  timeout?: number;
}

export interface ConversionResult {
  base64: string;
  mimeType: string;
  size: number;
  cached: boolean;
}

export class RemoteFileToBase64 {
  private readonly conversionCache = new Map<string, ConversionResult>();
  private readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

  constructor(
    private readonly httpProvider: HTTPProvider,
  ) {}

  async convert(url: URL, options: ConversionOptions = {}): Promise<ConversionResult> {
    const {
      maxSize = this.DEFAULT_MAX_SIZE,
      signal = undefined,
      cache = false,
      expectedMimeTypes = undefined,
      timeout = undefined,
    } = options;

    const cacheKey = url.toString();
    if (cache && this.conversionCache.has(cacheKey)) {
      return { ...this.conversionCache.get(cacheKey)!, cached: true };
    }

    if (signal?.aborted) {
      throw new ConversionError(
        "Conversion aborted before starting",
        "CONVERSION_ABORTED"
      );
    }

    try {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const requestController = signal || timeout ? new AbortController() : undefined;
      const onCallerAbort = () => {
        requestController?.abort(new DOMException("Aborted", "AbortError"));
      };
      if (signal) {
        if (signal.aborted) {
          onCallerAbort();
        } else {
          signal.addEventListener("abort", onCallerAbort, { once: true });
        }
      }

      const timeoutPromise = timeout
        ? new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              const timeoutError = new ConversionError(
                `Conversion timeout after ${timeout}ms`,
                "CONVERSION_TIMEOUT"
              );
              requestController?.abort(timeoutError);
              reject(timeoutError);
            }, timeout);
          })
        : null;

      let blob: Blob;
      try {
        const blobPromise = this.httpProvider.get<Blob>(
          url,
          requestController ? { signal: requestController.signal } : undefined,
        );
        blob = timeoutPromise
          ? await Promise.race([blobPromise, timeoutPromise])
          : await blobPromise;
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        signal?.removeEventListener("abort", onCallerAbort);
      }

      if (!(blob instanceof Blob)) {
        throw new ConversionError(
          "Response is not a valid Blob",
          "INVALID_BLOB",
          { receivedType: typeof blob }
        );
      }

      if (blob.size > maxSize) {
        throw new ConversionError(
          `File size (${blob.size} bytes) exceeds maximum allowed (${maxSize} bytes)`,
          "FILE_TOO_LARGE",
          { fileSize: blob.size, maxSize }
        );
      }

      const normalizedMimeType = this.normalizeMimeType(blob.type);

      if (expectedMimeTypes && expectedMimeTypes.length > 0) {
        const isValidMime = expectedMimeTypes.some(expected =>
          this.mimeTypeMatches(normalizedMimeType, expected)
        );

        if (!isValidMime) {
          throw new ConversionError(
            `MIME type '${blob.type}' not in expected types: ${expectedMimeTypes.join(", ")}`,
            "INVALID_MIME_TYPE",
            { receivedMimeType: blob.type, expectedMimeTypes }
          );
        }
      }

      const base64 = await this.blobToBase64(blob, signal, normalizedMimeType);
      const result: ConversionResult = {
        base64,
        mimeType: normalizedMimeType,
        size: blob.size,
        cached: false,
      };

      if (cache) {
        this.conversionCache.set(cacheKey, { ...result });
      }

      return { ...result };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ConversionError(
          "Conversion aborted",
          "CONVERSION_ABORTED"
        );
      }

      if (error instanceof ConversionError) {
        throw error;
      }

      throw new ConversionError(
        `Failed to convert remote file: ${error instanceof Error ? error.message : String(error)}`,
        "CONVERSION_FAILED",
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  clearCache(): void {
    this.conversionCache.clear();
  }

  getCacheSize(): number {
    return this.conversionCache.size;
  }

  removeCacheEntry(url: URL): boolean {
    return this.conversionCache.delete(url.toString());
  }

  private async blobToBase64(
    blob: Blob,
    signal?: AbortSignal,
    normalizedMimeType?: string,
  ): Promise<string> {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    if (typeof FileReader === "undefined") {
      let abortCleanup: (() => void) | undefined;
      const abortPromise = signal
        ? new Promise<never>((_, reject) => {
            const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
            if (signal.aborted) {
              onAbort();
              return;
            }
            signal.addEventListener("abort", onAbort, { once: true });
            abortCleanup = () => signal.removeEventListener("abort", onAbort);
          })
        : undefined;

      try {
        const bufferPromise = blob.arrayBuffer();
        const arrayBuffer = abortPromise
          ? await Promise.race([bufferPromise, abortPromise])
          : await bufferPromise;
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        const mimeType = normalizedMimeType ?? this.normalizeMimeType(blob.type);
        return `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
      } finally {
        abortCleanup?.();
      }
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      const abortListener = () => {
        reader.abort();

        reject(new DOMException("Aborted", "AbortError"));
      };

      if (signal) {
        if (signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal.addEventListener("abort", abortListener);
      }

      reader.readAsDataURL(blob);

      reader.onload = () => {
        if (signal) {
          signal.removeEventListener("abort", abortListener);
        }

        resolve(reader.result as string);
      };

      reader.onerror = () => {
        if (signal) {
          signal.removeEventListener("abort", abortListener);
        }

        reject(
          new ConversionError(
            "FileReader failed to read blob",
            "FILEREADER_ERROR",
            { error: reader.error?.message }
          )
        );
      };

      reader.onabort = () => {
        if (signal) {
          signal.removeEventListener("abort", abortListener);
        }

        reject(new DOMException("Aborted", "AbortError"));
      };
    });
  }

  private normalizeMimeType(raw?: string): string {
    const base = raw?.split(";")[0]?.trim().toLowerCase();
    return base || "application/octet-stream";
  }

  private mimeTypeMatches(actual: string, expected: string): boolean {
    const normActual = this.normalizeMimeType(actual);
    const normExpected = expected.split(";")[0]!.trim().toLowerCase();
    if (normExpected === "*/*") return true;
    if (normActual === normExpected) return true;

    const [expectedType, expectedSubtype] = normExpected.split("/");
    const [actualType] = normActual.split("/");

    if (expectedSubtype === "*") {
      return actualType === expectedType;
    }

    return false;
  }
}
