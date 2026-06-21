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

export interface ReferralMaterial {
  name: string;
  type: string;
  url?: string;
  uploadedAt: string;
}

export interface Referral {
  id: string;
  patientId: string;
  patientName?: string;
  fromStationId: string;
  fromStationName?: string;
  toStationId: string;
  toStationName?: string;
  fromDoctorId: string;
  fromDoctorName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  reason: string;
  materials?: ReferralMaterial[];
  files?: { name: string; size: number; url?: string }[];
  rejectReason?: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface ReferralLog {
  id: string;
  referralId: string;
  action: string;
  operatorId?: string;
  operatorName?: string;
  detail: string;
  createdAt: string;
}

export interface Signature {
  id: string;
  patientId: string;
  signerId: string;
  signerName: string;
  signerRole: string;
  resourceType: string;
  resourceId: string;
  signatureData: string;
  ipAddress?: string;
  createdAt: string;
}

export interface Schedule {
  id: string;
  doctorId: string;
  doctorName?: string;
  stationId: string;
  stationName?: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  maxPatients: number;
  scheduleType: 'regular' | 'temporary' | 'substitute';
  substituteDoctorId?: string;
  substituteDoctorName?: string;
  status: 'active' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorName?: string;
  type: 'followup' | 'medication' | 'assessment' | 'appointment';
  title: string;
  content: string;
  remindAt: string;
  status: 'pending' | 'sent' | 'cancelled';
  sentAt?: string;
  createdAt: string;
}

export interface ReportData {
  startDate: string;
  endDate: string;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalWarnings: number;
  highRiskWarnings: number;
  byDepartment: Record<string, number>;
  byStation: Record<string, number>;
}

export interface MatchRequest {
  patientId: string;
  department: string;
  preferredDate: string;
  preferredTimeRange: TimeRange | 'any';
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
  {
    code: 'SCL-90',
    name: '症状自评量表',
    questions: Array.from({ length: 90 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '头痛',
        '神经过敏，心中不踏实',
        '头脑中有不必要的想法或字句盘旋',
        '头昏或昏倒',
        '对异性的兴趣减退',
        '对旁人责备求全',
        '感到别人能控制你的思想',
        '责怪别人制造麻烦',
        '忘性大',
        '担心自己的衣饰整齐及仪态的端正',
        '容易烦恼和激动',
        '胸痛',
        '害怕空旷的场所或街道',
        '感到自己的精力下降，活动减慢',
        '想结束自己的生命',
        '听到旁人听不到的声音',
        '发抖',
        '感到大多数人都不可信任',
        '胃口不好',
        '容易哭泣',
        '同异性相处时感到害羞不自在',
        '感到受骗，陷入了别人的圈套',
        '无缘无故地突然感到害怕',
        '自己不能控制地大发脾气',
        '怕单独出门',
        '经常责怪自己',
        '腰痛',
        '感到难以完成任务',
        '感到孤独',
        '感到苦闷',
        '过分担忧',
        '对事物不感兴趣',
        '感到害怕',
        '您的感情容易受到伤害',
        '旁人能知道您的私下想法',
        '感到别人不理解您、不同情您',
        '感到人们对你不友好，不喜欢你',
        '做事必须做得很慢以保证做得正确',
        '心跳得很厉害',
        '恶心或胃部不舒服',
        '感到比不上别人',
        '肌肉酸痛',
        '感到有人在监视你、谈论你',
        '入睡困难',
        '做事必须反复检查',
        '难以做出决定',
        '怕乘电车、公共汽车、地铁或火车',
        '呼吸有困难',
        '一阵阵发冷或发热',
        '因为感到害怕而避开某些东西、场合或活动',
        '脑子变空了',
        '身体发麻或刺痛',
        '喉咙有梗塞感',
        '感到前途没有希望',
        '不能集中注意力',
        '感到身体的某一部分软弱无力',
        '感到紧张或容易紧张',
        '感到手或脚发重',
        '想到死亡的事',
        '吃得太多',
        '当别人看着你或谈论你时感到不自在',
        '有一些不属于你自己的想法',
        '有想打人或伤害他人的冲动',
        '醒得太早',
        '必须反复洗手、点数目或触摸某些东西',
        '睡得不稳不深',
        '有想摔坏或破坏东西的想法',
        '有一些别人没有的想法或念头',
        '感到对别人神经过敏',
        '在商店或电影院等人多的地方感到不自在',
        '感到任何事情都很困难',
        '一阵阵恐惧或惊恐',
        '感到在公共场合吃东西很不舒服',
        '经常与人争论',
        '单独一人时神经很紧张',
        '别人对你的成绩没有做出恰当的评价',
        '即使和别人在一起也感到孤单',
        '感到坐立不安心神不定',
        '感到自己没有什么价值',
        '感到熟悉的东西变得陌生或不像是真的',
        '大叫或摔东西',
        '害怕会在公共场合昏倒',
        '感到别人想占你的便宜',
        '为一些有关性的想法而很苦恼',
        '您认为应该因为自己的过错而受到惩罚',
        '感到要赶快把事情做完',
        '感到自己的身体有严重问题',
        '从未感到和其他人很亲近',
        '感到自己有罪',
        '感到自己的脑子有毛病',
      ][i],
      options: [
        { value: 0, label: '没有' },
        { value: 1, label: '很轻' },
        { value: 2, label: '中等' },
        { value: 3, label: '偏重' },
        { value: 4, label: '严重' },
      ],
    })),
  },
  {
    code: 'SDS',
    name: '抑郁自评量表',
    questions: Array.from({ length: 20 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '我觉得闷闷不乐，情绪低沉',
        '我觉得一天中早晨最好',
        '我一阵阵哭出来或觉得想哭',
        '我晚上睡眠不好',
        '我吃得跟平常一样多',
        '我与异性密切接触时和以往一样感到愉快',
        '我发觉我的体重在下降',
        '我有便秘的苦恼',
        '我心跳比平常快',
        '我无缘无故地感到疲乏',
        '我的头脑跟平常一样清楚',
        '我觉得经常做的事情并没有困难',
        '我觉得不安而平静不下来',
        '我对将来抱有希望',
        '我比平常容易生气激动',
        '我觉得做出决定是容易的',
        '我觉得自己是个有用的人，有人需要我',
        '我的生活过得很有意思',
        '我认为如果我死了别人会生活得好些',
        '平常感兴趣的事我仍然感兴趣',
      ][i],
      options: [
        { value: 1, label: '没有或很少时间' },
        { value: 2, label: '少部分时间' },
        { value: 3, label: '相当多时间' },
        { value: 4, label: '绝大部分时间' },
      ],
    })),
  },
  {
    code: 'SAS',
    name: '焦虑自评量表',
    questions: Array.from({ length: 20 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '我觉得比平常容易紧张和着急',
        '我无缘无故地感到害怕',
        '我容易心里烦乱或觉得惊恐',
        '我觉得我可能将要发疯',
        '我觉得一切都很好，也不会发生什么不幸',
        '我手脚发抖打颤',
        '我因为头痛、颈痛和背痛而苦恼',
        '我感觉容易衰弱和疲乏',
        '我觉得心平气和，并且容易安静坐着',
        '我觉得心跳得很快',
        '我因为一阵阵头晕而苦恼',
        '我有晕倒发作，或觉得要晕倒似的',
        '我吸气呼气都感到很容易',
        '我的手脚麻木和刺痛',
        '我因为胃痛和消化不良而苦恼',
        '我常常要小便',
        '我的手常常是干燥温暖的',
        '我脸红发热',
        '我容易入睡并且一夜睡得很好',
        '我做恶梦',
      ][i],
      options: [
        { value: 1, label: '没有或很少时间' },
        { value: 2, label: '少部分时间' },
        { value: 3, label: '相当多时间' },
        { value: 4, label: '绝大部分时间' },
      ],
    })),
  },
  {
    code: 'HAMA',
    name: '汉密顿焦虑量表',
    questions: Array.from({ length: 14 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '焦虑心境',
        '紧张',
        '害怕',
        '失眠',
        '记忆或注意障碍',
        '抑郁心境',
        '躯体性焦虑：肌肉系统症状',
        '躯体性焦虑：感觉系统症状',
        '心血管系统症状',
        '呼吸系统症状',
        '胃肠道症状',
        '生殖泌尿系统症状',
        '植物神经系统症状',
        '会谈时行为表现',
      ][i],
      options: [
        { value: 0, label: '无症状' },
        { value: 1, label: '轻微' },
        { value: 2, label: '中等' },
        { value: 3, label: '较重' },
        { value: 4, label: '严重' },
      ],
    })),
  },
  {
    code: 'HAMD',
    name: '汉密顿抑郁量表',
    questions: Array.from({ length: 17 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '抑郁情绪',
        '罪恶感',
        '自杀',
        '入睡困难',
        '睡眠不深',
        '早醒',
        '工作和兴趣',
        '迟缓',
        '激越',
        '精神性焦虑',
        '躯体性焦虑',
        '胃肠道症状',
        '全身症状',
        '性症状',
        '疑病',
        '体重减轻',
        '自知力',
      ][i],
      options: [
        { value: 0, label: '无症状' },
        { value: 1, label: '轻微' },
        { value: 2, label: '中等' },
        { value: 3, label: '较重' },
        { value: 4, label: '严重' },
      ],
    })),
  },
  {
    code: 'MMPI',
    name: '明尼苏达多项人格调查表',
    questions: Array.from({ length: 20 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '我喜欢阅读机械方面的杂志',
        '我的胃口很好',
        '我早上起来觉得疲倦',
        '我常常觉得人生是有价值的',
        '我很少做噩梦',
        '有时我也会说谎',
        '我相信自己比别人更有优势',
        '我从不因自己的外貌而烦恼',
        '我很少担心自己的健康',
        '有时我真想骂人',
        '我很少感到沮丧',
        '我对自己所做的每件事都感到满意',
        '有时我觉得自己毫无用处',
        '我不喜欢与陌生人交谈',
        '我经常感到心跳加快',
        '我有时会担心一些无关紧要的事情',
        '我相信有人正在试图伤害我',
        '我常常感到身体某部位疼痛',
        '我喜欢外出社交',
        '我有时会听到别人听不到的声音',
      ][i],
      options: [
        { value: 0, label: '否' },
        { value: 1, label: '是' },
      ],
    })),
  },
  {
    code: 'WAIS',
    name: '韦氏成人智力量表',
    questions: Array.from({ length: 15 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '词汇理解：解释"美丽"的含义',
        '词汇理解：解释"冬季"的含义',
        '相似性：苹果和香蕉有什么相似之处',
        '相似性：桌子和椅子有什么相似之处',
        '算术：如果3个苹果5元，6个苹果多少钱',
        '算术：一个数的3倍是27，这个数是多少',
        '数字广度：记住并复述数字序列',
        '数字广度：倒序复述数字序列',
        '图形拼凑：将碎片拼成完整图形',
        '图形拼凑：识别缺失的图形部分',
        '图片排列：按逻辑顺序排列图片',
        '图片排列：理解图片中的因果关系',
        '填图：识别图片中缺失的部分',
        '填图：指出不合理之处',
        '译码：按规则填写符号',
      ][i],
      options: [
        { value: 0, label: '完全错误' },
        { value: 1, label: '部分正确' },
        { value: 2, label: '基本正确' },
        { value: 3, label: '完全正确' },
      ],
    })),
  },
  {
    code: 'BPRS',
    name: '简明精神病评定量表',
    questions: Array.from({ length: 18 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '关心身体健康',
        '焦虑',
        '情感交流障碍',
        '概念紊乱',
        '罪恶观念',
        '紧张',
        '装相作态',
        '夸大',
        '抑郁心境',
        '敌对性',
        '猜疑',
        '幻觉',
        '运动迟滞',
        '不合作',
        '异常思维内容',
        '情感平淡',
        '兴奋',
        '定向障碍',
      ][i],
      options: [
        { value: 1, label: '无症状' },
        { value: 2, label: '可疑' },
        { value: 3, label: '轻度' },
        { value: 4, label: '中度' },
        { value: 5, label: '偏重' },
        { value: 6, label: '重度' },
        { value: 7, label: '极重' },
      ],
    })),
  },
  {
    code: 'PANSS',
    name: '阳性与阴性症状量表',
    questions: Array.from({ length: 30 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '偏执',
        '概念紊乱',
        '幻觉行为',
        '兴奋',
        '夸大',
        '猜疑或被害',
        '敌对性',
        '情感平淡',
        '情绪退缩',
        '情感交流不良',
        '被动或淡漠社交退缩',
        '抽象思维困难',
        '交谈缺乏自发性和流畅性',
        '刻板思维',
        '关注身体健康',
        '焦虑',
        '罪恶感',
        '紧张',
        '装相作态',
        '抑郁',
        '运动迟滞',
        '不合作',
        '异常思维内容',
        '定向障碍',
        '注意障碍',
        '缺乏判断力和自知力',
        '意志障碍',
        '冲动控制障碍',
        '先占观念',
        '主动回避社交',
      ][i],
      options: [
        { value: 1, label: '无' },
        { value: 2, label: '很轻' },
        { value: 3, label: '轻度' },
        { value: 4, label: '中度' },
        { value: 5, label: '偏重' },
        { value: 6, label: '重度' },
        { value: 7, label: '极重' },
      ],
    })),
  },
  {
    code: 'CGI',
    name: '临床总体印象量表',
    questions: Array.from({ length: 3 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '病情严重程度',
        '总体改善',
        '疗效指数',
      ][i],
      options: [
        { value: 1, label: '正常' },
        { value: 2, label: '边缘' },
        { value: 3, label: '轻度' },
        { value: 4, label: '中度' },
        { value: 5, label: '偏重' },
        { value: 6, label: '重度' },
        { value: 7, label: '极重' },
      ],
    })),
  },
  {
    code: 'GAF',
    name: '总体功能评估量表',
    questions: [
      {
        id: 'q1',
        text: '评估患者的整体心理、社会和职业功能水平',
        options: [
          { value: 100, label: '91-100：在各方面功能均表现优异' },
          { value: 90, label: '81-90：功能良好，日常问题处理自如' },
          { value: 80, label: '71-80：轻微功能损害' },
          { value: 70, label: '61-70：轻度功能损害' },
          { value: 60, label: '51-60：中度功能损害' },
          { value: 50, label: '41-50：严重功能损害' },
          { value: 40, label: '31-40：功能严重受损' },
          { value: 30, label: '21-30：行为明显受损或不能自理' },
          { value: 20, label: '11-20：有自伤或伤人危险' },
          { value: 10, label: '1-10：持续存在严重自伤或伤人危险' },
        ],
      },
    ],
  },
  {
    code: 'WHOQOL',
    name: '世界卫生组织生活质量量表',
    questions: Array.from({ length: 26 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '您如何评价您的生活质量',
        '您对您的健康状况满意吗',
        '您觉得疼痛妨碍您做需要做的事吗',
        '您需要依靠药物来维持日常生活吗',
        '您觉得生活有乐趣吗',
        '您觉得生活有意义吗',
        '您能集中注意力吗',
        '日常生活中您感觉安全吗',
        '您的生活环境对健康有利吗',
        '您有足够的精力应付日常生活吗',
        '您能接受自己的身体外貌吗',
        '您有足够的钱满足需要吗',
        '日常生活中您需要的信息都能得到吗',
        '您有机会参加休闲活动吗',
        '您行动的能力如何',
        '您对自己的睡眠满意吗',
        '您对自己做日常生活事情的能力满意吗',
        '您对自己的工作能力满意吗',
        '您对自己满意吗',
        '您对自己的人际关系满意吗',
        '您对自己的性生活满意吗',
        '您对自己从朋友那里得到的支持满意吗',
        '您对自己居住地的条件满意吗',
        '您对能否得到所需要的医疗保健满意吗',
        '您对自己的交通情况满意吗',
        '您与家人相处的关系满意吗',
      ][i],
      options: [
        { value: 1, label: '很不满意' },
        { value: 2, label: '不满意' },
        { value: 3, label: '一般' },
        { value: 4, label: '满意' },
        { value: 5, label: '很满意' },
      ],
    })),
  },
  {
    code: 'SF-36',
    name: '健康调查简表',
    questions: Array.from({ length: 36 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '总体来说，您的健康状况是',
        '与一年前相比，您现在的健康状况如何',
        '您的健康状况是否限制了重体力活动',
        '您的健康状况是否限制了适度活动',
        '您的健康状况是否限制了提起或搬运日用品',
        '您的健康状况是否限制了上几层楼梯',
        '您的健康状况是否限制了上一层楼梯',
        '您的健康状况是否限制了弯腰、屈膝或下蹲',
        '您的健康状况是否限制了步行一公里以上',
        '您的健康状况是否限制了步行半公里',
        '您的健康状况是否限制了步行一百米',
        '您的健康状况是否限制了自己洗澡或穿衣',
        '因身体健康原因减少了工作或活动的时间',
        '因身体健康原因完成的工作比想要做的少',
        '因身体健康原因工作或活动的种类受到限制',
        '因身体健康原因做工作或其他活动有困难',
        '因情绪原因减少了工作或活动的时间',
        '因情绪原因完成的工作比想要做的少',
        '因情绪原因做工作或其他活动不够认真',
        '身体健康或情绪问题对社交活动的影响程度',
        '过去四周您的身体疼痛有多严重',
        '疼痛在多大程度上妨碍您的日常工作或家务',
        '过去四周您觉得生活充实吗',
        '过去四周您觉得很不紧张吗',
        '过去四周您是否感到情绪低落',
        '过去四周您觉得平静安宁吗',
        '过去四周您觉得精力充沛吗',
        '过去四周您觉得闷闷不乐和抑郁吗',
        '过去四周您觉得累得筋疲力尽吗',
        '过去四周您觉得快乐吗',
        '过去四周您觉得疲惫吗',
        '身体健康或情绪问题妨碍社交活动的程度',
        '我好像比别人容易生病',
        '我跟别人一样健康',
        '我认为我的健康状况在变差',
        '我的健康状况非常好',
      ][i],
      options: [
        { value: 1, label: '极差' },
        { value: 2, label: '差' },
        { value: 3, label: '一般' },
        { value: 4, label: '好' },
        { value: 5, label: '极好' },
      ],
    })),
  },
  {
    code: 'PSQI',
    name: '匹兹堡睡眠质量指数',
    questions: Array.from({ length: 19 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '近一个月您通常晚上几点上床睡觉',
        '近一个月您通常需要多长时间才能入睡',
        '近一个月您通常早上几点起床',
        '近一个月您每晚实际睡眠时间有多长',
        '近一个月您因入睡困难而烦恼吗',
        '近一个月您夜间易醒或早醒吗',
        '近一个月您夜间需要起床如厕吗',
        '近一个月您感觉呼吸不畅吗',
        '近一个月您咳嗽或打鼾高声吗',
        '近一个月您感觉太冷或太热吗',
        '近一个月您做恶梦吗',
        '近一个月您因疼痛而影响睡眠吗',
        '近一个月您总体睡眠质量如何',
        '近一个月您是否需要服用药物助眠',
        '近一个月您常感到困倦吗',
        '近一个月您做事缺乏热情吗',
        '近一个月您是否因困倦影响工作或日常活动',
        '近一个月您开车、吃饭或参加社交活动时难以保持清醒吗',
        '近一个月您是否有因睡眠问题导致的情绪低落',
      ][i],
      options: [
        { value: 0, label: '无困难' },
        { value: 1, label: '有轻微困难' },
        { value: 2, label: '有较大困难' },
        { value: 3, label: '非常大困难' },
      ],
    })),
  },
  {
    code: 'IES-R',
    name: '事件影响量表-修订版',
    questions: Array.from({ length: 22 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '关于过去的想法不请自来',
        '关于过去的想法使我难以入睡',
        '我觉得那件事好像没有发生过',
        '我尽量不去谈论那件事',
        '关于那件事的画面会突然出现在脑海中',
        '我尽量不去想那件事',
        '我觉得那件事好像发生在别人身上',
        '我试图忘记那件事',
        '一些事物让我想起那件事',
        '我对那件事感到害怕',
        '我试图把那件事从记忆中删除',
        '关于那件事的念头干扰了我的注意力',
        '我意识到自己仍然有很多关于那件事的情绪',
        '我的感觉对那件事好像变得麻木了',
        '我发现我的行为或感觉好像又回到了那件事发生的时候',
        '我难以集中注意力因为那件事的画面会突然出现',
        '我提醒自己不要去处理那件事',
        '我觉得那件事好像不真实',
        '当被提醒那件事时我的情绪变化很大',
        '我对那件事的身体反应有发抖、出汗、心跳加快等',
        '我梦到那件事',
        '我尽量不让那件事的情绪流露出来',
      ][i],
      options: [
        { value: 0, label: '没有' },
        { value: 1, label: '很少' },
        { value: 2, label: '有时' },
        { value: 3, label: '常常' },
        { value: 4, label: '总是' },
      ],
    })),
  },
  {
    code: 'SSRS',
    name: '社会支持评定量表',
    questions: Array.from({ length: 10 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '您有多少关系密切可得到支持的朋友',
        '近一年来您与邻居交流情况如何',
        '遇到急难情况时您受到的经济支持如何',
        '遇到急难情况时您得到的安慰和关心如何',
        '遇到困难时您从家庭成员得到的支持和照顾如何',
        '您与同事之间的关系如何',
        '您在遇到困难时能否得到配偶或家人的帮助',
        '您在遇到困难时能否得到朋友的支持',
        '您在遇到困难时能否得到单位或组织的帮助',
        '您在遇到困难时能否得到亲戚的帮助',
      ][i],
      options: [
        { value: 1, label: '无支持' },
        { value: 2, label: '偶尔支持' },
        { value: 3, label: '一般支持' },
        { value: 4, label: '全力支持' },
      ],
    })),
  },
  {
    code: 'C-SSRS',
    name: '哥伦比亚自杀严重程度评定量表',
    questions: Array.from({ length: 6 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '您是否希望死去或不再活着',
        '您是否有过非特定的自杀念头',
        '您是否有过主动的自杀想法但没有具体方法',
        '您是否有过带有方法但无意实施的自杀想法',
        '您是否有过带有一定意图的自杀想法',
        '您是否有过带有具体计划的自杀想法',
      ][i],
      options: [
        { value: 0, label: '否' },
        { value: 1, label: '是' },
      ],
    })),
  },
  {
    code: 'WAI',
    name: '工作同盟量表',
    questions: Array.from({ length: 12 }, (_, i) => ({
      id: `q${i + 1}`,
      text: [
        '我和治疗师之间相互尊重',
        '我和治疗师对治疗目标有共识',
        '我和治疗师对治疗任务有共识',
        '我信任治疗师的能力',
        '我觉得治疗师理解我',
        '我和治疗师能坦诚交流',
        '我对治疗关系感到满意',
        '我觉得治疗师关心我',
        '我和治疗师在治疗中配合默契',
        '治疗师帮助我更好地了解自己',
        '我相信治疗对我有帮助',
        '我愿意在治疗中投入努力',
      ][i],
      options: [
        { value: 1, label: '从不' },
        { value: 2, label: '很少' },
        { value: 3, label: '偶尔' },
        { value: 4, label: '有时' },
        { value: 5, label: '经常' },
        { value: 6, label: '频繁' },
        { value: 7, label: '总是' },
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
