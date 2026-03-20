/**
 * Hook para validação de CEP com debounce
 * Integra Google Geocoding API com validação em tempo real
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { validateAndGeocodeCep, type GeocodeResult } from '@/lib/google-maps';

export interface UseCepValidatorOptions {
  debounceMs?: number;
  autoValidate?: boolean;
}

export interface CepValidationState {
  cep: string;
  isValidating: boolean;
  result: GeocodeResult | null;
  error: string | null;
  isTouched: boolean;
}

export function useCepValidator(
  onValidate?: (result: GeocodeResult) => void,
  options: UseCepValidatorOptions = {}
) {
  const { debounceMs = 500, autoValidate = true } = options;

  const [state, setState] = useState<CepValidationState>({
    cep: '',
    isValidating: false,
    result: null,
    error: null,
    isTouched: false,
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle CEP change with debounce
  const handleCepChange = useCallback(
    (cep: string) => {
      setState((prev) => ({
        ...prev,
        cep,
        isTouched: true,
        // Clear previous result while typing
        result: null,
        error: null,
      }));

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Only validate if enabled and CEP has 8 digits
      const cleanCep = cep.replace(/\D/g, '');
      if (!autoValidate || cleanCep.length !== 8) {
        return;
      }

      // Set debounce timer
      debounceTimerRef.current = setTimeout(async () => {
        setState((prev) => ({
          ...prev,
          isValidating: true,
        }));

        try {
          const result = await validateAndGeocodeCep(cep);

          setState((prev) => ({
            ...prev,
            result,
            error: result.valid ? null : result.error || 'CEP inválido',
            isValidating: false,
          }));

          // Call external callback if provided
          onValidate?.(result);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';

          setState((prev) => ({
            ...prev,
            error: errorMsg,
            isValidating: false,
          }));
        }
      }, debounceMs);
    },
    [debounceMs, autoValidate, onValidate]
  );

  // Force validation without debounce
  const validate = useCallback(
    async (cep?: string) => {
      const cepToValidate = cep ?? state.cep;

      if (!cepToValidate) {
        setState((prev) => ({
          ...prev,
          error: 'CEP é obrigatório',
        }));
        return null;
      }

      setState((prev) => ({
        ...prev,
        isValidating: true,
      }));

      try {
        const result = await validateAndGeocodeCep(cepToValidate);

        setState((prev) => ({
          ...prev,
          result,
          error: result.valid ? null : result.error || 'CEP inválido',
          isValidating: false,
        }));

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';

        setState((prev) => ({
          ...prev,
          error: errorMsg,
          isValidating: false,
        }));

        return null;
      }
    },
    [state.cep]
  );

  // Clear validation
  const clear = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setState({
      cep: '',
      isValidating: false,
      result: null,
      error: null,
      isTouched: false,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    // State
    cep: state.cep,
    isValidating: state.isValidating,
    result: state.result,
    error: state.error,
    isTouched: state.isTouched,
    isValid: state.result?.valid ?? false,

    // Methods
    handleCepChange,
    validate,
    clear,

    // Computed
    city_uf: state.result?.city_uf ?? null,
    coords: state.result ? { lat: state.result.latitude, lng: state.result.longitude } : null,
  };
}
