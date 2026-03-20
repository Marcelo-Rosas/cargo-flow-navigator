import { useContext } from 'react';
import { LayoutContext } from './LayoutContext';

/**
 * Hook to access layout context (sidebar state, toggle function, width)
 * Must be used within LayoutProvider
 */
export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
}
