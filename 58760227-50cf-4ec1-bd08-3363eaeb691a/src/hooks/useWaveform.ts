import { useMemo } from "react";

export function useWaveformLevels(
  peaks: number[] | undefined,
  width: number,
  levels = 5
): number[] {
  return useMemo(() => {
    if (!peaks || peaks.length === 0 || width <= 0) return new Array(levels).fill(0);
    const result: number[] = new Array(levels);
    const step = Math.max(1, Math.floor(peaks.length / width));
    for (let l = 0; l < levels; l++) {
      let sum = 0;
      let n = 0;
      const threshold = 0.2 + (l / levels) * 0.6;
      for (let i = 0; i < peaks.length; i += step) {
        if (peaks[i] >= threshold) {
          sum += peaks[i] ?? 0;
          n++;
        }
      }
      result[l] = n === 0 ? 0 : Math.min(1, sum / n);
    }
    return result;
  }, [peaks, width, levels]);
}

export interface RenderWaveformOptions {
  color?: string;
  gradientColors?: [string, string];
  backgroundColor?: string | null;
  barWidth?: number;
  barGap?: number;
  center?: boolean;
  mirror?: boolean;
  rounded?: boolean;
}

export function renderWaveform2D(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  width: number,
  height: number,
  options: RenderWaveformOptions = {}
) {
  const {
    color = "#4facfe",
    gradientColors,
    backgroundColor = null,
    barWidth = 2,
    barGap = 1,
    center = true,
    mirror = true,
    rounded = true,
  } = options;

  if (!peaks || peaks.length === 0) {
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
    return;
  }

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  const step = barWidth + barGap;
  const bars = Math.max(1, Math.floor(width / step));
  const perBar = Math.max(1, Math.floor(peaks.length / bars));

  let fill: string | CanvasGradient = color;
  if (gradientColors && gradientColors[0] && gradientColors[1]) {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, gradientColors[0]);
    grad.addColorStop(1, gradientColors[1]);
    fill = grad;
  }
  ctx.fillStyle = fill;

  const cy = center ? height / 2 : height;
  const maxH = center ? height * 0.48 : height * 0.96;

  for (let i = 0; i < bars; i++) {
    const start = i * perBar;
    let peak = 0;
    for (let j = 0; j < perBar && start + j < peaks.length; j++) {
      const v = peaks[start + j] ?? 0;
      if (v > peak) peak = v;
    }
    const h = Math.max(1, peak * maxH);
    const x = i * step;
    let y: number;
    let drawH = h;
    if (center) {
      y = mirror ? cy - h : cy;
      drawH = mirror ? h * 2 : h;
    } else {
      y = cy - h;
    }
    if (rounded && h > 2) {
      const r = Math.min(barWidth / 2, h / 3);
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, drawH, r);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, barWidth, drawH);
    }
  }
}

export function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  height: number,
  color = "#ffffff"
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, 0);
  ctx.lineTo(x + 0.5, height);
  ctx.stroke();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeRect(x - 3, 0, 7, 6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 6, 0);
  ctx.lineTo(x + 6, 0);
  ctx.lineTo(x + 6, 5);
  ctx.lineTo(x, 12);
  ctx.lineTo(x - 6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawSelection(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  height: number,
  color = "rgba(233,69,96,0.3)",
  border = "rgba(233,69,96,0.8)"
) {
  const x = Math.min(x1, x2);
  const w = Math.abs(x2 - x1);
  if (w < 1) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x, 0, w, height);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, 0);
  ctx.lineTo(x + 0.5, height);
  ctx.moveTo(x + w + 0.5, 0);
  ctx.lineTo(x + w + 0.5, height);
  ctx.stroke();
  ctx.restore();
}

export function drawRuler(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ticks: Array<{ time: number; label: string; major: boolean }>,
  pxPerSec: number,
  scrollX: number
) {
  ctx.save();
  ctx.fillStyle = "rgba(22,33,62,0.95)";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height - 0.5);
  ctx.lineTo(width, height - 0.5);
  ctx.stroke();

  ctx.font = "11px JetBrains Mono, monospace";
  ctx.textBaseline = "top";

  for (const tick of ticks) {
    const x = tick.time * pxPerSec - scrollX;
    if (x < -40 || x > width + 40) continue;
    const h = tick.major ? 14 : 7;
    ctx.strokeStyle = tick.major
      ? "rgba(255,255,255,0.35)"
      : "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(x + 0.5, height - h);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
    if (tick.major) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(tick.label, x + 4, 4);
    }
  }
  ctx.restore();
}
