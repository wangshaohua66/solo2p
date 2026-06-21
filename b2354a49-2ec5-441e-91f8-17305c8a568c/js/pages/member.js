(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.pages = App.pages || {};

    var filter = { keyword: '', level: '' };
    var selectedCustomerId = null;
    var memberVirtualScroller = null;

    function render(params) {
        return '<div class="container-fluid p-0">' +
            '<div class="row g-3 mb-4">' +
            '<div class="col-12">' +
            '<div class="card bg-gradient-warning text-dark shadow-sm">' +
            '<div class="card-body py-3">' +
            '<div class="row align-items-center g-3">' +
            '<div class="col-auto"><h4 class="mb-0 fw-bold"><i class="bi bi-credit-card-2-front me-2"></i>会员管理中心</h4>' +
            '<small class="opacity-75">全门店会员数据互通 · 跨店积分储值通用</small>' +
            '</div>' +
            '<div class="col-md-2"><div class="text-center"><div class="display-6 fw-bold" id="totalMembers">0</div><small class="opacity-75">总会员</small></div></div>' +
            '<div class="col-md-2"><div class="text-center"><div class="display-6 fw-bold text-success" id="totalBalance">0</div><small class="opacity-75">总储值(元)</small></div></div>' +
            '<div class="col-md-2"><div class="text-center"><div class="display-6 fw-bold text-primary" id="totalPoints">0</div><small class="opacity-75">总积分</small></div></div>' +
            '<div class="col-md-2 d-flex gap-2 ms-auto">' +
            '<button class="btn btn-success flex-grow-1" id="btnNewMember"><i class="bi bi-person-plus me-1"></i>新会员</button>' +
            '<button class="btn btn-outline-dark flex-grow-1" id="btnExport"><i class="bi bi-download me-1"></i>导出</button>' +
            '</div></div></div></div></div>' +

            '<div class="card shadow-sm mb-4">' +
            '<div class="card-body py-3">' +
            '<div class="row g-3">' +
            '<div class="col-md-6"><div class="input-group">' +
            '<span class="input-group-text bg-white"><i class="bi bi-search"></i></span>' +
            '<input id="memberSearchInput" type="text" class="form-control" placeholder="搜索会员姓名/手机号...">' +
            '</div></div>' +
            '<div class="col-md-3"><select id="filterLevel" class="form-select">' +
            '<option value="">全部等级</option>' +
            '<option value="normal">普通会员</option>' +
            '<option value="silver">银卡会员</option>' +
            '<option value="gold">金卡会员</option>' +
            '<option value="diamond">钻石会员</option>' +
            '</select></div>' +
            '<div class="col-md-3"><select id="filterSort" class="form-select">' +
            '<option value="reg_date_desc">注册日期（最新）</option>' +
            '<option value="balance_desc">储值余额（高→低）</option>' +
            '<option value="points_desc">积分（高→低）</option>' +
            '<option value="consume_desc">消费次数（高→低）</option>' +
            '</select></div>' +
            '</div></div></div>' +

            '<div class="row g-4">' +
            '<div class="col-lg-7">' +
            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-people-fill me-2 text-primary"></i>会员列表</h6>' +
            '<span class="badge bg-secondary" id="memberCount">0</span>' +
            '</div>' +
            '<div class="card-body p-0"><div id="memberList" class="p-2"></div></div>' +
            '</div></div>' +

            '<div class="col-lg-5">' +
            '<div class="card shadow-sm h-100 sticky-top" style="top:72px;">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-person-badge me-2 text-warning"></i>会员详情</h6>' +
            (selectedCustomerId ? '<span class="badge bg-success">已选中</span>' : '<span class="badge bg-secondary">请选择</span>') +
            '</div>' +
            '<div class="card-body p-0" id="memberDetailPanel">' + renderMemberDetail() + '</div>' +
            '</div></div>' +

            '</div></div>';
    }

    function bind(params) {
        refreshStats();
        refreshMemberList();

        $('#memberSearchInput').on('input', function() {
            filter.keyword = $(this).val().trim().toLowerCase();
            refreshMemberList();
        });

        $('#filterLevel').on('change', function() {
            filter.level = $(this).val();
            refreshMemberList();
        });

        $('#filterSort').on('change', refreshMemberList);

        $('#btnNewMember').on('click', function() {
            openMemberModal();
        });

        $('#btnExport').on('click', function() {
            var data = App.store.exportData();
            var blob = new Blob([data], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'members_' + Date.now() + '.json';
            a.click();
            App.showToast('会员数据已导出', 'success');
        });
    }

    function refreshStats() {
        var list = App.store.getCustomers();
        var totalBalance = 0, totalPoints = 0;
        list.forEach(function(c) {
            totalBalance += Number(c.balance) || 0;
            totalPoints += Number(c.points) || 0;
        });
        $('#totalMembers').text(list.length);
        $('#totalBalance').text(totalBalance.toFixed(0));
        $('#totalPoints').text(totalPoints.toLocaleString());
    }

    function renderMemberItem(c) {
        var levelInfo = App.calculator.getMemberLevel(c.memberLevel);
        var pets = App.store.getPets({ ownerId: c.id });
        var receipts = App.store.getReceipts({ customerId: c.id });
        var totalConsume = receipts.reduce(function(s, r) { return s + Number(r.total); }, 0);
        var isActive = c.id === selectedCustomerId;
        return '<div class="list-group-item list-group-item-action member-item p-3 ' + (isActive ? 'active bg-primary-subtle border-primary' : '') + '" data-id="' + c.id + '" style="min-height:92px;">' +
            '<div class="d-flex align-items-start gap-3">' +
            '<div class="avatar-md bg-gradient-secondary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold">' +
            (c.name ? c.name.charAt(0) : '?') + '</div>' +
            '<div class="flex-grow-1">' +
            '<div class="d-flex align-items-center gap-2 flex-wrap mb-1">' +
            '<span class="fw-bold">' + c.name + '</span>' +
            '<span class="badge" style="background-color:' + levelInfo.color + ';">' + levelInfo.name + '</span>' +
            '<small class="text-muted">' + c.phone + '</small>' +
            '</div>' +
            '<div class="d-flex gap-3 small flex-wrap">' +
            '<span><i class="bi bi-heart me-1"></i>宠物：' + pets.length + ' 只</span>' +
            '<span><i class="bi bi-receipt me-1"></i>消费：' + receipts.length + ' 次</span>' +
            '<span><i class="bi bi-calendar me-1"></i>注册：' + (c.registerDate || '-') + '</span>' +
            '</div>' +
            '<div class="d-flex gap-4 small mt-1">' +
            '<span class="text-success fw-bold">余额：' + App.calculator.formatMoney(c.balance) + '</span>' +
            '<span class="text-primary fw-bold">积分：' + (c.points || 0) + ' pts</span>' +
            '<span class="text-muted">累计：' + App.calculator.formatMoney(totalConsume) + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="d-flex flex-column gap-1">' +
            '<button class="btn btn-sm btn-outline-primary btn-recharge" data-id="' + c.id + '"><i class="bi bi-wallet2 me-1"></i>充值</button>' +
            '<button class="btn btn-sm btn-outline-secondary btn-edit-member" data-id="' + c.id + '"><i class="bi bi-pencil me-1"></i>编辑</button>' +
            '</div></div></div>';
    }

    function refreshMemberList() {
        var list = App.store.getCustomers(filter);
        var sort = $('#filterSort').val() || 'reg_date_desc';
        if (sort === 'balance_desc') list.sort(function(a, b) { return (b.balance || 0) - (a.balance || 0); });
        else if (sort === 'points_desc') list.sort(function(a, b) { return (b.points || 0) - (a.points || 0); });
        else if (sort === 'consume_desc') list.sort(function(a, b) {
            var ca = App.store.getReceipts({ customerId: a.id }).length;
            var cb = App.store.getReceipts({ customerId: b.id }).length;
            return cb - ca;
        });
        else list.sort(function(a, b) { return (b.registerDate || '').localeCompare(a.registerDate || ''); });

        $('#memberCount').text(list.length + ' 位');

        if (!list.length) {
            $('#memberList').html('<div class="text-center py-4 text-muted"><i class="bi bi-people fs-1 d-block mb-2"></i>暂无会员</div>');
            if (memberVirtualScroller) { memberVirtualScroller = null; }
            return;
        }

        var useVirtual = App.utils && App.utils.shouldUseVirtualScroll && App.utils.shouldUseVirtualScroll(list.length);
        var $listContainer = $('#memberList');

        if (useVirtual) {
            $listContainer.css({
                'max-height': '500px',
                'overflow-y': 'auto',
                '-webkit-overflow-scrolling': 'touch',
                'padding': '0'
            });

            if (!memberVirtualScroller) {
                var container = $listContainer[0];
                memberVirtualScroller = App.utils.createVirtualScroller({
                    container: container,
                    items: list,
                    itemHeight: 92,
                    containerHeight: 500,
                    renderItem: renderMemberItem,
                    onItemsRendered: function() {
                        bindMemberListEvents();
                    }
                });
                memberVirtualScroller.render();

                $listContainer.off('scroll.virtual').on('scroll.virtual', function() {
                    if (memberVirtualScroller) {
                        memberVirtualScroller.updateScrollTop(this.scrollTop);
                        bindMemberListEvents();
                    }
                });
            } else {
                memberVirtualScroller.updateItems(list);
                bindMemberListEvents();
            }

            $listContainer.prepend('<div class="alert alert-info py-2 px-3 mb-2 small" style="margin:8px;"><i class="bi bi-info-circle me-1"></i>虚拟滚动已启用（' + list.length + ' 条记录）</div>');
        } else {
            if (memberVirtualScroller) {
                memberVirtualScroller = null;
                $listContainer.off('scroll.virtual');
            }
            $listContainer.css({
                'max-height': 'none',
                'overflow-y': 'visible',
                'padding': '0.5rem'
            });

            var html = '<div class="list-group list-group-flush">';
            list.forEach(function(c) {
                html += renderMemberItem(c);
            });
            html += '</div>';
            $listContainer.html(html);
            bindMemberListEvents();
        }
    }

    function bindMemberListEvents() {
        $('#memberList').off('click', '.member-item').on('click', '.member-item', function() {
            selectedCustomerId = $(this).data('id');
            refreshMemberList();
            $('#memberDetailPanel').html(renderMemberDetail());
            $('#memberDetailPanel').closest('.card').find('.card-header h6').next().replaceWith('<span class="badge bg-success">已选中</span>');
            bindMemberDetailEvents();
        });

        $('#memberList').off('click', '.btn-recharge').on('click', '.btn-recharge', function(e) {
            e.stopPropagation();
            openRechargeModal($(this).data('id'));
        });

        $('#memberList').off('click', '.btn-edit-member').on('click', '.btn-edit-member', function(e) {
            e.stopPropagation();
            var id = $(this).data('id');
            var c = App.store.getCustomerById(id);
            openMemberModal(c);
        });
    }

    function renderMemberDetail() {
        if (!selectedCustomerId) {
            return '<div class="text-center py-5 text-muted">' +
                '<i class="bi bi-arrow-up-left-circle fs-1 d-block mb-2"></i>' +
                '<h6 class="text-muted">请从左侧选择会员</h6>' +
                '<small>查看详情、充值、消费记录等</small></div>';
        }
        var c = App.store.getCustomerById(selectedCustomerId);
        if (!c) {
            return '<div class="text-center py-4 text-danger">会员信息不存在</div>';
        }
        var levelInfo = App.calculator.getMemberLevel(c.memberLevel);
        var pets = App.store.getPets({ ownerId: c.id });
        var receipts = App.store.getReceipts({ customerId: c.id });
        var totalConsume = receipts.reduce(function(s, r) { return s + Number(r.total); }, 0);

        var discountText = levelInfo.discount < 1 ? '<span class="text-success">享' + (levelInfo.discount * 10) + '折优惠</span>' : '<span class="text-muted">暂无折扣</span>';
        var nextLevel = null;
        var levels = ['normal', 'silver', 'gold', 'silver'];
        var idx = levels.indexOf(c.memberLevel);
        if (idx >= 0 && idx < levels.length - 1) {
            nextLevel = App.calculator.getMemberLevel(levels[idx + 1]);
        }
        var upgradeNeed = nextLevel ? Math.max(0, 10000 - totalConsume) : 0;

        var petsHtml = '';
        pets.forEach(function(p) {
            petsHtml += '<div class="col-6"><div class="card border-0 bg-light p-2 rounded">' +
                '<div class="d-flex gap-2 align-items-center">' +
                (p.photos && p.photos[0] ?
                    '<img src="' + p.photos[0] + '" class="rounded" style="width:40px;height:40px;object-fit:cover;">' :
                    '<div class="rounded bg-secondary-subtle d-flex align-items-center justify-content-center" style="width:40px;height:40px;"><i class="bi bi-' + (p.species === 'cat' ? 'cat' : 'dog') + '"></i></div>') +
                '<div class="flex-grow-1">' +
                '<div class="fw-bold small">' + p.name + '</div>' +
                '<div class="text-muted" style="font-size:0.7rem;">' + (p.breed || '') + '</div></div></div></div></div>';
        });

        var receiptsHtml = '';
        if (!receipts.length) {
            receiptsHtml = '<div class="text-center py-2 text-muted small">暂无消费记录</div>';
        } else {
            receiptsHtml = '<div class="list-group list-group-flush small">';
            receipts.slice(0, 10).forEach(function(r) {
                var store = App.store.getStores().find(function(s) { return s.id === r.storeId; });
                receiptsHtml += '<a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2">' +
                    '<div><div><i class="bi bi-shop me-1"></i>' + (store ? store.name : '门店') +
                        '<span class="text-muted ms-2">' + r.date.substring(5, 16) + '</span></div>' +
                        '<small class="text-muted">支付方式：' + ({cash:'现金', stored:'储值卡', qr:'扫码支付'}[r.payMethod] || r.payMethod) +
                        ' · 积分+' + r.pointsEarned + '</small></div>' +
                        '<div class="text-end"><div class="text-success fw-bold">' + App.calculator.formatMoney(r.total) + '</div>' +
                        '<small class="text-muted">' + r.id + '</small></div></a>';
            });
            receiptsHtml += '</div>';
        }

        return '<div class="p-3">' +
            '<div class="text-white p-3 rounded mb-3" style="background: linear-gradient(135deg,' + levelInfo.color + ',#333);">' +
            '<div class="d-flex justify-content-between align-items-start mb-3">' +
            '<div>' +
            '<div class="fw-bold fs-5">' + c.name + ' · ' + levelInfo.name + '</div>' +
            '<div class="small opacity-75">会员卡号：MC' + String(c.id).toUpperCase().replace(/[^0-9]/g, '').padStart(8, '0') + '</div>' +
            '</div>' +
            '<i class="bi bi-patch-check fs-3 opacity-50"></i>' +
            '</div>' +
            '<div class="row">' +
            '<div class="col-6">' +
            '<div class="small opacity-75">储值余额</div>' +
            '<div class="fs-4 fw-bold">' + App.calculator.formatMoney(c.balance) + '</div>' +
            '</div>' +
            '<div class="col-6 text-end">' +
            '<div class="small opacity-75">可用积分</div>' +
            '<div class="fs-4 fw-bold">' + (c.points || 0) + '</div>' +
            '</div></div></div>' +

            '<div class="row g-2 mb-3 small">' +
            '<div class="col-6"><i class="bi bi-telephone me-1 text-muted"></i>' + c.phone + '</div>' +
            '<div class="col-6">' + discountText + '</div>' +
            '<div class="col-6"><i class="bi bi-geo-alt me-1 text-muted"></i>' + (c.address || '未设置') + '</div>' +
            '<div class="col-6"><i class="bi bi-calendar-plus me-1 text-muted"></i>注册：' + (c.registerDate || '-') + '</div>' +
            '<div class="col-12">' +
            '<div class="d-flex justify-content-between small mb-1"><span>累计消费 ' + App.calculator.formatMoney(totalConsume) + '</span>' +
            (nextLevel ? '<span class="text-muted">距' + nextLevel.name + '还差 ' + App.calculator.formatMoney(upgradeNeed) + '</span>' : '<span class="text-success">已达顶级</span>') +
            '</div>' +
            '<div class="progress" style="height:6px;">' +
            '<div class="progress-bar" style="width:' + (nextLevel ? Math.min(100, totalConsume / 10000 * 100) : 100) + '%; background: linear-gradient(90deg,' + levelInfo.color + ',' + (nextLevel ? nextLevel.color : levelInfo.color) + ');"></div>' +
            '</div></div></div>' +

            '<h6 class="fw-bold mb-2"><i class="bi bi-heart me-1 text-danger"></i>关联宠物 <span class="badge bg-secondary">' + pets.length + '</span></h6>' +
            (pets.length ? '<div class="row g-2 mb-3">' + petsHtml + '</div>' :
                '<div class="alert alert-secondary py-2 small mb-3">该会员暂无宠物档案</div>') +

            '<div class="d-grid gap-2 d-flex mb-3">' +
            '<button class="btn btn-success flex-grow-1 btn-detail-recharge"><i class="bi bi-wallet2 me-1"></i>充值</button>' +
            '<button class="btn btn-primary flex-grow-1 btn-detail-addpet"><i class="bi bi-plus-circle me-1"></i>添加宠物</button>' +
            '<button class="btn btn-outline-secondary flex-grow-1 btn-detail-edit"><i class="bi bi-pencil me-1"></i>修改信息</button>' +
            '</div>' +

            '<h6 class="fw-bold mb-2"><i class="bi bi-receipt-cutoff me-1 text-info"></i>最近消费记录</h6>' +
            receiptsHtml +
            '</div>';
    }

    function bindMemberDetailEvents() {
        $('#memberDetailPanel').off('click', '.btn-detail-recharge').on('click', '.btn-detail-recharge', function() {
            if (!selectedCustomerId) return;
            openRechargeModal(selectedCustomerId);
        });
        $('#memberDetailPanel').off('click', '.btn-detail-edit').on('click', '.btn-detail-edit', function() {
            var c = App.store.getCustomerById(selectedCustomerId);
            openMemberModal(c);
        });
        $('#memberDetailPanel').off('click', '.btn-detail-addpet').on('click', '.btn-detail-addpet', function() {
            openPetModalFor(selectedCustomerId);
        });
    }

    function openMemberModal(customer) {
        var isEdit = customer && customer.id;
        var body = '<form id="memberForm" class="row g-3">' +
            '<div class="col-md-6"><label class="form-label">姓名 <span class="text-danger">*</span></label>' +
            '<input name="name" class="form-control" value="' + (customer ? customer.name : '') + '" required></div>' +
            '<div class="col-md-6"><label class="form-label">手机号 <span class="text-danger">*</span></label>' +
            '<input name="phone" class="form-control" value="' + (customer ? customer.phone : '') + '" required></div>' +
            '<div class="col-md-4"><label class="form-label">会员等级</label>' +
            '<select name="memberLevel" class="form-select">' +
            '<option value="normal" ' + (customer && customer.memberLevel === 'normal' ? 'selected' : '') + '>普通会员</option>' +
            '<option value="silver" ' + (customer && customer.memberLevel === 'silver' ? 'selected' : '') + '>银卡会员</option>' +
            '<option value="gold" ' + (customer && customer.memberLevel === 'gold' ? 'selected' : '') + '>金卡会员</option>' +
            '<option value="diamond" ' + (customer && customer.memberLevel === 'diamond' ? 'selected' : '') + '>钻石会员</option>' +
            '</select></div>' +
            '<div class="col-md-4"><label class="form-label">储值余额 (¥)</label>' +
            '<input name="balance" type="number" class="form-control" value="' + (customer ? customer.balance : 0) + '" min="0"></div>' +
            '<div class="col-md-4"><label class="form-label">积分</label>' +
            '<input name="points" type="number" class="form-control" value="' + (customer ? customer.points : 0) + '" min="0"></div>' +
            '<div class="col-12"><label class="form-label">地址</label>' +
            '<input name="address" class="form-control" value="' + (customer ? customer.address || '' : '') + '"></div>' +
            (isEdit ? '<input type="hidden" name="id" value="' + customer.id + '">' : '') +
            '</form>';
        var footer = '<button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>' +
            '<button class="btn btn-primary" id="btnSaveMember"><i class="bi bi-check2 me-1"></i>' + (isEdit ? '保存修改' : '注册会员') + '</button>';
        App.showModal(isEdit ? '编辑会员信息' : '新会员登记', body, footer);

        $('#btnSaveMember').on('click', function() {
            var data = {};
            $('#memberForm [name]').each(function() { data[$(this).attr('name')] = $(this).val(); });
            if (!data.name || !data.phone) { App.showToast('请填写姓名和手机号', 'warning'); return; }
            data.balance = parseFloat(data.balance) || 0;
            data.points = parseInt(data.points) || 0;
            App.store.saveCustomer(data);
            bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
            App.showToast((isEdit ? '修改' : '注册') + '成功', 'success');
            refreshStats();
            refreshMemberList();
            if (selectedCustomerId) $('#memberDetailPanel').html(renderMemberDetail());
        });
    }

    function openRechargeModal(customerId) {
        var c = App.store.getCustomerById(customerId);
        if (!c) return;
        var body = '<div class="mb-3">' +
            '<div class="card bg-light p-3 mb-3">' +
            '<div class="d-flex justify-content-between mb-1"><span class="text-muted">当前会员</span><b>' + c.name + '</b></div>' +
            '<div class="d-flex justify-content-between mb-1"><span class="text-muted">当前等级</span>' + App.calculator.getLevelBadge(c.memberLevel) + '</div>' +
            '<div class="d-flex justify-content-between"><span class="text-muted">当前余额</span><b class="text-success">' + App.calculator.formatMoney(c.balance) + '</b></div>' +
            '</div>' +
            '<label class="form-label">充值金额 (¥)</label>' +
            '<div class="input-group mb-2">' +
            '<span class="input-group-text">¥</span>' +
            '<input type="number" id="rechargeAmount" class="form-control form-control-lg" value="500" min="1" step="50">' +
            '</div>' +
            '<div class="d-flex gap-2 flex-wrap mb-3">' +
            '<button class="btn btn-outline-primary quick-amount" data-val="100">+100</button>' +
            '<button class="btn btn-outline-primary quick-amount" data-val="300">+300</button>' +
            '<button class="btn btn-outline-primary quick-amount" data-val="500">+500</button>' +
            '<button class="btn btn-outline-primary quick-amount" data-val="1000">+1000</button>' +
            '<button class="btn btn-outline-primary quick-amount" data-val="2000">+2000</button>' +
            '<button class="btn btn-outline-primary quick-amount" data-val="5000">+5000</button>' +
            '</div>' +
            '<div class="alert alert-info py-2 small mb-0">' +
            '<i class="bi bi-info-circle me-1"></i>充值赠送：满500送50，满1000送150，满2000送400，满5000送1200</div>' +
            '</div>';
        var footer = '<button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>' +
            '<button class="btn btn-success" id="btnDoRecharge"><i class="bi bi-wallet2 me-1"></i>确认充值</button>';
        App.showModal('会员充值 - ' + c.name, body, footer);

        $('.quick-amount').on('click', function() { $('#rechargeAmount').val($(this).data('val')); });

        $('#btnDoRecharge').on('click', function() {
            var amount = parseFloat($('#rechargeAmount').val());
            if (!amount || amount <= 0) { App.showToast('请输入有效金额', 'warning'); return; }
            var bonus = 0;
            if (amount >= 5000) bonus = 1200;
            else if (amount >= 2000) bonus = 400;
            else if (amount >= 1000) bonus = 150;
            else if (amount >= 500) bonus = 50;
            var total = amount + bonus;
            var msg = '确认充值 ' + App.calculator.formatMoney(amount);
            if (bonus) msg += '，赠送 ' + App.calculator.formatMoney(bonus) + '，实充 ' + App.calculator.formatMoney(total);
            msg += ' ?';
            if (!confirm(msg)) return;
            App.store.rechargeCustomer(customerId, total);
            App.store.saveReceipt({
                storeId: App.store.getCurrentStore().id,
                customerId: customerId,
                items: [{ name: '会员充值', price: amount, qty: 1 }, { name: '充值赠送', price: bonus, qty: 1 }],
                subtotal: amount,
                discount: 0,
                pointsUsed: 0,
                total: amount,
                payMethod: 'cash',
                pointsEarned: Math.floor(amount / 10),
                operatorId: 'op1'
            });
            bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
            App.showToast('充值成功，实充 ' + App.calculator.formatMoney(total), 'success');
            refreshStats();
            refreshMemberList();
            if (selectedCustomerId) {
                $('#memberDetailPanel').html(renderMemberDetail());
            }
        });
    }

    function openPetModalFor(ownerId) {
        var customers = App.store.getCustomers();
        var body = App.components.petCard.renderForm({ ownerId: ownerId }, customers);
        var footer = '<button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>' +
            '<button class="btn btn-primary" id="btnSavePetFromMember"><i class="bi bi-check2 me-1"></i>创建档案</button>';
        App.showModal('为该会员添加宠物', body, footer);
        $('#btnSavePetFromMember').on('click', function() {
            var data = App.components.petCard.collectForm();
            if (!data.name) { App.showToast('请填写宠物名', 'warning'); return; }
            data.ownerId = data.ownerId || ownerId;
            App.store.savePet(data);
            bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
            App.showToast('宠物档案创建成功', 'success');
            refreshMemberList();
            if (selectedCustomerId) $('#memberDetailPanel').html(renderMemberDetail());
        });
    }

    App.pages.member = {
        render: render,
        bind: bind
    };

})(typeof window !== 'undefined' ? window : this);
