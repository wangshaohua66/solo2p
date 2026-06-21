import { useRef, useEffect, useCallback, DependencyList } from 'react';

/**
 * Canvas渲染回调函数参数
 */
export interface CanvasRenderContext {
  /** Canvas 2D上下文，已根据DPR缩放，绘制时使用逻辑坐标即可 */
  ctx: CanvasRenderingContext2D;
  /** Canvas的逻辑宽度（像素，已扣除DPR影响） */
  width: number;
  /** Canvas的逻辑高度（像素，已扣除DPR影响） */
  height: number;
}

/**
 * useCanvasRenderer 配置参数
 */
export interface UseCanvasRendererOptions {
  /**
   * 渲染函数，每次需要重绘时调用
   * 内部已根据DPR缩放坐标系，直接传入逻辑尺寸绘制即可
   */
  render: (context: CanvasRenderContext) => void;
  /**
   * 触发重新渲染的依赖数组，同 useEffect 的依赖列表
   * 当依赖变化时会自动标记脏并重绘
   */
  deps: DependencyList;
  /**
   * 是否启用 devicePixelRatio 高清适配
   * @default true
   */
  dpr?: boolean;
  /**
   * 容器尺寸变化时的回调
   * 可用于在尺寸变化后执行额外的逻辑
   */
  onResize?: (size: { width: number; height: number }) => void;
}

/**
 * Canvas分层渲染Hook：优化甘特图、拓扑图等画布性能
 *
 * 主要功能：
 * - 自动处理 devicePixelRatio，在高清屏上保持清晰
 * - 监听容器尺寸变化，自动调整canvas大小并重绘
 * - 根据 deps 依赖变化自动重绘
 * - 脏标记机制：一帧内多次标记脏只重绘一次（requestAnimationFrame去重）
 *
 * @param options 渲染配置
 * @returns 绑定到 <canvas> 元素的 ref
 *
 * @example
 * ```tsx
 * const canvasRef = useCanvasRenderer({
 *   render: ({ ctx, width, height }) => {
 *     ctx.clearRect(0, 0, width, height);
 *     ctx.fillStyle = '#1677ff';
 *     ctx.fillRect(10, 10, width - 20, height - 20);
 *   },
 *   deps: [tasks, zoom],
 *   dpr: true,
 *   onResize: ({ width, height }) => {
 *     console.log('Canvas resized:', width, height);
 *   },
 * });
 *
 * return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
 * ```
 */
export function useCanvasRenderer(
  options: UseCanvasRendererOptions
): React.RefObject<HTMLCanvasElement> {
  const { render, deps, dpr = true, onResize } = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const dirtyRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  const performRender = useCallback(() => {
    rafIdRef.current = null;
    dirtyRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    if (width <= 0 || height <= 0) return;

    const currentDpr = dpr ? window.devicePixelRatio || 1 : 1;

    ctx.save();
    ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
    render({ ctx, width, height });
    ctx.restore();
  }, [render, dpr]);

  const requestRender = useCallback(() => {
    if (dirtyRef.current) return;
    dirtyRef.current = true;

    if (rafIdRef.current === null) {
      rafIdRef.current = window.requestAnimationFrame(performRender);
    }
  }, [performRender]);

  const resizeCanvas = useCallback(
    (entry: ResizeObserverEntry) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { width, height } = entry.contentRect;
      const newWidth = Math.floor(width);
      const newHeight = Math.floor(height);

      if (
        sizeRef.current.width === newWidth &&
        sizeRef.current.height === newHeight
      ) {
        return;
      }

      sizeRef.current = { width: newWidth, height: newHeight };

      const currentDpr = dpr ? window.devicePixelRatio || 1 : 1;

      canvas.width = Math.max(1, Math.floor(newWidth * currentDpr));
      canvas.height = Math.max(1, Math.floor(newHeight * currentDpr));

      onResize?.({ width: newWidth, height: newHeight });
      requestRender();
    },
    [dpr, onResize, requestRender]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          resizeCanvas(entry);
        }
      });

      observer.observe(canvas);

      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        sizeRef.current = {
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        };
        const currentDpr = dpr ? window.devicePixelRatio || 1 : 1;
        canvas.width = Math.max(1, Math.floor(rect.width * currentDpr));
        canvas.height = Math.max(1, Math.floor(rect.height * currentDpr));
        requestRender();
      }

      return () => {
        observer.disconnect();
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    }

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [resizeCanvas, dpr, requestRender]);

  useEffect(() => {
    requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return canvasRef;
}
