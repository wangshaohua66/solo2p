var AppStore = (function() {
  'use strict';

  var STORAGE_KEYS = {
    DRAFTS: 'bczf_drafts',
    INVENTORY: 'bczf_inventory',
    STOCK_LOGS: 'bczf_stock_logs',
    FOLLOWUPS: 'bczf_followups',
    TEMPLATES: 'bczf_templates',
    PRESCRIPTIONS: 'bczf_prescriptions',
    STATS: 'bczf_stats',
    SETTINGS: 'bczf_settings',
    WARN_LOG: 'bczf_warnlog',
    WARN_LOGS: 'bczf_warnlog',
    HERB_USAGE: 'bczf_herb_usage'
  };

  var STORES = ['同仁堂总店', '同仁堂·分店A', '同仁堂·分店B'];
  var DEFAULTS = {};

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function initInventory() {
    var inv = {};
    STORES.forEach(function(sid) {
      inv[sid] = {};
      HerbData.HERBS.slice(0, 620).forEach(function(h) {
        var baseStock = 500 + Math.floor(Math.random() * 10000);
        var safeStock = h.maxDose * 50;
        var today = new Date();
        var expMonths = 12 + Math.floor(Math.random() * 36);
        today.setMonth(today.getMonth() + expMonths);
        inv[sid][h.id] = {
          herbId: h.id,
          storeId: sid,
          quantity: baseStock,
          safeStock: safeStock,
          expiryDate: today.toISOString().slice(0, 10),
          batchNo: 'B' + Math.random().toString(36).slice(2, 10).toUpperCase(),
          lastUpdated: Date.now()
        };
      });
    });
    return inv;
  }

  function initStockLogs() {
    var logs = [];
    var ops = ['采购入库', '盘盈入库', '处方出库', '门店调入', '门店调出', '损耗'];
    for (var i = 0; i < 80; i++) {
      var opType = ops[Math.floor(Math.random() * ops.length)];
      var isOut = ['处方出库', '门店调出', '损耗'].indexOf(opType) !== -1;
      var h = HerbData.HERBS[Math.floor(Math.random() * 300)];
      var qty = 5 + Math.floor(Math.random() * 200);
      logs.push({
        id: uid('log'),
        type: isOut ? 'out' : 'in',
        opName: opType,
        herbId: h.id,
        herbName: h.name,
        storeId: STORES[Math.floor(Math.random() * STORES.length)],
        quantity: qty,
        operator: ['张药师','李药师','王店长'][Math.floor(Math.random()*3)],
        timestamp: Date.now() - Math.floor(Math.random() * 30 * 86400 * 1000),
        note: opType + ' ' + h.name + ' ' + qty + 'g'
      });
    }
    return logs.sort(function(a, b) { return b.timestamp - a.timestamp; });
  }

  function initTemplates() {
    var tpl = [
      {
        id: uid('tpl'), name: '感冒风寒表实证', category: '解表', diagnosis: '风寒感冒',
        items: [
          { herbId: 'H0001', herbName: '麻黄', dosage: 9, unit: '克', decoction: '后下', notes: '' },
          { herbId: 'H0002', herbName: '桂枝', dosage: 6, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0317', herbName: '苦杏仁', dosage: 9, unit: '克', decoction: '打碎入煎', notes: '' },
          { herbId: 'H0230', herbName: '甘草', dosage: 3, unit: '克', decoction: '', notes: '' }
        ], totalDose: 3, createdAt: Date.now()
      },
      {
        id: uid('tpl'), name: '四君子汤(补气基础)', category: '补益', diagnosis: '脾胃气虚',
        items: [
          { herbId: 'H0222', herbName: '人参', dosage: 9, unit: '克', decoction: '另煎', notes: '' },
          { herbId: 'H0227', herbName: '白术', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0091', herbName: '茯苓', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0230', herbName: '甘草', dosage: 6, unit: '克', decoction: '', notes: '' }
        ], totalDose: 5, createdAt: Date.now()
      },
      {
        id: uid('tpl'), name: '四物汤(补血基础)', category: '补益', diagnosis: '营血虚滞',
        items: [
          { herbId: 'H0237', herbName: '当归', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0239', herbName: '白芍', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0240', herbName: '赤芍', dosage: 6, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0165', herbName: '牛膝', dosage: 6, unit: '克', decoction: '', notes: '' }
        ], totalDose: 7, createdAt: Date.now()
      },
      {
        id: uid('tpl'), name: '银翘散(风热感冒)', category: '清热', diagnosis: '温病初起',
        items: [
          { herbId: 'H0038', herbName: '金银花', dosage: 15, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0039', herbName: '连翘', dosage: 15, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0015', herbName: '薄荷', dosage: 6, unit: '克', decoction: '后下', notes: '' },
          { herbId: 'H0020', herbName: '菊花', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0017', herbName: '蝉蜕', dosage: 6, unit: '克', decoction: '', notes: '' }
        ], totalDose: 3, createdAt: Date.now()
      },
      {
        id: uid('tpl'), name: '二陈汤(化痰基础)', category: '化痰', diagnosis: '湿痰证',
        items: [
          { herbId: 'H0175', herbName: '半夏', dosage: 9, unit: '克', decoction: '', notes: '制用' },
          { herbId: 'H0116', herbName: '陈皮', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0091', herbName: '茯苓', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0230', herbName: '甘草', dosage: 4.5, unit: '克', decoction: '', notes: '' }
        ], totalDose: 5, createdAt: Date.now()
      },
      {
        id: uid('tpl'), name: '八珍汤(气血双补)', category: '补益', diagnosis: '气血两虚',
        items: [
          { herbId: 'H0222', herbName: '人参', dosage: 6, unit: '克', decoction: '另煎', notes: '' },
          { herbId: 'H0227', herbName: '白术', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0091', herbName: '茯苓', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0237', herbName: '当归', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0238', herbName: '熟地黄', dosage: 12, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0239', herbName: '白芍', dosage: 9, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0154', herbName: '川芎', dosage: 6, unit: '克', decoction: '', notes: '' },
          { herbId: 'H0230', herbName: '甘草', dosage: 5, unit: '克', decoction: '', notes: '' }
        ], totalDose: 7, createdAt: Date.now()
      }
    ];
    return tpl;
  }

  function initSamplePrescriptions() {
    var res = [];
    var diags = ['风寒感冒', '风热咳嗽', '脾胃虚弱', '失眠多梦', '高血压调理', '痛经调理', '慢性胃炎', '更年期综合征'];
    var names = ['张三','李四','王五','赵六','钱七','孙八','周九','吴十','郑十一','冯十二'];
    for (var i = 0; i < 15; i++) {
      var nItems = 6 + Math.floor(Math.random() * 10);
      var items = [];
      var used = {};
      for (var j = 0; j < nItems; j++) {
        var h = HerbData.HERBS[Math.floor(Math.random() * 300)];
        if (used[h.id]) continue;
        used[h.id] = true;
        items.push({
          herbId: h.id, herbName: h.name,
          dosage: Math.round((h.minDose + Math.random() * (h.maxDose - h.minDose)) * 10) / 10,
          unit: '克', decoction: h.specialMethods[0] || '', notes: ''
        });
      }
      var pname = names[i % names.length];
      res.push({
        id: uid('rx'),
        patientName: pname,
        patientGender: Math.random() > 0.5 ? '男' : '女',
        patientAge: 25 + Math.floor(Math.random() * 60),
        isPregnant: false,
        diagnosis: diags[i % diags.length],
        items: items,
        totalDose: 3 + Math.floor(Math.random() * 8),
        createdAt: Date.now() - Math.floor(Math.random() * 30 * 86400 * 1000),
        updatedAt: Date.now() - Math.floor(Math.random() * 25 * 86400 * 1000),
        status: ['已调配','已发药','草稿'][Math.floor(Math.random()*3)],
        warnings: [],
        storeId: STORES[Math.floor(Math.random() * STORES.length)]
      });
    }
    return res.sort(function(a, b) { return b.createdAt - a.createdAt; });
  }

  function initWarnLog() {
    var types = ['十八反','十九畏','妊娠禁用','妊娠慎用','剂量超限','别名重复'];
    var logs = [];
    for (var i = 0; i < 40; i++) {
      logs.push({
        id: uid('wl'),
        type: types[Math.floor(Math.random() * types.length)],
        severity: Math.random() > 0.5 ? 'danger' : 'warning',
        herbs: [],
        message: '',
        prescriptionId: '',
        timestamp: Date.now() - Math.floor(Math.random() * 30 * 86400 * 1000)
      });
    }
    return logs;
  }

  function initHerbUsage() {
    var usage = {};
    HerbData.HERBS.slice(0, 100).forEach(function(h) {
      var c = Math.floor(Math.random() * 500) + 20;
      usage[h.id] = { count: c, totalDose: Math.floor(c * (Math.random() * 10 + 6)) };
    });
    return usage;
  }

  DEFAULTS[STORAGE_KEYS.DRAFTS] = [];
  DEFAULTS[STORAGE_KEYS.INVENTORY] = initInventory;
  DEFAULTS[STORAGE_KEYS.STOCK_LOGS] = initStockLogs;
  DEFAULTS[STORAGE_KEYS.FOLLOWUPS] = [];
  DEFAULTS[STORAGE_KEYS.TEMPLATES] = initTemplates;
  DEFAULTS[STORAGE_KEYS.PRESCRIPTIONS] = initSamplePrescriptions;
  DEFAULTS[STORAGE_KEYS.WARN_LOG] = initWarnLog;
  DEFAULTS[STORAGE_KEYS.HERB_USAGE] = initHerbUsage;
  DEFAULTS[STORAGE_KEYS.SETTINGS] = { currentStore: STORES[0], maxDrafts: 20 };

  var listeners = {};
  var debounceTimers = {};

  function getDefault(key) {
    var d = DEFAULTS[key];
    if (typeof d === 'function') return d();
    return d;
  }

  function loadKey(key) {
    try {
      var v = store.get(key);
      if (v === undefined || v === null) {
        v = getDefault(key);
        store.set(key, v);
      }
      return v;
    } catch (e) {
      console.warn('[Store] load key failed', key, e);
      return getDefault(key);
    }
  }

  function saveKey(key) {
    try {
      var data = state[key];
      store.set(key, data);
    } catch (e) {
      console.error('[Store] save failed', key, e);
    }
  }

  function debouncedSave(key, delay) {
    if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(function() { saveKey(key); }, delay || 300);
  }

  var state = {};
  function initState() {
    for (var k in STORAGE_KEYS) {
      if (STORAGE_KEYS.hasOwnProperty(k)) {
        state[STORAGE_KEYS[k]] = loadKey(STORAGE_KEYS[k]);
      }
    }
    var usage = state[STORAGE_KEYS.HERB_USAGE] || {};
    var keys = Object.keys(usage);
    if (keys.length > 0 && typeof usage[keys[0]] === 'number') {
      state[STORAGE_KEYS.HERB_USAGE] = getDefault(STORAGE_KEYS.HERB_USAGE);
      saveKey(STORAGE_KEYS.HERB_USAGE);
    }
  }

  function emit(key, payload) {
    (listeners[key] || []).forEach(function(fn) {
      try { fn(payload); } catch (e) { console.error(e); }
    });
  }

  function subscribe(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
    return function() {
      listeners[key] = (listeners[key] || []).filter(function(f) { return f !== fn; });
    };
  }

  function getState(key) {
    return state[key];
  }

  function setState(key, value, opts) {
    state[key] = value;
    emit(key, value);
    if (!(opts && opts.noPersist)) debouncedSave(key, opts && opts.delay);
  }

  function pushDraft(p) {
    var drafts = state[STORAGE_KEYS.DRAFTS].slice();
    var max = (state[STORAGE_KEYS.SETTINGS] || {}).maxDrafts || 20;
    var existing = drafts.findIndex(function(d) { return d.id === p.id; });
    if (existing >= 0) {
      drafts[existing] = p;
      drafts[existing].updatedAt = Date.now();
    } else {
      drafts.unshift(p);
      while (drafts.length > max) drafts.pop();
    }
    setState(STORAGE_KEYS.DRAFTS, drafts);
    return drafts;
  }

  function removeDraft(id) {
    var drafts = state[STORAGE_KEYS.DRAFTS].filter(function(d) { return d.id !== id; });
    setState(STORAGE_KEYS.DRAFTS, drafts);
    return drafts;
  }

  function getDraft(id) {
    return (state[STORAGE_KEYS.DRAFTS] || []).find(function(d) { return d.id === id; });
  }

  function peekDraft() {
    var d = state[STORAGE_KEYS.DRAFTS] || [];
    return d.length > 0 ? d[0] : null;
  }

  function savePrescription(p) {
    var list = state[STORAGE_KEYS.PRESCRIPTIONS].slice();
    p.updatedAt = Date.now();
    var idx = list.findIndex(function(x) { return x.id === p.id; });
    if (idx >= 0) list[idx] = p; else list.unshift(p);
    setState(STORAGE_KEYS.PRESCRIPTIONS, list);
    return p;
  }

  function addStockLog(log) {
    var logs = state[STORAGE_KEYS.STOCK_LOGS].slice();
    log.id = log.id || uid('log');
    log.timestamp = log.timestamp || Date.now();
    logs.unshift(log);
    setState(STORAGE_KEYS.STOCK_LOGS, logs.slice(0, 1000));
    return log;
  }

  function updateInventory(storeId, herbId, delta, meta) {
    var inv = state[STORAGE_KEYS.INVENTORY];
    if (!inv[storeId]) inv[storeId] = {};
    if (!inv[storeId][herbId]) {
      var h = HerbData.getById(herbId);
      inv[storeId][herbId] = {
        herbId: herbId, storeId: storeId, quantity: 0,
        safeStock: h ? h.maxDose * 30 : 1000,
        expiryDate: new Date(Date.now() + 365*86400000).toISOString().slice(0,10),
        batchNo: 'B' + Date.now().toString(36).toUpperCase(),
        lastUpdated: Date.now()
      };
    }
    inv[storeId][herbId].quantity = Math.max(0, inv[storeId][herbId].quantity + delta);
    inv[storeId][herbId].lastUpdated = Date.now();
    if (meta && meta.expiryDate) inv[storeId][herbId].expiryDate = meta.expiryDate;
    if (meta && meta.batchNo) inv[storeId][herbId].batchNo = meta.batchNo;
    if (meta && meta.safeStock) inv[storeId][herbId].safeStock = meta.safeStock;
    setState(STORAGE_KEYS.INVENTORY, inv);
    addStockLog({
      type: delta > 0 ? 'in' : 'out',
      opName: delta > 0 ? (meta && meta.opName || '手动入库') : (meta && meta.opName || '手动出库'),
      herbId: herbId,
      herbName: (HerbData.getById(herbId) || {}).name || '',
      storeId: storeId,
      quantity: Math.abs(delta),
      relatedPrescriptionId: meta && meta.prescriptionId,
      operator: meta && meta.operator || '系统',
      note: meta && meta.note || ''
    });
    return inv[storeId][herbId];
  }

  function addFollowup(plan) {
    var list = state[STORAGE_KEYS.FOLLOWUPS].slice();
    plan.id = plan.id || uid('fu');
    plan.createdAt = plan.createdAt || Date.now();
    list.unshift(plan);
    setState(STORAGE_KEYS.FOLLOWUPS, list);
    return plan;
  }

  function updateFollowup(id, patch) {
    var list = state[STORAGE_KEYS.FOLLOWUPS].slice();
    var idx = list.findIndex(function(f) { return f.id === id; });
    if (idx >= 0) {
      list[idx] = $.extend(true, {}, list[idx], patch);
      setState(STORAGE_KEYS.FOLLOWUPS, list);
      return list[idx];
    }
    return null;
  }

  function addTemplate(tpl) {
    var list = state[STORAGE_KEYS.TEMPLATES].slice();
    tpl.id = tpl.id || uid('tpl');
    tpl.createdAt = tpl.createdAt || Date.now();
    list.unshift(tpl);
    setState(STORAGE_KEYS.TEMPLATES, list);
    return tpl;
  }

  function removeTemplate(id) {
    var list = state[STORAGE_KEYS.TEMPLATES].filter(function(t) { return t.id !== id; });
    setState(STORAGE_KEYS.TEMPLATES, list);
    return list;
  }

  function addWarnLog(item) {
    var list = state[STORAGE_KEYS.WARN_LOG].slice();
    item.id = uid('wl');
    item.timestamp = item.timestamp || Date.now();
    list.unshift(item);
    setState(STORAGE_KEYS.WARN_LOG, list.slice(0, 500));
    return item;
  }

  function bumpHerbUsage(herbId, dosage, doseCount) {
    var u = $.extend(true, {}, state[STORAGE_KEYS.HERB_USAGE]);
    if (!u[herbId]) u[herbId] = { count: 0, totalDose: 0 };
    u[herbId].count = (u[herbId].count || 0) + 1;
    u[herbId].totalDose = (u[herbId].totalDose || 0) + ((dosage || 0) * (doseCount || 1));
    setState(STORAGE_KEYS.HERB_USAGE, u);
  }

  function getStorageUsage() {
    try {
      var total = 0;
      for (var k in STORAGE_KEYS) {
        var v = store.get(STORAGE_KEYS[k]);
        if (v) total += JSON.stringify(v).length * 2;
      }
      var MAX = 5 * 1024 * 1024;
      return {
        bytes: total,
        mb: +(total / 1024 / 1024).toFixed(2),
        usedKB: +(total / 1024).toFixed(2),
        percent: +Math.min(100, (total / MAX) * 100).toFixed(1)
      };
    } catch (e) {
      return { bytes: 0, mb: 0, usedKB: 0, percent: 0 };
    }
  }

  function forceFlush() {
    for (var k in debounceTimers) {
      if (debounceTimers[k]) clearTimeout(debounceTimers[k]);
      saveKey(k);
    }
  }

  function resetAll() {
    for (var k in STORAGE_KEYS) {
      store.remove(STORAGE_KEYS[k]);
    }
    initState();
  }

  initState();

  return {
    KEYS: STORAGE_KEYS,
    STORES: STORES,
    init: initState,
    uid: uid,
    getState: getState,
    setState: setState,
    subscribe: subscribe,
    pushDraft: pushDraft,
    removeDraft: removeDraft,
    getDraft: getDraft,
    peekDraft: peekDraft,
    savePrescription: savePrescription,
    addStockLog: addStockLog,
    updateInventory: updateInventory,
    addFollowup: addFollowup,
    updateFollowup: updateFollowup,
    addTemplate: addTemplate,
    removeTemplate: removeTemplate,
    addWarnLog: addWarnLog,
    bumpHerbUsage: bumpHerbUsage,
    getStorageUsage: getStorageUsage,
    forceFlush: forceFlush,
    resetAll: resetAll
  };
})();
