import { Readable } from "node:stream";

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  makePublic?: boolean;
}

export interface PublicURLOptions {}

export interface SignedURLOptions {
  expiresIn: number;
}

export interface FileProvider {
  upload(file: Buffer | Readable, path: string, name: string, options?: UploadOptions): Promise<string>;
  delete(path: string, name: string): Promise<void>;
  exists(path: string, name: string): Promise<boolean>;
  getPublicURL(path: string, name: string, options?: PublicURLOptions): string;
  getSignedURL(path: string, name: string, options?: SignedURLOptions): Promise<string>;
  get(filePath: string): Promise<Buffer>;
  list(prefix?: string): Promise<string[]>;
}
