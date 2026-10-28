export interface RetryOptions {
  retries?: number;
  delayMs?: number;
  backoffFactor?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean | Promise<boolean>;
  signal?: AbortSignal;
}

export const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      if (timer !== undefined) clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      resolve();
    }, ms);
  });

export async function retry<T>(
  fn: () => Promise<T>,
  retriesOrOptions: number | RetryOptions = 3,
  delayMs = 1000,
): Promise<T> {
  const options: RetryOptions =
    typeof retriesOrOptions === "number"
      ? { retries: retriesOrOptions, delayMs }
      : retriesOrOptions;

  const maxRetries = options.retries ?? 3;
  const baseDelayMs = options.delayMs ?? 1000;
  const backoffFactor = options.backoffFactor ?? 1;
  const maxDelayMs = options.maxDelayMs ?? Number.POSITIVE_INFINITY;
  const shouldRetry = options.shouldRetry;
  const signal = options.signal;

  for (let attempt = 1; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await fn();
    } catch (error) {
      if (attempt > maxRetries) {
        throw error;
      }
      signal?.throwIfAborted();
      if (shouldRetry && !(await shouldRetry(error, attempt))) {
        throw error;
      }
      const nextDelay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(backoffFactor, attempt - 1),
      );
      await wait(nextDelay, signal);
    }
  }
}
