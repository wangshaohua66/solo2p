(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.components = App.components || {};

    function getWeekDates(baseDate) {
        var d = new Date(baseDate);
        var day = d.getDay();
        var diff = d.getDate() - day + (day === 0 ? -6 : 1);
        var monday = new Date(d.setDate(diff));
        var dates = [];
        for (var i = 0; i < 7; i++) {
            var nd = new Date(monday);
            nd.setDate(monday.getDate() + i);
            dates.push(nd);
        }
        return dates;
    }

    function formatDateStr(d) {
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    var HOURS = [];
    (function() {
        for (var h = 9; h <= 18; h++) {
            HOURS.push(h);
        }
    })();

    var WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    function renderScheduleGrid(options) {
        options = options || {};
        var weekStart = options.weekStart || new Date();
        var storeId = options.storeId || App.store.getCurrentStore().id;
        var groomerFilter = options.groomerFilter;

        var weekDates = getWeekDates(weekStart);
        var groomers = App.store.getGroomers({ storeId: storeId });
        if (groomerFilter && groomerFilter.length) {
            groomers = groomers.filter(function(g) { return groomerFilter.indexOf(g.id) >= 0; });
        }

        var startStr = formatDateStr(weekDates[0]);
        var endStr = formatDateStr(weekDates[6]);
        var schedules = App.store.getSchedules({ storeId: storeId, dateRange: { start: startStr, end: endStr } });

        var schMap = {};
        schedules.forEach(function(s) {
            var key = s.groomerId + '|' + s.date;
            if (!schMap[key]) schMap[key] = [];
            schMap[key].push(s);
        });

        var loadMap = {};
        groomers.forEach(function(g) {
            var totalMin = 0;
            var taskCount = 0;
            for (var di = 0; di < 7; di++) {
                var list = schMap[g.id + '|' + formatDateStr(weekDates[di])] || [];
                list.forEach(function(s) { totalMin += s.duration; taskCount++; });
            }
            loadMap[g.id] = {
                totalMin: totalMin,
                taskCount: taskCount,
                rate: Math.min(100, Math.round(totalMin / (480 * 7) * 100))
            };
        });

        var todayStr = formatDateStr(new Date());
        var headerHtml = '<thead><tr>' +
            '<th style="min-width:140px;position:sticky;left:0;background:#fff;z-index:2;">美容师 / 日期</th>';
        weekDates.forEach(function(d, i) {
            var dateStr = formatDateStr(d);
            var isToday = dateStr === todayStr;
            headerHtml += '<th class="text-center' + (isToday ? ' bg-primary-subtle' : '') + '">' +
                '<div class="fw-bold">' + WEEKDAY_NAMES[i] + '</div>' +
                '<div class="small' + (isToday ? ' text-primary fw-bold' : ' text-muted') + '">' +
                (d.getMonth() + 1) + '/' + d.getDate() +
                (isToday ? ' <span class="badge bg-primary ms-1">今天</span>' : '') +
                '</div>' +
                '</th>';
        });
        headerHtml += '</tr></thead>';

        var bodyHtml = '<tbody>';
        groomers.forEach(function(g) {
            var load = loadMap[g.id];
            var loadColor = load.rate < 60 ? 'success' : (load.rate < 85 ? 'warning' : 'danger');
            bodyHtml += '<tr class="groomer-row" data-groomer-id="' + g.id + '">' +
                '<td style="position:sticky;left:0;background:#fff;z-index:2;border-right:1px solid #dee2e6;">' +
                '<div class="d-flex align-items-center gap-2 py-2">' +
                '<div class="avatar-sm bg-secondary-subtle rounded-circle d-flex align-items-center justify-content-center text-secondary">' +
                '<i class="bi bi-person"></i></div>' +
                '<div>' +
                '<div class="fw-bold">' + g.name + '</div>' +
                '<div class="small text-muted">' + g.level + ' · ' + load.taskCount + '单/周</div>' +
                '<div class="progress mt-1" style="height:4px;width:100px;">' +
                '<div class="progress-bar bg-' + loadColor + '" style="width:' + load.rate + '%"></div></div>' +
                '<small class="text-' + loadColor + '">' + load.rate + '% 负载</small>' +
                '</div></div></td>';

            weekDates.forEach(function(d) {
                var dateStr = formatDateStr(d);
                var dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
                var isWorkingDay = !g.workDays || g.workDays.indexOf(dayOfWeek) >= 0;
                var cellContent = '';
                var cellList = schMap[g.id + '|' + dateStr] || [];

                var conflictMap = {};
                cellList.forEach(function(s) {
                    var tParts = s.startTime.split(' ')[1].split(':');
                    var startMin = parseInt(tParts[0]) * 60 + parseInt(tParts[1]);
                    var conflict = App.store.checkScheduleConflict(g.id, dateStr, startMin + 1, 0);
                    if (conflict && conflict.id !== s.id) conflictMap[s.id] = true;
                });

                cellList.forEach(function(s) {
                    var sv = s.serviceId ? App.store.getServiceById(s.serviceId) : null;
                    var pet = sv ? App.store.getPetById(sv.petId) : null;
                    var typeName = sv ? (App.store.getServiceTypes().find(function(t) { return t.id === sv.type; }) || {}).name : '预约';
                    var typeColor = sv ? (App.store.getServiceTypes().find(function(t) { return t.id === sv.type; }) || {}).color : '#6c757d';
                    var startHour = s.startTime.split(' ')[1].substring(0, 5);
                    var hasConflict = conflictMap[s.id];

                    cellContent += '<div class="schedule-item ' + (hasConflict ? 'schedule-conflict' : '') +
                        ' draggable-schedule" draggable="true" ' +
                        'data-id="' + s.id + '" data-date="' + dateStr + '" data-groomer="' + g.id + '" ' +
                        'style="background-color:' + typeColor + '22;border-left:3px solid ' + typeColor + ';">' +
                        '<div class="d-flex justify-content-between align-items-start gap-1">' +
                        '<small class="fw-bold text-truncate" style="color:' + typeColor + ';">' + startHour + ' · ' + typeName + '</small>' +
                        (hasConflict ? '<span class="badge bg-danger" title="时段冲突"><i class="bi bi-exclamation-triangle"></i></span>' : '') +
                        '</div>' +
                        (pet ? '<div class="small text-truncate"><i class="bi bi-' + (pet.species === 'cat' ? 'cat' : 'dog') + ' me-1"></i>' + pet.name + '</div>' : '') +
                        '<div class="small text-muted">⏱ ' + s.duration + '分钟</div>' +
                        '<div class="schedule-item-actions mt-1">' +
                        '<button class="btn btn-xs btn-outline-primary btn-edit-sch" data-id="' + s.id + '"><i class="bi bi-pencil"></i></button>' +
                        '<button class="btn btn-xs btn-outline-danger btn-del-sch" data-id="' + s.id + '"><i class="bi bi-trash"></i></button>' +
                        '</div></div>';
                });

                bodyHtml += '<td class="schedule-cell p-1 ' + (isWorkingDay ? '' : 'bg-light') +
                    '" data-groomer="' + g.id + '" data-date="' + dateStr + '" ' +
                    'style="min-height:120px;vertical-align:top;position:relative;">' +
                    (cellContent || '<div class="text-center text-muted small py-3 drop-hint">' +
                    (isWorkingDay ? '<i class="bi bi-plus-circle-dotted d-block fs-3 mb-1"></i>拖拽创建' : '休息') +
                    '</div>') +
                    '</td>';
            });
            bodyHtml += '</tr>';
        });
        bodyHtml += '</tbody>';

        return '<div class="schedule-grid-wrapper">' +
            '<div class="d-flex justify-content-between align-items-center mb-3">' +
            '<h6 class="mb-0"><i class="bi bi-calendar-week me-2 text-primary"></i>' +
            '排班视图：<span class="text-primary">' + startStr + '</span> 至 <span class="text-primary">' + endStr + '</span>' +
            '</h6>' +
            '<div class="btn-group btn-group-sm">' +
            '<button class="btn btn-outline-secondary" id="prevWeekBtn"><i class="bi bi-chevron-left"></i> 上一周</button>' +
            '<button class="btn btn-primary" id="thisWeekBtn">本周</button>' +
            '<button class="btn btn-outline-secondary" id="nextWeekBtn">下一周 <i class="bi bi-chevron-right"></i></button>' +
            '</div></div>' +
            '<div class="table-responsive schedule-table-wrap shadow-sm bg-white rounded">' +
            '<table class="table table-sm table-hover mb-0 schedule-table">' +
            headerHtml + bodyHtml +
            '</table></div>' +
            '<div class="d-flex gap-3 mt-3 small text-muted">' +
            '<span><span class="schedule-legend" style="background:#28a74522;border-left:3px solid #28a745;"></span>洗护</span>' +
            '<span><span class="schedule-legend" style="background:#007bff22;border-left:3px solid #007bff;"></span>造型</span>' +
            '<span><span class="schedule-legend" style="background:#e83e8c22;border-left:3px solid #e83e8c;"></span>染色</span>' +
            '<span><span class="schedule-legend" style="background:#6f42c122;border-left:3px solid #6f42c1;"></span>SPA</span>' +
            '<span><span class="schedule-legend schedule-conflict"></span>冲突</span>' +
            '</div></div>';
    }

    function bindScheduleGrid(container, options, callbacks) {
        options = options || {};
        callbacks = callbacks || {};
        var weekStart = new Date(options.weekStart || new Date());

        function refresh() {
            container.html(renderScheduleGrid({
                weekStart: weekStart,
                storeId: options.storeId,
                groomerFilter: options.groomerFilter
            }));
            bindEvents();
        }

        function bindEvents() {
            container.find('#prevWeekBtn').on('click', function() {
                weekStart.setDate(weekStart.getDate() - 7);
                if (callbacks.onWeekChange) callbacks.onWeekChange(weekStart);
                refresh();
            });
            container.find('#nextWeekBtn').on('click', function() {
                weekStart.setDate(weekStart.getDate() + 7);
                if (callbacks.onWeekChange) callbacks.onWeekChange(weekStart);
                refresh();
            });
            container.find('#thisWeekBtn').on('click', function() {
                weekStart = new Date();
                if (callbacks.onWeekChange) callbacks.onWeekChange(weekStart);
                refresh();
            });

            container.find('.btn-edit-sch').on('click', function(e) {
                e.stopPropagation();
                var id = $(this).data('id');
                if (callbacks.onEdit) callbacks.onEdit(id);
            });

            container.find('.btn-del-sch').on('click', function(e) {
                e.stopPropagation();
                var id = $(this).data('id');
                if (confirm('确定删除此排班？')) {
                    App.store.deleteSchedule(id);
                    App.showToast('排班已删除', 'success');
                    if (callbacks.onDelete) callbacks.onDelete(id);
                    refresh();
                }
            });

            var dragged = null;
            container.find('.draggable-schedule').on('dragstart', function(e) {
                dragged = {
                    id: $(this).data('id'),
                    fromGroomer: $(this).data('groomer'),
                    fromDate: $(this).data('date')
                };
                $(this).addClass('schedule-dragging');
                try { e.originalEvent.dataTransfer.setData('text/plain', dragged.id); } catch(ex) {}
            });
            container.find('.draggable-schedule').on('dragend', function() {
                container.find('.draggable-schedule').removeClass('schedule-dragging');
                container.find('.schedule-cell').removeClass('schedule-drop-active');
                dragged = null;
            });

            container.find('.schedule-cell').on('dragover', function(e) {
                e.preventDefault();
                $(this).addClass('schedule-drop-active');
            });
            container.find('.schedule-cell').on('dragleave', function() {
                $(this).removeClass('schedule-drop-active');
            });
            container.find('.schedule-cell').on('drop', function(e) {
                e.preventDefault();
                $(this).removeClass('schedule-drop-active');
                if (!dragged) return;
                var toGroomer = $(this).data('groomer');
                var toDate = $(this).data('date');
                if (dragged.fromGroomer === toGroomer && dragged.fromDate === toDate) return;

                var sch = App.store.getSchedules().find(function(s) { return s.id === dragged.id; });
                if (!sch) return;

                var parts = sch.startTime.split(' ');
                sch.groomerId = toGroomer;
                sch.date = toDate;
                sch.startTime = toDate + ' ' + parts[1];

                var tParts = parts[1].split(':');
                var startMin = parseInt(tParts[0]) * 60 + parseInt(tParts[1]);
                var conflict = App.store.checkScheduleConflict(toGroomer, toDate, startMin + 1, 0);
                if (conflict && conflict.id !== sch.id) {
                    if (!confirm('目标时段存在冲突，是否仍移动？')) return;
                }
                App.store.saveSchedule(sch);
                App.showToast('已移动至 ' + toDate + ' 美容师ID ' + toGroomer, 'success');
                if (callbacks.onMove) callbacks.onMove(sch);
                refresh();
            });

            container.find('.schedule-cell').on('dblclick', function() {
                var gid = $(this).data('groomer');
                var date = $(this).data('date');
                if (callbacks.onCreate) callbacks.onCreate(gid, date);
            });
        }

        refresh();
        return { refresh: refresh, getWeekStart: function() { return new Date(weekStart); } };
    }

    App.components.scheduleGrid = {
        render: renderScheduleGrid,
        bind: bindScheduleGrid,
        getWeekDates: getWeekDates,
        formatDateStr: formatDateStr
    };

})(typeof window !== 'undefined' ? window : this);
