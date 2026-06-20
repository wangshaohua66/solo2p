var POS = (function () {
  var cart = [];
  var cartDiscount = 0;
  var currentMember = null;
  var searchTimer = null;
  var searchIndex = null;

  function buildSearchIndex() {
    var products = Store.get('products', []);
    searchIndex = { byBarcode: {}, byPy: {}, byName: {} };
    products.forEach(function (p) {
      searchIndex.byBarcode[p.barcode] = p;
      var py = (p.pinyin || '').toLowerCase();
      for (var i = 1; i <= py.length; i++) {
        var key = py.slice(0, i);
        if (!searchIndex.byPy[key]) searchIndex.byPy[key] = [];
        if (searchIndex.byPy[key].indexOf(p.id) < 0) searchIndex.byPy[key].push(p.id);
      }
      var nm = p.name.toLowerCase();
      for (var j = 1; j <= nm.length; j++) {
        var nk = nm.slice(0, j);
        if (!searchIndex.byName[nk]) searchIndex.byName[nk] = [];
        if (searchIndex.byName[nk].indexOf(p.id) < 0) searchIndex.byName[nk].push(p.id);
      }
    });
  }

  function search(q) {
    if (!searchIndex) buildSearchIndex();
    q = (q || '').trim().toLowerCase();
    var products = Store.get('products', []);
    if (!q) return products;
    var found = {};
    var p = searchIndex.byBarcode[q];
    if (p) found[p.id] = p;
    if (searchIndex.byPy[q]) {
      searchIndex.byPy[q].forEach(function (id) {
        var f = products.find(function (x) { return x.id === id; });
        if (f) found[id] = f;
      });
    }
    Object.keys(searchIndex.byName).forEach(function (k) {
      if (k.indexOf(q) >= 0 || q.indexOf(k) >= 0) {
        searchIndex.byName[k].forEach(function (id) {
          var f = products.find(function (x) { return x.id === id; });
          if (f) found[id] = f;
        });
      }
    });
    var result = Object.values(found);
    if (result.length === 0) {
      result = products.filter(function (p) {
        return p.name.toLowerCase().indexOf(q) >= 0 ||
               (p.pinyin || '').toLowerCase().indexOf(q) >= 0 ||
               p.barcode.indexOf(q) >= 0;
      });
    }
    return result;
  }

  function render() {
    cart = []; cartDiscount = 0; currentMember = null;
    buildSearchIndex();
    var settings = Store.get('settings', {});
    $('#posSearch').val('');
    $('#posCategory').val('');
    $('#cartDiscount').val(0);
    $('#memberPhone').val('');
    $('#memberInfo').addClass('d-none');
    $('#cashPaid').val('');
    var storeId = Router.getQuery('store', settings.currentStoreId || 'st_01');
    renderProducts('', '');
    renderCart();
    updateTotals();
    $('#btnTogglePanel').off('click').on('click', function () {
      $('#posPanel').toggleClass('open');
    });
    $('#btnClosePanel').off('click').on('click', function () {
      $('#posPanel').removeClass('open');
    });
    $('#posSearch').off('input').on('input', function () {
      var v = $(this).val();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        renderProducts(v, $('#posCategory').val());
      }, 150);
    });
    $('#posCategory').off('change').on('change', function () {
      renderProducts($('#posSearch').val(), $(this).val());
    });
    $('#cartDiscount').off('input').on('input', function () {
      cartDiscount = Math.min(100, Math.max(0, Number($(this).val()) || 0));
      updateTotals();
    });
    $('#cashPaid').off('input').on('input', function () {
      updateTotals();
    });
    $('#btnClearCart').off('click').on('click', function () {
      if (cart.length === 0 || confirm('确定清空购物车？')) {
        cart = [];
        renderCart();
        updateTotals();
      }
    });
    $('#btnQueryMember').off('click').on('click', function () {
      var phone = $('#memberPhone').val().trim();
      if (!Models.validatePhone(phone)) {
        $('#memberPhone').addClass('is-invalid');
        setTimeout(function () { $('#memberPhone').removeClass('is-invalid'); }, 1000);
        return;
      }
      var m = Store.listFind('members', function (x) { return x.phone === phone; });
      if (m) {
        currentMember = m;
        $('#memberName').text(m.name);
        $('#memberPhoneDisplay').text(m.phone);
        $('#memberBalance').text(m.balance.toFixed(2));
        $('#memberInfo').removeClass('d-none');
      } else {
        alert('未找到该会员');
      }
    });
    $('.recharge-option').off('click').on('click', function () {
      var amt = Number($(this).attr('data-amount'));
      $('#rechargeAmount').val(amt);
      updateRechargeDisplay();
    });
    $('#rechargeAmount').off('input').on('input', updateRechargeDisplay);
    $('#btnConfirmRecharge').off('click').on('click', function () {
      if (!currentMember) { alert('请先选择会员'); return; }
      var amt = Number($('#rechargeAmount').val()) || 0;
      if (amt < 1) { alert('请输入充值金额'); return; }
      var bonus = Models.calcRechargeBonus(amt);
      var total = amt + bonus;
      if (!confirm('充值¥' + amt + '，赠送¥' + bonus + '，实际到账¥' + total)) return;
      var settings = Store.get('settings', {});
      var newBal = currentMember.balance + total;
      Store.listUpdate('members', currentMember.id, { balance: newBal });
      Store.listPush('membertx', {
        id: Store.uid('tx'), member_id: currentMember.id,
        type: 'recharge', amount: total, amount_received: amt,
        balance_after: newBal, store_id: settings.currentStoreId,
        created_at: new Date().toISOString()
      });
      currentMember.balance = newBal;
      $('#memberBalance').text(newBal.toFixed(2));
      $('#rechargeAmount').val('');
      $('#rechargeTotal').text('0');
      var modal = bootstrap.Modal.getInstance(document.getElementById('rechargeModal'));
      modal.hide();
      alert('充值成功！赠送¥' + bonus);
    });
    $('#btnCheckoutMember').off('click').on('click', function () { checkout('member'); });
    $('#btnCheckoutCash').off('click').on('click', function () { checkout('cash'); });
  }

  function renderProducts(q, cat) {
    var results = search(q);
    if (cat) results = results.filter(function (p) { return p.category === cat; });
    var settings = Store.get('settings', {});
    var storeId = settings.currentStoreId;
    var invMap = {};
    var inventories = Store.get('inventory', []);
    inventories.forEach(function (i) {
      if (i.store_id === storeId) invMap[i.sku_id] = (i.quantity || 0) - (i.frozen_quantity || 0);
    });
    var frag = document.createDocumentFragment();
    results.slice(0, 120).forEach(function (p) {
      var stock = invMap[p.id] || 0;
      var card = $('<div class="product-card">').attr('data-sku', p.id);
      if (stock <= 0) card.addClass('out-of-stock').css({position:'relative'});
      card.append($('<div class="pc-img">').text(p.image || '🍞'));
      card.append($('<div class="pc-name">').text(p.name));
      card.append($('<div class="pc-price">').text('¥' + p.price.toFixed(2)));
      if (stock > 0 && stock <= 5) {
        card.append($('<div class="small text-danger">').text('库存：' + stock));
      }
      card.on('click', function () {
        if (stock <= 0) { alert('该商品已售罄'); return; }
        addToCart(p.id);
      });
      frag.appendChild(card[0]);
    });
    $('#posProducts').empty().append(frag);
    if (results.length === 0) {
      $('#posProducts').append($('<div class="col-12 text-center text-muted py-5">').text('未找到匹配的商品'));
    }
  }

  function addToCart(skuId) {
    var existing = cart.find(function (x) { return x.sku_id === skuId; });
    if (existing) { existing.quantity++; }
    else {
      var p = Store.listFind('products', function (x) { return x.id === skuId; });
      if (!p) return;
      cart.push({ sku_id: skuId, product: p, quantity: 1, discount: 100 });
    }
    renderCart();
    updateTotals();
    $('#posPanel').addClass('open');
  }

  function renderCart() {
    var container = $('#posCart').empty();
    if (cart.length === 0) {
      container.append($('<div class="text-center text-muted py-4">')
        .html('<i class="bi bi-bag fs-1 d-block mb-2"></i>购物车为空，请选择商品'));
      return;
    }
    cart.forEach(function (item, idx) {
      var row = $('<div class="cart-item">');
      var itemName = $('<div class="ci-name">').text(item.product.name);
      var itemDisc = $('<input type="number" class="form-control form-control-sm mt-1" min="0" max="100" value="' + item.discount + '">')
        .css({ width: '70px', display: 'inline-block' })
        .on('input', function () {
          item.discount = Math.min(100, Math.max(0, Number($(this).val()) || 0));
          renderCart();
          updateTotals();
        });
      itemName.append('<div class="small text-muted">折扣: <span class="item-disc-wrapper"></span>%</div>');
      itemName.find('.item-disc-wrapper').append(itemDisc);
      var qtyWrap = $('<div class="ci-qty">');
      var minusBtn = $('<button>').html('-').on('click', function () {
        item.quantity--;
        if (item.quantity <= 0) cart.splice(idx, 1);
        renderCart();
        updateTotals();
      });
      var plusBtn = $('<button>').html('+').on('click', function () {
        item.quantity++;
        renderCart();
        updateTotals();
      });
      qtyWrap.append(minusBtn).append($('<span>').text(item.quantity)).append(plusBtn);
      var price = $('<div class="ci-price">').text('¥' + (item.product.price * item.quantity * (item.discount / 100)).toFixed(2));
      var rm = $('<span class="ci-remove">').html('<i class="bi bi-x-circle"></i>').on('click', function () {
        cart.splice(idx, 1);
        renderCart();
        updateTotals();
      });
      row.append(itemName, qtyWrap, price, rm);
      container.append(row);
    });
  }

  function updateTotals() {
    var sub = 0;
    cart.forEach(function (item) {
      sub += item.product.price * item.quantity * (item.discount / 100);
    });
    var discAmt = +(sub * (cartDiscount / 100)).toFixed(2);
    var total = +(sub - discAmt).toFixed(2);
    $('#subTotal').text(sub.toFixed(2));
    $('#discountAmount').text(discAmt.toFixed(2));
    $('#totalAmount').text(total.toFixed(2));
    var paid = Number($('#cashPaid').val()) || 0;
    $('#changeAmount').text(Math.max(0, paid - total).toFixed(2));
    return total;
  }

  function updateRechargeDisplay() {
    var amt = Number($('#rechargeAmount').val()) || 0;
    var bonus = Models.calcRechargeBonus(amt);
    $('#rechargeTotal').text((amt + bonus).toFixed(2));
  }

  function checkout(payType) {
    var total = updateTotals();
    if (cart.length === 0) { alert('购物车为空'); return; }
    var settings = Store.get('settings', {});
    var storeId = settings.currentStoreId;
    if (payType === 'member') {
      if (!currentMember) { alert('请先查询会员'); return; }
      if (currentMember.balance < total) {
        alert('会员余额不足：当前 ¥' + currentMember.balance.toFixed(2) + '，需 ¥' + total.toFixed(2));
        return;
      }
    } else {
      var paid = Number($('#cashPaid').val()) || 0;
      if (paid < total) {
        alert('现金不足：应收 ¥' + total.toFixed(2) + '，实收 ¥' + paid.toFixed(2));
        return;
      }
    }
    var saleId = Store.uid('sale');
    var saleItems = [];
    var subTotal = 0;
    var inventories = Store.get('inventory', []);
    var invOk = true;
    cart.forEach(function (item, idx) {
      var inv = inventories.find(function (i) { return i.store_id === storeId && i.sku_id === item.sku_id; });
      if (!inv || inv.quantity < item.quantity) {
        alert('库存不足：' + item.product.name);
        invOk = false;
        return;
      }
      var lineDisc = item.discount / 100;
      var sub = +(item.product.price * item.quantity * lineDisc).toFixed(2);
      subTotal += sub;
      saleItems.push({
        id: 'si_' + saleId + '_' + idx, sale_id: saleId,
        sku_id: item.sku_id, quantity: item.quantity,
        unit_price: item.product.price,
        discount: Math.round(item.discount),
        subtotal: sub
      });
      inv.quantity -= item.quantity;
    });
    if (!invOk) return;
    var sale = {
      id: saleId, store_id: storeId,
      member_id: currentMember ? currentMember.id : null,
      total_amount: +subTotal.toFixed(2),
      discount_amount: +(subTotal - total).toFixed(2),
      cart_discount: cartDiscount,
      actual_amount: total, pay_type: payType,
      created_at: new Date().toISOString()
    };
    var allSales = Store.get('sales', []);
    allSales.push(sale);
    Store.set('sales', allSales);
    var allItems = Store.get('sale_items', []);
    allItems = allItems.concat(saleItems);
    Store.set('sale_items', allItems);
    Store.set('inventory', inventories);
    if (payType === 'member' && currentMember) {
      var newBal = currentMember.balance - total;
      Store.listUpdate('members', currentMember.id, { balance: newBal });
      Store.listPush('membertx', {
        id: Store.uid('tx'), member_id: currentMember.id,
        type: 'consume', amount: -total,
        balance_after: newBal, store_id: storeId,
        created_at: sale.created_at
      });
      currentMember.balance = newBal;
      $('#memberBalance').text(newBal.toFixed(2));
    }
    showReceipt(sale, saleItems);
    cart = [];
    cartDiscount = 0;
    $('#cartDiscount').val(0);
    $('#cashPaid').val('');
    renderCart();
    updateTotals();
    renderProducts($('#posSearch').val(), $('#posCategory').val());
  }

  function showReceipt(sale, items) {
    var store = Store.listFind('stores', function (s) { return s.id === sale.store_id; }) || {};
    var member = sale.member_id ? Store.listFind('members', function (m) { return m.id === sale.member_id; }) : null;
    var html = '';
    html += '<div class="r-title">' + (store.name || '麦香坊') + '</div>';
    html += '<div class="r-meta">';
    html += '单号：' + sale.id.slice(-12) + '<br>';
    html += '时间：' + new Date(sale.created_at).toLocaleString('zh-CN') + '<br>';
    html += '收银员：' + (Store.get('settings', {}).operator || '');
    html += '</div>';
    html += '<div class="r-divider"></div>';
    items.forEach(function (it) {
      var p = Store.listFind('products', function (x) { return x.id === it.sku_id; }) || {};
      html += '<div class="r-line"><span>' + (p.name || '') + ' ×' + it.quantity + (it.discount < 100 ? ' (' + it.discount + '%)' : '') + '</span><span>¥' + it.subtotal.toFixed(2) + '</span></div>';
    });
    html += '<div class="r-divider"></div>';
    html += '<div class="r-line"><span>商品合计</span><span>¥' + sale.total_amount.toFixed(2) + '</span></div>';
    if (sale.discount_amount > 0) {
      html += '<div class="r-line"><span>折扣</span><span>-¥' + sale.discount_amount.toFixed(2) + '</span></div>';
    }
    html += '<div class="r-line r-total"><span>实收</span><span>¥' + sale.actual_amount.toFixed(2) + '</span></div>';
    html += '<div class="r-line"><span>支付方式</span><span>' + (sale.pay_type === 'member' ? '会员储值' : '现金') + '</span></div>';
    if (member) html += '<div class="r-line"><span>会员</span><span>' + member.name + ' ' + member.phone.slice(-4) + '</span></div>';
    html += '<div class="r-divider"></div>';
    html += '<div class="text-center text-muted" style="font-size:0.75rem">欢迎再次光临 🍞</div>';
    $('#receiptContent').html(html);
    var modal = new bootstrap.Modal(document.getElementById('receiptModal'));
    modal.show();
  }

  return { render: render, addToCart: addToCart, updateRechargeDisplay: updateRechargeDisplay };
})();
