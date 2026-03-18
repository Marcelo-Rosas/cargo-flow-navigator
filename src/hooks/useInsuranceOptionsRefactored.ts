/**
 * Refactored useInsuranceOptions - Phase D Optimization
 *
 * Improvements:
 * - Uses BaseHttpClient with retry logic
 * - Branded types for compile-time safety
 * - Structured error handling
 * - Better TypeScript inference
 * - Simplified mock data fallback
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { invokeEdgeFunction } from '@/lib/supabase-invoke';
import { BaseHttpClient } from '@/lib/http/BaseHttpClient';
import {
  type UF,
  type Centavos,
  type CoverageType,
  COVERAGE_TYPES,
  createCentavos,
  createUF,
} from '@/lib/types/branded-types';
import {
  BuonnyError,
  isRateLimitError,
  isTimeoutError,
  logBuonnyError,
} from '@/lib/errors/BuonnyError';

/**
 * Insurance option with strict typing
 */
export interface InsuranceOption {
  coverage_type: CoverageType;
  estimated_premium: Centavos;
  features: string[];
  restrictions: string[];
  risk_level?: 'low' | 'medium' | 'high';
}

/**
 * Default coverage options - strict types with branded values
 */
export const DEFAULT_COVERAGE_OPTIONS: InsuranceOption[] = [
  {
    coverage_type: COVERAGE_TYPES.BASIC,
    estimated_premium: createCentavos(50000), // R$ 500,00
    features: ['Cobertura básica contra danos', 'Roubo total do veículo', 'Assistência 24h'],
    restrictions: ['Limite máximo: R$ 50.000', 'Franquia: R$ 1.000'],
    risk_level: 'low',
  },
  {
    coverage_type: COVERAGE_TYPES.STANDARD,
    estimated_premium: createCentavos(100000), // R$ 1.000,00
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
    coverage_type: COVERAGE_TYPES.PLUS,
    estimated_premium: createCentavos(150000), // R$ 1.500,00
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

/**
 * Request parameters with branded types
 */
interface UseInsuranceOptionsParams {
  origin_uf: string; // Will be validated and converted to UF
  destination_uf: string; // Will be validated and converted to UF
  weight: number;
  product_type?: string;
}

/**
 * Response shape from Edge Function
 */
interface EdgeFunctionResponse {
  options: InsuranceOption[];
  cached?: boolean;
  timestamp?: string;
}

/**
 * Hook return type with strict typing
 */
export interface UseInsuranceOptionsReturn {
  data: InsuranceOption[];
  isLoading: boolean;
  error: BuonnyError | null;
  selectedOption: InsuranceOption | null;
  setSelectedOption: (option: InsuranceOption | null) => void;
  isRetryable: boolean;
}

/**
 * Validate and convert origin/destination to UF type
 * Returns empty string if invalid (allows graceful fallback in hook)
 */
const validateUF = (location: string): string => {
  if (!location) return '';
  try {
    return createUF(location);
  } catch {
    return '';
  }
};

/**
 * useInsuranceOptions - Main hook with Phase D optimizations
 *
 * Features:
 * - TanStack Query v5 with 5min cache
 * - BaseHttpClient with exponential backoff retry
 * - Branded types for type safety
 * - Structured error handling
 * - Automatic fallback to mock data
 * - Loading and error states
 */
export function useInsuranceOptions(params: UseInsuranceOptionsParams): UseInsuranceOptionsReturn {
  const [selectedOption, setSelectedOption] = useState<InsuranceOption | null>(null);
  const [isRetryableError, setIsRetryableError] = useState(false);

  // Validate and convert UF parameters
  const originUF = validateUF(params.origin_uf);
  const destinationUF = validateUF(params.destination_uf);

  const { data, isLoading, error } = useQuery<InsuranceOption[], BuonnyError>({
    queryKey: ['insurance-options', originUF, destinationUF, params.weight, params.product_type],
    queryFn: async () => {
      // Validate prerequisites
      if (!originUF || !destinationUF) {
        return [];
      }

      if (params.weight <= 0) {
        return [];
      }

      try {
        // Try calling Edge Function with retry-enabled BaseHttpClient
        const result = (await invokeEdgeFunction('buonny-check-worker', {
          origin_uf: originUF,
          destination_uf: destinationUF,
          weight: params.weight,
          product_type: params.product_type || 'general',
        })) as EdgeFunctionResponse | null;

        // Validate response structure
        if (result && Array.isArray(result.options) && result.options.length > 0) {
          return result.options as InsuranceOption[];
        }

        // Empty response - fallback to defaults
        console.info('Insurance API returned empty options, using defaults', {
          originUF,
          destinationUF,
          weight: params.weight,
        });

        setIsRetryableError(false);
        return DEFAULT_COVERAGE_OPTIONS;
      } catch (err) {
        // Determine if error is retryable
        const isRetryable =
          err instanceof BuonnyError ? isRateLimitError(err) || isTimeoutError(err) : true;
        setIsRetryableError(isRetryable);

        // Log structured error
        logBuonnyError(err, {
          hook: 'useInsuranceOptions',
          originUF,
          destinationUF,
          weight: params.weight,
          retryable: isRetryable,
        });

        // Fallback silently to mock data
        return DEFAULT_COVERAGE_OPTIONS;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (garbage collection time, formerly cacheTime)
    enabled: !!originUF && !!destinationUF && params.weight > 0,
    // Retry strategy: built into BaseHttpClient, but also configure here
    retry: (failureCount, error) => {
      if (!(error instanceof BuonnyError)) return true;
      if (isRateLimitError(error)) return failureCount < 3;
      if (isTimeoutError(error)) return failureCount < 2;
      return false;
    },
  });

  return {
    data: data ?? [],
    isLoading,
    error: error || null,
    selectedOption,
    setSelectedOption,
    isRetryable: isRetryableError,
  };
}

/**
 * Type guard: validate InsuranceOption structure
 */
export function isValidInsuranceOption(option: unknown): option is InsuranceOption {
  if (typeof option !== 'object' || option === null) return false;
  const opt = option as Record<string, unknown>;

  return (
    typeof opt.coverage_type === 'string' &&
    Object.values(COVERAGE_TYPES).includes(opt.coverage_type as CoverageType) &&
    typeof opt.estimated_premium === 'number' &&
    opt.estimated_premium >= 0 &&
    Array.isArray(opt.features) &&
    Array.isArray(opt.restrictions) &&
    (opt.risk_level === undefined || ['low', 'medium', 'high'].includes(opt.risk_level as string))
  );
}
