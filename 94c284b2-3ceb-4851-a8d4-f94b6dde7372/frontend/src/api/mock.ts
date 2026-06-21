import type {
  Appointment,
  Assessment,
  DiagnosisRecord,
  Doctor,
  Followup,
  MatchResult,
  Medication,
  OverviewStats,
  Patient,
  Station,
  Warning,
  WarningStats,
  ApptStatItem,
  WarningStatItem,
  User,
  Referral,
  ReferralLog,
  Signature,
  Schedule,
  Reminder,
  ReportData,
} from '@/types';

const uid = () => Math.random().toString(36).slice(2, 10);

const stations: Station[] = [
  { id: 's1', name: '中心院区', address: '文化路88号', lat: 34.75, lng: 113.62, createdAt: '2025-01-01' },
  { id: 's2', name: '东区服务站', address: '东风路12号', lat: 34.77, lng: 113.68, createdAt: '2025-01-01' },
  { id: 's3', name: '西区服务站', address: '建设路56号', lat: 34.74, lng: 113.55, createdAt: '2025-01-01' },
  { id: 's4', name: '南区服务站', address: '航海路99号', lat: 34.70, lng: 113.63, createdAt: '2025-01-01' },
  { id: 's5', name: '北区服务站', address: '农业路23号', lat: 34.80, lng: 113.61, createdAt: '2025-01-01' },
];

const doctors: Doctor[] = [
  { id: 'd1', stationId: 's1', name: '张建华', gender: 'male', title: '主任医师', department: 'psychiatry', languages: '中文', createdAt: '2025-01-01', station: stations[0] },
  { id: 'd2', stationId: 's1', name: '李雪梅', gender: 'female', title: '副主任医师', department: 'psychology', languages: '中文,英文', createdAt: '2025-01-01', station: stations[0] },
  { id: 'd3', stationId: 's2', name: '王志强', gender: 'male', title: '主治医师', department: 'psychiatry', languages: '中文', createdAt: '2025-01-01', station: stations[1] },
  { id: 'd4', stationId: 's3', name: '陈美玲', gender: 'female', title: '副主任医师', department: 'child', languages: '中文', createdAt: '2025-01-01', station: stations[2] },
  { id: 'd5', stationId: 's1', name: '刘建国', gender: 'male', title: '主任医师', department: 'sleep', languages: '中文', createdAt: '2025-01-01', station: stations[0] },
  { id: 'd6', stationId: 's4', name: '赵晓燕', gender: 'female', title: '心理咨询师', department: 'psychology', languages: '中文', createdAt: '2025-01-01', station: stations[3] },
];

const firstNames = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴', '徐', '孙', '马', '朱', '胡'];
const givenNames = ['明', '华', '芳', '伟', '静', '强', '敏', '磊', '丽', '军', '洋', '艳', '勇', '梅', '杰'];

const generatePatients = (n: number): Patient[] => {
  const riskLevels: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
  return Array.from({ length: n }, (_, i) => {
    const fn = firstNames[i % firstNames.length];
    const gn = givenNames[(i * 3) % givenNames.length];
    const risk = riskLevels[(i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0)];
    const score = risk === 'high' ? 65 + (i % 30) : risk === 'medium' ? 40 + (i % 20) : 10 + (i % 25);
    return {
      id: 'p' + (i + 1),
      stationId: stations[i % stations.length].id,
      station: stations[i % stations.length],
      name: fn + gn,
      gender: i % 2 === 0 ? 'male' : 'female',
      birthDate: `19${60 + (i % 40).toString().padStart(2, '0')}-${((i % 12) + 1).toString().padStart(2, '0')}-${((i % 27) + 1).toString().padStart(2, '0')}`,
      idCard: '4101' + (100000000000 + i * 137).toString().slice(0, 14),
      phone: '138' + (10000000 + i * 97).toString().slice(0, 8),
      address: `${stations[i % stations.length].address}${i + 1}号楼`,
      emergencyContact: fn + (i % 2 === 0 ? '父' : '母'),
      emergencyPhone: '139' + (20000000 + i * 53).toString().slice(0, 8),
      riskScore: score,
      riskLevel: risk,
      medicalHistory: i % 4 === 0 ? '既往抑郁发作史3次，2023年曾有自杀未遂' : i % 3 === 0 ? '高血压、糖尿病' : '无特殊既往史',
      allergyHistory: i % 7 === 0 ? '青霉素过敏' : '无',
      createdAt: `2025-0${(i % 9) + 1}-15`,
    };
  });
};

const patients = generatePatients(40);

const deptNames: Record<string, string> = {
  psychiatry: '精神科',
  psychology: '心理咨询科',
  child: '儿童青少年心理科',
  elderly: '老年精神科',
  addiction: '成瘾医学科',
  sleep: '睡眠医学科',
};

const timeSlots = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '14:00', '14:30', '15:00', '15:30', '16:00'];
const statuses: Appointment['status'][] = ['confirmed', 'completed', 'pending', 'cancelled'];

const appointments: Appointment[] = Array.from({ length: 30 }, (_, i) => {
  const d = doctors[i % doctors.length];
  const p = patients[(i * 3) % patients.length];
  const dayOffset = i % 7;
  return {
    id: 'a' + (i + 1),
    patientId: p.id,
    patient: p,
    patientName: p.name,
    doctorId: d.id,
    doctor: d,
    doctorName: d.name,
    stationId: d.stationId,
    department: d.department,
    date: new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10),
    timeSlot: timeSlots[i % timeSlots.length],
    status: statuses[i % statuses.length],
    matchScore: 70 + (i % 25),
    createdAt: '2026-06-15',
    updatedAt: '2026-06-15',
  };
});

const diagnoses: DiagnosisRecord[] = patients.slice(0, 15).map((p, i) => ({
  id: 'dg' + (i + 1),
  patientId: p.id,
  doctorId: doctors[i % doctors.length].id,
  doctorName: doctors[i % doctors.length].name,
  diagnosisDate: `2026-0${(i % 6) + 1}-${10 + i}`,
  diagnosis: ['中度抑郁发作', '广泛性焦虑障碍', '睡眠障碍', '轻度认知功能障碍', '社交恐惧症'][i % 5],
  icdCode: ['F32.1', 'F41.1', 'F51.0', 'F06.7', 'F40.1'][i % 5],
  notes: '患者主诉情绪低落、兴趣减退2月余，伴睡眠差、食欲下降。予药物治疗+心理治疗。',
  createdAt: '2026-06-10',
}));

const meds: Medication[] = patients.slice(0, 12).map((p, i) => ({
  id: 'm' + (i + 1),
  patientId: p.id,
  drugName: ['舍曲林', '艾司西酞普兰', '文拉法辛', '米氮平', '喹硫平', '奥氮平'][i % 6],
  dosage: ['50mg', '10mg', '75mg', '15mg', '200mg', '5mg'][i % 6],
  frequency: ['每日1次', '每日2次', '每晚1次', '每日3次'][i % 4],
  startDate: `2026-0${(i % 5) + 1}-01`,
  adherence: [100, 95, 85, 70, 60, 90][i % 6],
  notes: i % 3 === 0 ? '患者反馈偶有恶心，继续观察' : '',
  createdAt: '2026-06-01',
}));

const assessments: Assessment[] = patients.slice(0, 18).map((p, i) => {
  const isPhq9 = i % 2 === 0;
  const score = isPhq9 ? [5, 10, 15, 22, 8, 12, 18, 6, 14, 20][i % 10] : [4, 8, 12, 16, 6, 10, 14, 5, 9, 13][i % 10];
  const severity = score >= 15 ? 'severe' : score >= 10 ? 'moderate' : score >= 5 ? 'mild' : 'normal';
  const answers: Record<string, number> = {};
  for (let q = 1; q <= (isPhq9 ? 9 : 7); q++) answers['q' + q] = Math.min(3, Math.floor(score / (isPhq9 ? 3 : 2)));
  return {
    id: 'as' + (i + 1),
    patientId: p.id,
    scaleCode: isPhq9 ? 'PHQ-9' : 'GAD-7',
    scaleName: isPhq9 ? '患者健康问卷-9项' : '广泛性焦虑障碍量表',
    totalScore: score,
    severity,
    answers,
    assessorId: doctors[i % doctors.length].id,
    assessedAt: `2026-06-${(10 + i).toString().padStart(2, '0')}`,
    createdAt: '2026-06-10',
  };
});

const warnings: Warning[] = patients
  .filter((p) => p.riskLevel === 'high')
  .slice(0, 8)
  .map((p, i) => ({
    id: 'w' + (i + 1),
    patientId: p.id,
    patient: p,
    patientName: p.name,
    riskScore: p.riskScore,
    riskLevel: 'high',
    triggerFactors: [
      'PHQ-9量表评分≥15分',
      i % 2 === 0 ? '既往自杀史' : '用药依从性低于70%',
      i % 3 === 0 ? '超过30天未就诊' : 'GAD-7量表评分≥10分',
    ],
    status: (['pending', 'processing', 'pending', 'resolved'] as const)[i % 4],
    assigneeId: i % 2 === 0 ? doctors[i % doctors.length].id : undefined,
    assigneeName: i % 2 === 0 ? doctors[i % doctors.length].name : undefined,
    notifiedDoctors: [doctors[i % doctors.length].id],
    notifiedFamily: true,
    createdAt: new Date(Date.now() - i * 3600000 * 5).toISOString(),
  }));

const followups: Followup[] = patients.slice(0, 10).map((p, i) => ({
  id: 'f' + (i + 1),
  patientId: p.id,
  doctorId: doctors[i % doctors.length].id,
  plannedDate: new Date(Date.now() + (i + 3) * 86400000).toISOString().slice(0, 10),
  status: i % 3 === 0 ? 'completed' : 'pending',
  content: ['电话随访，情绪稳定', '门诊复诊，调整用药', '家访观察', '视频随访'][i % 4],
  createdAt: '2026-06-10',
}));

const referrals: Referral[] = patients.slice(0, 8).map((p, i) => ({
  id: 'rf' + (i + 1),
  patientId: p.id,
  patientName: p.name,
  fromStationId: stations[i % 3].id,
  fromStationName: stations[i % 3].name,
  toStationId: stations[(i + 1) % 5].id,
  toStationName: stations[(i + 1) % 5].name,
  fromDoctorId: doctors[i % doctors.length].id,
  fromDoctorName: doctors[i % doctors.length].name,
  status: (['pending', 'accepted', 'rejected', 'pending'] as const)[i % 4],
  reason: ['患者需要更专业的儿童心理评估', '转至睡眠科进行多导睡眠监测', '需上级医院会诊', '药物难治性抑郁需调整方案'][i % 4],
  materials: [
    { name: '患者病历摘要.pdf', type: 'pdf', uploadedAt: new Date(Date.now() - i * 86400000).toISOString() },
    { name: '近期检查报告.docx', type: 'doc', uploadedAt: new Date(Date.now() - i * 86400000).toISOString() },
  ],
  files: [
    { name: '心理评估报告.pdf', size: 1024 * 256 },
    { name: '用药记录.xlsx', size: 1024 * 128 },
  ],
  rejectReason: i === 2 ? '目标科室号源已满，建议转至其他站点' : undefined,
  createdAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
  acceptedAt: i === 1 ? new Date(Date.now() - i * 86400000).toISOString() : undefined,
}));

const referralLogs: ReferralLog[] = referrals.flatMap((r) => {
  const logs: ReferralLog[] = [
    {
      id: r.id + '_log1',
      referralId: r.id,
      action: 'created',
      operatorName: r.fromDoctorName,
      detail: `发起转诊申请：${r.reason}`,
      createdAt: r.createdAt,
    },
  ];
  if (r.status === 'accepted') {
    logs.push({
      id: r.id + '_log2',
      referralId: r.id,
      action: 'accepted',
      operatorName: '目标站接收人',
      detail: '目标服务站已确认接收',
      createdAt: r.acceptedAt || r.createdAt,
    });
  }
  if (r.status === 'rejected') {
    logs.push({
      id: r.id + '_log3',
      referralId: r.id,
      action: 'rejected',
      operatorName: '目标站接收人',
      detail: r.rejectReason || '转诊被拒绝',
      createdAt: r.createdAt,
    });
  }
  return logs;
});

const schedules: Schedule[] = doctors.flatMap((d, di) =>
  Array.from({ length: 5 }, (_, i) => {
    const dayOffset = i + 1;
    const date = new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10);
    const isMorning = i % 2 === 0;
    return {
      id: `sc_${di}_${i}`,
      doctorId: d.id,
      doctorName: d.name,
      stationId: d.stationId,
      stationName: d.station?.name,
      scheduleDate: date,
      startTime: isMorning ? '08:00' : '14:00',
      endTime: isMorning ? '12:00' : '17:30',
      maxPatients: 20,
      scheduleType: (i === 4 ? 'temporary' : 'regular') as 'regular' | 'temporary',
      status: 'active' as const,
      notes: i === 4 ? '临时加诊' : '',
      createdAt: '2026-06-01',
      updatedAt: '2026-06-01',
    };
  })
);

const reminders: Reminder[] = patients.slice(0, 12).map((p, i) => ({
  id: 'rm' + (i + 1),
  patientId: p.id,
  patientName: p.name,
  doctorId: doctors[i % doctors.length].id,
  doctorName: doctors[i % doctors.length].name,
  type: (['followup', 'medication', 'assessment', 'appointment'] as const)[i % 4],
  title: ['复诊提醒', '用药提醒', '量表评估提醒', '预约确认'][i % 4],
  content: [
    `患者${p.name}，您的复诊时间为${new Date(Date.now() + (i + 1) * 86400000).toLocaleDateString('zh-CN')}，请按时就诊。`,
    `请记得按时服用${['舍曲林', '艾司西酞普兰', '文拉法辛'][i % 3]}，如有不适请及时联系医生。`,
    `建议进行${['PHQ-9', 'GAD-7', 'SAS'][i % 3]}量表复查，评估当前症状变化。`,
    `您预约的${doctors[i % doctors.length].name}医生的门诊即将到来，请提前15分钟到达。`,
  ][i % 4],
  remindAt: new Date(Date.now() + (i - 4) * 3600000 * 6).toISOString(),
  status: (i < 4 ? 'sent' : 'pending') as 'sent' | 'pending',
  sentAt: i < 4 ? new Date(Date.now() - 3600000).toISOString() : undefined,
  createdAt: '2026-06-15',
}));

const signatures: Signature[] = patients.slice(0, 6).map((p, i) => ({
  id: 'sig' + (i + 1),
  patientId: p.id,
  signerId: doctors[i % doctors.length].id,
  signerName: doctors[i % doctors.length].name,
  signerRole: 'doctor',
  resourceType: (['patient_record', 'diagnosis', 'medication', 'assessment', 'followup', 'referral'] as const)[i],
  resourceId: p.id,
  signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
  ipAddress: '192.168.1.' + (100 + i),
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
}));

function delay<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export const mockApi = {
  login: async (username: string, _password: string) =>
    delay<{ token: string; user: User; expiresIn: number }>({
      token: 'mock-jwt-token',
      user: { id: 'u1', username, name: '系统管理员', role: 'admin' },
      expiresIn: 86400,
    }),

  getOverviewStats: async () =>
    delay<OverviewStats>({
      todayAppointments: appointments.filter((a) => a.date === new Date().toISOString().slice(0, 10)).length + 12,
      pendingWarnings: warnings.filter((w) => w.status !== 'resolved').length,
      totalPatients: 80000 + patients.length,
      highRiskPatients: patients.filter((p) => p.riskLevel === 'high').length + 124,
    }),

  getWarningStats: async () => {
    const pending = warnings.filter((w) => w.status === 'pending').length;
    const processing = warnings.filter((w) => w.status === 'processing').length;
    const resolved = warnings.filter((w) => w.status === 'resolved').length;
    return delay<WarningStats>({
      pending,
      processing,
      resolved,
      high: warnings.filter((w) => w.riskLevel === 'high').length,
      medium: 15,
      low: 28,
    });
  },

  listAppointments: async (params?: { status?: string; date?: string }) => {
    let data = [...appointments];
    if (params?.status) data = data.filter((a) => a.status === params.status);
    if (params?.date) data = data.filter((a) => a.date === params.date);
    return delay(data);
  },

  matchAppointments: async () =>
    delay<MatchResult[]>([
      {
        doctorId: doctors[0].id,
        doctorName: doctors[0].name,
        doctorTitle: doctors[0].title,
        department: deptNames[doctors[0].department],
        stationName: doctors[0].station!.name,
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        timeSlot: '09:30',
        matchScore: 92,
        matchReasons: ['符合期望日期', '距离较近(1.2km)', '历史就诊医生'],
        distanceKm: 1.2,
        historicalVisits: 5,
      },
      {
        doctorId: doctors[2].id,
        doctorName: doctors[2].name,
        doctorTitle: doctors[2].title,
        department: deptNames[doctors[2].department],
        stationName: doctors[2].station!.name,
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        timeSlot: '10:00',
        matchScore: 85,
        matchReasons: ['符合期望日期', '距离较近(2.8km)'],
        distanceKm: 2.8,
        historicalVisits: 0,
      },
      {
        doctorId: doctors[4].id,
        doctorName: doctors[4].name,
        doctorTitle: doctors[4].title,
        department: deptNames[doctors[4].department],
        stationName: doctors[4].station!.name,
        date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        timeSlot: '14:30',
        matchScore: 78,
        matchReasons: ['接近期望日期', '主任医师'],
        distanceKm: 3.5,
        historicalVisits: 2,
      },
    ]),

  createAppointment: async (body: Partial<Appointment>) =>
    delay<Appointment>({
      id: uid(),
      patientId: body.patientId || patients[0].id,
      patientName: body.patientName || patients[0].name,
      doctorId: body.doctorId || doctors[0].id,
      doctorName: body.doctorName || doctors[0].name,
      stationId: body.stationId || 's1',
      department: body.department || 'psychiatry',
      date: body.date || new Date().toISOString().slice(0, 10),
      timeSlot: body.timeSlot || '09:00',
      status: 'confirmed',
      matchScore: body.matchScore || 85,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),

  updateAppointmentStatus: async () => delay({ success: true }),
  cancelAppointment: async () => delay({ success: true }),

  listPatients: async (params?: { keyword?: string; riskLevel?: string }) => {
    let data = [...patients];
    if (params?.keyword) {
      const kw = params.keyword.toLowerCase();
      data = data.filter((p) => p.name.includes(kw) || p.phone.includes(kw));
    }
    if (params?.riskLevel) data = data.filter((p) => p.riskLevel === params.riskLevel);
    return delay(data);
  },

  getPatient: async (id: string) => delay(patients.find((p) => p.id === id) || patients[0]),
  getDiagnoses: async (patientId: string) =>
    delay(diagnoses.filter((d) => d.patientId === patientId)),
  getMedications: async (patientId: string) =>
    delay(meds.filter((m) => m.patientId === patientId)),
  getAssessments: async (patientId: string) =>
    delay(assessments.filter((a) => a.patientId === patientId)),
  getFollowups: async (patientId: string) =>
    delay(followups.filter((f) => f.patientId === patientId)),

  createDiagnosis: async () => delay({ success: true }),
  createMedication: async () => delay({ success: true }),
  createAssessment: async () => delay({ success: true, id: uid() }),

  listWarnings: async (params?: { status?: string; riskLevel?: string }) => {
    let data = [...warnings];
    if (params?.status) data = data.filter((w) => w.status === params.status);
    if (params?.riskLevel) data = data.filter((w) => w.riskLevel === params.riskLevel);
    return delay(data);
  },
  assignWarning: async () => delay({ success: true }),
  resolveWarning: async () => delay({ success: true }),
  notifyWarning: async () => delay({ success: true, message: '通知已发送' }),

  getApptStats: async () => {
    const data: ApptStatItem[] = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      count: 40 + Math.floor(Math.sin(i / 3) * 15) + (i % 5) * 3,
    }));
    return delay(data);
  },

  getWarningStatsTrend: async () => {
    const data: WarningStatItem[] = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      highCount: 1 + (i % 4),
      mediumCount: 3 + (i % 5),
      lowCount: 5 + (i % 6),
    }));
    return delay(data);
  },

  listStations: async () => delay(stations),
  listDoctors: async () => delay(doctors),
  deptNames,

  listReferrals: async (params?: { status?: string }) => {
    let data = [...referrals];
    if (params?.status) data = data.filter((r) => r.status === params.status);
    return delay(data);
  },
  createReferral: async (body: Partial<Referral>) =>
    delay<Referral>({
      id: uid(),
      patientId: body.patientId || patients[0].id,
      patientName: patients.find((p) => p.id === (body.patientId || patients[0].id))?.name,
      fromStationId: body.fromStationId || 's1',
      fromStationName: stations.find((s) => s.id === (body.fromStationId || 's1'))?.name,
      toStationId: body.toStationId || 's2',
      toStationName: stations.find((s) => s.id === (body.toStationId || 's2'))?.name,
      fromDoctorId: body.fromDoctorId || doctors[0].id,
      fromDoctorName: doctors.find((d) => d.id === (body.fromDoctorId || doctors[0].id))?.name,
      status: 'pending',
      reason: body.reason || '',
      materials: body.materials || [],
      files: body.files || [],
      createdAt: new Date().toISOString(),
    }),
  acceptReferral: async () => delay({ success: true }),
  rejectReferral: async (_rejectReason: string) => delay({ success: true }),
  listReferralLogs: async (referralId: string) =>
    delay<ReferralLog[]>(referralLogs.filter((l) => l.referralId === referralId)),

  listSchedules: async (params?: { doctorId?: string; date?: string }) => {
    let data = [...schedules];
    if (params?.doctorId) data = data.filter((s) => s.doctorId === params.doctorId);
    if (params?.date) data = data.filter((s) => s.scheduleDate === params.date);
    return delay(data);
  },
  createSchedule: async (body: Partial<Schedule>) =>
    delay<Schedule>({
      id: uid(),
      doctorId: body.doctorId || doctors[0].id,
      doctorName: doctors.find((d) => d.id === (body.doctorId || doctors[0].id))?.name,
      stationId: body.stationId || 's1',
      stationName: stations.find((s) => s.id === (body.stationId || 's1'))?.name,
      scheduleDate: body.scheduleDate || new Date().toISOString().slice(0, 10),
      startTime: body.startTime || '08:00',
      endTime: body.endTime || '12:00',
      maxPatients: body.maxPatients || 20,
      scheduleType: body.scheduleType || 'regular',
      status: 'active',
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  updateSchedule: async () => delay({ success: true }),
  deleteSchedule: async () => delay({ success: true }),

  listReminders: async (params?: { patientId?: string; status?: string }) => {
    let data = [...reminders];
    if (params?.patientId) data = data.filter((r) => r.patientId === params.patientId);
    if (params?.status) data = data.filter((r) => r.status === params.status);
    return delay(data);
  },
  createReminder: async (body: Partial<Reminder>) =>
    delay<Reminder>({
      id: uid(),
      patientId: body.patientId || patients[0].id,
      patientName: patients.find((p) => p.id === (body.patientId || patients[0].id))?.name,
      doctorId: body.doctorId || doctors[0].id,
      doctorName: doctors.find((d) => d.id === (body.doctorId || doctors[0].id))?.name,
      type: body.type || 'followup',
      title: body.title || '复诊提醒',
      content: body.content || '',
      remindAt: body.remindAt || new Date().toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }),

  listSignatures: async (patientId: string) =>
    delay<Signature[]>(signatures.filter((s) => s.patientId === patientId)),
  createSignature: async (body: Partial<Signature>) =>
    delay<Signature>({
      id: uid(),
      patientId: body.patientId || patients[0].id,
      signerId: 'u1',
      signerName: '系统管理员',
      signerRole: 'admin',
      resourceType: body.resourceType || 'patient_record',
      resourceId: body.resourceId || body.patientId || patients[0].id,
      signatureData: body.signatureData || '',
      createdAt: new Date().toISOString(),
    }),

  exportReport: async (startDate: string, endDate: string) =>
    delay<ReportData>({
      startDate,
      endDate,
      totalAppointments: 1055,
      completedAppointments: 972,
      cancelledAppointments: 83,
      totalWarnings: 46,
      highRiskWarnings: 12,
      byDepartment: {
        '精神科': 342,
        '心理咨询科': 268,
        '儿童青少年心理科': 156,
        '老年精神科': 124,
        '睡眠医学科': 98,
        '成瘾医学科': 67,
      },
      byStation: {
        '中心院区': 421,
        '东区服务站': 218,
        '西区服务站': 165,
        '南区服务站': 142,
        '北区服务站': 109,
      },
    }),
};
