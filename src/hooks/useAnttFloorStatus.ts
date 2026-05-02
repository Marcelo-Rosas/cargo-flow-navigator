import { useMemo } from 'react';
import { useAnttFloorRate, calculateAnttMinimum } from '@/hooks/useAnttFloorRate';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

export type AnttFloorStatus = 'loading' | 'not_applicable' | 'compliant' | 'below_floor' | 'stale';

export interface AnttFloorStatusResult {
  status: AnttFloorStatus;
  piso: number;
  currentValue: number;
  gap: number;
  modality: 'lotacao' | 'fracionado' | null;
  isStale: boolean;
}

interface QuoteForAnttCheck {
  value: number | null;
  km_distance: number | null;
  freight_modality?: string | null;
  pricing_breakdown?: unknown;
  vehicle_type?: { axes_count?: number | null } | null;
}

/**
 * Determina se uma cotação está abaixo do Piso ANTT vigente.
 * Apenas cotações de lotação são verificadas.
 */
export function useAnttFloorStatus(
  quote: QuoteForAnttCheck | null | undefined
): AnttFloorStatusResult {
  const bd = quote?.pricing_breakdown as StoredPricingBreakdown | null | undefined;

  const modality = useMemo(() => {
    if (!quote) return null;
    if (quote.freight_modality === 'lotacao' || quote.freight_modality === 'fracionado') {
      return quote.freight_modality;
    }
    // Fallback via breakdown
    if (bd?.profitability?.custoMotoristaAntt && bd.profitability.custoMotoristaAntt > 0) {
      return 'lotacao';
    }
    return null;
  }, [quote, bd]);

  const axesCount = quote?.vehicle_type?.axes_count ?? null;

  const { data: anttRate, isLoading } = useAnttFloorRate({
    operationTable: 'A',
    cargoType: 'carga_geral',
    axesCount: modality === 'lotacao' ? axesCount : null,
  });

  return useMemo(() => {
    if (!quote) {
      return {
        status: 'not_applicable',
        piso: 0,
        currentValue: 0,
        gap: 0,
        modality: null,
        isStale: false,
      };
    }

    if (modality !== 'lotacao') {
      return {
        status: 'not_applicable',
        piso: 0,
        currentValue: quote.value ?? 0,
        gap: 0,
        modality,
        isStale: false,
      };
    }

    if (isLoading) {
      return {
        status: 'loading',
        piso: 0,
        currentValue: quote.value ?? 0,
        gap: 0,
        modality,
        isStale: false,
      };
    }

    if (!anttRate || !quote.km_distance) {
      return {
        status: 'not_applicable',
        piso: 0,
        currentValue: quote.value ?? 0,
        gap: 0,
        modality,
        isStale: false,
      };
    }

    const { total: piso } = calculateAnttMinimum({
      kmDistance: quote.km_distance,
      ccd: anttRate.ccd,
      cc: anttRate.cc,
    });

    const currentValue = quote.value ?? 0;
    const gap = Math.max(piso - currentValue, 0);

    // Staleness: breakdown calculado antes da vigência da taxa atual
    const breakdownTs = bd?.meta?.anttCalculatedAt;
    const rateValidFrom = anttRate.valid_from;
    const isStale =
      !!breakdownTs && !!rateValidFrom && new Date(breakdownTs) < new Date(rateValidFrom);

    if (isStale) {
      return { status: 'stale', piso, currentValue, gap, modality, isStale: true };
    }

    if (gap > 0) {
      return { status: 'below_floor', piso, currentValue, gap, modality, isStale: false };
    }

    return { status: 'compliant', piso, currentValue, gap: 0, modality, isStale: false };
  }, [quote, modality, anttRate, isLoading, bd]);
}
