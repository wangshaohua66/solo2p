import axios, { AxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'labelops_token';

export const getToken = (): string => {
  return localStorage.getItem(TOKEN_KEY) || '';
};

export const setToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export type WSMessageType = 'piracy_alert' | 'crawl_progress' | 'alert' | 'ping' | 'pong';

export interface WSPiracyAlert {
  piracy_id: string;
  work_id: string;
  work_title: string;
  match_score: number;
  suspect_url: string;
  suspect_name: string;
  platform: string;
}

export interface WSCrawlProgress {
  task_id: string;
  platform: string;
  progress: number;
  status: string;
  error_msg?: string;
}

export interface WSAlert {
  level: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
}

export interface WSMessage {
  type: WSMessageType;
  payload: WSPiracyAlert | WSCrawlProgress | WSAlert | any;
}

type WSMessageHandler = (msg: WSMessage) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private handlers: Set<WSMessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url: string = '';

  connect(): WebSocket | null {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    const token = getToken();
    if (!token) {
      return null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.url = `${protocol}//${host}/api/ws?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (msg.type === 'ping') {
            this.ws?.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          this.handlers.forEach((handler) => handler(msg));
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };

      this.ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        this.ws = null;
        if (this.reconnectAttempts < this.maxReconnectAttempts && event.code !== 1008) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.connect(), delay);
        }
      };

      return this.ws;
    } catch (e) {
      console.error('[WS] Connection failed:', e);
      return null;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  subscribe(handler: WSMessageHandler): () => void {
    this.handlers.add(handler);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) {
        this.disconnect();
      }
    };
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

export const wsManager = new WebSocketManager();

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface ApiPagedParams {
  page?: number;
  page_size?: number;
  [key: string]: any;
}

export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  validate: () => api.get('/auth/validate'),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  users: (params: ApiPagedParams & { role?: string }) =>
    api.get('/auth/users', { params }),
};

export const workAPI = {
  list: (params: ApiPagedParams & { brand?: string; status?: string; type?: string; keyword?: string }) =>
    api.get('/works', { params }),
  get: (id: string) => api.get(`/works/${id}`),
  create: (data: any) => api.post('/works', data),
  updateStatus: (id: string, status: string, note?: string) =>
    api.patch(`/works/${id}/status`, { status, note }),
  uploadVersion: (id: string, formData: FormData) =>
    api.post(`/works/${id}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    } as AxiosRequestConfig),
  compareVersions: (id: string, version_a: string, version_b: string) =>
    api.post(`/works/${id}/versions/compare`, { version_a, version_b }),
  createAuthLink: (id: string, data: any) =>
    api.post(`/works/${id}/auth-chain`, data),
  validateCover: (id: string) => api.get(`/works/${id}/validate-cover`),
};

export const authLinkAPI = {
  list: (params: ApiPagedParams & { brand?: string; work_id?: string; auth_type?: string; keyword?: string }) =>
    api.get('/auth-links', { params }),
};

export const artistAPI = {
  list: (params: ApiPagedParams & { brand?: string }) =>
    api.get('/artists', { params }),
  get: (id: string) => api.get(`/artists/${id}`),
};

export const royaltyAPI = {
  settlements: (params: ApiPagedParams & { artist_id?: string; status?: string; brand?: string }) =>
    api.get('/royalty/settlements', { params }),
  getSettlement: (id: string) => api.get(`/royalty/settlements/${id}`),
  generateSettlement: (artist_id: string, period: string, ref_date?: string) =>
    api.post('/royalty/settlements/generate', { artist_id, period, ref_date }),
  updateSettlementStatus: (id: string, action: string, remark?: string) =>
    api.post(`/royalty/settlements/${id}/status`, { action, remark }),
  compareSettlements: (ids: string[]) =>
    api.post('/royalty/settlements/compare', { ids }),
  rules: (params: ApiPagedParams & { work_id?: string; artist_id?: string }) =>
    api.get('/royalty/rules', { params }),
  getRule: (id: string) => api.get(`/royalty/rules/${id}`),
  createRule: (data: any) => api.post('/royalty/rules', data),
  dashboard: (params: { start_date?: string; end_date?: string; brand?: string }) =>
    api.get('/royalty/dashboard', { params }),
};

export const monitorAPI = {
  piracies: (params: ApiPagedParams & { status?: string; work_id?: string }) =>
    api.get('/monitor/piracies', { params }),
  getPiracy: (id: string) => api.get(`/monitor/piracies/${id}`),
  scanPiracy: (work_id?: string, threshold?: number) =>
    api.post('/monitor/piracies/scan', { work_id, threshold }),
  resolvePiracy: (id: string, action: string, dismissed?: boolean) =>
    api.post(`/monitor/piracies/${id}/resolve`, { action, dismissed }),
  triggerCrawl: (params: { platform: string; work_ids?: string[]; start_date?: string; end_date?: string; max_retry?: number }) =>
    api.post('/monitor/crawl', params),
  getCrawlerTask: (id: string) => api.get(`/monitor/crawl/${id}`),
  compareFingerprint: (f1: string, f2: string) =>
    api.post('/monitor/compare-fingerprint', { fingerprint1: f1, fingerprint2: f2 }),
  platformSummary: (params: { start_date?: string; end_date?: string; platform?: string; work_id?: string }) =>
    api.get('/monitor/platform-summary', { params }),
};

export default api;
