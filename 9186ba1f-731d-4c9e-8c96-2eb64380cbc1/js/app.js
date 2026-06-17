const App = (function() {
    const routes = {
        'dashboard': DashboardPage,
        'vehicle': VehiclePage,
        'order': OrderPage,
        'package': PackagePage,
        'member': MemberPage,
        'statistics': StatisticsPage
    };

    let currentRoute = null;

    function init() {
        const startTime = performance.now();

        if (!Helpers.storageAvailable('localStorage')) {
            alert('您的浏览器不支持LocalStorage，请更换浏览器后再试');
            return;
        }

        DataStore.init();

        if (!DataStore.hasData()) {
            Helpers.showLoading(true, '正在初始化演示数据...');
            setTimeout(() => {
                const initialData = MockData.generateMockData();
                DataStore.loadInitialData(initialData);
                Helpers.showLoading(false);
                completeInitialization(startTime);
            }, 500);
        } else {
            DataStore.buildIndexes();
            completeInitialization(startTime);
        }
    }

    function completeInitialization(startTime) {
        initStoreDropdown();
        initSystemMenu();
        initPageModules();
        setupRouteListener();
        updateTodayRevenue();
        updateStorageInfo();

        if (!location.hash) {
            location.hash = '#/dashboard';
        } else {
            handleRoute();
        }

        setInterval(updateTodayRevenue, 60000);
        setInterval(updateStorageInfo, 30000);

        const loadTime = performance.now() - startTime;
        if (loadTime > 2000) {
            console.warn('Page load took', loadTime, 'ms, exceeds 2s limit');
        } else {
            console.log('Page loaded in', loadTime.toFixed(0), 'ms');
        }
    }

    function initPageModules() {
        Object.values(routes).forEach(page => {
            if (typeof page.init === 'function') {
                page.init();
            }
        });
    }

    function setupRouteListener() {
        $(window).off('hashchange').on('hashchange', handleRoute);
    }

    function handleRoute() {
        const hash = location.hash.slice(2) || 'dashboard';
        const [routeName, queryString] = hash.split('?');

        const params = {};
        if (queryString) {
            queryString.split('&').forEach(pair => {
                const [key, value] = pair.split('=');
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            });
        }

        const route = routes[routeName];
        if (route) {
            updateActiveNav(routeName);

            const sidebar = bootstrap.Offcanvas.getInstance(document.getElementById('sidebar'));
            if (sidebar) {
                sidebar.hide();
            }

            currentRoute = routeName;

            if (typeof route.render === 'function') {
                route.render(params);
            }
        } else {
            location.hash = '#/dashboard';
        }
    }

    function updateActiveNav(routeName) {
        $('#sidebarNav .nav-link').removeClass('active');
        $('#sidebarNav .nav-link[data-route="' + routeName + '"]').addClass('active');
    }

    function initStoreDropdown() {
        const stores = Helpers.getStores();
        const currentStore = DataStore.getCurrentStore();
        const currentStoreData = stores.find(s => s.id === currentStore) || stores[0];

        $('#currentStoreName').text(currentStoreData.name);

        let html = '';
        stores.forEach(store => {
            const active = store.id === currentStore ? 'active' : '';
            html += `<li><a class="dropdown-item ${active}" href="#" data-store="${store.id}">
                <i class="bi bi-shop me-2"></i>${store.name}
                <small class="d-block text-muted">${store.address}</small>
            </a></li>`;
        });

        $('#storeDropdown').html(html);

        $('#storeDropdown .dropdown-item').on('click', function(e) {
            e.preventDefault();
            const storeId = $(this).data('store');
            switchStore(storeId);
        });
    }

    function switchStore(storeId) {
        DataStore.setCurrentStore(storeId);
        initStoreDropdown();
        updateTodayRevenue();
        if (currentRoute && routes[currentRoute]) {
            routes[currentRoute].render();
        }
        Helpers.showToast('已切换到' + Helpers.getStores().find(s => s.id === storeId).name, 'success');
    }

    function updateTodayRevenue() {
        const storeId = DataStore.getCurrentStore();
        const todayStats = StatisticsService.getDailyRevenue(null, storeId);
        $('#todayRevenueBadge').text(Helpers.formatCurrency(todayStats.totalRevenue));
    }

    function updateStorageInfo() {
        const size = DataStore.getStorageSize();
        const maxSize = 5 * 1024 * 1024;
        const percent = Math.min((size / maxSize) * 100, 100);
        const sizeMB = (size / 1024 / 1024).toFixed(2);

        $('#storageProgress').css('width', percent + '%');
        $('#storageInfo').text(sizeMB + ' MB / 5 MB');

        if (percent > 90) {
            $('#storageProgress').addClass('bg-danger');
        } else if (percent > 70) {
            $('#storageProgress').addClass('bg-warning').removeClass('bg-danger');
        } else {
            $('#storageProgress').removeClass('bg-danger bg-warning');
        }
    }

    function initSystemMenu() {
        $('#btnExportBackup').on('click', function(e) {
            e.preventDefault();
            exportBackup();
        });

        $('#btnImportBackup').on('click', function(e) {
            e.preventDefault();
            $('#backupFileInput').click();
        });

        $('#backupFileInput').on('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                importBackup(file);
            }
            $(this).val('');
        });

        $('#btnClearData').on('click', function(e) {
            e.preventDefault();
            clearAllData();
        });
    }

    function exportBackup() {
        Helpers.showConfirm('确定要导出所有数据备份吗？', '导出备份').then(confirmed => {
            if (confirmed) {
                const backup = DataStore.exportBackup();
                const blob = new Blob([backup], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'backup_' + Helpers.formatDate(null, 'YYYYMMDD_HHmmss') + '.json';
                link.click();
                URL.revokeObjectURL(url);
                Helpers.showToast('数据备份导出成功', 'success');
            }
        });
    }

    function importBackup(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            Helpers.showConfirm('导入将覆盖现有数据，确定继续吗？', '导入备份').then(confirmed => {
                if (confirmed) {
                    const success = DataStore.importBackup(e.target.result);
                    if (success) {
                        updateTodayRevenue();
                        updateStorageInfo();
                        if (currentRoute && routes[currentRoute]) {
                            routes[currentRoute].render();
                        }
                        Helpers.showToast('数据导入成功', 'success');
                    } else {
                        Helpers.showToast('数据导入失败，请检查文件格式', 'error');
                    }
                }
            });
        };
        reader.readAsText(file);
    }

    function clearAllData() {
        Helpers.showConfirm('此操作将清空所有数据且不可恢复，确定继续吗？', '清空数据').then(confirmed => {
            if (confirmed) {
                Helpers.showConfirm('再次确认：真的要清空所有数据吗？', '再次确认').then(confirmed2 => {
                    if (confirmed2) {
                        DataStore.clearAll();
                        const initialData = MockData.generateMockData();
                        DataStore.loadInitialData(initialData);
                        updateTodayRevenue();
                        updateStorageInfo();
                        if (currentRoute && routes[currentRoute]) {
                            routes[currentRoute].render();
                        }
                        Helpers.showToast('数据已重置为演示数据', 'success');
                    }
                });
            }
        });
    }

    $(document).ready(function() {
        init();
    });

    return {
        init,
        getCurrentRoute: () => currentRoute,
        navigate: (route) => { location.hash = '#/' + route; }
    };
})();
