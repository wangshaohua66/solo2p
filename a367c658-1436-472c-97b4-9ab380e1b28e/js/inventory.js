var InventoryView = (function() {
  'use strict';

  var currentStore = AppStore.STORES[0];
  var filter = { keyword: '', onlyLow: false, onlyExpiring: false, category: null };
  var tab = 'inventory';

  function setStore(s) { currentStore = s; renderAll(); }
  function setFilter(f) { $.extend(filter, f || {}); renderAll(); }
  function setTab(t) { tab = t; renderAll(); }

  function renderAll() {
    if (tab === 'inventory') renderInventoryList();
    else if (tab === 'logs') renderLogs();
    else if (tab === 'transfer') renderTransferPage();
  }

  function statsSummary() {
    var inv = AppStore.getState(AppStore.KEYS.INVENTORY)[currentStore] || {};
    var total = 0, low = 0, expiring = 0, totalValue = 0;
    Object.keys(inv).forEach(function(hid) {
      var r = inv[hid];
      total += r.quantity;
      if (r.quantity < r.safeStock) low++;
      var daysLeft = (new Date(r.expiryDate) - Date.now()) / 86400000;
      if (daysLeft < 90 && daysLeft > 0) expiring++;
      totalValue += (r.quantity * 0.15);
    });
    var logs = AppStore.getState(AppStore.KEYS.STOCK_LOGS) || [];
    var monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    var monthIn = 0, monthOut = 0;
    logs.forEach(function(l) {
      if (l.storeId !== currentStore) return;
      if (l.createdAt < monthStart.getTime()) return;
      if (l.change > 0) monthIn += l.change;
      else monthOut += Math.abs(l.change);
    });
    return { total: total, low: low, expiring: expiring, totalValue: totalValue,
             monthIn: monthIn, monthOut: monthOut, count: Object.keys(inv).length };
  }

  function renderInventoryList($container) {
    var $root = $container || $('#inventoryPage');
    var st = statsSummary();
    var inv = AppStore.getState(AppStore.KEYS.INVENTORY)[currentStore] || {};
    var items = [];
    Object.keys(inv).forEach(function(hid) {
      var h = HerbData.getById(hid);
      var r = inv[hid];
      if (!h) return;
      if (filter.category && h.category !== filter.category) return;
      if (filter.keyword) {
        var kw = filter.keyword.toLowerCase();
        var aliasHit = (h.aliases || []).some(function(a) { return a.toLowerCase().indexOf(kw) >= 0; });
        var pyHit = (h.pinyin || '').toLowerCase().indexOf(kw) >= 0;
        if (h.name.toLowerCase().indexOf(kw) < 0 && !aliasHit && !pyHit) return;
      }
      var daysLeft = (new Date(r.expiryDate) - Date.now()) / 86400000;
      var isLow = r.quantity < r.safeStock;
      var isExpiring = daysLeft < 90 && daysLeft > 0;
      if (filter.onlyLow && !isLow) return;
      if (filter.onlyExpiring && !isExpiring) return;
      items.push({
        id: hid, name: h.name, pinyin: h.pinyin ? h.pinyin.split('|')[0] : '',
        category: h.category, aliases: h.aliases, quantity: r.quantity,
        safeStock: r.safeStock, expiryDate: r.expiryDate, daysLeft: daysLeft,
        isLow: isLow, isExpiring: isExpiring, unitPrice: r.unitPrice, location: r.location
      });
    });
    items.sort(function(a, b) {
      if (a.isLow !== b.isLow) return a.isLow ? -1 : 1;
      if (a.isExpiring !== b.isExpiring) return a.isExpiring ? -1 : 1;
      return a.daysLeft - b.daysLeft;
    });

    var html = buildTabBar()
      + '<div class="row g-3 mb-3">'
      + buildStatCard('药材品种数', st.count + ' 味', 'bi-box-seam-fill', 'grad-blue', '/inventory?tab=inventory')
      + buildStatCard('库存总量', st.total.toLocaleString() + ' 克', 'bi-database-fill', 'grad-green', '/inventory?tab=inventory')
      + buildStatCard('安全库存预警', st.low + ' 味', 'bi-exclamation-triangle-fill', 'grad-orange', '/inventory?low=1')
      + buildStatCard('近效期预警', st.expiring + ' 味', 'bi-calendar-x-fill', 'grad-red', '/inventory?expire=1')
      + '</div>'

      + '<div class="card border-0 shadow-sm mb-3">'
      + '<div class="card-header bg-white d-flex flex-wrap align-items-center gap-2 py-3">'
      + '<div class="btn-group btn-group-sm me-2" role="group">'
      + AppStore.STORES.map(function(s) {
          return '<button class="btn btn-sm ' + (s===currentStore?'btn-herb':'btn-outline-secondary') + ' store-btn" data-s="' + s + '">' + s + '</button>';
        }).join('')
      + '</div>'
      + '<div class="input-group input-group-sm flex-grow-1 me-2" style="min-width:220px;max-width:380px">'
      + '<span class="input-group-text"><i class="bi bi-search"></i></span>'
      + '<input type="text" class="form-control" id="invSearch" placeholder="搜索药材名/拼音/别名" value="' + (filter.keyword || '') + '">'
      + '</div>'
      + '<select class="form-select form-select-sm" id="invCatFilter" style="width:auto">'
      + '<option value="">全部分类</option>'
      + HerbData.CATEGORIES.map(function(c) { return '<option value="' + c.id + '"' + (filter.category===c.id?' selected':'') + '>' + c.name + '</option>'; }).join('')
      + '</select>'
      + '<div class="form-check form-check-inline ms-2 mb-0">'
      + '<input class="form-check-input" type="checkbox" id="onlyLowChk" ' + (filter.onlyLow ? 'checked' : '') + '>'
      + '<label class="form-check-label small text-warning" for="onlyLowChk"><i class="bi bi-exclamation-triangle"></i>仅看缺货</label></div>'
      + '<div class="form-check form-check-inline mb-0">'
      + '<input class="form-check-input" type="checkbox" id="onlyExpChk" ' + (filter.onlyExpiring ? 'checked' : '') + '>'
      + '<label class="form-check-label small text-danger" for="onlyExpChk"><i class="bi bi-calendar-x"></i>仅看近效期</label></div>'
      + '<button class="btn btn-sm btn-herb ms-auto" id="addStockBtn"><i class="bi bi-plus-circle me-1"></i>批量入库</button>'
      + '</div><div class="card-body p-0">';

    if (items.length === 0) {
      html += '<div class="text-center py-5 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2 opacity-25"></i>暂无匹配记录</div>';
    } else {
      html += '<div class="table-responsive" style="max-height:68vh"><table class="table align-middle mb-0 inventory-table">'
        + '<thead class="sticky-top"><tr>'
        + '<th>药材</th><th>分类</th><th style="width:200px">库存 / 安全阈值</th>'
        + '<th style="width:220px">库存状态</th>'
        + '<th style="width:120px">效期</th><th style="width:100px">库位</th>'
        + '<th style="width:160px">操作</th></tr></thead><tbody>';
      items.forEach(function(it) {
        var catName = ((HerbData.CATEGORIES.filter(function(c) { return c.id === it.category; })[0]) || {}).name || '';
        var ratio = it.safeStock > 0 ? Math.min(100, Math.round(it.quantity / (it.safeStock * 2) * 100)) : 50;
        var barCls = ratio < 30 ? 'bg-danger' : (ratio < 60 ? 'bg-warning' : 'bg-success');
        var statusChip = it.isLow
          ? '<span class="badge bg-warning text-white"><i class="bi bi-exclamation-triangle me-1"></i>库存不足</span>'
          : '<span class="badge bg-success text-white"><i class="bi bi-check-circle me-1"></i>正常</span>';
        var expChip = it.isExpiring
          ? '<span class="badge bg-danger text-white" style="font-size:.6rem">近效期 ' + Math.round(it.daysLeft) + '天</span>'
          : '<span class="badge bg-light text-muted" style="font-size:.6rem">效期充足</span>';
        var rowCls = it.isLow ? 'inventory-warning-row' : (it.isExpiring ? 'inventory-expiring-row' : '');
        html += '<tr class="' + rowCls + '">'
          + '<td><span class="fw-medium">' + it.name + '</span>'
          + (it.aliases[0] ? ' <span class="alias-tag">' + it.aliases[0] + '</span>' : '')
          + '<span class="small text-muted d-block">' + it.pinyin + '</span></td>'
          + '<td><span class="small">' + catName + '</span></td>'
          + '<td><div class="font-mono fw-bold">' + it.quantity.toLocaleString() + 'g / <span class="text-muted fw-normal">' + it.safeStock + 'g</span></div>'
          + '<div class="inventory-progress mt-1"><div class="inventory-progress-bar ' + barCls + '" style="width:' + ratio + '%"></div></div></td>'
          + '<td><div class="d-flex flex-wrap gap-1 align-items-center">' + statusChip + expChip + '</div></td>'
          + '<td><span class="font-mono small">' + formatDate(it.expiryDate) + '</span></td>'
          + '<td><span class="badge bg-light text-dark">' + (it.location || '-') + '</span></td>'
          + '<td><div class="btn-group btn-group-sm">'
          + '<button class="btn btn-outline-secondary op-btn" data-op="in" data-id="' + it.id + '"><i class="bi bi-plus-lg"></i> 入库</button>'
          + '<button class="btn btn-outline-secondary op-btn" data-op="out" data-id="' + it.id + '"><i class="bi bi-dash-lg"></i> 出库</button>'
          + '<button class="btn btn-outline-primary op-btn" data-op="transfer" data-id="' + it.id + '" title="调拨建议"><i class="bi bi-arrow-left-right"></i></button>'
          + '</div></td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div></div>';
    if ($container) $root = $container;
    $root.html(html);
    bindInventoryEvents();
  }

  function renderLogs() {
    var $root = $('#inventoryPage');
    var logs = AppStore.getState(AppStore.KEYS.STOCK_LOGS) || [];
    logs = logs.slice().sort(function(a, b) { return b.createdAt - a.createdAt; });
    var html = buildTabBar()
      + '<div class="row g-3 mb-3">'
      + buildStatCard('出入库流水', logs.length + ' 条', 'bi-journal-text', 'grad-purple', null)
      + buildStatCard('本月入库', statsSummary().monthIn.toLocaleString() + ' 克', 'bi-box-arrow-in-down-left', 'grad-green', null)
      + buildStatCard('本月出库', statsSummary().monthOut.toLocaleString() + ' 克', 'bi-box-arrow-up-right', 'grad-orange', null)
      + buildStatCard('流转率', (statsSummary().monthOut/Math.max(1,statsSummary().total)*100).toFixed(1) + ' %', 'bi-graph-up-arrow', 'grad-teal', null)
      + '</div>'
      + '<div class="card border-0 shadow-sm"><div class="card-header bg-white d-flex align-items-center py-3">'
      + '<h6 class="mb-0 fw-bold"><i class="bi bi-journal-text me-2 text-herb-green"></i>出入库明细流水</h6>'
      + '<span class="badge bg-light text-dark ms-2">按时间倒序</span>'
      + '<button class="btn btn-sm btn-outline-secondary ms-auto" id="exportLogsBtn"><i class="bi bi-download me-1"></i>导出</button>'
      + '</div><div class="card-body p-0">';

    if (logs.length === 0) {
      html += '<div class="text-center py-5 text-muted">暂无流水记录</div>';
    } else {
      html += '<div class="table-responsive" style="max-height:68vh"><table class="table align-middle mb-0">'
        + '<thead class="sticky-top"><tr><th style="width:170px">时间</th><th>门店</th><th>药材</th><th>类型</th>'
        + '<th>数量</th><th>操作人</th><th>备注</th></tr></thead><tbody>';
      logs.slice(0, 200).forEach(function(l) {
        var h = HerbData.getById(l.herbId);
        var typeCls = l.change > 0 ? 'success' : 'danger';
        var typeLabel = l.change > 0 ? '入库' : '出库';
        var typeIcn = l.change > 0 ? 'bi-box-arrow-in-down-left' : 'bi-box-arrow-up-right';
        html += '<tr><td class="small font-mono">' + formatDate(l.createdAt, 'YYYY-MM-DD HH:mm') + '</td>'
          + '<td><span class="badge bg-info text-white">' + l.storeId + '</span></td>'
          + '<td><span class="fw-medium">' + (h ? h.name : l.herbId) + '</span></td>'
          + '<td><span class="badge bg-' + typeCls + ' text-white"><i class="bi ' + typeIcn + ' me-1"></i>' + (l.opName || typeLabel) + '</span></td>'
          + '<td class="font-mono"><b class="text-' + typeCls + '">' + (l.change > 0 ? '+' : '') + l.change + 'g</b></td>'
          + '<td class="small">' + (l.operator || '-') + '</td>'
          + '<td class="small text-muted">' + (l.note || '') + '</td></tr>';
      });
      html += '</tbody></table>' + (logs.length > 200 ? '<div class="p-3 text-center small text-muted border-top">仅显示最近200条，总计' + logs.length + '条</div>' : '') + '</div>';
    }
    html += '</div></div>';
    $root.html(html);
    bindLogsEvents();
  }

  function renderTransferPage() {
    var $root = $('#inventoryPage');
    var allStores = AppStore.STORES;
    var inv = AppStore.getState(AppStore.KEYS.INVENTORY) || {};
    var suggestions = [];
    var allHids = Object.keys(inv[currentStore] || {});
    allHids.forEach(function(hid) {
      var h = HerbData.getById(hid);
      if (!h) return;
      var here = inv[currentStore][hid];
      if (!here || here.quantity >= here.safeStock) return;
      var donors = [];
      allStores.forEach(function(s) {
        if (s === currentStore) return;
        var o = inv[s] && inv[s][hid];
        if (o && o.quantity > o.safeStock * 1.5) {
          donors.push({ store: s, qty: o.quantity, surplus: Math.floor((o.quantity - o.safeStock) / 2) });
        }
      });
      if (donors.length > 0) {
        donors.sort(function(a, b) { return b.surplus - a.surplus; });
        suggestions.push({
          herb: h, current: here, donors: donors,
          need: here.safeStock * 2 - here.quantity
        });
      }
    });
    suggestions.sort(function(a, b) { return b.need - a.need; });

    var html = buildTabBar()
      + '<div class="row g-3 mb-3">'
      + buildStatCard('当前门店', currentStore, 'bi-shop', 'grad-blue', null)
      + buildStatCard('缺货药材', suggestions.length + ' 味', 'bi-exclamation-triangle-fill', 'grad-orange', null)
      + buildStatCard('可调拨门店', (allStores.length - 1) + ' 家', 'bi-building', 'grad-purple', null)
      + buildStatCard('联网库存', (Object.keys(inv).reduce(function(s, k) { return s + Object.keys(inv[k]).length; }, 0)) + ' 味', 'bi-diagram-3', 'grad-teal', null)
      + '</div>'

      + '<div class="card border-0 shadow-sm mb-3"><div class="card-header bg-white py-3">'
      + '<h6 class="mb-0 fw-bold"><i class="bi bi-arrow-left-right me-2 text-herb-green"></i>智能调拨建议</h6>'
      + '<small class="text-muted ms-2">按各门店安全库存自动匹配，建议优先调富余门店</small></div>'
      + '<div class="card-body p-0">';
    if (suggestions.length === 0) {
      html += '<div class="text-center py-5 text-muted">'
        + '<i class="bi bi-hand-thumbs-up fs-1 d-block mb-2 text-success opacity-50"></i>库存状态良好，暂无调拨需求</div>';
    } else {
      html += '<div class="table-responsive" style="max-height:68vh"><table class="table align-middle mb-0">'
        + '<thead class="sticky-top"><tr><th>缺货药材</th><th>当前库存</th><th>建议补充</th><th>可调拨门店</th><th>操作</th></tr></thead><tbody>';
      suggestions.slice(0, 50).forEach(function(s) {
        html += '<tr class="inventory-warning-row">'
          + '<td><span class="fw-medium">' + s.herb.name + '</span>'
          + (s.herb.aliases[0] ? ' <span class="alias-tag">' + s.herb.aliases[0] + '</span>' : '') + '</td>'
          + '<td><span class="text-warning fw-bold">' + s.current.quantity + 'g</span> / 安全 ' + s.current.safeStock + 'g</td>'
          + '<td><span class="badge bg-warning text-white">需 ' + s.need + 'g</span></td>'
          + '<td><div class="d-flex flex-wrap gap-1">';
        s.donors.forEach(function(d) {
          html += '<span class="badge bg-success text-white">' + d.store + ' 余' + d.surplus + 'g</span>';
        });
        html += '</div></td><td><div class="btn-group btn-group-sm">'
        + s.donors.slice(0,2).map(function(d) {
            return '<button class="btn btn-sm btn-outline-primary transfer-btn" data-from="' + d.store + '" data-id="' + s.herb.id + '" data-qty="' + s.need + '">'
              + d.store + ' → 本地</button>';
          }).join('')
        + '</div></td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div></div>';
    $root.html(html);
    bindTransferEvents();
  }

  function buildTabBar() {
    var tabs = [
      { k: 'inventory', label: '库存总览', icon: 'bi-box-seam' },
      { k: 'logs', label: '出入库流水', icon: 'bi-journal-text' },
      { k: 'transfer', label: '多门店调拨', icon: 'bi-arrow-left-right' }
    ];
    return '<ul class="nav nav-tabs nav-tabs-herb mb-3">'
      + tabs.map(function(t) {
          return '<li class="nav-item"><a class="nav-link ' + (tab===t.k?'active':'') + '" data-tab="' + t.k + '" href="javascript:void(0)">'
            + '<i class="bi ' + t.icon + ' me-1"></i>' + t.label + '</a></li>';
        }).join('')
      + '</ul>';
  }

  function buildStatCard(title, value, icon, grad, href) {
    return '<div class="col-md-3 col-sm-6">'
      + '<div class="stat-card ' + grad + ' shadow-sm">'
      + '<div class="d-flex align-items-start justify-content-between mb-2">'
      + '<div class="stat-icon"><i class="bi ' + icon + '"></i></div>'
      + (href ? '<a class="stat-link small text-decoration-none text-white opacity-75" href="#' + href + '">查看 →</a>' : '')
      + '</div>'
      + '<div class="stat-value">' + value + '</div>'
      + '<div class="stat-label">' + title + '</div>'
      + '</div></div>';
  }

  function bindInventoryEvents() {
    $(document).off('click', '.store-btn').on('click', '.store-btn', function() { setStore($(this).data('s')); });
    $(document).off('input', '#invSearch').on('input', '#invSearch', function() {
      clearTimeout(bindInventoryEvents._t);
      var v = $(this).val();
      bindInventoryEvents._t = setTimeout(function() { setFilter({ keyword: v }); }, 180);
    });
    $(document).off('change', '#invCatFilter').on('change', '#invCatFilter', function() {
      setFilter({ category: $(this).val() || null });
    });
    $(document).off('change', '#onlyLowChk').on('change', '#onlyLowChk', function() {
      setFilter({ onlyLow: $(this).is(':checked') });
    });
    $(document).off('change', '#onlyExpChk').on('change', '#onlyExpChk', function() {
      setFilter({ onlyExpiring: $(this).is(':checked') });
    });
    $(document).off('click', '.op-btn').on('click', '.op-btn', function() {
      var op = $(this).data('op');
      var hid = $(this).data('id');
      if (op === 'transfer') {
        setTab('transfer'); return;
      }
      promptStockChange(hid, op);
    });
    $(document).off('click', '#addStockBtn').on('click', '#addStockBtn', function() {
      Toast.info('请从列表中点击具体药材的【入库】按钮操作，支持单味精准调整');
    });
    $(document).off('click', '[data-tab]').on('click', '[data-tab]', function() { setTab($(this).data('tab')); });
  }

  function bindLogsEvents() {
    $(document).off('click', '[data-tab]').on('click', '[data-tab]', function() { setTab($(this).data('tab')); });
    $(document).off('click', '#exportLogsBtn').on('click', '#exportLogsBtn', function() {
      var logs = AppStore.getState(AppStore.KEYS.STOCK_LOGS) || [];
      var lines = ['时间,门店,药材,类型,数量(克),操作人,备注'];
      logs.forEach(function(l) {
        var h = HerbData.getById(l.herbId);
        lines.push([formatDate(l.createdAt,'YYYY-MM-DD HH:mm:ss'),l.storeId,(h?h.name:l.herbId),(l.opName||(l.change>0?'入库':'出库')),l.change,(l.operator||''),(l.note||'')].join(','));
      });
      downloadFile('stock-logs-' + formatDate(Date.now()) + '.csv', lines.join('\n'), 'text/csv');
      Toast.success('已导出 ' + logs.length + ' 条流水记录');
    });
  }

  function bindTransferEvents() {
    $(document).off('click', '[data-tab]').on('click', '[data-tab]', function() { setTab($(this).data('tab')); });
    $(document).off('click', '.transfer-btn').on('click', '.transfer-btn', function() {
      var from = $(this).data('from');
      var hid = $(this).data('id');
      var qty = parseInt($(this).data('qty'), 10);
      var h = HerbData.getById(hid);
      var name = h ? h.name : hid;
      if (!confirm('确认从【' + from + '】调拨 ' + name + ' ' + qty + 'g 到【' + currentStore + '】？此操作将同时更新两个门店库存并生成流水。')) return;
      AppStore.updateInventory(from, hid, -qty, { opName: '门店调出', operator: '系统调拨', note: '调往' + currentStore });
      AppStore.updateInventory(currentStore, hid, qty, { opName: '门店调入', operator: '系统调拨', note: '来自' + from });
      Toast.success('调拨完成：' + name + ' ' + qty + 'g 已从' + from + '转入' + currentStore, '调拨成功');
      renderAll();
    });
  }

  function promptStockChange(hid, op) {
    var h = HerbData.getById(hid);
    if (!h) return;
    var label = op === 'in' ? '入库' : '出库';
    var defaultQty = op === 'in' ? 500 : 100;
    var html = '<div class="card border-0 shadow-sm"><div class="card-body"><h6 class="mb-3">' + label + '：' + h.name + '</h6>'
      + '<div class="mb-3"><label class="form-label small">数量（克）</label>'
      + '<input type="number" class="form-control" id="qtyPrompt" value="' + defaultQty + '" min="1"></div>'
      + '<div class="mb-3"><label class="form-label small">单价（元/克，可选）</label>'
      + '<input type="number" step="0.01" class="form-control" id="pricePrompt" value="0.15"></div>'
      + '<div class="mb-3"><label class="form-label small">效期（YYYY-MM-DD）</label>'
      + '<input type="date" class="form-control" id="expirePrompt" value="' + formatDate(Date.now() + 730*86400000) + '"></div>'
      + '<div class="mb-3"><label class="form-label small">操作人</label>'
      + '<input type="text" class="form-control" id="opPrompt" value="张药师"></div>'
      + '<div class="mb-3"><label class="form-label small">备注</label>'
      + '<input type="text" class="form-control" id="notePrompt" placeholder="例：采购单#123 / 顾客XX自购"></div>'
      + '<div class="d-flex justify-content-end gap-2">'
      + '<button class="btn btn-outline-secondary" id="cancelStock">取消</button>'
      + '<button class="btn btn-herb" id="confirmStock">' + label + '</button></div></div></div>';
    var $mdl = $('<div class="modal-backdrop fade show" style="z-index:1060"></div><div class="modal fade show d-block" tabindex="-1" style="z-index:1061"><div class="modal-dialog modal-dialog-centered"><div class="modal-content p-2"></div></div></div>');
    $mdl.eq(1).find('.modal-content').html(html);
    $('body').append($mdl);
    $(document).on('click', '#cancelStock', function() { $mdl.remove(); });
    $(document).on('click', '#confirmStock', function() {
      var qty = parseInt($('#qtyPrompt').val(), 10) || 0;
      if (qty <= 0) { Toast.warning('请输入有效数量'); return; }
      var change = op === 'in' ? qty : -qty;
      AppStore.updateInventory(currentStore, hid, change, {
        opName: '手动' + label,
        operator: $('#opPrompt').val() || '系统',
        note: $('#notePrompt').val() || ''
      });
      Toast.success(label + '成功：' + h.name + ' ' + change + 'g');
      $mdl.remove(); renderAll();
    });
  }

  function downloadFile(filename, content, mime) {
    var blob = new Blob(['\ufeff' + content], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function() { try { URL.revokeObjectURL(a.href); } catch(_) {} }, 1000);
  }

  return {
    init: function(opts) {
      tab = (opts && opts.tab) || 'inventory';
      if (opts && opts.store) currentStore = opts.store;
      if (opts && opts.low) filter.onlyLow = true;
      if (opts && opts.expire) filter.onlyExpiring = true;
      renderAll();
    },
    setStore: setStore,
    setTab: setTab,
    statsSummary: statsSummary,
    downloadFile: downloadFile
  };
})();
