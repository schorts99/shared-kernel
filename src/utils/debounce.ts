export function debounce<T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number,
  immediate = false,
) {
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: T) => {
    const callNow = immediate && !timeoutTimer;

    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }

    timeoutTimer = setTimeout(() => {
      timeoutTimer = null;

      if (!immediate) {
        callback(...args);
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
  };

  return debounced;
}
