(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.pages = App.pages || {};

    var state = {
        cart: [],
        customer: null,
        useBalance: false,
        usePoints: 0
    };

    function render() {
        return '<div class="container-fluid p-0">' +
            '<div class="row g-3 mb-4">' +
            '<div class="col-12"><div class="card bg-gradient-success text-white shadow-sm">' +
            '<div class="card-body py-3">' +
            '<div class="row align-items-center g-3">' +
            '<div class="col-auto"><h4 class="mb-0 fw-bold"><i class="bi bi-cash-coin me-2"></i>收银结算台</h4>' +
            '<small class="opacity-75">支持多项目合并、会员折扣、储值卡扣款、混合支付</small>' +
            '</div></div></div></div></div></div>' +

            '<div class="row g-4">' +

            '<div class="col-lg-7">' +
            '<div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-cart-plus me-2 text-primary"></i>选择服务项目</h6>' +
            '<button class="btn btn-sm btn-outline-secondary" id="btnAddService"><i class="bi bi-plus me-1"></i>添加服务</button>' +
            '</div>' +
            '<div class="card-body p-0" id="cartHost"></div>' +
            '</div></div>' +

            '<div class="col-lg-5">' +
            '<div class="card shadow-sm mb-3">' +
            '<div class="card-header bg-white d-flex justify-content-between align-items-center">' +
            '<h6 class="mb-0 fw-bold"><i class="bi bi-person-vcard me-2 text-warning"></i>会员信息</h6>' +
            '<button class="btn btn-sm btn-outline-secondary" id="btnLinkMember"><i class="bi bi-link-45deg me-1"></i>关联会员</button>' +
            '</div>' +
            '<div class="card-body" id="memberHost"></div>' +
            '</div>' +

            '<div class="card shadow-sm mb-3">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-calculator me-2 text-info"></i>费用计算</h6></div>' +
            '<div class="card-body p-0" id="calcHost"></div>' +
            '</div>' +

            '<div class="card shadow-sm">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-wallet2 me-2 text-success"></i>支付方式</h6></div>' +
            '<div class="card-body" id="payHost"></div>' +
            '</div>' +

            '</div></div></div>';
    }

    function bind() {
        renderCart();
        renderMember();
        renderCalc();
        renderPay();

        $('#btnAddService').on('click', openAddServiceModal);
        $('#btnLinkMember').on('click', openLinkMemberModal);

        $('#cartHost').on('click', '.btn-remove-cart-item', function() {
            var idx = $(this).data('idx');
            state.cart.splice(idx, 1);
            renderCart(); renderCalc(); renderPay();
        });
    }

    function openAddServiceModal() {
        var types = App.store.getServiceTypes();
        var pets = App.store.getPets();
        var body = '<form id="addSvcForm" class="row g-3">' +
            '<div class="col-md-6"><label class="form-label">关联宠物</label>' +
            '<select name="petId" class="form-select"><option value="">散客服务</option>' +
            pets.map(function(p) {
                var owner = p.ownerId ? App.store.getCustomerById(p.ownerId) : null;
                return '<option value="' + p.id + '">' + p.name + ' - ' + p.breed +
                    (owner ? '（' + owner.name + '）' : '') + '</option>';
            }).join('') +
            '</select></div>' +
            '<div class="col-md-6"><label class="form-label">服务类型 <span class="text-danger">*</span></label>' +
            '<select name="typeId" class="form-select" required>' +
            types.map(function(t) {
                return '<option value="' + t.id + '">' + t.name + ' (' + t.category + ') · ¥' + t.priceMin + '-' + t.priceMax + '</option>';
            }).join('') +
            '</select></div>' +
            '<div class="col-md-6"><label class="form-label">服务价格</label>' +
            '<div class="input-group"><span class="input-group-text">¥</span>' +
            '<input type="number" name="price" class="form-control" value="120" min="0"></div></div>' +
            '<div class="col-md-6"><label class="form-label">价格调整</label>' +
            '<div class="input-group"><span class="input-group-text">±¥</span>' +
            '<input type="number" name="adjust" class="form-control" value="0"></div></div>' +
            '<div class="col-md-6"><label class="form-label">服务时长 (分钟)</label>' +
            '<input type="number" name="duration" class="form-control" value="60" min="15" step="15"></div>' +
            '<div class="col-md-6"><label class="form-label">数量</label>' +
            '<input type="number" name="qty" class="form-control" value="1" min="1"></div>' +
            '<div class="col-12"><label class="form-label">备注</label>' +
            '<input name="notes" class="form-control"></div>' +
            '</form>';
        var footer = '<button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>' +
            '<button class="btn btn-primary" id="btnAddSvc"><i class="bi bi-plus-circle me-1"></i>添加到购物车</button>';
        App.showModal('添加服务项目', body, footer);
        $('#btnAddSvc').on('click', function() {
            var data = {};
            $('#addSvcForm [name]').each(function() { data[$(this).attr('name')] = $(this).val(); });
            if (!data.typeId) { App.showToast('请选择服务类型', 'warning'); return; }
            var st = types.find(function(t) { return t.id === data.typeId; });
            var price = parseFloat(data.price) || 0;
            var adjust = parseFloat(data.adjust) || 0;
            var qty = parseInt(data.qty) || 1;
            var finalPrice = Math.max(0, price + adjust);
            state.cart.push({
                petId: data.petId,
                typeId: data.typeId,
                name: st.name,
                color: st.color,
                category: st.category,
                duration: parseInt(data.duration) || st.duration,
                price: finalPrice,
                qty: qty,
                subtotal: finalPrice * qty,
                notes: data.notes || ''
            });
            bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
            App.showToast('已添加：' + st.name, 'success');
            renderCart(); renderCalc(); renderPay();
        });
    }

    function openLinkMemberModal() {
        var customers = App.store.getCustomers();
        var body = '<div class="mb-3"><input type="text" id="memberSearch" class="form-control" placeholder="搜索姓名/手机号..."></div>' +
            '<div id="memberSearchList" style="max-height:400px;overflow:auto;" class="list-group"></div>';
        var footer = state.customer ?
            '<button class="btn btn-danger me-auto" id="btnUnlinkMember">取消关联</button>' +
            '<button class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>' :
            '<button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>';
        App.showModal('关联会员', body, footer);

        function renderList(kw) {
            kw = (kw || '').trim().toLowerCase();
            var list = customers.filter(function(c) {
                return !kw || c.name.toLowerCase().includes(kw) || c.phone.includes(kw);
            }).slice(0, 50);
            var html = '';
            list.forEach(function(c) {
                var lv = App.calculator.getMemberLevel(c.memberLevel);
                html += '<a href="#" class="list-group-item list-group-item-action member-link-item" data-id="' + c.id + '">' +
                    '<div class="d-flex justify-content-between align-items-center">' +
                    '<div><b>' + c.name + '</b> <small class="text-muted">' + c.phone + '</small></div>' +
                    '<span class="badge" style="background-color:' + lv.color + ';">' + lv.name + '</span>' +
                    '</div><div class="small mt-1">' +
                    '<span class="text-success">余额：' + App.calculator.formatMoney(c.balance) + '</span> · ' +
                    '<span class="text-primary">积分：' + c.points + '</span></div></a>';
            });
            $('#memberSearchList').html(html || '<div class="text-center py-3 text-muted">未找到匹配会员</div>');
            $('.member-link-item').on('click', function(e) {
                e.preventDefault();
                var id = $(this).data('id');
                state.customer = App.store.getCustomerById(id);
                state.useBalance = true;
                state.usePoints = 0;
                bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
                App.showToast('已关联：' + state.customer.name, 'success');
                renderMember(); renderCalc(); renderPay();
            });
        }
        renderList();
        $('#memberSearch').on('input', function() { renderList($(this).val()); });
        $('#btnUnlinkMember').on('click', function() {
            state.customer = null; state.useBalance = false; state.usePoints = 0;
            bootstrap.Modal.getInstance($('#globalModal')[0]).hide();
            App.showToast('已取消会员关联', 'info');
            renderMember(); renderCalc(); renderPay();
        });
    }

    function renderCart() {
        var html = '';
        if (!state.cart.length) {
            html = '<div class="text-center py-5 text-muted"><i class="bi bi-cart-x fs-1 d-block mb-2"></i>购物车为空，点击右上角添加服务</div>';
        } else {
            html = '<div class="list-group list-group-flush">';
            state.cart.forEach(function(it, idx) {
                var pet = it.petId ? App.store.getPetById(it.petId) : null;
                html += '<div class="list-group-item d-flex align-items-center gap-3 p-3">' +
                    '<span class="service-color-dot me-1" style="background-color:' + it.color + ';width:8px;height:48px;"></span>' +
                    '<div class="flex-grow-1">' +
                    '<div class="fw-bold">' + it.name + (it.qty > 1 ? ' × ' + it.qty : '') + '</div>' +
                    '<div class="small text-muted">' +
                    (pet ? pet.name + ' · ' : '') + it.category + ' · ' + App.calculator.formatMinutes(it.duration) +
                    (it.notes ? ' · <i class="bi bi-sticky"></i> ' + it.notes : '') +
                    '</div></div>' +
                    '<div class="text-end">' +
                    '<div class="fw-bold text-success fs-5">' + App.calculator.formatMoney(it.subtotal) + '</div>' +
                    '<small class="text-muted">单价 ' + App.calculator.formatMoney(it.price) + '</small></div>' +
                    '<button class="btn btn-sm btn-outline-danger btn-remove-cart-item" data-idx="' + idx + '"><i class="bi bi-trash"></i></button>' +
                    '</div>';
            });
            html += '</div>';
        }
        $('#cartHost').html(html);
    }

    function renderMember() {
        var html = '';
        if (!state.customer) {
            html = '<div class="text-center py-3 text-muted small"><i class="bi bi-person-x d-block mb-1"></i>当前为散客结算，关联会员可享折扣</div>';
        } else {
            var lv = App.calculator.getMemberLevel(state.customer.memberLevel);
            html = '<div class="d-flex align-items-center gap-3">' +
                '<div class="avatar-md text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" style="background-color:' + lv.color + ';">' +
                state.customer.name.charAt(0) + '</div>' +
                '<div class="flex-grow-1">' +
                '<div class="fw-bold">' + state.customer.name + ' <span class="badge" style="background-color:' + lv.color + ';">' + lv.name + '</span></div>' +
                '<div class="small text-muted">' + state.customer.phone + '</div>' +
                '<div class="row mt-1 small">' +
                '<div class="col-auto text-success">余额：<b>' + App.calculator.formatMoney(state.customer.balance) + '</b></div>' +
                '<div class="col-auto text-primary">积分：<b>' + state.customer.points + '</b></div>' +
                '<div class="col-auto">折扣：<b>' + (lv.discount * 100 / 10) + '折</b></div>' +
                '</div></div></div>';
        }
        $('#memberHost').html(html);
    }

    function renderCalc() {
        var subtotal = state.cart.reduce(function(s, it) { return s + it.subtotal; }, 0);
        var lv = state.customer ? App.calculator.getMemberLevel(state.customer.memberLevel) : null;
        var memberDisc = lv ? Math.round(subtotal * (1 - lv.discount)) : 0;
        var usePointsVal = state.usePoints || 0;
        var pointDisc = Math.min(usePointsVal * 0.01, Math.max(0, subtotal - memberDisc));
        var total = Math.max(0, subtotal - memberDisc - pointDisc);

        state.usePoints = pointDisc / 0.01;

        var html = '<table class="table table-sm mb-0 align-middle"><tbody class="small">' +
            '<tr><td class="p-3">商品小计</td><td class="p-3 text-end">' + state.cart.length + ' 项</td><td class="p-3 text-end fw-bold">' + App.calculator.formatMoney(subtotal) + '</td></tr>';
        if (lv) {
            html += '<tr class="text-success"><td class="px-3 pb-3">' + lv.name + '优惠（' + (lv.discount * 100 / 10) + '折）</td><td></td><td class="px-3 pb-3 text-end">- ' + App.calculator.formatMoney(memberDisc) + '</td></tr>';
        }
        if (pointDisc > 0) {
            html += '<tr class="text-primary"><td class="px-3 pb-3">积分抵扣（' + Math.round(state.usePoints) + '积分）</td><td></td><td class="px-3 pb-3 text-end">- ' + App.calculator.formatMoney(pointDisc) + '</td></tr>';
        }
        html += '<tr class="table-active"><td class="p-3"><h6 class="mb-0 fw-bold">应付金额</h6></td><td></td>' +
            '<td class="p-3 text-end"><h5 class="mb-0 text-danger fw-bold">' + App.calculator.formatMoney(total) + '</h5></td></tr>' +
            '</tbody></table>';
        $('#calcHost').html(html);
        return { subtotal: subtotal, memberDisc: memberDisc, pointDisc: pointDisc, total: total };
    }

    function renderPay() {
        var res = renderCalc();

        var useBalanceHtml = '';
        if (state.customer && state.customer.balance > 0) {
            var disabled = state.customer.balance < res.total ? 'disabled' : '';
            useBalanceHtml = '<div class="mb-3">' +
                '<label class="form-check form-switch">' +
                '<input type="checkbox" class="form-check-input" id="chkUseBalance" ' + (state.useBalance ? 'checked ' : '') + disabled + '>' +
                '<span class="form-check-label">使用储值卡扣款（余额：' + App.calculator.formatMoney(state.customer.balance) + '）</span>' +
                '</label></div>';
        }

        var pointsHtml = '';
        if (state.customer && state.customer.points > 0) {
            pointsHtml = '<div class="mb-3">' +
                '<label class="form-label small">使用积分抵扣（当前可用 ' + state.customer.points + ' 积分 = ' + App.calculator.formatMoney(state.customer.points * 0.01) + '）</label>' +
                '<input type="range" class="form-range" id="rangePoints" min="0" max="' + state.customer.points + '" step="100" value="' + Math.round(state.usePoints) + '">' +
                '<div class="d-flex justify-content-between small text-muted"><span>0</span><span id="pointsLabel">' + Math.round(state.usePoints) + ' 积分（抵 ' + App.calculator.formatMoney(state.usePoints * 0.01) + '）</span><span>' + state.customer.points + '</span></div>' +
                '</div>';
        }

        var balancePay = state.useBalance ? Math.min(state.customer ? state.customer.balance : 0, res.total) : 0;
        var remaining = Math.max(0, res.total - balancePay);
        var payHtml = '<div class="mb-3"><label class="form-label fw-bold mb-2">选择支付方式（需支付 ' + App.calculator.formatMoney(remaining) + '）</label>' +
            '<div class="row g-2">' +
            '<label class="col-md-4 pay-method-card ' + (remaining <= 0 ? 'opacity-50' : '') + '">' +
            '<input type="radio" name="payMethod" value="cash" class="d-none" ' + (balancePay > 0 && remaining <= 0 ? 'disabled' : 'checked') + '>' +
            '<div class="card p-3 text-center border ' + (balancePay > 0 && remaining <= 0 ? 'border-secondary' : 'border-primary') + '">' +
            '<i class="bi bi-cash fs-3 ' + (balancePay > 0 && remaining <= 0 ? 'text-secondary' : 'text-primary') + ' d-block mb-1"></i>' +
            '<span class="small fw-bold">现金</span></div></label>' +
            '<label class="col-md-4 pay-method-card ' + (remaining <= 0 ? 'opacity-50' : '') + '">' +
            '<input type="radio" name="payMethod" value="qr" class="d-none" ' + (balancePay > 0 && remaining <= 0 ? 'disabled' : '') + '>' +
            '<div class="card p-3 text-center border border-secondary">' +
            '<i class="bi bi-qr-code-scan fs-3 text-success d-block mb-1"></i>' +
            '<span class="small fw-bold">扫码支付</span></div></label>' +
            '<label class="col-md-4 pay-method-card ' + (remaining <= 0 ? 'opacity-50' : '') + '">' +
            '<input type="radio" name="payMethod" value="card" class="d-none" ' + (balancePay > 0 && remaining <= 0 ? 'disabled' : '') + '>' +
            '<div class="card p-3 text-center border border-secondary">' +
            '<i class="bi bi-credit-card fs-3 text-warning d-block mb-1"></i>' +
            '<span class="small fw-bold">银行卡</span></div></label>' +
            '</div></div>';

        $('#payHost').html(useBalanceHtml + pointsHtml + payHtml +
            '<button class="btn btn-success btn-lg w-100 fw-bold mt-2" id="btnCheckout" ' + (!state.cart.length ? 'disabled' : '') + '>' +
            '<i class="bi bi-check2-square me-2"></i>确认结算并生成小票</button>' +
            '<button class="btn btn-outline-secondary w-100 mt-2" id="btnSendSms"><i class="bi bi-send me-1"></i>发送短信小票</button>');

        $('#chkUseBalance').on('change', function() {
            state.useBalance = $(this).is(':checked');
            renderCalc(); renderPay();
        });

        $('#rangePoints').on('input', function() {
            state.usePoints = parseInt($(this).val());
            renderCalc(); renderPay();
        });

        $('#btnCheckout').on('click', function() { doCheckout(res, balancePay); });
        $('#btnSendSms').on('click', function() {
            if (!state.customer) { App.showToast('请先关联会员以发送短信', 'warning'); return; }
            App.showToast('电子小票短信已发送至 ' + state.customer.phone, 'success');
        });
    }

    function doCheckout(calc, balanceUsed) {
        if (!state.cart.length) return;
        var payMethod = $('input[name="payMethod"]:checked').val() || 'cash';
        if (state.useBalance) payMethod = 'stored';

        var petIds = state.cart.map(function(it) { return it.petId; }).filter(Boolean);
        var customerId = state.customer ? state.customer.id : null;

        if (state.customer) {
            if (balanceUsed > 0 || state.usePoints > 0) {
                App.store.deductCustomer(state.customer.id,
                    calc.total + (calc.pointDisc > 0 ? 0 : 0), state.usePoints || 0);
                if (balanceUsed > 0) {
                    App.store.deductCustomer(state.customer.id, balanceUsed, 0);
                }
            }
            var pointsEarned = Math.floor(calc.total / 10) * (state.customer ? App.calculator.getMemberLevel(state.customer.memberLevel).pointRate : 1);
            App.store.addPoints(state.customer.id, Math.round(pointsEarned));
        }

        var receipt = App.store.saveReceipt({
            storeId: App.store.getCurrentStore().id,
            customerId: customerId,
            items: state.cart.map(function(it) {
                return { name: it.name + (it.petId ? '（' + (App.store.getPetById(it.petId) || {}).name + '）' : ''), price: it.price, qty: it.qty };
            }),
            subtotal: calc.subtotal,
            discount: calc.memberDisc + calc.pointDisc,
            pointsUsed: Math.round(state.usePoints || 0),
            total: calc.total,
            payMethod: payMethod,
            pointsEarned: Math.round(calc.total / 10),
            operatorId: 'op1'
        });

        var today = new Date().toISOString().slice(0, 10);
        state.cart.forEach(function(it) {
            var svc = App.store.saveService({
                petId: it.petId || null,
                ownerId: customerId,
                groomerId: App.store.getGroomers({ storeId: App.store.getCurrentStore().id })[0]?.id,
                storeId: App.store.getCurrentStore().id,
                type: it.typeId,
                status: 'completed',
                startTime: today + ' ' + new Date().toTimeString().slice(0, 5) + ':00',
                duration: it.duration,
                price: it.subtotal,
                discount: 1,
                points: Math.round(it.subtotal / 10),
                notes: it.notes || ''
            });
            App.store.saveSchedule({
                groomerId: svc.groomerId,
                storeId: svc.storeId,
                date: today,
                startTime: svc.startTime,
                duration: svc.duration,
                serviceId: svc.id,
                status: 'booked'
            });
        });

        showReceipt(receipt);
        state.cart = [];
        state.usePoints = 0;
        state.useBalance = false;
        renderCart(); renderCalc(); renderPay();
    }

    function showReceipt(r) {
        var items = r.items.map(function(it) {
            return '<tr><td class="py-1 small">' + it.name + '</td>' +
                '<td class="py-1 small text-center">×' + it.qty + '</td>' +
                '<td class="py-1 small text-end">' + App.calculator.formatMoney(it.price) + '</td>' +
                '<td class="py-1 small text-end">' + App.calculator.formatMoney(it.price * it.qty) + '</td></tr>';
        }).join('');
        var body = '<div id="receiptPrintArea" class="px-3 py-4" style="background:#fff;">' +
            '<div class="text-center border-bottom pb-2 mb-3">' +
            '<h5 class="fw-bold mb-1">萌宠乐美 ' + (App.store.getCurrentStore().name) + '</h5>' +
            '<div class="small text-muted">电子小票 No. ' + r.id + '</div>' +
            '<div class="small text-muted">' + r.date + '</div>' +
            '</div>' +
            '<table class="w-100"><thead><tr class="small text-muted border-bottom"><th class="py-1 text-start">项目</th>' +
            '<th class="py-1 text-center">数量</th><th class="py-1 text-end">单价</th><th class="py-1 text-end">小计</th></tr></thead><tbody>' + items + '</tbody></table>' +
            '<div class="border-top mt-2 pt-2">' +
            '<div class="d-flex justify-content-between small"><span class="text-muted">小计</span><span>' + App.calculator.formatMoney(r.subtotal) + '</span></div>' +
            (r.discount > 0 ? '<div class="d-flex justify-content-between small text-success"><span>优惠</span><span>- ' + App.calculator.formatMoney(r.discount) + '</span></div>' : '') +
            (r.pointsUsed > 0 ? '<div class="d-flex justify-content-between small text-primary"><span>积分抵扣</span><span>- ' + App.calculator.formatMoney(r.pointsUsed * 0.01) + '</span></div>' : '') +
            '<div class="d-flex justify-content-between fw-bold border-top mt-2 pt-2"><span>应收</span><span class="text-danger">' + App.calculator.formatMoney(r.total) + '</span></div>' +
            '<div class="d-flex justify-content-between small mt-1"><span class="text-muted">支付方式</span><span>' + ({cash:'现金', qr:'扫码支付', stored:'储值卡', card:'银行卡'}[r.payMethod] || r.payMethod) + '</span></div>' +
            '<div class="d-flex justify-content-between small"><span class="text-muted">本次积分</span><span class="text-primary">+' + r.pointsEarned + '</span></div>' +
            '</div>' +
            '<div class="text-center mt-4 pt-3 border-top">' +
            '<div class="small">❤ 感谢光临 ❤</div>' +
            '<div class="small text-muted">欢迎再次光临 萌宠乐美</div>' +
            '<div class="text-muted mt-2" style="font-size:10px;">此为电子凭证，具有同等法律效力</div>' +
            '</div></div>';
        var footer = '<button class="btn btn-outline-primary me-auto" onclick="window.print()"><i class="bi bi-printer me-1"></i>打印</button>' +
            '<button class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>' +
            '<button class="btn btn-success" onclick="App.showToast(\'已发送至客户手机\', \'success\')"><i class="bi bi-send me-1"></i>发送短信</button>';
        App.showModal('收银小票 - ' + r.id, body, footer);
    }

    App.pages.checkout = {
        render: render,
        bind: bind
    };

})(typeof window !== 'undefined' ? window : this);
