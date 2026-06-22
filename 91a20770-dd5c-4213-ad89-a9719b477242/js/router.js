/* router.js — 基于 hash 的前端路由，支持参数匹配与页面切换动画 */
(function (global) {
  "use strict";

  var routes = [];
  var currentPath = null;
  var beforeHooks = [];

  var Router = {
    register: function (pattern, handler) {
      var keys = [];
      var regexStr = pattern.replace(/:([^/]+)/g, function (_, key) { keys.push(key); return "([^/]+)"; });
      routes.push({ pattern: pattern, regex: new RegExp("^" + regexStr + "$"), keys: keys, handler: handler });
    },
    on: function (event, cb) { if (event === "change") beforeHooks.push(cb); },
    go: function (path) {
      if (path === currentPath) { Router._dispatch(path, true); return; }
      location.hash = path;
    },
    start: function () {
      $(global).on("hashchange", function () { Router._dispatch(Router._parse(), false); });
      var initial = Router._parse();
      if (!initial) { location.hash = "/dashboard"; return; }
      Router._dispatch(initial, false);
    },
    _parse: function () {
      var h = location.hash || "";
      if (h.indexOf("#") === 0) h = h.slice(1);
      return h || "";
    },
    _dispatch: function (path, force) {
      if (path === currentPath && !force) return;
      currentPath = path;
      for (var i = 0; i < routes.length; i++) {
        var r = routes[i];
        var match = path.match(r.regex);
        if (match) {
          var params = {};
          r.keys.forEach(function (key, idx) { params[key] = decodeURIComponent(match[idx + 1]); });
          beforeHooks.forEach(function (hk) { try { hk(path, params); } catch (e) { console.error(e); } });
          $("#appContent").removeClass("page-enter");
          void $("#appContent")[0].offsetWidth;
          try { r.handler(params); } catch (e) { console.error("路由处理错误", e); $("#appContent").html('<div class="alert alert-danger m-3">页面加载出错：' + e.message + "</div>"); }
          $("#appContent").addClass("page-enter");
          $(global).scrollTop(0);
          return;
        }
      }
      $("#appContent").html(UI.emptyState("bi-compass", "页面不存在", "请从左侧导航重新进入"));
    },
    current: function () { return currentPath; }
  };

  global.Router = Router;
})(window);
