var Schedule = (function () {
  var state = {
    date: null, storeId: null, scale: 12,
    suggestions: {}, planBlocks: [], conflicts: [],
    weather: 'sunny', collapsed: {}, _syncing: false
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

  function calcSuggestions(storeId, date, weatherKey) {
    var products = Store.get('products', []);
    var processes = Store.get('processes', []);
    var sales = Store.get('sales', []);
    var saleItems = Store.get('sale_items', []);
    var targetDate = new Date(date);
    var targetDow = targetDate.getDay();
    var itemMap = {};
    var sampleDays = 0;
    var daySums = [];

    for (var d = 1; d <= 14; d++) {
      var past = new Date(targetDate.getTime() - d * 86400000);
      if (past.getDay() !== targetDow) continue;
      sampleDays++;
      var dayStr = fmtDate(past);
      var daySaleIds = {};
      var daySum = 0;
      sales.forEach(function (s) {
        if (s.store_id === storeId && sameDay(s.created_at, dayStr)) {
          daySaleIds[s.id] = true;
          daySum += s.actual_amount || 0;
        }
      });
      daySums.push(daySum);
      saleItems.forEach(function (it) {
        if (daySaleIds[it.sale_id]) {
          if (!itemMap[it.sku_id]) itemMap[it.sku_id] = 0;
          itemMap[it.sku_id] += it.quantity;
        }
      });
    }
    if (sampleDays === 0) sampleDays = 1;
    var holidayFactor = Models.getWeatherFactor(date);
    var weatherInfo = Models.WEATHER_FACTORS[weatherKey || state.weather] || Models.WEATHER_FACTORS.sunny;
    var weatherFactor = holidayFactor ? holidayFactor.factor : weatherInfo.factor;
    var suggest = {};
    products.forEach(function (p) {
      var skuProcesses = processes.filter(function (x) { return x.sku_id === p.id; });
      var baseAvg = (itemMap[p.id] || 0) / sampleDays;
      var avg = Math.ceil(baseAvg * weatherFactor);
      suggest[p.id] = {
        product: p,
        processes: skuProcesses.sort(function (a, b) { return a.order_index - b.order_index; }),
        qty: Math.max(8, avg + Math.floor(p.price / 5))
      };
    });
    return { suggest: suggest, factor: weatherFactor, weather: weatherInfo };
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

  function autoDetectWeather(dateStr) {
    var hf = Models.getWeatherFactor(dateStr);
    if (hf) {
      if (hf.factor === 1.3) return 'holiday';
      if (hf.factor === 1.15) return 'weekend';
    }
    return 'sunny';
  }

  function setupScrollSync() {
    var $left = $('#ganttLeft');
    var $right = $('#ganttRight');
    $left.off('scroll.sync').on('scroll.sync', function () {
      if (state._syncing) return;
      state._syncing = true;
      $right.scrollTop($left.scrollTop());
      state._syncing = false;
    });
    $right.off('scroll.sync').on('scroll.sync', function () {
      if (state._syncing) return;
      state._syncing = true;
      $left.scrollTop($right.scrollTop());
      state._syncing = false;
    });
  }

  function updateFactorDisplay() {
    var wf = Models.WEATHER_FACTORS[state.weather];
    var hf = Models.getWeatherFactor(state.date);
    var factor = hf ? hf.factor : (wf ? wf.factor : 1);
    $('#weatherFactorDisplay').text(factor.toFixed(2) + 'x');
  }

  function render() {
    var settings = Store.get('settings', {});
    state.storeId = Router.getQuery('store', settings.currentStoreId || 'st_01');
    state.date = Router.getQuery('date', fmtDate(new Date()));
    state.scale = 12;
    state.weather = autoDetectWeather(state.date);
    $('#scheduleDate').val(state.date);
    var stores = Store.get('stores', []);
    $('#scheduleStore').empty();
    stores.forEach(function (s) {
      var opt = $('<option>').val(s.id).text(s.name);
      if (s.id === state.storeId) opt.attr('selected', 'selected');
      $('#scheduleStore').append(opt);
    });
    $('#ganttScale').val(String(state.scale));
    $('.weather-tag').removeClass('active');
    $('.weather-tag[data-weather="' + state.weather + '"]').addClass('active');
    updateFactorDisplay();
    $('.weather-tag').off('click').on('click', function () {
      state.weather = $(this).attr('data-weather');
      $('.weather-tag').removeClass('active');
      $(this).addClass('active');
      updateFactorDisplay();
    });
    $('#scheduleDate').off('change').on('change', function () {
      state.date = $(this).val();
      state.weather = autoDetectWeather(state.date);
      $('.weather-tag').removeClass('active');
      $('.weather-tag[data-weather="' + state.weather + '"]').addClass('active');
      updateFactorDisplay();
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
      var result = calcSuggestions(state.storeId, state.date, state.weather);
      state.suggestions = result.suggest;
      state.collapsed = {};
      Object.keys(state.suggestions).forEach(function (skuId) {
        state.collapsed[skuId] = true;
      });
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
      var result = calcSuggestions(state.storeId, state.date, state.weather);
      state.suggestions = result.suggest;
      state.collapsed = {};
      Object.keys(state.suggestions).forEach(function (skuId) {
        state.collapsed[skuId] = true;
      });
      state.planBlocks = buildPlanBlocks(state.suggestions, state.date);
      state.conflicts = detectConflicts(state.planBlocks, state.storeId);
    }
    drawGantt();
    setTimeout(setupScrollSync, 50);
  }

  function drawGantt() {
    var products = Object.values(state.suggestions).map(function (x) { return x.product; });
    var displayBlocks = state.planBlocks;
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
      var isCollapsed = !!state.collapsed[p.id];
      var row = $('<div class="gantt-product-row">').attr('data-sku', p.id).addClass(isCollapsed ? 'collapsed' : '');
      var arrow = $('<span class="gantt-arrow">').text(isCollapsed ? '▶' : '▼');
      var tag = $('<span>').addClass('cat-' + p.category);
      var nameDiv = $('<div>').css({ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' });
      nameDiv.append(arrow).append(tag);
      nameDiv.append($('<span>').text(p.name).css({ marginLeft: '4px' }));
      row.append(nameDiv);
      leftFrag.appendChild(row[0]);
    });
    $('#ganttProductList').empty().append(leftFrag);
    $('#ganttProductList').off('click').on('click', '.gantt-product-row', function (e) {
      if ($(e.target).closest('.gantt-block').length > 0) return;
      var skuId = $(this).attr('data-sku');
      state.collapsed[skuId] = !state.collapsed[skuId];
      drawGantt();
    });
    var rightFrag = document.createDocumentFragment();
    products.forEach(function (p) {
      var isCollapsed = !!state.collapsed[p.id];
      var bodyRow = $('<div class="gantt-body-row">')
        .attr('data-sku', p.id)
        .css('width', totalWidth + 'px')
        .addClass(isCollapsed ? 'collapsed' : '');
      for (var g = 1; g <= scaleHours; g++) {
        bodyRow.append($('<div class="grid-line">').css('left', (g * pixPerHour) + 'px'));
      }
      if (!isCollapsed) {
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
      } else {
        var suggestQty = (state.suggestions[p.id] || {}).qty || 0;
        bodyRow.append($('<div class="gantt-collapsed-info">').text('建议产量 ' + suggestQty + ' 件 · 已折叠'));
      }
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

  function getProcessMaterials(processId) {
    var processes = Store.get('processes', []);
    var proc = processes.find(function (p) { return p.id === processId; });
    return proc && proc.material_consumption ? proc.material_consumption : [];
  }

  function completeWork(woId) {
    var all = Store.get('workorders', []);
    var order = all.find(function (x) { return x.id === woId; });
    if (!order) return;
    var updatedWOs = all.map(function (o) {
      if (o.id === woId) {
        return Object.assign({}, o, { status: 'done', actual_end: new Date().toISOString() });
      }
      return o;
    });
    var patch = { workorders: updatedWOs };
    var settings = Store.get('settings', {});
    var procMats = getProcessMaterials(order.process_id);
    var materials = null;
    var materialtx = null;
    if (procMats.length > 0) {
      materials = Store.get('materials', []);
      materialtx = Store.get('materialtx', []);
      procMats.forEach(function (mc) {
        var matId = mc[0];
        var usagePerUnit = mc[1];
        var totalUsage = +(usagePerUnit * (order.quantity || 1)).toFixed(3);
        var mIdx = materials.findIndex(function (m) {
          return m.store_id === order.store_id && m.material_id === matId;
        });
        if (mIdx >= 0) {
          materials[mIdx] = Object.assign({}, materials[mIdx], {
            quantity: +((materials[mIdx].quantity || 0) - totalUsage).toFixed(3)
          });
          materialtx.push({
            id: Store.uid('mtx'),
            store_id: order.store_id,
            material_id: matId,
            material_name: materials[mIdx].name,
            type: 'consume',
            quantity: -totalUsage,
            unit: materials[mIdx].unit,
            ref_type: 'workorder',
            ref_id: woId,
            balance_after: materials[mIdx].quantity,
            operator: settings.operator || '系统',
            created_at: new Date().toISOString()
          });
        }
      });
      patch.materials = materials;
      patch.materialtx = materialtx;
    }
    var sameProductDay = all.filter(function (o) {
      return o.store_id === order.store_id && o.sku_id === order.sku_id && o.schedule_date === order.schedule_date;
    });
    var isLast = sameProductDay.every(function (x) { return x.id === woId || x.status === 'done'; });
    if (isLast) {
      var inv = Store.get('inventory', []);
      var idx = inv.findIndex(function (i) { return i.store_id === order.store_id && i.sku_id === order.sku_id; });
      if (idx >= 0) {
        inv[idx] = Object.assign({}, inv[idx], {
          quantity: (inv[idx].quantity || 0) + (order.quantity || 0),
          produce_date: order.schedule_date
        });
      } else {
        inv.push({
          id: 'inv_' + order.store_id + '_' + order.sku_id,
          store_id: order.store_id, sku_id: order.sku_id,
          quantity: order.quantity || 0, frozen_quantity: 0,
          produce_date: order.schedule_date
        });
      }
      patch.inventory = inv;
    }
    try {
      Store.batchUpdate(patch);
    } catch (e) {
      alert('操作失败：' + e.message);
      return;
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
    detectConflicts: detectConflicts,
    getProcessMaterials: getProcessMaterials
  };
})();
