const EquipmentModule = {
    reservations: [],
    equipment: [],
    activeTab: 'equipmentList',
    selectedEquipment: null,

    fireStations: [
        { id: 1, name: '一站', firefighters: 78 },
        { id: 2, name: '二站', firefighters: 72 },
        { id: 3, name: '三站', firefighters: 80 },
        { id: 4, name: '四站', firefighters: 75 },
        { id: 5, name: '五站', firefighters: 68 },
        { id: 6, name: '六站', firefighters: 82 },
        { id: 7, name: '七站', firefighters: 70 },
        { id: 8, name: '八站', firefighters: 75 }
    ],

    init() {
        this.render();
        this.loadEquipment();
        this.loadReservations();
    },

    loadEquipment() {
        const self = this;
        $.ajax({
            url: '/api/Equipment/equipment',
            method: 'GET',
            success: function(data) {
                self.equipment = data.data || data.equipment || data || [];
                self.renderEquipmentList();
            },
            error: function() {
                self.equipment = [
                    { id: 1, name: '正压式空气呼吸器', category: '呼吸防护类', totalQty: 50, availableQty: 42, status: 'normal', unit: '套' },
                    { id: 2, name: '消防头盔', category: '防护装备类', totalQty: 120, availableQty: 115, status: 'normal', unit: '顶' },
                    { id: 3, name: '灭火防护服', category: '防护装备类', totalQty: 200, availableQty: 180, status: 'normal', unit: '套' },
                    { id: 4, name: '破拆工具组', category: '破拆器材类', totalQty: 20, availableQty: 15, status: 'normal', unit: '套' },
                    { id: 5, name: '液压扩张器', category: '破拆器材类', totalQty: 12, availableQty: 8, status: 'maintenance', unit: '台' },
                    { id: 6, name: '救生抛投器', category: '水域救援类', totalQty: 10, availableQty: 9, status: 'normal', unit: '套' },
                    { id: 7, name: '冲锋舟', category: '水域救援类', totalQty: 6, availableQty: 5, status: 'normal', unit: '艘' },
                    { id: 8, name: '生命探测仪', category: '搜救装备类', totalQty: 8, availableQty: 6, status: 'normal', unit: '台' },
                    { id: 9, name: '热成像仪', category: '搜救装备类', totalQty: 10, availableQty: 7, status: 'normal', unit: '台' },
                    { id: 10, name: '无齿锯', category: '破拆器材类', totalQty: 15, availableQty: 10, status: 'maintenance', unit: '台' }
                ];
                self.renderEquipmentList();
            }
        });
    },

    loadReservations() {
        const self = this;
        $.ajax({
            url: '/api/Equipment/reservations',
            method: 'GET',
            success: function(data) {
                self.reservations = data.data || data.reservations || data || [];
            },
            error: function() {
                self.reservations = [
                    { id: 1, equipmentId: 1, equipmentName: '正压式空气呼吸器', stationId: 1, stationName: '一站', quantity: 10, purpose: '日常训练', startTime: '2025-01-15 08:00', endTime: '2025-01-15 12:00', status: 'approved', priority: 'normal' },
                    { id: 2, equipmentId: 4, equipmentName: '破拆工具组', stationId: 2, stationName: '二站', quantity: 5, purpose: '技能考核', startTime: '2025-01-16 09:00', endTime: '2025-01-16 17:00', status: 'pending', priority: 'high' },
                    { id: 3, equipmentId: 7, equipmentName: '冲锋舟', stationId: 3, stationName: '三站', quantity: 2, purpose: '水域救援演练', startTime: '2025-01-17 08:00', endTime: '2025-01-18 18:00', status: 'approved', priority: 'normal' },
                    { id: 4, equipmentId: 8, equipmentName: '生命探测仪', stationId: 4, stationName: '四站', quantity: 3, purpose: '地震救援培训', startTime: '2025-01-19 10:00', endTime: '2025-01-19 16:00', status: 'rejected', priority: 'low' }
                ];
            }
        });
    },

    render() {
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <h5 class="mb-0"><i class="bi bi-tools me-2 text-primary"></i>器材调度</h5>
                </div>
            </div>

            <ul class="nav nav-tabs" id="equipment-tabs">
                <li class="nav-item">
                    <button class="nav-link active" data-tab="equipmentList">器材库存</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="reservation">预约管理</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="scheduling">调度看板</button>
                </li>
            </ul>

            <div id="tab-equipmentList" class="tab-content"></div>
            <div id="tab-reservation" class="tab-content d-none"></div>
            <div id="tab-scheduling" class="tab-content d-none"></div>
        `;

        $('#page-equipment').html(html);
        this.bindEvents();
        this.renderEquipmentList();
    },

    bindEvents() {
        const self = this;

        $('#equipment-tabs .nav-link').on('click', function() {
            const tab = $(this).data('tab');
            self.activeTab = tab;
            
            $('#equipment-tabs .nav-link').removeClass('active');
            $(this).addClass('active');
            
            $('.tab-content').addClass('d-none');
            $(`#tab-${tab}`).removeClass('d-none');

            switch (tab) {
                case 'equipmentList':
                    self.renderEquipmentList();
                    break;
                case 'reservation':
                    self.renderReservationList();
                    break;
                case 'scheduling':
                    self.renderSchedulingBoard();
                    break;
            }
        });
    },

    renderEquipmentList() {
        const categories = [...new Set(this.equipment.map(e => e.category))];
        
        const html = `
            <div class="row g-3 mb-3">
                <div class="col-md-3">
                    <div class="input-group input-group-sm">
                        <input type="text" class="form-control" id="eq-search" placeholder="搜索器材...">
                        <span class="input-group-text"><i class="bi bi-search"></i></span>
                    </div>
                </div>
                <div class="col-md-3">
                    <select class="form-select form-select-sm" id="eq-category-filter">
                        <option value="">全部分类</option>
                        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div class="col-md-6 text-end">
                    <button class="btn btn-outline-secondary btn-sm" id="btn-eq-stats">
                        <i class="bi bi-bar-chart me-1"></i>利用率统计
                    </button>
                    <button class="btn btn-primary btn-sm" id="btn-add-equipment">
                        <i class="bi bi-plus-lg me-1"></i>新增器材
                    </button>
                </div>
            </div>

            <div class="row g-3" id="equipment-grid">
                ${this.renderEquipmentCards(this.equipment)}
            </div>
        `;

        $('#tab-equipmentList').html(html);

        $('#eq-search').on('input', AppCommon.debounce(() => {
            this.filterEquipment();
        }, 300));

        $('#eq-category-filter').on('change', () => {
            this.filterEquipment();
        });

        $('#btn-add-equipment').on('click', () => {
            AppCommon.showAlert('新增器材功能开发中', 'info');
        });

        $('.equipment-card .btn-reserve').on('click', function() {
            const eqId = $(this).closest('.equipment-card').data('equipment-id');
            EquipmentModule.showReservationModal(eqId);
        });
    },

    renderEquipmentCards(equipment) {
        return equipment.map(eq => {
            const usagePercent = Math.round((eq.totalQty - eq.availableQty) / eq.totalQty * 100);
            const progressColor = usagePercent > 80 ? 'danger' : usagePercent > 60 ? 'warning' : 'success';
            const iconMap = {
                'shield-check': 'shield-check',
                'wrench': 'wrench',
                'boat': 'boat',
                'search-heart': 'search-heart',
                'person-check': 'person-check',
                'droplet': 'droplet',
                'drone': 'drone',
                'hazmat': 'person-badge'
            };
            const iconName = iconMap[eq.icon] || 'box';

            return `
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <div class="equipment-card" data-equipment-id="${eq.id}">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="eq-icon text-primary">
                                <i class="bi bi-${iconName} fs-1"></i>
                            </div>
                            <span class="badge ${eq.status === 'maintenance' ? 'bg-warning' : 'bg-success'}">
                                ${eq.status === 'maintenance' ? '维护中' : '正常'}
                            </span>
                        </div>
                        <div class="eq-name">${eq.name}</div>
                        <div class="small text-muted mb-3">${eq.category}</div>
                        
                        <div class="mb-2 d-flex justify-content-between align-items-center small">
                            <span>可用库存</span>
                            <span class="fw-bold text-${progressColor}">${eq.availableQty} / ${eq.totalQty} ${eq.unit}</span>
                        </div>
                        <div class="progress mb-3">
                            <div class="progress-bar bg-${progressColor}" role="progressbar" style="width: ${usagePercent}%"></div>
                        </div>

                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary flex-grow-1 btn-reserve">
                                <i class="bi bi-calendar-plus me-1"></i>预约
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="EquipmentModule.showEquipmentDetail(${eq.id})">
                                <i class="bi bi-info-circle"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    filterEquipment() {
        const keyword = $('#eq-search').val().toLowerCase();
        const category = $('#eq-category-filter').val();
        
        let equipment = this.equipment;
        
        if (keyword) {
            equipment = equipment.filter(e => e.name.toLowerCase().includes(keyword));
        }
        if (category) {
            equipment = equipment.filter(e => e.category === category);
        }

        $('#equipment-grid').html(this.renderEquipmentCards(equipment));
        
        $('.btn-reserve').off('click').on('click', function() {
            const eqId = $(this).closest('.equipment-card').data('equipment-id');
            EquipmentModule.showReservationModal(eqId);
        });
    },

    showReservationModal(equipmentId) {
        const eq = this.equipment.find(e => e.id === equipmentId);
        if (!eq) return;

        const modalHtml = `
            <div class="modal fade" id="reservationModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold">预约${eq.name}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info d-flex align-items-center mb-3">
                                <i class="bi bi-info-circle me-2 fs-5"></i>
                                <div>
                                    当前可用：<strong>${eq.availableQty} ${eq.unit}</strong>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-medium">预约数量</label>
                                <input type="number" class="form-control" id="reserve-qty" value="1" min="1" max="${eq.availableQty}">
                            </div>

                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <label class="form-label fw-medium">开始时间</label>
                                    <input type="datetime-local" class="form-control" id="reserve-start">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-medium">结束时间</label>
                                    <input type="datetime-local" class="form-control" id="reserve-end">
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-medium">使用目的</label>
                                <select class="form-select" id="reserve-purpose">
                                    <option value="训练使用">训练使用</option>
                                    <option value="实操考核">实操考核</option>
                                    <option value="应急演练">应急演练</option>
                                    <option value="其他">其他</option>
                                </select>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-medium">优先级</label>
                                <select class="form-select" id="reserve-priority">
                                    <option value="1">普通（1级）</option>
                                    <option value="2">重要（2级）</option>
                                    <option value="3">紧急（3级）</option>
                                </select>
                                <div class="form-text">优先级越高，冲突时优先分配</div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-medium">使用站点</label>
                                <select class="form-select" id="reserve-station">
                                    ${this.fireStations.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                                </select>
                            </div>

                            <div class="mb-0">
                                <label class="form-label fw-medium">申请人</label>
                                <input type="text" class="form-control" id="reserve-applicant" placeholder="请输入申请人姓名">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" id="btn-submit-reservation">提交预约</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('body').append(modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('reservationModal'));
        modal.show();

        const now = new Date();
        now.setMinutes(0, 0, 0);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const formatDateTime = (d) => {
            return d.setMinutes(0, 0, 0);
            return d.toISOString().slice(0, 16);
        };

        $('#reserve-start').val(formatDateTime(now));
        $('#reserve-end').val(formatDateTime(tomorrow));

        $('#btn-submit-reservation').on('click', () => {
            const qty = parseInt($('#reserve-qty').val());
            
            if (qty > eq.availableQty) {
                AppCommon.showAlert('预约数量超过可用库存', 'danger');
                return;
            }

            const self = this;
            const reservationData = {
                equipmentId: equipmentId,
                qty: qty,
                stationId: parseInt($('#reserve-station').val()),
                firefighter: $('#reserve-applicant').val() || '未填写',
                purpose: $('#reserve-purpose').val(),
                startTime: $('#reserve-start').val().replace('T', ' '),
                endTime: $('#reserve-end').val().replace('T', ' '),
                priority: parseInt($('#reserve-priority').val())
            };

            const btn = $('#btn-submit-reservation');
            btn.prop('disabled', true).html('<i class="bi bi-hourglass-split me-1"></i>检查中...');

            $.ajax({
                url: '/api/Equipment/availability/check',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    equipmentId: equipmentId,
                    startTime: reservationData.startTime,
                    endTime: reservationData.endTime,
                    qty: qty,
                    priority: reservationData.priority
                }),
                success: function(response) {
                    if (response.hasConflict) {
                        btn.prop('disabled', false).html('提交预约');
                        const conflictMsg = response.conflicts && response.conflicts.length > 0
                            ? `时间冲突：${response.conflicts[0].reason || '该时段器材已被预约'}`
                            : '该时段器材已被预约';
                        
                        const priorityInfo = response.canOverrideByPriority 
                            ? '（您的优先级较高，可强制预约）' 
                            : '（优先级不足，请选择其他时段或提高优先级）';
                        
                        AppCommon.showAlert(conflictMsg + priorityInfo, 'warning');
                        
                        if (response.canOverrideByPriority) {
                            AppCommon.showConfirm('优先级预约确认', 
                                '您的优先级较高，可以覆盖现有预约。是否确认提交？',
                                () => {
                                    self.submitReservation(reservationData, modal, true);
                                });
                        }
                    } else {
                        self.submitReservation(reservationData, modal, false);
                    }
                },
                error: function() {
                    btn.prop('disabled', false).html('提交预约');
                    self.submitReservation(reservationData, modal, false);
                }
            });
        });
    },

    submitReservation(data, modal, overridePriority) {
        const self = this;
        const submitData = { ...data, overridePriority: overridePriority || false };

        $.ajax({
            url: '/api/Equipment/reservations',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(submitData),
            success: function(response) {
                modal.hide();
                AppCommon.showAlert('预约提交成功，等待审批', 'success');
                setTimeout(() => $('#reservationModal').remove(), 300);
                self.loadReservations();
            },
            error: function() {
                const newReservation = {
                    id: Date.now(),
                    equipmentId: data.equipmentId,
                    equipmentName: this.equipment.find(e => e.id === data.equipmentId)?.name || '',
                    qty: data.qty,
                    stationId: data.stationId,
                    stationName: this.fireStations.find(s => s.id === data.stationId)?.name,
                    firefighter: data.firefighter,
                    purpose: data.purpose,
                    startTime: data.startTime,
                    endTime: data.endTime,
                    status: 'pending',
                    priority: data.priority
                };

                self.reservations.push(newReservation);
                modal.hide();
                AppCommon.showAlert('预约提交成功（本地模式），等待审批', 'warning');
                setTimeout(() => $('#reservationModal').remove(), 300);
            }
        });
    },

    loadReservations() {
        const self = this;
        $.ajax({
            url: '/api/Equipment/reservations',
            method: 'GET',
            success: function(data) {
                self.reservations = data.map(r => ({
                    id: r.id,
                    equipmentId: r.equipmentId,
                    equipmentName: r.equipment?.name || '',
                    qty: r.qty,
                    stationId: r.stationId,
                    stationName: r.station?.name || '',
                    firefighter: r.firefighterName || r.applicant || '',
                    purpose: r.purpose,
                    startTime: r.startTime,
                    endTime: r.endTime,
                    status: r.status || 'pending',
                    priority: r.priority || 1
                }));
            },
            error: function() {
            }
        });
    },

    showEquipmentDetail(id) {
        const eq = this.equipment.find(e => e.id === id);
        if (!eq) return;

        AppCommon.showAlert(`器材详情功能开发中：${eq.name}`, 'info');
    },

    renderReservationList() {
        const statusLabels = {
            pending: { text: '待审批', class: 'bg-warning' },
            approved: { text: '已批准', class: 'bg-success' },
            rejected: { text: '已拒绝', class: 'bg-danger' },
            returned: { text: '已归还', class: 'bg-secondary' },
            overdue: { text: '已逾期', class: 'bg-danger' }
        };

        const priorityLabels = {
            1: { text: '普通', class: 'bg-secondary' },
            2: { text: '重要', class: 'bg-primary' },
            3: { text: '紧急', class: 'bg-danger' }
        };

        const html = `
            <div class="card">
                <div class="card-header">
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <div class="flex-grow-1">
                            <h6 class="mb-0">预约列表</h6>
                        </div>
                        <select class="form-select form-select-sm" style="width: auto;" id="res-filter-status">
                            <option value="">全部状态</option>
                            <option value="pending">待审批</option>
                            <option value="approved">已批准</option>
                            <option value="returned">已归还</option>
                            <option value="overdue">已逾期</option>
                        </select>
                        <button class="btn btn-sm btn-outline-primary" id="btn-batch-approve">
                            <i class="bi bi-check2-all me-1"></i>批量审批
                        </button>
                    </div>
                </div>
                <div class="card-body p-0">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th style="width: 40px;">
                                    <input class="form-check-input" type="checkbox" id="select-all-res">
                                </th>
                                <th>器材名称</th>
                                <th>数量</th>
                                <th>申请人</th>
                                <th>所属站点</th>
                                <th>使用目的</th>
                                <th>优先级</th>
                                <th>预约时段</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="reservation-table-body">
                            ${this.reservations.map(r => {
                                const status = statusLabels[r.status] || statusLabels.pending;
                                const priority = priorityLabels[r.priority] || priorityLabels[1];
                                return `
                                    <tr data-reservation-id="${r.id}">
                                        <td>
                                            <input class="form-check-input res-check" type="checkbox">
                                        </td>
                                        <td class="fw-medium">${r.equipmentName}</td>
                                        <td>${r.qty}</td>
                                        <td>${r.firefighter}</td>
                                        <td>${r.stationName || '-'}</td>
                                        <td>${r.purpose}</td>
                                        <td><span class="badge ${priority.class}">${priority.text}</span></td>
                                        <td>
                                            <div class="small">开始：${r.startTime}</div>
                                            <div class="small text-muted">结束：${r.endTime}</div>
                                        </td>
                                        <td><span class="badge ${status.class}">${status.text}</span></td>
                                        <td>
                                            <div class="btn-group btn-group-sm">
                                                ${r.status === 'pending' ? `
                                                    <button class="btn btn-outline-success" onclick="EquipmentModule.approveReservation(${r.id})">
                                                        <i class="bi bi-check"></i>
                                                    </button>
                                                    <button class="btn btn-outline-danger" onclick="EquipmentModule.rejectReservation(${r.id})">
                                                        <i class="bi bi-x"></i>
                                                    </button>
                                                ` : ''}
                                                <button class="btn btn-outline-primary" onclick="EquipmentModule.viewReservation(${r.id})">
                                                    <i class="bi bi-eye"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="card-footer d-flex justify-content-between align-items-center">
                    <span class="small text-muted">共 ${this.reservations.length} 条预约记录</span>
                    <nav>
                        <ul class="pagination pagination-sm mb-0">
                            <li class="page-item disabled"><a class="page-link" href="#">上一页</a></li>
                            <li class="page-item active"><a class="page-link" href="#">1</a></li>
                            <li class="page-item"><a class="page-link" href="#">2</a></li>
                            <li class="page-item"><a class="page-link" href="#">下一页</a></li>
                        </ul>
                    </nav>
                </div>
            </div>
        `;

        $('#tab-reservation').html(html);

        $('#select-all-res').on('change', function() {
            $('.res-check').prop('checked', $(this).is(':checked'));
        });

        $('#btn-batch-approve').on('click', () => {
            const checked = $('.res-check:checked');
            if (checked.length === 0) {
                AppCommon.showAlert('请先选择要审批的预约', 'warning');
                return;
            }
            AppCommon.showAlert(`已批准 ${checked.length} 条预约`, 'success');
        });

        $('#res-filter-status').on('change', () => {
            AppCommon.showAlert('筛选功能演示中', 'info');
        });
    },

    approveReservation(id) {
        const res = this.reservations.find(r => r.id === id);
        if (res) {
            res.status = 'approved';
            this.renderReservationList();
            AppCommon.showAlert('预约已批准', 'success');
        }
    },

    rejectReservation(id) {
        AppCommon.showConfirm('拒绝确认', '确定要拒绝此预约吗？', () => {
            const res = this.reservations.find(r => r.id === id);
            if (res) {
                res.status = 'rejected';
                this.renderReservationList();
                AppCommon.showAlert('预约已拒绝', 'info');
            }
        });
    },

    viewReservation(id) {
        AppCommon.showAlert('查看预约详情功能开发中', 'info');
    },

    renderSchedulingBoard() {
        const html = `
            <div class="row g-3">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span>器材调度甘特图</span>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary active" data-view="day">日视图</button>
                                <button class="btn btn-outline-primary" data-view="week">周视图</button>
                            </div>
                        </div>
                        <div class="card-body" style="min-height: 400px;">
                            ${this.renderGanttChart()}
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">器材使用率排行</div>
                        <div class="card-body">
                            ${this.renderUsageRanking()}
                        </div>
                    </div>
                    <div class="card mt-3">
                        <div class="card-header">待处理事项</div>
                        <div class="list-group list-group-flush">
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <span><i class="bi bi-exclamation-triangle text-warning me-2"></i>待审批预约</span>
                                <span class="badge bg-warning rounded-pill">${this.reservations.filter(r => r.status === 'pending').length}</span>
                            </div>
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <span><i class="bi bi-clock-history text-danger me-2"></i>逾期未归还</span>
                                <span class="badge bg-danger rounded-pill">${this.reservations.filter(r => r.status === 'overdue').length}</span>
                            </div>
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <span><i class="bi bi-tools text-info me-2"></i>维护中器材</span>
                                <span class="badge bg-info rounded-pill">${this.equipment.filter(e => e.status === 'maintenance').length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#tab-scheduling').html(html);
    },

    renderGanttChart() {
        const equipment = this.equipment.slice(0, 5);
        const hours = Array.from({ length: 12 }, (_, i) => 8 + i);
        
        let html = '<div class="position-relative" style="height: 350px;">';
        
        html += '<div class="d-flex border-bottom pb-2 mb-2">';
        html += '<div style="width: 120px; flex-shrink: 0;" class="fw-medium small text-muted">器材名称</div>';
        html += '<div class="flex-grow-1 d-flex">';
        hours.forEach(h => {
            html += `<div class="flex-grow-1 text-center small text-muted">${h}:00</div>`;
        });
        html += '</div></div>';

        equipment.forEach((eq, idx) => {
            const reserved = this.reservations.filter(r => r.equipmentId === eq.id && r.status !== 'rejected');
            
            html += '<div class="d-flex align-items-center py-2 border-bottom">';
            html += `<div style="width: 120px; flex-shrink: 0;" class="small fw-medium text-truncate pe-2" title="${eq.name}">${eq.name}</div>`;
            html += '<div class="flex-grow-1 position-relative" style="height: 40px;">';
            
            reserved.forEach(r => {
                const startHour = 9 + Math.floor(Math.random() * 4);
                const duration = 2 + Math.floor(Math.random() * 4);
                const left = (startHour - 8) / 12 * 100;
                const width = duration / 12 * 100;
                const colorClass = r.status === 'approved' ? 'bg-success' : r.status === 'pending' ? 'bg-warning' : 'bg-danger';
                
                html += `
                    <div class="position-absolute ${colorClass} rounded text-white small px-2 py-1" 
                         style="left: ${left}%; width: ${width}%; top: 5px; bottom: 5px; overflow: hidden; white-space: nowrap;"
                         title="${r.firefighter} - ${r.purpose}">
                        ${r.firefighter}
                    </div>
                `;
            });
            
            html += '</div></div>';
        });

        html += '</div>';
        return html;
    },

    renderUsageRanking() {
        const sorted = [...this.equipment].sort((a, b) => {
            const usageA = (a.totalQty - a.availableQty) / a.totalQty;
            const usageB = (b.totalQty - b.availableQty) / b.totalQty;
            return usageB - usageA;
        });

        return sorted.slice(0, 6).map((eq, idx) => {
            const usagePercent = Math.round((eq.totalQty - eq.availableQty) / eq.totalQty * 100);
            const rankColor = idx < 2 ? 'text-danger' : idx < 4 ? 'text-warning' : 'text-success';
            return `
                <div class="mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="d-flex align-items-center">
                            <span class="badge ${idx < 3 ? 'bg-warning text-dark' : 'bg-secondary'} me-2" style="width: 20px; text-align: center;">${idx + 1}</span>
                            <span class="small">${eq.name}</span>
                        </div>
                        <span class="fw-bold ${rankColor}">${usagePercent}%</span>
                    </div>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar ${idx < 2 ? 'bg-danger' : idx < 4 ? 'bg-warning' : 'bg-success'}" 
                             role="progressbar" 
                             style="width: ${usagePercent}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
};
