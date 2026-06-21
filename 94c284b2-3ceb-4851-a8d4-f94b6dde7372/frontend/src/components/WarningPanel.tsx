import { AlertTriangle, User, Phone, CheckCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import type { Warning } from '@/types';

interface Props {
  warning: Warning;
  compact?: boolean;
  onResolve?: () => void;
  onAssign?: () => void;
  onNotify?: () => void;
}

const levelConfig = {
  high: {
    bar: 'bg-danger-500',
    bg: 'bg-danger-50 border-danger-200',
    badge: 'bg-danger-100 text-danger-700',
    label: '高危',
  },
  medium: {
    bar: 'bg-warning-500',
    bg: 'bg-warning-50 border-warning-200',
    badge: 'bg-warning-100 text-warning-700',
    label: '中危',
  },
  low: {
    bar: 'bg-secondary-500',
    bg: 'bg-secondary-50 border-secondary-200',
    badge: 'bg-secondary-100 text-secondary-700',
    label: '低危',
  },
};

const statusConfig = {
  pending: { label: '待处理', badge: 'bg-danger-100 text-danger-700' },
  processing: { label: '处理中', badge: 'bg-warning-100 text-warning-700' },
  resolved: { label: '已解决', badge: 'bg-gray-100 text-gray-500' },
};

export default function WarningPanel({ warning, compact, onResolve, onAssign, onNotify }: Props) {
  const cfg = levelConfig[warning.riskLevel];
  const sc = statusConfig[warning.status];

  if (compact) {
    return (
      <div className={clsx('flex items-center gap-3 p-3 rounded-lg border', cfg.bg)}>
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', cfg.badge)}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">{warning.patient?.name || warning.patientName}</span>
            <span className={clsx('badge', cfg.badge)}>{cfg.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">风险分 {warning.riskScore} · {new Date(warning.createdAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <span className={clsx('badge', sc.badge)}>{sc.label}</span>
      </div>
    );
  }

  return (
    <div className="card-hover overflow-hidden">
      <div className={clsx('flex gap-4 p-5 border-l-4', cfg.bar)}>
        <div className={clsx('w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0', cfg.badge)}>
          <span className="text-2xl font-bold">{warning.riskScore}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-500" />
              {warning.patient?.name || warning.patientName}
            </h4>
            <span className={clsx('badge', cfg.badge)}>{cfg.label}预警</span>
            <span className={clsx('badge', sc.badge)}>{sc.label}</span>
            {warning.notifiedFamily && (
              <span className="badge bg-primary-100 text-primary-700 flex items-center gap-1">
                <Phone className="w-3 h-3" /> 家属已通知
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            触发时间：{new Date(warning.createdAt).toLocaleString('zh-CN')}
            {warning.assigneeName && ` · 负责人：${warning.assigneeName}`}
          </p>

          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1.5">触发因素</p>
            <div className="flex flex-wrap gap-1.5">
              {warning.triggerFactors?.map((f, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{f}</span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {warning.status === 'pending' && (
              <button onClick={onAssign} className="btn-primary text-sm">
                <CheckCircle className="w-4 h-4 mr-1" /> 接单处理
              </button>
            )}
            {warning.status === 'processing' && (
              <button onClick={onResolve} className="btn-primary text-sm">
                <CheckCircle className="w-4 h-4 mr-1" /> 标记已解决
              </button>
            )}
            <button onClick={onNotify} className="btn-secondary text-sm">
              <Phone className="w-4 h-4 mr-1" /> 再次通知
            </button>
            <button className="btn-ghost text-sm text-gray-500">
              <Clock className="w-4 h-4 mr-1" /> 查看处置记录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
