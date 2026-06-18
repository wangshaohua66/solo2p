import type { TickData, KlineData, Order, Strategy, RiskMetrics, WsMessage } from '@/types';

type MessageHandler<T = unknown> = (data: T) => void;

class MarketDataWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout = 30000;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private subscribedSymbols: Set<string> = new Set();
  private subscribedKlines: Map<string, string> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WS] Connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.resubscribe();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WsMessage = JSON.parse(event.data);
            if (message.type === 'ping') {
              this.send({ type: 'pong', data: null, timestamp: Date.now() });
              return;
            }
            this.dispatch(message);
          } catch (e) {
            console.error('[WS] Parse error:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log(`[WS] Disconnected: code=${event.code}`);
          this.stopHeartbeat();
          this.tryReconnect();
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping', data: null, timestamp: Date.now() });
    }, this.heartbeatTimeout);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  private resubscribe(): void {
    this.subscribedSymbols.forEach((symbol) => {
      this.send({
        type: 'subscribe_tick',
        data: { symbol },
        timestamp: Date.now(),
      } as unknown as WsMessage);
    });

    this.subscribedKlines.forEach((interval, symbol) => {
      this.send({
        type: 'subscribe_kline',
        data: { symbol, interval },
        timestamp: Date.now(),
      } as unknown as WsMessage);
    });
  }

  subscribeTick(symbol: string): void {
    if (this.subscribedSymbols.has(symbol)) return;
    this.subscribedSymbols.add(symbol);
    this.send({
      type: 'subscribe_tick',
      data: { symbol },
      timestamp: Date.now(),
    } as unknown as WsMessage);
  }

  unsubscribeTick(symbol: string): void {
    if (!this.subscribedSymbols.has(symbol)) return;
    this.subscribedSymbols.delete(symbol);
    this.send({
      type: 'unsubscribe_tick',
      data: { symbol },
      timestamp: Date.now(),
    } as unknown as WsMessage);
  }

  subscribeKline(symbol: string, interval: string): void {
    const key = `${symbol}_${interval}`;
    if (this.subscribedKlines.has(key)) return;
    this.subscribedKlines.set(key, interval);
    this.send({
      type: 'subscribe_kline',
      data: { symbol, interval },
      timestamp: Date.now(),
    } as unknown as WsMessage);
  }

  unsubscribeKline(symbol: string, interval: string): void {
    const key = `${symbol}_${interval}`;
    if (!this.subscribedKlines.has(key)) return;
    this.subscribedKlines.delete(key);
    this.send({
      type: 'unsubscribe_kline',
      data: { symbol, interval },
      timestamp: Date.now(),
    } as unknown as WsMessage);
  }

  onTick(handler: MessageHandler<TickData>): () => void {
    return this.addHandler('tick', handler);
  }

  onKline(handler: MessageHandler<{ symbol: string; interval: string; data: KlineData }>): () => void {
    return this.addHandler('kline', handler);
  }

  onStrategyStatus(handler: MessageHandler<Strategy>): () => void {
    return this.addHandler('strategy_status', handler);
  }

  onOrderUpdate(handler: MessageHandler<Order>): () => void {
    return this.addHandler('order_update', handler);
  }

  onRiskAlert(handler: MessageHandler<RiskMetrics>): () => void {
    return this.addHandler('risk_alert', handler);
  }

  onSignal(handler: MessageHandler<{ strategyId: string; symbol: string; side: string; price: number; quantity: number }>): () => void {
    return this.addHandler('signal', handler);
  }

  private addHandler<T>(type: string, handler: MessageHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as MessageHandler);

    return () => {
      this.handlers.get(type)?.delete(handler as MessageHandler);
    };
  }

  private dispatch(message: WsMessage): void {
    const handlers = this.handlers.get(message.type);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(message.data);
      } catch (e) {
        console.error(`[WS] Handler error for ${message.type}:`, e);
      }
    });
  }

  private send(message: WsMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
    this.subscribedSymbols.clear();
    this.subscribedKlines.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new MarketDataWebSocket(
  process.env.NODE_ENV === 'production' ? 'wss://api.example.com/ws' : 'ws://localhost:8080/ws'
);

export function simulateMarketData(onTick: (tick: TickData) => void): () => void {
  const symbols = ['IF2406', 'IC2406', 'RB2410', 'AU2406', 'CU2406', 'M2409', 'Y2409', 'A2409'];
  const basePrices: Record<string, number> = {
    IF2406: 3850,
    IC2406: 5680,
    RB2410: 3420,
    AU2406: 528,
    CU2406: 72500,
    M2409: 2850,
    Y2409: 8560,
    A2409: 4820,
  };
  const priceMap = { ...basePrices };

  const interval = setInterval(() => {
    symbols.forEach((symbol) => {
      const change = (Math.random() - 0.5) * basePrices[symbol] * 0.002;
      priceMap[symbol] = Math.max(basePrices[symbol] * 0.9, Math.min(basePrices[symbol] * 1.1, priceMap[symbol] + change));
      const lastPrice = priceMap[symbol];
      const tick: TickData = {
        symbol,
        lastPrice: Number(lastPrice.toFixed(2)),
        bidPrice: Number((lastPrice - 1).toFixed(2)),
        askPrice: Number((lastPrice + 1).toFixed(2)),
        bidVolume: Math.floor(Math.random() * 100) + 10,
        askVolume: Math.floor(Math.random() * 100) + 10,
        volume: Math.floor(Math.random() * 10000),
        openInterest: Math.floor(Math.random() * 100000),
        timestamp: Date.now(),
      };
      onTick(tick);
    });
  }, 500);

  return () => clearInterval(interval);
}
