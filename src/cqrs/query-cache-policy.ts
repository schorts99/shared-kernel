import type { Query } from "./query.js";

export interface QueryCachePolicy<Q extends Query = Query, R = unknown> {
  /**
   * Application-defined resource/parameter key; null opts this request out.
   * The bus also scopes by type, user, tenant, headers, context, and version.
   * Validation and authorization run before every lookup.
   */
  getKey(query: Q): string | null;
  /** Milliseconds; falls back to the bus cacheTtl when omitted. */
  ttl?: number;
  getTags?(query: Q, result: R): string[];
  shouldCache?(query: Q, result: R): boolean;
  /** Optional custom copier for isolating cached query results on write and read. */
  cloneResult?(result: R): R;
}
