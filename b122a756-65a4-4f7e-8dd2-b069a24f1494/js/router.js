var Router = (function () {
  var routes = {};
  var current = null;
  var guards = [];
  var dirty = false;

  function parseHash() {
    var h = window.location.hash.slice(1) || '/dashboard';
    var parts = h.split('?');
    var path = parts[0];
    var query = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function (pair) {
        var kv = pair.split('=');
        query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    return { path: path, query: query };
  }

  function buildPath(path, query) {
    var qs = '';
    if (query && Object.keys(query).length) {
      qs = '?' + Object.keys(query).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]);
      }).join('&');
    }
    return '#' + path + qs;
  }

  function register(path, handler) {
    routes[path] = handler;
  }

  function beforeEach(fn) {
    guards.push(fn);
  }

  function setDirty(v) {
    dirty = !!v;
  }

  function isDirty() {
    return dirty;
  }

  function navigate(path, query) {
    window.location.hash = buildPath(path, query);
  }

  function runGuards(next) {
    var i = 0;
    function step() {
      if (i >= guards.length) { next(); return; }
      try {
        guards[i](function () { i++; step(); }, function () {});
      } catch (e) { console.error(e); i++; step(); }
    }
    step();
  }

  function fireRoute() {
    var info = parseHash();
    if (dirty) {
      if (!window.confirm('有未保存的更改，确定要离开当前页面吗？')) {
        if (current) { window.location.hash = buildPath(current.path, current.query); }
        return;
      }
      dirty = false;
    }
    runGuards(function () {
      var path = info.path;
      var route = routes[path];
      if (!route) {
        for (var p in routes) {
          if (path.indexOf(p) === 0) { route = routes[p]; break; }
        }
      }
      if (!route) {
        route = routes['/dashboard'];
        path = '/dashboard';
      }
      current = { path: path, query: info.query };
      $('.nav-link[data-route]').removeClass('active');
      var routeName = path.replace('/', '');
      $('.nav-link[data-route="' + routeName + '"]').addClass('active');
      $('#app').empty();
      var tplId = 'tpl-' + routeName;
      var tpl = document.getElementById(tplId);
      if (tpl) {
        var content = tpl.content.cloneNode(true);
        document.getElementById('app').appendChild(content);
      }
      try { route(info.query); } catch (e) { console.error('Route handler error', e); }
    });
  }

  function getCurrent() {
    return current;
  }

  function getQuery(key, def) {
    if (!current) return def;
    if (key) return current.query[key] !== undefined ? current.query[key] : def;
    return current.query;
  }

  window.addEventListener('hashchange', fireRoute);

  return {
    register: register,
    beforeEach: beforeEach,
    navigate: navigate,
    setDirty: setDirty,
    isDirty: isDirty,
    fireRoute: fireRoute,
    getCurrent: getCurrent,
    getQuery: getQuery,
    parseHash: parseHash
  };
})();
