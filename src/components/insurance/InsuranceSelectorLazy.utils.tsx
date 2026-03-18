/**
 * Utilities for lazy-loaded InsuranceSelector
 * Separated from component file to satisfy react-refresh/only-export-components rule
 */

import { useEffect, ComponentType } from 'react';

/**
 * Preload: Call this during route transition to start loading component early
 * Usage in router:
 *   useEffect(() => {
 *     preloadInsuranceSelectorLazy()
 *   }, [])
 */
export async function preloadInsuranceSelectorLazy(): Promise<void> {
  try {
    await import('@/components/insurance/InsuranceSelector');
  } catch (error) {
    console.warn('Failed to preload InsuranceSelector', error);
  }
}

/**
 * Higher-order component for auto-preload on mount
 * Usage:
 *   const InsuranceSelectorWithPreload = withPreload(InsuranceSelectorLazy)
 */
export function withPreload<P extends Record<string, unknown>>(
  Component: ComponentType<P>
): ComponentType<P> {
  return function WithPreloadComponent(props: P) {
    // Preload on component mount (requestIdleCallback for non-blocking)
    useEffect(() => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          preloadInsuranceSelectorLazy();
        });
      } else {
        // Fallback for older browsers
        setTimeout(() => {
          void preloadInsuranceSelectorLazy();
        }, 1000);
      }
    }, []);

    return <Component {...props} />;
  };
}
