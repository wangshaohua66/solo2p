import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight,
  Filter,
  Plus,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { mockApi } from '@/api/mock';
import ReferralCreateModal, { type CreateReferralForm } from '@/components/ReferralCreateModal';
import ReferralDetailModal from '@/components/ReferralDetailModal';
import type { Referral, Patient, Station, Doctor } from '@/types';

const STATUS_CONFIG: Record<Referral['status'], { label: string; className: string }> = {
  pending: { label: '待处理', className: 'bg-warning-100 text-warning-700' },
  accepted: { label: '已接受', className: 'bg-green-100 text-green-700' },
  rejected: { label: '已拒绝', className: 'bg-gray-100 text-gray-600' },
};

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'accepted', label: '已接受' },
  { value: 'rejected', label: '已拒绝' },
];

const STAT_CARDS = [
  { key: 'total', label: '转诊总数', icon: ArrowLeftRight, color: 'primary' as const },
  { key: 'pending', label: '待处理', icon: Clock, color: 'warning' as const },
  { key: 'accepted', label: '已接受', icon: CheckCircle, color: 'green' as const },
  { key: 'rejected', label: '已拒绝', icon: XCircle, color: 'gray' as const },
];

function formatDateTime(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailReferral, setDetailReferral] = useState<Referral | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const loadReferrals = async (status?: string) => {
    setLoading(true);
    try {
      const data = await mockApi.listReferrals(
        status && status !== 'all' ? { status } : undefined,
      );
      setReferrals(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals();
    Promise.all([mockApi.listPatients(), mockApi.listStations(), mockApi.listDoctors()]).then(
      ([p, s, d]) => {
        setPatients(p);
        setStations(s);
        setDoctors(d);
      },
    );
  }, []);

  const stats = useMemo(
    () => ({
      total: referrals.length,
      pending: referrals.filter((r) => r.status === 'pending').length,
      accepted: referrals.filter((r) => r.status === 'accepted').length,
      rejected: referrals.filter((r) => r.status === 'rejected').length,
    }),
    [referrals],
  );

  const handleFilter = (status: string) => {
    setStatusFilter(status);
    loadReferrals(status);
  };

  const handleCreate = async (form: CreateReferralForm) => {
    await mockApi.createReferral({
      patientId: form.patientId,
      toStationId: form.toStationId,
      fromDoctorId: form.doctorId || undefined,
      fromStationId: 's1',
      reason: form.reason,
      materials: form.files.map((f) => ({
        name: f,
        type: f.split('.').pop() || 'file',
        uploadedAt: new Date().toISOString(),
      })),
      files: form.files.map((f) => ({ name: f, size: 1024 })),
    });
    setShowCreateModal(false);
    await loadReferrals(statusFilter);
  };

  const handleAccept = async () => {
    if (!detailReferral) return;
    await mockApi.acceptReferral();
    setDetailReferral(null);
    await loadReferrals(statusFilter);
  };

  const handleReject = async (reason: string) => {
    if (!detailReferral) return;
    await mockApi.rejectReferral(reason);
    setDetailReferral(null);
    await loadReferrals(statusFilter);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-primary-600" />
            跨站转诊
          </h1>
          <p className="mt-1 text-sm text-gray-500">跨服务站患者转诊协同，保障连续性诊疗</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-1.5" />
          新建转诊
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={stats[card.key as keyof typeof stats]}
            icon={card.icon}
            color={card.color}
          />
        ))}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">筛选：</span>
          </div>
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => handleFilter(f.value)}
                className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                  statusFilter === f.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto text-sm text-gray-500">
            共 <span className="font-medium text-gray-800">{referrals.length}</span> 条转诊
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">加载中...</div>
        ) : referrals.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <ArrowLeftRight className="w-14 h-14 mx-auto mb-3 opacity-30" />
            <div>暂无转诊记录</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-3 px-3 font-medium">患者</th>
                  <th className="py-3 px-3 font-medium">转诊路径</th>
                  <th className="py-3 px-3 font-medium">转诊原因</th>
                  <th className="py-3 px-3 font-medium">材料</th>
                  <th className="py-3 px-3 font-medium">状态</th>
                  <th className="py-3 px-3 font-medium">发起时间</th>
                  <th className="py-3 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => {
                  const st = STATUS_CONFIG[r.status];
                  const materialCount =
                    (r.materials?.length || 0) + (r.files?.length || 0);
                  return (
                    <tr key={r.id} className="table-row">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium">
                            {r.patientName?.[0]}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{r.patientName}</div>
                            <div className="text-xs text-gray-400">ID: {r.patientId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2 text-gray-700">
                          <span>{r.fromStationName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-primary-500" />
                          <span className="font-medium text-primary-600">{r.toStationName}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{r.fromDoctorName}</div>
                      </td>
                      <td className="py-3 px-3 max-w-[220px]">
                        <div className="text-gray-600 truncate" title={r.reason}>
                          {r.reason}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          {materialCount}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`badge ${st.className}`}>{st.label}</span>
                      </td>
                      <td className="py-3 px-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatDateTime(r.createdAt)}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => setDetailReferral(r)}
                          className={`text-xs flex items-center gap-1 ${
                            r.status === 'pending'
                              ? 'text-primary-600 hover:text-primary-700'
                              : 'text-gray-500 hover:text-primary-600'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {r.status === 'pending' ? '查看详情' : '查看'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReferralCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        patients={patients}
        stations={stations}
        doctors={doctors}
        onSubmit={handleCreate}
      />
      <ReferralDetailModal
        referral={detailReferral}
        onClose={() => setDetailReferral(null)}
        onAccept={handleAccept}
        onReject={handleReject}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: typeof ArrowLeftRight;
  color: 'primary' | 'warning' | 'green' | 'gray';
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const config = {
    primary: { wrap: 'from-primary-50 to-white', box: 'bg-primary-100', icon: 'text-primary-600', num: 'text-primary-600' },
    warning: { wrap: 'from-warning-50 to-white', box: 'bg-warning-100', icon: 'text-warning-600', num: 'text-warning-600' },
    green: { wrap: 'from-green-50 to-white', box: 'bg-green-100', icon: 'text-green-600', num: 'text-green-600' },
    gray: { wrap: 'from-gray-50 to-white', box: 'bg-gray-100', icon: 'text-gray-500', num: 'text-gray-600' },
  }[color];
  return (
    <div className={`card p-4 bg-gradient-to-br ${config.wrap} animate-slide-up`}>
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{label}</div>
        <div className={`w-9 h-9 rounded-lg ${config.box} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${config.icon}`} />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${config.num}`}>{value}</span>
        <span className="text-xs text-gray-400">条</span>
      </div>
    </div>
  );
}
