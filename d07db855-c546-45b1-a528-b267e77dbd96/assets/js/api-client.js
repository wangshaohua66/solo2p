/**
 * 后端 REST API 统一客户端。
 * 所有前端页面通过此对象调用后端真实接口，不再使用任何硬编码 Mock 数据。
 * 通过 Spring Cloud Gateway（默认 http://localhost:8080）路由到各微服务，
 * 网关 JwtAuthFilter 会解析 Bearer Token 并注入 X-User-Id / X-Username / X-Role-Code 头。
 */
const ApiClient = (function () {

  const BASE = (window.API_BASE_URL || 'http://localhost:8080');
  const PREFIX = {
    auth: '/api/auth',
    sample: '/api/sample',
    task: '/api/task',
    report: '/api/report',
    customer: '/api/customer',
    analytics: '/api/analytics'
  };

  const TOKEN_KEY = 'icc_token';
  const USER_KEY = 'icc_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
  function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setCurrentUser(user) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }
  function isLoggedIn() {
    return !!getToken();
  }

  /**
   * 通用请求方法，自动携带 Token，解析 R<T> 信封 { code, message, data }。
   * @returns Promise<data>
   */
  async function request(method, url, { body, formData, query, raw } = {}) {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let finalUrl = url;
    if (query) {
      const qs = new URLSearchParams();
      Object.keys(query).forEach(k => {
        if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.append(k, query[k]);
      });
      const s = qs.toString();
      if (s) finalUrl += (url.includes('?') ? '&' : '?') + s;
    }

    const opts = { method, headers };
    if (formData) {
      opts.body = formData;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }

    let resp;
    try {
      resp = await fetch(finalUrl, opts);
    } catch (e) {
      throw new ApiError('网络请求失败：无法连接到后端服务（' + finalUrl + '）', 0, e);
    }

    if (resp.status === 401) {
      setToken(null);
      setCurrentUser(null);
      throw new ApiError('未登录或登录已过期，请重新登录', 401);
    }

    if (raw) return resp;

    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      if (!resp.ok) throw new ApiError('请求失败：HTTP ' + resp.status, resp.status);
      return resp;
    }

    let json;
    try { json = await resp.json(); }
    catch (e) { throw new ApiError('响应解析失败', resp.status, e); }

    if (json && typeof json === 'object' && 'code' in json) {
      if (json.code === 200 || json.code === 0) return json.data;
      throw new ApiError(json.message || '业务处理失败', json.code);
    }
    return json;
  }

  function get(url, opts) { return request('GET', url, opts); }
  function post(url, body, opts) { return request('POST', url, Object.assign({ body }, opts)); }
  function put(url, body, opts) { return request('PUT', url, Object.assign({ body }, opts)); }
  function del(url, opts) { return request('DELETE', url, opts); }

  function full(prefix, path) {
    return BASE + prefix + path;
  }

  function ApiError(message, code, cause) {
    this.name = 'ApiError';
    this.message = message;
    this.code = code;
    this.cause = cause;
  }
  ApiError.prototype = Object.create(Error.prototype);

  /** 统一错误提示（页面可直接 catch 后调用） */
  function handleError(e, title) {
    const msg = (e && e.message) ? e.message : '未知错误';
    if (typeof AppUtils !== 'undefined' && AppUtils.showToast) {
      AppUtils.showToast(title || '请求失败', msg, 'error');
    }
    if (e && e.code === 401 && typeof Auth !== 'undefined') {
      Auth.showLogin();
    }
    return null;
  }

  /* ---------------- Auth 认证授权 ---------------- */
  const auth = {
    login(username, password) {
      return post(full(PREFIX.auth, '/login'), { username, password });
    },
    menus() { return get(full(PREFIX.auth, '/menus')); },
    roles() { return get(full(PREFIX.auth, '/roles')); },
    info() { return get(full(PREFIX.auth, '/info')); }
  };

  /* ---------------- Sample 样品管理 ---------------- */
  const sample = {
    list(params) { return get(full(PREFIX.sample, '/list'), { query: params }); },
    getById(id) { return get(full(PREFIX.sample, '/' + id)); },
    create(data) { return post(full(PREFIX.sample, ''), data); },
    batchImport(file) {
      const fd = new FormData();
      fd.append('file', file);
      return post(full(PREFIX.sample, '/import'), null, { formData: fd });
    },
    uploadPhotos(files, sampleId) {
      const fd = new FormData();
      for (const f of files) fd.append('file', f);
      return post(full(PREFIX.sample, '/photo/upload'), null, { formData: fd, query: { sampleId } });
    },
    updateStatus(id, status, remark) {
      return put(full(PREFIX.sample, '/' + id + '/status'), null, { query: { status, remark } });
    },
    destroy(id, remark) {
      return post(full(PREFIX.sample, '/' + id + '/destroy'), null, { query: { remark } });
    },
    expiringRetention() { return get(full(PREFIX.sample, '/retention/expiring')); },
    flowLogs(id) { return get(full(PREFIX.sample, '/' + id + '/flow-logs')); }
  };

  /* ---------------- Task 检测任务 ---------------- */
  const task = {
    list() { return get(full(PREFIX.task, '/list')); },
    create(data) { return post(full(PREFIX.task, ''), data); },
    updateStatus(id, status) {
      return put(full(PREFIX.task, '/' + id + '/status'), null, { query: { status } });
    },
    autoDispatch() { return post(full(PREFIX.task, '/dispatch/auto')); },
    dispatchSingle(taskId) { return post(full(PREFIX.task, '/dispatch/' + taskId)); },
    checkConflict(equipmentId, startTime, endTime) {
      return get(full(PREFIX.task, '/equipment/conflict-check'), { query: { equipmentId, startTime, endTime } });
    },
    equipmentList() { return get(full(PREFIX.task, '/equipment/list')); },
    technicianList() { return get(full(PREFIX.task, '/technician/list')); },
    unreadNotifications() { return get(full(PREFIX.task, '/notification/unread')); },
    markRead(id) { return post(full(PREFIX.task, '/notification/' + id + '/read')); },
    training: {
      list() { return get(full(PREFIX.task, '/training/list')); },
      listByTechnician(techId) { return get(full(PREFIX.task, '/training/technician/' + techId)); },
      get(id) { return get(full(PREFIX.task, '/training/' + id)); },
      create(data) { return post(full(PREFIX.task, '/training'), data); },
      update(data) { return put(full(PREFIX.task, '/training'), data); },
      remove(id) { return del(full(PREFIX.task, '/training/' + id)); }
    },
    abilityScope: {
      list() { return get(full(PREFIX.task, '/ability-scope/list')); },
      listByLab(labId) { return get(full(PREFIX.task, '/ability-scope/lab/' + labId)); },
      get(id) { return get(full(PREFIX.task, '/ability-scope/' + id)); },
      create(data) { return post(full(PREFIX.task, '/ability-scope'), data); },
      update(data) { return put(full(PREFIX.task, '/ability-scope'), data); },
      remove(id) { return del(full(PREFIX.task, '/ability-scope/' + id)); }
    }
  };

  /* ---------------- Report 报告与证书 ---------------- */
  const report = {
    templates() { return get(full(PREFIX.report, '/report/templates')); },
    generate(data) { return post(full(PREFIX.report, '/report/generate'), data); },
    audit(id, status, remark) {
      return post(full(PREFIX.report, '/report/' + id + '/audit'), null, { query: { status, remark } });
    },
    annotations(id) { return get(full(PREFIX.report, '/report/' + id + '/annotations')); },
    addAnnotation(id, data) { return post(full(PREFIX.report, '/report/' + id + '/annotation'), data); },
    list() { return get(full(PREFIX.report, '/report/list')); },
    pdfUrl(id) { return full(PREFIX.report, '/report/' + id + '/pdf'); },
    downloadPdf(id) { return get(full(PREFIX.report, '/report/' + id + '/pdf'), { raw: true }); }
  };
  const certificate = {
    templates() { return get(full(PREFIX.report, '/certificate/templates')); },
    issue(data) { return post(full(PREFIX.report, '/certificate/issue'), data); },
    revoke(id, reason) {
      return post(full(PREFIX.report, '/certificate/' + id + '/revoke'), null, { query: { reason } });
    },
    batchPrint(ids) { return post(full(PREFIX.report, '/certificate/batch-print'), ids); },
    changelogs(id) { return get(full(PREFIX.report, '/certificate/' + id + '/changelogs')); },
    list() { return get(full(PREFIX.report, '/certificate/list')); },
    pdfUrl(id) { return full(PREFIX.report, '/certificate/' + id + '/pdf'); },
    downloadPdf(id) { return get(full(PREFIX.report, '/certificate/' + id + '/pdf'), { raw: true }); }
  };

  /* ---------------- Customer 客户自助 ---------------- */
  const customer = {
    submitApp(data) { return post(full(PREFIX.customer, '/application/submit'), data); },
    auditApp(id, status, reason) {
      return post(full(PREFIX.customer, '/application/' + id + '/audit'), null, { query: { status, reason } });
    },
    progress(id) { return get(full(PREFIX.customer, '/application/' + id + '/progress')); },
    downloadReport(id) { return get(full(PREFIX.customer, '/application/' + id + '/report-download')); },
    pay(id, method, amount) {
      return post(full(PREFIX.customer, '/application/' + id + '/pay'), null, { query: { method, amount } });
    },
    applyInvoice(data) { return post(full(PREFIX.customer, '/invoice/apply'), data); },
    myApps(companyId) { return get(full(PREFIX.customer, '/application/mine'), { query: { companyId } }); },
    myInvoices(companyId) { return get(full(PREFIX.customer, '/invoice/mine'), { query: { companyId } }); }
  };

  /* ---------------- Analytics 统计与审计 ---------------- */
  const analytics = {
    appendRawRecord(data) { return post(full(PREFIX.analytics, '/raw-record/append'), data); },
    verifyIntegrity(taskId) { return get(full(PREFIX.analytics, '/raw-record/verify/' + taskId)); },
    dashboardStats() { return get(full(PREFIX.analytics, '/dashboard/stats')); },
    auditLogs() { return get(full(PREFIX.analytics, '/audit/logs')); },
    revenueStats() { return get(full(PREFIX.analytics, '/revenue/stats')); },
    enterpriseFrequency() { return get(full(PREFIX.analytics, '/enterprise/frequency')); }
  };

  return {
    BASE, PREFIX, TOKEN_KEY, USER_KEY,
    getToken, setToken, getCurrentUser, setCurrentUser, isLoggedIn,
    request, get, post, put, del, handleError, ApiError,
    auth, sample, task, report, certificate, customer, analytics
  };
})();

/**
 * 静态 UI 常量（非业务数据：产品类别/认证类型/角色显示名/菜单分组）。
 * 这些是前端界面配置，后端无独立查询接口，不属于“硬编码 Mock 业务数据”。
 */
const UI_CONST = {
  productCategories: [
    { code: 'EE', name: '电子电器' },
    { code: 'ME', name: '机械装备' },
    { code: 'BM', name: '建材家具' },
    { code: 'AU', name: '汽车零部件' },
    { code: 'FC', name: '食品接触' },
    { code: 'TX', name: '纺织服装' },
    { code: 'TW', name: '玩具文具' },
    { code: 'MD', name: '医疗器械' }
  ],
  certTypes: ['CCC', 'CE', 'ISO'],
  categoryColors: {
    '电子电器': '#2563eb', '机械装备': '#10b981', '建材家具': '#f59e0b',
    '汽车零部件': '#ef4444', '食品接触': '#06b6d4', '纺织服装': '#8b5cf6',
    '玩具文具': '#ec4899', '医疗器械': '#14b8a6'
  },
  roleMeta: {
    admin:        { name: '实验室管理员', desc: '全部权限' },
    auditor:      { name: '报告审核员', desc: '报告审核、证书签发' },
    technician:   { name: '实验室技术员', desc: '检测任务执行、原始记录录入' },
    sample_admin: { name: '样品管理员', desc: '样品接收、登记、流转' },
    customer:     { name: '企业客户', desc: '申请检测、进度查询、报告下载' }
  },
  menuConfig: [
    { group: '工作台', roleKeys: ['admin', 'auditor', 'technician', 'sample_admin', 'customer'], items: [
      { key: 'dashboard', icon: '📊', text: '数据概览' },
      { key: 'todo', icon: '📋', text: '我的待办' }
    ]},
    { group: '业务管理', roleKeys: ['admin', 'auditor', 'technician', 'sample_admin'], items: [
      { key: 'samples', icon: '📦', text: '样品管理', roleKeys: ['admin', 'sample_admin', 'technician'] },
      { key: 'tasks', icon: '📝', text: '检测任务', roleKeys: ['admin', 'technician', 'auditor'] },
      { key: 'reports', icon: '📄', text: '报告证书', roleKeys: ['admin', 'auditor'] },
      { key: 'customers', icon: '🏢', text: '客户服务', roleKeys: ['admin', 'customer'] }
    ]},
    { group: '资源管理', roleKeys: ['admin', 'auditor', 'technician'], items: [
      { key: 'lab', icon: '🔬', text: '实验室资源' },
      { key: 'trace', icon: '🔍', text: '数据追溯' }
    ]},
    { group: '统计分析', roleKeys: ['admin', 'auditor'], items: [
      { key: 'analytics', icon: '📈', text: '统计报表' }
    ]}
  ]
};

/**
 * 认证与登录态管理。
 */
const Auth = (function () {
  function isLoggedIn() { return ApiClient.isLoggedIn(); }

  function getCurrentUser() {
    const u = ApiClient.getCurrentUser();
    if (u) return u;
    return null;
  }

  async function login(username, password) {
    const vo = await ApiClient.auth.login(username, password);
    const roleCode = vo.roleCode || (vo.roles && vo.roles[0]) || 'admin';
    const user = {
      id: vo.userId,
      name: vo.realName || vo.username,
      username: vo.username,
      role: (UI_CONST.roleMeta[roleCode] || {}).name || roleCode,
      roleKey: roleCode,
      department: (UI_CONST.roleMeta[roleCode] || {}).desc || '',
      avatar: vo.avatar || (vo.realName || vo.username || 'U').charAt(0).toUpperCase()
    };
    ApiClient.setToken(vo.token);
    ApiClient.setCurrentUser(user);
    return user;
  }

  function logout() {
    ApiClient.setToken(null);
    ApiClient.setCurrentUser(null);
    showLogin();
  }

  function showLogin() {
    const html = `
      <div style="padding:8px 4px;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:40px;">⚖️</div>
          <div style="font-size:18px;font-weight:600;margin-top:8px;">检验检测认证中心</div>
          <div style="font-size:13px;color:var(--gray-500);margin-top:4px;">请登录后进入系统</div>
        </div>
        <div class="floating-label" style="margin-bottom:14px;">
          <input type="text" id="loginUsername" placeholder=" " value="admin" autocomplete="off">
          <label>用户名</label>
        </div>
        <div class="floating-label" style="margin-bottom:8px;">
          <input type="password" id="loginPassword" placeholder=" " value="123456" autocomplete="off">
          <label>密码</label>
        </div>
        <div id="loginError" style="color:var(--danger);font-size:13px;min-height:18px;"></div>
      </div>
    `;
    const mask = AppUtils.showModal({
      title: '🔐 用户登录',
      content: html,
      confirmText: '登录',
      cancelText: '',
      width: '380px',
      onConfirm: async () => {
        const u = $('#loginUsername').val().trim();
        const p = $('#loginPassword').val().trim();
        if (!u || !p) { $('#loginError').text('请输入用户名和密码'); return false; }
        try {
          const user = await Auth.login(u, p);
          AppUtils.closeModal(mask);
          AppUtils.showToast('登录成功', '欢迎，' + user.name, 'success');
          if (typeof AppLayout !== 'undefined') {
            AppLayout.currentPage = 'dashboard';
            AppLayout.renderSidebar();
            AppLayout.renderHeader();
            PageRouter.go('dashboard');
          }
          return false;
        } catch (e) {
          $('#loginError').text((e && e.message) || '登录失败');
          return false;
        }
      }
    });
    mask.find('.modal-close, .modal-cancel').hide();
    mask.off('click');
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      showLogin();
      return false;
    }
    return true;
  }

  return { isLoggedIn, getCurrentUser, login, logout, showLogin, requireAuth };
})();
