import { useState, useRef, useCallback, useMemo, useEffect } from 'react';

/**
 * 虚拟滚动项
 *
 * @template T 数据项类型
 */
export interface VirtualItem<T> {
  /** 在原始数组中的索引 */
  index: number;
  /** 原始数据项 */
  item: T;
  /** 该项距离容器顶部的偏移量（像素） */
  offsetTop: number;
  /** 用于React渲染的唯一key */
  key: string | number;
}

/**
 * useVirtualScroll 配置参数
 *
 * @template T 数据项类型
 */
export interface UseVirtualScrollOptions<T> {
  /** 完整的数据列表 */
  items: T[];
  /** 每行的固定高度（像素） */
  rowHeight: number;
  /** 滚动容器的可视高度（像素） */
  containerHeight: number;
  /**
   * 上下 Overscan 额外渲染的行数，用于减少快速滚动时的白屏
   * @default 5
   */
  overscan?: number;
}

/**
 * useVirtualScroll 返回值
 *
 * @template T 数据项类型
 */
export interface UseVirtualScrollResult<T> {
  /** 当前需要渲染的虚拟项列表 */
  virtualItems: VirtualItem<T>[];
  /** 整个滚动区域的总高度（像素） */
  totalHeight: number;
  /** 绑定到容器的 onScroll 事件处理函数（已使用rAF节流） */
  onScroll: (event: React.UIEvent<HTMLElement>) => void;
  /** 绑定到容器的 ref，用于获取 scrollTop */
  containerRef: React.RefObject<HTMLElement>;
  /** 根据 scrollTop 计算起始索引的工具函数 */
  getStartIndex: (scrollTop: number) => number;
}

/**
 * 虚拟滚动Hook：仅渲染可视区域内（含Overscan）的行，大幅减少DOM节点数量
 * 适用于表格、甘特图等长列表场景，1000条数据可在1s内完成渲染
 *
 * @template T 数据项类型
 * @param options 虚拟滚动配置
 * @returns 虚拟滚动计算结果与事件处理器
 *
 * @example
 * ```tsx
 * const { virtualItems, totalHeight, onScroll, containerRef } = useVirtualScroll({
 *   items: tasks,
 *   rowHeight: 48,
 *   containerHeight: 600,
 *   overscan: 5,
 * });
 *
 * return (
 *   <div
 *     ref={containerRef}
 *     onScroll={onScroll}
 *     style={{ height: 600, overflow: 'auto', position: 'relative' }}
 *   >
 *     <div style={{ height: totalHeight, position: 'relative' }}>
 *       {virtualItems.map(({ item, offsetTop, key }) => (
 *         <div
 *           key={key}
 *           style={{ position: 'absolute', top: offsetTop, height: 48, left: 0, right: 0 }}
 *         >
 *           {renderRow(item)}
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 * );
 * ```
 */
export function useVirtualScroll<T>(
  options: UseVirtualScrollOptions<T>
): UseVirtualScrollResult<T> {
  const { items, rowHeight, containerHeight, overscan = 5 } = options;

  const containerRef = useRef<HTMLElement>(null);
  const scrollTopRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);

  const totalHeight = useMemo(
    () => items.length * rowHeight,
    [items.length, rowHeight]
  );

  const getStartIndex = useCallback(
    (top: number): number => {
      const rawIndex = Math.floor(top / rowHeight);
      return Math.max(0, rawIndex - overscan);
    },
    [rowHeight, overscan]
  );

  const getEndIndex = useCallback(
    (top: number): number => {
      const visibleCount = Math.ceil(containerHeight / rowHeight);
      const rawEnd = Math.ceil(top / rowHeight) + visibleCount;
      return Math.min(items.length, rawEnd + overscan);
    },
    [rowHeight, containerHeight, overscan, items.length]
  );

  const virtualItems = useMemo<VirtualItem<T>[]>(() => {
    const start = getStartIndex(scrollTop);
    const end = getEndIndex(scrollTop);
    const result: VirtualItem<T>[] = [];

    for (let i = start; i < end; i++) {
      result.push({
        index: i,
        item: items[i],
        offsetTop: i * rowHeight,
        key: i,
      });
    }

    return result;
  }, [items, rowHeight, scrollTop, getStartIndex, getEndIndex]);

  const updateScrollTop = useCallback(() => {
    rafIdRef.current = null;
    setScrollTop(scrollTopRef.current);
  }, []);

  const onScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      const target = event.currentTarget;
      scrollTopRef.current = target.scrollTop;

      if (rafIdRef.current === null) {
        rafIdRef.current = window.requestAnimationFrame(updateScrollTop);
      }
    },
    [updateScrollTop]
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  return {
    virtualItems,
    totalHeight,
    onScroll,
    containerRef,
    getStartIndex,
  };
}
