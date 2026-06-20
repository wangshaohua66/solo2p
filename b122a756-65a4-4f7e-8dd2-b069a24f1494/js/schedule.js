var Schedule = (function () {
  var state = {
    date: null, storeId: null, scale: 12,
    suggestions: {}, planBlocks: [], conflicts: []
  };

  function fmtDate(d) {
    if (typeof d === 'string') return d;
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function sameDay(iso, dateStr) {
    return iso && iso.slice(0, 10) === dateStr;
  }

  function calcSuggestions(storeId, date) {
    var products = Store.get('products', []);
    var processes = Store.get('processes', []);
    var sales = Store.get('sales', []);
    var saleItems = Store.get('sale_items', []);
    var targetDate = new Date(date);
    var targetDow = targetDate.getDay();
    var itemMap = {};
    var sampleDays = 0;

    for (var d = 1; d <= 21; d++) {
      var past = new Date(targetDate.getTime() - d * 86400000);
      if (past.getDay() !== targetDow) continue;
      sampleDays++;
      if (sampleDays >= 2) break;
      var dayStr = fmtDate(past);
      var daySaleIds = {};
      sales.forEach(function (s) {
        if (s.store_id === storeId && sameDay(s.created_at, dayStr)) {
          daySaleIds[s.id] = true;
        }
      });
      saleItems.forEach(function (it) {
        if (daySaleIds[it.sale_id]) {
          if (!itemMap[it.sku_id]) itemMap[it.sku_id] = 0;
          itemMap[it.sku_id] += it.quantity;
        }
      });
    }
    if (sampleDays === 0) sampleDays = 1;
    var weatherFactor = 1 + (Math.random() - 0.5) * 0.1;
    var suggest = {};
    products.forEach(function (p) {
      var skuProcesses = processes.filter(function (x) { return x.sku_id === p.id; });
      var avg = Math.ceil(((itemMap[p.id] || 0) / sampleDays) * weatherFactor);
      suggest[p.id] = {
        product: p,
        processes: skuProcesses.sort(function (a, b) { return a.order_index - b.order_index; }),
        qty: Math.max(10, avg + Math.floor(p.price / 5))
      };
    });
    return suggest;
  }

  function buildPlanBlocks(suggestions, dateStr, startTimeHr) {
    var blocks = [];
    var dayBase = new Date(dateStr + 'T00:00:00');
    startTimeHr = startTimeHr || 6;
    Object.keys(suggestions).forEach(function (skuId, rowIdx) {
      var info = suggestions[skuId];
      var cursor = new Date(dayBase.getTime() + startTimeHr * 3600000 + rowIdx * 600000);
      info.processes.forEach(function (proc) {
        var durMs = proc.duration_min * 60000;
        blocks.push({
          id: 'bl_' + skuId + '_' + proc.id,
          sku_id: skuId,
          process_id: proc.id,
          process_name: proc.name,
          resource: proc.resource_type,
          product: info.product,
          qty: info.qty,
          start: cursor.toISOString(),
          end: new Date(cursor.getTime() + durMs).toISOString(),
          duration_min: proc.duration_min
        });
        cursor = new Date(cursor.getTime() + durMs);
      });
    });
    return blocks;
  }

  function detectConflicts(blocks, storeId) {
    var store = Store.listFind('stores', function (s) { return s.id === storeId; });
    if (!store) return [];
    var conflicts = {};
    var resTypes = { fermenter: store.fermenter_count || 2, oven: store.oven_count || 2 };
    Object.keys(resTypes).forEach(function (rt) {
      var resBlocks = blocks.filter(function (b) { return b.resource === rt; });
      resBlocks.sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
      for (var i = 0; i < resBlocks.length; i++) {
        var overlapCount = 0;
        for (var j = 0; j < resBlocks.length; j++) {
          if (i === j) continue;
          var a = resBlocks[i], b = resBlocks[j];
          if (new Date(a.start) < new Date(b.end) && new Date(a.end) > new Date(b.start)) {
            overlapCount++;
          }
        }
        if (overlapCount >= resTypes[rt]) {
          conflicts[resBlocks[i].id] = true;
        }
      }
    });
    return Object.keys(conflicts);
  }

  function generateWorkOrders(blocks, storeId, date) {
    var orders = [];
    blocks.forEach(function (b) {
      orders.push({
        id: Store.uid('wo'),
        store_id: storeId,
        sku_id: b.sku_id,
        process_id: b.process_id,
        process_name: b.process_name,
        product_name: b.product.name,
        category: b.product.category,
        quantity: b.qty,
        status: b === blocks.filter(function(x){return x.sku_id===b.sku_id;})[0] ? 'pending' : 'waiting',
        plan_start: b.start,
        plan_end: b.end,
        actual_start: null,
        actual_end: null,
        operator: null,
        schedule_date: date,
        resource: b.resource
      });
    });
    return orders;
  }

  function render() {
    var settings = Store.get('settings', {});
    state.storeId = Router.getQuery('store', settings.currentStoreId || 'st_01');
    state.date = Router.getQuery('date', fmtDate(new Date()));
    state.scale = 12;
    $('#scheduleDate').val(state.date);
    var stores = Store.get('stores', []);
    $('#scheduleStore').empty();
    stores.forEach(function (s) {
      var opt = $('<option>').val(s.id).text(s.name);
      if (s.id === state.storeId) opt.attr('selected', 'selected');
      $('#scheduleStore').append(opt);
    });
    $('#ganttScale').val(String(state.scale));
    $('#scheduleDate').off('change').on('change', function () {
      state.date = $(this).val();
      Router.setDirty(false);
      Router.navigate('/schedule', { date: state.date, store: state.storeId });
    });
    $('#scheduleStore').off('change').on('change', function () {
      state.storeId = $(this).val();
      Router.setDirty(false);
      Router.navigate('/schedule', { date: state.date, store: state.storeId });
    });
    $('#ganttScale').off('change').on('change', function () {
      state.scale = parseInt($(this).val(), 10);
      drawGantt();
    });
    $('#btnCalcSuggest').off('click').on('click', function () {
      state.suggestions = calcSuggestions(state.storeId, state.date);
      state.planBlocks = buildPlanBlocks(state.suggestions, state.date);
      state.conflicts = detectConflicts(state.planBlocks, state.storeId);
      drawGantt();
    });
    $('#btnGenerateWO').off('click').on('click', function () {
      if (state.planBlocks.length === 0) {
        alert('请先计算建议产量');
        return;
      }
      if (state.conflicts.length > 0) {
        if (!confirm('仍有 ' + state.conflicts.length + ' 个时段冲突，是否继续生成？')) return;
      }
      var orders = generateWorkOrders(state.planBlocks, state.storeId, state.date);
      var all = Store.get('workorders', []);
      var filtered = all.filter(function (o) {
        return !(o.store_id === state.storeId && o.schedule_date === state.date);
      });
      filtered = filtered.concat(orders);
      Store.set('workorders', filtered);
      Router.setDirty(false);
      alert('成功生成 ' + orders.length + ' 个工单');
      Router.navigate('/workorder', { store: state.storeId });
    });
    if (!state.suggestions || Object.keys(state.suggestions).length === 0) {
      state.suggestions = calcSuggestions(state.storeId, state.date);
      state.planBlocks = buildPlanBlocks(state.suggestions, state.date);
      state.conflicts = detectConflicts(state.planBlocks, state.storeId);
    }
    drawGantt();
  }

  function drawGantt() {
    var products = Object.values(state.suggestions).map(function (x) { return x.product; }).slice(0, 40);
    var displayBlocks = state.planBlocks.filter(function (b) {
      return products.find(function (p) { return p.id === b.sku_id; });
    });
    var pixPerHour = 80;
    var scaleHours = state.scale;
    var startHour = 6;
    var totalWidth = scaleHours * pixPerHour;
    $('#ganttTimeline').empty().css('width', totalWidth + 'px');
    for (var h = 0; h <= scaleHours; h++) {
      var hour = startHour + h;
      var hh = $('<div class="gantt-hour">')
        .css({ left: (h * pixPerHour) + 'px', width: pixPerHour + 'px' })
        .text(String(hour).padStart(2, '0') + ':00');
      $('#ganttTimeline').append(hh);
    }
    var leftFrag = document.createDocumentFragment();
    products.forEach(function (p) {
      var row = $('<div class="gantt-product-row">').attr('data-sku', p.id);
      var tag = $('<span>').addClass('cat-' + p.category);
      var nameDiv = $('<div>').css({ flex: 1, minWidth: 0 });
      nameDiv.append(tag);
      nameDiv.append($('<span>').text(p.name).css({ marginLeft: '4px' }));
      row.append(nameDiv);
      leftFrag.appendChild(row[0]);
    });
    $('#ganttProductList').empty().append(leftFrag);
    var rightFrag = document.createDocumentFragment();
    products.forEach(function (p) {
      var bodyRow = $('<div class="gantt-body-row">').attr('data-sku', p.id).css('width', totalWidth + 'px');
      for (var g = 1; g <= scaleHours; g++) {
        bodyRow.append($('<div class="grid-line">').css('left', (g * pixPerHour) + 'px'));
      }
      displayBlocks.filter(function (b) { return b.sku_id === p.id; }).forEach(function (b) {
        var d0 = new Date(state.date + 'T00:00:00');
        var startOff = (new Date(b.start) - d0) / 3600000 - startHour;
        var dur = (new Date(b.end) - new Date(b.start)) / 3600000;
        if (startOff + dur < 0 || startOff > scaleHours) return;
        var left = Math.max(0, startOff) * pixPerHour;
        var width = Math.min(scaleHours, startOff + dur) * pixPerHour - left;
        var color = Models.CAT_COLORS[p.category] || '#888';
        var isConflict = state.conflicts.indexOf(b.id) >= 0;
        var stHm = b.start.slice(11, 16);
        var edHm = b.end.slice(11, 16);
        var block = $('<div class="gantt-block">').css({
          left: left + 'px', width: Math.max(40, width) + 'px', background: color
        }).addClass(isConflict ? 'conflict' : '').attr('data-block-id', b.id);
        block.append($('<span class="gb-title">').text(b.process_name));
        block.append($('<span class="gb-time">').text(stHm + ' → ' + edHm));
        bodyRow.append(block);
      });
      rightFrag.appendChild(bodyRow[0]);
    });
    $('#ganttBody').empty().append(rightFrag);
    attachGanttDrag();
  }

  function attachGanttDrag() {
    var dragging = null, offsetX = 0, d0;
    var pixPerHour = 80;
    var startHour = 6;
    d0 = new Date(state.date + 'T00:00:00');
    $('.gantt-block').off('mousedown').on('mousedown', function (e) {
      var id = $(this).attr('data-block-id');
      dragging = state.planBlocks.find(function (x) { return x.id === id; });
      if (!dragging) return;
      offsetX = e.clientX - $(this).offset().left;
      $(this).addClass('dragging');
      Router.setDirty(true);
    });
    $(document).off('mousemove.sch').on('mousemove.sch', function (e) {
      if (!dragging) return;
      var row = $('.gantt-body-row[data-sku="' + dragging.sku_id + '"]');
      if (row.length === 0) return;
      var x = e.clientX - row.offset().left - offsetX;
      var startHours = startHour + (x / pixPerHour);
      startHours = Math.max(startHour, Math.min(startHour + state.scale - (dragging.duration_min / 60), startHours));
      var newStart = new Date(d0.getTime() + Math.floor(startHours * 3600000));
      var newEnd = new Date(newStart.getTime() + dragging.duration_min * 60000);
      dragging.start = newStart.toISOString();
      dragging.end = newEnd.toISOString();
      state.conflicts = detectConflicts(state.planBlocks, state.storeId);
      drawGantt();
    });
    $(document).off('mouseup.sch').on('mouseup.sch', function () {
      if (dragging) {
        dragging = null;
        $('.gantt-block.dragging').removeClass('dragging');
      }
    });
  }

  function renderKanban() {
    var settings = Store.get('settings', {});
    var storeId = Router.getQuery('store', settings.currentStoreId || 'st_01');
    var stores = Store.get('stores', []);
    $('#woStore').empty();
    stores.forEach(function (s) {
      var opt = $('<option>').val(s.id).text(s.name);
      if (s.id === storeId) opt.attr('selected', 'selected');
      $('#woStore').append(opt);
    });
    $('#woStore').off('change').on('change', function () {
      Router.navigate('/workorder', { store: $(this).val() });
    });
    var allOrders = Store.get('workorders', []);
    var today = fmtDate(new Date());
    var orders = allOrders.filter(function (o) {
      return o.store_id === storeId && (o.schedule_date === today || o.status === 'running' || o.status === 'pending');
    });
    var pendingCol = orders.filter(function (o) { return o.status === 'pending' || o.status === 'waiting'; });
    var runningCol = orders.filter(function (o) { return o.status === 'running'; });
    var doneCol = orders.filter(function (o) { return o.status === 'done'; });
    $('#countPending').text(pendingCol.length);
    $('#countRunning').text(runningCol.length);
    $('#countDone').text(doneCol.length);
    renderCol('#colPending', pendingCol, 'pending');
    renderCol('#colRunning', runningCol, 'running');
    renderCol('#colDone', doneCol, 'done');
    setupKanbanDnD();
  }

  function renderCol(sel, list, status) {
    var container = $(sel).empty();
    list.forEach(function (o) {
      var product = Store.listFind('products', function (p) { return p.id === o.sku_id; }) || {};
      var color = Models.CAT_COLORS[o.category] || Models.CAT_COLORS[product.category] || '#888';
      var isOvertime = o.status === 'running' && o.plan_end && new Date() > new Date(o.plan_end);
      var card = $('<div class="wo-card">')
        .attr('draggable', 'true')
        .attr('data-wo-id', o.id)
        .addClass(isOvertime ? 'overtime' : '')
        .addClass(status === 'done' ? 'done' : '')
        .css({ borderLeftColor: color });
      card.append($('<div class="wo-product">').text((product.name || o.product_name) + ' ×' + o.quantity));
      card.append($('<div class="wo-process">').html('<i class="bi bi-gear-wide me-1"></i>' + (o.process_name || '')));
      var plan = '';
      if (o.plan_start) plan = o.plan_start.slice(11, 16) + ' ~ ' + (o.plan_end || '').slice(11, 16);
      card.append($('<div class="wo-qty text-muted">').html('<i class="bi bi-clock me-1"></i>' + (plan || '未排期')));
      if (o.status === 'running' && o.actual_start) {
        var elapsed = Math.floor((Date.now() - new Date(o.actual_start).getTime()) / 1000);
        var planDur = 60 * (o.duration_min || 30);
        var mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
        var ss = String(elapsed % 60).padStart(2, '0');
        card.append($('<div class="wo-timer mt-1">').text('⏱ ' + mm + ':' + ss));
        var prog = Math.min(100, Math.floor(100 * elapsed / planDur));
        var pbar = $('<div class="wo-progress">').append($('<div class="wo-progress-bar">').css('width', prog + '%'));
        card.append(pbar);
      }
      if (o.status === 'pending') {
        var btn = $('<button class="btn btn-sm btn-bakery mt-2 w-100">')
          .html('<i class="bi bi-play-fill me-1"></i>领取开工')
          .on('click', function (e) {
            e.stopPropagation();
            startWork(o.id);
          });
        card.append(btn);
      } else if (o.status === 'running') {
        var doneBtn = $('<button class="btn btn-sm btn-success mt-2 w-100">')
          .html('<i class="bi bi-check2-circle me-1"></i>工序完成')
          .on('click', function (e) {
            e.stopPropagation();
            completeWork(o.id);
          });
        card.append(doneBtn);
      } else if (o.status === 'done') {
        card.append($('<div class="text-success small mt-1">')
          .html('<i class="bi bi-check-circle me-1"></i>' + (o.operator || '') + ' 于 ' + ((o.actual_end || '').slice(11, 16)) + ' 完成'));
      }
      container.append(card);
    });
  }

  function startWork(woId) {
    var settings = Store.get('settings', {});
    var order = Store.listUpdate('workorders', woId, {
      status: 'running',
      actual_start: new Date().toISOString(),
      operator: settings.operator || '烘焙师'
    });
    if (order) {
      var nextId = null;
      var all = Store.get('workorders', []);
      var siblings = all.filter(function (o) { return o.store_id === order.store_id && o.sku_id === order.sku_id && o.schedule_date === order.schedule_date; });
      var currentIdx = siblings.findIndex(function (x) { return x.id === woId; });
      if (currentIdx >= 0 && currentIdx < siblings.length - 1) {
        var next = siblings[currentIdx + 1];
        Store.listUpdate('workorders', next.id, { status: 'pending' });
      }
    }
    renderKanban();
  }

  function completeWork(woId) {
    var all = Store.get('workorders', []);
    var order = all.find(function (x) { return x.id === woId; });
    if (!order) return;
    Store.listUpdate('workorders', woId, {
      status: 'done', actual_end: new Date().toISOString()
    });
    var settings = Store.get('settings', {});
    var sameProductDay = all.filter(function (o) {
      return o.store_id === order.store_id && o.sku_id === order.sku_id && o.schedule_date === order.schedule_date;
    });
    var isLast = sameProductDay.every(function (x) { return x.id === woId || x.status === 'done'; });
    if (isLast) {
      var inv = Store.get('inventory', []);
      var idx = inv.findIndex(function (i) { return i.store_id === order.store_id && i.sku_id === order.sku_id; });
      if (idx >= 0) {
        inv[idx].quantity = (inv[idx].quantity || 0) + (order.quantity || 0);
        inv[idx].produce_date = order.schedule_date;
      } else {
        inv.push({
          id: 'inv_' + order.store_id + '_' + order.sku_id,
          store_id: order.store_id, sku_id: order.sku_id,
          quantity: order.quantity || 0, frozen_quantity: 0,
          produce_date: order.schedule_date
        });
      }
      Store.set('inventory', inv);
    }
    renderKanban();
  }

  function setupKanbanDnD() {
    var dragId = null;
    $('.wo-card').off('dragstart').on('dragstart', function (e) {
      dragId = $(this).attr('data-wo-id');
      e.originalEvent.dataTransfer.effectAllowed = 'move';
    });
    $('.kanban-body').off('dragover').on('dragover', function (e) {
      e.preventDefault();
      $(this).addClass('drag-over');
    }).off('dragleave').on('dragleave', function () {
      $(this).removeClass('drag-over');
    }).off('drop').on('drop', function (e) {
      e.preventDefault();
      $(this).removeClass('drag-over');
      if (!dragId) return;
      var col = $(this).closest('.kanban-col').attr('data-status');
      if (col === 'running') startWork(dragId);
      else if (col === 'done') completeWork(dragId);
      dragId = null;
    });
  }

  var _kanbanTimer = null;
  function startKanbanTimer() {
    if (_kanbanTimer) clearInterval(_kanbanTimer);
    _kanbanTimer = setInterval(function () {
      if (Router.getCurrent() && Router.getCurrent().path === '/workorder') {
        var runningCount = $('.kanban-col[data-status="running"] .wo-timer').length;
        if (runningCount > 0) renderKanban();
      }
    }, 1000);
  }

  return {
    render: render,
    renderKanban: renderKanban,
    startKanbanTimer: startKanbanTimer,
    calcSuggestions: calcSuggestions,
    detectConflicts: detectConflicts
  };
})();
