import { useEffect, useState } from "react";

// The value, but only after it has stopped changing for `delay` ms. Use it for anything typed that asks the server for data, so a request goes out when the
// person pauses typing and not on every key (put the debounced value in the query key / effect dependencies, keep the raw value in the input).
export function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}