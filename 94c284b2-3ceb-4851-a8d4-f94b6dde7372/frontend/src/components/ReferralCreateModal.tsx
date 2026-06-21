import { useState, useMemo } from 'react';
import { Upload, X, FileText, ArrowLeftRight } from 'lucide-react';
import LoadingButton from '@/components/LoadingButton';
import type { Patient, Station, Doctor } from '@/types';

export interface CreateReferralForm {
  patientId: string;
  toStationId: string;
  doctorId: string;
  reason: string;
  files: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  patients: Patient[];
  stations: Station[];
  doctors: Doctor[];
  onSubmit: (form: CreateReferralForm) => Promise<void>;
}

export default function ReferralCreateModal({
  open,
  onClose,
  patients,
  stations,
  doctors,
  onSubmit,
}: Props) {
  const [patientId, setPatientId] = useState('');
  const [toStationId, setToStationId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<string[]>([]);

  const availableDoctors = useMemo(
    () => doctors.filter((d) => !toStationId || d.stationId === toStationId),
    [doctors, toStationId],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    const names = Array.from(selected).map((f) => f.name);
    setFiles((prev) => Array.from(new Set([...prev, ...names])));
    e.target.value = '';
  };

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f !== name));

  const reset = () => {
    setPatientId('');
    setToStationId('');
    setDoctorId('');
    setReason('');
    setFiles([]);
  };

  const canSubmit = Boolean(patientId && toStationId && reason.trim());

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      patientId,
      toStationId,
      doctorId,
      reason: reason.trim(),
      files,
    });
    reset();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary-600" />
            新建跨站转诊
          </h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">选择患者 <span className="text-danger-500">*</span></label>
              <select className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">请选择患者</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}（{p.phone}）</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">目标服务站 <span className="text-danger-500">*</span></label>
              <select
                className="input"
                value={toStationId}
                onChange={(e) => {
                  setToStationId(e.target.value);
                  setDoctorId('');
                }}
              >
                <option value="">请选择服务站</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">接收医生</label>
              <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">不限（由目标站分配）</option>
                {availableDoctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}（{d.title}）</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">转诊原因 <span className="text-danger-500">*</span></label>
            <textarea
              className="input min-h-[96px] resize-y"
              placeholder="请详细描述转诊原因、患者症状及转诊需求..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div>
            <label className="label">附件材料</label>
            <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer block">
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">点击上传附件</p>
              <p className="text-xs text-gray-400 mt-1">支持 PDF、Word、图片等格式，可多选</p>
              <input type="file" multiple className="hidden" onChange={handleFileChange} />
            </label>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f) => (
                  <div key={f} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary-600 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{f}</span>
                    </div>
                    <button
                      onClick={() => removeFile(f)}
                      className="text-gray-400 hover:text-danger-600 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">取消</button>
          <LoadingButton onClick={handleSubmit} disabled={!canSubmit} loadingText="提交中...">
            <ArrowLeftRight className="w-4 h-4 mr-1.5" />
            提交转诊
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
