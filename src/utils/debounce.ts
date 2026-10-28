export function debounce<T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number,
  immediate = false,
) {
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: T | null = null;

  const debounced = (...args: T) => {
    const callNow = immediate && !timeoutTimer;

    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }

    pendingArgs = immediate ? null : args;

    timeoutTimer = setTimeout(() => {
      timeoutTimer = null;
      const argsToInvoke = pendingArgs;
      pendingArgs = null;

      if (!immediate && argsToInvoke !== null) {
        callback(...argsToInvoke);
      }
    }, delay);

    if (callNow) {
      callback(...args);
    }
  };

  debounced.cancel = () => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
    pendingArgs = null;
  };

  debounced.flush = () => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;

      const argsToInvoke = pendingArgs;
      pendingArgs = null;

      if (!immediate && argsToInvoke !== null) {
        callback(...argsToInvoke);
      }
    }
  };

  debounced.pending = (): boolean => timeoutTimer !== null;

  return debounced;
}
