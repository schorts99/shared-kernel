export const slugify = (text: string): string =>
  text
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

export const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

const RANDOM_STRING_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
// Largest multiple of the alphabet size that fits in a byte; bytes at or above it are
// discarded so every character is equally likely.
const RANDOM_STRING_BYTE_LIMIT = 256 - (256 % RANDOM_STRING_CHARS.length);

export const randomString = (length = 10): string => {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RangeError("length must be a non-negative safe integer");
  }

  const crypto = globalThis.crypto;
  if (typeof crypto?.getRandomValues !== "function") {
    throw new Error("randomString requires the Web Crypto API (globalThis.crypto.getRandomValues)");
  }

  let result = "";
  // getRandomValues accepts at most 65,536 bytes per call.
  const bytes = new Uint8Array(Math.min(65_536, Math.max(16, length)));

  while (result.length < length) {
    crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= RANDOM_STRING_BYTE_LIMIT) continue;

      result += RANDOM_STRING_CHARS.charAt(byte % RANDOM_STRING_CHARS.length);
      if (result.length === length) break;
    }
  }

  return result;
};
