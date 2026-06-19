export type Point = { x: number; y: number };

export function cubicBezierPath(from: Point, to: Point, type: 'FS' | 'SS' | 'FF' | 'SF' = 'FS'): string {
  const dx = Math.max(40, Math.abs(to.x - from.x) * 0.5);
  let cp1: Point;
  let cp2: Point;

  switch (type) {
    case 'FS':
      cp1 = { x: from.x + dx, y: from.y };
      cp2 = { x: to.x - dx, y: to.y };
      break;
    case 'SS':
      cp1 = { x: from.x + dx, y: from.y };
      cp2 = { x: to.x - dx, y: to.y };
      break;
    case 'FF':
      cp1 = { x: from.x - dx, y: from.y };
      cp2 = { x: to.x + dx, y: to.y };
      break;
    case 'SF':
      cp1 = { x: from.x + dx, y: from.y };
      cp2 = { x: to.x + dx, y: to.y };
      break;
  }

  return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
}
