import { useProjectStore } from '@/stores/projectStore';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const iconMap = {
  success: { Icon: CheckCircle, color: 'text-bio-green' },
  error: { Icon: XCircle, color: 'text-bio-red' },
  warning: { Icon: AlertTriangle, color: 'text-bio-orange' },
  info: { Icon: Info, color: 'text-bio-blue' },
};

export function ToastNotification() {
  const { toasts, removeToast } = useProjectStore();

  return (
    <div className="toast-container">
      {toasts.map((t) => {
        const { Icon, color } = iconMap[t.type];
        return (
          <div key={t.id} className="toast-item flex items-center gap-3 min-w-[280px]">
            <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
            <span className="text-sm flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-bio-text-secondary hover:text-bio-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
