import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  User,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Pill,
  ClipboardList,
  MessageSquare,
  Download,
  Edit3,
  Plus,
  AlertTriangle,
  Clock,
  Stethoscope,
  TrendingUp,
  Pen,
} from 'lucide-react';
import { mockApi } from '@/api/mock';
import { SCALE_DEFINITIONS } from '@/types';
import SignaturePad from '@/components/SignaturePad';
import LoadingButton from '@/components/LoadingButton';
import type {
  Patient,
  DiagnosisRecord,
  Medication,
  Assessment,
  Followup,
  Severity,
  Signature,
} from '@/types';

const TABS = [
  { key: 'basic', label: '基本信息', icon: User },
  { key: 'diagnosis', label: '诊断记录', icon: Stethoscope },
  { key: 'medication', label: '用药方案', icon: Pill },
  { key: 'assessment', label: '心理测评', icon: ClipboardList },
  { key: 'followup', label: '随访记录', icon: MessageSquare },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const RISK_CONFIG = {
  high: { label: '高危', className: 'bg-danger-100 text-danger-700', bar: 'bg-danger-500' },
  medium: { label: '中危', className: 'bg-warning-100 text-warning-700', bar: 'bg-warning-500' },
  low: { label: '低危', className: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
};

const SEVERITY_CONFIG: Record<Severity, { label: string; className: string }> = {
  normal: { label: '正常', className: 'bg-green-100 text-green-700' },
  mild: { label: '轻度', className: 'bg-blue-100 text-blue-700' },
  moderate: { label: '中度', className: 'bg-warning-100 text-warning-700' },
  severe: { label: '重度', className: 'bg-danger-100 text-danger-700' },
};

const ADHERENCE_CONFIG = [
  { min: 90, label: '优秀', className: 'text-green-600' },
  { min: 70, label: '良好', className: 'text-primary-600' },
  { min: 50, label: '一般', className: 'text-warning-600' },
  { min: 0, label: '较差', className: 'text-danger-600' },
];

export default function PatientRecordPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [selectedScale, setSelectedScale] = useState<string>('PHQ-9');
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, number>>({});
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureContext, setSignatureContext] = useState<{ resourceType: string; resourceId: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [p, d, m, a, f, sigs] = await Promise.all([
        mockApi.getPatient(id),
        mockApi.getDiagnoses(id),
        mockApi.getMedications(id),
        mockApi.getAssessments(id),
        mockApi.getFollowups(id),
        mockApi.listSignatures(id),
      ]);
      setPatient(p);
      setDiagnoses(d);
      setMedications(m);
      setAssessments(a);
      setFollowups(f);
      setSignatures(sigs);
      setLoading(false);
    })();
  }, [id]);

  const age = patient ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear() : 0;
  const riskCfg = patient ? RISK_CONFIG[patient.riskLevel as keyof typeof RISK_CONFIG] : null;

  const getAdherenceInfo = (adherence: number) => {
    return ADHERENCE_CONFIG.find((c) => adherence >= c.min) || ADHERENCE_CONFIG[ADHERENCE_CONFIG.length - 1];
  };

  const handleSubmitAssessment = async () => {
    const answers = Object.values(assessmentAnswers);
    const total = answers.reduce((s, v) => s + v, 0);
    const severity: Severity = total >= 15 ? 'severe' : total >= 10 ? 'moderate' : total >= 5 ? 'mild' : 'normal';
    await mockApi.createAssessment();
    const scale = SCALE_DEFINITIONS.find((s) => s.code === selectedScale);
    setAssessments((prev) => [
      {
        id: 'as' + Date.now(),
        patientId: id!,
        scaleCode: selectedScale,
        scaleName: scale?.name || '',
        totalScore: total,
        severity,
        answers: assessmentAnswers,
        assessorId: 'u1',
        assessedAt: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setShowAssessmentModal(false);
    setAssessmentAnswers({});
  };

  const handleSignatureConfirm = async (dataUrl: string) => {
    if (!id || !signatureContext) return;
    const newSig = await mockApi.createSignature({
      patientId: id,
      signerId: 'u1',
      signerName: '当前用户',
      signerRole: 'doctor',
      resourceType: signatureContext.resourceType,
      resourceId: signatureContext.resourceId,
      signatureData: dataUrl,
    });
    setSignatures((prev) => [newSig, ...prev]);
    setShowSignatureModal(false);
    setSignatureContext(null);
  };

  const handleDiagnosisSign = (diagnosisId: string) => {
    setSignatureContext({ resourceType: 'diagnosis', resourceId: diagnosisId });
    setShowSignatureModal(true);
  };

  const handleNewDiagnosisSign = () => {
    setSignatureContext({ resourceType: 'diagnosis', resourceId: 'new' });
    setShowSignatureModal(true);
  };

  const handleBasicInfoSign = () => {
    setSignatureContext({ resourceType: 'patient_record', resourceId: id! });
    setShowSignatureModal(true);
  };

  if (loading || !patient) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/patients')} className="btn-ghost p-2 -ml-2">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
              {patient.name}
              {riskCfg && <span className={`badge text-xs ${riskCfg.className}`}>{riskCfg.label}</span>}
            </h1>
            <p className="mt-1 text-sm text-gray-500 flex items-center gap-3">
              <span>ID: {patient.id}</span>
              <span>{patient.gender === 'male' ? '男' : '女'} / {age}岁</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {patient.station?.name}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary">
            <Edit3 className="w-4 h-4 mr-1.5" />
            编辑档案
          </button>
          <button className="btn-secondary">
            <Download className="w-4 h-4 mr-1.5" />
            导出PDF
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
                patient.riskLevel === 'high'
                  ? 'bg-danger-100 text-danger-700'
                  : patient.riskLevel === 'medium'
                  ? 'bg-warning-100 text-warning-700'
                  : 'bg-primary-100 text-primary-700'
              }`}
            >
              {patient.name[0]}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
              <div>
                <div className="text-xs text-gray-400">联系电话</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-gray-700">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {patient.phone}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">身份证号</div>
                <div className="mt-0.5 text-gray-700">{patient.idCard}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">紧急联系人</div>
                <div className="mt-0.5 text-gray-700">
                  {patient.emergencyContact}（{patient.emergencyPhone}）
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">建档日期</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-gray-700">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {patient.createdAt}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-gray-400">家庭住址</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-gray-700">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {patient.address}
                </div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">综合风险评分</div>
            <div className="mt-1 flex items-baseline justify-end gap-1">
              <span
                className={`text-3xl font-bold ${
                  patient.riskLevel === 'high'
                    ? 'text-danger-600'
                    : patient.riskLevel === 'medium'
                    ? 'text-warning-600'
                    : 'text-green-600'
                }`}
              >
                {patient.riskScore}
              </span>
              <span className="text-sm text-gray-400">/100</span>
            </div>
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden mt-2 ml-auto">
              <div
                className={`h-full ${riskCfg?.bar}`}
                style={{ width: `${Math.min(patient.riskScore, 100)}%` }}
              />
            </div>
            {patient.riskLevel === 'high' && (
              <div className="mt-2 flex items-center justify-end gap-1 text-xs text-danger-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                需要重点关注
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-gray-100 px-4">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <div
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`tab-item flex items-center gap-1.5 ${isActive ? 'tab-item-active' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5">
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-600" />
                  基本信息
                </h4>
                <div className="space-y-3 text-sm">
                  {[
                    ['姓名', patient.name],
                    ['性别', patient.gender === 'male' ? '男' : patient.gender === 'female' ? '女' : patient.gender],
                    ['出生日期', patient.birthDate],
                    ['年龄', `${age}岁`],
                    ['身份证号', patient.idCard],
                    ['联系电话', patient.phone],
                    ['所属服务站', patient.station?.name || '-'],
                    ['家庭住址', patient.address],
                  ].map(([k, v]) => (
                    <div key={k} className="flex">
                      <div className="w-24 text-gray-400 flex-shrink-0">{k}</div>
                      <div className="text-gray-700">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning-600" />
                  病史信息
                </h4>
                <div className="space-y-3 text-sm">
                  {[
                    ['紧急联系人', `${patient.emergencyContact}（${patient.emergencyPhone}）`],
                    ['既往史', patient.medicalHistory],
                    ['过敏史', patient.allergyHistory],
                    ['风险等级', riskCfg?.label || '-'],
                    ['风险分值', patient.riskScore.toString()],
                  ].map(([k, v]) => (
                    <div key={k} className="flex">
                      <div className="w-24 text-gray-400 flex-shrink-0">{k}</div>
                      <div className="text-gray-700">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Pen className="w-4 h-4 text-primary-600" />
                    电子签名记录（{signatures.length}条）
                  </h4>
                  <LoadingButton onClick={handleBasicInfoSign} loadingText="签名中...">
                    <Pen className="w-4 h-4 mr-1.5" />
                    电子签名确认
                  </LoadingButton>
                </div>
                {signatures.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-lg">
                    <Pen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    暂无签名记录
                  </div>
                ) : (
                  <div className="space-y-2">
                    {signatures.map((sig) => (
                      <div key={sig.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <Pen className="w-4 h-4 text-primary-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-800">{sig.signerName}（{sig.signerRole}）</div>
                            <div className="text-xs text-gray-500">{sig.resourceType} · {sig.createdAt}</div>
                          </div>
                        </div>
                        <span className="badge bg-green-100 text-green-700 text-xs">已签名</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'diagnosis' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-700">
                  诊断记录（{diagnoses.length}条）
                </h4>
                <button
                  onClick={handleNewDiagnosisSign}
                  className="btn-primary text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  新增诊断
                </button>
              </div>
              {diagnoses.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Stethoscope className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  暂无诊断记录
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnoses.map((d) => (
                    <div
                      key={d.id}
                      className="p-4 border border-gray-100 rounded-lg hover:border-primary-200 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-800">{d.diagnosis}</span>
                            <span className="badge bg-primary-100 text-primary-700 text-xs">
                              {d.icdCode}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-gray-500 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-3.5 h-3.5" />
                              {d.doctorName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {d.diagnosisDate}
                            </span>
                          </div>
                          {d.notes && (
                            <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                              {d.notes}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDiagnosisSign(d.id)}
                          className="btn-secondary text-xs flex-shrink-0"
                        >
                          <Pen className="w-3.5 h-3.5 mr-1" />
                          签名确认
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'medication' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-700">
                  用药方案（{medications.length}条）
                </h4>
                <button className="btn-primary text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  新增用药
                </button>
              </div>
              {medications.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Pill className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  暂无用药记录
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-200">
                        <th className="py-3 px-3 font-medium">药品名称</th>
                        <th className="py-3 px-3 font-medium">剂量</th>
                        <th className="py-3 px-3 font-medium">频次</th>
                        <th className="py-3 px-3 font-medium">开始日期</th>
                        <th className="py-3 px-3 font-medium">用药依从性</th>
                        <th className="py-3 px-3 font-medium">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medications.map((m) => {
                        const adh = getAdherenceInfo(m.adherence);
                        return (
                          <tr key={m.id} className="table-row">
                            <td className="py-3 px-3 font-medium text-gray-800">{m.drugName}</td>
                            <td className="py-3 px-3 text-gray-700">{m.dosage}</td>
                            <td className="py-3 px-3 text-gray-700">{m.frequency}</td>
                            <td className="py-3 px-3 text-gray-600">{m.startDate}</td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      m.adherence >= 90
                                        ? 'bg-green-500'
                                        : m.adherence >= 70
                                        ? 'bg-primary-500'
                                        : m.adherence >= 50
                                        ? 'bg-warning-500'
                                        : 'bg-danger-500'
                                    }`}
                                    style={{ width: `${m.adherence}%` }}
                                  />
                                </div>
                                <span className={`font-medium text-xs ${adh.className}`}>
                                  {m.adherence}% {adh.label}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-gray-500 text-xs">{m.notes || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assessment' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-700">
                  心理测评量表（{assessments.length}份）
                </h4>
                <button
                  onClick={() => setShowAssessmentModal(true)}
                  className="btn-primary text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  新增测评
                </button>
              </div>
              {assessments.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  暂无测评记录
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assessments.map((a) => {
                    const sev = SEVERITY_CONFIG[a.severity];
                    return (
                      <div
                        key={a.id}
                        className="p-4 border border-gray-100 rounded-lg hover:border-primary-200 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{a.scaleName}</span>
                              <span className={`badge ${sev.className}`}>{sev.label}</span>
                            </div>
                            <div className="mt-2 text-xs text-gray-500 flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {a.assessedAt}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-baseline gap-0.5">
                              <span
                                className={`text-2xl font-bold ${
                                  a.severity === 'severe'
                                    ? 'text-danger-600'
                                    : a.severity === 'moderate'
                                    ? 'text-warning-600'
                                    : a.severity === 'mild'
                                    ? 'text-blue-600'
                                    : 'text-green-600'
                                }`}
                              >
                                {a.totalScore}
                              </span>
                              <span className="text-xs text-gray-400">
                                /{a.scaleCode === 'PHQ-9' ? 27 : a.scaleCode === 'GAD-7' ? 21 : '100'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">总分</div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 md:grid-cols-5 gap-2">
                          {Object.entries(a.answers).slice(0, 5).map(([q, v]) => (
                            <div key={q} className="text-center">
                              <div className="text-xs text-gray-400">{q.toUpperCase()}</div>
                              <div className="text-sm font-medium text-gray-700">{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'followup' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-700">
                  随访记录（{followups.length}条）
                </h4>
                <button className="btn-primary text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  新增随访
                </button>
              </div>
              {followups.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  暂无随访记录
                </div>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />
                  {followups.map((f) => (
                    <div key={f.id} className="relative mb-6 last:mb-0">
                      <div
                        className={`absolute -left-[18px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                          f.status === 'completed' ? 'bg-green-500' : 'bg-warning-500'
                        }`}
                      />
                      <div className="p-4 border border-gray-100 rounded-lg hover:border-primary-200 transition-colors bg-gray-50/50">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`badge ${
                                  f.status === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-warning-100 text-warning-700'
                                }`}
                              >
                                {f.status === 'completed' ? '已完成' : '待随访'}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                计划随访：{f.plannedDate}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-gray-700">{f.content}</p>
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {f.createdAt}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAssessmentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary-600" />
                心理测评录入
              </h3>
              <button
                onClick={() => {
                  setShowAssessmentModal(false);
                  setAssessmentAnswers({});
                }}
                className="btn-ghost p-1"
              >
                X
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="label">选择量表</label>
                <select
                  className="input"
                  value={selectedScale}
                  onChange={(e) => {
                    setSelectedScale(e.target.value);
                    setAssessmentAnswers({});
                  }}
                >
                  {SCALE_DEFINITIONS.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}（{s.code}）
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-4">
                {SCALE_DEFINITIONS.find((s) => s.code === selectedScale)?.questions.map((q, idx) => (
                  <div key={q.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      {idx + 1}. {q.text}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() =>
                            setAssessmentAnswers((prev) => ({ ...prev, [q.id]: opt.value }))
                          }
                          className={`px-3 py-2 text-xs rounded border transition-all ${
                            assessmentAnswers[q.id] === opt.value
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                          }`}
                        >
                          {opt.label}（{opt.value}分）
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                当前得分：
                <span className="text-lg font-bold text-primary-600 ml-1">
                  {Object.values(assessmentAnswers).reduce((s, v) => s + v, 0)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAssessmentModal(false);
                    setAssessmentAnswers({});
                  }}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitAssessment}
                  disabled={
                    Object.keys(assessmentAnswers).length !==
                    SCALE_DEFINITIONS.find((s) => s.code === selectedScale)?.questions.length
                  }
                  className="btn-primary"
                >
                  提交测评
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg animate-slide-up">
            <SignaturePad
              onConfirm={handleSignatureConfirm}
              onCancel={() => { setShowSignatureModal(false); setSignatureContext(null); }}
              title={signatureContext?.resourceType === 'diagnosis' ? '诊断记录签名确认' : '电子签名确认'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
