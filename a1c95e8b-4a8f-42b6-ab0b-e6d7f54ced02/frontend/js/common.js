const API_BASE = '/api';
const AUTH_KEY = 'heritage_token';
const USER_KEY = 'heritage_user';

const Api = {
  async request(url, options = {}) {
    const token = localStorage.getItem(AUTH_KEY);
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    const config = { ...options, headers };
    if (config.body && typeof config.body !== 'string' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
      if (config.headers['Content-Type'] === 'multipart/form-data') {
        delete config.headers['Content-Type'];
      }
    }
    try {
      const res = await fetch(API_BASE + url, config);
      if (res.status === 401) {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(USER_KEY);
        if (!location.href.includes('login.html')) {
          location.href = 'login.html';
        }
        throw new Error('未登录或登录已过期');
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '请求失败');
      }
      return data.data;
    } catch (e) {
      if (e.message !== '未登录或登录已过期') {
        Toast.error(e.message);
      }
      throw e;
    }
  },
  get(url) { return this.request(url, { method: 'GET' }); },
  post(url, body) { return this.request(url, { method: 'POST', body }); },
  put(url, body) { return this.request(url, { method: 'PUT', body }); },
  delete(url) { return this.request(url, { method: 'DELETE' }); },
  upload(url, formData) {
    return this.request(url, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

const Auth = {
  getToken() { return localStorage.getItem(AUTH_KEY); },
  getUser() {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  },
  setAuth(token, user) {
    localStorage.setItem(AUTH_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
    location.href = 'login.html';
  },
  requireAuth() {
    if (!this.getToken()) {
      location.href = 'login.html';
    }
  },
  hasRole(role) {
    const u = this.getUser();
    return u && u.roles && u.roles.includes(role);
  },
  isAdmin() { return this.hasRole('ADMIN'); },
  isExpert() { return this.hasRole('EXPERT'); },
  isRestorer() { return this.hasRole('RESTORER'); },
  isArchivist() { return this.hasRole('ARCHIVIST'); },
  isInspector() { return this.hasRole('INSPECTOR'); }
};

const Toast = {
  _container: null,
  _ensure() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
    }
  },
  show(msg, type = 'info', duration = 3000) {
    this._ensure();
    const colors = {
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8'
    };
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const el = document.createElement('div');
    el.style.cssText = `
      background:white; border-radius:8px; padding:12px 20px;
      margin-bottom:10px; box-shadow:0 4px 16px rgba(0,0,0,0.15);
      display:flex; align-items:center; gap:10px; min-width:240px;
      border-left:4px solid ${colors[type]}; animation: slideIn 0.3s;
    `;
    el.innerHTML = `<span style="color:${colors[type]};font-size:18px">${icons[type]}</span>
      <span style="font-size:14px;color:#2c2c2c">${msg}</span>`;
    this._container.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'slideOut 0.3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },
  success(m) { this.show(m, 'success'); },
  error(m) { this.show(m, 'error'); },
  warning(m) { this.show(m, 'warning'); },
  info(m) { this.show(m, 'info'); }
};

(function addAnim() {
  const s = document.createElement('style');
  s.textContent = `
    @keyframes slideIn { from {transform:translateX(100%);opacity:0;} to {transform:translateX(0);opacity:1;} }
    @keyframes slideOut { from {transform:translateX(0);opacity:1;} to {transform:translateX(100%);opacity:0;} }
  `;
  document.head.appendChild(s);
})();

const Utils = {
  fmtDate(d) {
    if (!d) return '-';
    const dt = new Date(d);
    const pad = n => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  },
  fmtDay(d) {
    if (!d) return '-';
    const dt = new Date(d);
    const pad = n => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
  },
  maskHash(h) {
    if (!h) return '';
    if (h.length <= 16) return h;
    return h.slice(0, 8) + '...' + h.slice(-8);
  },
  esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
  confirm(msg) {
    return new Promise(res => {
      const r = window.confirm(msg);
      res(r);
    });
  },
  statusLabel(s) {
    const m = {
      IN_LIBRARY: '在库', ON_EXHIBITION: '展出', RESTORING: '修复中',
      LENT_OUT: '外借', LOST: '遗失', DAMAGED: '损坏'
    };
    return m[s] || s;
  },
  levelLabel(l) {
    const m = {
      NATIONAL_FIRST: '国家一级', NATIONAL_SECOND: '国家二级',
      NATIONAL_THIRD: '国家三级', GENERAL: '一般文物', ORDINARY: '普通文物'
    };
    return m[l] || l;
  },
  typeLabel(t) {
    const m = {
      PAINTING: '绘画', CALLIGRAPHY: '书法', SCULPTURE: '雕塑',
      CERAMIC: '陶瓷', JADE: '玉器', BRONZE: '青铜器', METAL: '金属器',
      TEXTILE: '织绣', FURNITURE: '家具', DOCUMENT: '文献',
      COIN: '钱币', ARCHITECTURE: '古建筑', STONE_CARVING: '石刻',
      MURAL: '壁画', OTHER: '其他'
    };
    return m[t] || t;
  },
  flowLabel(f) {
    const m = {
      OUTBOUND: '出库', SENT_FOR_RESTORE: '送修', START_RESTORE: '开始修复',
      RESTORE_COMPLETE: '修复完成', INBOUND: '入库', LEND: '外借',
      RETURN: '归还', EXHIBIT: '展出', EXHIBIT_END: '展出结束',
      DAMAGE: '损坏', INSPECT: '巡查', OTHER: '其他'
    };
    return m[f] || f;
  },
  diseaseLabel(d) {
    const m = {
      CRACK: '开裂', DEFORMATION: '变形', CORROSION: '腐蚀',
      PEELING: '剥落', DISCOLORATION: '变色', MOLD: '霉变',
      PEST: '虫蛀', WEATHERING: '风化', WATER_STAIN: '水渍',
      FIRE_DAMAGE: '火灾损伤', OTHER: '其他'
    };
    return m[d] || d;
  },
  alertLabel(a) {
    const m = { LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '紧急' };
    return m[a] || a;
  },
  roleLabel(r) {
    const m = {
      ADMIN: '管理员', EXPERT: '专家', RESTORER: '修复师',
      ARCHIVIST: '档案员', INSPECTOR: '巡查员'
    };
    return m[r] || r;
  },
  diseaseAlertLevel(d) {
    const high = ['CORROSION', 'PEELING', 'MOLD', 'FIRE_DAMAGE'];
    const critical = ['STRUCTURAL_DAMAGE'];
    if (critical.includes(d)) return 'CRITICAL';
    if (high.includes(d)) return 'HIGH';
    if (['CRACK', 'DEFORMATION', 'DISCOLORATION', 'WEATHERING'].includes(d)) return 'MEDIUM';
    return 'LOW';
  }
};

const Layout = {
  renderSidebar(active) {
    const user = Auth.getUser() || {};
    const name = user.realName || user.username || '用户';
    const role = (user.roles || []).map(r => Utils.roleLabel(r)).join('、');
    const menus = [
      { key: 'dashboard', name: '工作台', icon: '🏠', href: 'dashboard.html', roles: ['ADMIN','EXPERT','RESTORER','ARCHIVIST','INSPECTOR'] },
      { key: 'artifact', name: '文物档案', icon: '🏺', href: 'artifacts.html', roles: ['ADMIN','EXPERT','RESTORER','ARCHIVIST','INSPECTOR'] },
      { key: 'trace', name: '修复溯源', icon: '🔗', href: 'trace.html', roles: ['ADMIN','RESTORER','ARCHIVIST'] },
      { key: 'collab', name: '专家协作', icon: '👥', href: 'collab.html', roles: ['ADMIN','EXPERT'] },
      { key: 'inspect', name: '巡查监测', icon: '📋', href: 'inspect.html', roles: ['ADMIN','INSPECTOR'] },
      { key: 'stats', name: '统计分析', icon: '📊', href: 'stats.html', roles: ['ADMIN','ARCHIVIST'] },
      { key: 'users', name: '用户管理', icon: '👤', href: 'users.html', roles: ['ADMIN'] }
    ];
    const items = menus.filter(m => m.roles.some(r => (user.roles||[]).includes(r)));
    document.getElementById('sidebar-root').innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-logo">🏛️</div>
        <div class="sidebar-title">
          <h5>文化遗产数字化平台</h5>
          <small>Cultural Heritage Platform</small>
        </div>
      </div>
      <ul class="sidebar-menu">
        ${items.map(m => `
          <li><a href="${m.href}" class="${active===m.key?'active':''}">
            <i>${m.icon}</i><span>${m.name}</span>
          </a></li>
        `).join('')}
      </ul>
    `;
    document.getElementById('topbar-root').innerHTML = `
      <button class="topbar-toggle" onclick="Layout.toggleSidebar()">☰</button>
      <div class="topbar-title">${this.pageTitle(active)}</div>
      <div class="topbar-right">
        <div class="topbar-bell" title="消息通知">
          🔔<span class="badge" id="alert-count">0</span>
        </div>
        <div class="topbar-user dropdown">
          <div class="topbar-avatar">${(name[0]||'U').toUpperCase()}</div>
          <div class="topbar-user-info">
            <strong>${Utils.esc(name)}</strong>
            <small>${Utils.esc(role)}</small>
          </div>
          <div class="dropdown-menu dropdown-menu-end" id="user-menu" style="display:none;position:absolute;top:56px;right:24px;">
            <a class="dropdown-item" href="#" onclick="Auth.logout()">🚪 退出登录</a>
          </div>
        </div>
      </div>
    `;
    document.querySelector('.topbar-user').addEventListener('click', e => {
      e.stopPropagation();
      const m = document.getElementById('user-menu');
      m.style.display = m.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => {
      const m = document.getElementById('user-menu');
      if (m) m.style.display = 'none';
    });
    this.loadAlertCount();
  },
  pageTitle(k) {
    const m = {
      dashboard: '工作台', artifact: '文物档案管理', trace: '文物流转与修复溯源',
      collab: '专家协作鉴定', inspect: '文物巡查监测',
      stats: '数据统计分析', users: '用户与权限管理'
    };
    return m[k] || '';
  },
  toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('collapsed');
  },
  async loadAlertCount() {
    try {
      const list = await Api.get('/inspect/alerts?acknowledged=false&page=0&size=1');
      const el = document.getElementById('alert-count');
      if (el && list && list.totalElements) {
        el.style.display = 'block';
        el.textContent = list.totalElements > 99 ? '99+' : list.totalElements;
      }
    } catch(e) {}
  },
  mount(active) {
    Auth.requireAuth();
    this.renderSidebar(active);
  }
};
