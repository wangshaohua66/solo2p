var Router = (function() {
    var routes = {};
    var currentRoute = null;
    var viewContainer = null;

    var routeTitles = {
        dashboard: '运营仪表盘',
        fault: '故障接报',
        dispatch: '抢修派工',
        grid: '网络拓扑',
        crew: '班组追踪',
        list: '故障列表'
    };

    function register(name, renderFn) {
        routes[name] = renderFn;
    }

    function navigate(route) {
        if (!routes[route]) {
            route = 'dashboard';
        }

        if (currentRoute === route) {
            return;
        }

        viewContainer = viewContainer || $('#view-container');

        viewContainer.css('opacity', '0');

        setTimeout(function() {
            viewContainer.empty();
            routes[route](viewContainer);
            viewContainer.css('opacity', '1');
            currentRoute = route;
            Store.mutate('currentRoute', route);

            $('.nav-link, .tab-link').removeClass('active');
            $('.nav-link[data-route="' + route + '"], .tab-link[data-route="' + route + '"]').addClass('active');

            $('#page-title').text(routeTitles[route] || route);

            if ($(window).width() < 768) {
                $('#sidebar').removeClass('sidebar-open');
            }
        }, 150);
    }

    function getCurrentRoute() {
        return currentRoute;
    }

    function init() {
        viewContainer = $('#view-container');
        viewContainer.css({
            'transition': 'opacity 300ms ease-in-out',
            'opacity': '0'
        });

        register('dashboard', StatsDashboard.render);
        register('fault', FaultPanel.render);
        register('dispatch', DispatchBoard.render);
        register('grid', GridMap.render);
        register('crew', CrewTracker.render);
        register('list', renderFaultList);

        $(window).on('hashchange', handleHashChange);
        handleHashChange();
    }

    function handleHashChange() {
        var hash = window.location.hash || '#/dashboard';
        var route = hash.replace('#/', '').split('/')[0];
        navigate(route);
    }

    function renderFaultList(container) {
        var html = `
            <div class="row mb-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0"><i class="bi bi-funnel me-2"></i>筛选条件</h5>
                            <div>
                                <button class="btn btn-outline-secondary btn-sm me-2" onclick="resetFilters()">
                                    <i class="bi bi-arrow-counterclockwise"></i> 重置
                                </button>
                                <button class="btn btn-primary btn-sm" onclick="exportCSV()">
                                    <i class="bi bi-download"></i> 导出CSV
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-3">
                                    <label class="form-label">日期范围</label>
                                    <div class="input-group">
                                        <input type="date" id="filter-date-from" class="form-control form-control-sm">
                                        <span class="input-group-text">至</span>
                                        <input type="date" id="filter-date-to" class="form-control form-control-sm">
                                    </div>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">故障等级</label>
                                    <select id="filter-level" class="form-select form-select-sm">
                                        <option value="all">全部</option>
                                        <option value="urgent">紧急</option>
                                        <option value="major">重大</option>
                                        <option value="normal">一般</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">所属线路</label>
                                    <select id="filter-line" class="form-select form-select-sm">
                                        <option value="all">全部</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">负责班组</label>
                                    <select id="filter-crew" class="form-select form-select-sm">
                                        <option value="all">全部</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">当前状态</label>
                                    <select id="filter-status" class="form-select form-select-sm">
                                        <option value="all">全部</option>
                                        <option value="reported">待派工</option>
                                        <option value="dispatched">进行中</option>
                                        <option value="checking">待验收</option>
                                        <option value="resolved">已复电</option>
                                    </select>
                                </div>
                                <div class="col-md-1 d-flex align-items-end">
                                    <button class="btn btn-primary btn-sm w-100" onclick="applyFilters()">
                                        <i class="bi bi-search"></i> 查询
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-list-ul me-2"></i>故障列表</h5>
                        </div>
                        <div class="card-body p-0">
                            <table id="fault-list-table" class="table table-hover mb-0"></table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.html(html);
        initFaultListTable();
        populateFilterOptions();
        bindFilterEvents();
    }

    function populateFilterOptions() {
        var crews = Store.get('crews') || [];
        var crewSelect = $('#filter-crew');
        crews.forEach(function(c) {
            crewSelect.append('<option value="' + c.id + '">' + c.name + '</option>');
        });

        var uniqueLines = new Set();
        var faults = Store.get('faults') || [];
        faults.forEach(function(f) {
            if (f.lineName) uniqueLines.add(f.lineName);
        });
        var lineSelect = $('#filter-line');
        uniqueLines.forEach(function(l) {
            lineSelect.append('<option value="' + l + '">' + l + '</option>');
        });
    }

    function bindFilterEvents() {
        var filters = Store.get('filters');
        if (filters) {
            if (filters.dateFrom) $('#filter-date-from').val(filters.dateFrom);
            if (filters.dateTo) $('#filter-date-to').val(filters.dateTo);
            if (filters.level) $('#filter-level').val(filters.level);
            if (filters.line) $('#filter-line').val(filters.line);
            if (filters.crew) $('#filter-crew').val(filters.crew);
            if (filters.status) $('#filter-status').val(filters.status);
        }
    }

    function applyFilters() {
        var filters = {
            dateFrom: $('#filter-date-from').val() || null,
            dateTo: $('#filter-date-to').val() || null,
            level: $('#filter-level').val(),
            line: $('#filter-line').val(),
            crew: $('#filter-crew').val(),
            status: $('#filter-status').val()
        };
        Store.mutate('filters', filters);
        $('#fault-list-table').bootstrapTable('refresh');
    }

    function resetFilters() {
        Store.mutate('filters', {
            dateFrom: null,
            dateTo: null,
            level: 'all',
            line: 'all',
            crew: 'all',
            status: 'all'
        });
        bindFilterEvents();
        $('#fault-list-table').bootstrapTable('refresh');
    }

    function exportCSV() {
        var faults = getFilteredFaults();
        var headers = ['故障编号', '故障等级', '故障类型', '所属线路', '位置', '影响用户', '负责班组', '状态', '接报时间', '复电时间', '处理时长(分钟)'];
        var levelMap = { urgent: '紧急', major: '重大', normal: '一般' };
        var statusMap = { reported: '待派工', dispatched: '进行中', checking: '待验收', resolved: '已复电' };
        var typeMap = { overload: '过载', short_circuit: '短路', ground_fault: '接地故障', equipment_failure: '设备故障', weather: '天气原因', external: '外力破坏' };

        var csvContent = '\uFEFF' + headers.join(',') + '\n';
        faults.forEach(function(f) {
            var duration = f.recoveryTime ? Math.round((moment(f.recoveryTime) - moment(f.reportTime)) / 60000) : '-';
            var row = [
                f.id,
                levelMap[f.level] || f.level,
                typeMap[f.type] || f.type,
                f.lineName || '',
                f.location || '',
                f.affectedUsers || 0,
                f.crewName || '',
                statusMap[f.status] || f.status,
                f.reportTime ? moment(f.reportTime).format('YYYY-MM-DD HH:mm:ss') : '',
                f.recoveryTime ? moment(f.recoveryTime).format('YYYY-MM-DD HH:mm:ss') : '',
                duration
            ];
            csvContent += row.map(function(v) { return '"' + (v || '') + '"'; }).join(',') + '\n';
        });

        var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = '故障列表_' + moment().format('YYYYMMDD_HHmmss') + '.csv';
        link.click();
    }

    function getFilteredFaults() {
        var faults = Store.get('faults') || [];
        var filters = Store.get('filters') || {};

        return faults.filter(function(f) {
            if (filters.dateFrom && f.reportTime && moment(f.reportTime).isBefore(moment(filters.dateFrom).startOf('day'))) return false;
            if (filters.dateTo && f.reportTime && moment(f.reportTime).isAfter(moment(filters.dateTo).endOf('day'))) return false;
            if (filters.level !== 'all' && f.level !== filters.level) return false;
            if (filters.line !== 'all' && f.lineName !== filters.line) return false;
            if (filters.crew !== 'all' && f.crewId !== filters.crew) return false;
            if (filters.status !== 'all' && f.status !== filters.status) return false;
            return true;
        });
    }

    function initFaultListTable() {
        $('#fault-list-table').bootstrapTable({
            pagination: true,
            pageSize: 10,
            pageList: [10, 25, 50, 100],
            sidePagination: 'server',
            locale: 'zh-CN',
            queryParams: function(params) {
                return params;
            },
            responseHandler: function(res) {
                var all = getFilteredFaults();
                var levelMap = { urgent: '紧急', major: '重大', normal: '一般' };
                var statusMap = { reported: '待派工', dispatched: '进行中', checking: '待验收', resolved: '已复电' };
                var levelBadge = { urgent: 'danger', major: 'warning', normal: 'primary' };
                var statusBadge = { reported: 'secondary', dispatched: 'info', checking: 'warning', resolved: 'success' };

                var rows = all.slice(params.offset, params.offset + params.limit).map(function(f) {
                    var duration = '-';
                    if (f.recoveryTime) {
                        duration = Math.round((moment(f.recoveryTime) - moment(f.reportTime)) / 60000) + ' 分钟';
                    } else if (f.reportTime) {
                        duration = Math.round((Date.now() - moment(f.reportTime)) / 60000) + ' 分钟(进行中)';
                    }
                    return {
                        id: f.id,
                        level: '<span class="badge bg-' + levelBadge[f.level] + '">' + levelMap[f.level] + '</span>',
                        type: f.typeText,
                        lineName: f.lineName,
                        location: f.location,
                        affectedUsers: f.affectedUsers,
                        crewName: f.crewName || '<span class="text-muted">未指派</span>',
                        status: '<span class="badge bg-' + statusBadge[f.status] + '">' + statusMap[f.status] + '</span>',
                        reportTime: f.reportTime ? moment(f.reportTime).format('MM-DD HH:mm') : '-',
                        duration: duration,
                        action: '<button class="btn btn-sm btn-outline-primary" onclick="showFaultDetail(\'' + f.id + '\')">详情</button>'
                    };
                });

                return {
                    total: all.length,
                    rows: rows
                };
            },
            data: [],
            columns: [
                { field: 'id', title: '故障编号', width: 100 },
                { field: 'level', title: '等级', width: 80 },
                { field: 'type', title: '类型', width: 100 },
                { field: 'lineName', title: '所属线路', width: 140 },
                { field: 'location', title: '位置', width: 160 },
                { field: 'affectedUsers', title: '影响用户', width: 90 },
                { field: 'crewName', title: '负责班组', width: 100 },
                { field: 'status', title: '状态', width: 90 },
                { field: 'reportTime', title: '接报时间', width: 110 },
                { field: 'duration', title: '处理时长', width: 140 },
                { field: 'action', title: '操作', width: 80 }
            ]
        });

        Store.subscribe('faults', function() {
            if (Router.getCurrentRoute() === 'list') {
                $('#fault-list-table').bootstrapTable('refresh');
            }
        });
    }

    window.resetFilters = resetFilters;
    window.applyFilters = applyFilters;
    window.exportCSV = exportCSV;
    window.showFaultDetail = function(id) {
        var fault = Store.getFault(id);
        if (fault) {
            DataService.showFaultDetail(fault);
        }
    };

    return {
        init: init,
        navigate: navigate,
        register: register,
        getCurrentRoute: getCurrentRoute
    };
})();
