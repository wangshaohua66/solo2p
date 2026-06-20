/* ==========================================================================
   router.js — 路由工具（基于 hash 的页面切换与历史记录）
   ========================================================================== */
(function (global) {
  'use strict';

  var Router = {
    routes: {},
    current: null,
    history: [],

    register: function (hash, meta) {
      this.routes[hash] = meta;
      return this;
    },

    start: function () {
      var self = this;
      $(global).on('hashchange', function () { self.dispatch(); });
      // 兜底：若直接打开根路径
      if (!location.hash) location.hash = '#/dashboard';
      this.dispatch();
    },

    navigate: function (hash) {
      if (location.hash === hash) {
        this.dispatch();
      } else {
        location.hash = hash;
      }
    },

    back: function () {
      if (this.history.length > 1) {
        this.history.pop();
        var prev = this.history[this.history.length - 1];
        location.hash = prev;
      } else {
        history.back();
      }
    },

    dispatch: function () {
      var hash = location.hash || '#/dashboard';
      var route = this.routes[hash] || this.routes['#/dashboard'];
      if (!route) return;
      if (this.current !== hash) {
        this.history.push(hash);
        if (this.history.length > 30) this.history.shift();
      }
      this.current = hash;
      var $main = $('#app-main');
      $main.empty();
      if (global.App && typeof global.App.renderRoute === 'function') {
        global.App.renderRoute(route, hash, $main);
      } else if (typeof route.render === 'function') {
        route.render($main);
      }
    }
  };

  global.App = global.App || {};
  global.App.Router = Router;
})(window);
