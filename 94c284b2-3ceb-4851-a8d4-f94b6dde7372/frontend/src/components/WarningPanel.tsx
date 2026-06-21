import { useState } from 'react';
import { AlertTriangle, User, Phone, CheckCircle, Clock, X, FileText, Bell, Activity, ShieldCheck } from 'lucide-react';
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
    text: 'text-danger-600',
  },
  medium: {
    bar: 'bg-warning-500',
    bg: 'bg-warning-50 border-warning-200',
    badge: 'bg-warning-100 text-warning-700',
    label: '中危',
    text: 'text-warning-600',
  },
  low: {
    bar: 'bg-secondary-500',
    bg: 'bg-secondary-50 border-secondary-200',
    badge: 'bg-secondary-100 text-secondary-700',
    label: '低危',
    text: 'text-secondary-600',
  },
};

const statusConfig = {
  pending: { label: '待处理', badge: 'bg-danger-100 text-danger-700' },
  processing: { label: '处理中', badge: 'bg-warning-100 text-warning-700' },
  resolved: { label: '已解决', badge: 'bg-gray-100 text-gray-500' },
};

export default function WarningPanel({ warning, compact, onResolve, onAssign, onNotify }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [resolution, setResolution] = useState('');
  const cfg = levelConfig[warning.riskLevel];
  const sc = statusConfig[warning.status];

  if (compact) {
    return (
      <>
        <div
          className={clsx('flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow', cfg.bg)}
          onClick={() => setShowModal(true)}
        >
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
        {showModal && (
          <WarningDetailModal
            warning={warning}
            onClose={() => setShowModal(false)}
            onResolve={onResolve}
            onAssign={onAssign}
            onNotify={onNotify}
            resolution={resolution}
            setResolution={setResolution}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="card-hover overflow-hidden cursor-pointer" onClick={() => setShowModal(true)}>
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
                <button
                  onClick={(e) => { e.stopPropagation(); onAssign?.(); }}
                  className="btn-primary text-sm"
                >
                  <CheckCircle className="w-4 h-4 mr-1" /> 接单处理
                </button>
              )}
              {warning.status === 'processing' && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                  className="btn-primary text-sm"
                >
                  <CheckCircle className="w-4 h-4 mr-1" /> 标记已解决
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onNotify?.(); }}
                className="btn-secondary text-sm"
              >
                <Phone className="w-4 h-4 mr-1" /> 再次通知
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                className="btn-ghost text-sm text-gray-500"
              >
                <FileText className="w-4 h-4 mr-1" /> 查看详情
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && (
        <WarningDetailModal
          warning={warning}
          onClose={() => setShowModal(false)}
          onResolve={onResolve}
          onAssign={onAssign}
          onNotify={onNotify}
          resolution={resolution}
          setResolution={setResolution}
        />
      )}
    </>
  );
}

interface ModalProps {
  warning: Warning;
  onClose: () => void;
  onResolve?: () => void;
  onAssign?: () => void;
  onNotify?: () => void;
  resolution: string;
  setResolution: (v: string) => void;
}

function WarningDetailModal({ warning, onClose, onResolve, onAssign, onNotify, resolution, setResolution }: ModalProps) {
  const cfg = levelConfig[warning.riskLevel];
  const sc = statusConfig[warning.status];

  const handleResolve = () => {
    onResolve?.();
    onClose();
  };

  const handleAssign = () => {
    onAssign?.();
    onClose();
  };

  const handleNotify = () => {
    onNotify?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={clsx('flex items-center justify-between p-4 border-b border-gray-100', cfg.bg)}>
          <div className="flex items-center gap-3">
            <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', cfg.badge)}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">预警详情</h3>
              <p className="text-xs text-gray-500">
                预警ID: {warning.id} · {new Date(warning.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div className="flex items-center gap-4">
            <div className={clsx('w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0', cfg.badge)}>
              <span className="text-3xl font-bold">{warning.riskScore}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-5 h-5 text-gray-400" />
                <span className="text-lg font-medium text-gray-800">{warning.patient?.name || warning.patientName}</span>
                <span className={clsx('badge', cfg.badge)}>{cfg.label}</span>
                <span className={clsx('badge', sc.badge)}>{sc.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <ShieldCheck className="w-4 h-4 text-gray-400" />
                  风险等级: <span className={clsx('font-medium', cfg.text)}>{cfg.label}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  状态: <span className="font-medium">{sc.label}</span>
                </div>
                {warning.assigneeName && (
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <User className="w-4 h-4 text-gray-400" />
                    负责人: <span className="font-medium">{warning.assigneeName}</span>
                  </div>
                )}
                {warning.notifiedFamily && (
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    家属已通知
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-600" />
              触发因素（共{warning.triggerFactors?.length || 0}项）
            </h4>
            <div className="flex flex-wrap gap-2">
              {warning.triggerFactors?.map((f, i) => (
                <span key={i} className={clsx('badge px-3 py-1', cfg.badge)}>
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">患者ID</div>
              <div className="text-sm text-gray-700 font-mono">{warning.patientId}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">创建时间</div>
              <div className="text-sm text-gray-700">{new Date(warning.createdAt).toLocaleString('zh-CN')}</div>
            </div>
            {warning.resolvedAt && (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">解决时间</div>
                <div className="text-sm text-gray-700">{new Date(warning.resolvedAt).toLocaleString('zh-CN')}</div>
              </div>
            )}
            {warning.resolution && (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">处置结果</div>
                <div className="text-sm text-gray-700">{warning.resolution}</div>
              </div>
            )}
          </div>

          {warning.status === 'processing' && (
            <div>
              <label className="label">处置记录</label>
              <textarea
                className="input"
                rows={3}
                placeholder="请输入处置措施和结果..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50">
          <button onClick={handleNotify} className="btn-secondary text-sm">
            <Bell className="w-4 h-4 mr-1" />
            发送通知
          </button>
          {warning.status === 'pending' && (
            <button onClick={handleAssign} className="btn-primary text-sm">
              <CheckCircle className="w-4 h-4 mr-1" />
              接单处理
            </button>
          )}
          {warning.status === 'processing' && (
            <button
              onClick={handleResolve}
              disabled={!resolution}
              className="btn-primary text-sm disabled:bg-primary-200"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              确认解决
            </button>
          )}
          {warning.status === 'resolved' && (
            <span className="badge bg-green-100 text-green-700">
              <CheckCircle className="w-4 h-4 mr-1" />
              已解决
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
