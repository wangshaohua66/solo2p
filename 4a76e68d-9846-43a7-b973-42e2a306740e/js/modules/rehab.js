var Rehab = window.Rehab = (function () {
    var appointments = [];
    var staff = [];
    var mothers = [];
    var calendar = null;

    var PROJECTS = [
        { type: 'pelvic', name: '骨盆修复', duration: 45, color: '#E891A8', icon: 'bi-heart' },
        { type: 'abdominal', name: '腹直肌分离修复', duration: 40, color: '#5BA8C9', icon: 'bi-activity' },
        { type: 'breast', name: '乳房护理', duration: 30, color: '#5CB85C', icon: 'bi-heart-pulse' },
        { type: 'tcm', name: '中医调理', duration: 50, color: '#F0AD4E', icon: 'bi-magic' }
    ];

    function render() {
        var storeId = App.state.storeId;
        if (!storeId) return;

        Promise.all([
            Store.getRehabByStore(storeId),
            Store.getStaffByStoreAndRole(storeId, 'rehab'),
            Store.getMothersByStore(storeId)
        ]).then(function (results) {
            appointments = results[0] || [];
            staff = results[1] || [];
            mothers = results[2] || [];
            renderPage();
        }).catch(function (err) {
            console.error('加载康复数据失败:', err);
            $('#app-content').html('<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>数据加载失败，请刷新重试</p></div>');
        });
    }

    function renderPage() {
        var html = '';
        html += renderPageHeader();
        html += renderStatCards();
        html += renderFilterBar();
        html += renderCalendarArea();
        html += renderProgressPanel();

        $('#app-content').html(html);
        bindEvents();
        initCalendar();
    }

    function renderPageHeader() {
        var actionsHtml = '<button class="btn btn-pink" id="btn-new-appt"><i class="bi bi-calendar-plus me-1"></i>新建预约</button>';
        return App.renderPageHeader('bi-heart-pulse', '康复预约', App.state.storeName, actionsHtml);
    }

    function renderStatCards() {
        var today = Store.formatDate(new Date());
        var todayAppts = appointments.filter(function (a) { return a.startTime && a.startTime.substring(0, 10) === today; });
        var completed = appointments.filter(function (a) { return a.status === 'completed'; }).length;
        var scheduled = appointments.filter(function (a) { return a.status === 'scheduled'; }).length;
        var conflictCount = countConflicts();

        return '<div class="row g-3 mb-4 fade-in">' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon pink"><i class="bi bi-calendar3"></i></div>' +
            '<div class="stat-value">' + todayAppts.length + '</div>' +
            '<div class="stat-label">今日预约</div>' +
            '</div></div>' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon blue"><i class="bi bi-clock"></i></div>' +
            '<div class="stat-value">' + scheduled + '</div>' +
            '<div class="stat-label">待执行</div>' +
            '</div></div>' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon green"><i class="bi bi-check2-circle"></i></div>' +
            '<div class="stat-value">' + completed + '</div>' +
            '<div class="stat-label">已完成</div>' +
            '</div></div>' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon red"><i class="bi bi-exclamation-triangle"></i></div>' +
            '<div class="stat-value">' + conflictCount + '</div>' +
            '<div class="stat-label">时段冲突</div>' +
            '</div></div>' +
            '</div>';
    }

    function countConflicts() {
        var count = 0;
        for (var i = 0; i < appointments.length; i++) {
            for (var j = i + 1; j < appointments.length; j++) {
                var a = appointments[i];
                var b = appointments[j];
                if (a.staffId === b.staffId &&
                    a.status !== 'cancelled' && b.status !== 'cancelled' &&
                    a.startTime && b.startTime &&
                    !(a.endTime < b.startTime || a.startTime > b.endTime)) {
                    count++;
                }
            }
        }
        return count;
    }

    function renderFilterBar() {
        var projectOptions = PROJECTS.map(function (p) {
            return '<span class="badge-pink cursor-pointer me-1 mb-1" style="cursor:pointer;" data-project="' + p.type + '">' +
                '<i class="bi ' + p.icon + ' me-1"></i>' + p.name +
                '</span>';
        }).join('');

        return '<div class="filter-bar fade-in">' +
            '<span class="text-muted me-2">项目类型：</span>' +
            '<span class="badge-green cursor-pointer me-1 mb-1" style="cursor:pointer;" data-project="all">全部</span>' +
            projectOptions +
            '</div>';
    }

    function renderCalendarArea() {
        return '<div class="card-pink fade-in mb-4">' +
            '<div class="card-pink-header">' +
            '<h5 class="card-pink-title"><i class="bi bi-calendar-week"></i>康复师排班日历</h5>' +
            '</div>' +
            '<div class="card-pink-body">' +
            '<div id="rehab-calendar" style="min-height:500px;"></div>' +
            '</div></div>';
    }

    function renderProgressPanel() {
        var rehabMothers = [];
        var motherMap = {};

        appointments.forEach(function (a) {
            if (!motherMap[a.motherId]) {
                motherMap[a.motherId] = {
                    motherId: a.motherId,
                    motherName: a.motherName,
                    projects: {}
                };
            }
            var p = motherMap[a.motherId];
            var type = a.projectType;
            if (!p.projects[type]) {
                p.projects[type] = { name: a.projectName, completed: 0, total: a.totalSessions || 10, sessions: [] };
            }
            if (a.status === 'completed') p.projects[type].completed++;
            p.projects[type].sessions.push(a);
        });

        rehabMothers = Object.values(motherMap).slice(0, 5);

        if (rehabMothers.length === 0) return '';

        var html = '<div class="card-pink fade-in">' +
            '<div class="card-pink-header">' +
            '<h5 class="card-pink-title"><i class="bi bi-graph-up-arrow"></i>康复进度追踪</h5>' +
            '</div>' +
            '<div class="card-pink-body"><div class="row g-3">';

        rehabMothers.forEach(function (m) {
            var projectHtml = Object.entries(m.projects).map(function (entry) {
                var type = entry[0];
                var info = entry[1];
                var project = PROJECTS.find(function (p) { return p.type === type; }) || PROJECTS[0];
                var percent = Math.round(info.completed / Math.max(1, info.total) * 100);
                return '<div class="mb-3">' +
                    '<div class="d-flex justify-content-between mb-1">' +
                    '<small><i class="bi ' + project.icon + ' me-1" style="color:' + project.color + ';"></i>' + info.name + '</small>' +
                    '<small class="text-muted">' + info.completed + '/' + info.total + ' 次</small>' +
                    '</div>' +
                    '<div class="progress-pink"><div class="progress-pink-bar" style="width:' + percent + '%;background:' + project.color + ';"></div></div>' +
                    '</div>';
            }).join('');

            html += '<div class="col-lg-6 col-md-12">' +
                '<div class="p-3 rounded" style="background:var(--color-primary-lighter);">' +
                '<h6 class="mb-3 text-primary-pink"><i class="bi bi-person-fill me-1"></i>' + m.motherName + '</h6>' +
                projectHtml +
                '</div></div>';
        });

        html += '</div></div></div>';
        return html;
    }

    function initCalendar() {
        var calendarEl = document.getElementById('rehab-calendar');
        if (!calendarEl) return;
        if (calendar) {
            try { calendar.destroy(); } catch (e) { }
            calendar = null;
        }

        var events = appointments.map(function (a) {
            var project = PROJECTS.find(function (p) { return p.type === a.projectType; }) || PROJECTS[0];
            var conflict = hasConflict(a);
            return {
                id: a.id,
                title: a.projectName + ' - ' + a.motherName + '（' + (a.staffName || '康复师') + '）',
                start: a.startTime ? a.startTime.replace(' ', 'T') : null,
                end: a.endTime ? a.endTime.replace(' ', 'T') : null,
                backgroundColor: conflict ? '#dc3545' : project.color,
                borderColor: conflict ? '#dc3545' : project.color,
                extendedProps: {
                    appt: a,
                    project: project,
                    conflict: conflict
                },
                className: conflict ? 'fc-event-conflict' : ''
            };
        }).filter(function (e) { return e.start; });

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridDay',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridDay,timeGridWeek,dayGridMonth'
            },
            locale: 'zh-cn',
            nowIndicator: true,
            navLinks: true,
            editable: true,
            eventResizableFromStart: true,
            slotMinTime: '08:00:00',
            slotMaxTime: '21:00:00',
            slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
            allDaySlot: false,
            scrollTime: '09:00:00',
            height: 550,
            buttonText: {
                today: '今天',
                timeGridDay: '日视图',
                timeGridWeek: '周视图',
                dayGridMonth: '月视图'
            },
            events: events,
            eventClick: function (info) {
                var ext = info.event.extendedProps;
                openApptDetail(ext.appt, ext.project, ext.conflict);
            },
            eventDrop: function (info) {
                handleEventDrop(info);
            },
            eventResize: function (info) {
                handleEventResize(info);
            },
            dateClick: function (info) {
                var dateStr = info.dateStr.substring(0, 10);
                var timeStr = info.dateStr.substring(11, 16) || '09:00';
                openApptModal(null, dateStr + ' ' + timeStr);
            },
            eventDidMount: function (info) {
                if (info.event.extendedProps.conflict) {
                    info.el.style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px)';
                    info.el.title = '⚠️ 时段冲突！';
                }
            }
        });

        calendar.render();
    }

    function hasConflict(appt) {
        return appointments.some(function (a) {
            if (a.id === appt.id) return false;
            if (a.staffId !== appt.staffId) return false;
            if (a.status === 'cancelled') return false;
            if (!a.startTime || !appt.startTime) return false;
            return !(appt.endTime < a.startTime || appt.startTime > a.endTime);
        });
    }

    function bindEvents() {
        $('#btn-new-appt').on('click', function () {
            openApptModal(null, Store.formatDate(new Date()) + ' 09:00');
        });

        $('.filter-bar .badge-pink, .filter-bar .badge-green').on('click', function () {
            var type = $(this).data('project');
            filterCalendar(type);
        });
    }

    function filterCalendar(type) {
        if (!calendar) return;
        var filteredEvents = appointments;
        if (type !== 'all') {
            filteredEvents = appointments.filter(function (a) { return a.projectType === type; });
        }
        var events = filteredEvents.map(function (a) {
            var project = PROJECTS.find(function (p) { return p.type === a.projectType; }) || PROJECTS[0];
            return {
                id: a.id,
                title: a.projectName + ' - ' + a.motherName,
                start: a.startTime ? a.startTime.replace(' ', 'T') : null,
                end: a.endTime ? a.endTime.replace(' ', 'T') : null,
                backgroundColor: project.color,
                borderColor: project.color,
                extendedProps: { appt: a, project: project, conflict: hasConflict(a) }
            };
        }).filter(function (e) { return e.start; });

        calendar.removeAllEvents();
        events.forEach(function (e) { calendar.addEvent(e); });
    }

    function handleEventDrop(info) {
        var appt = info.event.extendedProps.appt;
        var newStart = info.event.startStr.replace('T', ' ').substring(0, 16);
        var newEnd = info.event.endStr.replace('T', ' ').substring(0, 16);
        var testAppt = { ...appt, startTime: newStart, endTime: newEnd };

        if (hasConflict(testAppt)) {
            App.showToast('时段冲突：该康复师此时间段已有预约', 'danger');
            info.revert();
            return;
        }

        appt.startTime = newStart;
        appt.endTime = newEnd;
        Store.updateRehab(appt).then(function () {
            App.showToast('预约时间已调整', 'success');
            if (calendar) {
                initCalendar();
            }
        });
    }

    function handleEventResize(info) {
        var appt = info.event.extendedProps.appt;
        var newEnd = info.event.endStr.replace('T', ' ').substring(0, 16);
        appt.endTime = newEnd;
        Store.updateRehab(appt).then(function () {
            App.showToast('预约时长已调整', 'success');
        });
    }

    function openApptDetail(appt, project, conflict) {
        var mother = mothers.find(function (m) { return m.id === appt.motherId; });
        var therapist = staff.find(function (s) { return s.id === appt.staffId; });

        var html = '';
        if (conflict) {
            html += '<div class="alert alert-danger mb-3" style="border-radius:var(--radius-md);">' +
                '<i class="bi bi-exclamation-triangle-fill me-2"></i><strong>时段冲突警告</strong>：该预约与康复师其他安排重叠，请调整时间。' +
                '</div>';
        }

        html += '<div class="row g-3">' +
            '<div class="col-md-6">' +
            '<div class="p-3 rounded" style="background:var(--color-primary-lighter);">' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">项目：</div><div class="col-sm-8"><strong style="color:' + project.color + ';"><i class="bi ' + project.icon + ' me-1"></i>' + project.name + '</strong></div></div>' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">开始时间：</div><div class="col-sm-8">' + appt.startTime + '</div></div>' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">结束时间：</div><div class="col-sm-8">' + appt.endTime + '</div></div>' +
            '<div class="row"><div class="col-sm-4 text-muted">康复师：</div><div class="col-sm-8">' + (therapist ? therapist.name : appt.staffName) + '</div></div>' +
            '</div></div>' +
            '<div class="col-md-6">' +
            '<div class="p-3 rounded" style="background:var(--color-primary-lighter);">' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">产妇：</div><div class="col-sm-8"><strong>' + (mother ? mother.name : appt.motherName) + '</strong></div></div>' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">房间：</div><div class="col-sm-8">' + (mother ? mother.roomNumber : '') + '</div></div>' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">疗程进度：</div><div class="col-sm-8">' + (appt.sessionNumber || 1) + ' / ' + (appt.totalSessions || 10) + ' 次</div></div>' +
            '<div class="row"><div class="col-sm-4 text-muted">状态：</div><div class="col-sm-8"><span class="' + (appt.status === 'completed' ? 'badge-green' : 'badge-blue') + '">' + (appt.status === 'completed' ? '已完成' : '待执行') + '</span></div></div>' +
            '</div></div></div>';

        if (appt.progressNote) {
            html += '<div class="divider-pink"></div><h6 class="mb-2 text-primary-pink"><i class="bi bi-journal-text me-1"></i>本次记录</h6>' +
                '<div class="p-3 rounded" style="background:var(--color-bg);">' + appt.progressNote + '</div>';
        }

        if (appt.status !== 'completed') {
            html += '<div class="divider-pink"></div>' +
                '<label class="form-label"><i class="bi bi-pencil-square me-1"></i>更新康复进度</label>' +
                '<textarea class="form-control" id="progress-note" rows="3" placeholder="本次康复效果、产妇反馈...">' + (appt.progressNote || '') + '</textarea>';
        }

        var footerHtml = '';
        if (appt.status !== 'completed') {
            footerHtml += '<button class="btn btn-success" id="btn-complete" style="border-radius:20px;padding:8px 20px;"><i class="bi bi-check2-circle me-1"></i>标记完成</button>';
            footerHtml += '<button class="btn btn-pink" id="btn-save-note"><i class="bi bi-save me-1"></i>保存记录</button>';
        }
        footerHtml += '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">关闭</button>';

        App.showGlobalModal(
            project.name + ' - ' + (mother ? mother.name : appt.motherName),
            html,
            footerHtml,
            function () {
                $('#btn-complete').on('click', function () {
                    appt.status = 'completed';
                    appt.progressNote = $('#progress-note').val() || appt.progressNote;
                    Store.updateRehab(appt).then(function () {
                        App.closeModal();
                        App.showToast('康复项目已标记为完成', 'success');
                        render();
                    });
                });
                $('#btn-save-note').on('click', function () {
                    appt.progressNote = $('#progress-note').val();
                    Store.updateRehab(appt).then(function () {
                        App.closeModal();
                        App.showToast('康复记录已保存', 'success');
                        render();
                    });
                });
            }
        );
    }

    function openApptModal(existingAppt, defaultStart) {
        var checkedInMothers = mothers.filter(function (m) {
            var mdate = new Date(m.checkInDate);
            var today = new Date(Store.formatDate(new Date()));
            return mdate <= today;
        });

        var startDateTime = defaultStart || Store.formatDate(new Date()) + ' 09:00';
        var defaultEnd = addMinutes(startDateTime, 45);

        var html = '<div class="row g-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 选择产妇</label>' +
            '<select class="form-select" id="ra-mother">' +
            checkedInMothers.map(function (m) {
                return '<option value="' + m.id + '">' + m.name + ' - ' + m.roomNumber + '</option>';
            }).join('') +
            '</select>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 康复项目</label>' +
            '<select class="form-select" id="ra-project">' +
            PROJECTS.map(function (p) {
                return '<option value="' + p.type + '" data-duration="' + p.duration + '">' + p.name + '（' + p.duration + '分钟）</option>';
            }).join('') +
            '</select>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 康复师</label>' +
            '<select class="form-select" id="ra-staff">' +
            staff.map(function (s) {
                return '<option value="' + s.id + '">' + s.name + '</option>';
            }).join('') +
            '</select>' +
            '</div>' +
            '<div class="col-md-3">' +
            '<label class="form-label">疗程</label>' +
            '<select class="form-select" id="ra-sessions"><option>10次</option><option>12次</option><option>15次</option><option>5次</option></select>' +
            '</div>' +
            '<div class="col-md-3">' +
            '<label class="form-label">当前次数</label>' +
            '<input type="number" class="form-control" id="ra-session-num" value="1" min="1" max="20">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 开始时间</label>' +
            '<input type="datetime-local" class="form-control" id="ra-start" value="' + startDateTime.replace(' ', 'T') + '">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 结束时间</label>' +
            '<input type="datetime-local" class="form-control" id="ra-end" value="' + defaultEnd.replace(' ', 'T') + '">' +
            '</div>' +
            '<div class="col-12">' +
            '<label class="form-label">备注</label>' +
            '<textarea class="form-control" id="ra-note" rows="2" placeholder="特殊需求或备注..."></textarea>' +
            '</div>' +
            '</div>';

        var footerHtml = '<button class="btn btn-pink" id="btn-submit-appt"><i class="bi bi-check2 me-1"></i>' + (existingAppt ? '保存修改' : '确认预约') + '</button>' +
            '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">取消</button>';

        App.showGlobalModal(
            existingAppt ? '修改康复预约' : '新建康复预约',
            html,
            footerHtml,
            function () {
                $('#ra-project').on('change', function () {
                    var dur = parseInt($('#ra-project option:selected').data('duration'));
                    var startVal = $('#ra-start').val();
                    if (startVal) {
                        var endTime = addMinutes(startVal.replace('T', ' '), dur);
                        $('#ra-end').val(endTime.replace(' ', 'T'));
                    }
                });
                $('#ra-start').on('change', function () {
                    var dur = parseInt($('#ra-project option:selected').data('duration'));
                    var startVal = $(this).val();
                    if (startVal) {
                        var endTime = addMinutes(startVal.replace('T', ' '), dur);
                        $('#ra-end').val(endTime.replace(' ', 'T'));
                    }
                });
                $('#btn-submit-appt').on('click', function () {
                    submitAppt(existingAppt);
                });
            }
        );
    }

    function addMinutes(dateStr, minutes) {
        var d = new Date(dateStr);
        d.setMinutes(d.getMinutes() + minutes);
        var y = d.getFullYear();
        var mo = String(d.getMonth() + 1).padStart(2, '0');
        var da = String(d.getDate()).padStart(2, '0');
        var h = String(d.getHours()).padStart(2, '0');
        var mi = String(d.getMinutes()).padStart(2, '0');
        return y + '-' + mo + '-' + da + ' ' + h + ':' + mi;
    }

    function submitAppt(existingAppt) {
        var motherId = $('#ra-mother').val();
        var projectType = $('#ra-project').val();
        var staffId = $('#ra-staff').val();
        var sessions = parseInt($('#ra-sessions').val()) || 10;
        var sessionNum = parseInt($('#ra-session-num').val()) || 1;
        var startRaw = $('#ra-start').val();
        var endRaw = $('#ra-end').val();
        var note = $('#ra-note').val();

        if (!motherId || !projectType || !staffId || !startRaw || !endRaw) {
            App.showToast('请完善预约信息', 'warning');
            return;
        }

        var startTime = startRaw.replace('T', ' ');
        var endTime = endRaw.replace('T', ' ');

        if (startTime >= endTime) {
            App.showToast('结束时间必须晚于开始时间', 'warning');
            return;
        }

        var mother = mothers.find(function (m) { return m.id === motherId; });
        var therapist = staff.find(function (s) { return s.id === staffId; });
        var project = PROJECTS.find(function (p) { return p.type === projectType; });
        if (!mother || !therapist || !project) return;

        var checkId = existingAppt ? existingAppt.id : null;
        Store.checkRehabConflict(staffId, startTime, endTime, checkId).then(function (hasConflict) {
            if (hasConflict) {
                App.showToast('时段冲突：该康复师此时间段已有预约', 'danger');
                return;
            }

            var data = {
                id: existingAppt ? existingAppt.id : Store.generateId(),
                motherId: motherId,
                motherName: mother.name,
                staffId: staffId,
                staffName: therapist.name,
                storeId: App.state.storeId,
                projectType: projectType,
                projectName: project.name,
                startTime: startTime,
                endTime: endTime,
                duration: parseInt((new Date(endTime) - new Date(startTime)) / 60000),
                status: existingAppt ? existingAppt.status : 'scheduled',
                sessionNumber: sessionNum,
                totalSessions: sessions,
                progressNote: note
            };

            (existingAppt ? Store.updateRehab(data) : Store.addRehab(data)).then(function () {
                App.closeModal();
                App.showToast('康复预约' + (existingAppt ? '已更新' : '成功！') + ' ' + project.name + ' - ' + startTime, 'success');
                render();
            });
        });
    }

    return { render: render };
})();
