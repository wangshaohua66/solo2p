(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.pages = App.pages || {};

    var currentGroomerId = null;
    var refreshInterval = null;

    function render(params) {
        var store = App.store.getCurrentStore();
        var groomers = App.store.getGroomers({ storeId: store.id });
        if (!currentGroomerId && groomers.length) currentGroomerId = groomers[0].id;

        var groomerOptions = groomers.map(function(g) {
            return '<option value="' + g.id + '" ' + (g.id === currentGroomerId ? 'selected' : '') + '>' +
                g.name + ' - ' + g.level + '</option>';
        }).join('');

        return '<div class="container-fluid p-0">' +
            '<div class="card bg-gradient-info text-white shadow-sm mb-4">' +
            '<div class="card-body py-3">' +
            '<div class="row align-items-center g-3">' +
            '<div class="col-auto"><h4 class="mb-0 fw-bold"><i class="bi bi-scissors me-2"></i>美容师工作台</h4>' +
            '<small class="opacity-75">' + store.name + ' · ' + new Date().toLocaleDateString('zh-CN', { weekday: 'long' }) + '</small>' +
            '</div>' +
            '<div class="col-md-3 ms-auto">' +
            '<label class="form-label small opacity-75 mb-1">当前美容师</label>' +
            '<select class="form-select" id="groomerSelect">' + groomerOptions + '</select>' +
            '</div></div></div></div>' +

            '<div class="row g-3 mb-4">' +
            '<div class="col-md-3"><div class="card shadow-sm"><div class="card-body p-3">' +
            '<div class="d-flex align-items-center justify-content-between">' +
            '<div><div class="text-muted small">今日总单量</div>' +
            '<div class="fs-3 fw-bold" id="statTotal">0</div></div>' +
            '<i class="bi bi-list-ol fs-2 text-primary opacity-50"></i>' +
            '</div></div></div></div>' +
            '<div class="col-md-3"><div class="card shadow-sm"><div class="card-body p-3">' +
            '<div class="d-flex align-items-center justify-content-between">' +
            '<div><div class="text-muted small">待开始</div>' +
            '<div class="fs-3 fw-bold text-warning" id="statPending">0</div></div>' +
            '<i class="bi bi-hourglass-split fs-2 text-warning opacity-50"></i>' +
            '</div></div></div></div>' +
            '<div class="col-md-3"><div class="card shadow-sm"><div class="card-body p-3">' +
            '<div class="d-flex align-items-center justify-content-between">' +
            '<div><div class="text-muted small">进行中</div>' +
            '<div class="fs-3 fw-bold text-info" id="statProgress">0</div></div>' +
            '<i class="bi bi-suit-club fs-2 text-info opacity-50"></i>' +
            '</div></div></div></div>' +
            '<div class="col-md-3"><div class="card shadow-sm"><div class="card-body p-3">' +
            '<div class="d-flex align-items-center justify-content-between">' +
            '<div><div class="text-muted small">已完成</div>' +
            '<div class="fs-3 fw-bold text-success" id="statDone">0</div></div>' +
            '<i class="bi bi-check2-circle fs-2 text-success opacity-50"></i>' +
            '</div></div></div></div>' +
            '</div>' +

            '<div class="row g-4">' +
            '<div class="col-lg-8">' +
            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-list-task me-2 text-primary"></i>我的服务工单</h6>' +
            '<div class="d-flex gap-2">' +
            '<button class="btn btn-sm btn-outline-secondary" id="refreshBtn"><i class="bi bi-arrow-clockwise me-1"></i>刷新</button>' +
            '<div class="form-check form-switch d-flex align-items-center">' +
            '<input class="form-check-input me-2" type="checkbox" id="autoRefresh" checked>' +
            '<label class="form-check-label small" for="autoRefresh">自动刷新</label>' +
            '</div></div></div>' +
            '<div class="card-body p-0"><div id="taskContainer"></div></div>' +
            '</div></div>' +

            '<div class="col-lg-4">' +
            '<div class="card shadow-sm mb-3">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-emoji-smile me-2 text-info"></i>正在进行</h6></div>' +
            '<div class="card-body p-0" id="activeTaskPanel"></div>' +
            '</div>' +
            '<div class="card shadow-sm">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-calendar-event me-2 text-success"></i>今日排班</h6></div>' +
            '<div class="card-body p-0" id="todaySchedulePanel"></div>' +
            '</div></div>' +

            '</div></div>';
    }

    function bind(params) {
        $('#groomerSelect').on('change', function() {
            currentGroomerId = $(this).val();
            refreshAll();
        });

        $('#refreshBtn').on('click', refreshAll);

        $('#autoRefresh').on('change', function() {
            if ($(this).is(':checked')) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });

        refreshAll();
        if ($('#autoRefresh').is(':checked')) startAutoRefresh();
    }

    function unbind() {
        stopAutoRefresh();
    }

    function startAutoRefresh() {
        stopAutoRefresh();
        refreshInterval = setInterval(refreshAll, 30000);
    }

    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }

    function refreshAll() {
        if (!currentGroomerId) return;
        var store = App.store.getCurrentStore();
        var today = new Date().toISOString().slice(0, 10);
        var services = App.store.getServices({
            groomerId: currentGroomerId,
            storeId: store.id
        }).filter(function(s) { return s.startTime.indexOf(today) === 0; });

        var pending = services.filter(function(s) { return s.status === 'pending'; });
        var progress = services.filter(function(s) {
            return s.status === 'accepted' || s.status === 'bathing' || s.status === 'in_progress' || s.status === 'drying';
        });
        var done = services.filter(function(s) { return s.status === 'completed'; });

        $('#statTotal').text(services.length);
        $('#statPending').text(pending.length);
        $('#statProgress').text(progress.length);
        $('#statDone').text(done.length);

        renderTaskContainer(services);
        renderActiveTask(progress[0]);
        renderTodaySchedule(currentGroomerId, store.id, today);
    }

    function renderTaskContainer(services) {
        if (!services.length) {
            $('#taskContainer').html('<div class="text-center py-5 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2"></i>今日暂无服务工单</div>');
            return;
        }

        var statusFlow = [
            { key: 'pending', label: '待接宠', cls: 'warning', icon: 'clock', next: 'accepted', nextLabel: '开始接宠' },
            { key: 'accepted', label: '已接宠', cls: 'info', icon: 'hand-index', next: 'bathing', nextLabel: '开始洗护' },
            { key: 'bathing', label: '洗护中', cls: 'primary', icon: 'droplet', next: 'in_progress', nextLabel: '开始造型' },
            { key: 'in_progress', label: '造型中', cls: 'primary', icon: 'scissors', next: 'drying', nextLabel: '进行吹水' },
            { key: 'drying', label: '吹水中', cls: 'info', icon: 'wind', next: 'completed', nextLabel: '完成服务' },
            { key: 'completed', label: '已完成', cls: 'success', icon: 'check2-circle', next: null, nextLabel: null }
        ];

        function getStatusMeta(s) { return statusFlow.find(function(x) { return x.key === s.status; }) || statusFlow[0]; }

        var sorted = services.slice().sort(function(a, b) {
            var idxA = statusFlow.findIndex(function(x) { return x.key === a.status; });
            var idxB = statusFlow.findIndex(function(x) { return x.key === b.status; });
            if (idxA !== idxB) return idxA - idxB;
            return new Date(a.startTime) - new Date(b.startTime);
        });

        var html = '<div class="list-group list-group-flush">';
        sorted.forEach(function(s) {
            var pet = App.store.getPetById(s.petId);
            var owner = pet ? App.store.getCustomerById(pet.ownerId) : null;
            var typeName = (App.store.getServiceTypes().find(function(t) { return t.id === s.type; }) || {}).name || s.type;
            var typeColor = (App.store.getServiceTypes().find(function(t) { return t.id === s.type; }) || {}).color || '#6c757d';
            var meta = getStatusMeta(s);

            var progressPct = 0;
            var flowIdx = statusFlow.findIndex(function(x) { return x.key === s.status; });
            progressPct = Math.round((flowIdx / (statusFlow.length - 1)) * 100);

            var photosHtml = '';
            if (s.photos && s.photos.length) {
                s.photos.slice(0, 4).forEach(function(p) {
                    photosHtml += '<img src="' + p + '" class="rounded img-thumbnail service-thumb me-1" onerror="this.style.display=\'none\'">';
                });
            }

            html += '<div class="list-group-item border-0 p-3 mb-2 mx-3 mt-2 shadow-sm rounded task-card" data-svc-id="' + s.id + '" style="border-left:4px solid ' + typeColor + ';">' +
                '<div class="d-flex justify-content-between align-items-start mb-2">' +
                '<div>' +
                '<h6 class="mb-1 fw-bold d-flex align-items-center gap-2">' +
                '<span class="badge bg-' + meta.cls + '"><i class="bi bi-' + meta.icon + ' me-1"></i>' + meta.label + '</span>' +
                '<span style="color:' + typeColor + ';">[' + typeName + ']</span>' +
                (pet ? (pet.species === 'cat' ? '<i class="bi bi-cat text-info"></i>' : '<i class="bi bi-dog text-warning"></i>') + ' <b>' + pet.name + '</b>' : '<span class="text-danger">未知宠物</span>') +
                '</h6>' +
                '<small class="text-muted">' +
                (pet ? pet.breed + (pet.weight ? ' · ' + pet.weight + 'kg' : '') : '') +
                (owner ? ' · 主人：' + owner.name + '（' + owner.phone + '）' : '') +
                '</small>' +
                '</div>' +
                '<div class="text-end">' +
                '<div class="fw-bold text-success">' + App.calculator.formatMoney(s.price) + '</div>' +
                '<small class="text-muted">⏱ ' + App.calculator.formatMinutes(s.duration) + '</small>' +
                '</div></div>' +

                '<div class="progress mb-2" style="height:6px;">' +
                '<div class="progress-bar bg-gradient" style="width:' + progressPct + '%;"></div>' +
                '</div>' +

                (pet && pet.allergy && pet.allergy.length ? '<div class="alert alert-warning py-1 px-2 small mb-2"><i class="bi bi-exclamation-triangle me-1"></i>过敏：' + pet.allergy.join('、') + '</div>' : '') +
                (pet && pet.specialNotes ? '<div class="alert alert-danger py-1 px-2 small mb-2"><i class="bi bi-info-circle me-1"></i>' + pet.specialNotes + '</div>' : '') +
                (s.notes ? '<div class="small text-muted mb-2"><i class="bi bi-sticky me-1"></i>' + s.notes + '</div>' : '') +

                (photosHtml ? '<div class="mb-2">' + photosHtml + '</div>' : '') +

                '<div class="d-flex gap-2 flex-wrap">' +
                '<button class="btn btn-sm btn-primary btn-upload-photo" data-id="' + s.id + '"><i class="bi bi-camera me-1"></i>上传造型照</button>' +
                (meta.next ? '<button class="btn btn-sm btn-success ms-auto btn-next-status" data-id="' + s.id + '" data-next="' + meta.next + '">' +
                    '<i class="bi bi-arrow-right me-1"></i>' + meta.nextLabel + '</button>' :
                    '<button class="btn btn-sm btn-outline-success ms-auto" disabled><i class="bi bi-check2-circle me-1"></i>已完成</button>') +
                '<button class="btn btn-sm btn-outline-secondary btn-view-detail" data-id="' + s.id + '"><i class="bi bi-eye"></i></button>' +
                '</div></div>';
        });
        html += '</div>';
        $('#taskContainer').html(html);

        $('#taskContainer').on('click', '.btn-next-status', function() {
            var id = $(this).data('id');
            var next = $(this).data('next');
            var svc = App.store.updateServiceStatus(id, next);
            if (next === 'completed' && svc) {
                var pet = App.store.getPetById(svc.petId);
                var owner = pet ? App.store.getCustomerById(pet.ownerId) : null;
                if (owner && svc.points) {
                    App.store.addPoints(owner.id, svc.points);
                }
            }
            App.showToast('状态已更新', 'success');
            refreshAll();
        });

        $('#taskContainer').on('click', '.btn-upload-photo', function() {
            var id = $(this).data('id');
            var input = '<div class="mb-3"><label class="form-label">粘贴造型照片URL（可使用占位图）</label>' +
                '<input type="text" class="form-control" id="photoUrlInput" placeholder="https://...">' +
                '</div>' +
                '<div class="row g-2 mb-3">' +
                '<div class="col-3"><a href="#" class="d-block quick-photo" data-url="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=300&h=300&fit=crop"><img src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=80&h=80&fit=crop" class="w-100 rounded"></a></div>' +
                '<div class="col-3"><a href="#" class="d-block quick-photo" data-url="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&h=300&fit=crop"><img src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=80&h=80&fit=crop" class="w-100 rounded"></a></div>' +
                '<div class="col-3"><a href="#" class="d-block quick-photo" data-url="https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=300&h=300&fit=crop"><img src="https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=80&h=80&fit=crop" class="w-100 rounded"></a></div>' +
                '<div class="col-3"><a href="#" class="d-block quick-photo" data-url="https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=300&h=300&fit=crop"><img src="https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=80&h=80&fit=crop" class="w-100 rounded"></a></div>' +
                '</div>';
            var footer = '<button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>' +
                '<button class="btn btn-primary" id="savePhotoBtn"><i class="bi bi-save me-1"></i>保存照片</button>';
            App.showModal('上传造型照片 - 工单' + id, input, footer);
            $('.quick-photo').on('click', function(e) {
                e.preventDefault();
                $('#photoUrlInput').val($(this).data('url'));
            });
            $('#savePhotoBtn').on('click', function() {
                var url = $('#photoUrlInput').val().trim();
                if (!url) { App.showToast('请输入URL或选择示例图片', 'warning'); return; }
                var svc = App.store.getServiceById(id);
                if (svc) {
                    svc.photos = svc.photos || [];
                    svc.photos.push(url);
                    App.store.saveService(svc);
                    App.showToast('照片已添加', 'success');
                    bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
                    refreshAll();
                }
            });
        });

        $('#taskContainer').on('click', '.btn-view-detail', function() {
            var id = $(this).data('id');
            var svc = App.store.getServiceById(id);
            if (!svc) return;
            var pet = App.store.getPetById(svc.petId);
            var history = pet ? App.store.getPetServices(pet.id) : [];
            var body = '<h6>服务信息</h6>' +
                '<table class="table table-sm"><tbody>' +
                '<tr><td class="text-muted">工单号</td><td>' + svc.id + '</td></tr>' +
                '<tr><td class="text-muted">宠物</td><td>' + (pet ? pet.name + ' (' + pet.breed + ')' : '-') + '</td></tr>' +
                '<tr><td class="text-muted">开始时间</td><td>' + svc.startTime + '</td></tr>' +
                '<tr><td class="text-muted">价格</td><td class="text-success fw-bold">' + App.calculator.formatMoney(svc.price) + '</td></tr>' +
                '<tr><td class="text-muted">状态</td><td>' + svc.status + '</td></tr>' +
                '</tbody></table>' +
                (pet ? '<h6>历史服务记录（共 ' + history.length + ' 条）</h6>' +
                    '<div class="list-group small">' +
                    history.slice(0, 5).map(function(h) {
                        var tn = (App.store.getServiceTypes().find(function(t) { return t.id === h.type; }) || {}).name || h.type;
                        return '<a href="#" class="list-group-item list-group-item-action d-flex justify-content-between">' +
                            '<span>' + h.startTime.substring(0, 16) + ' · ' + tn + '</span>' +
                            '<span class="text-success">' + App.calculator.formatMoney(h.price) + '</span></a>';
                    }).join('') +
                    '</div>' : '');
            App.showModal('工单详情 - ' + svc.id, body);
        });
    }

    function renderActiveTask(task) {
        if (!task) {
            $('#activeTaskPanel').html('<div class="text-center py-4 text-muted small"><i class="bi bi-moon-stars fs-1 d-block mb-2"></i>当前暂无进行中的任务</div>');
            return;
        }
        var pet = App.store.getPetById(task.petId);
        var typeName = (App.store.getServiceTypes().find(function(t) { return t.id === task.type; }) || {}).name || task.type;
        var typeColor = (App.store.getServiceTypes().find(function(t) { return t.id === task.type; }) || {}).color || '#6c757d';

        var start = new Date(task.startTime);
        var elapsed = Math.floor((Date.now() - start.getTime()) / 60000);
        var remain = Math.max(0, task.duration - elapsed);
        var pct = Math.min(100, Math.round((elapsed / task.duration) * 100));

        $('#activeTaskPanel').html(
            '<div class="p-3 text-white" style="background:linear-gradient(135deg,' + typeColor + ',' + typeColor + 'dd);">' +
            '<div class="d-flex align-items-center gap-3 mb-3">' +
            (pet && pet.photos && pet.photos[0] ? '<img src="' + pet.photos[0] + '" class="rounded-circle" style="width:64px;height:64px;object-fit:cover;border:3px solid rgba(255,255,255,0.5);">' :
                '<div class="rounded-circle bg-white bg-opacity-25 d-flex align-items-center justify-content-center" style="width:64px;height:64px;"><i class="bi bi-' + (pet && pet.species === 'cat' ? 'cat' : 'dog') + ' fs-2"></i></div>') +
            '<div class="flex-grow-1">' +
            '<h5 class="mb-0 fw-bold">' + (pet ? pet.name : '?') + '</h5>' +
            '<div class="opacity-75 small">' + (pet ? pet.breed : '') + '</div>' +
            '<div class="mt-1"><span class="badge bg-light text-dark">' + typeName + '</span></div>' +
            '</div></div>' +
            '<div class="d-flex justify-content-between small opacity-90 mb-1">' +
            '<span>已用时间：' + App.calculator.formatMinutes(Math.max(0, elapsed)) + '</span>' +
            '<span>剩余：' + App.calculator.formatMinutes(remain) + '</span></div>' +
            '<div class="progress" style="height:8px;"><div class="progress-bar bg-light" style="width:' + pct + '%;"></div></div>' +
            '</div>'
        );
    }

    function renderTodaySchedule(groomerId, storeId, dateStr) {
        var list = App.store.getSchedules({ groomerId: groomerId, storeId: storeId, date: dateStr });
        if (!list.length) {
            $('#todaySchedulePanel').html('<div class="text-center py-3 text-muted small"><i class="bi bi-calendar3 d-block mb-1"></i>今日暂无排班</div>');
            return;
        }
        list.sort(function(a, b) { return a.startTime.localeCompare(b.startTime); });
        var html = '<div class="list-group list-group-flush small">';
        list.forEach(function(s) {
            var svc = s.serviceId ? App.store.getServiceById(s.serviceId) : null;
            var pet = svc ? App.store.getPetById(svc.petId) : null;
            var typeName = svc ? (App.store.getServiceTypes().find(function(t) { return t.id === svc.type; }) || {}).name : '预约';
            var typeColor = svc ? (App.store.getServiceTypes().find(function(t) { return t.id === svc.type; }) || {}).color : '#6c757d';
            var timeStr = s.startTime.split(' ')[1].substring(0, 5);
            html += '<div class="list-group-item d-flex align-items-center gap-2 border-start-0 border-end-0 rounded-0" style="border-left:4px solid ' + typeColor + ' !important;">' +
                '<span class="fw-bold text-muted">' + timeStr + '</span>' +
                '<div class="flex-grow-1">' +
                '<div class="fw-bold">' + typeName + (pet ? ' · ' + pet.name : '') + '</div>' +
                '<div class="text-muted">⏱ ' + s.duration + '分钟' + (pet ? ' · ' + pet.breed : '') + '</div>' +
                '</div>' +
                (svc ? '<span class="badge bg-' + (svc.status === 'completed' ? 'success' : (svc.status === 'pending' ? 'warning' : 'primary')) + '">' + svc.status + '</span>' : '') +
                '</div>';
        });
        html += '</div>';
        $('#todaySchedulePanel').html(html);
    }

    App.pages.groomer = {
        render: render,
        bind: bind,
        unbind: unbind
    };

})(typeof window !== 'undefined' ? window : this);
