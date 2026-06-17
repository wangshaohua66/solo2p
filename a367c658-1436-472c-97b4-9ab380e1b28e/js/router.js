var AppRouter = (function() {
  'use strict';

  var routes = {};
  var currentRoute = null;
  var notFoundHandler = null;
  var beforeHooks = [];
  var afterHooks = [];

  function parseHash(hash) {
    hash = hash || window.location.hash || '#/dashboard';
    hash = hash.replace(/^#/, '');
    if (!hash) hash = '/dashboard';
    var parts = hash.split('?');
    var path = parts[0];
    var query = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function(kv) {
        var p = kv.split('=');
        if (p.length === 2) query[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
      });
    }
    return { path: path, query: query };
  }

  function matchRoute(path) {
    var pathParts = path.split('/').filter(Boolean);
    var candidates = Object.keys(routes);
    for (var i = 0; i < candidates.length; i++) {
      var pattern = candidates[i];
      var pattParts = pattern.split('/').filter(Boolean);
      if (pattParts.length !== pathParts.length) continue;
      var params = {};
      var matched = true;
      for (var j = 0; j < pattParts.length; j++) {
        if (pattParts[j].indexOf(':') === 0) {
          params[pattParts[j].slice(1)] = decodeURIComponent(pathParts[j]);
        } else if (pattParts[j] !== pathParts[j]) {
          matched = false;
          break;
        }
      }
      if (matched) return { handler: routes[pattern], params: params, pattern: pattern };
    }
    return null;
  }

  function setActiveNav(path) {
    $('.nav-route').each(function() {
      var $a = $(this);
      var route = ($a.attr('data-route') || '').replace(/^#/, '');
      var currentTop = '/' + (path.split('/').filter(Boolean)[0] || '');
      $a.removeClass('active text-white');
      $a.addClass('text-white-50');
      if (route && path.indexOf(route) === 0) {
        $a.addClass('active text-white');
        $a.removeClass('text-white-50');
      }
    });
  }

  function handleRoute() {
    var info = parseHash(window.location.hash);
    var match = matchRoute(info.path);

    var ctx = {
      path: info.path,
      query: info.query,
      params: match ? match.params : {},
      pattern: match ? match.pattern : null
    };

    var proceed = true;
    for (var i = 0; i < beforeHooks.length; i++) {
      try {
        if (beforeHooks[i](ctx) === false) { proceed = false; break; }
      } catch (e) { console.error('[Router] before hook error', e); }
    }
    if (!proceed) return;

    var $app = $('#app');
    $app.removeClass('page-enter');
    void $app[0].offsetWidth;
    $app.html('<div class="skeleton" style="height: 80vh; border-radius: 10px;"></div>');
    $app.addClass('page-enter');

    setActiveNav(info.path);

    setTimeout(function() {
      try {
        if (match && typeof match.handler === 'function') {
          match.handler(ctx, $app);
        } else if (notFoundHandler) {
          notFoundHandler(ctx, $app);
        } else {
          $app.html('<div class="card p-5 text-center"><h3 class="text-herb-red mb-3">页面未找到</h3><p class="text-muted">路径：' + info.path + '</p><a class="btn btn-herb mt-2" href="#/dashboard"><i class="bi bi-house me-1"></i>返回首页</a></div>');
        }
        currentRoute = ctx;
        $(window).trigger('route:changed', [ctx]);
      } catch (e) {
        console.error('[Router] handler error', e);
        $app.html('<div class="card p-5 text-center"><h3 class="text-herb-red mb-3">页面渲染错误</h3><p class="text-muted small">' + String(e.message || e) + '</p><a class="btn btn-herb mt-2" href="#/dashboard">返回首页</a></div>');
      }
      for (var j = 0; j < afterHooks.length; j++) {
        try { afterHooks[j](ctx); } catch (e) { console.error('[Router] after hook error', e); }
      }
    }, 80);
  }

  function on(pattern, handler) {
    if (pattern instanceof RegExp) {
      routes[pattern.toString()] = handler;
    } else {
      if (pattern.indexOf('/') !== 0) pattern = '/' + pattern;
      routes[pattern] = handler;
    }
  }

  function navigate(path, opts) {
    if (path && path.indexOf('#') !== 0) path = '#' + path;
    if (opts && opts.replace) {
      window.location.replace(path);
    } else {
      window.location.hash = path;
    }
  }

  function before(fn) { if (typeof fn === 'function') beforeHooks.push(fn); }
  function after(fn) { if (typeof fn === 'function') afterHooks.push(fn); }
  function notFound(fn) { notFoundHandler = fn; }

  function init(opts) {
    $(window).on('hashchange', handleRoute);
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = '#/dashboard';
    } else {
      handleRoute();
    }
  }

  return {
    init: init,
    on: on,
    before: before,
    after: after,
    navigate: navigate,
    notFound: notFound,
    parse: parseHash,
    current: function() { return currentRoute; }
  };
})();

var Toast = (function() {
  'use strict';

  function show(msg, opts) {
    opts = opts || {};
    var type = opts.type || 'success';
    var title = opts.title || '';
    var duration = opts.duration || 2800;
    var id = 't_' + Date.now() + Math.random().toString(36).slice(2, 6);
    var iconMap = {
      success: '<i class="bi bi-check-circle-fill text-success me-2"></i>',
      warning: '<i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>',
      danger:  '<i class="bi bi-x-circle-fill text-danger me-2"></i>',
      info:    '<i class="bi bi-info-circle-fill text-info me-2"></i>'
    };
    var icons = ['bi-check-circle-fill','bi-exclamation-triangle-fill','bi-x-circle-fill','bi-info-circle-fill'];
    var $toast = $('<div class="toast ' + type + ' fade show" id="' + id + '" role="alert">'
      + '<div class="toast-header bg-white border-0 pb-0">'
      + '<span class="me-auto fw-bold small" style="font-family:var(--font-serif)">'
      + (iconMap[type] || '') + (title || {success:'操作成功',warning:'提示',danger:'错误',info:'信息'}[type])
      + '</span><button type="button" class="btn-close btn-close-white-sm" data-bs-dismiss="toast"></button></div>'
      + '<div class="toast-body pt-1 small" style="color:#333">' + msg + '</div></div>');
    $('#toastContainer').append($toast);
    $toast.css({ opacity: 0, transform: 'translateY(10px)' });
    $toast[0].offsetHeight;
    $toast.css({ transition: 'all .3s ease', opacity: 1, transform: 'translateY(0)' });
    setTimeout(function() {
      $toast.css({ opacity: 0, transform: 'translateY(10px)' });
      setTimeout(function() { $toast.remove(); }, 350);
    }, duration);
  }
  return {
    show: show,
    success: function(m, t) { return show(m, { type: 'success', title: t }); },
    warning: function(m, t) { return show(m, { type: 'warning', title: t }); },
    danger:  function(m, t) { return show(m, { type: 'danger',  title: t }); },
    info:    function(m, t) { return show(m, { type: 'info',    title: t }); }
  };
})();

function formatDate(ts, fmt) {
  fmt = fmt || 'YYYY-MM-DD';
  var d = ts instanceof Date ? ts : new Date(ts);
  var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
  return fmt.replace('YYYY', d.getFullYear())
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()));
}

function relativeTime(ts) {
  var diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 30 * 86400000) return Math.floor(diff / 86400000) + '天前';
  return formatDate(ts);
}
