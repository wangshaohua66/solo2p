import { useState, useEffect } from 'react';
import {
  X,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Paperclip,
  ArrowLeftRight,
  Building2,
  Stethoscope,
  User,
  Calendar,
} from 'lucide-react';
import LoadingButton from '@/components/LoadingButton';
import { mockApi } from '@/api/mock';
import type { Referral, ReferralLog } from '@/types';

const LOG_ACTION_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  created: { label: '发起转诊', icon: ArrowLeftRight, color: 'bg-primary-100 text-primary-600' },
  accepted: { label: '接受转诊', icon: CheckCircle, color: 'bg-green-100 text-green-600' },
  rejected: { label: '拒绝转诊', icon: XCircle, color: 'bg-gray-100 text-gray-500' },
};

const STATUS_CONFIG: Record<Referral['status'], { label: string; className: string }> = {
  pending: { label: '待处理', className: 'bg-warning-100 text-warning-700' },
  accepted: { label: '已接受', className: 'bg-green-100 text-green-700' },
  rejected: { label: '已拒绝', className: 'bg-gray-100 text-gray-600' },
};

function formatDateTime(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

interface Props {
  referral: Referral | null;
  onClose: () => void;
  onAccept: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}

export default function ReferralDetailModal({ referral, onClose, onAccept, onReject }: Props) {
  const [logs, setLogs] = useState<ReferralLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!referral) return;
    setShowReject(false);
    setRejectReason('');
    setLogsLoading(true);
    mockApi.listReferralLogs(referral.id).then((data) => {
      setLogs(data);
      setLogsLoading(false);
    });
  }, [referral]);

  if (!referral) return null;

  const status = STATUS_CONFIG[referral.status];
  const canAct = referral.status === 'pending';

  const handleAccept = async () => {
    await onAccept();
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    await onReject(rejectReason.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary-600" />
            转诊详情
            <span className={`badge ${status.className} ml-2`}>{status.label}</span>
          </h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-gray-400">患者</div>
                <div className="text-sm font-medium text-gray-800 truncate">{referral.patientName}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-4 h-4 text-primary-600" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-gray-400">发起医生</div>
                <div className="text-sm font-medium text-gray-800 truncate">{referral.fromDoctorName || '-'}</div>
              </div>
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-primary-600" />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-800">{referral.fromStationName}</span>
                <ArrowLeftRight className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-primary-600">{referral.toStationName}</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-gray-400 mb-1">转诊原因</div>
              <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{referral.reason}</div>
            </div>
            {referral.rejectReason && (
              <div className="md:col-span-2">
                <div className="text-xs text-gray-400 mb-1">拒绝原因</div>
                <div className="text-sm text-danger-700 bg-danger-50 rounded-lg p-3">{referral.rejectReason}</div>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="w-4 h-4 text-gray-400" />
              发起时间：{formatDateTime(referral.createdAt)}
            </div>
            {referral.acceptedAt && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle className="w-4 h-4 text-green-500" />
                接受时间：{formatDateTime(referral.acceptedAt)}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-600" />
              转诊材料
            </div>
            {referral.materials && referral.materials.length > 0 ? (
              <div className="space-y-2">
                {referral.materials.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary-600 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{m.name}</span>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 uppercase">{m.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400">暂无材料</div>
            )}
          </div>

          {referral.files && referral.files.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary-600" />
                附件文件
              </div>
              <div className="space-y-2">
                {referral.files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{f.name}</span>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(f.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-600" />
              处理时间线
            </div>
            {logsLoading ? (
              <div className="text-sm text-gray-400 py-4 text-center">加载中...</div>
            ) : logs.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute left-2 top-1 bottom-1 w-px bg-gray-200" />
                {logs.map((log) => {
                  const cfg = LOG_ACTION_CONFIG[log.action] || {
                    label: log.action,
                    icon: Clock,
                    color: 'bg-gray-100 text-gray-500',
                  };
                  const Icon = cfg.icon;
                  return (
                    <div key={log.id} className="relative pb-4 last:pb-0">
                      <div className={`absolute -left-[18px] w-4 h-4 rounded-full flex items-center justify-center ${cfg.color}`}>
                        <Icon className="w-2.5 h-2.5" />
                      </div>
                      <div className="ml-2">
                        <div className="text-sm font-medium text-gray-800">{cfg.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{log.detail}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {log.operatorName && <span>{log.operatorName} · </span>}
                          {formatDateTime(log.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-400">暂无处理记录</div>
            )}
          </div>

          {canAct && showReject && (
            <div className="animate-slide-up">
              <label className="label">拒绝原因 <span className="text-danger-500">*</span></label>
              <textarea
                className="input min-h-[80px] resize-y"
                placeholder="请填写拒绝转诊的原因..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          )}
        </div>

        {canAct && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3">
            {!showReject ? (
              <>
                <button onClick={() => setShowReject(true)} className="btn-secondary">
                  <XCircle className="w-4 h-4 mr-1.5" />
                  拒绝转诊
                </button>
                <LoadingButton onClick={handleAccept} loadingText="接受中...">
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  接受转诊
                </LoadingButton>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setShowReject(false);
                    setRejectReason('');
                  }}
                  className="btn-secondary"
                >
                  取消
                </button>
                <LoadingButton
                  variant="danger"
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  loadingText="提交中..."
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  确认拒绝
                </LoadingButton>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
