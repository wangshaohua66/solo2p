import { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Shield,
  Bell,
  Database,
  Building2,
  UserCog,
  Eye,
  Save,
  Plus,
  Trash2,
  ChevronRight,
  FileText,
  Smartphone,
  Mail,
  X,
} from 'lucide-react';
import { mockApi } from '@/api/mock';
import LoadingButton from '@/components/LoadingButton';
import FormField from '@/components/FormField';
import type { Schedule } from '@/types';

type SectionKey = 'basic' | 'stations' | 'doctors' | 'users' | 'risk' | 'sms' | 'audit' | 'privacy';

const SECTIONS: { key: SectionKey; label: string; icon: typeof Settings }[] = [
  { key: 'basic', label: '基本设置', icon: Settings },
  { key: 'stations', label: '服务站管理', icon: Building2 },
  { key: 'doctors', label: '医生排班', icon: UserCog },
  { key: 'users', label: '用户权限', icon: Users },
  { key: 'risk', label: '风险阈值', icon: Shield },
  { key: 'sms', label: '通知配置', icon: Bell },
  { key: 'audit', label: '审计日志', icon: FileText },
  { key: 'privacy', label: '隐私合规', icon: Eye },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>('basic');
  const [saved, setSaved] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [substituteDoctorId, setSubstituteDoctorId] = useState('');
  const [selectedScheduleForSubstitute, setSelectedScheduleForSubstitute] = useState<Schedule | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    doctorId: '',
    stationId: '',
    scheduleDate: '',
    startTime: '',
    endTime: '',
    maxPatients: '',
    scheduleType: 'regular' as 'regular' | 'temporary' | 'substitute',
    substituteDoctorId: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const DOCTORS_LIST = [
    { id: 'd1', name: '张建华' },
    { id: 'd2', name: '李雪梅' },
    { id: 'd3', name: '王志强' },
    { id: 'd4', name: '陈美玲' },
    { id: 'd5', name: '赵晓燕' },
    { id: 'd6', name: '刘建国' },
  ];

  const STATIONS_LIST = [
    { id: 's1', name: '中心院区' },
    { id: 's2', name: '东区服务站' },
    { id: 's3', name: '西区服务站' },
    { id: 's4', name: '南区服务站' },
    { id: 's5', name: '北区服务站' },
  ];

  useEffect(() => {
    if (activeSection === 'doctors') {
      mockApi.listSchedules().then(setSchedules);
    }
  }, [activeSection]);

  const validateField = (field: string, value: string) => {
    if (!value.trim()) return '此字段为必填项';
    return null;
  };

  const handleScheduleFormBlur = (field: string, value: string) => {
    const err = validateField(field, value);
    setFormErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
    return err;
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      doctorId: '',
      stationId: '',
      scheduleDate: '',
      startTime: '',
      endTime: '',
      maxPatients: '',
      scheduleType: 'regular',
      substituteDoctorId: '',
      notes: '',
    });
    setFormErrors({});
  };

  const handleSubmitSchedule = async () => {
    const errors: Record<string, string> = {};
    const requiredFields = ['doctorId', 'stationId', 'scheduleDate', 'startTime', 'endTime', 'maxPatients'];
    requiredFields.forEach((f) => {
      const err = validateField(f, (scheduleForm as Record<string, string>)[f]);
      if (err) errors[f] = err;
    });
    if (scheduleForm.scheduleType === 'substitute' && !scheduleForm.substituteDoctorId) {
      errors.substituteDoctorId = '此字段为必填项';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    const selectedDoctor = DOCTORS_LIST.find((d) => d.id === scheduleForm.doctorId);
    const selectedStation = STATIONS_LIST.find((s) => s.id === scheduleForm.stationId);
    const selectedSubstitute = DOCTORS_LIST.find((d) => d.id === scheduleForm.substituteDoctorId);
    const body = {
      doctorId: scheduleForm.doctorId,
      doctorName: selectedDoctor?.name,
      stationId: scheduleForm.stationId,
      stationName: selectedStation?.name,
      scheduleDate: scheduleForm.scheduleDate,
      startTime: scheduleForm.startTime,
      endTime: scheduleForm.endTime,
      maxPatients: parseInt(scheduleForm.maxPatients),
      scheduleType: scheduleForm.scheduleType,
      substituteDoctorId: scheduleForm.substituteDoctorId || undefined,
      substituteDoctorName: selectedSubstitute?.name,
      notes: scheduleForm.notes || undefined,
    };
    const newSchedule = await mockApi.createSchedule(body);
    setSchedules((prev) => [...prev, newSchedule]);
    setShowScheduleModal(false);
    resetScheduleForm();
  };

  const handleSubstituteSubmit = async () => {
    if (!substituteDoctorId || !selectedScheduleForSubstitute) return;
    const selectedSubstitute = DOCTORS_LIST.find((d) => d.id === substituteDoctorId);
    const body = {
      doctorId: selectedScheduleForSubstitute.doctorId,
      doctorName: selectedScheduleForSubstitute.doctorName,
      stationId: selectedScheduleForSubstitute.stationId,
      stationName: selectedScheduleForSubstitute.stationName,
      scheduleDate: selectedScheduleForSubstitute.scheduleDate,
      startTime: selectedScheduleForSubstitute.startTime,
      endTime: selectedScheduleForSubstitute.endTime,
      maxPatients: selectedScheduleForSubstitute.maxPatients,
      scheduleType: 'substitute' as const,
      substituteDoctorId,
      substituteDoctorName: selectedSubstitute?.name,
      notes: '请假代班',
    };
    const newSchedule = await mockApi.createSchedule(body);
    setSchedules((prev) => [...prev, newSchedule]);
    setShowSubstituteModal(false);
    setSubstituteDoctorId('');
    setSelectedScheduleForSubstitute(null);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">系统设置</h1>
          <p className="mt-1 text-sm text-gray-500">管理系统配置、用户权限与隐私合规</p>
        </div>
        <button onClick={handleSave} className="btn-primary">
          <Save className="w-4 h-4 mr-1.5" />
          {saved ? '已保存 ✓' : '保存设置'}
        </button>
      </div>

      <div className="flex gap-6">
        <div className="w-56 flex-shrink-0">
          <div className="card p-2 sticky top-4">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = activeSection === s.key;
              return (
                <div
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${
                    isActive
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{s.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {activeSection === 'basic' && (
            <div className="card p-6 space-y-6">
              <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-600" />
                基本设置
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="label">机构名称</label>
                  <input className="input" defaultValue="XX区精神卫生中心" />
                </div>
                <div>
                  <label className="label">机构简称</label>
                  <input className="input" defaultValue="精卫中心" />
                </div>
                <div>
                  <label className="label">联系电话</label>
                  <input className="input" defaultValue="0371-12345678" />
                </div>
                <div>
                  <label className="label">机构地址</label>
                  <input className="input" defaultValue="XX市XX区文化路88号" />
                </div>
                <div className="md:col-span-2">
                  <label className="label">系统Logo</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Database className="w-6 h-6 text-primary-600" />
                    </div>
                    <p className="text-sm text-gray-600">点击或拖拽上传Logo</p>
                    <p className="text-xs text-gray-400 mt-1">支持 JPG/PNG，建议尺寸 200x200px</p>
                  </div>
                </div>
                <div>
                  <label className="label">默认预约提前时间</label>
                  <select className="input">
                    <option>提前7天</option>
                    <option>提前14天</option>
                    <option>提前30天</option>
                  </select>
                </div>
                <div>
                  <label className="label">预约改签时间限制</label>
                  <select className="input">
                    <option>48小时内不可改签</option>
                    <option>24小时内不可改签</option>
                    <option>12小时内不可改签</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'stations' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary-600" />
                  服务站管理
                </h3>
                <button className="btn-primary text-sm">
                  <Plus className="w-4 h-4 mr-1" />
                  新增服务站
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-3 px-3 font-medium">服务站名称</th>
                      <th className="py-3 px-3 font-medium">地址</th>
                      <th className="py-3 px-3 font-medium">医生人数</th>
                      <th className="py-3 px-3 font-medium">状态</th>
                      <th className="py-3 px-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['中心院区', '文化路88号', 45, '启用'],
                      ['东区服务站', '东风路12号', 32, '启用'],
                      ['西区服务站', '建设路56号', 28, '启用'],
                      ['南区服务站', '航海路99号', 25, '启用'],
                      ['北区服务站', '农业路23号', 22, '启用'],
                    ].map((row, i) => (
                      <tr key={i} className="table-row">
                        <td className="py-3 px-3 font-medium text-gray-800">{row[0]}</td>
                        <td className="py-3 px-3 text-gray-600">{row[1]}</td>
                        <td className="py-3 px-3 text-gray-700">{row[2]}人</td>
                        <td className="py-3 px-3">
                          <span className="badge bg-green-100 text-green-700">{row[3]}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <button className="text-primary-600 hover:text-primary-700 text-xs">编辑</button>
                            <button className="text-danger-600 hover:text-danger-700 text-xs">停用</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'doctors' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-primary-600" />
                  医生排班管理
                </h3>
                <button
                  onClick={() => { resetScheduleForm(); setShowScheduleModal(true); }}
                  className="btn-primary text-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  新增排班
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">支持周期排班、临时调班、请假代班，自动同步至预约系统更新可约时段</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-3 px-3 font-medium">医生</th>
                      <th className="py-3 px-3 font-medium">服务站</th>
                      <th className="py-3 px-3 font-medium">排班日期</th>
                      <th className="py-3 px-3 font-medium">时段</th>
                      <th className="py-3 px-3 font-medium">类型</th>
                      <th className="py-3 px-3 font-medium">可约号源</th>
                      <th className="py-3 px-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((s) => (
                      <tr key={s.id} className="table-row">
                        <td className="py-3 px-3 font-medium text-gray-800">{s.doctorName || '-'}</td>
                        <td className="py-3 px-3 text-gray-600">{s.stationName || '-'}</td>
                        <td className="py-3 px-3 text-gray-700">{s.scheduleDate}</td>
                        <td className="py-3 px-3 text-gray-700">{s.startTime} - {s.endTime}</td>
                        <td className="py-3 px-3">
                          <span className={`badge ${
                            s.scheduleType === 'regular' ? 'bg-primary-100 text-primary-700' :
                            s.scheduleType === 'temporary' ? 'bg-warning-100 text-warning-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {s.scheduleType === 'regular' ? '周期排班' : s.scheduleType === 'temporary' ? '临时调班' : '请假代班'}
                          </span>
                          {s.substituteDoctorName && (
                            <span className="text-xs text-gray-500 ml-1">（{s.substituteDoctorName}）</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="badge bg-primary-100 text-primary-700">{s.maxPatients}号/天</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <button className="text-primary-600 hover:text-primary-700 text-xs">编辑排班</button>
                            <button
                              onClick={() => { setSelectedScheduleForSubstitute(s); setSubstituteDoctorId(''); setShowSubstituteModal(true); }}
                              className="text-warning-600 hover:text-warning-700 text-xs"
                            >
                              请假代班
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'users' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-600" />
                  用户与权限
                </h3>
                <button className="btn-primary text-sm">
                  <Plus className="w-4 h-4 mr-1" />
                  新增用户
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-3 px-3 font-medium">用户名</th>
                      <th className="py-3 px-3 font-medium">姓名</th>
                      <th className="py-3 px-3 font-medium">角色</th>
                      <th className="py-3 px-3 font-medium">所属服务站</th>
                      <th className="py-3 px-3 font-medium">状态</th>
                      <th className="py-3 px-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['admin', '系统管理员', '超级管理员', '-', '启用'],
                      ['doctor_zhang', '张建华', '医生', '中心院区', '启用'],
                      ['nurse_wang', '王丽', '护士', '东区服务站', '启用'],
                      ['manager_li', '李明', '科室主任', '中心院区', '启用'],
                    ].map((row, i) => (
                      <tr key={i} className="table-row">
                        <td className="py-3 px-3 font-medium text-gray-800">{row[0]}</td>
                        <td className="py-3 px-3 text-gray-700">{row[1]}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`badge ${
                              row[2] === '超级管理员'
                                ? 'bg-danger-100 text-danger-700'
                                : row[2] === '科室主任'
                                ? 'bg-warning-100 text-warning-700'
                                : 'bg-primary-100 text-primary-700'
                            }`}
                          >
                            {row[2]}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-600">{row[3]}</td>
                        <td className="py-3 px-3">
                          <span className="badge bg-green-100 text-green-700">{row[4]}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <button className="text-primary-600 hover:text-primary-700 text-xs">编辑</button>
                            <button className="text-danger-600 hover:text-danger-700 text-xs">
                              <Trash2 className="w-3.5 h-3.5 inline mr-0.5" />
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'risk' && (
            <div className="card p-6 space-y-6">
              <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary-600" />
                风险预警阈值设置
              </h3>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <p className="text-sm text-primary-700">
                  基于12项指标加权计算风险分值，超过阈值自动触发预警，建议值仅供参考，请根据实际情况调整
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="label">高危预警阈值（分值 ≥ ）</label>
                  <input type="number" className="input" defaultValue={60} />
                  <p className="text-xs text-danger-600 mt-1">自动推送短信至责任医生和家属</p>
                </div>
                <div>
                  <label className="label">中危预警阈值（分值 ≥ ）</label>
                  <input type="number" className="input" defaultValue={40} />
                  <p className="text-xs text-warning-600 mt-1">推送系统通知至责任医生</p>
                </div>
                <div>
                  <label className="label">PHQ-9量表高危阈值</label>
                  <input type="number" className="input" defaultValue={15} />
                </div>
                <div>
                  <label className="label">GAD-7量表高危阈值</label>
                  <input type="number" className="input" defaultValue={10} />
                </div>
                <div>
                  <label className="label">用药依从性预警阈值（≤ ）</label>
                  <input type="number" className="input" defaultValue={70} />
                  <span className="text-xs text-gray-400 ml-2">%</span>
                </div>
                <div>
                  <label className="label">超期未就诊预警（≥ ）</label>
                  <input type="number" className="input" defaultValue={30} />
                  <span className="text-xs text-gray-400 ml-2">天</span>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3">预警指标权重设置</h4>
                <div className="space-y-3">
                  {[
                    ['PHQ-9量表评分', 25],
                    ['GAD-7量表评分', 15],
                    ['用药依从性', 15],
                    ['就诊间隔时长', 10],
                    ['既往自杀史', 20],
                    ['既往自伤史', 15],
                  ].map(([label, weight], i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-36 text-sm text-gray-600">{label}</div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500"
                          style={{ width: `${weight}%` }}
                        />
                      </div>
                      <div className="w-12 text-right">
                        <input
                          type="number"
                          className="input !py-1 !text-xs text-center"
                          defaultValue={weight as number}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-5">分</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'sms' && (
            <div className="card p-6 space-y-6">
              <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary-600" />
                通知配置
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="label flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-gray-400" />
                    短信服务提供商
                  </label>
                  <select className="input">
                    <option>阿里云短信</option>
                    <option>腾讯云短信</option>
                    <option>华为云短信</option>
                  </select>
                </div>
                <div>
                  <label className="label">Access Key ID</label>
                  <input className="input" type="password" defaultValue="LTAI5t7..." />
                </div>
                <div>
                  <label className="label">Access Key Secret</label>
                  <input className="input" type="password" defaultValue="••••••••" />
                </div>
                <div>
                  <label className="label">短信签名</label>
                  <input className="input" defaultValue="【精卫中心】" />
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <h4 className="text-sm font-medium text-gray-700">通知场景配置</h4>
                {[
                  ['高危预警通知', true, '患者风险评分超过高危阈值时自动发送给责任医生和家属'],
                  ['预约确认短信', true, '患者预约成功后自动发送确认短信'],
                  ['复诊提醒通知', true, '复诊前1天发送提醒短信'],
                  ['医生调班通知', false, '医生临时调班时通知已预约患者'],
                ].map(([label, enabled, desc], i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">{label as string}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                    </div>
                    <button
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        enabled ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  邮件通知配置
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="label">SMTP服务器</label>
                    <input className="input" defaultValue="smtp.exmail.qq.com" />
                  </div>
                  <div>
                    <label className="label">端口</label>
                    <input className="input" defaultValue="465" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'audit' && (
            <div className="card p-6 space-y-4">
              <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                审计日志
                <span className="text-xs font-normal text-gray-400">（保留180天）</span>
              </h3>
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                <select className="input w-32 !py-1.5">
                  <option>全部操作</option>
                  <option>档案查阅</option>
                  <option>档案修改</option>
                  <option>档案导出</option>
                  <option>登录登出</option>
                </select>
                <select className="input w-32 !py-1.5">
                  <option>全部用户</option>
                </select>
                <input type="date" className="input w-36 !py-1.5" />
                <span className="text-gray-400">至</span>
                <input type="date" className="input w-36 !py-1.5" />
                <button className="btn-primary text-sm ml-auto">查询</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-3 px-3 font-medium">操作时间</th>
                      <th className="py-3 px-3 font-medium">操作人</th>
                      <th className="py-3 px-3 font-medium">操作类型</th>
                      <th className="py-3 px-3 font-medium">操作详情</th>
                      <th className="py-3 px-3 font-medium">IP地址</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['2026-06-18 14:32:18', '张建华', '档案查阅', '查看患者 p12 档案', '192.168.1.45'],
                      ['2026-06-18 11:20:05', '李雪梅', '档案修改', '更新患者 p08 用药方案', '192.168.1.38'],
                      ['2026-06-18 10:15:42', '系统管理员', '档案导出', '导出高危患者清单（124条）', '192.168.1.100'],
                      ['2026-06-18 09:05:33', '王志强', '预约创建', '为患者 p23 创建预约', '192.168.2.16'],
                      ['2026-06-18 08:30:11', '李明', '登录系统', '科室主任登录', '192.168.1.22'],
                    ].map((row, i) => (
                      <tr key={i} className="table-row">
                        <td className="py-3 px-3 text-gray-600">{row[0]}</td>
                        <td className="py-3 px-3 font-medium text-gray-800">{row[1]}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`badge ${
                              row[2] === '档案导出'
                                ? 'bg-danger-100 text-danger-700'
                                : row[2] === '档案修改'
                                ? 'bg-warning-100 text-warning-700'
                                : row[2] === '登录系统'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-primary-100 text-primary-700'
                            }`}
                          >
                            {row[2]}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-600">{row[3]}</td>
                        <td className="py-3 px-3 text-gray-500 font-mono text-xs">{row[4]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div className="card p-6 space-y-6">
              <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary-600" />
                隐私合规设置
              </h3>
              <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-danger-700 mb-1">患者隐私保护声明</h4>
                <p className="text-xs text-danger-600">
                  根据《中华人民共和国个人信息保护法》《精神卫生法》等法律法规，系统严格保护患者隐私信息，
                  所有敏感操作均会被记录审计，并保留180天日志备查。
                </p>
              </div>
              <div className="space-y-3">
                {[
                  ['档案脱敏显示', true, '列表中身份证号、手机号自动脱敏（如 138****1234）'],
                  ['操作二次验证', false, '导出档案、修改诊断等敏感操作需二次密码验证'],
                  ['自动会话超时', true, '无操作15分钟后自动登出系统'],
                  ['电子签名认证', true, '档案修改、诊断记录需电子签名确认'],
                  ['数据水印', true, '所有页面和导出文件添加操作人水印'],
                  ['异地登录提醒', true, '异地登录时发送短信通知用户'],
                ].map(([label, enabled, desc], i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between p-4 border border-gray-100 rounded-lg hover:border-primary-200 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">{label as string}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                    </div>
                    <button
                      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                        enabled ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3">数据保留策略</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="label">患者档案保留</label>
                    <select className="input">
                      <option>永久保存</option>
                      <option>30年</option>
                      <option>15年</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">审计日志保留</label>
                    <select className="input">
                      <option>180天</option>
                      <option>365天</option>
                      <option>永久保存</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">预约记录保留</label>
                    <select className="input">
                      <option>10年</option>
                      <option>5年</option>
                      <option>3年</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">短信记录保留</label>
                    <select className="input">
                      <option>90天</option>
                      <option>180天</option>
                      <option>365天</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <UserCog className="w-5 h-5 text-primary-600" />
                新增排班
              </h3>
              <button onClick={() => { setShowScheduleModal(false); resetScheduleForm(); }} className="btn-ghost p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  label="医生"
                  value={scheduleForm.doctorId}
                  onChange={(v) => setScheduleForm((p) => ({ ...p, doctorId: v }))}
                  onBlur={(v) => handleScheduleFormBlur('doctorId', v)}
                  type="select"
                  required
                  error={formErrors.doctorId}
                  options={DOCTORS_LIST.map((d) => ({ value: d.id, label: d.name }))}
                  placeholder="请选择医生"
                />
                <FormField
                  label="服务站"
                  value={scheduleForm.stationId}
                  onChange={(v) => setScheduleForm((p) => ({ ...p, stationId: v }))}
                  onBlur={(v) => handleScheduleFormBlur('stationId', v)}
                  type="select"
                  required
                  error={formErrors.stationId}
                  options={STATIONS_LIST.map((s) => ({ value: s.id, label: s.name }))}
                  placeholder="请选择服务站"
                />
                <FormField
                  label="排班日期"
                  value={scheduleForm.scheduleDate}
                  onChange={(v) => setScheduleForm((p) => ({ ...p, scheduleDate: v }))}
                  onBlur={(v) => handleScheduleFormBlur('scheduleDate', v)}
                  type="date"
                  required
                  error={formErrors.scheduleDate}
                />
                <FormField
                  label="排班类型"
                  value={scheduleForm.scheduleType}
                  onChange={(v) => setScheduleForm((p) => ({ ...p, scheduleType: v as 'regular' | 'temporary' | 'substitute' }))}
                  type="select"
                  required
                  options={[
                    { value: 'regular', label: '周期排班' },
                    { value: 'temporary', label: '临时调班' },
                    { value: 'substitute', label: '请假代班' },
                  ]}
                />
                <FormField
                  label="开始时间"
                  value={scheduleForm.startTime}
                  onChange={(v) => setScheduleForm((p) => ({ ...p, startTime: v }))}
                  onBlur={(v) => handleScheduleFormBlur('startTime', v)}
                  type="text"
                  required
                  error={formErrors.startTime}
                  placeholder="如 08:00"
                />
                <FormField
                  label="结束时间"
                  value={scheduleForm.endTime}
                  onChange={(v) => setScheduleForm((p) => ({ ...p, endTime: v }))}
                  onBlur={(v) => handleScheduleFormBlur('endTime', v)}
                  type="text"
                  required
                  error={formErrors.endTime}
                  placeholder="如 12:00"
                />
                <FormField
                  label="最大接诊数"
                  value={scheduleForm.maxPatients}
                  onChange={(v) => setScheduleForm((p) => ({ ...p, maxPatients: v }))}
                  onBlur={(v) => handleScheduleFormBlur('maxPatients', v)}
                  type="number"
                  required
                  error={formErrors.maxPatients}
                  placeholder="请输入最大接诊数"
                />
                {scheduleForm.scheduleType === 'substitute' && (
                  <FormField
                    label="代班医生"
                    value={scheduleForm.substituteDoctorId}
                    onChange={(v) => setScheduleForm((p) => ({ ...p, substituteDoctorId: v }))}
                    onBlur={(v) => handleScheduleFormBlur('substituteDoctorId', v)}
                    type="select"
                    required
                    error={formErrors.substituteDoctorId}
                    options={DOCTORS_LIST.map((d) => ({ value: d.id, label: d.name }))}
                    placeholder="请选择代班医生"
                  />
                )}
                <div className={scheduleForm.scheduleType === 'substitute' ? '' : 'md:col-span-2'}>
                  <FormField
                    label="备注"
                    value={scheduleForm.notes}
                    onChange={(v) => setScheduleForm((p) => ({ ...p, notes: v }))}
                    type="textarea"
                    placeholder="可选备注信息"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setShowScheduleModal(false); resetScheduleForm(); }} className="btn-secondary">取消</button>
              <LoadingButton onClick={handleSubmitSchedule} loadingText="提交中...">确认排班</LoadingButton>
            </div>
          </div>
        </div>
      )}

      {showSubstituteModal && selectedScheduleForSubstitute && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <UserCog className="w-5 h-5 text-primary-600" />
                请假代班 - {selectedScheduleForSubstitute.doctorName}
              </h3>
              <button onClick={() => setShowSubstituteModal(false)} className="btn-ghost p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <div>日期：{selectedScheduleForSubstitute.scheduleDate}</div>
                <div>时段：{selectedScheduleForSubstitute.startTime} - {selectedScheduleForSubstitute.endTime}</div>
              </div>
              <FormField
                label="代班医生"
                value={substituteDoctorId}
                onChange={setSubstituteDoctorId}
                type="select"
                required
                options={DOCTORS_LIST.filter((d) => d.id !== selectedScheduleForSubstitute.doctorId).map((d) => ({ value: d.id, label: d.name }))}
                placeholder="请选择代班医生"
              />
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowSubstituteModal(false)} className="btn-secondary">取消</button>
              <LoadingButton onClick={handleSubstituteSubmit} disabled={!substituteDoctorId} loadingText="提交中...">确认代班</LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
