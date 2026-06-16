import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export const Modal = ({ open, onClose, title, children, footer, width = 480 }: ModalProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ minWidth: Math.min(width, window.innerWidth - 48) }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-sidebar-light">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md flex items-center justify-center text-sidebar-fg hover:bg-sidebar-light hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 p-4 border-t border-sidebar-light bg-sidebar-light/30">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
