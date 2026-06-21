var Booking = window.Booking = (function () {
    var typeFilter = 'all';
    var viewMode = 'single';
    var selectedStoreIds = [];
    var rooms = [];
    var bookings = [];
    var mothers = [];
    var allStores = [];
    var calendar = null;
    var conflictBookings = new Set();

    var STATUS_LABELS = {
        idle: '空闲',
        booked: '已预订',
        occupied: '已入住',
        maintenance: '维修中'
    };

    var STATUS_COLORS = {
        idle: '#52c41a',
        booked: '#faad14',
        occupied: '#ff4d4f',
        maintenance: '#8c8c8c',
        conflict: '#ff0000'
    };

    var TYPE_LABELS = {
        luxury: '豪华套房',
        standard: '标准套房'
    };

    function render() {
        var storeId = App.state.storeId;
        if (!storeId) return;

        if (selectedStoreIds.length === 0) {
            selectedStoreIds = [storeId];
        }

        Promise.all([
            Store.getAllStores().then(function (stores) {
                allStores = stores || [];
                var ids = viewMode === 'all'
                    ? stores.map(function (s) { return s.id; })
                    : selectedStoreIds;
                return Promise.all(ids.map(function (id) {
                    return Promise.all([
                        Store.getRoomsByStore(id),
                        Store.getBookingsByStore(id),
                        Store.getMothersByStore(id)
                    ]);
                }));
            })
        ]).then(function (results) {
            rooms = [];
            bookings = [];
            mothers = [];
            results[0].forEach(function (r) {
                rooms = rooms.concat(r[0] || []);
                bookings = bookings.concat(r[1] || []);
                mothers = mothers.concat(r[2] || []);
            });
            detectAllConflicts();
            renderPage();
        }).catch(function (err) {
            console.error('加载房态数据失败:', err);
            $('#app-content').html('<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>数据加载失败，请刷新重试</p></div>');
        });
    }

    function detectAllConflicts() {
        conflictBookings = new Set();
        var roomBookings = {};
        bookings.forEach(function (b) {
            if (!roomBookings[b.roomId]) roomBookings[b.roomId] = [];
            if (b.status === 'confirmed' || b.status === 'checkedIn' || b.status === 'pending') {
                roomBookings[b.roomId].push(b);
            }
        });
        Object.keys(roomBookings).forEach(function (roomId) {
            var list = roomBookings[roomId];
            for (var i = 0; i < list.length; i++) {
                for (var j = i + 1; j < list.length; j++) {
                    if (datesOverlap(list[i], list[j])) {
                        conflictBookings.add(list[i].id);
                        conflictBookings.add(list[j].id);
                    }
                }
            }
        });
    }

    function datesOverlap(a, b) {
        return a.startDate < b.endDate && b.startDate < a.endDate;
    }

    function renderPage() {
        var html = '';
        html += renderPageHeader();
        html += renderStatCards();
        html += renderFilterBar();
        html += renderLegend();
        html += renderCalendar();

        $('#app-content').html(html);
        setTimeout(initCalendar, 50);
        bindEvents();
    }

    function renderPageHeader() {
        var title = viewMode === 'all' ? '全部门店合并视图' : App.state.storeName;
        return App.renderPageHeader('bi-grid-1x2', '房态看板', title);
    }

    function renderStatCards() {
        var total = rooms.length;
        var idle = rooms.filter(function (r) { return r.status === 'idle'; }).length;
        var booked = rooms.filter(function (r) { return r.status === 'booked'; }).length;
        var occupied = rooms.filter(function (r) { return r.status === 'occupied'; }).length;
        var maintenance = rooms.filter(function (r) { return r.status === 'maintenance'; }).length;
        var occupancyRate = total > 0 ? Math.round((occupied + booked) / total * 100) : 0;
        var conflictCount = conflictBookings.size;

        return '<div class="row g-3 mb-4 fade-in">' +
            '<div class="col-xl-2 col-lg-4 col-md-4 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon pink"><i class="bi bi-house-door"></i></div>' +
            '<div class="stat-value">' + total + '</div>' +
            '<div class="stat-label">房间总数</div>' +
            '</div></div>' +
            '<div class="col-xl-2 col-lg-4 col-md-4 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon green"><i class="bi bi-check-circle"></i></div>' +
            '<div class="stat-value">' + idle + '</div>' +
            '<div class="stat-label">空闲可订</div>' +
            '</div></div>' +
            '<div class="col-xl-2 col-lg-4 col-md-4 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon yellow"><i class="bi bi-calendar-check"></i></div>' +
            '<div class="stat-value">' + booked + '</div>' +
            '<div class="stat-label">已预订</div>' +
            '</div></div>' +
            '<div class="col-xl-2 col-lg-4 col-md-4 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon red"><i class="bi bi-person-fill"></i></div>' +
            '<div class="stat-value">' + occupied + '</div>' +
            '<div class="stat-label">已入住</div>' +
            '</div></div>' +
            '<div class="col-xl-2 col-lg-4 col-md-4 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon blue"><i class="bi bi-wrench"></i></div>' +
            '<div class="stat-value">' + maintenance + '</div>' +
            '<div class="stat-label">维修中</div>' +
            '</div></div>' +
            (conflictCount > 0 ?
                '<div class="col-xl-2 col-lg-4 col-md-4 col-sm-6 col-6">' +
                '<div class="stat-card" style="border:2px solid #ff4d4f;">' +
                '<div class="stat-icon red" style="background:#ff4d4f;"><i class="bi bi-exclamation-triangle"></i></div>' +
                '<div class="stat-value" style="color:#ff4d4f;">' + conflictCount + '</div>' +
                '<div class="stat-label" style="color:#ff4d4f;">预订冲突</div>' +
                '</div></div>' :
                '<div class="col-xl-2 col-lg-4 col-md-4 col-sm-6 col-6">' +
                '<div class="stat-card">' +
                '<div class="stat-icon pink"><i class="bi bi-graph-up"></i></div>' +
                '<div class="stat-value">' + occupancyRate + '%</div>' +
                '<div class="stat-label">入住率</div>' +
                '</div></div>') +
            '</div>';
    }

    function renderFilterBar() {
        var today = Store.formatDate(new Date());
        var storeOptions = allStores.map(function (s) {
            return '<option value="' + s.id + '"' +
                (selectedStoreIds.indexOf(s.id) >= 0 ? ' selected' : '') +
                '>' + s.name + '</option>';
        }).join('');

        return '<div class="filter-bar fade-in" style="flex-wrap:wrap;gap:10px;">' +
            '<span class="badge-pink"><i class="bi bi-calendar3 me-1"></i>' + today + '</span>' +
            '<select class="form-select form-select-sm" id="room-type-filter" style="width:auto;">' +
            '<option value="all"' + (typeFilter === 'all' ? ' selected' : '') + '>全部房型</option>' +
            '<option value="luxury"' + (typeFilter === 'luxury' ? ' selected' : '') + '>豪华套房</option>' +
            '<option value="standard"' + (typeFilter === 'standard' ? ' selected' : '') + '>标准套房</option>' +
            '</select>' +
            '<div class="btn-group btn-group-sm" role="group">' +
            '<button type="button" class="btn btn-sm ' + (viewMode === 'single' ? 'btn-pink' : 'btn-outline-pink') + '" id="view-single">单门店</button>' +
            '<button type="button" class="btn btn-sm ' + (viewMode === 'multi' ? 'btn-pink' : 'btn-outline-pink') + '" id="view-multi">多门店</button>' +
            '<button type="button" class="btn btn-sm ' + (viewMode === 'all' ? 'btn-pink' : 'btn-outline-pink') + '" id="view-all">全部门店</button>' +
            '</div>' +
            (viewMode === 'multi' ?
                '<select class="form-select form-select-sm" id="store-multi-select" multiple style="width:auto;min-width:180px;height:36px;">' +
                storeOptions +
                '</select>' : '') +
            '<button class="btn btn-sm btn-soft-pink" id="btn-new-booking-top">' +
            '<i class="bi bi-calendar-plus me-1"></i>新建预订</button>' +
            '</div>';
    }

    function renderLegend() {
        return '<div class="room-legend fade-in mb-3">' +
            '<div class="legend-item"><div class="legend-dot room-idle"></div>空闲</div>' +
            '<div class="legend-item"><div class="legend-dot room-booked"></div>已预订</div>' +
            '<div class="legend-item"><div class="legend-dot room-occupied"></div>已入住</div>' +
            '<div class="legend-item"><div class="legend-dot room-maintenance"></div>维修中</div>' +
            '<div class="legend-item" style="background:#fff1f0;border:1px solid #ff7875;"><i class="bi bi-exclamation-triangle-fill" style="color:#ff4d4f;"></i>预订冲突（持续警示）</div>' +
            '</div>';
    }

    function renderCalendar() {
        return '<div class="card-pink fade-in">' +
            '<div class="card-pink-header">' +
            '<h5 class="card-pink-title"><i class="bi bi-calendar-month"></i>月度房态热力图</h5>' +
            '<div><small class="text-muted">拖拽事件可调整预订日期，点击日期可快速预订</small></div>' +
            '</div>' +
            '<div class="card-pink-body">' +
            '<div id="booking-calendar" style="min-height:600px;"></div>' +
            '</div></div>';
    }

    function initCalendar() {
        var calendarEl = document.getElementById('booking-calendar');
        if (!calendarEl) return;
        if (calendar) {
            calendar.destroy();
        }

        var events = buildCalendarEvents();
        var resources = buildResources();

        var calendarConfig = {
            initialView: viewMode === 'all' || viewMode === 'multi' ? 'resourceTimelineMonth' : 'dayGridMonth',
            locale: 'zh-cn',
            firstDay: 1,
            height: 'auto',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,resourceTimelineMonth,resourceTimelineWeek'
            },
            buttonText: {
                today: '今天',
                month: '月视图',
                week: '周视图'
            },
            editable: true,
            selectable: true,
            selectMirror: true,
            dayMaxEvents: true,
            eventResizableFromStart: true,
            resources: resources.length > 0 ? resources : null,
            events: events,
            eventDidMount: function (info) {
                if (info.event.extendedProps && info.event.extendedProps.isConflict) {
                    info.el.style.background = 'repeating-linear-gradient(45deg,#ff4d4f,#ff4d4f 6px,#ff7875 6px,#ff7875 12px)';
                    info.el.style.border = '2px solid #ff0000';
                    info.el.style.color = '#fff';
                    info.el.style.fontWeight = 'bold';
                    var warnIcon = document.createElement('span');
                    warnIcon.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> ';
                    info.el.prepend(warnIcon);
                    info.el.title = '⚠️ 预订冲突：该房间此时段存在重复预订！';
                }
            },
            select: function (info) {
                var storeId = App.state.storeId;
                if (info.resource && info.resource.extendedProps) {
                    storeId = info.resource.extendedProps.storeId || storeId;
                }
                openQuickBooking(info.startStr.substring(0, 10), info.endStr ? info.endStr.substring(0, 10) : null, info.resource ? info.resource.id : null, storeId);
            },
            eventClick: function (info) {
                info.jsEvent.preventDefault();
                if (info.event.extendedProps && info.event.extendedProps.bookingId) {
                    openBookingDetail(info.event.extendedProps.bookingId);
                }
            },
            eventDrop: function (info) {
                handleEventDrop(info);
            },
            eventResize: function (info) {
                handleEventDrop(info);
            }
        };

        calendar = new FullCalendar.Calendar(calendarEl, calendarConfig);
        calendar.render();
    }

    function buildResources() {
        if (viewMode === 'single') return [];
        var ids = viewMode === 'all' ? allStores.map(function (s) { return s.id; }) : selectedStoreIds;
        var res = [];
        allStores.forEach(function (s) {
            if (ids.indexOf(s.id) >= 0) {
                res.push({
                    id: s.id,
                    title: s.name,
                    extendedProps: { storeId: s.id }
                });
            }
        });
        return res;
    }

    function buildCalendarEvents() {
        var events = [];
        var filteredRooms = rooms;
        if (typeFilter !== 'all') {
            filteredRooms = rooms.filter(function (r) { return r.type === typeFilter; });
        }
        var roomMap = {};
        filteredRooms.forEach(function (r) { roomMap[r.id] = r; });

        bookings.forEach(function (b) {
            if (!roomMap[b.roomId]) return;
            if (b.status !== 'confirmed' && b.status !== 'checkedIn' && b.status !== 'pending') return;

            var room = roomMap[b.roomId];
            var isConflict = conflictBookings.has(b.id);
            var status = b.status === 'checkedIn' ? 'occupied' : 'booked';
            var color = isConflict ? STATUS_COLORS.conflict : STATUS_COLORS[status];
            var mother = mothers.find(function (m) { return m.id === b.motherId; });
            var store = allStores.find(function (s) { return s.id === b.storeId; });

            var evt = {
                id: b.id,
                title: (isConflict ? '⚠️ ' : '') + room.roomNumber + ' - ' + (mother ? mother.name : b.motherName) +
                    (viewMode !== 'single' && store ? ' [' + store.name + ']' : ''),
                start: b.startDate,
                end: Store.addDays(b.endDate, 1),
                allDay: true,
                backgroundColor: color,
                borderColor: isConflict ? '#ff0000' : color,
                textColor: isConflict ? '#fff' : '#fff',
                extendedProps: {
                    bookingId: b.id,
                    roomId: b.roomId,
                    storeId: b.storeId,
                    isConflict: isConflict,
                    roomNumber: room.roomNumber,
                    motherName: mother ? mother.name : b.motherName
                }
            };

            if (viewMode === 'all' || viewMode === 'multi') {
                evt.resourceId = b.storeId;
            }
            events.push(evt);
        });

        rooms.forEach(function (r) {
            if (r.status === 'maintenance') {
                var evt = {
                    id: 'maint_' + r.id,
                    title: '🔧 ' + r.roomNumber + ' 维修中',
                    start: Store.formatDate(new Date()),
                    allDay: true,
                    backgroundColor: STATUS_COLORS.maintenance,
                    borderColor: STATUS_COLORS.maintenance,
                    textColor: '#fff',
                    editable: false,
                    extendedProps: { isMaintenance: true }
                };
                if (viewMode !== 'single') {
                    evt.resourceId = r.storeId;
                }
                events.push(evt);
            }
        });

        return events;
    }

    function handleEventDrop(info) {
        var bookingId = info.event.extendedProps && info.event.extendedProps.bookingId;
        if (!bookingId) {
            info.revert();
            return;
        }
        var booking = bookings.find(function (b) { return b.id === bookingId; });
        if (!booking) {
            info.revert();
            return;
        }
        var newStart = info.event.startStr.substring(0, 10);
        var newEnd = info.event.end ? Store.addDays(info.event.endStr.substring(0, 10), -1) : newStart;
        if (newStart >= newEnd) newEnd = Store.addDays(newStart, 27);

        Store.checkBookingConflict(booking.roomId, newStart, newEnd, booking.id).then(function (hasConflict) {
            if (hasConflict) {
                App.showToast('拖拽失败：新日期与其他预订冲突', 'danger');
                info.revert();
                conflictBookings.add(booking.id);
                if (calendar) calendar.refetchEvents();
                return;
            }
            booking.startDate = newStart;
            booking.endDate = newEnd;
            Store.updateBooking(booking).then(function () {
                var mother = mothers.find(function (m) { return m.id === booking.motherId; });
                if (mother) {
                    mother.checkInDate = newStart;
                    mother.checkOutDate = newEnd;
                    Store.updateMother(mother);
                }
                App.showToast('预订日期已更新', 'success');
                detectAllConflicts();
                if (calendar) calendar.refetchEvents();
                renderStatCardsRefresh();
            });
        });
    }

    function renderStatCardsRefresh() {
        var total = rooms.length;
        var idle = rooms.filter(function (r) { return r.status === 'idle'; }).length;
        var booked = rooms.filter(function (r) { return r.status === 'booked'; }).length;
        var occupied = rooms.filter(function (r) { return r.status === 'occupied'; }).length;
        var maintenance = rooms.filter(function (r) { return r.status === 'maintenance'; }).length;
        var occupancyRate = total > 0 ? Math.round((occupied + booked) / total * 100) : 0;
        var conflictCount = conflictBookings.size;

        var html = renderStatCards();
        $('#app-content .row.g-3.mb-4').first().replaceWith(html);
    }

    function openQuickBooking(startDate, endDate, roomId, storeId) {
        if (!startDate) startDate = Store.formatDate(new Date());
        if (!endDate) endDate = Store.addDays(startDate, 27);

        var targetRooms = roomId
            ? rooms.filter(function (r) { return r.id === roomId; })
            : rooms.filter(function (r) { return r.storeId === storeId && r.status === 'idle'; });

        var roomOptions = targetRooms.map(function (r) {
            return '<option value="' + r.id + '">' + r.roomNumber + ' (' + TYPE_LABELS[r.type] + ')</option>';
        }).join('');

        var html = '<div class="row g-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 产妇姓名</label>' +
            '<input type="text" class="form-control" id="qb-mother" placeholder="请输入产妇姓名">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 联系电话</label>' +
            '<input type="tel" class="form-control" id="qb-phone" placeholder="请输入手机号">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">体质类型</label>' +
            '<select class="form-select" id="qb-constitution">' +
            '<option value="qi">气虚</option>' +
            '<option value="blood">血虚</option>' +
            '<option value="yin">阴虚</option>' +
            '<option value="yang">阳虚</option>' +
            '</select>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 选择房间</label>' +
            '<select class="form-select" id="qb-room">' + (roomOptions || '<option value="">暂无空闲房间</option>') + '</select>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 入住日期</label>' +
            '<input type="date" class="form-control" id="qb-start" value="' + startDate + '">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 离馆日期</label>' +
            '<input type="date" class="form-control" id="qb-end" value="' + endDate + '">' +
            '</div>' +
            '</div>';

        var footerHtml = '<button class="btn btn-pink" id="btn-submit-qb"><i class="bi bi-check2 me-1"></i>确认预订</button>' +
            '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">取消</button>';

        App.showGlobalModal(
            '快速预订',
            html,
            footerHtml,
            function () {
                $('#qb-start').on('change', function () {
                    var s = $(this).val();
                    if (s) $('#qb-end').val(Store.addDays(s, 27));
                });
                $('#btn-submit-qb').on('click', function () {
                    submitQuickBooking(storeId);
                });
            }
        );
    }

    function submitQuickBooking(storeId) {
        var motherName = $('#qb-mother').val().trim();
        var phone = $('#qb-phone').val().trim();
        var constitution = $('#qb-constitution').val();
        var roomId = $('#qb-room').val();
        var startDate = $('#qb-start').val();
        var endDate = $('#qb-end').val();

        if (!motherName) { App.showToast('请输入产妇姓名', 'warning'); return; }
        if (!phone) { App.showToast('请输入联系电话', 'warning'); return; }
        if (!roomId) { App.showToast('请选择房间', 'warning'); return; }
        if (!startDate || !endDate) { App.showToast('请选择入住和离馆日期', 'warning'); return; }

        var room = rooms.find(function (r) { return r.id === roomId; });
        if (!room) return;

        Store.checkBookingConflict(roomId, startDate, endDate, null).then(function (hasConflict) {
            if (hasConflict) {
                App.showToast('预订冲突：该房间此时间段已被占用', 'danger');
                conflictBookings.add('temp_' + roomId);
                if (calendar) calendar.refetchEvents();
                return;
            }

            var motherId = Store.generateId();
            var motherData = {
                id: motherId,
                name: motherName,
                phone: phone,
                constitution: constitution,
                checkInDate: startDate,
                checkOutDate: endDate,
                roomId: roomId,
                roomNumber: room.roomNumber,
                storeId: storeId || App.state.storeId,
                allergies: [],
                babyGender: '',
                babyBirthDate: '',
                emergencyContact: ''
            };

            var bookingData = {
                id: Store.generateId(),
                roomId: roomId,
                storeId: storeId || App.state.storeId,
                motherId: motherId,
                motherName: motherName,
                roomNumber: room.roomNumber,
                startDate: startDate,
                endDate: endDate,
                status: 'confirmed',
                createdAt: Store.formatDate(new Date())
            };

            Promise.all([Store.addMother(motherData), Store.addBooking(bookingData)]).then(function () {
                room.status = 'booked';
                mothers.push(motherData);
                bookings.push(bookingData);
                return Store.updateRoom(room);
            }).then(function () {
                App.closeModal();
                App.showToast('预订成功！', 'success');
                detectAllConflicts();
                render();
            });
        });
    }

    function openBookingDetail(bookingId) {
        var booking = bookings.find(function (b) { return b.id === bookingId; });
        if (!booking) return;
        var room = rooms.find(function (r) { return r.id === booking.roomId; });
        var mother = mothers.find(function (m) { return m.id === booking.motherId; });
        var isConflict = conflictBookings.has(booking.id);

        var html = '<div class="row g-3">';
        if (isConflict) {
            html += '<div class="col-12">' +
                '<div class="alert alert-danger" role="alert" style="background:#fff1f0;border:1px solid #ff7875;border-left:4px solid #ff4d4f;">' +
                '<i class="bi bi-exclamation-triangle-fill me-2"></i>' +
                '<strong>警告：该预订存在日期冲突！</strong>请立即调整日期或联系客户。' +
                '</div>' +
                '</div>';
        }
        html += '<div class="col-md-6">' +
            '<div class="stat-card" style="padding:16px;">' +
            '<div class="stat-value" style="font-size:22px;">' + (room ? room.roomNumber : '') + '</div>' +
            '<div class="stat-label">' + (room ? TYPE_LABELS[room.type] : '') + ' · ' +
            (booking.status === 'checkedIn' ? '已入住' : booking.status === 'confirmed' ? '已预订' : booking.status) + '</div>' +
            '</div></div>';
        html += '<div class="col-md-6">';
        if (mother) {
            html += '<h6 class="mb-3 text-primary-pink"><i class="bi bi-person-fill me-1"></i>产妇信息</h6>' +
                '<div class="p-3 rounded" style="background:var(--color-primary-lighter);">' +
                '<div class="row mb-2"><div class="col-sm-4 text-muted">姓名：</div><div class="col-sm-8"><strong>' + mother.name + '</strong></div></div>' +
                '<div class="row mb-2"><div class="col-sm-4 text-muted">电话：</div><div class="col-sm-8">' + mother.phone + '</div></div>' +
                '<div class="row mb-2"><div class="col-sm-4 text-muted">入住：</div><div class="col-sm-8">' + booking.startDate + '</div></div>' +
                '<div class="row"><div class="col-sm-4 text-muted">离馆：</div><div class="col-sm-8">' + booking.endDate + '</div></div>' +
                '</div>';
        }
        html += '</div></div>';

        html += '<div class="divider-pink"></div>' +
            '<h6 class="mb-3 text-primary-pink"><i class="bi bi-calendar3 me-1"></i>调整入住日期</h6>' +
            '<div class="row g-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label">入住日期</label>' +
            '<input type="date" class="form-control" id="bd-start" value="' + booking.startDate + '">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">离馆日期</label>' +
            '<input type="date" class="form-control" id="bd-end" value="' + booking.endDate + '">' +
            '</div></div>';

        var footerHtml = '<button class="btn btn-pink" id="btn-save-bd"><i class="bi bi-check2 me-1"></i>保存修改</button>';
        if (booking.status === 'confirmed') {
            footerHtml += '<button class="btn btn-success" id="btn-checkin-bd"><i class="bi bi-person-check me-1"></i>办理入住</button>';
        }
        if (booking.status === 'checkedIn') {
            footerHtml += '<button class="btn btn-info" id="btn-checkout-bd" style="color:#fff;"><i class="bi bi-box-arrow-right me-1"></i>办理离馆</button>';
        }
        footerHtml += '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">关闭</button>';

        App.showGlobalModal(
            '预订详情 - ' + (room ? room.roomNumber : ''),
            html,
            footerHtml,
            function () {
                $('#btn-save-bd').on('click', function () { saveBookingDetail(booking, room); });
                $('#btn-checkin-bd').on('click', function () { checkInBooking(booking, room); });
                $('#btn-checkout-bd').on('click', function () { checkOutBooking(booking, room); });
            }
        );
    }

    function saveBookingDetail(booking, room) {
        var s = $('#bd-start').val();
        var e = $('#bd-end').val();
        if (!s || !e) { App.showToast('请选择日期', 'warning'); return; }
        if (s >= e) { App.showToast('离馆日期必须晚于入住日期', 'warning'); return; }

        Store.checkBookingConflict(booking.roomId, s, e, booking.id).then(function (c) {
            if (c) {
                App.showToast('预订冲突：调整后日期与其他预订重叠', 'danger');
                return;
            }
            booking.startDate = s;
            booking.endDate = e;
            Store.updateBooking(booking).then(function () {
                var mother = mothers.find(function (m) { return m.id === booking.motherId; });
                if (mother) { mother.checkInDate = s; mother.checkOutDate = e; Store.updateMother(mother); }
                App.closeModal();
                App.showToast('日期已更新', 'success');
                detectAllConflicts();
                render();
            });
        });
    }

    function checkInBooking(booking, room) {
        booking.status = 'checkedIn';
        if (room) room.status = 'occupied';
        Promise.all([Store.updateBooking(booking), room ? Store.updateRoom(room) : Promise.resolve()]).then(function () {
            var mother = mothers.find(function (m) { return m.id === booking.motherId; });
            if (mother) { mother.checkInDate = Store.formatDate(new Date()); Store.updateMother(mother); }
            App.closeModal();
            App.showToast(booking.motherName + ' 已成功入住！', 'success');
            render();
        });
    }

    function checkOutBooking(booking, room) {
        booking.status = 'checkedOut';
        if (room) room.status = 'idle';
        Promise.all([Store.updateBooking(booking), room ? Store.updateRoom(room) : Promise.resolve()]).then(function () {
            App.closeModal();
            App.showToast(booking.motherName + ' 已办理离馆', 'success');
            render();
        });
    }

    function bindEvents() {
        $(document).off('change', '#room-type-filter');
        $(document).on('change', '#room-type-filter', function () {
            typeFilter = $(this).val();
            render();
        });

        $(document).off('click', '#view-single');
        $(document).on('click', '#view-single', function () {
            viewMode = 'single';
            selectedStoreIds = [App.state.storeId];
            render();
        });

        $(document).off('click', '#view-multi');
        $(document).on('click', '#view-multi', function () {
            viewMode = 'multi';
            if (selectedStoreIds.length === 0) selectedStoreIds = [App.state.storeId];
            render();
        });

        $(document).off('click', '#view-all');
        $(document).on('click', '#view-all', function () {
            viewMode = 'all';
            selectedStoreIds = allStores.map(function (s) { return s.id; });
            render();
        });

        $(document).off('change', '#store-multi-select');
        $(document).on('change', '#store-multi-select', function () {
            selectedStoreIds = $(this).val() || [];
            if (selectedStoreIds.length === 0) selectedStoreIds = [App.state.storeId];
            render();
        });

        $(document).off('click', '#btn-new-booking-top');
        $(document).on('click', '#btn-new-booking-top', function () {
            openQuickBooking(null, null, null, App.state.storeId);
        });
    }

    return { render: render };
})();
