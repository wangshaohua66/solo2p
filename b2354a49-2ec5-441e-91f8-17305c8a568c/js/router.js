(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    var currentPageName = null;
    var $pageContainer = null;

    var pageMap = {
        reception: { title: '前台接待', icon: 'bi-reception-4', page: 'reception' },
        groomer:   { title: '美容师工作台', icon: 'bi-scissors', page: 'groomer' },
        schedule:  { title: '排班管理', icon: 'bi-calendar-week', page: 'schedule' },
        member:    { title: '会员管理', icon: 'bi-credit-card-2-front', page: 'member' },
        pets:      { title: '宠物档案', icon: 'bi-heart', page: 'pets' },
        checkout:  { title: '收银结算', icon: 'bi-cash-coin', page: 'checkout' },
        dashboard: { title: '经营看板', icon: 'bi-graph-up', page: 'dashboard' },
        settings:  { title: '系统设置', icon: 'bi-gear', page: 'settings' }
    };

    function parseHash(hash) {
        if (!hash || hash === '#/' || hash === '#') {
            return { name: 'reception', params: {}, query: {} };
        }
        var clean = hash.replace(/^#\/?/, '');
        var qIdx = clean.indexOf('?');
        var query = {};
        var path = clean;
        if (qIdx >= 0) {
            path = clean.substring(0, qIdx);
            var qStr = clean.substring(qIdx + 1);
            qStr.split('&').forEach(function(pair) {
                var parts = pair.split('=');
                if (parts.length === 2) {
                    query[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
                }
            });
        }
        var segs = path.split('/').filter(Boolean);
        var name = segs[0] || 'reception';
        var params = {};
        segs.slice(1).forEach(function(seg, i) { params['p' + (i + 1)] = seg; });
        return { name: name, params: params, query: query };
    }

    function navigate(path) {
        location.hash = '#/' + (path.replace(/^\//, ''));
    }

    function setActiveMenu(routeName) {
        $('.sidebar-link').removeClass('active');
        $('.sidebar-link[data-route="/' + routeName + '"]').addClass('active');
    }

    function showPage(name, params, query) {
        var routeInfo = pageMap[name];
        if (!routeInfo) {
            showNotFound();
            return;
        }

        $pageContainer.css('opacity', 0);

        if (currentPageName && App.pages[currentPageName] && typeof App.pages[currentPageName].unbind === 'function') {
            try { App.pages[currentPageName].unbind(); } catch(e) { console.warn(e); }
        }

        currentPageName = routeInfo.page;
        document.title = (routeInfo.title || '萌宠乐美') + ' - 萌宠乐美 连锁宠物美容管理系统';
        setActiveMenu(name);

        var renderer = App.pages[routeInfo.page] && App.pages[routeInfo.page].render;
        if (!renderer) {
            showNotFound();
            return;
        }

        try {
            var html = renderer(Object.assign({}, params, query));
            $pageContainer.html(html);
        } catch(err) {
            console.error(err);
            $pageContainer.html('<div class="alert alert-danger"><h5>页面渲染失败</h5><pre>' + err.message + '</pre></div>');
        }

        var start;
        function step(timestamp) {
            if (!start) start = timestamp;
            var progress = Math.min((timestamp - start) / 300, 1);
            progress = 1 - Math.pow(1 - progress, 3);
            $pageContainer.css('opacity', progress);
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);

        setTimeout(function() {
            var binder = App.pages[routeInfo.page] && App.pages[routeInfo.page].bind;
            if (binder) {
                try { binder(Object.assign({}, params, query)); } catch(e) { console.error('Bind error', e); }
            }
        }, 50);
    }

    function showNotFound() {
        $pageContainer.html(
            '<div class="card shadow-sm p-5 text-center">' +
            '<div class="display-1 text-muted">404</div>' +
            '<h4 class="text-muted mb-3">页面未找到</h4>' +
            '<button class="btn btn-primary" onclick="location.hash=\'#/reception\'">返回前台</button>' +
            '</div>'
        );
        $pageContainer.css('opacity', 1);
    }

    function init() {
        $pageContainer = $('#pageContainer');

        var onRoute = function() {
            var info = parseHash(location.hash);
            showPage(info.name, info.params, info.query);
        };

        $(window).on('hashchange', onRoute);

        if (!location.hash) {
            location.hash = '#/reception';
        } else {
            onRoute();
        }

        if ($.router && typeof $.router.init === 'function') {
            try { $.router.init(); } catch(e) {}
        }

        $pageContainer.on('transitionend', function(e) {
            if (e.target === $pageContainer[0]) {
                $pageContainer.removeAttr('style');
            }
        });
    }

    App.router = {
        init: init,
        navigate: navigate,
        parseHash: parseHash
    };

})(typeof window !== 'undefined' ? window : this);
