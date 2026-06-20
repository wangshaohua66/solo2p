import { useMemo } from 'react';

interface RulerAxisProps {
  start: number;
  end: number;
  charWidth: number;
  width: number;
  paddingLeft: number;
}

export function RulerAxis({ start, end, charWidth, width, paddingLeft }: RulerAxisProps) {
  const ticks = useMemo(() => {
    const result: Array<{ pos: number; label: string }> = [];
    const visibleLen = end - start;
    const targetTicks = Math.max(4, Math.floor(width / 100));
    const rawStep = visibleLen / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    let step: number;
    if (normalized <= 1) step = magnitude;
    else if (normalized <= 2.5) step = 2.5 * magnitude;
    else if (normalized <= 5) step = 5 * magnitude;
    else step = 10 * magnitude;

    const firstTick = Math.ceil(start / step) * step;
    for (let pos = firstTick; pos <= end; pos += step) {
      result.push({ pos, label: formatPosition(pos) });
    }
    return result;
  }, [start, end, width]);

  return (
    <svg className="w-full h-6" preserveAspectRatio="none" viewBox={`0 0 ${width} 24`}>
      <line x1={paddingLeft} y1={22} x2={width} y2={22} stroke="#30363d" strokeWidth={1} />
      {ticks.map((t, i) => {
        const x = paddingLeft + (t.pos - start) * charWidth;
        if (x < paddingLeft || x > width) return null;
        return (
          <g key={i}>
            <line x1={x} y1={14} x2={x} y2={22} stroke="#30363d" strokeWidth={1} />
            <text
              x={x}
              y={10}
              textAnchor="middle"
              fontSize={10}
              fill="#8b949e"
              fontFamily="JetBrains Mono, monospace"
            >
              {t.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function formatPosition(pos: number): string {
  if (pos >= 1000000) return `${(pos / 1000000).toFixed(1)}M`;
  if (pos >= 1000) return `${(pos / 1000).toFixed(1)}K`;
  return pos.toString();
}
