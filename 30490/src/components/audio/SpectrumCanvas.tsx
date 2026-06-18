import { useEffect, useRef, useCallback } from 'react';
import { drawSpectrum } from '@/utils/audio/waveform';
import styles from './SpectrumCanvas.module.css';

interface SpectrumCanvasProps {
  frequencyData: Uint8Array;
  height?: number;
}

export const SpectrumCanvas = ({
  frequencyData,
  height = 80,
}: SpectrumCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const frequencyDataRef = useRef<Uint8Array>(frequencyData);

  frequencyDataRef.current = frequencyData;

  const resizeCanvas = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
  }, []);

  const render = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const data = frequencyDataRef.current;

    drawSpectrum(canvas, data, {
      colors: {
        barStart: 'var(--color-spectrum-start)',
        barEnd: 'var(--color-spectrum-end)',
        peak: 'var(--color-spectrum-peak)',
      },
    });

    animationFrameRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    resizeCanvas();
    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [resizeCanvas, render]);

  useEffect(() => {
    if (!containerRef.current) return;

    resizeObserverRef.current = new ResizeObserver(() => {
      resizeCanvas();
    });

    resizeObserverRef.current.observe(containerRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [resizeCanvas]);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
      />
    </div>
  );
};

export default SpectrumCanvas;
