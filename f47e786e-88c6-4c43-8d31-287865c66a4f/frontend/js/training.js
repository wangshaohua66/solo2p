const TrainingModule = {
    schedules: [...MockData.schedules],
    selectedCourse: null,
    currentWeekStart: null,
    viewMode: 'classroom',
    conflictCache: {},

    init() {
        this.currentWeekStart = this.getMonday(new Date());
        this.render();
    },

    getMonday(d) {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    },

    render() {
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <h5 class="mb-0"><i class="bi bi-calendar-week me-2 text-primary"></i>培训排课管理</h5>
                </div>
                <div class="col-md-9">
                    <div class="d-flex flex-wrap gap-2 justify-content-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" id="btn-prev-week">
                                <i class="bi bi-chevron-left"></i> 上周
                            </button>
                            <button class="btn btn-outline-primary" id="btn-today-week">本周</button>
                            <button class="btn btn-outline-primary" id="btn-next-week">
                                下周 <i class="bi bi-chevron-right"></i>
                            </button>
                        </div>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary ${this.viewMode === 'classroom' ? 'active' : ''}" data-view="classroom">教室视图</button>
                            <button class="btn btn-outline-secondary ${this.viewMode === 'field' ? 'active' : ''}" data-view="field">场地视图</button>
                        </div>
                        <button class="btn btn-primary btn-sm" id="btn-batch-schedule">
                            <i class="bi bi-plus-lg me-1"></i>批量排课
                        </button>
                        <button class="btn btn-success btn-sm" id="btn-auto-schedule">
                            <i class="bi bi-magic me-1"></i>智能排课
                        </button>
                    </div>
                </div>
            </div>

            <div class="calendar-container">
                <div class="calendar-sidebar">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span>可排课程</span>
                            <select class="form-select form-select-sm" style="width: auto;" id="course-filter-level">
                                <option value="">全部等级</option>
                                ${MockData.levels.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="card-body course-list scrollbar-thin" id="course-list">
                            ${this.renderCourseList()}
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">筛选条件</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label small fw-medium">专业方向</label>
                                <select class="form-select form-select-sm" id="filter-specialty">
                                    <option value="">全部专业</option>
                                    ${MockData.specialties.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-medium">参训站点</label>
                                <select class="form-select form-select-sm" id="filter-station">
                                    <option value="">全部站点</option>
                                    ${MockData.fireStations.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="mb-0">
                                <label class="form-label small fw-medium">课程类型</label>
                                <div class="d-flex gap-3">
                                    <div class="form-check form-check-sm">
                                        <input class="form-check-input" type="checkbox" id="filter-theory" checked>
                                        <label class="form-check-label small" for="filter-theory">理论课</label>
                                    </div>
                                    <div class="form-check form-check-sm">
                                        <input class="form-check-input" type="checkbox" id="filter-practical" checked>
                                        <label class="form-check-label small" for="filter-practical">实操课</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card border-warning">
                        <div class="card-header bg-warning text-dark">
                            <i class="bi bi-exclamation-triangle me-1"></i>冲突预警
                        </div>
                        <div class="card-body small" id="conflict-list">
                            <p class="text-muted mb-0">暂无冲突</p>
                        </div>
                    </div>
                </div>

                <div class="calendar-main">
                    <div class="card flex-1 d-flex flex-column">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span>
                                <i class="bi bi-calendar3 me-1"></i>
                                ${this.formatWeekRange()}
                            </span>
                            <span class="text-muted small" id="room-info"></span>
                        </div>
                        <div class="card-body p-0 flex-1 overflow-hidden">
                            <div class="week-calendar" id="week-calendar">
                                ${this.renderWeekCalendar()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="scheduleModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold">课程详情</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="schedule-modal-body"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">关闭</button>
                            <button type="button" class="btn btn-primary" id="btn-edit-schedule">编辑</button>
                            <button type="button" class="btn btn-danger" id="btn-delete-schedule">删除</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#page-training').html(html);
        this.bindEvents();
        this.checkConflicts();
    },

    renderCourseList() {
        const courses = MockData.trainingCourses;
        if (courses.length === 0) {
            return '<p class="text-muted small mb-0">暂无课程</p>';
        }

        return courses.map(course => {
            const level = MockData.levels.find(l => l.id === course.levelId);
            const specialty = MockData.specialties.find(s => s.id === course.specialtyId);
            return `
                <div class="course-item" draggable="true" data-course-id="${course.id}">
                    <div class="course-title">${course.title}</div>
                    <div class="course-meta d-flex justify-content-between align-items-center">
                        <span>
                            <span class="badge bg-${course.type === 'theory' ? 'primary' : 'success'} me-1">
                                ${course.type === 'theory' ? '理论' : '实操'}
                            </span>
                            ${course.duration}学时
                        </span>
                        <span class="badge bg-${level?.color || 'secondary'}">${level?.name || ''}</span>
                    </div>
                    <div class="course-meta mt-1">
                        <i class="bi bi-tag me-1"></i>${specialty?.name || ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderWeekCalendar() {
        const weekDates = AppCommon.getWeekDates(this.currentWeekStart);
        const startHour = 8;
        const endHour = 20;
        const hours = endHour - startHour;
        
        let html = '<div class="calendar-header time-col">时间</div>';
        
        weekDates.forEach((date, idx) => {
            const isToday = AppCommon.formatDate(date) === AppCommon.formatDate(new Date());
            html += `
                <div class="calendar-header ${isToday ? 'text-primary' : ''}">
                    <div>${AppCommon.getDayName(idx)}</div>
                    <div class="small ${isToday ? 'fw-bold' : 'text-muted'}">
                        ${date.getMonth() + 1}/${date.getDate()}
                    </div>
                </div>
            `;
        });

        for (let h = 0; h < hours; h++) {
            const hour = startHour + h;
            html += `<div class="time-slot">${String(hour).padStart(2, '0')}:00</div>`;
            
            for (let day = 0; day < 7; day++) {
                const date = weekDates[day];
                const cellId = `cell-${day}-${hour}`;
                const isToday = AppCommon.formatDate(date) === AppCommon.formatDate(new Date());
                
                html += `
                    <div class="day-cell ${isToday ? 'today' : ''}" 
                         data-day="${day}" 
                         data-hour="${hour}"
                         data-date="${AppCommon.formatDate(date)}"
                         id="${cellId}">
                    </div>
                `;
            }
        }

        return html;
    },

    renderSchedulesOnCalendar() {
        $('.calendar-event').remove();

        this.schedules.forEach(schedule => {
            const course = MockData.trainingCourses.find(c => c.id === schedule.courseId);
            if (!course) return;

            const level = MockData.levels.find(l => l.id === schedule.levelId);
            const rooms = [...MockData.classrooms, ...MockData.trainingFields];
            const room = rooms.find(r => r.id === schedule.roomId);

            const colorClass = level ? `event-level-${level.color}` : 'event-level-primary';
            const topPercent = ((schedule.startHour - 8) * 60) / 12 * 100;
            const heightPercent = ((schedule.endHour - schedule.startHour) * 60) / 12 * 100;

            const cell = $(`#cell-${schedule.dayIndex}-${Math.floor(schedule.startHour)}`);
            if (cell.length) {
                const cellOffset = schedule.startHour - Math.floor(schedule.startHour);
                const eventHtml = `
                    <div class="calendar-event ${colorClass}" 
                         style="top: ${cellOffset * 100}%; height: calc(${heightPercent}% - 4px);"
                         data-schedule-id="${schedule.id}">
                        <div class="event-title">${course.title}</div>
                        <div class="event-location">
                            <i class="bi bi-geo-alt me-1"></i>${room?.name || ''}
                        </div>
                    </div>
                `;
                cell.append(eventHtml);
            }
        });
    },

    formatWeekRange() {
        const weekDates = AppCommon.getWeekDates(this.currentWeekStart);
        const start = weekDates[0];
        const end = weekDates[6];
        return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
    },

    bindEvents() {
        const self = this;

        $('#btn-prev-week').on('click', () => {
            this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
            this.render();
        });

        $('#btn-next-week').on('click', () => {
            this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
            this.render();
        });

        $('#btn-today-week').on('click', () => {
            this.currentWeekStart = this.getMonday(new Date());
            this.render();
        });

        $('[data-view]').on('click', function() {
            self.viewMode = $(this).data('view');
            $('[data-view]').removeClass('active');
            $(this).addClass('active');
            self.checkConflicts();
        });

        $('.course-item').on('dragstart', function(e) {
            self.selectedCourse = $(this).data('course-id');
            e.originalEvent.dataTransfer.effectAllowed = 'move';
        });

        $('.day-cell').on('dragover', function(e) {
            e.preventDefault();
            $(this).addClass('drag-over');
        }).on('dragleave', function() {
            $(this).removeClass('drag-over');
        }).on('drop', function(e) {
            e.preventDefault();
            $(this).removeClass('drag-over');
            
            const dayIndex = $(this).data('day');
            const hour = $(this).data('hour');
            self.handleDrop(dayIndex, hour);
        });

        $('.day-cell').on('click', function() {
            const dayIndex = $(this).data('day');
            const hour = $(this).data('hour');
            self.showAddScheduleModal(dayIndex, hour);
        });

        $(document).on('click', '.calendar-event', function(e) {
            e.stopPropagation();
            const scheduleId = $(this).data('schedule-id');
            self.showScheduleDetail(scheduleId);
        });

        $('#btn-auto-schedule').on('click', () => {
            self.autoSchedule();
        });

        $('#btn-batch-schedule').on('click', () => {
            AppCommon.showAlert('批量排课功能开发中...', 'info');
        });

        $('#course-filter-level, #filter-specialty, #filter-station, #filter-theory, #filter-practical').on('change', () => {
            self.filterCourses();
        });
    },

    handleDrop(dayIndex, hour) {
        if (!this.selectedCourse) return;

        const course = MockData.trainingCourses.find(c => c.id === this.selectedCourse);
        if (!course) return;

        const endHour = hour + course.duration;
        
        const conflict = this.checkConflict(null, dayIndex, hour, endHour, course.defaultLocation === 'classroom' ? 'classroom' : 'field');
        
        if (conflict) {
            AppCommon.showAlert(`排课冲突：${conflict.reason}`, 'danger');
            return;
        }

        const newSchedule = {
            id: Date.now(),
            courseId: this.selectedCourse,
            roomId: course.defaultLocation === 'classroom' ? 1 : 101,
            dayIndex: dayIndex,
            startHour: hour,
            endHour: endHour,
            stationIds: [1],
            levelId: course.levelId
        };

        this.schedules.push(newSchedule);
        this.renderSchedulesOnCalendar();
        this.checkConflicts();
        AppCommon.showAlert(`已添加课程：${course.title}`, 'success');
        
        this.selectedCourse = null;
    },

    checkConflict(scheduleId, dayIndex, startHour, endHour, roomType) {
        const rooms = roomType === 'classroom' ? MockData.classrooms : MockData.trainingFields;
        
        for (const schedule of this.schedules) {
            if (schedule.id === scheduleId) continue;
            if (schedule.dayIndex !== dayIndex) continue;
            
            const room = [...MockData.classrooms, ...MockData.trainingFields].find(r => r.id === schedule.roomId);
            if (!room) continue;
            if (roomType === 'classroom' && room.type !== 'classroom') continue;
            if (roomType === 'field' && room.type !== 'field') continue;

            if (schedule.startHour < endHour && schedule.endHour > startHour) {
                const course = MockData.trainingCourses.find(c => c.id === schedule.courseId);
                return {
                    hasConflict: true,
                    reason: `与「${course?.title || '未知课程'}」在${room.name}时间重叠`,
                    schedule: schedule
                };
            }
        }

        return null;
    },

    checkConflicts() {
        const conflicts = [];
        const rooms = [...MockData.classrooms, ...MockData.trainingFields];

        for (let i = 0; i < this.schedules.length; i++) {
            for (let j = i + 1; j < this.schedules.length; j++) {
                const s1 = this.schedules[i];
                const s2 = this.schedules[j];

                if (s1.dayIndex !== s2.dayIndex) continue;
                if (s1.startHour >= s2.endHour || s1.endHour <= s2.startHour) continue;

                const r1 = rooms.find(r => r.id === s1.roomId);
                const r2 = rooms.find(r => r.id === s2.roomId);
                if (!r1 || !r2) continue;

                const commonStations = s1.stationIds.filter(id => s2.stationIds.includes(id));
                
                if (s1.roomId === s2.roomId || commonStations.length > 0) {
                    const c1 = MockData.trainingCourses.find(c => c.id === s1.courseId);
                    const c2 = MockData.trainingCourses.find(c => c.id === s2.courseId);
                    conflicts.push({
                        schedule1: s1,
                        schedule2: s2,
                        course1Name: c1?.title || '未知',
                        course2Name: c2?.title || '未知',
                        type: s1.roomId === s2.roomId ? '场地冲突' : '人员冲突'
                    });
                }
            }
        }

        const $conflictList = $('#conflict-list');
        if (conflicts.length === 0) {
            $conflictList.html('<p class="text-muted mb-0"><i class="bi bi-check-circle text-success me-1"></i>暂无冲突</p>');
        } else {
            $conflictList.html(conflicts.map(c => `
                <div class="border-start border-danger ps-2 py-1 mb-2">
                    <div class="text-danger fw-medium">${c.type}</div>
                    <div class="text-truncate" title="${c.course1Name}"><i class="bi bi-x me-1"></i>${c.course1Name}</div>
                    <div class="text-truncate" title="${c.course2Name}"><i class="bi bi-x me-1"></i>${c.course2Name}</div>
                </div>
            `).join(''));
        }

        return conflicts;
    },

    showScheduleDetail(scheduleId) {
        const schedule = this.schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        const course = MockData.trainingCourses.find(c => c.id === schedule.courseId);
        const level = MockData.levels.find(l => l.id === schedule.levelId);
        const room = [...MockData.classrooms, ...MockData.trainingFields].find(r => r.id === schedule.roomId);
        const stations = schedule.stationIds.map(id => MockData.fireStations.find(s => s.id === id)?.name).filter(Boolean).join('、');

        const html = `
            <div class="mb-3">
                <h6 class="fw-bold mb-2">${course?.title || '未知课程'}</h6>
                <span class="badge bg-${level?.color || 'secondary'} me-1">${level?.name || ''}</span>
                <span class="badge bg-${course?.type === 'theory' ? 'primary' : 'success'}">${course?.type === 'theory' ? '理论课' : '实操课'}</span>
            </div>
            <div class="row g-2 small">
                <div class="col-6">
                    <div class="text-muted">上课时间</div>
                    <div class="fw-medium">${AppCommon.getDayName(schedule.dayIndex)} ${String(schedule.startHour).padStart(2, '0')}:00 - ${String(schedule.endHour).padStart(2, '0')}:00</div>
                </div>
                <div class="col-6">
                    <div class="text-muted">课时</div>
                    <div class="fw-medium">${schedule.endHour - schedule.startHour}学时</div>
                </div>
                <div class="col-6">
                    <div class="text-muted">上课地点</div>
                    <div class="fw-medium">${room?.name || '未分配'}</div>
                </div>
                <div class="col-6">
                    <div class="text-muted">参训站点</div>
                    <div class="fw-medium">${stations || '未设置'}</div>
                </div>
            </div>
        `;

        $('#schedule-modal-body').html(html);
        const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
        modal.show();

        $('#btn-delete-schedule').off('click').on('click', () => {
            AppCommon.showConfirm('删除确认', '确定要删除此排课吗？', () => {
                this.schedules = this.schedules.filter(s => s.id !== scheduleId);
                this.renderSchedulesOnCalendar();
                this.checkConflicts();
                modal.hide();
                AppCommon.showAlert('排课已删除', 'success');
            });
        });
    },

    showAddScheduleModal(dayIndex, hour) {
        AppCommon.showAlert('点击左侧课程拖拽到日历中即可排课', 'info', 2000);
    },

    autoSchedule() {
        const unscheduled = MockData.trainingCourses.filter(c => 
            !this.schedules.some(s => s.courseId === c.id)
        );

        if (unscheduled.length === 0) {
            AppCommon.showAlert('所有课程均已排课', 'info');
            return;
        }

        let scheduledCount = 0;
        const rooms = [...MockData.classrooms, ...MockData.trainingFields];

        for (const course of unscheduled.slice(0, 3)) {
            let scheduled = false;
            
            for (let day = 0; day < 5 && !scheduled; day++) {
                for (let hour = 8; hour <= 17 && !scheduled; hour++) {
                    const endHour = hour + course.duration;
                    if (endHour > 20) continue;

                    const roomType = course.type === 'theory' ? 'classroom' : 'field';
                    const availableRooms = rooms.filter(r => 
                        r.type === (roomType === 'classroom' ? 'classroom' : 'field')
                    );

                    for (const room of availableRooms) {
                        const conflict = this.schedules.some(s => 
                            s.roomId === room.id &&
                            s.dayIndex === day &&
                            s.startHour < endHour &&
                            s.endHour > hour
                        );

                        if (!conflict) {
                            this.schedules.push({
                                id: Date.now() + Math.random(),
                                courseId: course.id,
                                roomId: room.id,
                                dayIndex: day,
                                startHour: hour,
                                endHour: endHour,
                                stationIds: [1],
                                levelId: course.levelId
                            });
                            scheduled = true;
                            scheduledCount++;
                            break;
                        }
                    }
                }
            }
        }

        this.renderSchedulesOnCalendar();
        this.checkConflicts();
        AppCommon.showAlert(`智能排课完成，新增 ${scheduledCount} 门课程`, 'success');
    },

    filterCourses() {
        const levelFilter = $('#course-filter-level').val();
        const specialtyFilter = $('#filter-specialty').val();
        const showTheory = $('#filter-theory').is(':checked');
        const showPractical = $('#filter-practical').is(':checked');

        $('.course-item').each(function() {
            const courseId = $(this).data('course-id');
            const course = MockData.trainingCourses.find(c => c.id === courseId);
            
            let visible = true;
            
            if (levelFilter && course.levelId != levelFilter) visible = false;
            if (specialtyFilter && course.specialtyId != specialtyFilter) visible = false;
            if (!showTheory && course.type === 'theory') visible = false;
            if (!showPractical && course.type === 'practical') visible = false;

            $(this).toggle(visible);
        });
    }
};
