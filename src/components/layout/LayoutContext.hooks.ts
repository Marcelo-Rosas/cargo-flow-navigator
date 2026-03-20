import { useContext } from 'react';
import { LayoutContext } from './LayoutContext';

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
}
