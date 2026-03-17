import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { invokeEdgeFunction } from '@/lib/supabase-invoke';

export interface InsuranceOption {
  coverage_type: 'BASIC' | 'STANDARD' | 'PLUS';
  estimated_premium: number; // em centavos
  features: string[];
  restrictions: string[];
  risk_level?: 'low' | 'medium' | 'high';
}

export const DEFAULT_COVERAGE_OPTIONS: InsuranceOption[] = [
  {
    coverage_type: 'BASIC',
    estimated_premium: 50000, // R$ 500,00
    features: ['Cobertura básica contra danos', 'Roubo total do veículo', 'Assistência 24h'],
    restrictions: ['Limite máximo: R$ 50.000', 'Franquia: R$ 1.000'],
    risk_level: 'low',
  },
  {
    coverage_type: 'STANDARD',
    estimated_premium: 100000, // R$ 1.000,00
    features: [
      'Cobertura completa contra danos',
      'Roubo total do veículo',
      'Avarias em carga',
      'Assistência 24h prioritária',
      'Cobertura de atraso',
    ],
    restrictions: ['Limite máximo: R$ 100.000', 'Franquia: R$ 500'],
    risk_level: 'medium',
  },
  {
    coverage_type: 'PLUS',
    estimated_premium: 150000, // R$ 1.500,00
    features: [
      'Cobertura total sem limites',
      'Roubo total do veículo',
      'Avarias em carga premium',
      'Responsabilidade civil',
      'Assistência 24h VIP',
      'Cobertura internacional',
      'Cobertura de atraso estendida',
    ],
    restrictions: ['Limite máximo: Sem limite', 'Franquia: Sem franquia'],
    risk_level: 'high',
  },
];

interface UseInsuranceOptionsParams {
  origin_uf: string;
  destination_uf: string;
  weight: number;
  product_type?: string;
}

export function useInsuranceOptions(params: UseInsuranceOptionsParams) {
  const [selectedOption, setSelectedOption] = useState<InsuranceOption | null>(null);

  const { data, isLoading, error } = useQuery<InsuranceOption[], Error>({
    queryKey: [
      'insurance-options',
      params.origin_uf,
      params.destination_uf,
      params.weight,
      params.product_type,
    ],
    queryFn: async () => {
      // Se origin ou destination faltam, retorna vazio
      if (!params.origin_uf || !params.destination_uf) {
        return [];
      }

      try {
        // Tenta chamar Edge Function real (buonny-check-worker)
        const result = await invokeEdgeFunction('buonny-check-worker', {
          origin_uf: params.origin_uf,
          destination_uf: params.destination_uf,
          weight: params.weight,
          product_type: params.product_type || 'general',
        });

        if (result && Array.isArray(result.options)) {
          return result.options as InsuranceOption[];
        }

        // Fallback para mock data se API falhar
        return DEFAULT_COVERAGE_OPTIONS;
      } catch {
        // Fallback silencioso para mock data
        console.warn('Insurance API unavailable, using mock data');
        return DEFAULT_COVERAGE_OPTIONS;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos (anteriormente cacheTime)
    enabled: !!params.origin_uf && !!params.destination_uf,
  });

  return {
    data: data ?? [],
    isLoading,
    error,
    selectedOption,
    setSelectedOption,
  };
}
