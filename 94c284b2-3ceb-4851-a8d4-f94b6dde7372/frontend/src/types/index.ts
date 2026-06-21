export type RiskLevel = 'low' | 'medium' | 'high';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
export type WarningStatus = 'pending' | 'processing' | 'resolved';
export type Severity = 'normal' | 'mild' | 'moderate' | 'severe';
export type TimeRange = 'morning' | 'afternoon' | 'evening';
export type Gender = 'male' | 'female';

export interface Station {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
}

export interface Doctor {
  id: string;
  stationId: string;
  station?: Station;
  name: string;
  gender: string;
  title: string;
  department: string;
  languages: string;
  createdAt: string;
}

export interface Patient {
  id: string;
  stationId: string;
  station?: Station;
  name: string;
  gender: Gender | string;
  birthDate: string;
  idCard: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  riskScore: number;
  riskLevel: RiskLevel;
  medicalHistory: string;
  allergyHistory: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patient?: Patient;
  patientName?: string;
  doctorId: string;
  doctor?: Doctor;
  doctorName?: string;
  stationId: string;
  department: string;
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
  matchScore: number;
  matchReasons?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosisRecord {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  diagnosisDate: string;
  diagnosis: string;
  icdCode: string;
  notes: string;
  createdAt: string;
}

export interface Medication {
  id: string;
  patientId: string;
  drugName: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  adherence: number;
  notes: string;
  createdAt: string;
}

export interface Assessment {
  id: string;
  patientId: string;
  scaleCode: string;
  scaleName: string;
  totalScore: number;
  severity: Severity;
  answers: Record<string, number>;
  assessorId: string;
  assessedAt: string;
  createdAt: string;
}

export interface Warning {
  id: string;
  patientId: string;
  patient?: Patient;
  patientName?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  triggerFactors: string[];
  status: WarningStatus;
  assigneeId?: string;
  assigneeName?: string;
  notifiedDoctors: string[];
  notifiedFamily: boolean;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface Followup {
  id: string;
  patientId: string;
  doctorId: string;
  plannedDate: string;
  status: string;
  content: string;
  createdAt: string;
}

export interface Referral {
  id: string;
  patientId: string;
  fromStationId: string;
  toStationId: string;
  fromDoctorId: string;
  status: 'pending' | 'accepted' | 'rejected';
  reason: string;
  rejectReason?: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface MatchRequest {
  patientId: string;
  department: string;
  preferredDate: string;
  preferredTimeRange: TimeRange;
  doctorGender?: Gender | 'any';
  doctorTitle?: string;
  language?: string;
}

export interface MatchResult {
  doctorId: string;
  doctorName: string;
  doctorTitle: string;
  department: string;
  stationName: string;
  date: string;
  timeSlot: string;
  matchScore: number;
  matchReasons: string[];
  distanceKm?: number;
  historicalVisits: number;
}

export interface OverviewStats {
  todayAppointments: number;
  pendingWarnings: number;
  totalPatients: number;
  highRiskPatients: number;
}

export interface WarningStats {
  pending: number;
  processing: number;
  resolved: number;
  high: number;
  medium: number;
  low: number;
}

export interface ApptStatItem {
  date: string;
  count: number;
}

export interface WarningStatItem {
  date: string;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  stationId?: string;
  phone?: string;
}

export interface ScaleDefinition {
  code: string;
  name: string;
  questions: { id: string; text: string; options: { value: number; label: string }[] }[];
}

export const SCALE_DEFINITIONS: ScaleDefinition[] = [
  {
    code: 'PHQ-9',
    name: '患者健康问卷-9项',
    questions: Array.from({ length: 9 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '做事时提不起劲或没有兴趣',
        '感到心情低落、沮丧或绝望',
        '入睡困难、睡不安稳或睡眠过多',
        '感觉疲倦或没有活力',
        '食欲不振或吃太多',
        '觉得自己很糟或觉得自己很失败',
        '对事物专注有困难',
        '动作或说话速度缓慢到别人已经察觉',
        '有不如死掉或用某种方式伤害自己的念头',
      ][i],
      options: [
        { value: 0, label: '完全不会' },
        { value: 1, label: '几天' },
        { value: 2, label: '一半以上的天数' },
        { value: 3, label: '几乎每天' },
      ],
    })),
  },
  {
    code: 'GAD-7',
    name: '广泛性焦虑障碍量表',
    questions: Array.from({ length: 7 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '感到紧张、焦虑或烦躁',
        '不能停止或控制担忧',
        '对各种各样的事情担忧过多',
        '很难放松下来',
        '由于不安而无法静坐',
        '变得容易烦恼或急躁',
        '感到似乎有什么可怕的事情会发生',
      ][i],
      options: [
        { value: 0, label: '完全不会' },
        { value: 1, label: '几天' },
        { value: 2, label: '一半以上的天数' },
        { value: 3, label: '几乎每天' },
      ],
    })),
  },
];

export const DEPARTMENTS = [
  { id: 'psychiatry', name: '精神科' },
  { id: 'psychology', name: '心理咨询科' },
  { id: 'child', name: '儿童青少年心理科' },
  { id: 'elderly', name: '老年精神科' },
  { id: 'addiction', name: '成瘾医学科' },
  { id: 'sleep', name: '睡眠医学科' },
];

export const DOCTOR_TITLES = ['主任医师', '副主任医师', '主治医师', '住院医师', '心理咨询师'];
