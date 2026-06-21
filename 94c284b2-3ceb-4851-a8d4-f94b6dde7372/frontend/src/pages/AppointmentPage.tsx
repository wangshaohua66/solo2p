import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Star,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Plus,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { mockApi } from '@/api/mock';
import type { Appointment, MatchResult, MatchRequest, TimeRange, Gender } from '@/types';
import { DEPARTMENTS, DOCTOR_TITLES } from '@/types';

const STATUS_MAP: Record<Appointment['status'], { label: string; className: string; icon: typeof CheckCircle }> = {
  confirmed: { label: '已确认', className: 'bg-primary-100 text-primary-700', icon: CheckCircle },
  pending: { label: '待确认', className: 'bg-warning-100 text-warning-700', icon: AlertCircle },
  completed: { label: '已完成', className: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-600', icon: XCircle },
  rescheduled: { label: '已改期', className: 'bg-blue-100 text-blue-700', icon: RefreshCw },
};

const TIME_RANGES: { value: TimeRange | 'any'; label: string }[] = [
  { value: 'any', label: '全天' },
  { value: 'morning', label: '上午(08:00-12:00)' },
  { value: 'afternoon', label: '下午(14:00-17:30)' },
  { value: 'evening', label: '晚间(18:00-20:00)' },
];

export default function AppointmentPage() {
  const { appointments, patients, loadAppointments, loadPatients, loading } = useAppStore();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay() || 7;
    return new Date(today.getTime() - (day - 1) * 86400000);
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchForm, setMatchForm] = useState<MatchRequest>({
    patientId: '',
    department: '',
    preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    preferredTimeRange: 'any',
    doctorGender: 'any',
    doctorTitle: '',
    language: '',
  });

  useEffect(() => {
    loadAppointments();
    loadPatients();
  }, [loadAppointments, loadPatients]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart.getTime() + i * 86400000);
      return {
        date: d.toISOString().slice(0, 10),
        dayName: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][i],
        dayNum: d.getDate(),
        isToday: d.toDateString() === new Date().toDateString(),
      };
    });
  }, [currentWeekStart]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (keyword) {
        const kw = keyword.toLowerCase();
        if (!a.patientName?.toLowerCase().includes(kw) && !a.doctorName?.toLowerCase().includes(kw)) return false;
      }
      return true;
    });
  }, [appointments, statusFilter, keyword]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    filteredAppointments.forEach((a) => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [filteredAppointments]);

  const selectedDayAppointments = appointmentsByDate[selectedDate] || [];

  const handleMatch = async () => {
    if (!matchForm.patientId || !matchForm.department) return;
    setMatchLoading(true);
    try {
      const results = await mockApi.matchAppointments();
      setMatchResults(results);
    } finally {
      setMatchLoading(false);
    }
  };

  const handleBook = async (result: MatchResult) => {
    const patient = patients.find((p) => p.id === matchForm.patientId);
    await mockApi.createAppointment({
      patientId: matchForm.patientId,
      patientName: patient?.name,
      doctorId: result.doctorId,
      doctorName: result.doctorName,
      stationId: 's1',
      department: matchForm.department,
      date: result.date,
      timeSlot: result.timeSlot,
      matchScore: result.matchScore,
    });
    await loadAppointments();
    setShowMatchModal(false);
    setMatchResults([]);
  };

  const handleReschedule = (apt: Appointment) => {
    setMatchForm((prev) => ({
      ...prev,
      patientId: apt.patientId,
      department: apt.department,
      preferredDate: apt.date,
    }));
    setShowMatchModal(true);
  };

  const handleCancel = async (id: string) => {
    await mockApi.cancelAppointment();
    await loadAppointments();
  };

  const goPrevWeek = () => setCurrentWeekStart(new Date(currentWeekStart.getTime() - 7 * 86400000));
  const goNextWeek = () => setCurrentWeekStart(new Date(currentWeekStart.getTime() + 7 * 86400000));

  const monthLabel = `${currentWeekStart.getFullYear()}年${currentWeekStart.getMonth() + 1}月`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">预约管理</h1>
          <p className="mt-1 text-sm text-gray-500">智能匹配医生时段，高效管理诊疗预约</p>
        </div>
        <button onClick={() => setShowMatchModal(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-1.5" />
          新建预约
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="搜索患者姓名或医生姓名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select className="input w-32" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">全部状态</option>
              <option value="pending">待确认</option>
              <option value="confirmed">已确认</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
              <option value="rescheduled">已改期</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={goPrevWeek} className="btn-ghost p-2">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-medium text-gray-800 min-w-[120px] text-center">{monthLabel}</span>
            <button onClick={goNextWeek} className="btn-ghost p-2">
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const day = today.getDay() || 7;
                setCurrentWeekStart(new Date(today.getTime() - (day - 1) * 86400000));
                setSelectedDate(today.toISOString().slice(0, 10));
              }}
              className="btn-secondary ml-2"
            >
              今天
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-500"></span>已确认</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning-500"></span>待确认</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>已完成</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span>已取消</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d) => {
            const count = appointmentsByDate[d.date]?.length || 0;
            const isSelected = d.date === selectedDate;
            return (
              <div
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={`cursor-pointer rounded-lg p-3 text-center transition-all border ${
                  isSelected
                    ? 'bg-primary-50 border-primary-400 shadow-sm'
                    : 'bg-gray-50 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className={`text-xs ${d.isToday ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
                  {d.dayName}{d.isToday && ' (今天)'}
                </div>
                <div className={`text-xl font-semibold mt-1 ${isSelected ? 'text-primary-600' : 'text-gray-800'}`}>
                  {d.dayNum}
                </div>
                <div className="mt-2 flex flex-wrap gap-1 justify-center min-h-[24px]">
                  {count > 0 && (
                    <span className={`badge ${count > 5 ? 'bg-danger-100 text-danger-700' : 'bg-primary-100 text-primary-700'}`}>
                      {count}个预约
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-base font-medium text-gray-800 mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600" />
          {selectedDate} 预约列表
          <span className="text-sm font-normal text-gray-500">（共{selectedDayAppointments.length}条）</span>
        </h3>
        {loading.appointments ? (
          <div className="py-12 text-center text-gray-400">加载中...</div>
        ) : selectedDayAppointments.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-40" />
            当日暂无预约
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-3 px-3 font-medium">时段</th>
                  <th className="py-3 px-3 font-medium">患者</th>
                  <th className="py-3 px-3 font-medium">科室</th>
                  <th className="py-3 px-3 font-medium">医生</th>
                  <th className="py-3 px-3 font-medium">服务站</th>
                  <th className="py-3 px-3 font-medium">匹配度</th>
                  <th className="py-3 px-3 font-medium">状态</th>
                  <th className="py-3 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {selectedDayAppointments
                  .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
                  .map((apt) => {
                    const st = STATUS_MAP[apt.status];
                    const Icon = st.icon;
                    return (
                      <tr key={apt.id} className="table-row">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {apt.timeSlot}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium">
                              {apt.patientName?.[0]}
                            </div>
                            <div>
                              <div className="font-medium text-gray-800">{apt.patientName}</div>
                              <div className="text-xs text-gray-400">ID: {apt.patientId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-700">{mockApi.deptNames[apt.department] || apt.department}</td>
                        <td className="py-3 px-3 text-gray-700">{apt.doctorName}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 text-gray-600">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {apt.doctor?.station?.name || '中心院区'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                            <span className={`font-medium ${apt.matchScore >= 85 ? 'text-green-600' : apt.matchScore >= 70 ? 'text-primary-600' : 'text-warning-600'}`}>
                              {apt.matchScore}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`badge ${st.className}`}>
                            <Icon className="w-3 h-3 mr-1" />
                            {st.label}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {apt.status === 'confirmed' && (
                              <>
                                <button onClick={() => handleReschedule(apt)} className="text-primary-600 hover:text-primary-700 text-xs">
                                  改期
                                </button>
                                <button onClick={() => handleCancel(apt.id)} className="text-danger-600 hover:text-danger-700 text-xs">
                                  取消
                                </button>
                              </>
                            )}
                            {apt.status === 'pending' && (
                              <button className="text-primary-600 hover:text-primary-700 text-xs">确认</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showMatchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                智能预约匹配
              </h3>
              <button onClick={() => { setShowMatchModal(false); setMatchResults([]); }} className="btn-ghost p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="label">选择患者 <span className="text-danger-500">*</span></label>
                  <select
                    className="input"
                    value={matchForm.patientId}
                    onChange={(e) => setMatchForm({ ...matchForm, patientId: e.target.value })}
                  >
                    <option value="">请选择患者</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">选择科室 <span className="text-danger-500">*</span></label>
                  <select
                    className="input"
                    value={matchForm.department}
                    onChange={(e) => setMatchForm({ ...matchForm, department: e.target.value })}
                  >
                    <option value="">请选择科室</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">期望日期</label>
                  <input
                    type="date"
                    className="input"
                    value={matchForm.preferredDate}
                    onChange={(e) => setMatchForm({ ...matchForm, preferredDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">期望时段</label>
                  <select
                    className="input"
                    value={matchForm.preferredTimeRange}
                    onChange={(e) => setMatchForm({ ...matchForm, preferredTimeRange: e.target.value as TimeRange | 'any' })}
                  >
                    {TIME_RANGES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">医生性别偏好</label>
                  <select
                    className="input"
                    value={matchForm.doctorGender || 'any'}
                    onChange={(e) => setMatchForm({ ...matchForm, doctorGender: e.target.value as Gender | 'any' })}
                  >
                    <option value="any">不限</option>
                    <option value="male">男医生</option>
                    <option value="female">女医生</option>
                  </select>
                </div>
                <div>
                  <label className="label">医生职称</label>
                  <select
                    className="input"
                    value={matchForm.doctorTitle || ''}
                    onChange={(e) => setMatchForm({ ...matchForm, doctorTitle: e.target.value })}
                  >
                    <option value="">不限</option>
                    {DOCTOR_TITLES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">语言偏好</label>
                  <select
                    className="input"
                    value={matchForm.language || ''}
                    onChange={(e) => setMatchForm({ ...matchForm, language: e.target.value })}
                  >
                    <option value="">不限</option>
                    <option value="中文">中文</option>
                    <option value="英文">英文</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleMatch}
                    disabled={!matchForm.patientId || !matchForm.department || matchLoading}
                    className="btn-primary w-full"
                  >
                    {matchLoading ? '匹配中...' : '智能匹配'}
                  </button>
                </div>
              </div>

              {matchResults.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    为您推荐以下 {matchResults.length} 个最优时段
                  </h4>
                  <div className="space-y-3">
                    {matchResults.map((r, idx) => (
                      <div
                        key={`${r.doctorId}-${r.date}-${r.timeSlot}`}
                        className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-base font-semibold">
                                {idx + 1}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-800">{r.doctorName}</span>
                                  <span className="text-xs text-gray-500">{r.doctorTitle}</span>
                                  <span className="badge bg-primary-100 text-primary-700">{r.department}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {r.date} {r.timeSlot}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {r.stationName}{r.distanceKm && ` · ${r.distanceKm}km`}
                                  </span>
                                  {r.historicalVisits > 0 && (
                                    <span className="flex items-center gap-1">
                                      <User className="w-3.5 h-3.5" />
                                      历史就诊{r.historicalVisits}次
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2 ml-[52px]">
                              {r.matchReasons.map((reason, i) => (
                                <span key={i} className="badge bg-green-50 text-green-700">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-baseline gap-0.5">
                              <span className={`text-2xl font-bold ${
                                r.matchScore >= 85 ? 'text-green-600' : r.matchScore >= 70 ? 'text-primary-600' : 'text-warning-600'
                              }`}>
                                {r.matchScore}
                              </span>
                              <span className="text-xs text-gray-400">/100</span>
                            </div>
                            <div className="text-xs text-gray-400 mb-2">匹配度</div>
                            <button onClick={() => handleBook(r)} className="btn-primary text-xs">
                              立即预约
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!matchLoading && matchResults.length === 0 && matchForm.patientId && matchForm.department && (
                <div className="text-center py-8 text-gray-400">
                  点击「智能匹配」按钮获取推荐时段
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
