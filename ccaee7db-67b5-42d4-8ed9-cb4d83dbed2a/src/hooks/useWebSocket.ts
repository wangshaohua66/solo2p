import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ChannelData, AlarmItem, SignalStatus } from '@/types';

// 连接状态枚举
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// Hook入参接口
interface UseWebSocketOptions {
  url?: string;                      // WebSocket服务端地址
  options?: Record<string, any>;     // socket.io-client配置项
  token?: string;                    // 身份认证Token
  enableMock?: boolean;              // 强制启用Mock模式（调试用）
}

// Hook返回值接口
interface UseWebSocketReturn {
  connected: boolean;                // 是否已连接
  connecting: boolean;               // 是否连接中
  reconnectAttempts: number;         // 当前重连尝试次数
  status: ConnectionStatus;          // 连接状态
  send: (event: string, data?: any) => boolean;  // 发送消息方法
  subscribe: <T = any>(event: string, handler: (data: T) => void) => () => void;  // 订阅事件方法
  disconnect: () => void;            // 主动断开连接
  lastPing: number | null;           // 最近一次ping/pong时间戳
}

// Mock模式下的模拟台站与频道数据池
const MOCK_STATIONS = [
  { id: 'st_001', name: '省中心机房', city: '合肥' },
  { id: 'st_002', name: '芜湖分中心', city: '芜湖' },
  { id: 'st_003', name: '蚌埠分中心', city: '蚌埠' },
  { id: 'st_004', name: '安庆分中心', city: '安庆' },
  { id: 'st_005', name: '阜阳分中心', city: '阜阳' },
  { id: 'st_006', name: '黄山分中心', city: '黄山' },
];

const MOCK_CHANNEL_NAMES = [
  'CCTV-1 综合', 'CCTV-2 财经', 'CCTV-3 综艺', 'CCTV-4 中文国际',
  'CCTV-5 体育', 'CCTV-6 电影', 'CCTV-7 国防军事', 'CCTV-8 电视剧',
  '安徽卫视', '经视频道', '综艺频道', '影视频道',
];

const MOCK_ALARM_TYPES = [
  'signal_loss', 'black_frame', 'static_frame', 'audio_loss', 'bitrate_error', 'device_offline',
] as const;

// 生成随机数工具
const rand = (min: number, max: number): number => Math.random() * (max - min) + min;
const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));

// 生成单个频道Mock更新数据
function generateMockChannelUpdate(): Partial<ChannelData> & { id: string } {
  const station = MOCK_STATIONS[randInt(0, MOCK_STATIONS.length - 1)];
  const channelIdx = randInt(0, MOCK_CHANNEL_NAMES.length - 1);
  const statusRoll = Math.random();
  const signalStatus: SignalStatus = statusRoll < 0.7 ? 'good' : statusRoll < 0.9 ? 'warning' : 'error';
  const signalScore = signalStatus === 'good'
    ? randInt(90, 100)
    : signalStatus === 'warning'
    ? randInt(70, 89)
    : randInt(40, 69);

  return {
    id: `ch_${station.id}_${channelIdx.toString().padStart(3, '0')}`,
    stationId: station.id,
    stationName: station.name,
    name: MOCK_CHANNEL_NAMES[channelIdx],
    signalStatus,
    signalScore,
    bitrate: rand(3, 6),
    volume: [rand(-40, 0), rand(-40, 0)],
    isBlackFrame: signalStatus === 'error' && Math.random() < 0.3,
    isStaticFrame: signalStatus !== 'good' && Math.random() < 0.25,
    isAudioLoss: signalStatus !== 'good' && Math.random() < 0.2,
    programName: `节目_${randInt(1, 999)}`,
    thumbnail: '',
  };
}

// 生成单条Mock告警数据
function generateMockAlarm(): AlarmItem {
  const station = MOCK_STATIONS[randInt(0, MOCK_STATIONS.length - 1)];
  const channelIdx = randInt(0, MOCK_CHANNEL_NAMES.length - 1);
  const type = MOCK_ALARM_TYPES[randInt(0, MOCK_ALARM_TYPES.length - 1)];
  const now = Date.now();
  const level =
    type === 'signal_loss' || type === 'black_frame' || type === 'device_offline'
      ? 'urgent'
      : type === 'static_frame' || type === 'bitrate_error'
      ? 'important'
      : 'general';

  const titleMap: Record<string, string> = {
    signal_loss: `【信号中断】${station.name} - ${MOCK_CHANNEL_NAMES[channelIdx]}`,
    black_frame: `【黑场告警】${station.name} - ${MOCK_CHANNEL_NAMES[channelIdx]}`,
    static_frame: `【静帧告警】${station.name} - ${MOCK_CHANNEL_NAMES[channelIdx]}`,
    audio_loss: `【音频丢失】${station.name} - ${MOCK_CHANNEL_NAMES[channelIdx]}`,
    bitrate_error: `【码率异常】${station.name} - ${MOCK_CHANNEL_NAMES[channelIdx]}`,
    device_offline: `【设备离线】${station.name} - 编码设备${randInt(1, 20)}号`,
  };

  return {
    id: `alarm_${now}_${randInt(1000, 9999)}`,
    level,
    type,
    title: titleMap[type],
    stationId: station.id,
    stationName: station.name,
    channelId: `ch_${station.id}_${channelIdx.toString().padStart(3, '0')}`,
    channelName: MOCK_CHANNEL_NAMES[channelIdx],
    content: `${station.city} ${station.name} ${MOCK_CHANNEL_NAMES[channelIdx]} 触发 ${type} 告警，请及时处理`,
    timestamp: now,
    ack: false,
    count: 1,
    firstTimestamp: now,
  };
}

export function useWebSocket(params: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { url, options = {}, token, enableMock = false } = params;

  // 连接相关状态
  const [connected, setConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastPing, setLastPing] = useState<number | null>(null);

  // 内部引用（避免闭包陷阱）
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const heartbeatTimerRef = useRef<number | null>(null);
  const pingTimeoutRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const mockChannelTimerRef = useRef<number | null>(null);
  const mockAlarmTimerRef = useRef<number | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const isMockRef = useRef<boolean>(false);

  // 心跳配置常量
  const HEARTBEAT_INTERVAL = 30 * 1000;      // 每30秒发送一次ping
  const HEARTBEAT_TIMEOUT = 60 * 1000;       // 60秒无pong判定断线
  const INITIAL_RECONNECT_DELAY = 3 * 1000;  // 初始重连间隔3秒
  const MAX_RECONNECT_DELAY = 30 * 1000;     // 最大重连间隔30秒
  const MAX_RECONNECT_ATTEMPTS = 10;         // 最多重连尝试次数

  // 环境检测：判断是否有有效后端地址
  const hasValidBackend = useCallback((): boolean => {
    if (enableMock) return false;
    if (!url) return false;
    try {
      const u = new URL(url);
      return !!u.hostname && u.protocol.startsWith('http');
    } catch {
      return false;
    }
  }, [url, enableMock]);

  // 清理所有定时器
  const clearAllTimers = useCallback((): void => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (pingTimeoutRef.current !== null) {
      window.clearTimeout(pingTimeoutRef.current);
      pingTimeoutRef.current = null;
    }
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (mockChannelTimerRef.current !== null) {
      window.clearTimeout(mockChannelTimerRef.current);
      mockChannelTimerRef.current = null;
    }
    if (mockAlarmTimerRef.current !== null) {
      window.clearTimeout(mockAlarmTimerRef.current);
      mockAlarmTimerRef.current = null;
    }
  }, []);

  // 分发事件到所有订阅者
  const emitToHandlers = useCallback(<T = any>(event: string, data: T): void => {
    const handlers = handlersRef.current.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[WebSocket] 事件处理器执行异常 event=${event}`, err);
        }
      });
    }
  }, []);

  // 启动心跳机制
  const startHeartbeat = useCallback((): void => {
    if (heartbeatTimerRef.current !== null) return;
    heartbeatTimerRef.current = window.setInterval(() => {
      if (!socketRef.current?.connected) return;
      setLastPing(Date.now());
      socketRef.current.emit('ping', { timestamp: Date.now() });
      // 超时检测：60秒内未收到pong则判定断线
      pingTimeoutRef.current = window.setTimeout(() => {
        console.warn('[WebSocket] 心跳超时，判定连接已断开');
        socketRef.current?.disconnect();
      }, HEARTBEAT_TIMEOUT);
    }, HEARTBEAT_INTERVAL);
  }, []);

  // 停止心跳机制
  const stopHeartbeat = useCallback((): void => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (pingTimeoutRef.current !== null) {
      window.clearTimeout(pingTimeoutRef.current);
      pingTimeoutRef.current = null;
    }
  }, []);

  // 计算下一次重连间隔（指数退避）
  const getReconnectDelay = useCallback((attempt: number): number => {
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, attempt - 1);
    return Math.min(delay, MAX_RECONNECT_DELAY);
  }, []);

  // 执行重连
  const doReconnect = useCallback((): void => {
    if (isMockRef.current) return;
    if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[WebSocket] 已达最大重连次数 ${MAX_RECONNECT_ATTEMPTS}，停止重连`);
      setStatus('disconnected');
      setConnecting(false);
      return;
    }
    reconnectCountRef.current += 1;
    setReconnectAttempts(reconnectCountRef.current);
    const delay = getReconnectDelay(reconnectCountRef.current);
    console.info(`[WebSocket] 第 ${reconnectCountRef.current} 次重连，间隔 ${delay / 1000}s`);
    setStatus('reconnecting');
    reconnectTimerRef.current = window.setTimeout(() => {
      createRealConnection();
    }, delay);
  }, [getReconnectDelay]);

  // 创建真实Socket连接
  const createRealConnection = useCallback((): void => {
    if (!url) return;
    setConnecting(true);
    setStatus('connecting');

    try {
      const socket = io(url, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: false,
        timeout: 10000,
        auth: token ? { token } : undefined,
        ...options,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.info('[WebSocket] 连接成功');
        setConnected(true);
        setConnecting(false);
        setStatus('connected');
        reconnectCountRef.current = 0;
        setReconnectAttempts(0);
        startHeartbeat();
        emitToHandlers('connect', socket.id);
      });

      socket.on('disconnect', (reason) => {
        console.warn(`[WebSocket] 连接断开 reason=${reason}`);
        setConnected(false);
        setStatus('disconnected');
        stopHeartbeat();
        emitToHandlers('disconnect', reason);
        if (reason === 'io client disconnect' || reason === 'io server disconnect') {
          setConnecting(false);
        } else {
          doReconnect();
        }
      });

      socket.on('connect_error', (err) => {
        console.error('[WebSocket] 连接错误', err.message);
        setConnecting(false);
        emitToHandlers('connect_error', err);
        doReconnect();
      });

      socket.on('pong', (data: any) => {
        if (pingTimeoutRef.current !== null) {
          window.clearTimeout(pingTimeoutRef.current);
          pingTimeoutRef.current = null;
        }
        const latency = Date.now() - (data?.timestamp || Date.now());
        setLastPing(Date.now());
        emitToHandlers('pong', { timestamp: Date.now(), latency });
      });

      // 业务事件透传
      socket.onAny((event, ...args) => {
        if (['connect', 'disconnect', 'connect_error', 'pong', 'ping'].includes(event)) return;
        emitToHandlers(event, args.length === 1 ? args[0] : args);
      });
    } catch (err) {
      console.error('[WebSocket] 创建连接异常', err);
      setConnecting(false);
      doReconnect();
    }
  }, [url, options, token, startHeartbeat, stopHeartbeat, emitToHandlers, doReconnect]);

  // 启动Mock模式：模拟真实WebSocket推送
  const startMockMode = useCallback((): void => {
    isMockRef.current = true;
    console.info('[WebSocket] 进入Mock模式，启动模拟数据推送');
    setConnecting(true);
    setStatus('connecting');

    // 模拟连接建立延迟
    reconnectTimerRef.current = window.setTimeout(() => {
      setConnected(true);
      setConnecting(false);
      setStatus('connected');
      reconnectCountRef.current = 0;
      setReconnectAttempts(0);
      emitToHandlers('connect', 'mock-socket-' + randInt(1000, 9999));

      // 模拟心跳
      heartbeatTimerRef.current = window.setInterval(() => {
        setLastPing(Date.now());
        emitToHandlers('pong', { timestamp: Date.now(), latency: randInt(5, 30) });
      }, HEARTBEAT_INTERVAL);

      // 频道更新推送：每1-3秒随机推送2-5条
      const scheduleChannelPush = () => {
        const interval = randInt(1000, 3000);
        mockChannelTimerRef.current = window.setTimeout(() => {
          const count = randInt(2, 5);
          const updates: Array<Partial<ChannelData> & { id: string }> = [];
          for (let i = 0; i < count; i++) {
            updates.push(generateMockChannelUpdate());
          }
          emitToHandlers('channel:update', updates);
          scheduleChannelPush();
        }, interval);
      };
      scheduleChannelPush();

      // 新告警推送：每10-30秒推送1条
      const scheduleAlarmPush = () => {
        const interval = randInt(10000, 30000);
        mockAlarmTimerRef.current = window.setTimeout(() => {
          emitToHandlers('alarm:new', generateMockAlarm());
          scheduleAlarmPush();
        }, interval);
      };
      scheduleAlarmPush();
    }, 800);
  }, [emitToHandlers]);

  // 订阅事件：返回取消订阅函数
  const subscribe = useCallback(<T = any>(event: string, handler: (data: T) => void): (() => void) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler as (data: any) => void);
    return () => {
      handlersRef.current.get(event)?.delete(handler as (data: any) => void);
      if (handlersRef.current.get(event)?.size === 0) {
        handlersRef.current.delete(event);
      }
    };
  }, []);

  // 发送消息
  const send = useCallback((event: string, data?: any): boolean => {
    if (isMockRef.current) {
      console.debug(`[WebSocket][Mock] 发送事件 ${event}`, data);
      return true;
    }
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
      return true;
    }
    console.warn(`[WebSocket] 连接未就绪，无法发送事件 ${event}`);
    return false;
  }, []);

  // 主动断开连接
  const disconnect = useCallback((): void => {
    clearAllTimers();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    isMockRef.current = false;
    handlersRef.current.clear();
    setConnected(false);
    setConnecting(false);
    setStatus('disconnected');
    setReconnectAttempts(0);
    reconnectCountRef.current = 0;
  }, [clearAllTimers]);

  // 主初始化：根据环境选择真实连接或Mock模式
  useEffect(() => {
    const valid = hasValidBackend();
    if (valid) {
      createRealConnection();
    } else {
      startMockMode();
    }
    return () => {
      disconnect();
    };
  }, [hasValidBackend, createRealConnection, startMockMode, disconnect]);

  return {
    connected,
    connecting,
    reconnectAttempts,
    status,
    send,
    subscribe,
    disconnect,
    lastPing,
  };
}

export default useWebSocket;
