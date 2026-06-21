(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.pages = App.pages || {};

    var gridApi = null;
    var groomerFilter = [];

    function render(params) {
        var store = App.store.getCurrentStore();
        var groomers = App.store.getGroomers({ storeId: store.id });
        var groomerOpts = groomers.map(function(g) {
            return '<label class="form-check form-check-inline mb-0 ms-2">' +
                '<input class="form-check-input groomer-filter-chk" type="checkbox" value="' + g.id + '" checked>' +
                '<span class="form-check-label small">' + g.name + '</span></label>';
        }).join('');

        return '<div class="container-fluid p-0">' +
            '<div class="row g-3 mb-4">' +
            '<div class="col-12">' +
            '<div class="card bg-gradient-secondary text-white shadow-sm">' +
            '<div class="card-body py-3">' +
            '<div class="row align-items-center g-3">' +
            '<div class="col-auto"><h4 class="mb-0 fw-bold"><i class="bi bi-calendar-week me-2"></i>美容师排班管理</h4>' +
            '<small class="opacity-75">' + store.name + ' · 支持拖拽移动、双击创建、冲突实时检测</small>' +
            '</div>' +
            '<div class="col ms-auto d-flex align-items-center gap-2">' +
            '<span class="small opacity-75">显示美容师：</span>' + groomerOpts +
            '<button class="btn btn-light btn-sm ms-3" id="btnNewSch"><i class="bi bi-plus-circle me-1"></i>新建预约</button>' +
            '</div></div></div></div></div></div>' +

            '<div class="row g-4">' +
            '<div class="col-lg-12">' +
            '<div class="card shadow-sm">' +
            '<div class="card-body" id="scheduleGridHost"></div>' +
            '</div></div>' +

            '<div class="col-lg-6">' +
            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-info-circle me-2 text-primary"></i>操作说明</h6></div>' +
            '<div class="card-body small">' +
            '<ul class="list-unstyled mb-0 lh-lg">' +
            '<li><i class="bi bi-mouse me-2 text-success"></i> <b>双击</b> 空白排班格：创建新预约</li>' +
            '<li><i class="bi bi-arrows-move me-2 text-info"></i> <b>拖拽</b> 排班块：移动到其他美容师/日期</li>' +
            '<li><i class="bi bi-pencil-square me-2 text-warning"></i> <b>编辑图标</b>：修改预约详情</li>' +
            '<li><i class="bi bi-trash me-2 text-danger"></i> <b>删除图标</b>：取消该排班</li>' +
            '<li><i class="bi bi-exclamation-triangle me-2 text-danger"></i> <b>红色边框</b>：时段冲突警告</li>' +
            '</ul></div></div></div>' +

            '<div class="col-lg-6">' +
            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-stars me-2 text-warning"></i>美容师负载排行</h6></div>' +
            '<div class="card-body p-0" id="groomerLoadHost"></div>' +
            '</div></div>' +

            '</div></div>';
    }

    function bind(params) {
        var storeId = App.store.getCurrentStore().id;

        gridApi = App.components.scheduleGrid.bind($('#scheduleGridHost'), {
            storeId: storeId,
            groomerFilter: groomerFilter.length ? groomerFilter : null
        }, {
            onWeekChange: function(ws) { renderGroomerLoad(ws, storeId); },
            onCreate: function(gid, date) { openScheduleModal(null, { groomerId: gid, date: date }); },
            onEdit: function(id) {
                var sch = App.store.getSchedules().find(function(s) { return s.id === id; });
                if (sch) openScheduleModal(sch);
            },
            onDelete: function() { renderGroomerLoad(gridApi.getWeekStart(), storeId); },
            onMove: function() { renderGroomerLoad(gridApi.getWeekStart(), storeId); }
        });

        renderGroomerLoad(gridApi.getWeekStart(), storeId);

        $('#btnNewSch').on('click', function() { openScheduleModal(); });

        $('.groomer-filter-chk').on('change', function() {
            groomerFilter = [];
            $('.groomer-filter-chk:checked').each(function() { groomerFilter.push($(this).val()); });
            gridApi = App.components.scheduleGrid.bind($('#scheduleGridHost'), {
                storeId: storeId,
                groomerFilter: groomerFilter.length ? groomerFilter : null
            }, {
                onWeekChange: function(ws) { renderGroomerLoad(ws, storeId); },
                onCreate: function(gid, date) { openScheduleModal(null, { groomerId: gid, date: date }); },
                onEdit: function(id) {
                    var sch = App.store.getSchedules().find(function(s) { return s.id === id; });
                    if (sch) openScheduleModal(sch);
                },
                onDelete: function() { renderGroomerLoad(gridApi.getWeekStart(), storeId); },
                onMove: function() { renderGroomerLoad(gridApi.getWeekStart(), storeId); }
            });
        });
    }

    function renderGroomerLoad(weekStart, storeId) {
        var dates = App.components.scheduleGrid.getWeekDates(weekStart || new Date());
        var start = App.components.scheduleGrid.formatDateStr(dates[0]);
        var end = App.components.scheduleGrid.formatDateStr(dates[6]);
        var groomers = App.store.getGroomers({ storeId: storeId });
        var schedules = App.store.getSchedules({ storeId: storeId, dateRange: { start: start, end: end } });

        var data = groomers.map(function(g) {
            var list = schedules.filter(function(s) { return s.groomerId === g.id; });
            var totalMin = list.reduce(function(s, x) { return s + (x.duration || 0); }, 0);
            var rate = Math.min(100, Math.round(totalMin / (480 * 7) * 100));
            return { groomer: g, totalMin: totalMin, rate: rate, count: list.length };
        }).sort(function(a, b) { return a.rate - b.rate; });

        var html = '<div class="list-group list-group-flush small">';
        data.forEach(function(d) {
            var color = d.rate < 60 ? 'success' : (d.rate < 85 ? 'warning' : 'danger');
            var status = d.rate < 60 ? '空闲可接' : (d.rate < 85 ? '适中' : '已满负载');
            html += '<div class="list-group-item d-flex align-items-center gap-3">' +
                '<div class="avatar-sm bg-secondary-subtle rounded-circle d-flex align-items-center justify-content-center">' +
                '<i class="bi bi-person text-secondary"></i></div>' +
                '<div class="flex-grow-1">' +
                '<div class="d-flex justify-content-between align-items-center mb-1">' +
                '<span class="fw-bold">' + d.groomer.name + '</span>' +
                '<span class="badge bg-' + color + '">' + status + '</span>' +
                '</div>' +
                '<div class="d-flex justify-content-between small text-muted mb-1">' +
                '<span>' + d.groomer.level + ' · ' + d.count + '单/周 · ' + App.calculator.formatMinutes(d.totalMin) + '</span>' +
                '<span class="fw-bold text-' + color + '">' + d.rate + '%</span>' +
                '</div>' +
                '<div class="progress" style="height:6px;"><div class="progress-bar bg-' + color + '" style="width:' + d.rate + '%;"></div></div>' +
                '</div></div>';
        });
        html += '</div>';
        $('#groomerLoadHost').html(html);
    }

    function openScheduleModal(schedule, defaults) {
        schedule = schedule || {};
        defaults = defaults || {};
        var storeId = App.store.getCurrentStore().id;
        var groomers = App.store.getGroomers({ storeId: storeId });
        var pets = App.store.getPets();

        var gOpts = groomers.map(function(g) {
            return '<option value="' + g.id + '" ' + ((schedule.groomerId || defaults.groomerId) === g.id ? 'selected' : '') + '>' +
                g.name + ' - ' + g.level + '</option>';
        }).join('');

        var pOpts = pets.map(function(p) {
            var owner = p.ownerId ? App.store.getCustomerById(p.ownerId) : null;
            return '<option value="' + p.id + '" ' + (schedule.serviceId ? '' : '') + '>' +
                p.name + ' (' + p.breed + ')' + (owner ? ' - ' + owner.name : '') +
                '</option>';
        }).join('');

        var today = new Date();
        var defDate = schedule.date || defaults.date || App.components.scheduleGrid.formatDateStr(today);
        var defTime = schedule.startTime ? schedule.startTime.split(' ')[1] : (String(today.getHours()).padStart(2, '0') + ':00');

        var body = '<form id="schForm" class="row g-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label">美容师 <span class="text-danger">*</span></label>' +
            '<select name="groomerId" class="form-select" required>' + gOpts + '</select></div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">关联宠物</label>' +
            '<select name="petId" class="form-select"><option value="">未绑定</option>' + pOpts + '</select></div>' +
            '<div class="col-md-4"><label class="form-label">服务日期</label>' +
            '<input name="date" type="date" class="form-control" value="' + defDate + '"></div>' +
            '<div class="col-md-4"><label class="form-label">开始时间</label>' +
            '<input name="startTime" type="time" class="form-control" value="' + defTime + '"></div>' +
            '<div class="col-md-4"><label class="form-label">服务时长 (分钟)</label>' +
            '<input name="duration" type="number" class="form-control" value="' + (schedule.duration || 90) + '" min="15" step="15"></div>' +
            '<input type="hidden" name="id" value="' + (schedule.id || '') + '">' +
            '</form>';
        var isEdit = schedule && schedule.id;
        var footer = (isEdit ? '<button class="btn btn-danger me-auto" id="btnDeleteSch"><i class="bi bi-trash me-1"></i>删除</button>' : '') +
            '<button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>' +
            '<button class="btn btn-primary" id="btnSaveSch"><i class="bi bi-check2 me-1"></i>' + (isEdit ? '保存修改' : '创建排班') + '</button>';
        App.showModal(isEdit ? '编辑排班' : '新建预约排班', body, footer);

        $('#btnSaveSch').on('click', function() {
            var data = {};
            $('#schForm [name]').each(function() { data[$(this).attr('name')] = $(this).val(); });
            if (!data.groomerId) { App.showToast('请选择美容师', 'warning'); return; }
            data.duration = parseInt(data.duration) || 90;
            data.storeId = storeId;
            data.startTime = data.date + ' ' + data.startTime + ':00';
            data.status = 'booked';

            var tParts = data.startTime.split(' ')[1].split(':');
            var startMin = parseInt(tParts[0]) * 60 + parseInt(tParts[1]);
            var conflict = App.store.checkScheduleConflict(data.groomerId, data.date, startMin, 0);
            if (conflict && (!isEdit || conflict.id !== schedule.id)) {
                if (!confirm('该时段存在冲突排班，是否仍继续保存？')) return;
            }

            var svcId = null;
            if (data.petId) {
                var svc = App.store.saveService({
                    petId: data.petId,
                    groomerId: data.groomerId,
                    storeId: storeId,
                    type: 'style',
                    status: 'pending',
                    startTime: data.startTime,
                    duration: data.duration,
                    price: 200
                });
                svcId = svc.id;
            }

            if (isEdit) {
                var old = App.store.getSchedules().find(function(s) { return s.id === schedule.id; });
                if (old) {
                    data.id = old.id;
                    if (!data.petId) data.serviceId = old.serviceId;
                    else data.serviceId = svcId;
                    App.store.saveSchedule(data);
                }
            } else {
                data.serviceId = svcId;
                delete data.id;
                App.store.saveSchedule(data);
            }

            bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
            App.showToast((isEdit ? '修改' : '创建') + '成功', 'success');
            gridApi.refresh();
            renderGroomerLoad(gridApi.getWeekStart(), storeId);
        });

        if (isEdit) {
            $('#btnDeleteSch').on('click', function() {
                if (!confirm('确定删除该排班？')) return;
                App.store.deleteSchedule(schedule.id);
                bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
                App.showToast('已删除', 'success');
                gridApi.refresh();
                renderGroomerLoad(gridApi.getWeekStart(), storeId);
            });
        }
    }

    App.pages.schedule = {
        render: render,
        bind: bind
    };

})(typeof window !== 'undefined' ? window : this);
