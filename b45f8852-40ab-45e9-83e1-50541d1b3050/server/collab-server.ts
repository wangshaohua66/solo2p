import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import type { OnlineUser, CollabMessage } from '../src/types';

const PORT = Number(process.env.COLLAB_PORT) || 8787;
const MAX_CLIENTS = 20;
const PRESENCE_HEARTBEAT_MS = 30000;
const PRESENCE_BROADCAST_MS = 2000;
const INACTIVE_TIMEOUT_MS = 60000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      connectedClients: wss.clients.size,
      maxClients: MAX_CLIENTS,
      uptimeMs: Date.now() - startTime,
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientContext {
  ws: WebSocket;
  user: OnlineUser;
  roomId: string;
  joinedAt: number;
  lastActiveAt: number;
}

const MOCK_USER_COLORS = [
  '#6366F1', '#EC4899', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#14B8A6',
  '#A855F7', '#0EA5E9', '#22C55E', '#E11D48', '#0891B2',
  '#DC2626', '#2563EB', '#059669', '#D97706', '#7C3AED',
];

const MOCK_USER_NAMES = [
  { name: '李工', dept: '检修一工区', role: '检修工程师' },
  { name: '王师傅', dept: '检修一工区', role: '班组长' },
  { name: '张晓明', dept: '检修二工区', role: '检修工程师' },
  { name: '刘芳', dept: '变电运维班', role: '运维工程师' },
  { name: '陈建国', dept: '输电运维班', role: '运维工程师' },
  { name: '赵雷', dept: '调度控制室', role: '调度员' },
  { name: '孙丽华', dept: '继电保护班', role: '保护专员' },
  { name: '周伟', dept: '自动化班', role: '自动化工程师' },
  { name: '吴强', dept: '检修一工区', role: '技术员' },
  { name: '郑雪', dept: '检修二工区', role: '技术员' },
  { name: '黄海', dept: '变电运维班', role: '班组长' },
  { name: '林涛', dept: '输电运维班', role: '检修工程师' },
  { name: '徐敏', dept: '调度控制室', role: '调度员' },
  { name: '马超', dept: '继电保护班', role: '保护专员' },
  { name: '朱琳', dept: '自动化班', role: '自动化工程师' },
  { name: '杨波', dept: '检修一工区', role: '检修工程师' },
  { name: '郭亮', dept: '检修二工区', role: '班组长' },
  { name: '曹伟', dept: '变电运维班', role: '技术员' },
  { name: '何静', dept: '调度控制室', role: '调度员' },
  { name: '罗宇', dept: '继电保护班', role: '检修工程师' },
];

function parseUserFromUrl(url: string | undefined): OnlineUser {
  const now = Date.now();
  if (!url) {
    return {
      id: `anon-${Math.random().toString(36).slice(2, 10)}`,
      name: '匿名用户',
      role: '访客',
      color: MOCK_USER_COLORS[0],
      lastActiveAt: now,
    };
  }

  try {
    const searchParams = new URL(url, 'http://localhost').searchParams;
    const userId = searchParams.get('userId') || `user-${Math.random().toString(36).slice(2, 10)}`;
    const userName = searchParams.get('userName');
    const userRole = searchParams.get('userRole');
    const colorSeed = searchParams.get('colorSeed') || userId;
    const colorIdx = Math.abs(hashCode(colorSeed)) % MOCK_USER_COLORS.length;

    if (userName && userRole) {
      return {
        id: userId,
        name: userName,
        role: userRole,
        color: MOCK_USER_COLORS[colorIdx],
        lastActiveAt: now,
      };
    }

    const mockIdx = Math.abs(hashCode(userId)) % MOCK_USER_NAMES.length;
    const mock = MOCK_USER_NAMES[mockIdx];
    return {
      id: userId,
      name: mock.name,
      role: mock.role,
      color: MOCK_USER_COLORS[colorIdx],
      lastActiveAt: now,
    };
  } catch {
    return {
      id: `anon-${Math.random().toString(36).slice(2, 10)}`,
      name: '匿名用户',
      role: '访客',
      color: MOCK_USER_COLORS[0],
      lastActiveAt: now,
    };
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

const clients = new Map<WebSocket, ClientContext>();
const startTime = Date.now();

function sendMessage(ws: WebSocket, message: CollabMessage): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // ignore send errors, client will reconnect
  }
}

function broadcastMessage(message: CollabMessage, excludeWs?: WebSocket): void {
  const payload = JSON.stringify(message);
  for (const [ws] of clients) {
    if (ws === excludeWs) continue;
    if (ws.readyState !== WebSocket.OPEN) continue;
    try {
      ws.send(payload);
    } catch {
      // skip dead sockets
    }
  }
}

function getOnlineUsers(roomId: string): OnlineUser[] {
  const now = Date.now();
  const users: OnlineUser[] = [];
  for (const ctx of clients.values()) {
    if (ctx.roomId !== roomId) continue;
    users.push({
      ...ctx.user,
      lastActiveAt: ctx.lastActiveAt,
    });
  }
  users.sort((a, b) => a.name.localeCompare(b.name));
  return users;
}

function broadcastPresence(roomId: string): void {
  const users = getOnlineUsers(roomId);
  broadcastMessage({
    type: 'presence',
    senderId: 'server',
    data: users,
    timestamp: Date.now(),
  });
}

let presenceTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startTimers(): void {
  if (presenceTimer) return;

  presenceTimer = setInterval(() => {
    const rooms = new Set<string>();
    for (const ctx of clients.values()) {
      rooms.add(ctx.roomId);
    }
    for (const roomId of rooms) {
      broadcastPresence(roomId);
    }
  }, PRESENCE_BROADCAST_MS);

  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [ws, ctx] of clients) {
      if (now - ctx.lastActiveAt > INACTIVE_TIMEOUT_MS) {
        console.log(`[collab] Kicking inactive client: ${ctx.user.id} (${ctx.user.name})`);
        try {
          ws.close(4000, 'inactive');
        } catch {
          // ignore
        }
        handleDisconnect(ws);
      }
    }
  }, PRESENCE_HEARTBEAT_MS);
}

function stopTimers(): void {
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function handleDisconnect(ws: WebSocket): void {
  const ctx = clients.get(ws);
  if (!ctx) return;

  const { roomId, user } = ctx;
  console.log(`[collab] Client disconnected: ${user.id} (${user.name}) in room=${roomId}, remaining=${clients.size - 1}`);

  clients.delete(ws);

  broadcastMessage({
    type: 'disconnect',
    senderId: user.id,
    data: null,
    timestamp: Date.now(),
  }, ws);

  setImmediate(() => broadcastPresence(roomId));

  if (clients.size === 0) {
    stopTimers();
  }
}

wss.on('connection', (ws, req) => {
  if (wss.clients.size > MAX_CLIENTS) {
    console.log(`[collab] Rejecting client: max capacity (${MAX_CLIENTS}) reached`);
    ws.close(1013, 'Server capacity reached, please try again later');
    return;
  }

  const user = parseUserFromUrl(req.url);
  const roomMatch = req.url?.match(/room=([^&]+)/);
  const roomId = roomMatch ? decodeURIComponent(roomMatch[1]) : 'power-grid-main';

  console.log(`[collab] New client: ${user.id} (${user.name}, ${user.role}) room=${roomId}, total=${clients.size + 1}/${MAX_CLIENTS}`);

  const ctx: ClientContext = {
    ws,
    user,
    roomId,
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  clients.set(ws, ctx);

  startTimers();

  const now = Date.now();
  sendMessage(ws, {
    type: 'connect',
    senderId: 'server',
    data: {
      user,
      roomId,
      serverTime: now,
      maxClients: MAX_CLIENTS,
      onlineUsers: getOnlineUsers(roomId),
    },
    timestamp: now,
  });

  broadcastMessage({
    type: 'user:join',
    senderId: user.id,
    data: {
      ...user,
      lastActiveAt: now,
    } as OnlineUser,
    timestamp: now,
  }, ws);

  setImmediate(() => broadcastPresence(roomId));

  ws.on('message', (raw) => {
    const curCtx = clients.get(ws);
    if (!curCtx) return;
    curCtx.lastActiveAt = Date.now();

    let message: CollabMessage;
    try {
      message = JSON.parse(raw.toString()) as CollabMessage;
    } catch {
      console.warn('[collab] Invalid JSON received');
      return;
    }

    if (!message || !message.type) {
      console.warn('[collab] Malformed message (no type)');
      return;
    }

    message.senderId = curCtx.user.id;
    message.timestamp = Date.now();

    switch (message.type) {
      case 'presence':
        sendMessage(ws, {
          type: 'presence',
          senderId: 'server',
          data: getOnlineUsers(curCtx.roomId),
          timestamp: Date.now(),
        });
        break;

      case 'cursor':
        broadcastMessage({
          ...message,
          data: {
            taskId: (message.data as { taskId?: string })?.taskId,
            userId: curCtx.user.id,
            userName: curCtx.user.name,
          },
        }, ws);
        break;

      case 'task:update':
      case 'task:create':
      case 'task:delete':
      case 'conflict:resolve':
      case 'plan:adjust':
        broadcastMessage(message, ws);
        break;

      case 'ping':
        sendMessage(ws, {
          type: 'pong',
          senderId: 'server',
          data: { serverTime: Date.now(), clientTs: (message.data as { ts?: number })?.ts },
          timestamp: Date.now(),
        });
        break;

      default:
        broadcastMessage(message, ws);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });

  ws.on('error', (err) => {
    console.error(`[collab] WebSocket error from ${user.id}:`, err.message);
    handleDisconnect(ws);
  });

  ws.on('pong', () => {
    const curCtx = clients.get(ws);
    if (curCtx) {
      curCtx.lastActiveAt = Date.now();
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  🔗 Power Grid Collaboration Server`);
  console.log(`     WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`     Health:    http://localhost:${PORT}/health`);
  console.log(`     Max Users: ${MAX_CLIENTS}`);
  console.log(`═══════════════════════════════════════════════\n`);
});

const shutdown = (signal: string): void => {
  console.log(`\n[collab] Received ${signal}, shutting down gracefully...`);
  stopTimers();
  for (const [ws, ctx] of clients) {
    try {
      ws.close(1001, 'Server shutting down');
    } catch {
      // ignore
    }
    clients.delete(ws);
  }
  wss.close(() => {
    server.close(() => {
      console.log('[collab] Server stopped');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(0), 3000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('[collab] Uncaught exception:', err);
});
