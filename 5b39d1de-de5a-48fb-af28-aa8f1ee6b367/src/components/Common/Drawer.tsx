import React, { useEffect } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  position?: 'left' | 'right' | 'bottom';
  width?: number | string;
  height?: number | string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  position = 'bottom',
  width = 280,
  height = 320,
  children,
}) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
      };
    }
  }, [open, onClose]);

  const isHoriz = position === 'left' || position === 'right';

  const containerStyle: React.CSSProperties = isHoriz
    ? { width: typeof width === 'number' ? `${width}px` : width, height: '100%' }
    : { width: '100%', height: typeof height === 'number' ? `${height}px` : height };

  const slideClass =
    position === 'left'
      ? open
        ? 'translate-x-0'
        : '-translate-x-full'
      : position === 'right'
      ? open
        ? 'translate-x-0'
        : 'translate-x-full'
      : open
      ? 'translate-y-0'
      : 'translate-y-full';

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed z-50 bg-[#1e1e2e] border border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${slideClass} ${
          position === 'left'
            ? 'left-0 top-0 rounded-r-xl'
            : position === 'right'
            ? 'right-0 top-0 rounded-l-xl'
            : 'left-0 bottom-0 rounded-t-xl'
        }`}
        style={containerStyle}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-100 transition-colors p-1 rounded hover:bg-white/10"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </aside>
    </>
  );
};
