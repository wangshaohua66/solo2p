export interface AlignmentResult {
  score: number;
  alignedSeq1: string;
  alignedSeq2: string;
  startPos1: number;
  startPos2: number;
  endPos1: number;
  endPos2: number;
  matches: number;
  mismatches: number;
  gaps: number;
  identity: number;
}

export interface AlignerConfig {
  match: number;
  mismatch: number;
  gapOpen: number;
  gapExtend: number;
}

const DEFAULT_CONFIG: AlignerConfig = {
  match: 2,
  mismatch: -1,
  gapOpen: -2,
  gapExtend: -1,
};

export function smithWaterman(
  seq1: string,
  seq2: string,
  config: Partial<AlignerConfig> = {}
): AlignmentResult | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const m = seq1.length;
  const n = seq2.length;

  if (m === 0 || n === 0) return null;

  const rows = m + 1;
  const cols = n + 1;
  const H = new Int32Array(rows * cols);
  const trace = new Uint8Array(rows * cols);

  const STOP = 0;
  const UP = 1;
  const LEFT = 2;
  const DIAG = 3;

  let maxScore = 0;
  let maxI = 0;
  let maxJ = 0;

  for (let i = 1; i <= m; i++) {
    const rowOff = i * cols;
    const prevRowOff = (i - 1) * cols;
    const c1 = seq1[i - 1];
    for (let j = 1; j <= n; j++) {
      const matchScore = c1 === seq2[j - 1] ? cfg.match : cfg.mismatch;
      const diag = H[prevRowOff + j - 1] + matchScore;
      const up = H[prevRowOff + j] + (trace[prevRowOff + j] === UP ? cfg.gapExtend : cfg.gapOpen);
      const left = H[rowOff + j - 1] + (trace[rowOff + j - 1] === LEFT ? cfg.gapExtend : cfg.gapOpen);

      let score = diag;
      let dir = DIAG;
      if (up > score) { score = up; dir = UP; }
      if (left > score) { score = left; dir = LEFT; }
      if (score <= 0) { score = 0; dir = STOP; }

      H[rowOff + j] = score;
      trace[rowOff + j] = dir;

      if (score > maxScore) {
        maxScore = score;
        maxI = i;
        maxJ = j;
      }
    }
  }

  if (maxScore === 0) return null;

  let a1 = '';
  let a2 = '';
  let i = maxI;
  let j = maxJ;
  let matches = 0;
  let mismatches = 0;
  let gaps = 0;

  while (trace[i * cols + j] !== STOP) {
    const dir = trace[i * cols + j];
    if (dir === DIAG) {
      const c1 = seq1[i - 1];
      const c2 = seq2[j - 1];
      a1 = c1 + a1;
      a2 = c2 + a2;
      if (c1 === c2) matches++;
      else mismatches++;
      i--;
      j--;
    } else if (dir === UP) {
      a1 = seq1[i - 1] + a1;
      a2 = '-' + a2;
      gaps++;
      i--;
    } else {
      a1 = '-' + a1;
      a2 = seq2[j - 1] + a2;
      gaps++;
      j--;
    }
  }

  const total = matches + mismatches + gaps;
  const identity = total > 0 ? (matches / total) * 100 : 0;

  return {
    score: maxScore,
    alignedSeq1: a1,
    alignedSeq2: a2,
    startPos1: i,
    startPos2: j,
    endPos1: maxI - 1,
    endPos2: maxJ - 1,
    matches,
    mismatches,
    gaps,
    identity,
  };
}
