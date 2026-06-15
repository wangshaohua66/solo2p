import Koa from 'koa';
import cors from '@koa/cors';
import koaBody from 'koa-body';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import disorderRoutes, { inMemoryWorkOrders } from './routes/disorder';
import patrolRoutes from './routes/patrol';
import { swaggerMiddleware, swaggerJsonHandler } from './swagger';
import { subscribe, unsubscribeAll, CHANNEL_PATROL_TRACK, CHANNEL_NOTIFY_WORKORDER, CHANNEL_NOTIFY_ALERT, CHANNEL_NOTIFY_DISORDER } from './redis/pubsub';
import { checkTimeoutWorkOrders } from './service/scheduler';
import { publish } from './redis/pubsub';

const app = new Koa();
const PORT = 3001;

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err: any) {
    console.error('[Error]', err);
    ctx.status = err.status || 500;
    ctx.body = {
      code: ctx.status,
      message: err.message || '服务器内部错误',
      timestamp: Date.now()
    };
  }
});

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`[${new Date().toISOString()}] ${ctx.method} ${ctx.url} - ${ctx.status} - ${duration}ms`);
});

app.use(cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposeHeaders: ['Content-Length', 'Date', 'X-Request-Id']
}));

app.use(koaBody({
  multipart: true,
  jsonLimit: '10mb',
  formLimit: '10mb',
  textLimit: '10mb'
}));

app.use(swaggerJsonHandler);
app.use(swaggerMiddleware());

app.use(disorderRoutes.routes());
app.use(disorderRoutes.allowedMethods());
app.use(patrolRoutes.routes());
app.use(patrolRoutes.allowedMethods());

app.use(async (ctx) => {
  if (ctx.path === '/health') {
    ctx.status = 200;
    ctx.body = {
      code: 200,
      message: 'ok',
      data: {
        status: 'running',
        timestamp: new Date().toISOString()
      },
      timestamp: Date.now()
    };
    return;
  }

  if (ctx.path === '/') {
    ctx.status = 200;
    ctx.body = {
      code: 200,
      message: 'Road Disorder Management API',
      data: {
        docs: 'http://localhost:3001/api-docs',
        health: 'http://localhost:3001/health',
        swaggerJson: 'http://localhost:3001/swagger.json'
      },
      timestamp: Date.now()
    };
    return;
  }
});

const server = http.createServer(app.callback());

const wssPatrol = new WebSocketServer({ noServer: true });
const wssNotify = new WebSocketServer({ noServer: true });

const patrolClients = new Set<WebSocket>();
const notifyClients = new Set<WebSocket>();

wssPatrol.on('connection', (ws) => {
  patrolClients.add(ws);
  console.log('[WebSocket] /ws/patrol client connected, total:', patrolClients.size);

  ws.on('message', async (data) => {
    try {
      const messageStr = data.toString();
      const parsed = JSON.parse(messageStr);

      await publish(CHANNEL_PATROL_TRACK, {
        ...parsed,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[WebSocket /ws/patrol] Invalid message:', err);
    }
  });

  ws.on('close', () => {
    patrolClients.delete(ws);
    console.log('[WebSocket] /ws/patrol client disconnected, total:', patrolClients.size);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket /ws/patrol] Error:', err);
    patrolClients.delete(ws);
  });
});

wssNotify.on('connection', (ws) => {
  notifyClients.add(ws);
  console.log('[WebSocket] /ws/notify client connected, total:', notifyClients.size);

  ws.send(JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString()
  }));

  ws.on('close', () => {
    notifyClients.delete(ws);
    console.log('[WebSocket] /ws/notify client disconnected, total:', notifyClients.size);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket /ws/notify] Error:', err);
    notifyClients.delete(ws);
  });
});

const broadcastToClients = (clients: Set<WebSocket>, message: string) => {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message, (err) => {
        if (err) {
          console.error('[WebSocket Broadcast] Error:', err);
        }
      });
    }
  });
};

subscribe(CHANNEL_PATROL_TRACK, (message, channel) => {
  broadcastToClients(patrolClients, message);
});

subscribe(CHANNEL_NOTIFY_WORKORDER, (message, channel) => {
  broadcastToClients(notifyClients, JSON.stringify({
    channel,
    data: JSON.parse(message),
    timestamp: new Date().toISOString()
  }));
});

subscribe(CHANNEL_NOTIFY_ALERT, (message, channel) => {
  broadcastToClients(notifyClients, JSON.stringify({
    channel,
    data: JSON.parse(message),
    timestamp: new Date().toISOString()
  }));
});

subscribe(CHANNEL_NOTIFY_DISORDER, (message, channel) => {
  broadcastToClients(notifyClients, JSON.stringify({
    channel,
    data: JSON.parse(message),
    timestamp: new Date().toISOString()
  }));
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url!, 'http://localhost').pathname;

  if (pathname === '/ws/patrol') {
    wssPatrol.handleUpgrade(request, socket, head, (ws) => {
      wssPatrol.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/notify') {
    wssNotify.handleUpgrade(request, socket, head, (ws) => {
      wssNotify.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

async function runTimeoutCheck() {
  try {
    const alerts = checkTimeoutWorkOrders(inMemoryWorkOrders);
    if (alerts.length > 0) {
      console.log(`[Scheduler] Found ${alerts.length} timeout work orders`);
      for (const alert of alerts) {
        await publish(CHANNEL_NOTIFY_ALERT, {
          type: 'timeout',
          data: alert,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.error('[Scheduler] Timeout check error:', err);
  }
}

const TIMEOUT_CHECK_INTERVAL = 5 * 60 * 1000;

process.on('SIGTERM', () => {
  console.log('[Shutdown] SIGTERM received, closing server...');
  unsubscribeAll();
  server.close(() => {
    console.log('[Shutdown] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Shutdown] SIGINT received, closing server...');
  unsubscribeAll();
  server.close(() => {
    console.log('[Shutdown] Server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('WebSocket ready');
  console.log(`API Docs: http://localhost:${PORT}/api-docs`);

  runTimeoutCheck();
  setInterval(runTimeoutCheck, TIMEOUT_CHECK_INTERVAL);
});

export default app;
