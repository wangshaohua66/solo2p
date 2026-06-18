/* App — 路由、导航、共享工具与中间件注册 */
(function (global) {
  const ROLE = { dispatcher: '调度员', inspector: '巡检员', admin: '管理员' };
  const DEFAULT_USERS = { dispatcher: '调度员·王建国', inspector: '巡检员·张磊', admin: '管理员·钱正' };

  const App = {
    routes: {},
    current: null,
    role: 'dispatcher',
    api: global.API,
    charts: {},

    registerPage(name, def) { this.routes[name] = def; },

    setRole(r) {
      if (!ROLE[r]) return;
      this.role = r;
      $('.role-switch .btn').removeClass('active');
      $('.role-switch .btn[data-role="' + r + '"]').addClass('active');
      $('#roleLabel').text('当前角色：' + ROLE[r] + ' · ' + (DEFAULT_USERS[r] || ''));
      if (this.current) this.navigate(this.current, true);
    },

    navigate(name, force) {
      const def = this.routes[name] || this.routes.overview;
      if (!force && this.current === name) return;
      this.current = name;
      location.hash = '#/' + name;
      $('.nav-tabs .nav-link').removeClass('active');
      $('.nav-tabs .nav-link[data-route="' + name + '"]').addClass('active');
      $('#pageTitle').text(def.title || '');
      $('#pageSub').text(def.sub || '');
      this.clearCharts();
      $('#quickStats').empty();
      if (window.API && !this.api) this.api = window.API;
      const $app = $('#app');
      $app.removeClass().addClass('app-shell container-fluid px-3');
      $app.html('<div class="d-flex justify-content-center py-5"><div class="spinner-border text-info" role="status"><span class="visually-hidden">加载中...</span></div></div>');
      const self = this;
      Promise.resolve().then(function () {
        return def.render($app, self);
      }).then(function () {
        self.refreshAlerts();
      }).catch(function (e) {
        $app.html('<div class="alert alert-danger m-3"><i class="bi bi-exclamation-triangle"></i> ' + (e.message || '渲染异常') + '</div>');
        console.error(e);
      });
    },

    clearCharts() {
      Object.values(this.charts).forEach(c => { try { c.destroy(); } catch (e) {} });
      this.charts = {};
    },

    refreshAlerts() {
      const self = this;
      if (window.API && !this.api) this.api = window.API;
      if (!this.api || !this.api.aggregation) return;
      this.api.aggregation.warnings().then(function (w) {
        const n = w ? (w.length || w.warningStations || 0) : 0;
        const count = typeof n === 'number' ? n : (w && w.warnings ? w.warnings.length : 0);
        $('#alertCount').text(count);
        $('#alertPill').toggleClass('has', count > 0);
      }).catch(function () {});
    },

    setQuickStats(html) { $('#quickStats').html(html || ''); },

    toast(msg, type) {
      const t = type || 'info';
      const map = { info: 'bi-info-circle text-info', success: 'bi-check-circle text-success', warn: 'bi-exclamation-triangle text-warning', error: 'bi-x-circle text-danger' };
      const id = 't' + Date.now();
      const html = '<div id="' + id + '" class="toast align-items-center text-bg-dark border-0" role="alert">' +
        '<div class="d-flex"><div class="toast-body"><i class="bi ' + (map[t] || map.info) + ' me-2"></i>' + msg + '</div>' +
        '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>';
      $('#toastZone').append(html);
      const el = new bootstrap.Toast(document.getElementById(id), { delay: 3200 });
      el.show();
      setTimeout(function () { $('#' + id).remove(); }, 3600);
    },

    fmtTime(ts) {
      if (!ts) return '—';
      const d = new Date(ts);
      const p = function (n) { return String(n).padStart(2, '0'); };
      return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },
    fmtFull(ts) {
      if (!ts) return '—';
      const d = new Date(ts);
      const p = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    },
    fmtDate(ts) {
      if (!ts) return '—';
      const d = new Date(ts);
      const p = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    },
    countdown(deadline) {
      const diff = deadline - Date.now();
      if (diff <= 0) return { late: true, text: '已超时' };
      const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
      return { late: false, text: m + ':' + String(s).padStart(2, '0') };
    },
    statusTag(st) {
      const m = { normal: ['ok', '正常'], warning: ['warn', '超警戒'], danger: ['bad', '超保证'], pending: ['info', '待确认'], confirmed: ['ok', '已确认'], overdue: ['bad', '超时'], closed: ['mute', '已归档'], open: ['bad', '待处理'], processing: ['warn', '处理中'], done: ['ok', '已完成'] };
      const v = m[st] || ['mute', st];
      return '<span class="tag ' + v[0] + '"><span class="dot ' + v[0] + '"></span>' + v[1] + '</span>';
    },
    currentUser() { return { dispatcher: '调度员·王建国', inspector: '巡检员·张磊', admin: '管理员·钱正' }[this.role]; },

    boot() {
      const self = this;
      $('.role-switch .btn').on('click', function () { self.setRole($(this).data('role')); });
      $('.nav-tabs .nav-link').on('click', function (e) { e.preventDefault(); self.navigate($(this).data('route')); });
      $('#alertPill').on('click', function () { self.navigate('overview'); });
      $(window).on('hashchange', function () {
        const h = (location.hash || '#/overview').replace('#/', '');
        if (self.routes[h]) self.navigate(h, true);
      });
      const tick = function () {
        const d = new Date(); const p = function (n) { return String(n).padStart(2, '0'); };
        $('#clock').text(p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()));
      };
      tick(); setInterval(tick, 1000);
      setInterval(function () { self.refreshAlerts(); }, 30000);
      self.setRole('dispatcher');
      const start = (location.hash || '#/overview').replace('#/', '');
      self.navigate(self.routes[start] ? start : 'overview', true);
    }
  };

  global.App = App;
  $(function () { App.boot(); });
})(window);
