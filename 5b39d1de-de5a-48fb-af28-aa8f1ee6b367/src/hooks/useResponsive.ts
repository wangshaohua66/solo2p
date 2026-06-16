import { useEffect, useState, useCallback } from 'react';

export type Breakpoint = 'xs' | 'md' | 'lg' | 'xl';

export function useResponsive() {
  const getBreakpoint = useCallback((): Breakpoint => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    if (w < 768) return 'xs';
    if (w < 1024) return 'md';
    if (w < 1280) return 'lg';
    return 'xl';
  }, []);

  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint);

  useEffect(() => {
    const handler = () => setBreakpoint(getBreakpoint());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [getBreakpoint]);

  return {
    breakpoint,
    isXl: breakpoint === 'xl',
    isLgUp: breakpoint !== 'xs',
    isMdUp: breakpoint !== 'xs' && breakpoint !== 'md',
    isXs: breakpoint === 'xs',
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
  };
}
