export const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;

    await wait(delayMs);

    return retry(fn, retries - 1, delayMs);
  }
}
