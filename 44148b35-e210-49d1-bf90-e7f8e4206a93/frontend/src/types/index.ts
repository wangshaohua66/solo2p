export type StrategyStatus = 'running' | 'stopped' | 'paused' | 'error';

export type StrategyType = 'trend_following' | 'arbitrage' | 'market_making';

export type OrderType = 'limit' | 'market' | 'stop_profit' | 'stop_loss';

export type OrderSide = 'buy_open' | 'sell_open' | 'buy_close' | 'sell_close';

export type OrderStatus = 'pending' | 'submitted' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type UserRole = 'admin' | 'trader' | 'auditor';

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  status: StrategyStatus;
  symbols: string[];
  params: Record<string, number | string | boolean>;
  dailyPnL: number;
  totalPnL: number;
  positionCount: number;
  marginUsage: number;
  createdAt: string;
  updatedAt: string;
  assignedTrader?: string;
}

export interface Position {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  direction: 'long' | 'short';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  margin: number;
  openTime: string;
}

export interface TickData {
  symbol: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  bidVolume: number;
  askVolume: number;
  volume: number;
  openInterest: number;
  timestamp: number;
}

export interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeSignal {
  strategyId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  timestamp: number;
}

export interface Order {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  price: number;
  quantity: number;
  filledQuantity: number;
  avgFillPrice: number;
  status: OrderStatus;
  margin: number;
  createTime: string;
  updateTime: string;
  rejectReason?: string;
}

export interface RiskMetrics {
  strategyId: string;
  strategyName: string;
  totalMargin: number;
  marginRatio: number;
  riskLevel: RiskLevel;
  positionCount: number;
  concentration: { symbol: string; ratio: number }[];
  dailyLoss: number;
  maxDrawdown: number;
}

export interface AccountMetrics {
  totalAsset: number;
  availableFund: number;
  usedMargin: number;
  dailyPnL: number;
  totalPnL: number;
  marginRatio: number;
  positionCount: number;
  riskLevel: RiskLevel;
}

export interface PerformanceReport {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  strategies: {
    strategyId: string;
    strategyName: string;
    totalPnL: number;
    winRate: number;
    profitLossRatio: number;
    maxDrawdown: number;
    sharpeRatio: number;
    tradeCount: number;
  }[];
  summary: {
    totalPnL: number;
    avgWinRate: number;
    avgProfitLossRatio: number;
    avgSharpeRatio: number;
  };
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
  permissions: string[];
}

export interface BacktestConfig {
  strategyId: string;
  strategyParams: Record<string, number>;
  startDate: string;
  endDate: string;
  symbols: string[];
  initialCapital: number;
  commissionRate: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  equityCurve: { time: number; equity: number }[];
  trades: {
    entryTime: number;
    exitTime: number;
    symbol: string;
    side: OrderSide;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
  }[];
  metrics: {
    totalReturn: number;
    annualReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    sortinoRatio: number;
    winRate: number;
    profitLossRatio: number;
    totalTrades: number;
    commission: number;
  };
}

export interface WsMessage<T = unknown> {
  type: 'tick' | 'kline' | 'strategy_status' | 'order_update' | 'risk_alert' | 'ping' | 'pong' | 'signal';
  data: T;
  timestamp: number;
}
