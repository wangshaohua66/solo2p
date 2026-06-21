var Visitor = window.Visitor = (function () {
    var visitors = [];
    var mothers = [];
    var today = '';
    var selectedVisitorId = null;

    var BASE_TIME_SLOTS = ['10:00-10:30', '10:30-11:00', '14:00-14:30', '15:00-15:30', '16:00-16:30', '19:00-19:30'];

    function getRoomTimeSlots(roomNumber) {
        if (!roomNumber) return BASE_TIME_SLOTS.slice();
        var num = 0;
        var s = String(roomNumber);
        for (var i = 0; i < s.length; i++) num = (num * 31 + s.charCodeAt(i)) >>> 0;
        var offset = num % BASE_TIME_SLOTS.length;
        var slots = [];
        for (var j = 0; j < BASE_TIME_SLOTS.length; j++) {
            slots.push(BASE_TIME_SLOTS[(offset + j) % BASE_TIME_SLOTS.length]);
        }
        return slots;
    }

    var RELATIONS = ['丈夫', '母亲', '婆婆', '父亲', '姐妹', '兄弟', '朋友', '其他'];

    var STATUS_LABELS = {
        registered: '已预约',
        visiting: '探视中',
        completed: '已离园'
    };

    var STATUS_CLASSES = {
        registered: 'badge-blue',
        visiting: 'badge-yellow',
        completed: 'badge-green'
    };

    function render() {
        today = Store.formatDate(new Date());
        var storeId = App.state.storeId;
        if (!storeId) return;

        Promise.all([
            Store.getVisitorsByStore(storeId),
            Store.getMothersByStore(storeId)
        ]).then(function (results) {
            visitors = (results[0] || []).filter(function (v) { return v.visitDate === today; });
            mothers = results[1] || [];
            renderPage();
        }).catch(function (err) {
            console.error('加载探视数据失败:', err);
            $('#app-content').html('<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>数据加载失败，请刷新重试</p></div>');
        });
    }

    function renderPage() {
        var html = '';
        html += renderOvertimeWarning();
        html += renderPageHeader();
        html += renderStatCards();
        html += renderTodayVisitors();

        $('#app-content').html(html);
        bindEvents();
    }

    function renderOvertimeWarning() {
        var now = new Date();
        var nowMinutes = now.getHours() * 60 + now.getMinutes();
        var overstaying = visitors.filter(function (v) {
            if (v.status === 'visiting' && v.timeSlot) {
                var parts = v.timeSlot.split('-');
                if (parts.length >= 2) {
                    var endParts = parts[1].split(':');
                    var endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]) + 30;
                    return nowMinutes > endMinutes;
                }
            }
            return false;
        });

        if (overstaying.length === 0) return '';

        return '<div class="alert alert-warning d-flex align-items-center fade-in mb-3" style="border-radius:var(--radius-md);border-color:var(--color-warning);background:rgba(240,173,78,0.1);">' +
            '<i class="bi bi-exclamation-triangle-fill me-2" style="color:var(--color-warning);font-size:20px;"></i>' +
            '<div><strong>超时逗留提醒</strong>：<span class="badge bg-warning text-dark">' + overstaying.length + '</span> 位访客已超过探视时段30分钟以上，请提醒离园。</div>' +
            '</div>';
    }

    function renderPageHeader() {
        var actionsHtml = '<button class="btn btn-pink" id="btn-new-visit"><i class="bi bi-person-plus me-1"></i>预约探视</button>';
        return App.renderPageHeader('bi-people', '探视登记', App.state.storeName + ' · ' + today, actionsHtml);
    }

    function renderStatCards() {
        var total = visitors.length;
        var registered = visitors.filter(function (v) { return v.status === 'registered'; }).length;
        var visiting = visitors.filter(function (v) { return v.status === 'visiting'; }).length;
        var completed = visitors.filter(function (v) { return v.status === 'completed'; }).length;

        return '<div class="row g-3 mb-4 fade-in">' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon pink"><i class="bi bi-people-fill"></i></div>' +
            '<div class="stat-value">' + total + '</div>' +
            '<div class="stat-label">今日访客总数</div>' +
            '</div></div>' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon blue"><i class="bi bi-calendar-check"></i></div>' +
            '<div class="stat-value">' + registered + '</div>' +
            '<div class="stat-label">已预约</div>' +
            '</div></div>' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon yellow"><i class="bi bi-person-check-fill"></i></div>' +
            '<div class="stat-value">' + visiting + '</div>' +
            '<div class="stat-label">探视中</div>' +
            '</div></div>' +
            '<div class="col-xl-3 col-lg-6 col-md-6 col-sm-6 col-6">' +
            '<div class="stat-card">' +
            '<div class="stat-icon green"><i class="bi bi-check2-circle"></i></div>' +
            '<div class="stat-value">' + completed + '</div>' +
            '<div class="stat-label">已离园</div>' +
            '</div></div>' +
            '</div>';
    }

    function renderTodayVisitors() {
        var todayVisitors = visitors.slice().sort(function (a, b) {
            return a.timeSlot.localeCompare(b.timeSlot);
        });

        var html = '<div class="card-pink fade-in">' +
            '<div class="card-pink-header">' +
            '<h5 class="card-pink-title"><i class="bi bi-list-ul"></i>今日探视记录</h5>' +
            '</div>' +
            '<div class="card-pink-body">';

        if (todayVisitors.length === 0) {
            html += '<div class="empty-state"><i class="bi bi-inbox"></i><p>今日暂无探视记录</p></div>';
        } else {
            html += '<div class="table-responsive">' +
                '<table class="table visitor-table">' +
                '<thead><tr>' +
                '<th>访客</th>' +
                '<th>关系</th>' +
                '<th>产妇/房间</th>' +
                '<th>探视时段</th>' +
                '<th>状态</th>' +
                '<th>入园时间</th>' +
                '<th>操作</th>' +
                '</tr></thead><tbody>';
            todayVisitors.forEach(function (v) {
                var mother = mothers.find(function (m) { return m.id === v.motherId; });
                html += '<tr data-visitor-id="' + v.id + '">' +
                    '<td>' +
                    '<div class="d-flex align-items-center gap-2">' +
                    (v.photo ? '<img src="' + v.photo + '" class="rounded-circle" style="width:36px;height:36px;object-fit:cover;">' :
                        '<div class="user-avatar" style="width:36px;height:36px;">' + v.visitorName.charAt(0) + '</div>') +
                    '<div><div class="fw-medium">' + v.visitorName + '</div><small class="text-muted">' + (v.phone || '') + '</small></div>' +
                    '</div></td>' +
                    '<td>' + v.relation + '</td>' +
                    '<td>' + (mother ? mother.name : v.motherName) + '<br><small class="text-muted">' + v.roomNumber + '</small></td>' +
                    '<td><i class="bi bi-clock me-1" style="color:var(--color-primary);"></i>' + v.timeSlot + '</td>' +
                    '<td><span class="' + STATUS_CLASSES[v.status] || 'badge-gray' + '">' + STATUS_LABELS[v.status] || v.status + '</span></td>' +
                    '<td>' + (v.checkInTime ? v.checkInTime : '-') + (v.checkOutTime ? '<br><small class="text-muted">离园: ' + v.checkOutTime + '</small>' : '') + '</td>' +
                    '<td><div class="d-flex gap-1 flex-wrap">' + renderVisitorActions(v) + '</div></td>' +
                    '</tr>';
            });
            html += '</tbody></table></div>';
        }

        html += '</div></div>';
        return html;
    }

    function renderVisitorActions(v) {
        var html = '';
        if (!v.photo) {
            html += '<button class="btn btn-sm btn-outline-pink btn-photo" data-id="' + v.id + '" style="padding:4px 10px;font-size:12px;"><i class="bi bi-camera me-1"></i>拍照</button>';
        }
        if (v.status === 'registered') {
            html += '<button class="btn btn-sm btn-pink btn-checkin" data-id="' + v.id + '" style="padding:4px 10px;font-size:12px;"><i class="bi bi-box-arrow-in-right me-1"></i>入园</button>';
        } else if (v.status === 'visiting') {
            html += '<button class="btn btn-sm btn-success btn-checkout" data-id="' + v.id + '" style="padding:4px 10px;font-size:12px;border-radius:20px;"><i class="bi bi-box-arrow-right me-1"></i>离园</button>';
        }
        return html;
    }

    function bindEvents() {
        $('#btn-new-visit').on('click', openVisitModal);

        $('.btn-checkin').on('click', function () {
            var id = $(this).data('id');
            checkInVisitor(id);
        });

        $('.btn-checkout').on('click', function () {
            var id = $(this).data('id');
            checkOutVisitor(id);
        });

        $('.btn-photo').on('click', function () {
            var id = $(this).data('id');
            selectedVisitorId = id;
            openPhotoModal();
        });

        $('.visitor-table').on('click', function () {
            var visitorId = $(this).data('visitor-id');
            if (visitorId && !$(event.target).closest('button').length) {
                openVisitorDetail(visitorId);
            }
        });
    }

    function openVisitModal() {
        var checkedInMothers = mothers.filter(function (m) {
            var mdate = new Date(m.checkInDate);
            var tdate = new Date(today);
            return mdate <= tdate;
        });

        if (checkedInMothers.length === 0) {
            App.showToast('当前无入住产妇', 'warning');
            return;
        }

        var defaultMother = checkedInMothers[0];
        var defaultRoomSlots = getRoomTimeSlots(defaultMother.roomNumber);
        var defaultRoomUsage = getRoomSlotUsage(defaultMother.roomNumber);

        var html = '<div class="row g-3">' +
            '<div class="col-12">' +
            '<label class="form-label"><span class="text-danger">*</span> 选择产妇（房间号）</label>' +
            '<select class="form-select" id="v-mother">' +
            checkedInMothers.map(function (m) {
                return '<option value="' + m.id + '" data-room="' + m.roomNumber + '">' + m.name + ' - ' + m.roomNumber + '</option>';
            }).join('') +
            '</select>' +
            '<small class="text-muted mt-1 d-block"><i class="bi bi-info-circle me-1"></i>每个房间拥有独立专属时段，自动错开避免冲突</small>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label"><span class="text-danger">*</span> 访客姓名</label>' +
            '<input type="text" class="form-control" id="v-name" placeholder="请输入访客姓名">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">与产妇关系</label>' +
            '<select class="form-select" id="v-relation">' +
            RELATIONS.map(function (r) { return '<option>' + r + '</option>'; }).join('') +
            '</select>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">联系电话</label>' +
            '<input type="tel" class="form-control" id="v-phone" placeholder="请输入联系电话">' +
            '</div>' +
            '<div class="col-md-12">' +
            '<label class="form-label"><span class="text-danger">*</span> 选择探视时段（该房间专属时段：<span id="v-room-label" class="text-primary-pink fw-bold">' + defaultMother.roomNumber + '</span>）</label>' +
            '<div class="row g-2" id="v-slot-container">' +
            renderRoomSlotOptions(defaultRoomSlots, defaultRoomUsage) +
            '</div>' +
            '<div class="mt-2"><small class="text-primary-pink"><i class="bi bi-lightbulb me-1"></i>绿色为空闲推荐时段，红色为该房间同时段已被占用</small></div>' +
            '</div></div>';

        var footerHtml = '<button class="btn btn-pink" id="btn-submit-visit"><i class="bi bi-check2 me-1"></i>确认预约</button>' +
            '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">取消</button>';

        App.showGlobalModal(
            '预约探视',
            html,
            footerHtml,
            function () {
                $('#v-mother').off('change').on('change', function () {
                    var opt = $('#v-mother option:selected');
                    var roomNumber = opt.data('room') || opt.text().split(' - ')[1];
                    $('#v-room-label').text(roomNumber);
                    var slots = getRoomTimeSlots(roomNumber);
                    var usage = getRoomSlotUsage(roomNumber);
                    $('#v-slot-container').html(renderRoomSlotOptions(slots, usage));
                });
                $('#btn-submit-visit').off('click').on('click', submitVisit);
            }
        );
    }

    function getRoomSlotUsage(roomNumber) {
        var usage = {};
        visitors.forEach(function (v) {
            if (v.roomNumber === roomNumber && v.visitDate === today) {
                usage[v.timeSlot] = (usage[v.timeSlot] || 0) + 1;
            }
        });
        return usage;
    }

    function renderRoomSlotOptions(slots, usage) {
        var html = '';
        for (var i = 0; i < slots.length; i++) {
            var slot = slots[i];
            var count = usage[slot] || 0;
            var occupied = count > 0;
            var bg = occupied ? '#fff1f0' : '#f6ffed';
            var border = occupied ? '#ffa39e' : '#b7eb8f';
            var color = occupied ? '#cf1322' : '#389e0d';
            var disabled = occupied ? ' disabled' : '';
            var checked = !occupied && i === 0 ? ' checked' : '';
            html += '<div class="col-sm-4 col-6">' +
                '<div class="form-check p-2 rounded" style="background:' + bg + ';border:1px solid ' + border + ';opacity:' + (occupied ? '0.7' : '1') + ';">' +
                '<input class="form-check-input v-slot-radio" type="radio" name="v-slot" id="v-slot-' + slot.replace(/:/g, '').replace(/-/g, '') + '" value="' + slot + '"' + disabled + checked + '>' +
                '<label class="form-check-label" for="v-slot-' + slot.replace(/:/g, '').replace(/-/g, '') + '" style="color:' + color + ';">' +
                '<strong>' + slot + '</strong>' +
                (occupied ? '<br><small><i class="bi bi-x-circle"></i> 已预约 (' + count + '人)</small>' : '<br><small><i class="bi bi-check-circle"></i> 空闲推荐</small>') +
                '</label></div></div>';
        }
        return html;
    }

    function submitVisit() {
        var motherId = $('#v-mother').val();
        var visitorName = $('#v-name').val().trim();
        var relation = $('#v-relation').val();
        var phone = $('#v-phone').val().trim();
        var timeSlot = $('input[name="v-slot"]:checked').val();

        if (!motherId || !visitorName || !timeSlot) {
            App.showToast('请完善预约信息', 'warning');
            return;
        }

        var mother = mothers.find(function (m) { return m.id === motherId; });
        if (!mother) return;

        var newVisitor = {
            id: Store.generateId(),
            motherId: motherId,
            motherName: mother.name,
            roomId: mother.roomId,
            roomNumber: mother.roomNumber,
            storeId: App.state.storeId,
            visitorName: visitorName,
            relation: relation,
            visitDate: today,
            timeSlot: timeSlot,
            phone: phone,
            photo: '',
            checkInTime: '',
            checkOutTime: '',
            status: 'registered'
        };

        Store.addVisitor(newVisitor).then(function () {
            App.closeModal();
            App.showToast('探视预约成功！时段：' + timeSlot, 'success');
            render();
        });
    }

    function checkInVisitor(id) {
        var visitor = visitors.find(function (v) { return v.id === id; });
        if (!visitor) return;

        var now = new Date();
        visitor.checkInTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        visitor.status = 'visiting';

        Store.updateVisitor(visitor).then(function () {
            App.showToast(visitor.visitorName + ' 已入园', 'success');
            render();
        });
    }

    function checkOutVisitor(id) {
        var visitor = visitors.find(function (v) { return v.id === id; });
        if (!visitor) return;

        var now = new Date();
        visitor.checkOutTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        visitor.status = 'completed';

        Store.updateVisitor(visitor).then(function () {
            App.showToast(visitor.visitorName + ' 已离园，感谢配合', 'success');
            render();
        });
    }

    function openVisitorDetail(id) {
        var visitor = visitors.find(function (v) { return v.id === id; });
        if (!visitor) return;

        var html = '<div class="row g-3">' +
            '<div class="col-md-4 text-center">' +
            (visitor.photo ?
                '<img src="' + visitor.photo + '" class="rounded-circle" style="width:120px;height:120px;object-fit:cover;border:4px solid var(--color-primary-light);">' :
                '<div class="user-avatar mx-auto mb-2" style="width:120px;height:120px;font-size:48px;">' + visitor.visitorName.charAt(0) + '</div>') +
            '<h5 class="mt-3 mb-0">' + visitor.visitorName + '</h5>' +
            '<span class="' + STATUS_CLASSES[visitor.status] || 'badge-gray' + ' mt-2 d-inline-block">' + STATUS_LABELS[visitor.status] || visitor.status + '</span>' +
            '</div>' +
            '<div class="col-md-8">' +
            '<div class="p-3 rounded" style="background:var(--color-primary-lighter);">' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">与产妇关系：</div><div class="col-sm-8"><strong>' + visitor.relation + '</strong></div></div>' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">联系电话：</div><div class="col-sm-8">' + (visitor.phone || '-') + '</div></div>' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">探望产妇：</div><div class="col-sm-8">' + visitor.motherName + '</div></div>' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">房间号：</div><div class="col-sm-8">' + visitor.roomNumber + '</div></div>' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">探视时段：</div><div class="col-sm-8">' + visitor.timeSlot + '</div></div>' +
            '<div class="row mb-2"><div class="col-sm-4 text-muted">入园时间：</div><div class="col-sm-8">' + (visitor.checkInTime || '尚未入园') + '</div></div>' +
            '<div class="row"><div class="col-sm-4 text-muted">离园时间：</div><div class="col-sm-8">' + (visitor.checkOutTime || '尚未离园') + '</div></div>' +
            '</div></div></div>';

        var footerHtml = '';
        if (!visitor.photo) {
            footerHtml += '<button class="btn btn-outline-pink" id="btn-detail-photo"><i class="bi bi-camera me-1"></i>采集人脸照片</button>';
        }
        if (visitor.status === 'registered') {
            footerHtml += '<button class="btn btn-pink" id="btn-detail-checkin"><i class="bi bi-box-arrow-in-right me-1"></i>登记入园</button>';
        } else if (visitor.status === 'visiting') {
            footerHtml += '<button class="btn btn-success" id="btn-detail-checkout" style="border-radius:20px;padding:8px 20px;"><i class="bi bi-box-arrow-right me-1"></i>登记离园</button>';
        }
        footerHtml += '<button type="button" class="btn btn-outline-pink" data-bs-dismiss="modal">关闭</button>';

        App.showGlobalModal(
            '访客详情 - ' + visitor.visitorName,
            html,
            footerHtml,
            function () {
                $('#btn-detail-checkin').on('click', function () { App.closeModal(); checkInVisitor(id); });
                $('#btn-detail-checkout').on('click', function () { App.closeModal(); checkOutVisitor(id); });
                $('#btn-detail-photo').on('click', function () { selectedVisitorId = id; openPhotoModal(); });
            }
        );
    }

    function openPhotoModal() {
        var html = '<div class="text-center">' +
            '<video id="photo-video" autoplay playsinline style="width:100%;max-width:480px;border-radius:var(--radius-md);background:#000;min-height:300px;"></video>' +
            '<canvas id="photo-canvas" style="display:none;"></canvas>' +
            '<div id="photo-preview" class="mt-3 text-center" style="display:none;">' +
            '<img id="photo-img" class="rounded" style="max-width:100%;max-height:300px;">' +
            '</div>' +
            '<div class="mt-3 d-flex gap-2 justify-content-center">' +
            '<button class="btn btn-pink" id="btn-capture"><i class="bi bi-camera me-1"></i>拍照</button>' +
            '<button class="btn btn-outline-pink" id="btn-retake" style="display:none;"><i class="bi bi-arrow-clockwise me-1"></i>重拍</button>' +
            '<button class="btn btn-success" id="btn-save-photo" style="display:none;border-radius:20px;padding:8px 20px;"><i class="bi bi-check2 me-1"></i>保存</button>' +
            '</div>' +
            '<div id="photo-error" class="mt-2 text-muted" style="display:none;"><i class="bi bi-exclamation-triangle text-warning me-1"></i>摄像头不可用，请稍后重试</div>' +
            '</div>';

        App.showGlobalModal(
            '人脸采集',
            html,
            null,
            function () {
                initCamera();
            }
        );
    }

    var mediaStream = null;

    function initCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            $('#photo-video').hide();
            $('#btn-capture').hide();
            $('#photo-error').show().text('当前环境不支持摄像头');
            return;
        }

        navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360, facingMode: 'user' } })
            .then(function (stream) {
                mediaStream = stream;
                var video = document.getElementById('photo-video');
                if (video) {
                    video.srcObject = stream;
                }
            })
            .catch(function (err) {
                console.error('摄像头打开失败:', err);
                $('#photo-video').hide();
                $('#btn-capture').hide();
                $('#photo-error').show().text('无法访问摄像头，请检查权限设置');
            });

        $('#btn-capture').on('click', function () {
            var video = document.getElementById('photo-video');
            var canvas = document.getElementById('photo-canvas');
            if (video && canvas) {
                canvas.width = video.videoWidth || 480;
                canvas.height = video.videoHeight || 360;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                var dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                if (mediaStream) {
                    mediaStream.getTracks().forEach(function (t) { t.stop(); });
                }

                $('#photo-video').hide();
                $('#photo-img').attr('src', dataUrl);
                $('#photo-preview').show();
                $('#btn-capture').hide();
                $('#btn-retake').show();
                $('#btn-save-photo').show();

                $('#btn-save-photo').on('click', function () {
                    savePhoto(dataUrl);
                });
                $('#btn-retake').on('click', function () {
                    $('#photo-preview').hide();
                    $('#photo-img').attr('src', '');
                    $('#btn-save-photo').hide();
                    $('#btn-retake').hide();
                    $('#photo-video').show();
                    $('#btn-capture').show();
                    initCamera();
                });
            }
        });
    }

    function savePhoto(dataUrl) {
        if (!selectedVisitorId) return;
        var visitor = visitors.find(function (v) { return v.id === selectedVisitorId; });
        if (!visitor) return;
        visitor.photo = dataUrl;
        Store.updateVisitor(visitor).then(function () {
            App.closeModal();
            App.showToast('人脸照片已保存', 'success');
            render();
        });
    }

    return { render: render };
})();
