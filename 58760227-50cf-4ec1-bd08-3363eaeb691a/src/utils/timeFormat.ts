export function formatTime(seconds: number, includeMs = false): string {
  if (!isFinite(seconds) || seconds < 0) {
    return includeMs ? "00:00:00.000" : "00:00:00";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return includeMs
    ? `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`
    : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatTimeShort(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function parseTime(str: string): number {
  const parts = str.trim().split(/[:.]/);
  let h = 0, m = 0, s = 0, ms = 0;
  if (parts.length === 4) {
    h = Number(parts[0]) || 0;
    m = Number(parts[1]) || 0;
    s = Number(parts[2]) || 0;
    ms = Number(parts[3].slice(0, 3).padEnd(3, "0")) || 0;
  } else if (parts.length === 3) {
    if (str.includes(".")) {
      m = Number(parts[0]) || 0;
      s = Number(parts[1]) || 0;
      ms = Number(parts[2].slice(0, 3).padEnd(3, "0")) || 0;
    } else {
      h = Number(parts[0]) || 0;
      m = Number(parts[1]) || 0;
      s = Number(parts[2]) || 0;
    }
  } else if (parts.length === 2) {
    m = Number(parts[0]) || 0;
    s = Number(parts[1]) || 0;
  } else if (parts.length === 1) {
    s = Number(parts[0]) || 0;
  }
  return h * 3600 + m * 60 + s + ms / 1000;
}

export function generateTimeTicks(
  duration: number,
  pixelsPerSecond: number,
  minTickSpacing = 60
): Array<{ time: number; label: string; major: boolean }> {
  if (duration <= 0) return [];
  const secPerPixel = 1 / pixelsPerSecond;
  const minSecPerTick = secPerPixel * minTickSpacing;
  let step = 1;
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
  for (const c of candidates) {
    if (c >= minSecPerTick) {
      step = c;
      break;
    }
  }
  const ticks: Array<{ time: number; label: string; major: boolean }> = [];
  for (let t = 0; t <= duration + step; t += step) {
    const major = step >= 60 ? (t % (step * 5) === 0) : (t % 10 === 0);
    let label: string;
    if (t >= 3600) {
      label = formatTime(t);
    } else {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      label = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    ticks.push({ time: t, label, major });
  }
  return ticks;
}
