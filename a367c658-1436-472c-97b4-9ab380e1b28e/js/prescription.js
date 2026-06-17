var PrescriptionEngine = (function() {
  'use strict';

  var currentPrescription = null;
  var currentCategory = null;
  var searchTimer = null;
  var pendingConfirmContext = null;

  function emptyPrescription() {
    return {
      id: AppStore.uid('rx'),
      patientName: '',
      patientGender: '男',
      patientAge: 30,
      isPregnant: false,
      diagnosis: '',
      items: [],
      totalDose: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: '草稿',
      warnings: [],
      storeId: AppStore.STORES[0]
    };
  }

  function validatePrescription(p, opts) {
    opts = opts || {};
    var warnings = [];
    var errors = [];
    var herbIds = {};
    var itemsById = {};
    p.items.forEach(function(it, idx) {
      var hid = it.herbId;
      if (herbIds[hid]) {
        warnings.push({
          type: '别名重复', severity: 'warning',
          herbs: [itemsById[hid].herbName, it.herbName],
          message: '第' + (herbIds[hid]+1) + '味与第' + (idx+1) + '味为同一药材，存在重复入药',
          items: [herbIds[hid], idx]
        });
      } else {
        herbIds[hid] = idx;
        itemsById[hid] = it;
      }
    });

    var itemKeys = Object.keys(itemsById);
    for (var i = 0; i < itemKeys.length; i++) {
      var h1 = HerbData.getById(itemKeys[i]);
      if (!h1) continue;
      var it1 = itemsById[itemKeys[i]];

      h1.eighteenAnti.forEach(function(oid) {
        if (itemsById[oid]) {
          var w = {
            type: '十八反', severity: 'danger',
            herbs: [h1.name, (HerbData.getById(oid)||{}).name],
            message: h1.name + ' 与 ' + (HerbData.getById(oid)||{}).name + ' 属于十八反配伍禁忌，严禁同用',
            items: [herbIds[itemKeys[i]], herbIds[oid]]
          };
          errors.push(w); warnings.push(w);
        }
      });
      h1.nineteenFear.forEach(function(oid) {
        if (itemsById[oid]) {
          var w = {
            type: '十九畏', severity: 'danger',
            herbs: [h1.name, (HerbData.getById(oid)||{}).name],
            message: h1.name + ' 与 ' + (HerbData.getById(oid)||{}).name + ' 属于十九畏配伍，相互制约降低疗效',
            items: [herbIds[itemKeys[i]], herbIds[oid]]
          };
          errors.push(w); warnings.push(w);
        }
      });

      if (p.isPregnant || (opts.forcePregnant)) {
        if (h1.pregnancy === '禁用') {
          var w = {
            type: '妊娠禁用', severity: 'danger',
            herbs: [h1.name],
            message: h1.name + ' 为妊娠禁用药，孕妇绝对禁止使用',
            items: [herbIds[itemKeys[i]]]
          };
          errors.push(w); warnings.push(w);
        } else if (h1.pregnancy === '慎用') {
          warnings.push({
            type: '妊娠慎用', severity: 'warning',
            herbs: [h1.name],
            message: h1.name + ' 为妊娠慎用药，需医师评估后酌减用量',
            items: [herbIds[itemKeys[i]]]
          });
        }
      }

      if (h1.maxDose > 0 && it1.dosage > h1.maxDose * 1.2) {
        var w = {
          type: '剂量超限', severity: 'danger',
          herbs: [h1.name],
          message: h1.name + ' 剂量 ' + it1.dosage + 'g 超出上限 ' + h1.maxDose + 'g ' + (Math.round(it1.dosage/h1.maxDose*100)-100) + '%，已超过药典常用量120%红线',
          items: [herbIds[itemKeys[i]]]
        };
        errors.push(w); warnings.push(w);
      } else if (h1.maxDose > 0 && it1.dosage > h1.maxDose) {
        warnings.push({
          type: '剂量超限', severity: 'warning',
          herbs: [h1.name],
          message: h1.name + ' 剂量 ' + it1.dosage + 'g 超出常用上限 ' + h1.maxDose + 'g，需确认处方意图',
          items: [herbIds[itemKeys[i]]]
        });
      }
      if (h1.minDose > 0 && it1.dosage < h1.minDose) {
        warnings.push({
          type: '剂量超限', severity: 'warning',
          herbs: [h1.name],
          message: h1.name + ' 剂量 ' + it1.dosage + 'g 低于常用下限 ' + h1.minDose + 'g，可能影响疗效',
          items: [herbIds[itemKeys[i]]]
        });
      }
      if (h1.toxicity === '大毒' && it1.dosage > (h1.maxDose || 3)) {
        var w = {
          type: '剂量超限', severity: 'danger',
          herbs: [h1.name],
          message: h1.name + ' 为大毒药品，剂量 ' + it1.dosage + 'g 已达安全阈值上限，请务必审慎',
          items: [herbIds[itemKeys[i]]]
        };
        errors.push(w); warnings.push(w);
      }
    }
    p.warnings = warnings;
    p.errors = errors;
    return { warnings: warnings, errors: errors };
  }

  function addHerbByObject(herbObj, opts) {
    if (!currentPrescription) currentPrescription = emptyPrescription();
    opts = opts || {};
    var canonName = HerbData.resolveAliasToCanonical(herbObj.name || opts.name || '');
    var h = HerbData.getByAlias(canonName) || herbObj;
    if (!h || !h.id) return { error: '未找到该药材' };

    var idx = currentPrescription.items.findIndex(function(it) { return it.herbId === h.id; });
    if (idx >= 0) {
      var addDosage = herbObj.dosage || opts.dosage;
      if (addDosage) {
        currentPrescription.items[idx].dosage = Math.round((currentPrescription.items[idx].dosage + addDosage) * 10) / 10;
      } else {
        var defDose = Math.round((h.minDose + (h.maxDose - h.minDose) * 0.4) * 10) / 10;
        currentPrescription.items[idx].dosage = Math.round((currentPrescription.items[idx].dosage + defDose) * 10) / 10;
      }
      currentPrescription.updatedAt = Date.now();
      if (opts.validate !== false) validatePrescription(currentPrescription);
      return { duplicate: true, merged: true, warning: canonName + ' 已在处方中，自动叠加剂量', itemIndex: idx, item: currentPrescription.items[idx] };
    }

    var defDose = Math.round((h.minDose + (h.maxDose - h.minDose) * 0.4) * 10) / 10;
    var item = {
      herbId: h.id,
      herbName: h.name,
      dosage: defDose,
      unit: '克',
      decoction: (h.specialMethods && h.specialMethods[0]) || '',
      notes: ''
    };
    currentPrescription.items.push(item);
    currentPrescription.updatedAt = Date.now();
    if (opts.validate !== false) validatePrescription(currentPrescription);
    return { ok: true, item: item };
  }

  function removeItem(idx) {
    if (!currentPrescription) return;
    currentPrescription.items.splice(idx, 1);
    currentPrescription.updatedAt = Date.now();
    validatePrescription(currentPrescription);
  }

  function updateItem(idx, patch) {
    if (!currentPrescription || !currentPrescription.items[idx]) return;
    $.extend(currentPrescription.items[idx], patch);
    currentPrescription.updatedAt = Date.now();
    validatePrescription(currentPrescription);
  }

  function reorderItems(from, to) {
    if (!currentPrescription) return;
    from = parseInt(from, 10); to = parseInt(to, 10);
    if (from === to || isNaN(from) || isNaN(to)) return;
    var items = currentPrescription.items;
    if (from < 0 || from >= items.length || to < 0 || to >= items.length) return;
    var it = items.splice(from, 1)[0];
    items.splice(to, 0, it);
    currentPrescription.updatedAt = Date.now();
    validatePrescription(currentPrescription);
  }

  function confirmWarnings(p, onConfirm) {
    var wl = p && p.warnings ? p.warnings : [];
    if (wl.length === 0) return true;
    var hasDanger = wl.some(function(w) { return w.severity === 'danger'; });
    pendingConfirmContext = { p: p, onConfirm: onConfirm, hasDanger: hasDanger };
    renderWarningModal(wl);
    var modal = new bootstrap.Modal(document.getElementById('warningModal'));
    modal.show();
    return false;
  }

  function renderWarningModal(list) {
    var html = '<div class="mb-3"><p class="mb-2 small text-muted">本处方共检测到 <b class="text-herb-red">' + list.length + '</b> 项配伍/剂量问题，请谨慎处理：</p><div class="list-group gap-2">';
    list.forEach(function(w, i) {
      var cls = w.severity === 'danger' ? 'danger' : 'warning';
      var icn = w.severity === 'danger' ? 'bi-exclamation-octagon-fill' : 'bi-exclamation-triangle-fill';
      html += '<div class="list-group-item list-group-item-' + cls + ' border-0 rounded">'
        + '<div class="fw-bold small mb-1"><i class="' + icn + ' me-1"></i>【' + w.type + '】'
        + '</div><div class="small mb-2">' + w.message + '</div><div class="d-flex flex-wrap gap-1">';
      (w.herbs || []).forEach(function(h) {
        html += '<span class="badge bg-' + (w.severity==='danger'?'danger':'warning') + ' text-white px-2 py-1">' + h + '</span>';
      });
      html += '</div></div>';
    });
    html += '</div></div>';
    $('#warningModalBody').html(html);
  }

  function bindModalButtons() {
    $(document).on('click', '#warningCancelBtn', function() {
      pendingConfirmContext = null;
    });
    $(document).on('click', '#warningConfirmBtn', function() {
      var ctx = pendingConfirmContext;
      pendingConfirmContext = null;
      var modal = bootstrap.Modal.getInstance(document.getElementById('warningModal'));
      if (modal) modal.hide();
      if (ctx && ctx.onConfirm) ctx.onConfirm(true);
    });
  }

  function saveAsDraft() {
    if (!currentPrescription) return false;
    AppStore.pushDraft($.extend(true, {}, currentPrescription));
    Toast.success('处方已保存到草稿箱（共' + AppStore.getState(AppStore.KEYS.DRAFTS).length + '张）');
    return true;
  }

  function finalizePrescription() {
    if (!currentPrescription) return false;
    if (!currentPrescription.patientName) { Toast.warning('请填写患者姓名'); return false; }
    if (!currentPrescription.diagnosis) { Toast.warning('请填写诊断/病症'); return false; }
    if (currentPrescription.items.length === 0) { Toast.warning('处方为空，请先添加药材'); return false; }

    var hasDanger = currentPrescription.warnings.some(function(w) { return w.severity === 'danger'; });
    if (hasDanger) {
      confirmWarnings(currentPrescription, function(ok) {
        if (ok) doFinalize(currentPrescription);
      });
      return false;
    }
    doFinalize(currentPrescription);
    return true;
  }

  function doFinalize(p) {
    p.status = '已调配';
    AppStore.savePrescription($.extend(true, {}, p));

    var inv = AppStore.getState(AppStore.KEYS.INVENTORY);
    var store = p.storeId || AppStore.STORES[0];
    p.items.forEach(function(it) {
      var delta = -Math.round(it.dosage * p.totalDose);
      AppStore.updateInventory(store, it.herbId, delta, {
        opName: '处方出库', prescriptionId: p.id, operator: '张药师',
        note: p.patientName + ' 处方' + p.totalDose + '剂'
      });
      AppStore.bumpHerbUsage(it.herbId, it.dosage, p.totalDose);
    });

    p.warnings.forEach(function(w) { AppStore.addWarnLog($.extend(true, {}, w, { prescriptionId: p.id })); });

    AppStore.addFollowup(createFollowupPlan(p));
    AppStore.removeDraft(p.id);
    Toast.success('处方调配完成！已生成7日随访计划，库存已自动扣减。', '调配完成');
    currentPrescription = emptyPrescription();
    setTimeout(function() { window.location.hash = '#/dashboard'; }, 800);
  }

  function createFollowupPlan(p) {
    var days = [];
    var base = Date.now();
    for (var i = 1; i <= 7; i++) {
      days.push({
        day: i,
        scheduledDate: formatDate(base + i * 86400000),
        status: '待随访',
        contactedAt: null,
        reaction: null,
        notes: ''
      });
    }
    return {
      prescriptionId: p.id,
      patientName: p.patientName,
      patientGender: p.patientGender,
      patientAge: p.patientAge,
      diagnosis: p.diagnosis,
      totalDose: p.totalDose,
      herbCount: p.items.length,
      days: days,
      summary: ''
    };
  }

  function current() { return currentPrescription; }
  function setCurrent(p) { currentPrescription = p ? $.extend(true, emptyPrescription(), p) : emptyPrescription(); }

  return {
    emptyPrescription: emptyPrescription,
    validatePrescription: validatePrescription,
    addHerbByObject: addHerbByObject,
    removeItem: removeItem,
    updateItem: updateItem,
    reorderItems: reorderItems,
    saveAsDraft: saveAsDraft,
    finalizePrescription: finalizePrescription,
    confirmWarnings: confirmWarnings,
    createFollowupPlan: createFollowupPlan,
    bindModalButtons: bindModalButtons,
    current: current,
    setCurrent: setCurrent,
    getCategory: function() { return currentCategory; },
    setCategory: function(c) { currentCategory = c; },
    searchTimer: function() { return searchTimer; },
    setSearchTimer: function(t) { searchTimer = t; }
  };
})();

var PrescriptionView = (function() {
  'use strict';

  function renderCategoryTree($container) {
    var html = '<div class="mb-3 search-box"><i class="bi bi-search"></i>'
      + '<input type="text" class="form-control form-control-sm" id="herbSearchInput" placeholder="拼音/正名/别名搜索..."></div>'
      + '<div class="mb-3" id="searchResults" style="display:none"></div>'
      + '<div class="category-tree" id="categoryTree">';
    HerbData.CATEGORIES.forEach(function(cat) {
      html += '<div class="mb-1">'
        + '<div class="category-item" data-cat="' + cat.id + '">'
        + '<i class="bi ' + cat.icon + ' text-herb-green"></i>'
        + '<span class="flex-grow-1 small">' + cat.name + '</span>'
        + '<span class="badge bg-light text-muted small" id="cat-count-' + cat.id + '">0</span>'
        + '</div>'
        + '<div class="ps-4 mt-1 d-none" id="cat-herbs-' + cat.id + '"></div></div>';
    });
    html += '</div>';
    $container.html(html);

    var inv = AppStore.getState(AppStore.KEYS.INVENTORY);
    var store = (AppStore.getState(AppStore.KEYS.SETTINGS) || {}).currentStore || AppStore.STORES[0];

    HerbData.CATEGORIES.forEach(function(cat) {
      var list = HerbData.getByCategory(cat.id);
      $('#cat-count-' + cat.id).text(list.length);
      var sub = '';
      list.slice(0, 30).forEach(function(h) {
        var invRec = inv && inv[store] && inv[store][h.id];
        var low = invRec && invRec.quantity < invRec.safeStock;
        sub += '<div class="herb-list-item" data-herb-id="' + h.id + '">'
          + '<span>' + h.name + '</span>'
          + (h.aliases[0] ? ' <span class="alias-tag">' + h.aliases[0] + '</span>' : '')
          + (low ? ' <span class="badge bg-warning text-white ms-1" style="font-size:.6rem">缺</span>' : '')
          + '</div>';
      });
      if (list.length > 30) {
        sub += '<div class="small text-muted text-center py-2">显示前30味，请搜索查看全部</div>';
      }
      $('#cat-herbs-' + cat.id).html(sub);
    });
  }

  function bindCategoryEvents() {
    $(document).off('click', '.category-item').on('click', '.category-item', function() {
      var catId = $(this).data('cat');
      $('.category-item').removeClass('active');
      $(this).addClass('active');
      var $sub = $('#cat-herbs-' + catId);
      var $siblings = $('[id^=cat-herbs-]').not($sub);
      $siblings.addClass('d-none');
      $sub.toggleClass('d-none');
      PrescriptionEngine.setCategory(catId);
    });

    $(document).off('click', '.herb-list-item, #searchResults .herb-list-item').on('click', '.herb-list-item, #searchResults .herb-list-item', function() {
      var hid = $(this).data('herbId');
      var h = HerbData.getById(hid);
      if (!h) return;
      var res = PrescriptionEngine.addHerbByObject(h);
      if (res.error) { Toast.danger(res.error); return; }
      if (res.duplicate) { Toast.info(res.warning); }
      else { Toast.success('已添加：' + h.name + ' ' + (HerbData.gramsToQianLiang(h.minDose).qian) + '钱起'); }
      renderPrescriptionTable();
      renderValidationPanel();
    });

    $(document).off('input', '#herbSearchInput').on('input', '#herbSearchInput', function() {
      var val = $(this).val();
      var t = PrescriptionEngine.searchTimer();
      if (t) clearTimeout(t);
      PrescriptionEngine.setSearchTimer(setTimeout(function() {
        var results = HerbData.searchHerbs(val);
        var $sr = $('#searchResults');
        if (!val || results.length === 0) {
          $sr.hide().html('');
          $('#categoryTree').show();
          return;
        }
        $('#categoryTree').hide();
        var html = '<div class="d-flex justify-content-between align-items-center mb-2">'
          + '<small class="text-muted">搜索到 <b class="text-herb-green">' + results.length + '</b> 味药材</small>'
          + '<button class="btn btn-sm btn-link p-0 text-decoration-none" id="clearSearch"><i class="bi bi-x-circle me-1"></i>清空</button></div>';
        results.slice(0, 30).forEach(function(h) {
          html += '<div class="herb-list-item" data-herb-id="' + h.id + '">'
            + '<div>'
            + '<span class="me-2">' + h.name + '</span>'
            + '<span class="badge badge-toxicity-' + h.toxicity + '" style="font-size:.6rem">' + h.toxicity + '</span>'
            + ' <span class="badge preg-badge-' + h.pregnancy + '" style="font-size:.6rem">妊' + h.pregnancy + '</span>'
            + '</div>'
            + '<span class="alias-tag text-end">' + (h.pinyin ? h.pinyin.split('|')[0] : '') + '</span>'
            + '</div>';
        });
        if (results.length > 30) {
          html += '<div class="small text-muted text-center py-2">仅显示前30条，请细化关键词</div>';
        }
        $sr.html(html).show();
      }, 120));
    });

    $(document).off('click', '#clearSearch').on('click', '#clearSearch', function() {
      $('#herbSearchInput').val('');
      $('#searchResults').hide();
      $('#categoryTree').show();
    });
  }

  function renderPrescriptionTable($container) {
    var $tbl = $container || $('#prescriptionTableWrap');
    if (!$tbl.length) $tbl = $('#prescriptionTableWrap');
    var p = PrescriptionEngine.current() || PrescriptionEngine.emptyPrescription();
    var warnIdx = {};
    (p.warnings || []).forEach(function(w) {
      (w.items || []).forEach(function(i) { warnIdx[i] = (warnIdx[i] || []).concat([w]); });
    });

    var html = '<div class="table-responsive" style="max-height:55vh; overflow:auto;"><table class="prescription-table">'
      + '<thead><tr><th style="width:32px">序</th>'
      + '<th>药材名称</th><th style="width:220px">剂量（克/钱/两）</th>'
      + '<th style="width:120px">煎法</th><th style="width:160px">备注</th><th style="width:40px"></th></tr></thead><tbody>';

    if (p.items.length === 0) {
      html += '<tr><td colspan="6" class="text-center py-5 text-muted">'
        + '<i class="bi bi-flower1 fs-1 text-herb-green opacity-25 d-block mb-3"></i>'
        + '<p class="mb-1 small">从左侧分类或搜索栏选择药材</p>'
        + '<p class="mb-0 small opacity-75">支持拖拽排序、特殊煎法标注、实时配伍校验</p>'
        + '</td></tr>';
    }

    p.items.forEach(function(it, i) {
      var h = HerbData.getById(it.herbId);
      var hasWarn = warnIdx[i] && warnIdx[i].length > 0;
      var hasDanger = warnIdx[i] && warnIdx[i].some(function(w) { return w.severity === 'danger'; });
      var rowClass = hasDanger ? 'warning-row' : (hasWarn ? 'bg-warning-subtle' : '');
      var convert = HerbData.gramsToQianLiang(it.dosage);
      var methods = HerbData.DECOCTION_METHODS;
      var methodOpts = methods.map(function(m) {
        return '<option value="' + m + '"' + (it.decoction === m ? ' selected' : '') + '>' + (m || '常规煎法') + '</option>';
      }).join('');
      var toxBadge = h ? ' <span class="badge badge-toxicity-' + h.toxicity + '" style="font-size:.55rem">' + h.toxicity + '</span>' : '';
      html += '<tr class="herb-row ' + rowClass + '" draggable="true" data-index="' + i + '">'
        + '<td class="text-muted small">' + (i+1) + '</td>'
        + '<td><span class="fw-medium">' + it.herbName + '</span>' + toxBadge
        + (it.notes ? '<small class="text-muted d-block opacity-75">' + it.notes + '</small>' : '')
        + (hasDanger ? '<div class="mt-1"><span class="badge bg-danger text-white"><i class="bi bi-exclamation-octagon me-1"></i>严重冲突</span></div>'
          : (hasWarn ? '<div class="mt-1"><span class="badge bg-warning text-white"><i class="bi bi-exclamation-triangle me-1"></i>注意</span></div>' : ''))
        + '</td>'
        + '<td>'
        + '<div class="d-flex align-items-center gap-1">'
        + '<button class="step-btn" data-step="-1" data-idx="' + i + '"><i class="bi bi-dash"></i></button>'
        + '<input type="number" class="dose-input" value="' + it.dosage + '" min="0.1" step="0.5" data-idx="' + i + '">'
        + '<button class="step-btn" data-step="1" data-idx="' + i + '"><i class="bi bi-plus"></i></button>'
        + '<span class="small text-muted ps-1">' + convert.qian + '钱/' + convert.liang + '两</span>'
        + '</div></td>'
        + '<td><select class="form-select decoction-select" data-idx="' + i + '">' + methodOpts + '</select></td>'
        + '<td><input type="text" class="form-control form-control-sm" placeholder="备注..." value="' + (it.notes || '') + '" data-note-idx="' + i + '"></td>'
        + '<td><button class="remove-btn" data-remove-idx="' + i + '" title="删除此味"><i class="bi bi-trash3"></i></button></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';

    if (p.items.length > 0) {
      var total = 0;
      p.items.forEach(function(it) { total += (it.dosage || 0); });
      html += '<div class="d-flex justify-content-between align-items-center mt-3 p-3 bg-herb-green-soft rounded">'
        + '<div><span class="small text-muted">共 <b class="text-herb-green-dark fs-6">' + p.items.length + '</b> 味药材，'
        + '处方总量：<b class="font-mono text-herb-green-dark">' + total.toFixed(1) + '</b> 克/剂 × '
        + '<input type="number" class="form-control form-control-sm d-inline-block" id="totalDoseInput" style="width:60px" value="' + p.totalDose + '" min="1" max="30">'
        + ' 剂 = <b class="font-mono fs-5 text-herb-red">' + (total * p.totalDose).toFixed(0) + '</b> 克</span></div>'
        + '<div><span class="small text-muted me-2">特殊煎法统计：</span>';
      var group = {};
      p.items.forEach(function(it) {
        if (it.decoction) { group[it.decoction] = (group[it.decoction] || 0) + 1; }
      });
      var gk = Object.keys(group);
      if (gk.length === 0) html += '<span class="small text-muted">无</span>';
      else {
        gk.forEach(function(k) {
          html += '<span class="badge bg-info text-white me-1">' + k + ' × ' + group[k] + '</span>';
        });
      }
      html += '</div></div>';
    }
    $tbl.html(html);
    bindTableEvents();
  }

  function bindTableEvents() {
    $(document).off('click', '.step-btn').on('click', '.step-btn', function() {
      var idx = parseInt($(this).data('idx'), 10);
      var step = parseFloat($(this).data('step'));
      var $inp = $('input.dose-input[data-idx=' + idx + ']');
      var cur = parseFloat($inp.val()) || 0;
      var newVal = Math.max(0.1, Math.round((cur + step * 0.5) * 10) / 10);
      $inp.val(newVal);
      PrescriptionEngine.updateItem(idx, { dosage: newVal });
      renderPrescriptionTable();
      renderValidationPanel();
    });

    $(document).off('change input', 'input.dose-input').on('change input', 'input.dose-input', function() {
      var idx = parseInt($(this).data('idx'), 10);
      var v = parseFloat($(this).val());
      if (isNaN(v) || v <= 0) v = 0.1;
      PrescriptionEngine.updateItem(idx, { dosage: v });
      if (event.type === 'change') { renderPrescriptionTable(); renderValidationPanel(); }
    });

    $(document).off('change', 'select.decoction-select').on('change', 'select.decoction-select', function() {
      var idx = parseInt($(this).data('idx'), 10);
      PrescriptionEngine.updateItem(idx, { decoction: $(this).val() });
      renderPrescriptionTable();
    });

    $(document).off('change input', '[data-note-idx]').on('change', '[data-note-idx]', function() {
      var idx = parseInt($(this).data('note-idx'), 10);
      PrescriptionEngine.updateItem(idx, { notes: $(this).val() });
    });

    $(document).off('change', '#totalDoseInput').on('change', '#totalDoseInput', function() {
      var v = parseInt($(this).val(), 10);
      if (isNaN(v) || v <= 0) v = 1;
      var p = PrescriptionEngine.current();
      if (p) p.totalDose = v;
      renderPrescriptionTable();
    });

    $(document).off('click', '[data-remove-idx]').on('click', '[data-remove-idx]', function() {
      var idx = parseInt($(this).data('remove-idx'), 10);
      PrescriptionEngine.removeItem(idx);
      Toast.info('已删除第' + (idx+1) + '味药材');
      renderPrescriptionTable();
      renderValidationPanel();
    });

    bindDragEvents();
  }

  var dragFromIdx = null;
  function bindDragEvents() {
    $(document).off('dragstart', '.herb-row').on('dragstart', '.herb-row', function(e) {
      dragFromIdx = parseInt($(this).data('index'), 10);
      $(this).addClass('dragging');
      try { e.originalEvent.dataTransfer.effectAllowed = 'move'; } catch(_) {}
    });
    $(document).off('dragend', '.herb-row').on('dragend', '.herb-row', function(e) {
      $(this).removeClass('dragging');
      $('.herb-row').removeClass('drag-over');
    });
    $(document).off('dragover dragenter', '.herb-row').on('dragover dragenter', '.herb-row', function(e) {
      e.preventDefault();
      $('.herb-row').removeClass('drag-over');
      $(this).addClass('drag-over');
    });
    $(document).off('dragleave', '.herb-row').on('dragleave', '.herb-row', function() {
      $(this).removeClass('drag-over');
    });
    $(document).off('drop', '.herb-row').on('drop', '.herb-row', function(e) {
      e.preventDefault();
      var to = parseInt($(this).data('index'), 10);
      if (dragFromIdx !== null && dragFromIdx !== to) {
        PrescriptionEngine.reorderItems(dragFromIdx, to);
        renderPrescriptionTable();
        renderValidationPanel();
      }
      dragFromIdx = null;
      $('.herb-row').removeClass('drag-over dragging');
    });
  }

  function renderValidationPanel($container) {
    var $panel = $container || $('#validationPanel');
    if (!$panel.length) return;
    var p = PrescriptionEngine.current();
    var html = '';
    if (!p || p.items.length === 0) {
      html = '<div class="text-center text-muted py-5">'
        + '<i class="bi bi-shield-check fs-2 d-block mb-3 text-herb-green opacity-50"></i>'
        + '<p class="small mb-0">添加药材后将在此处实时显示<br>配伍禁忌、妊娠分级与剂量提醒</p></div>';
    } else {
      var wl = p.warnings || [];
      var danger = wl.filter(function(w) { return w.severity === 'danger'; }).length;
      var warn = wl.length - danger;
      html = '<div class="d-flex gap-2 mb-3">'
        + '<span class="badge bg-' + (danger > 0 ? 'danger' : 'secondary') + '">'
        + '<i class="bi bi-exclamation-octagon me-1"></i>严重 ' + danger + '</span>'
        + '<span class="badge bg-' + (warn > 0 ? 'warning' : 'secondary') + '">'
        + '<i class="bi bi-exclamation-triangle me-1"></i>提醒 ' + warn + '</span>'
        + '<span class="badge bg-success ms-auto text-white"><i class="bi bi-clipboard-check me-1"></i>共' + p.items.length + '味</span>'
        + '</div><div class="validation-panel">';
      if (wl.length === 0) {
        html += '<div class="card bg-success-subtle border-success-subtle">'
          + '<div class="card-body text-center py-3">'
          + '<i class="bi bi-patch-check fs-2 text-success d-block mb-2"></i>'
          + '<p class="mb-0 small fw-medium text-success">处方校验通过，未发现配伍禁忌</p>'
          + '<small class="opacity-75">请确认用量与适应症</small></div></div>';
      } else {
        wl.forEach(function(w, i) {
          html += '<div class="warn-item ' + w.severity + '">'
            + '<div class="warn-title"><i class="bi bi-' + (w.severity==='danger'?'exclamation-octagon-fill':'exclamation-triangle-fill') + ' me-1"></i>'
            + '【' + w.type + '】</div>'
            + '<div class="warn-msg">' + w.message + '</div>'
            + '<div class="warn-herbs">';
          (w.herbs || []).forEach(function(h) {
            html += '<span class="warn-tag">' + h + '</span>';
          });
          html += '</div></div>';
        });
      }
      html += '</div>';
    }
    $panel.html(html);
  }

  function renderPatientHeader() {
    var p = PrescriptionEngine.current();
    if (!p) return '';
    return '<div class="row g-3 mb-3">'
      + '<div class="col-md-3"><label class="form-label small text-muted mb-1">患者姓名</label>'
      + '<input type="text" class="form-control" id="patientName" placeholder="请输入姓名" value="' + p.patientName + '"></div>'
      + '<div class="col-md-2"><label class="form-label small text-muted mb-1">性别</label>'
      + '<select class="form-select" id="patientGender">'
      + '<option' + (p.patientGender === '男' ? ' selected' : '') + '>男</option>'
      + '<option' + (p.patientGender === '女' ? ' selected' : '') + '>女</option>'
      + '</select></div>'
      + '<div class="col-md-2"><label class="form-label small text-muted mb-1">年龄</label>'
      + '<input type="number" class="form-control" id="patientAge" min="0" max="120" value="' + p.patientAge + '"></div>'
      + '<div class="col-md-2"><label class="form-label small text-muted mb-1">所属门店</label>'
      + '<select class="form-select" id="storeSelect">'
      + AppStore.STORES.map(function(s) { return '<option' + (s === p.storeId ? ' selected' : '') + '>' + s + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="col-md-3 pt-md-4">'
      + '<div class="form-check form-check-inline mt-2">'
      + '<input class="form-check-input" type="checkbox" id="isPregnant" ' + (p.isPregnant ? 'checked' : '') + '>'
      + '<label class="form-check-label text-danger small" for="isPregnant"><i class="bi bi-person-standing-dress me-1"></i>妊娠/备孕中</label></div></div>'
      + '<div class="col-md-12"><label class="form-label small text-muted mb-1">诊断 / 病症（含辨证）</label>'
      + '<input type="text" class="form-control" id="diagnosis" placeholder="例：风寒感冒 表实证" value="' + p.diagnosis + '"></div>'
      + '</div>';
  }

  function bindPatientEvents() {
    $(document).off('change input', '#patientName').on('change', '#patientName', function() {
      if (PrescriptionEngine.current()) PrescriptionEngine.current().patientName = $(this).val();
    });
    $(document).off('change', '#patientGender').on('change', '#patientGender', function() {
      if (PrescriptionEngine.current()) PrescriptionEngine.current().patientGender = $(this).val();
    });
    $(document).off('change input', '#patientAge').on('change', '#patientAge', function() {
      if (PrescriptionEngine.current()) PrescriptionEngine.current().patientAge = parseInt($(this).val(), 10) || 0;
    });
    $(document).off('change', '#storeSelect').on('change', '#storeSelect', function() {
      if (PrescriptionEngine.current()) PrescriptionEngine.current().storeId = $(this).val();
    });
    $(document).off('change', '#isPregnant').on('change', '#isPregnant', function() {
      var p = PrescriptionEngine.current();
      if (p) {
        p.isPregnant = $(this).is(':checked');
        PrescriptionEngine.validatePrescription(p);
        renderPrescriptionTable();
        renderValidationPanel();
      }
    });
    $(document).off('change input', '#diagnosis').on('change', '#diagnosis', function() {
      if (PrescriptionEngine.current()) PrescriptionEngine.current().diagnosis = $(this).val();
    });
  }

  function renderMobileControls() {
    if ($('.mobile-herb-picker-btn').length > 0) return;
    var html = ''
      + '<button class="mobile-herb-picker-btn mobile-only" id="mobileHerbPickerBtn" title="选择药材">'
      + '<i class="bi bi-plus-lg"></i></button>'
      + '<button class="mobile-validation-btn mobile-only" id="mobileValidationBtn" title="配伍校验">'
      + '<i class="bi bi-shield-exclamation"></i>'
      + '<span class="badge" id="mobileValidationBadge">0</span></button>'
      + '<div class="drawer-backdrop" id="drawerBackdrop"></div>'
      + '<div class="bottom-drawer" id="herbPickerDrawer">'
      + '  <div class="drawer-header">'
      + '    <div class="flex-grow-1"><b>选择药材</b></div>'
      + '    <button class="btn btn-sm btn-link p-0" id="closeHerbDrawer"><i class="bi bi-x-lg"></i></button>'
      + '  </div>'
      + '  <div class="drawer-body">'
      + '    <div class="mb-3"><input type="text" class="form-control" id="mobileHerbSearch" placeholder="搜索药材..."></div>'
      + '    <div class="cascade-picker" id="cascadePicker">'
      + '      <div class="picker-col" id="pickerCatCol"></div>'
      + '      <div class="picker-col" id="pickerHerbCol"></div>'
      + '    </div>'
      + '  </div>'
      + '</div>'
      + '<div class="bottom-drawer" id="validationDrawer">'
      + '  <div class="drawer-header">'
      + '    <div class="flex-grow-1"><b>配伍校验结果</b></div>'
      + '    <button class="btn btn-sm btn-link p-0" id="closeValidationDrawer"><i class="bi bi-x-lg"></i></button>'
      + '  </div>'
      + '  <div class="drawer-body" id="validationDrawerBody"></div>'
      + '</div>';
    $('body').append(html);
  }

  function renderCascadeCategories() {
    var html = '';
    HerbData.CATEGORIES.forEach(function(cat) {
      html += '<div class="picker-item" data-cat="' + cat.id + '">'
        + '<span>' + cat.name + '</span>'
        + ' <span class="small text-muted">(' + HerbData.getByCategory(cat.id).length + ')</span>'
        + '</div>';
    });
    $('#pickerCatCol').html(html);
  }

  function renderCascadeHerbs(catId) {
    var list = HerbData.getByCategory(catId);
    var html = '';
    list.slice(0, 50).forEach(function(h) {
      html += '<div class="picker-item" data-herb-id="' + h.id + '">'
        + '<span>' + h.name + '</span>'
        + (h.aliases[0] ? ' <span class="small text-muted">' + h.aliases[0] + '</span>' : '')
        + '</div>';
    });
    if (list.length > 50) {
      html += '<div class="picker-item text-muted small text-center">仅显示前50味，请搜索</div>';
    }
    $('#pickerHerbCol').html(html);
  }

  function openDrawer(drawerId) {
    $('#' + drawerId).addClass('show');
    $('#drawerBackdrop').addClass('show');
  }

  function closeDrawer(drawerId) {
    $('#' + drawerId).removeClass('show');
    if (!$('.bottom-drawer.show').length) {
      $('#drawerBackdrop').removeClass('show');
    }
  }

  function bindMobileEvents() {
    renderMobileControls();
    renderCascadeCategories();
    var defaultCat = HerbData.CATEGORIES[0] ? HerbData.CATEGORIES[0].id : '';
    renderCascadeHerbs(defaultCat);
    $('#pickerCatCol .picker-item:first').addClass('active');

    $(document).off('click', '#mobileHerbPickerBtn').on('click', '#mobileHerbPickerBtn', function() {
      openDrawer('herbPickerDrawer');
    });

    $(document).off('click', '#mobileValidationBtn').on('click', '#mobileValidationBtn', function() {
      renderValidationDrawer();
      openDrawer('validationDrawer');
    });

    $(document).off('click', '#closeHerbDrawer, #drawerBackdrop').on('click', '#closeHerbDrawer, #drawerBackdrop', function() {
      closeDrawer('herbPickerDrawer');
      closeDrawer('validationDrawer');
    });

    $(document).off('click', '#closeValidationDrawer').on('click', '#closeValidationDrawer', function() {
      closeDrawer('validationDrawer');
    });

    $(document).off('click', '#pickerCatCol .picker-item').on('click', '#pickerCatCol .picker-item', function() {
      var catId = $(this).data('cat');
      $('#pickerCatCol .picker-item').removeClass('active');
      $(this).addClass('active');
      renderCascadeHerbs(catId);
    });

    $(document).off('click', '#pickerHerbCol .picker-item').on('click', '#pickerHerbCol .picker-item', function() {
      var hid = $(this).data('herbId');
      var h = HerbData.getById(hid);
      if (!h) return;
      var res = PrescriptionEngine.addHerbByObject(h);
      if (res.error) { Toast.danger(res.error); return; }
      if (res.duplicate) { Toast.info(res.warning); }
      else { Toast.success('已添加：' + h.name); }
      renderPrescriptionTable();
      renderValidationPanel();
      updateMobileValidationBadge();
      closeDrawer('herbPickerDrawer');
    });

    $(document).off('input', '#mobileHerbSearch').on('input', '#mobileHerbSearch', function() {
      var val = $(this).val().trim();
      if (!val) {
        var activeCat = $('#pickerCatCol .picker-item.active').data('cat');
        renderCascadeHerbs(activeCat);
        return;
      }
      var results = HerbData.searchHerbs(val);
      var html = '';
      results.slice(0, 50).forEach(function(h) {
        html += '<div class="picker-item" data-herb-id="' + h.id + '">'
          + '<span>' + h.name + '</span>'
          + (h.aliases[0] ? ' <span class="small text-muted">' + h.aliases[0] + '</span>' : '')
          + '</div>';
      });
      if (html === '') html = '<div class="picker-item text-muted small text-center">未找到相关药材</div>';
      $('#pickerHerbCol').html(html);
    });
  }

  function renderValidationDrawer() {
    var p = PrescriptionEngine.current();
    var result = PrescriptionEngine.validatePrescription(p);
    var warnings = result.warnings || [];
    var html = '';
    if (warnings.length === 0) {
      html = '<div class="text-center py-4">'
        + '<i class="bi bi-check-circle-fill text-success" style="font-size:3rem"></i>'
        + '<p class="mt-3 text-muted">处方校验通过，无配伍禁忌</p></div>';
    } else {
      warnings.forEach(function(w, i) {
        var severityClass = w.severity === 'danger' ? 'danger' : (w.severity === 'warning' ? 'warning' : 'info');
        var icon = w.severity === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';
        html += '<div class="alert alert-' + severityClass + ' mb-2 small" role="alert">'
          + '<i class="bi ' + icon + ' me-1"></i>'
          + '<b>' + (w.type || '提示') + '</b>'
          + (w.message ? '<div class="mt-1 opacity-80">' + w.message + '</div>' : '')
          + '</div>';
      });
    }
    $('#validationDrawerBody').html(html);
  }

  function updateMobileValidationBadge() {
    var p = PrescriptionEngine.current();
    var result = PrescriptionEngine.validatePrescription(p);
    var count = (result.warnings || []).length;
    var $badge = $('#mobileValidationBadge');
    if (count > 0) {
      $badge.text(count).show();
    } else {
      $badge.hide();
    }
  }

  return {
    renderCategoryTree: renderCategoryTree,
    bindCategoryEvents: bindCategoryEvents,
    renderPrescriptionTable: renderPrescriptionTable,
    renderValidationPanel: renderValidationPanel,
    renderPatientHeader: renderPatientHeader,
    bindPatientEvents: bindPatientEvents,
    bindMobileEvents: bindMobileEvents,
    updateMobileValidationBadge: updateMobileValidationBadge
  };
})();
