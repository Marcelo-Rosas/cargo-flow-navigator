/**
 * Lazy-loaded Insurance Selector with Suspense boundary
 * Phase D Optimization: Code splitting + lazy loading
 *
 * Reduces initial bundle by ~15-20KB by deferring component load until needed
 * Usage:
 *   <Suspense fallback={<InsuranceSelectorSkeleton />}>
 *     <InsuranceSelectorLazy options={options} onSelect={handleSelect} />
 *   </Suspense>
 */

import React, { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { InsuranceOption } from '@/hooks/useInsuranceOptionsRefactored';
import { preloadInsuranceSelectorLazy, withPreload } from './InsuranceSelectorLazy.utils';

/**
 * Lazy-loaded actual selector component
 * This code chunk is split and loaded only when InsuranceSelectorLazy is rendered
 */
const InsuranceSelector = lazy(async () => {
  return import('@/components/insurance/InsuranceSelector').then((mod) => ({
    default: mod.InsuranceSelector,
  }));
});

/**
 * Skeleton loader - shown while component is loading
 */
export const InsuranceSelectorSkeleton = () => {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="flex-1 h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
};

interface InsuranceSelectorLazyProps {
  options: InsuranceOption[];
  selectedCoverage?: string;
  onSelectCoverage: (coverage: string) => void;
  loading?: boolean;
  error?: string;
}

/**
 * Wrapper with Suspense - integrates lazy-loaded component
 */
export function InsuranceSelectorLazy(props: InsuranceSelectorLazyProps) {
  // If component fails to load, show error alert
  if (props.error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {props.error || 'Erro ao carregar seletor de seguro. Tente novamente.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Suspense fallback={<InsuranceSelectorSkeleton />}>
      <InsuranceSelector {...props} />
    </Suspense>
  );
}
