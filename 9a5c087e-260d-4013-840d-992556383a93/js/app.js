var App = (function () {
    var _alertOffcanvas = null;
    var _unsubs = [];

    function showToast(type, title, message, delay) {
        delay = delay || 3500;
        var typeMap = {
            success: { bg: 'bg-success', icon: 'bi-check-circle-fill' },
            danger: { bg: 'bg-danger', icon: 'bi-x-circle-fill' },
            warning: { bg: 'bg-warning text-dark', icon: 'bi-exclamation-triangle-fill' },
            info: { bg: 'bg-info text-dark', icon: 'bi-info-circle-fill' },
            primary: { bg: 'bg-primary', icon: 'bi-info-circle-fill' }
        };
        var t = typeMap[type] || typeMap.info;
        var id = 'toast_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        var html = '<div class="toast text-white ' + t.bg + ' border-0 shadow" id="' + id + '" role="alert">'
            + '<div class="d-flex"><div class="toast-body d-flex gap-2 align-items-start">'
            + '<i class="bi ' + t.icon + ' mt-0.5"></i>'
            + '<div><strong class="d-block">' + title + '</strong>'
            + '<div class="small opacity-90">' + (message || '') + '</div></div></div>'
            + '<button type="button" class="btn-close btn-close-white me-2 m-auto align-self-start" data-bs-dismiss="toast"></button>'
            + '</div></div></div>';
        $('#toastContainer').append(html);
        var toastEl = document.getElementById(id);
        var toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: delay, autohide: true });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', function () { $(toastEl).remove(); });
    }

    function _applyResponseLevel(level) {
        if (!level) return;
        var map = {
            'I': { cls: 'response-level-I', text: 'Ⅰ级响应（特别重大）' },
            'II': { cls: 'response-level-II', text: 'Ⅱ级响应（重大）' },
            'III': { cls: 'response-level-III', text: 'Ⅲ级响应（较大）' },
            'IV': { cls: 'response-level-IV', text: 'Ⅳ级响应（一般）' }
        };
        var cfg = map[level] || map['IV'];
        $('body').removeClass('response-level-I response-level-II response-level-III response-level-IV').addClass(cfg.cls);
        $('#responseLevelText').text(cfg.text.split('（')[0]);
        $('.response-level-item').removeClass('active');
        $('.response-level-item[data-level="' + level + '"]').addClass('active');
    }

    function _renderAlertList(alerts) {
        alerts = alerts || Store.get('alerts') || [];
        var unread = alerts.filter(function (a) { return a.unread; }).length;
        $('#alertBadge').text(unread);

        if (!alerts.length) {
            $('#alertList').html('<div class="text-center text-muted py-5 small">暂无告警</div>');
            return;
        }

        var html = '<div class="p-2 bg-light border-bottom d-flex justify-content-between align-items-center small">'
            + '<span>共 ' + alerts.length + ' 条，未读 ' + unread + ' 条</span>'
            + (unread > 0 ? '<button class="btn btn-sm btn-outline-secondary" id="markAllReadBtn">全部已读</button>' : '')
            + '</div>';

        alerts.forEach(function (a) {
            var levelClass = a.level === 'danger' ? 'danger' : a.level === 'warning' ? 'warning' : '';
            var unreadClass = a.unread ? ' unread' : '';
            html += '<div class="alert-item ' + levelClass + unreadClass + '" data-id="' + a.id + '">'
                + '<div class="d-flex gap-2 align-items-start">'
                + '<i class="bi ' + (a.icon || 'bi-bell') + ' mt-0.5 '
                + (a.level === 'danger' ? 'text-danger' : a.level === 'warning' ? 'text-warning' : 'text-info') + '"></i>'
                + '<div class="flex-grow-1 min-w-0">'
                + '<div class="d-flex justify-content-between align-items-start">'
                + '<div class="fw-bold small">' + a.title + '</div>'
                + '<small class="text-muted ms-2 flex-shrink-0">' + a.time.split(' ')[1].slice(0, 5) + '</small>'
                + '</div>'
                + '<div class="small mt-1">' + a.content + '</div>'
                + (a.unread ? '<span class="badge rounded-pill bg-danger mt-1" style="font-size:9px;">NEW</span>' : '')
                + '</div></div></div>';
        });

        $('#alertList').html(html);

        $('#markAllReadBtn').on('click', function () {
            Store.markAllAlertsRead();
            showToast('success', '操作成功', '所有告警已标记为已读');
        });

        $('#alertList .alert-item').on('click', function () {
            var id = $(this).data('id');
            Store.markAlertRead(id);
            var alertData = alerts.find(function (x) { return x.id === id; });
            if (alertData && alertData.relatedId) {
                _alertOffcanvas.hide();
                Router.go('dashboard');
                setTimeout(function () {
                    if (typeof DashboardPage !== 'undefined') {
                        var privateRender = null;
                        try {
                            var fps = Store.get('floodPoints') || [];
                            var fp = fps.find(function (f) { return f.id === alertData.relatedId; });
                            if (fp) {
                                $('#floodPointModal').length && (function () {
                                    var ev = new $.Event('click');
                                    var $fp = $('[data-id="' + fp.id + '"]');
                                    if ($fp.length) $fp.trigger('click');
                                })();
                            }
                        } catch (e) { }
                    }
                }, 300);
            }
        });
    }

    function _initSidebar() {
        $('#toggleSidebar').on('click', function () {
            var $sb = $('#sidebar');
            $sb.toggleClass('collapsed');
            var collapsed = $sb.hasClass('collapsed');
            $(this).find('.sidebar-text').text(collapsed ? '展开菜单' : '收起菜单');
            setTimeout(function () {
                $(window).trigger('resize');
            }, 350);
        });

        $('#mobileMenuBtn').on('click', function () {
            var $sb = $('#sidebar');
            $sb.toggleClass('mobile-open');
            if ($sb.hasClass('mobile-open')) {
                if (!$('.sidebar-backdrop').length) {
                    $('body').append('<div class="sidebar-backdrop"></div>');
                }
            } else {
                $('.sidebar-backdrop').remove();
            }
        });

        $(document).on('click', '.sidebar-backdrop', function () {
            $('#sidebar').removeClass('mobile-open');
            $(this).remove();
        });
    }

    function _initResponseLevel() {
        var resp = Store.get('response') || {};
        _applyResponseLevel(resp.response || 'IV');

        $('.response-level-item').on('click', function (e) {
            e.preventDefault();
            var level = $(this).data('level');
            Store.setResponseLevel(level);
            showToast(
                level === 'I' ? 'danger' : level === 'II' ? 'warning' : 'info',
                '响应等级已调整',
                '当前防汛应急响应等级：' + { I: 'Ⅰ级（特别重大）', II: 'Ⅱ级（重大）', III: 'Ⅲ级（较大）', IV: 'Ⅳ级（一般）' }[level]
            );
        });

        _unsubs.push(Store.on('response', function (data) {
            _applyResponseLevel(data && data.response);
        }));
    }

    function _initAlerts() {
        _alertOffcanvas = new bootstrap.Offcanvas(document.getElementById('alertDrawer'));

        $('#alertDrawerBtn').on('click', function () {
            _renderAlertList();
            _alertOffcanvas.show();
        });

        _unsubs.push(Store.on('alerts', function (alerts) {
            _renderAlertList(alerts);
            if (_alertOffcanvas && _alertOffcanvas._isShown) {
                _renderAlertList(alerts);
            }
        }));

        _unsubs.push(Store.on('newAlert', function (alert) {
            $('#alertDrawer').addClass('drawer-pulse');
            setTimeout(function () { $('#alertDrawer').removeClass('drawer-pulse'); }, 1200);
            if (alert.level === 'danger') {
                showToast('danger', alert.title, alert.content, 5000);
            } else if (alert.level === 'warning') {
                showToast('warning', alert.title, alert.content, 4000);
            }
        }));

        _renderAlertList();
    }

    function _initStorageMultiTab() {
        try {
            window.addEventListener('storage', function (e) {
                if (e.key === 'flood_store_v1' && e.newValue && e.newValue !== e.oldValue) {
                    showToast('info', '状态同步', '检测到其他标签页更新，正在同步状态...');
                }
            });
        } catch (e) { }
    }

    function _simulateRealTimeEvents() {
        setInterval(function () {
            if (Math.random() < 0.12) {
                var reasons = ['水位监测告警', '自动巡查告警', '泵站运行异常', '气象预警升级', '群众来电报告'];
                var pick = MockData.DANGER_TYPES[Math.floor(Math.random() * MockData.DANGER_TYPES.length)];
                var fpName = MockData.FLOOD_AREA_NAMES ? MockData.FLOOD_AREA_NAMES[Math.floor(Math.random() * MockData.FLOOD_AREA_NAMES.length)] : '未知点位';
                Store.addAlert({
                    type: Math.random() < 0.35 ? 'danger' : 'warning',
                    title: pick,
                    content: fpName + ' 触发 ' + reasons[Math.floor(Math.random() * reasons.length)] + '，请关注',
                    relatedId: 'FP' + String(Math.floor(Math.random() * 86) + 1).padStart(3, '0')
                });
            }
        }, 18000);

        setInterval(function () {
            var teams = Store.get('teams') || [];
            teams.forEach(function (t) {
                if (t.status === 'working' && t.progress < 80 && Math.random() < 0.55) {
                    var newProgress = Math.min(80, t.progress + Math.floor(Math.random() * 12 + 3));
                    Store.updateTeamProgress(t.id, newProgress);
                } else if (t.status === 'busy' && t.progress < 100 && Math.random() < 0.7) {
                    var np = Math.min(100, t.progress + Math.floor(Math.random() * 8 + 2));
                    Store.updateTeamProgress(t.id, np);
                }
            });
        }, 12000);
    }

    function init() {
        console.time('[App] init');
        Store.init();
        _initSidebar();
        _initResponseLevel();
        _initAlerts();
        _initStorageMultiTab();
        Router.start();
        _simulateRealTimeEvents();

        console.timeEnd('[App] init');
        setTimeout(function () {
            showToast('success', '系统就绪', '防汛抗旱指挥部监测看板已启动，共加载 '
                + (Store.get('floodPoints') || []).length + ' 处易涝点数据');
        }, 600);
    }

    $(document).ready(init);

    return {
        showToast: showToast
    };
})();
