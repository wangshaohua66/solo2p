import { useEffect, useRef, useCallback } from 'react';
import type { WaveformData } from '@/types';
import { drawWaveform, getTimeFromIndex } from '@/utils/audio/waveform';
import styles from './WaveformCanvas.module.css';

interface WaveformCanvasProps {
  waveformData: WaveformData | null;
  progress: number;
  height?: number;
  onClick?: (time: number) => void;
  loopStart?: number | null;
  loopEnd?: number | null;
}

export const WaveformCanvas = ({
  waveformData,
  progress,
  height = 120,
  onClick,
  loopStart = null,
  loopEnd = null,
}: WaveformCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const render = useCallback(() => {
    if (!canvasRef.current || !waveformData) return;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    drawWaveform(canvas, waveformData, {
      progress,
      loopStart: loopStart ?? undefined,
      loopEnd: loopEnd ?? undefined,
      colors: {
        wave: 'var(--color-waveform)',
        waveProgress: 'var(--color-waveform-progress)',
        loop: 'var(--color-accent-glow)',
        centerLine: 'rgba(255, 255, 255, 0.1)',
      },
    });
  }, [waveformData, progress, loopStart, loopEnd]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    if (!containerRef.current) return;

    resizeObserverRef.current = new ResizeObserver(() => {
      render();
    });

    resizeObserverRef.current.observe(containerRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [render]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick || !canvasRef.current || !waveformData) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = getTimeFromIndex(waveformData, x, rect.width);
    onClick(time);
  };

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onClick={handleClick}
      />
    </div>
  );
};

export default WaveformCanvas;
