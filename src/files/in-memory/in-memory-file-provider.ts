import { Readable } from "node:stream";
import {
  FileProvider,
  PublicURLOptions,
  SignedURLOptions,
  UploadOptions,
} from "../file-provider";

export interface InMemoryFileProviderOptions {
  baseUrl?: string;
}

interface StoredFile {
  content: Buffer;
  options?: UploadOptions | undefined;
}

export class InMemoryFileProvider implements FileProvider {
  private readonly files = new Map<string, StoredFile>();
  private readonly baseUrl: string;

  constructor(options: InMemoryFileProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://files.local").replace(/\/+$/, "");
  }

  async upload(
    file: Buffer | Readable,
    path: string,
    name: string,
    options?: UploadOptions,
  ): Promise<string> {
    const key = this.resolveKey(path, name);
    const buffer = Buffer.isBuffer(file) ? Buffer.from(file) : await this.streamToBuffer(file);
    this.files.set(key, {
      content: buffer,
      ...(options ? { options: { ...options, ...(options.metadata ? { metadata: { ...options.metadata } } : {}) } } : {}),
    });
    return key;
  }

  async delete(path: string, name: string): Promise<void> {
    const key = this.resolveKey(path, name);
    this.files.delete(key);
  }

  async exists(path: string, name: string): Promise<boolean> {
    const key = this.resolveKey(path, name);
    return this.files.has(key);
  }

  getPublicURL(path: string, name: string, _options?: PublicURLOptions): string {
    const key = this.resolveKey(path, name);
    return `${this.baseUrl}/${key}`;
  }

  async getSignedURL(path: string, name: string, options?: SignedURLOptions): Promise<string> {
    const key = this.resolveKey(path, name);
    const expiresIn = options?.expiresIn ?? 3600;
    return `${this.baseUrl}/${key}?expiresIn=${expiresIn}&signature=in-memory`;
  }

  async get(filePath: string): Promise<Buffer> {
    const normalized = filePath.replace(/^\/+/, "");
    const stored = this.files.get(normalized);
    if (!stored) {
      throw new Error(`File not found: ${normalized}`);
    }
    return Buffer.from(stored.content);
  }

  async list(prefix?: string): Promise<string[]> {
    const normalizedPrefix = prefix ? prefix.replace(/^\/+/, "") : "";
    const keys = Array.from(this.files.keys());
    return normalizedPrefix
      ? keys.filter((key) => key.startsWith(normalizedPrefix))
      : keys;
  }

  clear(): void {
    this.files.clear();
  }

  private resolveKey(path: string, name: string): string {
    const cleanPath = path.replace(/^\/+|\/+$/g, "");
    const cleanName = name.replace(/^\/+/, "");
    return cleanPath ? `${cleanPath}/${cleanName}` : cleanName;
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
