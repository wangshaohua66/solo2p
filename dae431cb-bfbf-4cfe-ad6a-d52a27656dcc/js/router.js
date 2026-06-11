(function(global) {
  'use strict';

  const ROUTES = {
    'dashboard': { view: 'views/dashboard.html', title: '仪表盘' },
    'inventory': { view: 'views/inventory.html', title: '零件库' },
    'sets': { view: 'views/sets.html', title: '套装管理' },
    'moc': { view: 'views/moc.html', title: 'MOC 档案' },
    'auction': { view: 'views/auction.html', title: '拍卖追踪' },
    'valuation': { view: 'views/valuation.html', title: '估值分析' },
    'lug': { view: 'views/lug.html', title: '社区活动' },
    'import': { view: 'views/import.html', title: '数据导入' }
  };

  const DEFAULT_ROUTE = 'dashboard';
  const viewCache = {};

  class Router {
    constructor() {
      this.currentRoute = null;
      this.container = null;
      this._handlers = {};
    }

    init(containerId) {
      this.container = document.getElementById(containerId);
      window.addEventListener('hashchange', () => this._handleRoute());
      window.addEventListener('DOMContentLoaded', () => this._handleRoute());
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        this._handleRoute();
      }
    }

    on(route, handler) {
      this._handlers[route] = handler;
    }

    _parseHash() {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      return hash || DEFAULT_ROUTE;
    }

    async _handleRoute() {
      const route = this._parseHash();
      const routeCfg = ROUTES[route] || ROUTES[DEFAULT_ROUTE];
      const actualRoute = ROUTES[route] ? route : DEFAULT_ROUTE;

      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.route === actualRoute);
      });
      document.title = `${routeCfg.title} - BrickVault`;

      if (this.container) {
        this.container.innerHTML = `
          <div class="skeleton-loader">
            <div class="spinner-border text-lego-red" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>`;
      }

      let html = viewCache[actualRoute];
      if (!html) {
        try {
          const resp = await fetch(routeCfg.view);
          html = await resp.text();
          viewCache[actualRoute] = html;
        } catch (err) {
          html = `<div class="alert alert-danger">页面加载失败: ${err.message}</div>`;
        }
      }

      if (this.container) {
        this.container.innerHTML = html;
      }

      this.currentRoute = actualRoute;
      if (this._handlers[actualRoute]) {
        this._handlers[actualRoute]();
      }

      if (window.innerWidth < 992) {
        document.getElementById('sidebar')?.classList.remove('open');
      }
    }

    navigate(route) {
      window.location.hash = '#/' + route;
    }
  }

  global.BVRouter = new Router();
})(window);
