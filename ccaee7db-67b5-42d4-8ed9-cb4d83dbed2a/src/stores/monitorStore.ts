import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  ChannelData,
  StationData,
  AlarmItem,
  MonitorLayoutType,
  SignalStatus,
  AlarmType,
  AlarmLevel,
} from '@/types';

// 实时监控Store状态接口
export interface MonitorState {
  channels: Record<string, ChannelData>;
  stations: Record<string, StationData>;
  alarms: AlarmItem[];
  layout: MonitorLayoutType;
  selectedChannelId: string | null;
  channelOrder: string[];
  summary: {
    totalStations: number;
    onlineStations: number;
    totalChannels: number;
    currentAlarms: number;
    todayAlarms: number;
    avgSignalScore: number;
  };
  alarmMuted: boolean;
  websocketConnected: boolean;
}

// 实时监控Store操作接口
export interface MonitorActions {
  setLayout: (layout: MonitorLayoutType) => void;
  toggleAlarmMuted: () => void;
  setSelectedChannel: (id: string | null) => void;
  updateChannel: (id: string, data: Partial<ChannelData>) => void;
  batchUpdateChannels: (updates: Array<{ id: string; data: Partial<ChannelData> }>) => void;
  updateStation: (id: string, data: Partial<StationData>) => void;
  addAlarm: (alarm: AlarmItem) => void;
  acknowledgeAlarm: (id: string) => void;
  acknowledgeAllAlarms: () => void;
  removeAlarm: (id: string) => void;
  clearOldAlarms: () => void;
  setWebsocketConnected: (connected: boolean) => void;
  reorderChannels: (fromIndex: number, toIndex: number) => void;
  initializeMockData: () => void;
}

type MonitorStore = MonitorState & MonitorActions;

// 告警列表最大容量
const MAX_ALARMS = 1000;

// 告警合并时间窗口（5分钟，单位毫秒）
const ALARM_MERGE_WINDOW = 5 * 60 * 1000;

// 重新计算汇总统计数据
function recalculateSummary(
  channels: Record<string, ChannelData>,
  stations: Record<string, StationData>,
  alarms: AlarmItem[],
): MonitorState['summary'] {
  const channelList = Object.values(channels);
  const stationList = Object.values(stations);
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const totalStations = stationList.length;
  const onlineStations = stationList.filter((s) => s.online).length;
  const totalChannels = channelList.length;
  const currentAlarms = alarms.filter((a) => !a.ack).length;
  const todayAlarms = alarms.filter((a) => a.timestamp >= todayStart.getTime()).length;
  const avgSignalScore =
    channelList.length > 0
      ? Math.round(channelList.reduce((sum, c) => sum + c.signalScore, 0) / channelList.length)
      : 0;

  return {
    totalStations,
    onlineStations,
    totalChannels,
    currentAlarms,
    todayAlarms,
    avgSignalScore,
  };
}

export const useMonitorStore = create<MonitorStore>()(
  immer((set, get) => ({
    // ===== 状态初始值 =====
    channels: {},
    stations: {},
    alarms: [],
    layout: '3x3',
    selectedChannelId: null,
    channelOrder: [],
    summary: {
      totalStations: 0,
      onlineStations: 0,
      totalChannels: 0,
      currentAlarms: 0,
      todayAlarms: 0,
      avgSignalScore: 0,
    },
    alarmMuted: false,
    websocketConnected: false,

    // ===== 操作方法 =====

    // 设置监控墙布局
    setLayout: (layout) => {
      set((state) => {
        state.layout = layout;
      });
    },

    // 切换告警音效静音状态
    toggleAlarmMuted: () => {
      set((state) => {
        state.alarmMuted = !state.alarmMuted;
      });
    },

    // 设置当前选中放大的频道
    setSelectedChannel: (id) => {
      set((state) => {
        state.selectedChannelId = id;
      });
    },

    // 更新单个频道数据
    updateChannel: (id, data) => {
      set((state) => {
        if (state.channels[id]) {
          state.channels[id] = { ...state.channels[id], ...data };
          state.summary = recalculateSummary(state.channels, state.stations, state.alarms);
        }
      });
    },

    // 批量更新多个频道数据
    batchUpdateChannels: (updates) => {
      set((state) => {
        for (const { id, data } of updates) {
          if (state.channels[id]) {
            state.channels[id] = { ...state.channels[id], ...data };
          }
        }
        state.summary = recalculateSummary(state.channels, state.stations, state.alarms);
      });
    },

    // 更新单个机房数据
    updateStation: (id, data) => {
      set((state) => {
        if (state.stations[id]) {
          state.stations[id] = { ...state.stations[id], ...data };
          state.summary = recalculateSummary(state.channels, state.stations, state.alarms);
        }
      });
    },

    // 添加告警（5分钟内相同告警自动合并：同station+channel+type）
    addAlarm: (alarm) => {
      set((state) => {
        const now = Date.now();
        // 查找可合并的告警：同机房+同频道+同类型，且在5分钟窗口内
        const mergeIndex = state.alarms.findIndex(
          (a) =>
            a.stationId === alarm.stationId &&
            a.channelId === alarm.channelId &&
            a.type === alarm.type &&
            now - a.timestamp < ALARM_MERGE_WINDOW,
        );

        if (mergeIndex >= 0) {
          // 合并现有告警：次数+1，更新时间戳
          state.alarms[mergeIndex].count += 1;
          state.alarms[mergeIndex].timestamp = now;
        } else {
          // 新增告警，插入到列表头部
          state.alarms.unshift(alarm);
          // 超出最大容量时移除最旧的告警
          if (state.alarms.length > MAX_ALARMS) {
            state.alarms.pop();
          }
        }

        // 更新机房的告警计数
        if (state.stations[alarm.stationId]) {
          state.stations[alarm.stationId].alarmCount = state.alarms.filter(
            (a) => a.stationId === alarm.stationId && !a.ack,
          ).length;
        }

        state.summary = recalculateSummary(state.channels, state.stations, state.alarms);
      });
    },

    // 确认单条告警
    acknowledgeAlarm: (id) => {
      set((state) => {
        const alarm = state.alarms.find((a) => a.id === id);
        if (alarm) {
          alarm.ack = true;
          // 更新对应机房的告警计数
          if (state.stations[alarm.stationId]) {
            state.stations[alarm.stationId].alarmCount = state.alarms.filter(
              (a) => a.stationId === alarm.stationId && !a.ack,
            ).length;
          }
          state.summary = recalculateSummary(state.channels, state.stations, state.alarms);
        }
      });
    },

    // 确认所有告警
    acknowledgeAllAlarms: () => {
      set((state) => {
        for (const alarm of state.alarms) {
          alarm.ack = true;
        }
        // 清零所有机房的告警计数
        for (const stationId of Object.keys(state.stations)) {
          state.stations[stationId].alarmCount = 0;
        }
        state.summary = recalculateSummary(state.channels, state.stations, state.alarms);
      });
    },

    // 移除单条告警
    removeAlarm: (id) => {
      set((state) => {
        const index = state.alarms.findIndex((a) => a.id === id);
        if (index >= 0) {
          const removed = state.alarms[index];
          state.alarms.splice(index, 1);
          // 更新对应机房的告警计数
          if (state.stations[removed.stationId]) {
            state.stations[removed.stationId].alarmCount = state.alarms.filter(
              (a) => a.stationId === removed.stationId && !a.ack,
            ).length;
          }
          state.summary = recalculateSummary(state.channels, state.stations, state.alarms);
        }
      });
    },

    // 清理超过24小时的已确认告警
    clearOldAlarms: () => {
      set((state) => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        state.alarms = state.alarms.filter((a) => !(a.ack && a.timestamp < cutoff));
        state.summary = recalculateSummary(state.channels, state.stations, state.alarms);
      });
    },

    // 设置WebSocket连接状态
    setWebsocketConnected: (connected) => {
      set((state) => {
        state.websocketConnected = connected;
      });
    },

    // 调整频道排序（拖拽排序后更新channelOrder）
    reorderChannels: (fromIndex, toIndex) => {
      set((state) => {
        if (
          fromIndex < 0 ||
          fromIndex >= state.channelOrder.length ||
          toIndex < 0 ||
          toIndex >= state.channelOrder.length
        ) {
          return;
        }
        const [moved] = state.channelOrder.splice(fromIndex, 1);
        state.channelOrder.splice(toIndex, 0, moved);
      });
    },

    // 初始化省级广电场景Mock数据
    initializeMockData: () => {
      // 16个地市名称
      const cities = [
        '省会市',
        '昌都市',
        '明州市',
        '远安市',
        '临江市',
        '丰阳市',
        '永宁市',
        '康州市',
        '安平县',
        '新化县',
        '怀远市',
        '崇州市',
        '润州市',
        '靖江市',
        '仪征市',
        '高邮市',
      ];

      // 机房类型后缀
      const stationSuffixes = [
        '中心机房',
        '传输机房',
        '分发机房',
        '播控机房',
        '分中心机房',
        '接入机房',
        '汇聚机房',
      ];

      // 80个频道名称（省级广电典型频道配置）
      const channelNames = [
        'CCTV-1综合高清',
        'CCTV-2财经高清',
        'CCTV-3综艺高清',
        'CCTV-4中文国际高清',
        'CCTV-5体育高清',
        'CCTV-5+体育赛事高清',
        'CCTV-6电影高清',
        'CCTV-7国防军事高清',
        'CCTV-8电视剧高清',
        'CCTV-9纪录高清',
        'CCTV-10科教高清',
        'CCTV-11戏曲高清',
        'CCTV-12社会与法高清',
        'CCTV-13新闻高清',
        'CCTV-14少儿高清',
        'CCTV-15音乐高清',
        'CCTV-16奥林匹克高清',
        'CCTV-17农业农村高清',
        '省卫视频道高清',
        '省经济频道高清',
        '省都市频道高清',
        '省影视频道高清',
        '省文体频道高清',
        '省生活频道高清',
        '省少儿频道高清',
        '省公共频道高清',
        '省新闻频道高清',
        '省教育频道高清',
        '省会新闻综合高清',
        '省会生活频道高清',
        '省会都市频道高清',
        '省会影视娱乐高清',
        '昌都新闻综合高清',
        '昌都生活服务高清',
        '明州新闻综合高清',
        '明州文化影视频道',
        '远安新闻综合高清',
        '远安公共频道高清',
        '临江新闻综合高清',
        '临江经济生活频道',
        '丰阳新闻综合高清',
        '丰阳文化旅游频道',
        '永宁新闻综合高清',
        '永宁民生频道高清',
        '康州新闻综合高清',
        '康州农业频道高清',
        '安平新闻综合高清',
        '安平生活频道高清',
        '新化新闻综合高清',
        '新化教育频道高清',
        '怀远新闻综合高清',
        '怀远公共频道高清',
        '崇州新闻综合高清',
        '崇州影视频道高清',
        '润州新闻综合高清',
        '润州生活频道高清',
        '靖江新闻综合高清',
        '靖江文化频道高清',
        '仪征新闻综合高清',
        '仪征经济频道高清',
        '高邮新闻综合高清',
        '高邮民生频道高清',
        '金鹰卡通高清',
        '卡酷少儿高清',
        '优漫卡通高清',
        '炫动卡通高清',
        '北京卫视高清',
        '东方卫视高清',
        '湖南卫视高清',
        '浙江卫视高清',
        '江苏卫视高清',
        '山东卫视高清',
        '安徽卫视高清',
        '广东卫视高清',
        '深圳卫视高清',
        '天津卫视高清',
        '重庆卫视高清',
        '四川卫视高清',
        '湖北卫视高清',
        '河南卫视高清',
        '河北卫视高清',
      ];

      // 当前节目名称池
      const programPool = [
        '新闻联播',
        '焦点访谈',
        '晚间新闻',
        '朝闻天下',
        '天气预报',
        '东方时空',
        '今日说法',
        '等着我',
        '开门大吉',
        '星光大道',
        '幸福账单',
        '黄金100秒',
        '非常6+1',
        '越战越勇',
        '向幸福出发',
        '天天饮食',
        '走遍中国',
        '探索发现',
        '百家讲坛',
        '人与自然',
      ];

      // 告警类型池
      const alarmTypes: AlarmType[] = [
        'signal_loss',
        'black_frame',
        'static_frame',
        'audio_loss',
        'bitrate_error',
        'device_offline',
      ];

      const alarmTitles: Record<AlarmType, string> = {
        signal_loss: '信号丢失告警',
        black_frame: '黑帧检测告警',
        static_frame: '静帧检测告警',
        audio_loss: '音频丢失告警',
        bitrate_error: '码率异常告警',
        device_offline: '设备离线告警',
      };

      const alarmContents: Record<AlarmType, string> = {
        signal_loss: '检测到频道信号丢失超过30秒，请检查传输链路',
        black_frame: '检测到连续黑帧超过10秒，可能存在播出故障',
        static_frame: '检测到画面静止超过60秒，可能存在播出异常',
        audio_loss: '检测到主声道音频丢失，请检查音频编码设备',
        bitrate_error: '当前码率波动超过阈值±30%，请检查编码输出',
        device_offline: '机房主设备心跳超时，设备可能已离线',
      };

      const alarmLevelsByType: Record<AlarmType, AlarmLevel> = {
        signal_loss: 'urgent',
        black_frame: 'important',
        static_frame: 'important',
        audio_loss: 'important',
        bitrate_error: 'general',
        device_offline: 'urgent',
      };

      // 生成120个机房（覆盖16地市）
      const stations: Record<string, StationData> = {};
      const stationList: StationData[] = [];
      let stationIdCounter = 1;

      for (let i = 0; i < 120; i++) {
        const cityIndex = i % cities.length;
        const city = cities[cityIndex];
        // 省会市分配更多机房（前20个机房集中在省会）
        const effectiveCity = i < 20 ? cities[0] : city;
        const suffixIndex = Math.floor(Math.random() * stationSuffixes.length);
        const suffix = stationSuffixes[suffixIndex];
        // 省会机房使用特殊命名
        const namePrefix = effectiveCity === cities[0] && i < 8 ? '省会' : effectiveCity;
        const name = `${namePrefix}${suffix}`;

        // 各地市大致经纬度（模拟）
        const baseLat = 30 + Math.random() * 10;
        const baseLng = 110 + Math.random() * 15;

        const stationId = `st${String(stationIdCounter++).padStart(4, '0')}`;
        const station: StationData = {
          id: stationId,
          name,
          city: effectiveCity,
          address: `${effectiveCity}${['高新区', '经开区', 'CBD中心', '文化区', '老城区', '新城区'][Math.floor(Math.random() * 6)]}${['广电大厦', '传媒中心', '传输大楼', '播控中心'][Math.floor(Math.random() * 4)]}${Math.floor(Math.random() * 20) + 1}层`,
          online: true,
          deviceCount: 8 + Math.floor(Math.random() * 25),
          channelCount: 0,
          alarmCount: 0,
          contact: ['张工', '李工', '王工', '赵工', '刘工', '陈工'][Math.floor(Math.random() * 6)],
          phone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
          lat: Number(baseLat.toFixed(4)),
          lng: Number(baseLng.toFixed(4)),
        };
        stations[stationId] = station;
        stationList.push(station);
      }

      // 生成80个频道，分布到各机房
      const channels: Record<string, ChannelData> = {};
      const channelOrder: string[] = [];

      for (let i = 0; i < 80; i++) {
        // 随机分配一个机房（省会机房承载更多频道）
        let stationIndex: number;
        if (i < 30) {
          // 前30个频道集中在省会前5个核心机房
          stationIndex = Math.floor(Math.random() * 5);
        } else {
          stationIndex = Math.floor(Math.random() * stationList.length);
        }
        const station = stationList[stationIndex];
        station.channelCount += 1;

        // 状态分布：80%正常、15%警告、5%异常
        const rand = Math.random();
        let signalStatus: SignalStatus;
        let signalScore: number;
        if (rand < 0.8) {
          signalStatus = 'good';
          signalScore = 85 + Math.floor(Math.random() * 16);
        } else if (rand < 0.95) {
          signalStatus = 'warning';
          signalScore = 60 + Math.floor(Math.random() * 25);
        } else {
          signalStatus = 'error';
          signalScore = Math.floor(Math.random() * 60);
        }

        const channelId = `ch${String(i + 1).padStart(4, '0')}`;
        const channel: ChannelData = {
          id: channelId,
          name: channelNames[i] || `频道${i + 1}`,
          programName: programPool[Math.floor(Math.random() * programPool.length)],
          stationId: station.id,
          stationName: station.name,
          signalStatus,
          signalScore,
          volume: [
            signalStatus === 'error' ? 0 : Math.floor(Math.random() * 60) + 20,
            signalStatus === 'error' ? 0 : Math.floor(Math.random() * 60) + 20,
          ],
          bitrate: signalStatus === 'error' ? 0 : 4 + Math.random() * 12,
          isBlackFrame: signalStatus === 'error' && Math.random() < 0.4,
          isStaticFrame: signalStatus === 'error' && Math.random() < 0.3,
          isAudioLoss: signalStatus === 'error' && Math.random() < 0.5,
          thumbnail: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(`${channelNames[i] || '电视台'} 电视节目直播画面 缩略图 专业播出`)}&image_size=square`,
        };
        channels[channelId] = channel;
        channelOrder.push(channelId);
      }

      // 生成15条左右Mock告警
      const alarms: AlarmItem[] = [];
      const now = Date.now();
      const alarmCount = 15;
      const errorChannels = Object.values(channels).filter((c) => c.signalStatus !== 'good');
      const warnChannels = Object.values(channels).filter((c) => c.signalStatus !== 'good');
      const alarmSourceChannels = errorChannels.length > 0 ? errorChannels : warnChannels;

      for (let i = 0; i < alarmCount; i++) {
        // 优先从异常/警告频道中选取，确保频道真实存在
        const srcChannel =
          alarmSourceChannels[i % alarmSourceChannels.length] ||
          Object.values(channels)[i % 80];
        const typeIndex = Math.floor(Math.random() * alarmTypes.length);
        const type = alarmTypes[typeIndex];
        const level = alarmLevelsByType[type];
        const timestamp = now - Math.floor(Math.random() * 8 * 60 * 60 * 1000); // 8小时内随机时间

        const alarm: AlarmItem = {
          id: `al${String(Date.now() + i).padStart(12, '0')}`,
          level,
          type,
          title: alarmTitles[type],
          stationId: srcChannel.stationId,
          stationName: srcChannel.stationName,
          channelId: srcChannel.id,
          channelName: srcChannel.name,
          content: alarmContents[type],
          timestamp,
          ack: Math.random() < 0.3, // 30%已确认
          count: 1 + Math.floor(Math.random() * 5),
          firstTimestamp: timestamp - Math.floor(Math.random() * 30 * 60 * 1000),
        };
        alarms.push(alarm);

        // 累加对应机房的告警计数
        if (stations[alarm.stationId] && !alarm.ack) {
          stations[alarm.stationId].alarmCount += 1;
        }
      }

      // 按时间倒序排列告警
      alarms.sort((a, b) => b.timestamp - a.timestamp);

      // 模拟少量机房离线（约5%）
      const stationIds = Object.keys(stations);
      const offlineCount = Math.floor(stationIds.length * 0.05);
      for (let i = 0; i < offlineCount; i++) {
        const offlineId = stationIds[stationIds.length - 1 - i];
        stations[offlineId].online = false;
      }

      // 写入Store
      set((state) => {
        state.stations = stations;
        state.channels = channels;
        state.channelOrder = channelOrder;
        state.alarms = alarms;
        state.summary = recalculateSummary(channels, stations, alarms);
        state.layout = '3x3';
        state.selectedChannelId = null;
        state.alarmMuted = false;
        state.websocketConnected = true;
      });
    },
  })),
);
