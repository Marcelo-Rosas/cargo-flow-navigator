import { useEffect, useState } from 'react';

/**
 * Retorna um valor debounced (atrasado) após um período de inatividade.
 * Útil para evitar reexecução de cálculos pesados a cada tecla pressionada.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
