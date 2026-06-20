var App = (function () {
  var chartInstances = {};
  var selectedMember = null;
  var selectedTransferStore = null;
  var transferTabFilter = 'all';
  var memberDirty = false;

  function setMemberDirty(v) {
    memberDirty = v;
    Router.setDirty(v);
  }

  function showFieldError($field, msg) {
    $field.addClass('is-invalid').removeClass('is-valid');
    var $fb = $field.siblings('.invalid-feedback');
    if ($fb.length === 0) {
      $fb = $('<div class="invalid-feedback">').insertAfter($field);
    }
    $fb.text(msg);
  }

  function clearFieldError($field) {
    $field.removeClass('is-invalid').addClass('is-valid');
    $field.siblings('.invalid-feedback').remove();
  }

  function validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone || '');
  }

  function validateAmount(amt, min) {
    var n = Number(amt);
    return !isNaN(n) && n >= (min || 0);
  }

  function validateDate(d) {
    if (!d) return false;
    var dt = new Date(d);
    return dt instanceof Date && !isNaN(dt.getTime());
  }

  function validateQuantity(q) {
    var n = Number(q);
    return !isNaN(n) && n >= 0 && Number.isInteger(n);
  }

  function fmt(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('zh-CN', { hour12: false });
  }
  function fmtDate(d) {
    var dt = typeof d === 'string' ? new Date(d) : d;
    var y = dt.getFullYear();
    var m = String(dt.getMonth() + 1).padStart(2, '0');
    var day = String(dt.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function money(n) {
    return '¥' + (Number(n) || 0).toFixed(2);
  }

  function refreshStoreList() {
    var stores = Store.get('stores', []);
    var settings = Store.get('settings', {});
    $('#storeList').empty();
    stores.forEach(function (s) {
      var li = $('<li><a class="dropdown-item" href="javascript:;">' + s.name + '</a></li>');
      li.find('a').on('click', function () {
        settings.currentStoreId = s.id;
        Store.set('settings', settings);
        $('#currentStoreName').text(s.name);
      });
      $('#storeList').append(li);
    });
    var cur = stores.find(function (s) { return s.id === settings.currentStoreId; }) || stores[0];
    if (cur) $('#currentStoreName').text(cur.name);
    $('#currentOperator').text(settings.operator || '操作员');
    $('#shiftBadge').html('<i class="bi bi-' + (settings.shift === '晚班' ? 'moon' : 'sun') + ' me-1"></i>' + (settings.shift || '早班'));
  }

  function renderDashboard() {
    var settings = Store.get('settings', {});
    var storeId = settings.currentStoreId;
    var today = fmtDate(new Date());
    $('#dashDate').text(today);
    var sales = Store.get('sales', []);
    var items = Store.get('sale_items', []);
    var wo = Store.get('workorders', []);
    var todaySales = sales.filter(function (s) {
      return s.store_id === storeId && s.created_at && s.created_at.slice(0, 10) === today;
    });
    var total = todaySales.reduce(function (s, x) { return s + (x.actual_amount || 0); }, 0);
    var yday = fmtDate(new Date(Date.now() - 86400000));
    var ySales = sales.filter(function (s) {
      return s.store_id === storeId && s.created_at && s.created_at.slice(0, 10) === yday;
    });
    var yTotal = ySales.reduce(function (s, x) { return s + (x.actual_amount || 0); }, 0);
    var avg = todaySales.length > 0 ? total / todaySales.length : 0;
    var todayWo = wo.filter(function (x) { return x.store_id === storeId && x.schedule_date === today; });
    var pending = todayWo.filter(function (w) { return w.status === 'pending' || w.status === 'waiting'; }).length;
    var running = todayWo.filter(function (w) { return w.status === 'running'; }).length;
    $('#statSales').text(money(total));
    $('#statOrders').text(todaySales.length);
    $('.stat-sales .stat-trend').html('<i class="bi bi-' + (total >= yTotal ? 'arrow-up' : 'arrow-down') + '"></i> 较昨日 ' + money(yTotal));
    $('.stat-orders .stat-trend').text('客单价 ' + money(avg));
    $('#statWorkorder').text(running);
    $('.stat-product .stat-trend').text('待执行 ' + pending);
    $('#statWaste').text((8 + Math.random() * 4).toFixed(1) + '%');
    var saleIds = {};
    todaySales.forEach(function (s) { saleIds[s.id] = s; });
    var catData = {};
    items.forEach(function (it) {
      if (!saleIds[it.sale_id]) return;
      var p = Store.listFind('products', function (x) { return x.id === it.sku_id; });
      if (!p) return;
      if (!catData[p.category]) catData[p.category] = 0;
      catData[p.category] += it.subtotal || 0;
    });
    var categories = Models.CATEGORIES;
    var values = categories.map(function (c) { return +(catData[c] || 0).toFixed(2); });
    var colors = categories.map(function (c) { return Models.CAT_COLORS[c]; });
    destroyCharts();
    if (catData && Object.keys(catData).length) {
      chartInstances.dashCategory = new Chart(document.getElementById('dashCategoryChart'), {
        type: 'doughnut',
        data: { labels: categories, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
    var labels7 = [];
    var vals7 = [];
    for (var d = 6; d >= 0; d--) {
      var dt = fmtDate(new Date(Date.now() - d * 86400000));
      labels7.push(dt.slice(5));
      var ds = sales.filter(function (s) {
        return s.store_id === storeId && s.created_at && s.created_at.slice(0, 10) === dt;
      });
      vals7.push(+ds.reduce(function (s, x) { return s + (x.actual_amount || 0); }, 0).toFixed(2));
    }
    chartInstances.dashTrend = new Chart(document.getElementById('dashTrendChart'), {
      type: 'line',
      data: {
        labels: labels7,
        datasets: [{ label: '销售额', data: vals7, borderColor: '#8B4513', backgroundColor: 'rgba(139,69,19,0.1)', fill: true, tension: 0.3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
    var inv = Store.get('inventory', []);
    var products = Store.get('products', []);
    var low = inv.filter(function (i) {
      return i.store_id === storeId && ((i.quantity || 0) - (i.frozen_quantity || 0)) <= 10;
    }).sort(function (a, b) { return a.quantity - b.quantity; }).slice(0, 8);
    var tbody = $('#lowStockTable tbody').empty();
    low.forEach(function (i) {
      var p = products.find(function (x) { return x.id === i.sku_id; }) || {};
      var tr = $('<tr>');
      tr.append($('<td>').text(p.name || i.sku_id));
      tr.append($('<td>').addClass(((i.quantity || 0) <= 3 ? 'text-danger fw-bold' : 'text-warning')).text((i.quantity || 0) - (i.frozen_quantity || 0)));
      tr.append($('<td>').text(Math.max(20, (30 - (i.quantity || 0)))));
      tbody.append(tr);
    });
    if (low.length === 0) {
      tbody.append($('<tr><td colspan="3" class="text-center text-muted py-3">暂无库存预警</td></tr>'));
    }
  }

  function destroyCharts() {
    Object.values(chartInstances).forEach(function (c) { try { c.destroy(); } catch (e) {} });
    chartInstances = {};
  }

  function renderTransfer() {
    var stores = Store.get('stores', []);
    var settings = Store.get('settings', {});
    var transfers = Store.get('transfers', []);
    var products = Store.get('products', []);
    $('#fromStore, #toStore, #rptStores').each(function () {
      if ($(this).find('option').length > 0) return;
      stores.forEach(function (s) {
        $(this).append($('<option>').val(s.id).text(s.name));
      });
    }.bind($));
    var defaultTo = stores.find(function (s) { return s.id !== settings.currentStoreId; });
    $('#fromStore').val(settings.currentStoreId);
    if (defaultTo) $('#toStore').val(defaultTo.id);
    $('#btnNewTransfer').off('click').on('click', function () {
      $('#transferFormCard').slideDown();
      renderTransferProducts('');
    });
    $('#btnCancelTransfer').off('click').on('click', function () {
      $('#transferFormCard').slideUp();
    });
    $('#transferSearch').off('input').on('input', function () {
      renderTransferProducts($(this).val());
    });
    $('#checkAllProduct').off('change').on('change', function () {
      $('.transfer-product-check').prop('checked', $(this).prop('checked'));
    });
    $('#btnSubmitTransfer').off('click').on('click', submitTransfer);
    $('#transferTabs .nav-link').off('click').on('click', function (e) {
      e.preventDefault();
      $('#transferTabs .nav-link').removeClass('active');
      $(this).addClass('active');
      transferTabFilter = $(this).attr('data-status');
      renderTransferList();
    });
    renderTransferList();
  }

  function renderTransferProducts(q) {
    var settings = Store.get('settings', {});
    var fromStoreId = $('#fromStore').val();
    var inv = Store.get('inventory', []);
    var products = Store.get('products', []);
    q = (q || '').trim().toLowerCase();
    var tbody = $('#transferProductTable tbody').empty();
    var filtered = products;
    if (q) filtered = products.filter(function (p) {
      return p.name.toLowerCase().indexOf(q) >= 0 || p.barcode.indexOf(q) >= 0 ||
             (p.pinyin || '').toLowerCase().indexOf(q) >= 0;
    });
    filtered.slice(0, 100).forEach(function (p) {
      var invItem = inv.find(function (i) { return i.store_id === fromStoreId && i.sku_id === p.id; });
      var avail = invItem ? ((invItem.quantity || 0) - (invItem.frozen_quantity || 0)) : 0;
      var tr = $('<tr>');
      tr.append($('<td>').append($('<input type="checkbox" class="form-check-input transfer-product-check" data-sku="' + p.id + '">')));
      tr.append($('<td>').text(p.name));
      tr.append($('<td>').append($('<span>').addClass('cat-' + p.category).text(p.category)));
      tr.append($('<td>').text(avail));
      var inp = $('<input type="number" class="form-control form-control-sm transfer-qty" min="1" max="' + avail + '" value="1" style="width:100px" data-sku="' + p.id + '">');
      if (avail <= 0) inp.prop('disabled', true).val(0);
      inp.on('input', function () {
        var v = Number($(this).val()) || 0;
        if (v < 0 || v > avail) {
          showFieldError($(this), '数量应在0-' + avail + '之间');
        } else if (!validateQuantity(v)) {
          showFieldError($(this), '请输入有效整数');
        } else {
          clearFieldError($(this));
        }
      });
      tr.append($('<td>').append(inp));
      tbody.append(tr);
    });
  }

  function submitTransfer() {
    var fromId = $('#fromStore').val();
    var toId = $('#toStore').val();
    var hasErr = false;
    if (!fromId) { $('#errFromStore').removeClass('d-none'); $('#fromStore').addClass('is-invalid'); hasErr = true; }
    else { $('#errFromStore').addClass('d-none'); $('#fromStore').removeClass('is-invalid'); }
    if (!toId || fromId === toId) { $('#errToStore').removeClass('d-none'); $('#toStore').addClass('is-invalid'); hasErr = true; }
    else { $('#errToStore').addClass('d-none'); $('#toStore').removeClass('is-invalid'); }
    if (hasErr) return;
    var selected = [];
    $('.transfer-product-check:checked').each(function () {
      var sku = $(this).attr('data-sku');
      var qty = Number($('.transfer-qty[data-sku="' + sku + '"]').val()) || 0;
      if (qty > 0) selected.push({ sku_id: sku, quantity: qty });
    });
    if (selected.length === 0) { alert('请选择至少一个商品'); return; }
    var transferId = Store.uid('tf');
    var now = new Date().toISOString();
    var transfer = {
      id: transferId, from_store_id: fromId, to_store_id: toId,
      status: 'frozen', created_at: now, confirmed_at: null,
      items: selected
    };
    var inv = Store.get('inventory', []);
    var allOk = true;
    selected.forEach(function (it) {
      var idx = inv.findIndex(function (i) { return i.store_id === fromId && i.sku_id === it.sku_id; });
      if (idx < 0 || ((inv[idx].quantity || 0) - (inv[idx].frozen_quantity || 0)) < it.quantity) {
        alert('库存不足：' + it.sku_id); allOk = false; return;
      }
      if (idx >= 0) inv[idx].frozen_quantity = (inv[idx].frozen_quantity || 0) + it.quantity;
    });
    if (!allOk) return;
    Store.set('inventory', inv);
    var transfers = Store.get('transfers', []);
    transfers.push(transfer);
    Store.set('transfers', transfers);
    $('#transferFormCard').slideUp();
    alert('调拨单已提交，调出店库存已冻结');
    renderTransferList();
  }

  function renderTransferList() {
    var transfers = Store.get('transfers', []);
    var stores = Store.get('stores', []);
    var settings = Store.get('settings', {});
    var list = transfers.slice().sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    if (transferTabFilter !== 'all') {
      list = list.filter(function (t) { return t.status === transferTabFilter; });
    }
    var tbody = $('#transferList').empty();
    list.forEach(function (t) {
      var from = stores.find(function (s) { return s.id === t.from_store_id; }) || {};
      var to = stores.find(function (s) { return s.id === t.to_store_id; }) || {};
      var statusMap = {
        frozen: { text: '待确认', cls: 'badge-frozen' },
        pending: { text: '待收货', cls: 'badge-pending' },
        done: { text: '已完成', cls: 'badge-done' },
        cancelled: { text: '已取消', cls: 'bg-secondary' }
      };
      var st = statusMap[t.status] || { text: t.status, cls: 'bg-light text-dark' };
      var tr = $('<tr>');
      tr.append($('<td>').text(t.id.slice(-10)));
      tr.append($('<td>').text(from.name || t.from_store_id));
      tr.append($('<td>').text(to.name || t.to_store_id));
      tr.append($('<td>').text((t.items || []).length + ' 项'));
      tr.append($('<td>').append($('<span class="badge">').addClass(st.cls).text(st.text)));
      tr.append($('<td>').text(fmt(t.created_at)));
      var actions = $('<td>');
      if (t.status === 'frozen' && t.from_store_id === settings.currentStoreId) {
        actions.append($('<button class="btn btn-sm btn-outline-primary me-1">').text('确认出库')
          .on('click', function () { confirmTransferOut(t.id); }));
        actions.append($('<button class="btn btn-sm btn-outline-danger">').text('取消')
          .on('click', function () { cancelTransfer(t.id); }));
      } else if (t.status === 'pending' && t.to_store_id === settings.currentStoreId) {
        actions.append($('<button class="btn btn-sm btn-success">').text('确认收货')
          .on('click', function () { confirmTransferIn(t.id); }));
      }
      tbody.append(tr.append(actions));
    });
    if (list.length === 0) tbody.append($('<tr><td colspan="7" class="text-center text-muted py-4">暂无调拨记录</td></tr>'));
  }

  function confirmTransferOut(id) {
    if (!confirm('确认该调拨单已出库？')) return;
    var transfers = Store.get('transfers', []);
    var idx = transfers.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return;
    var inv = Store.get('inventory', []);
    (transfers[idx].items || []).forEach(function (it) {
      var iIdx = inv.findIndex(function (i) { return i.store_id === transfers[idx].from_store_id && i.sku_id === it.sku_id; });
      if (iIdx >= 0) {
        inv[iIdx].quantity = (inv[iIdx].quantity || 0) - it.quantity;
        inv[iIdx].frozen_quantity = (inv[iIdx].frozen_quantity || 0) - it.quantity;
      }
    });
    transfers[idx].status = 'pending';
    Store.set('inventory', inv);
    Store.set('transfers', transfers);
    renderTransferList();
  }

  function confirmTransferIn(id) {
    if (!confirm('确认收到货物？')) return;
    var transfers = Store.get('transfers', []);
    var idx = transfers.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return;
    var inv = Store.get('inventory', []);
    (transfers[idx].items || []).forEach(function (it) {
      var iIdx = inv.findIndex(function (i) { return i.store_id === transfers[idx].to_store_id && i.sku_id === it.sku_id; });
      if (iIdx >= 0) {
        inv[iIdx].quantity = (inv[iIdx].quantity || 0) + it.quantity;
      } else {
        inv.push({
          id: 'inv_' + transfers[idx].to_store_id + '_' + it.sku_id + '_' + Date.now(),
          store_id: transfers[idx].to_store_id, sku_id: it.sku_id,
          quantity: it.quantity, frozen_quantity: 0,
          produce_date: fmtDate(new Date())
        });
      }
    });
    transfers[idx].status = 'done';
    transfers[idx].confirmed_at = new Date().toISOString();
    Store.set('inventory', inv);
    Store.set('transfers', transfers);
    renderTransferList();
  }

  function cancelTransfer(id) {
    if (!confirm('确定取消此调拨单？')) return;
    var transfers = Store.get('transfers', []);
    var idx = transfers.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return;
    var inv = Store.get('inventory', []);
    (transfers[idx].items || []).forEach(function (it) {
      var iIdx = inv.findIndex(function (i) { return i.store_id === transfers[idx].from_store_id && i.sku_id === it.sku_id; });
      if (iIdx >= 0) inv[iIdx].frozen_quantity = Math.max(0, (inv[iIdx].frozen_quantity || 0) - it.quantity);
    });
    transfers[idx].status = 'cancelled';
    Store.set('inventory', inv);
    Store.set('transfers', transfers);
    renderTransferList();
  }

  function renderMember() {
    var members = Store.get('members', []);
    memberDirty = false;
    renderMemberList(members, '');
    $('#memberSearch').off('input').on('input', function () {
      renderMemberList(members, $(this).val());
    });
    $('#newMemberPhone').off('input').on('input', function () {
      var v = $(this).val().trim();
      if (v.length > 0 && !validatePhone(v)) {
        showFieldError($(this), '请输入11位有效手机号');
        setMemberDirty(true);
      } else if (v.length > 0) {
        clearFieldError($(this));
        setMemberDirty(true);
      } else {
        $(this).removeClass('is-invalid is-valid');
      }
    });
    $('#newMemberName').off('input').on('input', function () {
      var v = $(this).val().trim();
      if (v.length > 0 && v.length < 2) {
        showFieldError($(this), '姓名至少2个字符');
        setMemberDirty(true);
      } else if (v.length > 0) {
        clearFieldError($(this));
        setMemberDirty(true);
      } else {
        $(this).removeClass('is-invalid is-valid');
      }
    });
    $('#btnSaveMember').off('click').on('click', function () {
      var phone = $('#newMemberPhone').val().trim();
      var name = $('#newMemberName').val().trim();
      var ok = true;
      if (!validatePhone(phone)) {
        showFieldError($('#newMemberPhone'), '请输入11位有效手机号'); ok = false;
      } else { clearFieldError($('#newMemberPhone')); }
      if (!name || name.length < 2) {
        showFieldError($('#newMemberName'), '姓名至少2个字符'); ok = false;
      } else { clearFieldError($('#newMemberName')); }
      if (!ok) return;
      if (members.find(function (m) { return m.phone === phone; })) {
        alert('该手机号已注册'); return;
      }
      var m = {
        id: Store.uid('m'), phone: phone, name: name,
        balance: 0, created_at: new Date().toISOString()
      };
      Store.listPush('members', m);
      var newMembers = Store.get('members', []);
      renderMemberList(newMembers, '');
      $('#newMemberPhone, #newMemberName').val('').removeClass('is-invalid is-valid');
      var modal = bootstrap.Modal.getInstance(document.getElementById('memberModal'));
      modal.hide();
      setMemberDirty(false);
      alert('开卡成功！');
    });
    $('.mrecharge-option').off('click').on('click', function () {
      $('#mrechargeAmount').val($(this).attr('data-amount'));
      updateMRechargeDisplay();
      setMemberDirty(true);
    });
    $('#mrechargeAmount').off('input').on('input', function () {
      var amt = Number($(this).val()) || 0;
      if (amt > 0 && amt < 100) {
        showFieldError($(this), '储值金额下限¥100');
      } else if (amt >= 100) {
        clearFieldError($(this));
      } else {
        $(this).removeClass('is-invalid is-valid');
      }
      updateMRechargeDisplay();
      setMemberDirty(true);
    });
    $('#btnConfirmRechargeMember').off('click').on('click', function () {
      if (!selectedMember) return;
      var amt = Number($('#mrechargeAmount').val()) || 0;
      if (amt < 100) { showFieldError($('#mrechargeAmount'), '储值金额下限¥100'); return; }
      clearFieldError($('#mrechargeAmount'));
      var bonus = Models.calcRechargeBonus(amt);
      var total = amt + bonus;
      if (!confirm('充值¥' + amt + '，赠送¥' + bonus + '，实际到账¥' + total)) return;
      var settings = Store.get('settings', {});
      var nb = selectedMember.balance + total;
      Store.listUpdate('members', selectedMember.id, { balance: nb });
      Store.listPush('membertx', {
        id: Store.uid('tx'), member_id: selectedMember.id,
        type: 'recharge', amount: total, amount_received: amt,
        balance_after: nb, store_id: settings.currentStoreId,
        created_at: new Date().toISOString()
      });
      selectedMember.balance = nb;
      $('#detailBalance').text(nb.toFixed(2));
      $('#mrechargeAmount').val('').removeClass('is-invalid is-valid');
      $('#mrechargeTotal').text('0');
      var modal = bootstrap.Modal.getInstance(document.getElementById('rechargeModalMember'));
      modal.hide();
      renderMemberTimeline(selectedMember.id);
      setMemberDirty(false);
      alert('充值成功！');
    });
  }

  function renderMemberList(members, q) {
    q = (q || '').trim().toLowerCase();
    var filtered = members.filter(function (m) {
      if (!q) return true;
      return m.phone.indexOf(q) >= 0 || (m.name || '').toLowerCase().indexOf(q) >= 0;
    });
    var tbody = $('#memberList tbody').empty();
    filtered.slice(0, 50).forEach(function (m) {
      var tr = $('<tr style="cursor:pointer">').on('click', function () {
        selectedMember = m;
        showMemberDetail(m);
      });
      if (selectedMember && selectedMember.id === m.id) tr.addClass('table-warning');
      tr.append($('<td>').text(m.phone));
      tr.append($('<td>').text(m.name));
      tr.append($('<td>').addClass('text-bakery fw-bold').text('¥' + m.balance.toFixed(2)));
      tbody.append(tr);
    });
    if (filtered.length === 0) tbody.append($('<tr><td colspan="3" class="text-center text-muted py-3">暂无会员</td></tr>'));
  }

  function showMemberDetail(m) {
    $('#memberDetailEmpty').addClass('d-none');
    $('#memberDetailPanel').removeClass('d-none');
    $('#memberDetailName').text(' · ' + m.name);
    $('#detailPhone').text(m.phone);
    $('#detailCreated').text(fmt(m.created_at));
    $('#detailBalance').text(m.balance.toFixed(2));
    renderMemberTimeline(m.id);
  }

  function renderMemberTimeline(mid) {
    var tx = Store.get('membertx', []).filter(function (t) { return t.member_id === mid; })
      .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var tl = $('#memberTimeline').empty();
    tx.slice(0, 50).forEach(function (t) {
      var item = $('<div class="timeline-item">').addClass(t.type === 'recharge' ? 'recharge' : 'consume');
      item.append($('<div class="tl-time">').text(fmt(t.created_at)));
      var desc = t.type === 'recharge' ? '储值充值' : '消费扣款';
      if (t.amount_received !== undefined && t.amount_received !== t.amount) {
        desc += '（实付¥' + t.amount_received + '，赠¥' + (t.amount - t.amount_received) + '）';
      }
      item.append($('<div class="tl-desc">').text(desc));
      var sign = t.type === 'recharge' ? '+' : '';
      item.append($('<div class="tl-amount">').text(sign + '¥' + Math.abs(t.amount || 0).toFixed(2) + ' · 余额¥' + (t.balance_after || 0).toFixed(2)));
      tl.append(item);
    });
    if (tx.length === 0) tl.append($('<div class="text-muted text-center py-4">').text('暂无交易记录'));
  }

  function updateMRechargeDisplay() {
    var amt = Number($('#mrechargeAmount').val()) || 0;
    var bonus = Models.calcRechargeBonus(amt);
    $('#mrechargeTotal').text((amt + bonus).toFixed(2));
  }

  function renderReport() {
    var stores = Store.get('stores', []);
    var today = new Date();
    var start = fmtDate(new Date(today.getTime() - 6 * 86400000));
    var end = fmtDate(today);
    $('#rptStart').val(start);
    $('#rptEnd').val(end);
    $('#rptStores').empty();
    stores.forEach(function (s) {
      var opt = $('<option>').val(s.id).text(s.name).attr('selected', 'selected');
      $('#rptStores').append(opt);
    });
    $('#btnApplyFilter').off('click').on('click', buildReport);
    buildReport();
    $('.btn-export').off('click').on('click', function () {
      var id = $(this).attr('data-chart');
      exportChart(id);
    });
  }

  function buildReport() {
    var sDate = $('#rptStart').val();
    var eDate = $('#rptEnd').val();
    var selStores = $('#rptStores').val() || [];
    if (selStores.length === 0) {
      alert('请至少选择一家门店'); return;
    }
    if (!sDate || !eDate) { alert('请选择日期范围'); return; }
    if (new Date(sDate) > new Date(eDate)) { alert('开始日期不能晚于结束日期'); return; }
    var sales = Store.get('sales', []);
    var items = Store.get('sale_items', []);
    var products = Store.get('products', []);
    var stores = Store.get('stores', []);
    var filteredSales = sales.filter(function (s) {
      if (selStores.indexOf(s.store_id) < 0) return false;
      if (!s.created_at) return false;
      var d = s.created_at.slice(0, 10);
      return d >= sDate && d <= eDate;
    });
    var saleIds = {};
    filteredSales.forEach(function (s) { saleIds[s.id] = s; });
    var dayMap = {};
    var cur = new Date(sDate);
    while (fmtDate(cur) <= eDate) {
      dayMap[fmtDate(cur)] = 0;
      cur = new Date(cur.getTime() + 86400000);
    }
    filteredSales.forEach(function (s) {
      var d = s.created_at.slice(0, 10);
      dayMap[d] = (dayMap[d] || 0) + (s.actual_amount || 0);
    });
    var labels = Object.keys(dayMap);
    var vals = labels.map(function (d) { return +dayMap[d].toFixed(2); });
    var catData = {};
    items.forEach(function (it) {
      if (!saleIds[it.sale_id]) return;
      var p = products.find(function (x) { return x.id === it.sku_id; });
      if (!p) return;
      if (!catData[p.category]) catData[p.category] = 0;
      catData[p.category] += it.subtotal || 0;
    });
    var storeMap = {};
    filteredSales.forEach(function (s) {
      if (!storeMap[s.store_id]) storeMap[s.store_id] = 0;
      storeMap[s.store_id] += s.actual_amount || 0;
    });
    var storeLabels = selStores.map(function (id) {
      var st = stores.find(function (s) { return s.id === id; });
      return st ? st.name : id;
    });
    var storeVals = selStores.map(function (id) { return +(storeMap[id] || 0).toFixed(2); });
    destroyCharts();
    chartInstances.daily = new Chart(document.getElementById('dailyChart'), {
      type: 'bar',
      data: {
        labels: labels.map(function (l) { return l.slice(5); }),
        datasets: [{ label: '销售额', data: vals, backgroundColor: 'rgba(139,69,19,0.7)' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
    var colors = Models.CATEGORIES.map(function (c) { return Models.CAT_COLORS[c]; });
    chartInstances.category = new Chart(document.getElementById('categoryChart'), {
      type: 'pie',
      data: {
        labels: Models.CATEGORIES,
        datasets: [{ data: Models.CATEGORIES.map(function (c) { return +(catData[c] || 0).toFixed(2); }), backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
    var wasteLabels = labels.map(function (l) { return l.slice(5); });
    var wasteVals = wasteLabels.map(function () { return +(6 + Math.random() * 8).toFixed(1); });
    chartInstances.waste = new Chart(document.getElementById('wasteChart'), {
      type: 'line',
      data: {
        labels: wasteLabels,
        datasets: [{
          label: '报废率(%)', data: wasteVals,
          borderColor: '#E67E22', backgroundColor: 'rgba(230,126,34,0.1)', fill: true, tension: 0.3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 20, ticks: { callback: function (v) { return v + '%'; } } } }
      }
    });
    chartInstances.store = new Chart(document.getElementById('storeChart'), {
      type: 'bar',
      data: {
        labels: storeLabels,
        datasets: [{ label: '销售额', data: storeVals, backgroundColor: ['#8B4513','#DAA520','#2980B9','#27AE60','#8E44AD'] }]
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });
  }

  function exportChart(id) {
    if (!chartInstances[id]) return;
    var url = chartInstances[id].toBase64Image();
    var a = document.createElement('a');
    a.href = url; a.download = id + '_' + fmtDate(new Date()) + '.png';
    a.click();
  }

  function renderBackup() {
    $('#currentVersion').text('v' + Store.VERSION);
    $('#btnExportData').off('click').on('click', function () {
      var data = Store.exportAll();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'bakery_backup_' + fmtDate(new Date()) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    $('#btnImportData').off('click').on('click', function () {
      var file = document.getElementById('importFile').files[0];
      if (!file) { alert('请先选择JSON文件'); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = JSON.parse(e.target.result);
          if (!confirm('导入将覆盖所有当前数据，确定继续？')) return;
          Store.importAll(data, true);
          $('#importStatus').html('<div class="alert alert-success">导入成功！数据版本 v' + (data.version || '未知') + '</div>');
          setTimeout(function () { Router.navigate('/dashboard'); }, 1500);
        } catch (err) {
          $('#importStatus').html('<div class="alert alert-danger">导入失败：' + err.message + '</div>');
        }
      };
      reader.readAsText(file);
    });
    $('#btnSeedDemo').off('click').on('click', function () {
      if (!confirm('将清空并重置为演示数据，确定继续？')) return;
      Store.clearAll();
      Models.seed();
      Store.migrate();
      alert('演示数据已初始化成功！');
      refreshStoreList();
      Router.navigate('/dashboard');
    });
  }

  function exportBackup() {
    var data = Store.exportAll();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bakery_backup_' + fmtDate(new Date()) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function registerRoutes() {
    Router.beforeEach(function (next, abort) {
      if (!Store.exists()) {
        if (window.location.hash.indexOf('/backup') < 0) {
          window.location.hash = '#/backup';
          abort();
          return;
        }
      }
      next();
    });
    Router.register('/dashboard', renderDashboard);
    Router.register('/schedule', Schedule.render);
    Router.register('/workorder', Schedule.renderKanban);
    Router.register('/pos', POS.render);
    Router.register('/transfer', renderTransfer);
    Router.register('/member', renderMember);
    Router.register('/report', renderReport);
    Router.register('/backup', renderBackup);
  }

  function init() {
    Store.migrate();
    if (!Store.exists()) {
      if (!window.location.hash) window.location.hash = '#/backup';
    } else {
      if (!window.location.hash) window.location.hash = '#/dashboard';
    }
    refreshStoreList();
    registerRoutes();
    Schedule.startKanbanTimer();
    Router.fireRoute();
    $(window).on('hashchange', function () {
      var cur = Router.getCurrent();
      if (cur && cur.path !== '/report') destroyCharts();
    });
  }

  $(document).ready(init);

  return { exportBackup: exportBackup };
})();
