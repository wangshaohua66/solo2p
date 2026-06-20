import { useEffect, useRef, useCallback, useState } from 'react';
import { useAnalysisStore } from '@/stores/analysisStore';
import { translateToAminoAcid } from '@/utils/sequenceParser';
import { useResizeObserver } from '@/hooks/useResizeObserver';

const BASE_COLORS: Record<string, string> = {
  A: '#3fb950',
  T: '#f85149',
  C: '#58a6ff',
  G: '#d29922',
  N: '#8b949e',
};

const PADDING_LEFT = 40;
const LINE_HEIGHT = 28;
const CHAR_HEIGHT = 18;

interface SequenceCanvasProps {
  onSelectionChange?: (start: number, end: number) => void;
  onHoverPosition?: (pos: number | null) => void;
}

export function SequenceCanvas({ onSelectionChange, onHoverPosition }: SequenceCanvasProps) {
  const { ref, size } = useResizeObserver<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number | null>(null);

  const currentSequence = useAnalysisStore((s) => s.currentSequence);
  const viewMode = useAnalysisStore((s) => s.viewMode);
  const viewport = useAnalysisStore((s) => s.viewport);
  const setViewport = useAnalysisStore((s) => s.setViewport);
  const selection = useAnalysisStore((s) => s.selection);
  const setSelection = useAnalysisStore((s) => s.setSelection);
  const searchResults = useAnalysisStore((s) => s.searchResults);

  const displaySequence = useCallback(() => {
    if (!currentSequence) return '';
    const seq = currentSequence.sequence.slice(viewport.start, viewport.end);
    if (viewMode === 'aminoacid') {
      return translateToAminoAcid(seq);
    }
    return seq;
  }, [currentSequence, viewMode, viewport.start, viewport.end]);

  const charWidth = useCallback(() => {
    const base = viewMode === 'aminoacid' ? 14 : 11;
    return base * viewport.zoom;
  }, [viewMode, viewport.zoom]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = charWidth();
    const seq = displaySequence();
    const visibleChars = Math.max(1, Math.floor((size.width - PADDING_LEFT) / cw));
    const actualSeq = seq.slice(0, visibleChars);

    if (canvas.width !== size.width * dpr || canvas.height !== size.height * dpr) {
      canvas.width = size.width * dpr;
      canvas.height = size.height * dpr;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    if (!currentSequence) {
      ctx.fillStyle = '#8b949e';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('请导入序列文件开始分析', size.width / 2, size.height / 2);
      return;
    }

    const y = (size.height - CHAR_HEIGHT) / 2;

    if (selection) {
      const selStart = Math.max(0, selection.start - viewport.start);
      const selEnd = Math.min(actualSeq.length, selection.end - viewport.start);
      if (selEnd > selStart) {
        ctx.fillStyle = 'rgba(88, 166, 255, 0.25)';
        ctx.fillRect(
          PADDING_LEFT + selStart * cw,
          y - 4,
          (selEnd - selStart) * cw,
          CHAR_HEIGHT + 8
        );
      }
    }

    for (let i = 0; i < searchResults.length; i++) {
      const pos = searchResults[i] - viewport.start;
      if (pos >= 0 && pos < actualSeq.length) {
        ctx.fillStyle = 'rgba(210, 153, 34, 0.35)';
        ctx.fillRect(
          PADDING_LEFT + pos * cw,
          y - 2,
          cw,
          CHAR_HEIGHT + 4
        );
      }
    }

    ctx.font = `${CHAR_HEIGHT}px JetBrains Mono, Fira Code, monospace`;
    ctx.textBaseline = 'middle';

    for (let i = 0; i < actualSeq.length; i++) {
      const ch = actualSeq[i];
      const x = PADDING_LEFT + i * cw + cw / 2;
      ctx.fillStyle = BASE_COLORS[ch] ?? '#8b949e';
      ctx.textAlign = 'center';
      ctx.fillText(ch, x, y + CHAR_HEIGHT / 2);
    }

    if (hoverPos !== null) {
      const relPos = hoverPos - viewport.start;
      if (relPos >= 0 && relPos < actualSeq.length) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          PADDING_LEFT + relPos * cw,
          y - 4,
          cw,
          CHAR_HEIGHT + 8
        );
      }
    }
  }, [size, currentSequence, viewport, selection, searchResults, hoverPos, charWidth, displaySequence]);

  useEffect(() => {
    let raf = 0;
    const doRender = () => {
      raf = 0;
      render();
    };
    raf = requestAnimationFrame(doRender);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [render]);

  const posFromEvent = useCallback(
    (clientX: number, rect: DOMRect): number => {
      const cw = charWidth();
      const x = clientX - rect.left - PADDING_LEFT;
      const relIdx = Math.floor(x / cw);
      const visChars = Math.max(1, Math.floor((size.width - PADDING_LEFT) / cw));
      const idx = Math.max(0, Math.min(visChars - 1, relIdx));
      return viewport.start + idx;
    },
    [charWidth, size.width, viewport.start]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!currentSequence) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = posFromEvent(e.clientX, rect);
    setIsDragging(true);
    setDragStart(pos);
    setSelection({ start: pos, end: pos });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = posFromEvent(e.clientX, rect);
    setHoverPos(pos);
    onHoverPosition?.(pos);

    if (isDragging && dragStart !== null) {
      const start = Math.min(dragStart, pos);
      const end = Math.max(dragStart, pos) + 1;
      setSelection({ start, end });
      onSelectionChange?.(start, end);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && selection && selection.start === selection.end) {
      setSelection(null);
    }
    setIsDragging(false);
    setDragStart(null);
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
    onHoverPosition?.(null);
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!currentSequence) return;
    e.preventDefault();
    const cw = charWidth();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mousePos = posFromEvent(e.clientX, rect);

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.3, Math.min(8, viewport.zoom * delta));
    const visChars = Math.max(1, Math.floor((size.width - PADDING_LEFT) / (cw * delta / viewport.zoom * newZoom / viewport.zoom * cw / cw)));
    const halfVis = Math.floor(visChars / 2);
    const newStart = Math.max(0, Math.min(currentSequence.length - visChars, mousePos - halfVis));
    const newEnd = Math.min(currentSequence.length, newStart + visChars);

    setViewport({ zoom: newZoom, start: newStart, end: newEnd });
  };

  const handleScroll = useCallback((delta: number) => {
    if (!currentSequence) return;
    const cw = charWidth();
    const visible = Math.floor((size.width - PADDING_LEFT) / cw);
    const step = Math.max(1, Math.floor(visible * 0.2)) * (delta > 0 ? 1 : -1);
    const newStart = Math.max(0, Math.min(currentSequence.length - visible, viewport.start + step));
    setViewport({ start: newStart, end: newStart + visible });
  }, [currentSequence, charWidth, size.width, viewport.start, setViewport]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        handleScroll(e.deltaX || e.deltaY);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [ref, handleScroll]);

  const tooltipChar = hoverPos !== null && currentSequence
    ? currentSequence.sequence[hoverPos]
    : null;

  return (
    <div ref={ref} className="relative w-full h-full flex flex-col select-none">
      <div className="h-6 flex-shrink-0 px-2" />
      <div
        className="flex-1 relative cursor-text"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />
        {tooltipChar !== null && (
          <div
            className="absolute pointer-events-none bg-bio-panel border border-bio-border rounded px-2 py-1 text-xs font-mono"
            style={{
              left: Math.min(
                PADDING_LEFT + ((hoverPos! - viewport.start) * charWidth()),
                size.width - 80
              ),
              top: 4,
            }}
          >
            <span className="text-bio-text-secondary">Pos </span>
            <span className="text-bio-text">{hoverPos}</span>
            <span className="text-bio-text-secondary mx-1">|</span>
            <span style={{ color: BASE_COLORS[tooltipChar] }} className="font-bold">
              {tooltipChar}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
