import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface ResizablePanelProps {
  direction?: 'left' | 'right';
  initialSize?: number;
  defaultSize?: number;
  minSize: number;
  maxSize: number;
  className?: string;
  children: ReactNode;
  onResize?: (size: number) => void;
  onCollapse?: () => void;
}

export function ResizablePanel({
  direction = 'right',
  initialSize,
  defaultSize,
  minSize,
  maxSize,
  className = '',
  children,
  onResize,
  onCollapse,
}: ResizablePanelProps) {
  const [size, setSize] = useState(initialSize ?? defaultSize ?? 280);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.parentElement?.getBoundingClientRect();
      if (!rect) return;

      let newSize: number;
      if (direction === 'right') {
        newSize = rect.right - e.clientX;
      } else {
        newSize = e.clientX - rect.left;
      }
      newSize = Math.max(minSize, Math.min(maxSize, newSize));
      setSize(newSize);
      onResize?.(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, direction, minSize, maxSize, onResize]);

  return (
    <div
      ref={containerRef}
      className={`resizable-panel ${className}`}
      style={{ width: size, minWidth: minSize, maxWidth: maxSize }}
    >
      {direction === 'right' && (
        <div
          className={`resizable-handle left-0 ${isResizing ? 'active' : ''}`}
          onMouseDown={handleMouseDown}
        />
      )}
      <div className="w-full h-full overflow-hidden">{children}</div>
      {direction === 'left' && (
        <div
          className={`resizable-handle right-0 ${isResizing ? 'active' : ''}`}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
}
