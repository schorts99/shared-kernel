export interface Cache<T = unknown> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T, ttl?: number, tags?: string[]): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteByTag?(tag: string): Promise<void>;
  deleteByTags?(tags: string[]): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

