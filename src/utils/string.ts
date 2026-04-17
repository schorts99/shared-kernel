/**
 * Converts a string to a URL-friendly slug.
 */
export const slugify = (text: string): string =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");

/**
 * Capitalizes the first letter of a string.
 */
export const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Generates a random string of a given length.
 */
export const randomString = (length = 10): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
