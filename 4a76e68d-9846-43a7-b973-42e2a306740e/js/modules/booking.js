var Booking = window.Booking = (function () {
    var typeFilter = 'all';
    var rooms = [];
    var bookings = [];
    var mothers = [];
    var allStores = [];

    var STATUS_LABELS = {
        idle: '空闲',
        booked: '已预订',
        occupied: '已入住',
        maintenance: '维修中'
    };

    var STATUS_CLASSES = {
        idle: 'room-idle',
        booked: 'room-booked',
        occupied: 'room-occupied',
        maintenance: 'room-maintenance'
    };

    var TYPE_LABELS = {
        luxury: '豪华套房',
        standard: '标准套房'
    };

    function render() {
        var storeId = App.state.storeId;
        if (!storeId) return;

        Promise.all([
            Store.getRoomsByStore(storeId),
            Store.getBookingsByStore(storeId),
            Store.getMothersByStore(storeId),
            Store.getAllStores()
        ]).then(function (results) {
            rooms = results[0] || [];
            bookings = results[1] || [];
            mothers = results[2] || [];
            allStores = results[3] || [];
            renderPage();
        }).catch(function (err) {
            console.error('加载房态数据失败:', err);
            $('#app-content').html('<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>数据加载失败，请刷新重试</p></div>');
        });
    }

    function renderPage() {
        var html = '';
        html += renderPageHeader();
        html += renderStatCards();
        html += renderFilterBar();
        html += renderLegend();
        html += renderRoomGrid();

        $('#app-content').html(html);
        bindEvents();
    }

    function renderPageHeader() {
        return App.renderPageHeader('bi-grid-1x2', '房态看板', App.state.storeName);
    }

    function renderStatCards() {
        var total = rooms.length;
        var idle = rooms.filter(function (r) { return r.status === 'idle'; }).length;
        var booked = rooms.filter(function (r) { return r.status === 'booked'; }).length;
        var occupied = rooms.filter(function (r) { return r.status === 'occupied'; }).length;
        var maintenance = rooms.filter(function (r) { return r.status === 'maintenance'; }).length;

        var occupancyRate = total > 0 ? Math.round((occupied + booked) / total * 100) : 0;

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
            '<div class="col-xl-2 col-lg-4 col-md-4 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon pink"><i class="bi bi-graph-up"></i></div>' +
            '<div class="stat-value">' + occupancyRate + '%</div>' +
            '<div class="stat-label">入住率</div>' +
            '</div></div>' +
            '</div>';
    }

    function renderFilterBar() {
        var today = Store.formatDate(new Date());
        return '<div class="filter-bar fade-in">' +
            '<span class="badge-pink"><i class="bi bi-calendar3 me-1"></i>' + today + '</span>' +
            '<select class="form-select form-select-sm" id="room-type-filter">' +
            '<option value="all"' + (typeFilter === 'all' ? ' selected' : '') + '>全部房型</option>' +
            '<option value="luxury"' + (typeFilter === 'luxury' ? ' selected' : '') + '>豪华套房</option>' +
            '<option value="standard"' + (typeFilter === 'standard' ? ' selected' : '') + '>标准套房</option>' +
            '</select>' +
            '</div>';
    }

    function renderLegend() {
        return '<div class="room-legend fade-in mb-3">' +
            '<div class="legend-item"><div class="legend-dot room-idle"></div>空闲</div>' +
            '<div class="legend-item"><div class="legend-dot room-booked"></div>已预订</div>' +
            '<div class="legend-item"><div class="legend-dot room-occupied"></div>已入住</div>' +
            '<div class="legend-item"><div class="legend-dot room-maintenance"></div>维修中</div>' +
            '</div>';
    }

    function renderRoomGrid() {
        var filteredRooms = rooms;
        if (typeFilter !== 'all') {
            filteredRooms = rooms.filter(function (r) { return r.type === typeFilter; });
        }

        var luxuryRooms = filteredRooms.filter(function (r) { return r.type === 'luxury'; });
        var standardRooms = filteredRooms.filter(function (r) { return r.type === 'standard'; });

        var html = '<div class="fade-in">';

        if (luxuryRooms.length > 0) {
            html += '<div class="card-pink mb-4">' +
                '<div class="card-pink-header">' +
                '<h5 class="card-pink-title"><i class="bi bi-star-fill"></i>豪华套房（' + luxuryRooms.length + '间）</h5>' +
                '</div>' +
                '<div class="card-pink-body">' +
                '<div class="room-grid" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));">' +
                luxuryRooms.map(renderRoomCell).join('') +
                '</div></div></div>';
        }

        if (standardRooms.length > 0) {
            html += '<div class="card-pink mb-4">' +
                '<div class="card-pink-header">' +
                '<h5 class="card-pink-title"><i class="bi bi-house"></i>标准套房（' + standardRooms.length + '间）</h5>' +
                '</div>' +
                '<div class="card-pink-body">' +
                '<div class="room-grid" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));">' +
                standardRooms.map(renderRoomCell).join('') +
                '</div></div></div>';
        }

        if (filteredRooms.length === 0) {
            html += '<div class="empty-state"><i class="bi bi-house-slash"></i><p>暂无符合条件的房间</p></div>';
        }

        html += '</div>';
        return html;
    }

    function renderRoomCell(room) {
        var booking = findBookingForRoom(room.id);
        var extraInfo = '';
        if (booking && (room.status === 'booked' || room.status === 'occupied')) {
            var mother = mothers.find(function (m) { return m.id === booking.motherId; });
            extraInfo = '<div class="room-cell-status" style="font-size:10px;margin-top:2px;">' +
                (mother ? mother.name : '') +
                '</div>';
        }

        return '<div class="room-cell ' + STATUS_CLASSES[room.status] + '" data-room-id="' + room.id + '" ' +
            'style="box-shadow: inset 0 1px 2px rgba(255,255,255,0.25), 0 2px 4px rgba(0,0,0,0.1);">' +
            '<div class="room-cell-number">' + room.roomNumber + '</div>' +
            '<div class="room-cell-status">' + STATUS_LABELS[room.status] + '</div>' +
            extraInfo +
            '</div>';
    }

    function findBookingForRoom(roomId) {
        return bookings.find(function (b) {
            return b.roomId === roomId &&
                (b.status === 'confirmed' || b.status === 'checkedIn' || b.status === 'pending');
        });
    }

    function bindEvents() {
        $('#room-type-filter').on('change', function () {
            typeFilter = $(this).val();
            renderPage();
        });

        $('.room-cell').on('click', function () {
            var roomId = $(this).data('room-id');
            openRoomDetail(roomId);
        });
    }

    function openRoomDetail(roomId) {
        var room = rooms.find(function (r) { return r.id === roomId; });
        if (!room) return;

        var booking = findBookingForRoom(roomId);
        var mother = booking ? mothers.find(function (m) { return m.id === booking.motherId; }) : null;

        var html = '<div class="row g-3">';
        html += '<div class="col-md-6">';
        html += '<div class="stat-card" style="padding:16px;">' +
            '<div class="stat-icon ' + (room.status === 'idle' ? 'green' : room.status === 'booked' ? 'yellow' : room.status === 'occupied' ? 'red' : 'blue') + '" style="margin-bottom:8px;"><i class="bi bi-house-door"></i></div>' +
            '<div class="stat-value" style="font-size:22px;">' + room.roomNumber + '</div>' +
            '<div class="stat-label">' + TYPE_LABELS[room.type] + ' · ' + STATUS_LABELS[room.status] + '</div>' +
            '</div>';
        html += '</div>';

        html += '<div class="col-md-6">';
        if (booking) {
            html += '<h6 class="mb-3 text-primary-pink"><i class="bi bi-person-fill me-1"></i>产妇信息</h6>' +
                '<div class="p-3 rounded" style="background:var(--color-primary-lighter);">' +
                '<div class="row mb-2"><div class="col-sm-4 text-muted">姓名：</div><div class="col-sm-8"><strong>' + (mother ? mother.name : '') + '</strong></div></div>' +
                '<div class="row mb-2"><div class="col-sm-4 text-muted">联系电话：</div><div class="col-sm-8">' + (mother ? mother.phone : '') + '</div></div>' +
                '<div class="row mb-2"><div class="col-sm-4 text-muted">入住日期：</div><div class="col-sm-8">' + (booking ? booking.startDate : '') + '</div></div>' +
                '<div class="row mb-2"><div class="col-sm-4 text-muted">离馆日期：</div><div class="col-sm-8">' + (booking ? booking.endDate : '') + '</div></div>' +
                (mother && mother.babyGender ?
                    '<div class="row"><div class="col-sm-4 text-muted">宝宝：</div><div class="col-sm-8"><span class="badge-pink">' + mother.babyGender + '宝</span></div></div>' : '') +
                '</div>';
        } else {
            html += '<div class="empty-state" style="padding:32px 24px;">' +
                '<i class="bi bi-house-check"></i>' +
                '<p>房间当前空闲，可立即预订</p>' +
                '</div>';
        }
        html += '</div>';
        html += '</div>';

        if (booking && (room.status === 'booked' || room.status === 'occupied')) {
            html += '<div class="divider-pink"></div>' +
                '<h6 class="mb-3 text-primary-pink"><i class="bi bi-calendar3 me-1"></i>调整入住日期</h6>' +
                '<div class="row g-3">' +
                '<div class="col-md-6">' +
                '<label class="form-label">入住日期</label>' +
                '<input type="date" class="form-control" id="booking-start" value="' + booking.startDate + '">' +
                '</div>' +
                '<div class="col-md-6">' +
                '<label class="form-label">离馆日期</label>' +
                '<input type="date" class="form-control" id="booking-end" value="' + booking.endDate + '">' +
                '</div>' +
                '</div>';
        }

        var footerHtml = '';
        if (room.status === 'idle') {
            footerHtml = '<button class="btn btn-pink" id="btn-new-booking"><i class="bi bi-calendar-plus me-1"></i>新建预订</button>' +
                '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">关闭</button>';
        } else if (booking && (room.status === 'booked' || room.status === 'occupied')) {
            footerHtml = '<button class="btn btn-pink" id="btn-update-booking"><i class="bi bi-check2 me-1"></i>保存修改</button>';
            if (room.status === 'booked') {
                footerHtml += '<button class="btn btn-success" id="btn-checkin" style="border-radius:20px;padding:8px 20px;"><i class="bi bi-person-check me-1"></i>办理入住</button>';
            }
            if (room.status === 'occupied') {
                footerHtml += '<button class="btn btn-info" id="btn-checkout" style="border-radius:20px;padding:8px 20px;color:#fff;"><i class="bi bi-box-arrow-right me-1"></i>办理离馆</button>';
            }
            footerHtml += '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">关闭</button>';
        } else {
            footerHtml = '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">关闭</button>';
        }

        App.showGlobalModal(
            '房间详情 - ' + room.roomNumber,
            html,
            footerHtml,
            function () {
                if (room.status === 'idle') {
                    $('#btn-new-booking').on('click', function () {
                        App.closeModal();
                        openBookingForm(room);
                    });
                }
                if (booking && (room.status === 'booked' || room.status === 'occupied')) {
                    $('#btn-update-booking').on('click', function () {
                        updateBookingDates(booking, room);
                    });
                    $('#btn-checkin').on('click', function () {
                        checkIn(booking, room);
                    });
                    $('#btn-checkout').on('click', function () {
                        checkOut(booking, room);
                    });
                }
            }
        );
    }

    function openBookingForm(room) {
        var today = Store.formatDate(new Date());
        var defaultEnd = Store.addDays(today, 28);

        var html = '<div class="row g-3">' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 产妇姓名</label>' +
            '<input type="text" class="form-control" id="bf-mother" placeholder="请输入产妇姓名">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 联系电话</label>' +
            '<input type="tel" class="form-control" id="bf-phone" placeholder="请输入手机号">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">体质类型</label>' +
            '<select class="form-select" id="bf-constitution">' +
            '<option value="qi">气虚</option>' +
            '<option value="blood">血虚</option>' +
            '<option value="yin">阴虚</option>' +
            '<option value="yang">阳虚</option>' +
            '</select>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">紧急联系人</label>' +
            '<input type="text" class="form-control" id="bf-contact" placeholder="家属姓名">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 入住日期</label>' +
            '<input type="date" class="form-control" id="bf-start" value="' + today + '">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 离馆日期</label>' +
            '<input type="date" class="form-control" id="bf-end" value="' + defaultEnd + '">' +
            '</div>' +
            '<div class="col-12">' +
            '<label class="form-label">备注</label>' +
            '<textarea class="form-control" id="bf-remark" rows="2" placeholder="特殊需求或备注..."></textarea>' +
            '</div>' +
            '</div>';

        var footerHtml = '<button class="btn btn-pink" id="btn-submit-booking"><i class="bi bi-check2 me-1"></i>确认预订</button>' +
            '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">取消</button>';

        App.showGlobalModal(
            '新建预订 - ' + room.roomNumber + ' (' + TYPE_LABELS[room.type] + ')',
            html,
            footerHtml,
            function () {
                $('#bf-start').on('change', function () {
                    var start = $(this).val();
                    if (start) {
                        $('#bf-end').val(Store.addDays(start, 28));
                    }
                });

                $('#btn-submit-booking').on('click', function () {
                    submitBooking(room);
                });
            }
        );
    }

    function submitBooking(room) {
        var motherName = $('#bf-mother').val().trim();
        var phone = $('#bf-phone').val().trim();
        var constitution = $('#bf-constitution').val();
        var emergencyContact = $('#bf-contact').val().trim();
        var startDate = $('#bf-start').val();
        var endDate = $('#bf-end').val();

        if (!motherName) { App.showToast('请输入产妇姓名', 'warning'); return; }
        if (!phone) { App.showToast('请输入联系电话', 'warning'); return; }
        if (!startDate || !endDate) { App.showToast('请选择入住和离馆日期', 'warning'); return; }
        if (startDate >= endDate) { App.showToast('离馆日期必须晚于入住日期', 'warning'); return; }

        App.showToast('正在检测预订冲突...', 'info');

        Store.checkBookingConflict(room.id, startDate, endDate, null).then(function (hasConflict) {
            if (hasConflict) {
                App.showToast('预订冲突：该房间此时间段已被占用', 'danger');
                highlightConflictRoom(room.id);
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
                roomId: room.id,
                roomNumber: room.roomNumber,
                storeId: App.state.storeId,
                allergies: [],
                babyGender: '',
                babyBirthDate: '',
                emergencyContact: emergencyContact
            };

            var bookingData = {
                id: Store.generateId(),
                roomId: room.id,
                storeId: App.state.storeId,
                motherId: motherId,
                motherName: motherName,
                roomNumber: room.roomNumber,
                startDate: startDate,
                endDate: endDate,
                status: 'confirmed',
                createdAt: Store.formatDate(new Date())
            };

            Promise.all([
                Store.addMother(motherData),
                Store.addBooking(bookingData)
            ]).then(function () {
                room.status = 'booked';
                return Store.updateRoom(room);
            }).then(function () {
                App.closeModal();
                App.showToast('预订成功！' + motherName + ' 已预订房间 ' + room.roomNumber, 'success');
                render();
            }).catch(function (err) {
                console.error(err);
                App.showToast('预订失败，请重试', 'danger');
            });
        });
    }

    function highlightConflictRoom(roomId) {
        var $cell = $('.room-cell[data-room-id="' + roomId + '"]');
        $cell.addClass('conflict');
        setTimeout(function () { $cell.removeClass('conflict'); }, 3000);
    }

    function updateBookingDates(booking, room) {
        var startDate = $('#booking-start').val();
        var endDate = $('#booking-end').val();

        if (!startDate || !endDate) { App.showToast('请选择日期', 'warning'); return; }
        if (startDate >= endDate) { App.showToast('离馆日期必须晚于入住日期', 'warning'); return; }

        Store.checkBookingConflict(room.id, startDate, endDate, booking.id).then(function (hasConflict) {
            if (hasConflict) {
                App.showToast('预订冲突：调整后日期与其他预订重叠', 'danger');
                return;
            }
            booking.startDate = startDate;
            booking.endDate = endDate;
            Store.updateBooking(booking).then(function () {
                var mother = mothers.find(function (m) { return m.id === booking.motherId; });
                if (mother) {
                    mother.checkInDate = startDate;
                    mother.checkOutDate = endDate;
                    Store.updateMother(mother);
                }
                App.closeModal();
                App.showToast('日期已更新', 'success');
                render();
            });
        });
    }

    function checkIn(booking, room) {
        booking.status = 'checkedIn';
        room.status = 'occupied';
        Promise.all([Store.updateBooking(booking), Store.updateRoom(room)]).then(function () {
            var mother = mothers.find(function (m) { return m.id === booking.motherId; });
            if (mother) {
                mother.checkInDate = Store.formatDate(new Date());
                Store.updateMother(mother);
            }
            App.closeModal();
            App.showToast(booking.motherName + ' 已成功入住！', 'success');
            render();
        });
    }

    function checkOut(booking, room) {
        booking.status = 'checkedOut';
        room.status = 'idle';
        Promise.all([Store.updateBooking(booking), Store.updateRoom(room)]).then(function () {
            App.closeModal();
            App.showToast(booking.motherName + ' 已办理离馆，欢迎再次光临！', 'success');
            render();
        });
    }

    return { render: render };
})();
