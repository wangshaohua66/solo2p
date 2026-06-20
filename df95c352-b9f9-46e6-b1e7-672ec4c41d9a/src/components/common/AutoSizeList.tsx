import { useEffect, useRef, useState, type ReactNode, type ComponentType } from "react";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";

interface AutoSizeListProps {
  itemCount: number;
  itemSize: number;
  width?: string | number;
  children: ComponentType<ListChildComponentProps<unknown>>;
  className?: string;
  overscanCount?: number;
  itemData?: unknown;
  emptyState?: ReactNode;
}

export default function AutoSizeList({
  itemCount,
  itemSize,
  width = "100%",
  children,
  className,
  overscanCount = 5,
  itemData,
  emptyState,
}: AutoSizeListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (itemCount === 0 && emptyState) {
    return <div ref={containerRef} className="h-full w-full">{emptyState}</div>;
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <List
        height={height}
        itemCount={itemCount}
        itemSize={itemSize}
        width={width}
        overscanCount={overscanCount}
        itemData={itemData}
        className={className}
      >
        {children}
      </List>
    </div>
  );
}
