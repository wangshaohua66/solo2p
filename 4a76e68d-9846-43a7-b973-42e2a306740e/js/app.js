var App = window.App = (function () {
    const state = {
        user: null,
        storeId: null,
        storeName: '',
        route: 'dashboard'
    };

    const ROLE_LABELS = {
        manager: '店长',
        nursing_supervisor: '护理主管',
        nurse: '护士',
        nutritionist: '营养师',
        rehab: '康复师',
        confinement_nurse: '月嫂'
    };

    const ROLE_ICONS = {
        manager: 'bi-person-badge',
        nursing_supervisor: 'bi-clipboard2-pulse',
        nurse: 'bi-nurse',
        nutritionist: 'bi-cup-straw',
        rehab: 'bi-heart-pulse',
        confinement_nurse: 'bi-person-heart'
    };

    const routes = {
        'dashboard': { module: 'Booking', method: 'render', label: '房态看板' },
        'nursing': { module: 'Nursing', method: 'render', label: '护理排班' },
        'meal': { module: 'Meal', method: 'render', label: '月子餐管理' },
        'visitor': { module: 'Visitor', method: 'render', label: '探视登记' },
        'rehab': { module: 'Rehab', method: 'render', label: '康复预约' },
        'report': { module: 'Report', method: 'render', label: '运营报表' }
    };

    function init() {
        Store.init().then(function () {
            return Store.getStores();
        }).then(function (stores) {
            populateStoreSelectors(stores);
            const savedUser = localStorage.getItem('mc_user');
            if (savedUser) {
                state.user = JSON.parse(savedUser);
                state.storeId = localStorage.getItem('mc_storeId') || stores[0].id;
                state.storeName = (stores.find(function (s) { return s.id === state.storeId; }) || stores[0]).name;
                showApp();
                navigateToRoute();
            } else {
                showLogin();
            }
            bindEvents();
            updateDateDisplay();
            setInterval(updateDateDisplay, 60000);
        }).catch(function (err) {
            console.error('初始化失败:', err);
            showToast('系统初始化失败，请刷新重试', 'danger');
        });
    }

    function populateStoreSelectors(stores) {
        const options = stores.map(function (s) {
            return '<option value="' + s.id + '">' + s.name + '</option>';
        }).join('');
        $('#login-store').html(options);
        $('#navbar-store-selector').html(options);
    }

    function showLogin() {
        $('#login-view').show();
        $('#app-shell').addClass('d-none');
    }

    function showApp() {
        $('#login-view').hide();
        $('#app-shell').removeClass('d-none');
        updateUserDisplay();
        $('#navbar-store-selector').val(state.storeId);
    }

    function updateUserDisplay() {
        if (!state.user) return;
        $('#user-name').text(state.user.name);
        $('#user-role').text(ROLE_LABELS[state.user.role] || state.user.role);
        $('#user-avatar').text(state.user.name.charAt(0));
    }

    function updateDateDisplay() {
        const now = new Date();
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + weekdays[now.getDay()];
        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        $('#navbar-date').html('<i class="bi bi-clock me-1"></i>' + dateStr + ' <span class="text-primary-pink fw-medium">' + timeStr + '</span>');
    }

    function bindEvents() {
        $('#login-form').on('submit', function (e) {
            e.preventDefault();
            handleLogin();
        });

        $('#logout-btn').on('click', function (e) {
            e.preventDefault();
            handleLogout();
        });

        $('#sidebar-toggle').on('click', toggleSidebar);

        $('#sidebar-overlay').on('click', function () {
            $('#app-sidebar').removeClass('show');
            $('#sidebar-overlay').removeClass('show');
        });

        $('#navbar-store-selector').on('change', function () {
            state.storeId = $(this).val();
            Store.getStores().then(function (stores) {
                const s = stores.find(function (st) { return st.id === state.storeId; });
                state.storeName = s ? s.name : '';
            });
            localStorage.setItem('mc_storeId', state.storeId);
            navigateToRoute();
        });

        $('.sidebar-item').on('click', function () {
            if ($(window).width() <= 1024) {
                $('#app-sidebar').removeClass('show');
                $('#sidebar-overlay').removeClass('show');
            }
        });

        $(window).on('hashchange', navigateToRoute);
    }

    function toggleSidebar() {
        const $sidebar = $('#app-sidebar');
        const $main = $('#app-main');
        if ($(window).width() <= 1024) {
            $sidebar.toggleClass('show');
            $('#sidebar-overlay').toggleClass('show');
        } else {
            $sidebar.toggleClass('collapsed');
            $main.toggleClass('sidebar-collapsed');
        }
    }

    function handleLogin() {
        const empId = $('#login-empId').val().trim();
        const password = $('#login-password').val().trim();
        const storeId = $('#login-store').val();
        const remember = $('#remember-me').is(':checked');

        if (!empId || !password) {
            showToast('请输入工号和密码', 'warning');
            return;
        }

        Store.login(empId, password).then(function (result) {
            if (result.success) {
                state.user = result.user;
                state.storeId = storeId;
                Store.getStores().then(function (stores) {
                    const s = stores.find(function (st) { return st.id === storeId; });
                    state.storeName = s ? s.name : '';
                });
                if (remember) {
                    localStorage.setItem('mc_user', JSON.stringify(result.user));
                    localStorage.setItem('mc_storeId', storeId);
                }
                showApp();
                window.location.hash = '#/dashboard';
                navigateToRoute();
                showToast('登录成功，欢迎回来！', 'success');
            } else {
                showToast(result.message, 'danger');
            }
        }).catch(function (err) {
            showToast('登录失败，请重试', 'danger');
        });
    }

    function handleLogout() {
        localStorage.removeItem('mc_user');
        localStorage.removeItem('mc_storeId');
        state.user = null;
        state.storeId = null;
        showLogin();
        showToast('已安全退出', 'info');
    }

    function navigateToRoute() {
        const hash = window.location.hash.replace('#/', '') || 'dashboard';
        state.route = hash in routes ? hash : 'dashboard';

        if (!state.user) {
            showLogin();
            return;
        }

        $('.sidebar-item').removeClass('active');
        $('.sidebar-item[data-route="' + state.route + '"]').addClass('active');

        $('#content-loading').removeClass('hidden');
        $('#app-content').empty();

        const routeConfig = routes[state.route];
        if (routeConfig && window[routeConfig.module] && typeof window[routeConfig.module][routeConfig.method] === 'function') {
            setTimeout(function () {
                try {
                    window[routeConfig.module][routeConfig.method]();
                    $('#content-loading').addClass('hidden');
                } catch (err) {
                    console.error('模块渲染错误:', err);
                    $('#content-loading').addClass('hidden');
                    $('#app-content').html('<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>页面加载失败：' + (err.message || '未知错误') + '</p></div>');
                }
            }, 100);
        } else {
            $('#content-loading').addClass('hidden');
            $('#app-content').html('<div class="empty-state"><i class="bi bi-exclamation-circle"></i><p>未找到页面模块</p></div>');
        }
    }

    function showToast(message, type) {
        type = type || 'info';
        const icons = {
            success: 'bi-check-circle-fill',
            warning: 'bi-exclamation-triangle-fill',
            danger: 'bi-x-circle-fill',
            info: 'bi-info-circle-fill'
        };
        const toast = '<div class="toast-pink ' + type + '">' +
            '<i class="bi ' + (icons[type] || icons.info) + ' toast-icon"></i>' +
            '<span class="toast-message">' + message + '</span>' +
            '</div>';
        $('#toast-container').append(toast);
        setTimeout(function () {
            $(toast).fadeOut(300, function () { $(this).remove(); });
        }.bind(toast), 3500);
    }

    function showGlobalModal(title, bodyHtml, footerHtml, onShow) {
        const modalHtml =
            '<div class="modal-dialog modal-lg modal-dialog-centered">' +
            '<div class="modal-content">' +
            '<div class="modal-header">' +
            '<h5 class="modal-title">' + title + '</h5>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
            '</div>' +
            '<div class="modal-body">' + bodyHtml + '</div>' +
            (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') +
            '</div>' +
            '</div>';
        $('#global-modal').html(modalHtml);
        const modal = new bootstrap.Modal($('#global-modal')[0]);
        modal.show();
        if (onShow && typeof onShow === 'function') {
            $('#global-modal').one('shown.bs.modal', onShow);
        }
        return modal;
    }

    function closeModal() {
        bootstrap.Modal.getInstance($('#global-modal')[0])?.hide();
    }

    function renderPageHeader(icon, title, subtitle, actionsHtml) {
        return '<div class="page-header fade-in">' +
            '<div class="page-title">' +
            '<div class="page-title-icon"><i class="bi ' + icon + '"></i></div>' +
            '<div><h2>' + title + '</h2><p>' + (subtitle || '') + '</p></div>' +
            '</div>' +
            (actionsHtml ? '<div class="page-actions d-flex gap-2">' + actionsHtml + '</div>' : '') +
            '</div>';
    }

    function getRoleLabel(role) {
        return ROLE_LABELS[role] || role;
    }

    function getRoleIcon(role) {
        return ROLE_ICONS[role] || 'bi-person';
    }

    return {
        state: state,
        ROLE_LABELS: ROLE_LABELS,
        init: init,
        navigateToRoute: navigateToRoute,
        showToast: showToast,
        showGlobalModal: showGlobalModal,
        closeModal: closeModal,
        renderPageHeader: renderPageHeader,
        getRoleLabel: getRoleLabel,
        getRoleIcon: getRoleIcon
    };
})();
