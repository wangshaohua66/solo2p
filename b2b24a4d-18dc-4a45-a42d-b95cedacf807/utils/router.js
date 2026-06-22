define(['jquery', 'bootstrap', 'dataStore'], function ($, bootstrap, dataStore) {
    'use strict';

    var routes = {
        'sampleRegister': {
            module: 'modules/sampleRegister',
            title: '样本登记',
            guide: [
                '1. 填写印刷厂名称、印品类型等基本信息',
                '2. 批次号格式：印刷代号+年月+序号(共12位)',
                '3. 系统自动生成唯一条码，可用扫码枪扫描',
                '4. 提交后样本状态设为"待检测"'
            ]
        },
        'detectInput': {
            module: 'modules/detectInput',
            title: '检测录入',
            guide: [
                '1. 先扫描或输入样本条码加载样本信息',
                '2. 依次填写五个维度的检测数据',
                '3. 支持从CSV文件批量导入仪器数据',
                '4. 实时校验，异常值自动高亮提示',
                '5. 保存后状态更新为"已检测待判定"'
            ]
        },
        'scoreJudge': {
            module: 'modules/scoreJudge',
            title: '智能判定',
            guide: [
                '1. 列表显示所有"待判定"状态的样本',
                '2. 点击样本查看五维度评分详情',
                '3. 系统根据规则自动计算等级',
                '4. 单维度超限自动触发红色预警',
                '5. 判定变更需复核组二次确认'
            ]
        },
        'statistics': {
            module: 'modules/statistics',
            title: '统计分析',
            guide: [
                '1. 多维度筛选：印刷厂、印品类型、时间段',
                '2. 合格率分布图：饼图展示各等级占比',
                '3. 趋势图：折线图展示月度质量波动',
                '4. 对比分析：雷达图展示批次差异',
                '5. 热力图：定位高频问题维度'
            ]
        },
        'historyQuery': {
            module: 'modules/historyQuery',
            title: '历史查询',
            guide: [
                '1. 支持条码、批次号、印刷厂复合检索',
                '2. 点击样本行查看同批次关联样本',
                '3. 勾选两份样本可进行并排对比',
                '4. 表格支持列排序、分页、搜索',
                '5. 可直接跳转生成检测报告'
            ]
        },
        'reportGen': {
            module: 'modules/reportGen',
            title: '报告生成',
            guide: [
                '1. 查询待出报告的已判定样本',
                '2. 预览报告格式，按国家标准模板',
                '3. 报告编号自动递增管理',
                '4. 支持单份或批量导出PDF',
                '5. 历史报告可从记录中再次导出'
            ]
        }
    };

    var currentModule = null;
    var defaultRoute = 'sampleRegister';

    function parseHash() {
        var hash = window.location.hash || '';
        hash = hash.replace(/^#\/?/, '');
        var parts = hash.split('/');
        return {
            route: parts[0] || defaultRoute,
            params: parts.slice(1)
        };
    }

    function navigate(route, params) {
        var hash = '#/' + route;
        if (params && params.length) {
            hash += '/' + params.join('/');
        }
        window.location.hash = hash;
    }

    function updateNavActive(route) {
        $('.navbar-nav .nav-link').each(function () {
            var $link = $(this);
            if ($link.data('route') === route) {
                $link.addClass('active');
            } else {
                $link.removeClass('active');
            }
        });
    }

    function renderSidebar(route) {
        var cfg = routes[route];
        if (!cfg) return;

        var guideHtml = '<div class="list-group list-group-flush">';
        cfg.guide.forEach(function (item) {
            guideHtml += '<div class="list-group-item px-0 py-2 small text-muted border-0">' + item + '</div>';
        });
        guideHtml += '</div>';
        $('#sidebarGuide').html(guideHtml);

        var filterHtml = buildSidebarFilter(route);
        $('#sidebarFilter').html(filterHtml);
    }

    function buildSidebarFilter(route) {
        var factories = dataStore.getFactories();
        var html = '';

        if (route === 'statistics' || route === 'historyQuery' || route === 'reportGen') {
            html += '<div class="mb-3">' +
                '<label class="form-label small">印刷厂</label>' +
                '<select class="form-select form-select-sm" id="sideFactoryFilter">' +
                '<option value="">全部印刷厂</option>';
            factories.forEach(function (f) {
                html += '<option value="' + f + '">' + f + '</option>';
            });
            html += '</select></div>';

            html += '<div class="mb-3">' +
                '<label class="form-label small">判定等级</label>' +
                '<select class="form-select form-select-sm" id="sideGradeFilter">' +
                '<option value="">全部等级</option>' +
                '<option value="优等品">优等品</option>' +
                '<option value="一等品">一等品</option>' +
                '<option value="合格品">合格品</option>' +
                '<option value="不合格品">不合格品</option>' +
                '</select></div>';

            html += '<div class="mb-3">' +
                '<label class="form-label small">时间范围</label>' +
                '<select class="form-select form-select-sm" id="sideTimeFilter">' +
                '<option value="all">全部时间</option>' +
                '<option value="7">最近7天</option>' +
                '<option value="30">最近30天</option>' +
                '<option value="90">最近90天</option>' +
                '<option value="365">最近一年</option>' +
                '</select></div>';

            html += '<button class="btn btn-outline-primary btn-sm w-100" id="sideApplyFilter">' +
                '<i class="bi bi-funnel me-1"></i>应用筛选</button>';
        } else {
            html = '<p class="small text-muted">当前模块无快捷筛选</p>';
        }
        return html;
    }

    function updateDataCount() {
        var count = dataStore.getAllSamples().length;
        $('#dataCount').text(count);
    }

    function showToast(message, type) {
        var $toast = $('#toast');
        var toastEl = document.getElementById('toast');
        $('#toastBody').text(message);
        var toastInstance = bootstrap.Toast.getOrCreateInstance(toastEl);
        toastInstance.show();
    }

    function showModal(title, body, footer) {
        $('#globalModalTitle').text(title || '提示');
        $('#globalModalBody').html(body || '');
        if (footer) {
            $('#globalModalFooter').html(footer);
        } else {
            $('#globalModalFooter').html('<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>');
        }
        var modalEl = document.getElementById('globalModal');
        var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }

    function loadModule(route, params) {
        var cfg = routes[route];
        if (!cfg) {
            navigate(defaultRoute);
            return;
        }

        updateNavActive(route);
        renderSidebar(route);
        updateDataCount();
        document.title = cfg.title + ' - 印刷质量检测管理平台';

        $('#app-container').html(
            '<div class="d-flex justify-content-center align-items-center" style="height: 60vh;">' +
            '<div class="spinner-border text-primary" role="status">' +
            '<span class="visually-hidden">加载中...</span>' +
            '</div></div>'
        );

        if (currentModule && typeof currentModule.destroy === 'function') {
            currentModule.destroy();
        }
        currentModule = null;

        require([cfg.module], function (module) {
            if (typeof module.init === 'function') {
                currentModule = module;
                module.init({
                    container: '#app-container',
                    params: params || [],
                    showToast: showToast,
                    showModal: showModal,
                    updateDataCount: updateDataCount,
                    navigate: navigate
                });
            } else {
                $('#app-container').html('<div class="alert alert-danger">模块加载失败：缺少init方法</div>');
            }
        }, function (err) {
            var failedId = err.requireModules && err.requireModules[0];
            $('#app-container').html(
                '<div class="alert alert-danger mt-4">' +
                '<h5><i class="bi bi-exclamation-triangle-fill me-2"></i>模块加载失败</h5>' +
                '<p class="mb-0">无法加载模块：' + failedId + '</p>' +
                '<p class="mb-0 small">错误信息：' + err.message + '</p>' +
                '</div>'
            );
        });
    }

    function handleHashChange() {
        var parsed = parseHash();
        loadModule(parsed.route, parsed.params);
    }

    function bindGlobalEvents() {
        $(window).on('hashchange', handleHashChange);

        $(document).on('click', '.navbar-nav .nav-link', function (e) {
            var route = $(this).data('route');
            if (route) {
                e.preventDefault();
                navigate(route);
            }
        });

        $(document).on('click', '[data-link]', function (e) {
            var link = $(this).data('link');
            if (link) {
                e.preventDefault();
                var parts = link.split('/');
                navigate(parts[0], parts.slice(1));
            }
        });
    }

    function init() {
        dataStore.init();
        bindGlobalEvents();

        if (!window.location.hash) {
            window.location.hash = '#/' + defaultRoute;
        } else {
            handleHashChange();
        }

        window.App = {
            navigate: navigate,
            showToast: showToast,
            showModal: showModal,
            dataStore: dataStore,
            getCurrentModule: function () { return currentModule; }
        };
    }

    return {
        init: init,
        navigate: navigate,
        showToast: showToast,
        showModal: showModal
    };
});
