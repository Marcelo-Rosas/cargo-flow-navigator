import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  formatted: string;
}

interface UseCepLookupReturn {
  lookup: (cep: string) => Promise<CepData | null>;
  isLoading: boolean;
  error: string | null;
}

export function useCepLookup(): UseCepLookupReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (cep: string): Promise<CepData | null> => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('lookup-cep', {
        body: { cep: clean },
      });

      if (fnError) throw fnError;
      if (!data.success) {
        setError(data.error);
        return null;
      }

      return data.data;
    } catch {
      setError('Erro ao buscar CEP');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookup, isLoading, error };
}
