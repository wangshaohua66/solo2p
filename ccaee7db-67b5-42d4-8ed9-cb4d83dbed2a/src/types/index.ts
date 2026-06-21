// 告警级别：三级告警类型
export type AlarmLevel = 'urgent' | 'important' | 'general';

// 告警类型：六类告警源
export type AlarmType =
  | 'signal_loss'       // 信号丢失
  | 'black_frame'       // 黑帧
  | 'static_frame'      // 静帧
  | 'audio_loss'        // 音频丢失
  | 'bitrate_error'     // 码率异常
  | 'device_offline';   // 设备离线

// 告警条目接口
export interface AlarmItem {
  id: string;                    // 告警唯一标识
  level: AlarmLevel;             // 告警级别
  type: AlarmType;               // 告警类型
  title: string;                 // 告警标题
  stationId: string;             // 所属台站ID
  stationName: string;           // 所属台站名称
  channelId: string;             // 所属频道ID
  channelName: string;           // 所属频道名称
  content: string;               // 告警详情内容
  timestamp: number;             // 告警触发时间戳
  ack: boolean;                  // 是否已确认
  count: number;                 // 告警累计次数
  firstTimestamp: number;        // 首次告警时间戳
}

// 信号状态：三色状态标识
export type SignalStatus = 'good' | 'warning' | 'error';

// 频道监控数据接口
export interface ChannelData {
  id: string;                    // 频道唯一标识
  name: string;                  // 频道名称
  programName: string;           // 当前节目名称
  stationId: string;             // 所属台站ID
  stationName: string;           // 所属台站名称
  signalStatus: SignalStatus;    // 信号状态
  signalScore: number;           // 信号质量评分（0-100）
  volume: number[];              // 音量数据数组（左右声道）
  bitrate: number;               // 当前码率（Mbps）
  isBlackFrame: boolean;         // 是否存在黑帧
  isStaticFrame: boolean;        // 是否存在静帧
  isAudioLoss: boolean;          // 是否音频丢失
  thumbnail: string;             // 频道缩略图地址
}

// 台站数据接口
export interface StationData {
  id: string;                    // 台站唯一标识
  name: string;                  // 台站名称
  city: string;                  // 所在城市
  address: string;               // 详细地址
  online: boolean;               // 是否在线
  deviceCount: number;           // 设备总数
  channelCount: number;          // 频道总数
  alarmCount: number;            // 当前告警数
  contact: string;               // 联系人
  phone: string;                 // 联系电话
  lat: number;                   // 纬度
  lng: number;                   // 经度
}

// 值班班次
export type DutyShift = 'morning' | 'afternoon' | 'night';

// 值班记录接口
export interface DutyRecord {
  id: string;                    // 记录唯一标识
  date: string;                  // 值班日期（YYYY-MM-DD）
  shift: DutyShift;              // 值班班次
  userId: string;                // 值班人员ID
  userName: string;              // 值班人员姓名
  startTime: number;             // 值班开始时间戳
  endTime: number;               // 值班结束时间戳
  status: 'ongoing' | 'completed' | 'pending'; // 值班状态
}

// 交接班记录接口
export interface HandoverRecord {
  id: string;                    // 记录唯一标识
  date: string;                  // 交接班日期
  shift: DutyShift;              // 交接班班次
  fromUserId: string;            // 交班人ID
  fromUserName: string;          // 交班人姓名
  toUserId: string;              // 接班人ID
  toUserName: string;            // 接班人姓名
  summary: string;               // 值班总结
  pendingItems: string[];        // 待办事项列表
  alarmsHandled: number;         // 处理告警数量
  signature: string;             // 签名（Base64或地址）
  createdAt: number;             // 创建时间戳
  confirmedAt: number;           // 确认时间戳
}

// 用户信息接口
export interface UserInfo {
  id: string;                    // 用户唯一标识
  name: string;                  // 用户姓名
  role: string;                  // 用户角色
  avatar: string;                // 头像地址
  phone: string;                 // 联系电话
  permissions: string[];         // 权限列表
}

// 监控画面布局类型
export type MonitorLayoutType = '1x1' | '2x2' | '3x3' | '4x4';

// 趋势指标类型
export type TrendMetric =
  | 'signal_score'       // 信号质量
  | 'bitrate'            // 码率
  | 'packet_loss'        // 丢包率
  | 'alarm_frequency';   // 告警频率

// 时间范围类型
export type TimeRange = '1h' | '6h' | '24h' | '7d' | 'custom';

// 告警分类树过滤条件
export interface FilterType {
  level?: AlarmLevel;
  type?: AlarmType;
  stationId?: string;
  channelId?: string;
  category?: 'level' | 'type' | 'station';
}
