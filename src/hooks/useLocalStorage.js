import { useState, useEffect, useCallback, useRef } from 'react';
import { AUTOSAVE_DEBOUNCE_MS } from '../utils/constants';

/**
 * Persists state to localStorage with debounced auto-save.
 * On tab hide / close, flushes any pending write immediately.
 * Returns [value, setValue] — same API as useState.
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (err) {
      console.warn('[useLocalStorage] Failed to read:', err);
      return initialValue;
    }
  });

  const debounceTimer = useRef(null);
  // Keep a ref to the latest value so event handlers can flush it
  const pendingValue = useRef(null);

  const flush = useCallback(() => {
    if (debounceTimer.current && pendingValue.current !== null) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      try {
        window.localStorage.setItem(key, JSON.stringify(pendingValue.current));
      } catch (err) {
        console.warn('[useLocalStorage] Failed to flush:', err);
      }
      pendingValue.current = null;
    }
  }, [key]);

  const setValue = useCallback((value) => {
    setStoredValue(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      pendingValue.current = next;

      // Debounced persist
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch (err) {
          console.warn('[useLocalStorage] Failed to write:', err);
        }
        debounceTimer.current = null;
        pendingValue.current = null;
      }, AUTOSAVE_DEBOUNCE_MS);

      return next;
    });
  }, [key]);

  // Flush on tab hide (covers most "close tab" scenarios) or beforeunload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const handleBeforeUnload = () => flush();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Flush any pending write on component unmount as well
      flush();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flush]);

  return [storedValue, setValue];
}
