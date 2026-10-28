export function getExpirationTime(ttl?: number): number | undefined {
  if (ttl === undefined) return undefined;

  if (!Number.isFinite(ttl) || ttl < 0) {
    throw new RangeError("TTL must be a finite, non-negative number of milliseconds");
  }

  const expiresAt = Date.now() + ttl;

  if (!Number.isFinite(expiresAt)) {
    throw new RangeError("TTL produces an invalid expiration time");
  }

  return expiresAt;
}
