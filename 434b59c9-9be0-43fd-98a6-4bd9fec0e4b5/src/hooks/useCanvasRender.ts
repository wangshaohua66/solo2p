import { useCallback, useEffect, useRef } from 'react';

interface UseCanvasRenderOptions {
  onRender?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  dpr?: number;
}

export function useCanvasRender<T extends HTMLCanvasElement = HTMLCanvasElement>(
  options: UseCanvasRenderOptions = {}
) {
  const canvasRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);
  const dpr = options.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    options.onRender?.(ctx, width, height);
  }, [dpr, options.onRender]);

  const requestRender = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      render();
    });
  }, [render]);

  useEffect(() => {
    requestRender();
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [requestRender]);

  return { canvasRef, requestRender, render };
}
