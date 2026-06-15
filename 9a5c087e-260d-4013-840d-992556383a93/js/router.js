var Router = (function () {
    var _routes = {};
    var _currentRoute = null;
    var _currentParams = {};
    var _beforeHooks = [];
    var _afterHooks = [];
    var _pageRenderers = {};
    var _pageTitles = {};
    var _pageCleanups = {};

    function _parseHash() {
        var hash = location.hash.replace(/^#/, '') || '/dashboard';
        var parts = hash.split('?');
        var path = parts[0].replace(/^\/|\/$/g, '');
        var query = {};
        if (parts[1]) {
            parts[1].split('&').forEach(function (kv) {
                var pair = kv.split('=');
                if (pair.length === 2) {
                    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                }
            });
        }
        return { path: path, query: query };
    }

    function _navigate() {
        var parsed = _parseHash();
        var pathParts = parsed.path.split('/');
        var routeName = pathParts[0] || 'dashboard';
        var routeParams = pathParts.slice(1);

        if (_beforeHooks.length) {
            var proceed = true;
            _beforeHooks.forEach(function (fn) {
                if (proceed && fn({ route: routeName, params: routeParams, query: parsed.query }, _currentRoute) === false) {
                    proceed = false;
                }
            });
            if (!proceed) return;
        }

        if (_pageCleanups[_currentRoute]) {
            try { _pageCleanups[_currentRoute](); } catch (e) { console.warn(e); }
        }

        _currentRoute = routeName;
        _currentParams = { path: routeParams, query: parsed.query };

        $('.sidebar-nav .nav-link').removeClass('active');
        $('.sidebar-nav .nav-link[data-route="' + routeName + '"]').addClass('active');

        if (_pageTitles[routeName]) {
            $('#pageTitle').text(_pageTitles[routeName]);
        }

        var $app = $('#app');
        $app.empty();
        if (_pageRenderers[routeName]) {
            var start = performance.now();
            try {
                _pageRenderers[routeName]($app, _currentParams);
            } catch (e) {
                $app.html('<div class="alert alert-danger">页面渲染错误：' + e.message + '</div>');
                console.error(e);
            }
            var elapsed = performance.now() - start;
            if (elapsed > 50) {
                console.warn('[Router] render', routeName, 'took', elapsed.toFixed(1) + 'ms');
            }
        } else {
            $app.html('<div class="text-center py-5"><h5>页面不存在</h5><a href="#/dashboard" class="btn btn-primary mt-3">返回看板</a></div>');
        }

        if (_afterHooks.length) {
            _afterHooks.forEach(function (fn) {
                fn({ route: routeName, params: routeParams, query: parsed.query });
            });
        }
    }

    function register(name, renderer, options) {
        options = options || {};
        _pageRenderers[name] = renderer;
        if (options.title) _pageTitles[name] = options.title;
        if (options.cleanup) _pageCleanups[name] = options.cleanup;
        _routes[name] = true;
    }

    function beforeEach(fn) {
        _beforeHooks.push(fn);
    }

    function afterEach(fn) {
        _afterHooks.push(fn);
    }

    function go(name, params) {
        var path = '/' + name;
        if (params && params.path) {
            path += '/' + params.path.join('/');
        }
        if (params && params.query && Object.keys(params.query).length) {
            path += '?' + Object.keys(params.query).map(function (k) {
                return encodeURIComponent(k) + '=' + encodeURIComponent(params.query[k]);
            }).join('&');
        }
        location.hash = path;
    }

    function getCurrent() {
        return { route: _currentRoute, params: _currentParams };
    }

    function start() {
        $(window).on('hashchange', _navigate);
        if (!location.hash) {
            location.hash = '/dashboard';
        } else {
            _navigate();
        }
    }

    return {
        register: register,
        beforeEach: beforeEach,
        afterEach: afterEach,
        go: go,
        getCurrent: getCurrent,
        start: start
    };
})();
