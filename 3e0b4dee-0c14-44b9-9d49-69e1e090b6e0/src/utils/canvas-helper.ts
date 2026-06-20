export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  size = 8
): void {
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const isEven = ((x / size) + (y / size)) % 2 === 0;
      ctx.fillStyle = isEven ? '#1a1d24' : '#23272f';
      ctx.fillRect(x, y, size, size);
    }
  }
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cellW: number,
  cellH: number,
  color = 'rgba(255,255,255,0.08)'
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += cellW) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += cellH) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
  }
  ctx.restore();
}

export function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  stroke: string, lineWidth = 1, dash: number[] = []
): void {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  if (dash.length) ctx.setLineDash(dash);
  ctx.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, Math.floor(w) - 1, Math.floor(h) - 1);
  ctx.restore();
}

export function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, color: string
): void {
  ctx.save(); ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  ctx.restore();
}

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size = 10, color = '#ff6b35'
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.restore();
}

export function createOffscreenCanvas(w: number, h: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

export function resizeCanvasToDisplay(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
