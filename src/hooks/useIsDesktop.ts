import { useState, useEffect } from 'react';

const DESKTOP_BREAKPOINT = 768; // md

/**
 * Returns true when viewport width >= breakpoint (default 768px).
 * Used to switch between Dialog (desktop) and Drawer (mobile) for overlays.
 */
export function useIsDesktop(breakpoint = DESKTOP_BREAKPOINT): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(`(min-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = () => setIsDesktop(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return isDesktop;
}
