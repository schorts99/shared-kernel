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
      const timeoutPromise = timeout
        ? new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(
                new ConversionError(
                  `Conversion timeout after ${timeout}ms`,
                  "CONVERSION_TIMEOUT"
                )
              );
            }, timeout);
          })
        : null;

      const blobPromise = this.httpProvider.get<Blob>(url);
      const blob = timeoutPromise
        ? await Promise.race([blobPromise, timeoutPromise])
        : await blobPromise;

      if (timeoutId) clearTimeout(timeoutId);

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

      if (expectedMimeTypes && expectedMimeTypes.length > 0) {
        const mimeType = blob.type || "application/octet-stream";
        const isValidMime = expectedMimeTypes.some(expected =>
          this.mimeTypeMatches(mimeType, expected)
        );

        if (!isValidMime) {
          throw new ConversionError(
            `MIME type '${blob.type}' not in expected types: ${expectedMimeTypes.join(", ")}`,
            "INVALID_MIME_TYPE",
            { receivedMimeType: blob.type, expectedMimeTypes }
          );
        }
      }

      const base64 = await this.blobToBase64(blob, signal);
      const result: ConversionResult = {
        base64,
        mimeType: blob.type || "application/octet-stream",
        size: blob.size,
        cached: false,
      };

      if (cache) {
        this.conversionCache.set(cacheKey, result);
      }

      return result;
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

  private blobToBase64(blob: Blob, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      const abortListener = () => {
        reader.abort();

        reject(new DOMException("Aborted", "AbortError"));
      };

      if (signal) {
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

  private mimeTypeMatches(actual: string, expected: string): boolean {
    if (expected === "*/*") return true;
    if (actual === expected) return true;

    const [expectedType, expectedSubtype] = expected.split("/");
    const [actualType] = actual.split("/");

    if (expectedSubtype === "*") {
      return actualType === expectedType;
    }

    return false;
  }
}
