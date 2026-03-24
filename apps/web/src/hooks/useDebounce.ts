import { useState, useEffect } from 'react';

/**
 * Delays updating a value until the caller stops changing it
 * for `delay` milliseconds. Useful for search inputs where each
 * keystroke shouldn't trigger an API call.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
