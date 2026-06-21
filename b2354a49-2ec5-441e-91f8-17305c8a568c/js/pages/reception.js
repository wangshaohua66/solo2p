(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.pages = App.pages || {};

    var state = {
        selectedPet: null,
        selectedCustomer: null,
        selectedPackage: null,
        selectedItems: [],
        query: ''
    };

    function resetState() {
        state.selectedPet = null;
        state.selectedCustomer = null;
        state.selectedPackage = null;
        state.selectedItems = [];
    }

    function render(params) {
        resetState();
        if (params && params.action === 'new') {
        }

        var store = App.store.getCurrentStore();
        var todayServices = App.store.getServices({ storeId: store.id, date: new Date().toISOString().slice(0, 10) });
        var groomers = App.store.getGroomers({ storeId: store.id });
        var waitInfo = App.calculator.estimateWaitTime(todayServices, groomers, store.id);
        var queueCount = todayServices.filter(function(s) { return s.status === 'pending' || s.status === 'in_progress'; }).length;

        return '<div class="container-fluid p-0">' +
            '<div class="row mb-4">' +
            '<div class="col-md-12">' +
            '<div class="card bg-gradient-primary text-white shadow-sm">' +
            '<div class="card-body py-3">' +
            '<div class="row g-4 align-items-center">' +
            '<div class="col-auto">' +
            '<h4 class="mb-0 fw-bold"><i class="bi bi-reception-4 me-2"></i>前台接待工作台</h4>' +
            '<small class="opacity-75">' + store.name + ' · ' + new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '</small>' +
            '</div>' +
            '<div class="col-auto ms-auto d-flex gap-4">' +
            '<div class="text-center"><div class="display-6 fw-bold">' + queueCount + '</div><small class="opacity-75">排队中</small></div>' +
            '<div class="text-center"><div class="display-6 fw-bold">' + waitInfo.avgLoad + '%</div><small class="opacity-75">美容师负载</small></div>' +
            '<div class="text-center"><div class="display-6 fw-bold">' + (waitInfo.estimatedWaitMinutes < 10 ? '<10' : waitInfo.estimatedWaitMinutes) + '</div><small class="opacity-75">预计等待(分)</small></div>' +
            '<div class="text-center"><div class="display-6 fw-bold">' + groomers.length + '</div><small class="opacity-75">在岗美容师</small></div>' +
            '</div></div></div></div></div></div>' +

            '<div class="row mb-4 g-3">' +
            '<div class="col-md-6">' +
            '<div class="input-group">' +
            '<span class="input-group-text bg-white"><i class="bi bi-search"></i></span>' +
            '<input id="petSearchInput" type="text" class="form-control" placeholder="搜索宠物名/品种/主人手机号...">' +
            '</div></div>' +
            '<div class="col-md-3">' +
            '<select id="filterSpecies" class="form-select">' +
            '<option value="">全部物种</option>' +
            '<option value="dog">仅狗狗</option>' +
            '<option value="cat">仅猫咪</option>' +
            '</select></div>' +
            '<div class="col-md-3 d-flex gap-2">' +
            '<button class="btn btn-primary flex-grow-1" id="btnNewPet"><i class="bi bi-plus-circle me-1"></i>新建宠物档案</button>' +
            '<button class="btn btn-success flex-grow-1" id="btnNewCustomer"><i class="bi bi-person-plus me-1"></i>新会员登记</button>' +
            '</div></div>' +

            '<div class="row g-4">' +

            '<div class="col-lg-5">' +
            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-heart-pulse me-2 text-danger"></i>宠物档案列表</h6>' +
            '<span class="badge bg-secondary" id="petCountBadge">0 只</span>' +
            '</div>' +
            '<div class="card-body p-2">' +
            '<div id="petList" class="row g-3 pet-list-container"></div>' +
            '</div></div></div>' +

            '<div class="col-lg-7">' +
            '<div class="row g-3">' +
            '<div class="col-12">' +
            '<div class="card shadow-sm">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-info-circle me-2 text-primary"></i>当前服务上下文</h6>' +
            (state.selectedPet ? '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>已选择宠物</span>' : '<span class="badge bg-secondary">请先选择宠物</span>') +
            '</div>' +
            '<div class="card-body" id="currentContextPanel">' + renderContextPanel() + '</div>' +
            '</div></div>' +

            '<div class="col-xl-7">' +
            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-list-columns me-2 text-success"></i>服务项目选择</h6></div>' +
            '<div class="card-body p-2" id="servicePanelHost">' + renderServicePanelHost() + '</div>' +
            '</div></div>' +

            '<div class="col-xl-5">' +
            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-cart-check me-2 text-warning"></i>当前订单</h6></div>' +
            '<div class="card-body p-3" id="currentOrderPanel">' + renderOrderPanel() + '</div>' +
            '<div class="card-footer bg-white">' +
            '<div id="orderSummaryHost">' + renderOrderSummary() + '</div>' +
            '<button class="btn btn-primary w-100 mt-3" id="btnConfirmOrder" ' +
            (!state.selectedPet || (!state.selectedPackage && !state.selectedItems.length) ? 'disabled' : '') + '>' +
            '<i class="bi bi-check2-square me-1"></i>确认登记并排入队列</button>' +
            '</div></div></div>' +

            '</div></div></div>' +

            '<div class="row mt-4">' +
            '<div class="col-12">' +
            '<div class="card shadow-sm">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-people-fill me-2 text-info"></i>实时排队队列</h6>' +
            '<div class="btn-group btn-group-sm">' +
            '<button class="btn btn-outline-secondary queue-filter-btn active" data-filter="all">全部</button>' +
            '<button class="btn btn-outline-secondary queue-filter-btn" data-filter="pending">待接宠</button>' +
            '<button class="btn btn-outline-secondary queue-filter-btn" data-filter="in_progress">进行中</button>' +
            '<button class="btn btn-outline-secondary queue-filter-btn" data-filter="completed">已完成</button>' +
            '</div></div>' +
            '<div class="card-body p-0"><div id="queueTableHost"></div></div>' +
            '</div></div></div>' +

            '</div>';
    }

    function renderContextPanel() {
        if (!state.selectedPet) {
            return '<div class="text-center py-5 text-muted">' +
                '<i class="bi bi-arrow-up-left-circle fs-1 d-block mb-2"></i>' +
                '<h6 class="text-muted">请从左侧列表选择宠物</h6>' +
                '<small>选中后将自动加载主人会员信息和历史服务记录</small></div>';
        }
        var pet = state.selectedPet;
        var owner = pet.ownerId ? App.store.getCustomerById(pet.ownerId) : null;
        var levelBadge = owner ? App.calculator.getLevelBadge(owner.memberLevel) : '';

        return App.components.petCard.render(pet, {}) +
            (owner ? '<div class="card mt-3 border-primary-subtle bg-primary-subtle bg-opacity-10">' +
                '<div class="card-body p-3">' +
                '<h6 class="mb-2 fw-bold"><i class="bi bi-person-vcard me-2"></i>主人信息 ' + levelBadge + '</h6>' +
                '<div class="row g-2 small">' +
                '<div class="col-md-4"><span class="text-muted">姓名：</span>' + owner.name + '</div>' +
                '<div class="col-md-4"><span class="text-muted">手机：</span>' + owner.phone + '</div>' +
                '<div class="col-md-4"><span class="text-muted">注册：</span>' + owner.registerDate + '</div>' +
                '<div class="col-md-4"><span class="text-muted">储值余额：</span><span class="text-success fw-bold">' + App.calculator.formatMoney(owner.balance) + '</span></div>' +
                '<div class="col-md-4"><span class="text-muted">积分：</span><span class="text-primary fw-bold">' + owner.points + ' pts</span></div>' +
                '<div class="col-md-4"><span class="text-muted">累计消费：</span>' + App.calculator.formatMoney((owner.points / App.calculator.getMemberLevel(owner.memberLevel).pointRate * 10)) + '</div>' +
                '</div></div></div>' : '');
    }

    function renderServicePanelHost() {
        var history = state.selectedPet ? App.store.getPetServices(state.selectedPet.id) : [];
        if (!state.selectedPet) {
            return '<div class="text-center py-5 text-muted">' +
                '<i class="bi bi-ui-checks-grid fs-1 d-block mb-2"></i>' +
                '<h6 class="text-muted">请先选择宠物以启用智能推荐</h6>' +
                '<small>系统将根据品种、毛质和历史服务自动推荐适配套餐</small></div>';
        }
        return App.components.servicePanel.render({ pet: state.selectedPet, history: history });
    }

    function renderOrderPanel() {
        return App.components.servicePanel.renderSelectedItems({
            package: state.selectedPackage,
            items: state.selectedItems
        });
    }

    function renderOrderSummary() {
        if (!state.selectedPet || (!state.selectedPackage && !state.selectedItems.length)) {
            return '';
        }
        var pet = state.selectedPet;
        var history = App.store.getPetServices(pet.id);
        var owner = pet.ownerId ? App.store.getCustomerById(pet.ownerId) : null;
        var pkgResult = state.selectedPackage ? App.calculator.calculatePackage(state.selectedPackage.id, pet) : null;
        var calc = App.calculator.calculateCheckout(state.selectedItems, pkgResult, owner);
        return App.components.servicePanel.renderCheckoutSummary(calc);
    }

    function renderQueueTable(filter) {
        filter = filter || 'all';
        var store = App.store.getCurrentStore();
        var today = new Date().toISOString().slice(0, 10);
        var all = App.store.getServices({ storeId: store.id });
        all = all.filter(function(s) { return s.startTime.indexOf(today) === 0; });
        if (filter !== 'all') all = all.filter(function(s) { return s.status === filter; });
        all.sort(function(a, b) {
            var orderMap = { pending: 0, in_progress: 1, completed: 2 };
            var sa = orderMap[a.status] || 0;
            var sb = orderMap[b.status] || 0;
            if (sa !== sb) return sa - sb;
            return new Date(a.startTime) - new Date(b.startTime);
        });

        if (!all.length) {
            return '<div class="text-center py-4 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2"></i>暂无服务记录</div>';
        }

        var statusMap = {
            pending: { label: '待接宠', cls: 'warning', icon: 'clock' },
            accepted: { label: '已接宠', cls: 'info', icon: 'hand-index' },
            bathing: { label: '洗护中', cls: 'primary', icon: 'droplet' },
            in_progress: { label: '造型中', cls: 'primary', icon: 'scissors' },
            drying: { label: '吹水中', cls: 'info', icon: 'wind' },
            completed: { label: '已完成', cls: 'success', icon: 'check2-circle' }
        };

        var html = '<table class="table table-hover mb-0 align-middle"><thead class="table-light"><tr>' +
            '<th>序号</th><th>时间</th><th>宠物</th><th>主人</th><th>服务</th>' +
            '<th>美容师</th><th>状态</th><th>操作</th></tr></thead><tbody>';
        all.forEach(function(s, idx) {
            var pet = App.store.getPetById(s.petId);
            var owner = pet ? App.store.getCustomerById(pet.ownerId) : null;
            var groomer = App.store.getGroomerById(s.groomerId);
            var typeName = (App.store.getServiceTypes().find(function(t) { return t.id === s.type; }) || {}).name || s.type;
            var st = statusMap[s.status] || statusMap.pending;

            html += '<tr data-svc-id="' + s.id + '">' +
                '<td>' + (idx + 1) + '</td>' +
                '<td class="small text-muted">' + s.startTime.split(' ')[1].substring(0, 5) + '</td>' +
                '<td><div class="d-flex align-items-center gap-2">' +
                (pet ? (pet.species === 'cat' ? '<i class="bi bi-cat text-info"></i>' : '<i class="bi bi-dog text-warning"></i>') + ' <span class="fw-bold">' + pet.name + '</span><small class="text-muted">(' + pet.breed + ')</small>' : '<i class="bi bi-x-circle text-danger"></i>') +
                '</div></td>' +
                '<td class="small">' + (owner ? owner.name + '<br><span class="text-muted">' + owner.phone + '</span>' : '<span class="text-muted">散客</span>') + '</td>' +
                '<td><span class="badge bg-light text-dark">' + typeName + '</span>' +
                (s.packageId ? ' <span class="badge bg-warning">套餐</span>' : '') + '<br>' +
                '<small class="text-success fw-bold">' + App.calculator.formatMoney(s.price) + '</small></td>' +
                '<td class="small">' + (groomer ? groomer.name + '<br><span class="text-muted">' + groomer.level + '</span>' : '<span class="text-muted">待分配</span>') + '</td>' +
                '<td><span class="badge bg-' + st.cls + '"><i class="bi bi-' + st.icon + ' me-1"></i>' + st.label + '</span></td>' +
                '<td>' +
                (s.status !== 'completed' ? '<button class="btn btn-sm btn-outline-primary btn-update-status" data-id="' + s.id + '">' +
                '<i class="bi bi-arrow-right me-1"></i>推进状态</button> ' : '') +
                '<button class="btn btn-sm btn-outline-info btn-view-detail" data-id="' + s.id + '">' +
                '<i class="bi bi-eye"></i></button>' +
                '</td></tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function bindQueueTable(filter) {
        var html = renderQueueTable(filter);
        $('#queueTableHost').html(html);

        $('#queueTableHost').on('click', '.btn-update-status', function() {
            var id = $(this).data('id');
            var svc = App.store.getServiceById(id);
            if (!svc) return;
            var nextMap = { pending: 'accepted', accepted: 'bathing', bathing: 'in_progress', in_progress: 'drying', drying: 'completed' };
            var next = nextMap[svc.status] || 'completed';
            App.store.updateServiceStatus(id, next);
            App.showToast('状态已更新', 'success');
            bindQueueTable(filter);
        });

        $('#queueTableHost').on('click', '.btn-view-detail', function() {
            var id = $(this).data('id');
            var svc = App.store.getServiceById(id);
            if (!svc) return;
            var pet = App.store.getPetById(svc.petId);
            var groomer = App.store.getGroomerById(svc.groomerId);
            var body = '<div class="row g-3">' +
                '<div class="col-md-4">' + (pet && pet.photos && pet.photos[0] ?
                    '<img src="' + pet.photos[0] + '" class="w-100 rounded" onerror="this.style.display=\'none\'">' : '') + '</div>' +
                '<div class="col-md-8">' +
                '<h6>' + (pet ? pet.name : '未知') + ' · ' + (pet ? pet.breed : '') + '</h6>' +
                '<p class="small text-muted mb-1">开始：' + svc.startTime + ' · 时长：' + svc.duration + '分钟</p>' +
                '<p class="small mb-1">美容师：' + (groomer ? groomer.name : '待分配') + '</p>' +
                '<p class="mb-1">价格：<span class="text-success fw-bold">' + App.calculator.formatMoney(svc.price) + '</span> ' +
                (svc.discount < 1 ? '<small class="text-muted">(已享' + Math.round(svc.discount * 10) + '折)</small>' : '') + '</p>' +
                (svc.notes ? '<p class="small text-danger"><i class="bi bi-info-circle me-1"></i>' + svc.notes + '</p>' : '') +
                '</div></div>';
            App.showModal('服务详情 - ' + svc.id, body);
        });
    }

    function bind(params) {
        refreshPetList();
        bindQueueTable('all');

        $('.queue-filter-btn').on('click', function() {
            $('.queue-filter-btn').removeClass('active');
            $(this).addClass('active');
            bindQueueTable($(this).data('filter'));
        });

        $('#petSearchInput').on('input', function() {
            state.query = $(this).val().trim().toLowerCase();
            refreshPetList();
        });

        $('#filterSpecies').on('change', function() {
            refreshPetList();
        });

        $('#btnNewPet').on('click', function() {
            openPetModal();
        });

        $('#btnNewCustomer').on('click', function() {
            openCustomerModal();
        });

        $('#petList').on('click', '.pet-action-select', function() {
            var id = $(this).data('id');
            var pet = App.store.getPetById(id);
            if (!pet) return;
            state.selectedPet = pet;
            state.selectedCustomer = pet.ownerId ? App.store.getCustomerById(pet.ownerId) : null;
            state.selectedPackage = null;
            state.selectedItems = [];
            refreshContextPanels();
        });

        $('#petList').on('click', '.pet-action-edit', function() {
            var id = $(this).data('id');
            var pet = App.store.getPetById(id);
            openPetModal(pet);
        });

        $('#servicePanelHost').on('click', '.service-add-btn', function() {
            if (!state.selectedPet) {
                App.showToast('请先选择宠物', 'warning');
                return;
            }
            var typeId = $(this).data('type');
            var typeName = $(this).data('name');
            var color = $(this).data('color');
            var category = $(this).data('category');
            var duration = parseInt($(this).data('duration'));
            var priceEl = $('#servicePanelHost .service-price-input[data-type="' + typeId + '"]');
            var adjustEl = $('#servicePanelHost .service-adjust-input[data-type="' + typeId + '"]');
            var price = parseFloat(priceEl.val()) || 0;
            var adjust = parseFloat(adjustEl.val()) || 0;

            var exists = state.selectedItems.some(function(it) { return it.typeId === typeId; });
            if (exists) {
                App.showToast('该服务已添加，如需多次请调整数量', 'warning');
                return;
            }

            state.selectedItems.push({
                typeId: typeId,
                name: typeName,
                color: color,
                category: category,
                price: Math.max(0, price + adjust),
                adjust: adjust,
                duration: duration,
                subtotal: Math.max(0, price + adjust)
            });
            refreshOrderPanels();
            App.showToast('已添加：' + typeName, 'success');
        });

        $('#servicePanelHost').on('click', '.package-apply-btn', function() {
            if (!state.selectedPet) {
                App.showToast('请先选择宠物', 'warning');
                return;
            }
            var id = $(this).data('id');
            var name = $(this).data('name');
            state.selectedPackage = { id: id, name: name };
            state.selectedItems = [];
            refreshOrderPanels();
            App.showToast('已选用套餐：' + name, 'success');
        });

        $('#currentOrderPanel').on('click', '.remove-item-btn', function() {
            var idx = parseInt($(this).data('idx'));
            state.selectedItems.splice(idx, 1);
            refreshOrderPanels();
        });

        $('#currentOrderPanel').on('click', '.remove-package-btn', function() {
            state.selectedPackage = null;
            refreshOrderPanels();
        });

        $('#btnConfirmOrder').on('click', confirmOrder);
    }

    function refreshPetList() {
        var filter = {};
        if (state.query) filter.keyword = state.query;
        var species = $('#filterSpecies').val();
        var list = App.store.getPets(filter);
        if (species) list = list.filter(function(p) { return p.species === species; });
        $('#petCountBadge').text(list.length + ' 只');
        var html = '';
        if (!list.length) {
            html = '<div class="col-12 text-center py-4 text-muted"><i class="bi bi-search-heart fs-1 d-block mb-2"></i>未找到匹配的宠物档案</div>';
        } else {
            list.forEach(function(pet) {
                html += '<div class="col-12">' +
                    App.components.petCard.render(pet, { onEdit: true, onSelect: true }) +
                    '</div>';
            });
        }
        $('#petList').html(html);

        if (state.selectedPet) {
            $('#petList .pet-card[data-pet-id="' + state.selectedPet.id + '"]').addClass('border-primary');
        }
    }

    function refreshContextPanels() {
        $('#currentContextPanel').html(renderContextPanel());
        $('#servicePanelHost').html(renderServicePanelHost());
        var sp = state.selectedPet ? 'selected' : '';
        var badge = sp ? '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>已选择宠物</span>' : '<span class="badge bg-secondary">请先选择宠物</span>';
        $('#currentContextPanel').closest('.card').find('.card-header h6').next().replaceWith(badge);
        refreshOrderPanels();
    }

    function refreshOrderPanels() {
        $('#currentOrderPanel').html(renderOrderPanel());
        $('#orderSummaryHost').html(renderOrderSummary());
        var disabled = !state.selectedPet || (!state.selectedPackage && !state.selectedItems.length);
        $('#btnConfirmOrder').prop('disabled', disabled);
    }

    function openPetModal(pet) {
        var customers = App.store.getCustomers();
        var isEdit = pet && pet.id;
        var body = App.components.petCard.renderForm(pet || {}, customers);
        var footer = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>' +
            '<button type="button" class="btn btn-primary" id="btnSavePet"><i class="bi bi-check2 me-1"></i>' + (isEdit ? '保存修改' : '创建档案') + '</button>';
        App.showModal(isEdit ? '编辑宠物档案' : '新建宠物档案', body, footer);

        $('#btnSavePet').on('click', function() {
            var data = App.components.petCard.collectForm();
            if (!data.name || !data.ownerId) {
                App.showToast('请填写宠物名并选择主人', 'warning');
                return;
            }
            if (isEdit) data.id = pet.id;
            var saved = App.store.savePet(data);
            if (!isEdit && saved) {
                state.selectedPet = saved;
            }
            bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
            App.showToast((isEdit ? '修改' : '创建') + '成功', 'success');
            refreshPetList();
            if (state.selectedPet) refreshContextPanels();
        });
    }

    function openCustomerModal() {
        var body = '<form id="customerForm" class="row g-3">' +
            '<div class="col-md-6"><label class="form-label">姓名 <span class="text-danger">*</span></label>' +
            '<input name="name" class="form-control" required></div>' +
            '<div class="col-md-6"><label class="form-label">手机号 <span class="text-danger">*</span></label>' +
            '<input name="phone" class="form-control" required></div>' +
            '<div class="col-md-4"><label class="form-label">会员等级</label>' +
            '<select name="memberLevel" class="form-select">' +
            '<option value="normal">普通会员</option>' +
            '<option value="silver">银卡会员</option>' +
            '<option value="gold">金卡会员</option>' +
            '<option value="diamond">钻石会员</option>' +
            '</select></div>' +
            '<div class="col-md-4"><label class="form-label">储值 (¥)</label>' +
            '<input name="balance" type="number" class="form-control" value="0" min="0"></div>' +
            '<div class="col-md-4"><label class="form-label">初始积分</label>' +
            '<input name="points" type="number" class="form-control" value="0" min="0"></div>' +
            '<div class="col-12"><label class="form-label">地址</label>' +
            '<input name="address" class="form-control"></div>' +
            '</form>';
        var footer = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>' +
            '<button type="button" class="btn btn-success" id="btnSaveCustomer"><i class="bi bi-person-check me-1"></i>注册会员</button>';
        App.showModal('新会员登记', body, footer);

        $('#btnSaveCustomer').on('click', function() {
            var data = {};
            $('#customerForm [name]').each(function() { data[$(this).attr('name')] = $(this).val(); });
            if (!data.name || !data.phone) {
                App.showToast('请填写姓名和手机号', 'warning');
                return;
            }
            data.balance = parseFloat(data.balance) || 0;
            data.points = parseInt(data.points) || 0;
            App.store.saveCustomer(data);
            bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
            App.showToast('会员注册成功', 'success');
        });
    }

    function confirmOrder() {
        if (!state.selectedPet || (!state.selectedPackage && !state.selectedItems.length)) {
            App.showToast('请完善订单信息', 'warning');
            return;
        }
        var pet = state.selectedPet;
        var history = App.store.getPetServices(pet.id);
        var owner = pet.ownerId ? App.store.getCustomerById(pet.ownerId) : null;
        var pkgResult = state.selectedPackage ? App.calculator.calculatePackage(state.selectedPackage.id, pet) : null;
        var calc = App.calculator.calculateCheckout(state.selectedItems, pkgResult, owner);

        var groomers = App.store.getGroomers({ storeId: App.store.getCurrentStore().id });
        var services = App.store.getServices({ storeId: App.store.getCurrentStore().id, date: new Date().toISOString().slice(0, 10) });
        var waitInfo = App.calculator.estimateWaitTime(services, groomers, App.store.getCurrentStore().id);

        var groomerOptions = '<option value="">自动分配</option>';
        groomers.forEach(function(g) {
            var load = waitInfo.groomers[g.id];
            var rate = load ? load.loadRate : 0;
            var disabled = rate > 90 ? 'disabled' : '';
            groomerOptions += '<option value="' + g.id + '" ' + disabled + '>' + g.name + ' - ' + g.level +
                ' (负载 ' + rate + '%)' + (disabled ? ' - 已满' : '') + '</option>';
        });

        var now = new Date();
        var dateStr = now.toISOString().slice(0, 10);
        var timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        var body = '<div class="row g-3">' +
            '<div class="col-12">' +
            '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>' +
            '确认后将创建服务工单并自动加入排队队列。<br>' +
            '<b>预计总时长：' + App.calculator.formatMinutes(calc.duration) + '</b>；' +
            '<b>应付金额：<span class="text-danger fw-bold">' + App.calculator.formatMoney(calc.finalTotal) + '</span></b>' +
            '</div></div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">服务日期</label>' +
            '<input id="cfDate" type="date" class="form-control" value="' + dateStr + '">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">开始时间</label>' +
            '<input id="cfTime" type="time" class="form-control" value="' + timeStr + '">' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">指定美容师</label>' +
            '<select id="cfGroomer" class="form-select">' + groomerOptions + '</select>' +
            '</div>' +
            '<div class="col-md-6">' +
            '<label class="form-label">服务备注</label>' +
            '<input id="cfNotes" class="form-control" placeholder="例如：主人要求造型修短">' +
            '</div>' +
            '</div>';

        var footer = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">再看看</button>' +
            '<button type="button" class="btn btn-primary" id="btnFinalConfirm">' +
            '<i class="bi bi-check2-square me-1"></i>确认登记并排队</button>';

        App.showModal('确认服务登记', body, footer);

        $('#btnFinalConfirm').on('click', function() {
            var d = $('#cfDate').val();
            var t = $('#cfTime').val();
            var groomerId = $('#cfGroomer').val();
            var notes = $('#cfNotes').val();

            if (!groomerId) {
                var available = groomers.filter(function(g) {
                    var load = waitInfo.groomers[g.id];
                    return load && load.loadRate < 90;
                });
                var sorted = available.sort(function(a, b) {
                    var la = (waitInfo.groomers[a.id] || {}).loadRate || 0;
                    var lb = (waitInfo.groomers[b.id] || {}).loadRate || 0;
                    return la - lb;
                });
                groomerId = sorted[0] ? sorted[0].id : (groomers[0] && groomers[0].id);
            }

            var serviceTypeIds = [];
            if (pkgResult && pkgResult.items) {
                pkgResult.items.forEach(function(it) { serviceTypeIds.push(it.typeId); });
            }
            state.selectedItems.forEach(function(it) { serviceTypeIds.push(it.typeId); });
            var primaryType = serviceTypeIds[0] || 'style';

            var svc = App.store.saveService({
                petId: pet.id,
                ownerId: pet.ownerId || null,
                groomerId: groomerId,
                storeId: App.store.getCurrentStore().id,
                type: primaryType,
                packageId: state.selectedPackage ? state.selectedPackage.id : null,
                status: 'pending',
                startTime: d + ' ' + t + ':00',
                duration: calc.duration,
                price: calc.finalTotal,
                discount: calc.memberDiscount,
                points: calc.pointsEarned,
                notes: notes
            });

            var date = d;
            var tParts = t.split(':');
            var startMin = parseInt(tParts[0]) * 60 + parseInt(tParts[1]);
            var conflict = App.store.checkScheduleConflict(groomerId, date, startMin + 1, 0);
            App.store.saveSchedule({
                groomerId: groomerId,
                storeId: App.store.getCurrentStore().id,
                date: date,
                startTime: d + ' ' + t + ':00',
                duration: calc.duration,
                serviceId: svc.id,
                status: 'booked'
            });

            bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
            App.showToast('登记成功！工单号：' + svc.id + (conflict ? '（注意：该时段美容师有冲突）' : ''), conflict ? 'warning' : 'success');

            resetState();
            refreshPetList();
            refreshContextPanels();
            bindQueueTable('all');
        });
    }

    App.pages.reception = {
        render: render,
        bind: bind
    };

})(typeof window !== 'undefined' ? window : this);
