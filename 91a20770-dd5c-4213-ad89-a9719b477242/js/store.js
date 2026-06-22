/* store.js — localStorage 数据存取层 + 发布订阅 + 防抖写入 + 种子数据 */
(function (global) {
  "use strict";

  var PREFIX = "ess_";
  var DEBOUNCE_MS = 300;
  var WRITE_QUEUE = {};
  var subscribers = {};
  var memoryCache = {};

  function _key(name) { return PREFIX + name; }

  function _read(name) {
    if (name in memoryCache) return memoryCache[name];
    var raw = null;
    try { raw = localStorage.getItem(_key(name)); } catch (e) { raw = null; }
    var parsed = raw ? JSON.parse(raw) : null;
    memoryCache[name] = parsed;
    return parsed;
  }

  function _flush(name) {
    var val = memoryCache[name];
    try { localStorage.setItem(_key(name), JSON.stringify(val)); } catch (e) { console.warn("存储写入失败", e); }
    _notify(name);
  }

  function _scheduleWrite(name) {
    if (WRITE_QUEUE[name]) clearTimeout(WRITE_QUEUE[name]);
    WRITE_QUEUE[name] = setTimeout(function () {
      _flush(name);
      WRITE_QUEUE[name] = null;
    }, DEBOUNCE_MS);
  }

  function _notify(name) {
    var cbs = subscribers[name];
    if (!cbs) return;
    var data = memoryCache[name];
    cbs.forEach(function (cb) { try { cb(data); } catch (e) { console.error(e); } });
  }

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var Store = {
    KEYS: {
      stores: "stores", customers: "customers", optometry: "optometry",
      frames: "inventory_frames", lenses: "inventory_lenses", transfers: "transfers",
      orders: "orders", technicians: "technicians", schedules: "schedules",
      promotions: "promotions", pointsLog: "points_log", settings: "settings", notify: "notify"
    },

    get: function (name) {
      var v = _read(name);
      if (Array.isArray(v)) return v;
      if (v === null || v === undefined) return null;
      return v;
    },

    set: function (name, value) {
      memoryCache[name] = value;
      _scheduleWrite(name);
      return value;
    },

    insert: function (collection, item) {
      var arr = _read(collection) || [];
      var record = $.extend({ id: uid(collection), createdAt: Date.now() }, item);
      arr.unshift(record);
      memoryCache[collection] = arr;
      _scheduleWrite(collection);
      return record;
    },

    update: function (collection, id, patch) {
      var arr = _read(collection) || [];
      var updated = null;
      arr.forEach(function (it) {
        if (String(it.id) === String(id)) {
          $.extend(it, patch, { updatedAt: Date.now() });
          updated = it;
        }
      });
      if (updated) { memoryCache[collection] = arr; _scheduleWrite(collection); }
      return updated;
    },

    remove: function (collection, id) {
      var arr = _read(collection) || [];
      arr = arr.filter(function (it) { return String(it.id) !== String(id); });
      memoryCache[collection] = arr;
      _scheduleWrite(collection);
    },

    findById: function (collection, id) {
      var arr = _read(collection) || [];
      for (var i = 0; i < arr.length; i++) { if (String(arr[i].id) === String(id)) return arr[i]; }
      return null;
    },

    query: function (collection, predicate) {
      var arr = _read(collection) || [];
      if (!predicate) return arr;
      return arr.filter(predicate);
    },

    subscribe: function (name, cb) {
      if (!subscribers[name]) subscribers[name] = [];
      subscribers[name].push(cb);
      return function () {
        subscribers[name] = subscribers[name].filter(function (c) { return c !== cb; });
      };
    },

    flushNow: function (name) {
      if (WRITE_QUEUE[name]) { clearTimeout(WRITE_QUEUE[name]); WRITE_QUEUE[name] = null; }
      if (name in memoryCache) { _flush(name); }
    },

    currentStoreId: function () {
      var s = _read("settings") || {};
      return s.currentStoreId;
    },
    currentStore: function () {
      var sid = Store.currentStoreId();
      var stores = _read("stores") || [];
      for (var i = 0; i < stores.length; i++) { if (String(stores[i].id) === String(sid)) return stores[i]; }
      return stores[0] || null;
    },
    switchStore: function (storeId) {
      var s = _read("settings") || {};
      s.currentStoreId = storeId;
      memoryCache["settings"] = s;
      _scheduleWrite("settings");
      _notify("settings");
    },
    allStores: function () { return _read("stores") || []; },

    uid: uid
  };

  global.Store = Store;

  /* ============ 种子数据 ============ */
  var RNG_SEED = 20260621;
  function makeRng(seed) {
    var s = seed;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function randInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
  function round1(n) { return Math.round(n * 10) / 10; }

  function genSeed() {
    var rng = makeRng(RNG_SEED);

    var storeNames = ["城东旗舰店", "城西明视店", "城南视界店", "城北清瞳店", "中央广场店", "滨江路店", "大学城店", "人民路店", "开发区店", "万达广场店", "火车站店", "高新区店"];
    var districts = ["朝阳区", "海淀区", "西城区", "东城区", "丰台区", "石景山区"];
    var managers = ["周建华", "孙志强", "吴美玲", "郑国栋", "王慧敏", "钱伟明", "冯丽萍", "陈志远", "褚建国", "卫淑芳", "蒋立军", "沈雅琴"];

    var stores = storeNames.map(function (name, i) {
      return { id: "S" + (i + 1), name: name, address: districts[i % districts.length] + "光明路" + randInt(rng, 1, 200) + "号", phone: "010-" + randInt(rng, 60000000, 89999999), manager: managers[i], openDate: "2020-0" + randInt(rng, 1, 9) + "-15" };
    });

    var firstNames = ["伟", "芳", "娜", "敏", "静", "丽", "强", "磊", "军", "洋", "勇", "艳", "杰", "娟", "涛", "明", "超", "霞", "平", "刚", "桂英", "建华", "志强", "美玲", "国栋", "慧敏", "伟明", "丽萍", "志远", "淑芳"];
    var lastNames = ["张", "王", "李", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗"];
    var techRoles = ["optometrist", "processor"];

    var technicians = [];
    stores.forEach(function (st) {
      var nOpt = randInt(rng, 2, 4), nProc = randInt(rng, 2, 3);
      for (var i = 0; i < nOpt; i++) {
        technicians.push({ id: uid("T"), name: pick(rng, lastNames) + pick(rng, firstNames), storeId: st.id, role: "optometrist", phone: "138" + randInt(rng, 10000000, 99999999), title: pick(rng, ["高级验光师", "验光师", "首席验光师"]) });
      }
      for (var j = 0; j < nProc; j++) {
        technicians.push({ id: uid("T"), name: pick(rng, lastNames) + pick(rng, firstNames), storeId: st.id, role: "processor", phone: "139" + randInt(rng, 10000000, 99999999), title: pick(rng, ["加工师", "高级加工师"]) });
      }
    });

    var custFirst = ["梓", "宇", "涵", "欣", "怡", "佳", "思", "雨", "嘉", "俊", "皓", "诗", "梦", "子", "若", "安", "一", "沐", "晨", "奕"];
    var customers = [];
    for (var c = 0; c < 80; c++) {
      var name = pick(rng, lastNames) + pick(rng, custFirst) + (rng() > .5 ? pick(rng, custFirst) : "");
      var bMonth = randInt(rng, 1, 12), bDay = randInt(rng, 1, 28);
      var points = randInt(rng, 0, 50) * 100;
      customers.push({
        id: uid("C"), name: name, phone: "1" + pick(rng, ["3", "5", "7", "8", "9"]) + randInt(rng, 100000000, 999999999),
        gender: rng() > .45 ? "female" : "male", birthday: "199" + randInt(rng, 0, 9) + "-" + String(bMonth).padStart(2, "0") + "-" + String(bDay).padStart(2, "0"),
        storeId: pick(rng, stores).id, points: points, level: points >= 3000 ? "gold" : points >= 1000 ? "silver" : "normal", joinDate: "202" + randInt(rng, 1, 5) + "-0" + randInt(rng, 1, 9) + "-" + String(randInt(rng, 1, 28)).padStart(2, "0")
      });
    }

    var frameBrands = ["雷朋", "暴龙", "海伦凯勒", "木九十", "陌森", "李维斯", "夏蒙", "精工", "万新", "帕莎", "派丽蒙", "JINS"];
    var frameModels = ["经典款", "商务款", "时尚款", "钛架", "全框", "半框", "无框", "运动款", "复古圆框", "飞行员"];
    var frameColors = ["黑色", "金丝", "银色", "玳瑁", "枪色", "玫瑰金", "透明", "蓝色"];
    var degreeRanges = ["0-400", "0-600", "0-800", "0-1000", "400-800", "600-1200"];

    var frames = [];
    stores.forEach(function (st) {
      var count = randInt(rng, 8, 14);
      for (var i = 0; i < count; i++) {
        frames.push({
          id: uid("F"), storeId: st.id, brand: pick(rng, frameBrands), model: pick(rng, frameModels), color: pick(rng, frameColors),
          degreeRange: pick(rng, degreeRanges), stock: randInt(rng, 0, 25), minStock: 3, price: randInt(rng, 18, 60) * 50, sku: "FR-" + randInt(rng, 1000, 9999)
        });
      }
    });

    var lensIndex = ["1.56", "1.60", "1.67", "1.74"];
    var lensCoating = ["加硬绿膜", "加硬蓝膜", "防蓝光膜", "钻立方银膜", "钻立方铂金膜"];
    var lensFunc = ["单光镜片", "渐进多焦", "防蓝光", "变色镜片", "偏光镜片", "近视防控"];
    var lenses = [];
    stores.forEach(function (st) {
      var count = randInt(rng, 6, 10);
      for (var i = 0; i < count; i++) {
        lenses.push({
          id: uid("L"), storeId: st.id, refractiveIndex: pick(rng, lensIndex), coating: pick(rng, lensCoating), functionType: pick(rng, lensFunc),
          stock: randInt(rng, 0, 30), minStock: 5, price: randInt(rng, 20, 80) * 50, sku: "LE-" + randInt(rng, 1000, 9999)
        });
      }
    });

    var orderStatuses = ["received", "processing", "adjusting", "quality", "delivered"];
    var statusLabels = { received: "接单", processing: "镜片加工", adjusting: "镜架调整", quality: "质检", delivered: "交付" };
    var now = Date.now();
    var orders = [];
    for (var o = 0; o < 90; o++) {
      var cust = pick(rng, customers);
      var st = stores.filter(function (s) { return s.id === cust.storeId; })[0] || stores[0];
      var storeTechs = technicians.filter(function (t) { return t.storeId === st.id; });
      var procTech = storeTechs.filter(function (t) { return t.role === "processor"; })[0] || storeTechs[0];
      var frame = pick(rng, frames.filter(function (f) { return f.storeId === st.id; })) || frames[0];
      var lens = pick(rng, lenses.filter(function (l) { return l.storeId === st.id; })) || lenses[0];
      var statusIdx = randInt(rng, 0, 4);
      var status = orderStatuses[statusIdx];
      var daysAgo = randInt(rng, 0, 12);
      var createdAt = now - daysAgo * 86400000 - randInt(rng, 0, 8) * 3600000;
      var timeline = [];
      for (var s = 0; s <= statusIdx; s++) {
        timeline.push({ step: orderStatuses[s], label: statusLabels[orderStatuses[s]], technicianId: (storeTechs[0] || {}).id, technicianName: (storeTechs[0] || {}).name, time: createdAt + s * randInt(rng, 2, 8) * 3600000 });
      }
      var amount = (frame ? frame.price : 800) + (lens ? lens.price : 600);
      var usePromo = rng() > .6;
      orders.push({
        id: uid("O"), customerId: cust.id, customerName: cust.name, customerPhone: cust.phone, storeId: st.id,
        frameId: frame ? frame.id : null, frameDesc: frame ? frame.brand + " " + frame.model : "", lensId: lens ? lens.id : null, lensDesc: lens ? lens.refractiveIndex + " " + lens.functionType : "",
        status: status, timeline: timeline, technicianId: procTech ? procTech.id : null, technicianName: procTech ? procTech.name : "",
        amount: amount, promoId: usePromo ? "auto" : null, discount: usePromo ? randInt(rng, 5, 20) * 10 : 0, finalAmount: usePromo ? amount * (1 - randInt(rng, 5, 20) / 100) : amount,
        createdAt: createdAt, note: rng() > .7 ? "顾客要求加急" : ""
      });
    }
    orders.sort(function (a, b) { return b.createdAt - a.createdAt; });

    var optometry = [];
    customers.forEach(function (cust) {
      var visits = randInt(rng, 1, 4);
      for (var v = 0; v < visits; v++) {
        var storeTechs2 = technicians.filter(function (t) { return t.storeId === cust.storeId && t.role === "optometrist"; });
        var opt = storeTechs2[0] || technicians[0];
        var isMyopia = rng() > .2;
        var sphereL = isMyopia ? -round1(randInt(rng, 10, 80) / 10) : round1(randInt(rng, 10, 40) / 10);
        var sphereR = sphereL + round1(randInt(rng, -3, 3) / 10);
        var hasAstig = rng() > .4;
        var cylL = hasAstig ? round1(randInt(rng, 5, 25) / 10) : 0;
        var cylR = hasAstig ? round1(randInt(rng, 5, 25) / 10) : 0;
        var axisL = hasAstig ? randInt(rng, 1, 180) : 0;
        var axisR = hasAstig ? randInt(rng, 1, 180) : 0;
        var monthsAgo = randInt(rng, 0, 30);
        var diag = isMyopia ? "近视" : "远视";
        if (hasAstig) diag += "+散光";
        optometry.push({
          id: uid("OP"), customerId: cust.id, customerName: cust.name, storeId: cust.storeId, optometristId: opt ? opt.id : null, optometristName: opt ? opt.name : "",
          date: new Date(now - monthsAgo * 30 * 86400000).toISOString().slice(0, 10),
          nakedL: round1(randInt(rng, 3, 10) / 10), nakedR: round1(randInt(rng, 3, 10) / 10),
          correctedL: round1(randInt(rng, 8, 12) / 10), correctedR: round1(randInt(rng, 8, 12) / 10),
          sphereL: sphereL, sphereR: sphereR, cylinderL: cylL, cylinderR: cylR, axisL: axisL, axisR: axisR,
          pd: randInt(rng, 58, 68), ph: randInt(rng, 20, 30),
          diagnosis: diag, suggestion: "建议配戴" + (sphereL < -6 ? "高折射率" : "常规折射率") + "镜片，" + (hasAstig ? "需定制散光镜片" : "单光镜片即可"),
          add: rng() > .85 ? round1(randInt(rng, 10, 30) / 10) : 0
        });
      }
    });
    optometry.sort(function (a, b) { return b.date < a.date ? -1 : 1; });

    var today = new Date();
    var schedules = [];
    var shifts = [{ key: "morning", label: "早班", hours: 8 }, { key: "afternoon", label: "午班", hours: 8 }, { key: "evening", label: "晚班", hours: 4 }];
    technicians.forEach(function (tech) {
      for (var d = 6; d >= 0; d--) {
        var date = new Date(today.getTime() - d * 86400000);
        if (rng() > .35) {
          var sh = pick(rng, shifts);
          schedules.push({ id: uid("SC"), technicianId: tech.id, technicianName: tech.name, storeId: tech.storeId, date: date.toISOString().slice(0, 10), shift: sh.key, shiftLabel: sh.label, hours: sh.hours, role: tech.role });
        }
      }
    });

    var promotions = [
      { id: uid("PM"), name: "开学季满减", type: "fullReduction", rules: { threshold: 800, reduce: 100 }, start: "2026-08-20", end: "2026-09-15", status: "active", desc: "满800减100" },
      { id: uid("PM"), name: "会员日88折", type: "discount", rules: { rate: 0.88 }, start: "2026-06-01", end: "2026-06-30", status: "active", desc: "全场88折" },
      { id: uid("PM"), name: "配镜赠护理套装", type: "gift", rules: { gift: "高级护理套装", value: 80 }, start: "2026-06-10", end: "2026-07-10", status: "active", desc: "赠护理套装" },
      { id: uid("PM"), name: "暑期满减", type: "fullReduction", rules: { threshold: 1000, reduce: 150 }, start: "2026-07-01", end: "2026-08-31", status: "active", desc: "满1000减150" },
      { id: uid("PM"), name: "新年特惠", type: "discount", rules: { rate: 0.85 }, start: "2026-01-15", end: "2026-02-15", status: "expired", desc: "全场85折" }
    ];

    var pointsLog = [];
    orders.forEach(function (ord) {
      if (ord.status === "delivered" && rng() > .3) {
        pointsLog.push({ id: uid("PL"), customerId: ord.customerId, customerName: ord.customerName, type: "earn", points: Math.round(ord.finalAmount), orderId: ord.id, date: new Date(ord.createdAt + 3 * 86400000).toISOString().slice(0, 10), storeId: ord.storeId });
      }
    });

    var settings = { currentStoreId: stores[0].id, version: 2, seededAt: now };

    var notify = [
      { id: uid("N"), type: "warn", icon: "bi-exclamation-triangle-fill", title: "3项库存低于安全线", body: "城东旗舰店雷朋经典款等需补货", time: now - 3600000 },
      { id: uid("N"), type: "info", icon: "bi-clipboard-check-fill", title: "5笔订单待加工", body: "今日新增接单5笔", time: now - 7200000 },
      { id: uid("N"), type: "danger", icon: "bi-clock-history", title: "2笔订单超时未交付", body: "请尽快处理", time: now - 10800000 },
      { id: uid("N"), type: "success", icon: "bi-gift-fill", title: "促销活动生效", body: "会员日88折已生效", time: now - 86400000 }
    ];

    return {
      stores: stores, customers: customers, optometry: optometry,
      inventory_frames: frames, inventory_lenses: lenses, transfers: [],
      orders: orders, technicians: technicians, schedules: schedules,
      promotions: promotions, points_log: pointsLog, settings: settings, notify: notify
    };
  }

  Store.initSeed = function (force) {
    var settings = _read("settings");
    if (settings && settings.version >= 2 && !force) return;
    var data = genSeed();
    Object.keys(data).forEach(function (k) {
      memoryCache[k] = data[k];
      try { localStorage.setItem(_key(k), JSON.stringify(data[k])); } catch (e) { console.warn(e); }
    });
    subscribers = {};
  };

  Store.resetData = function () {
    Object.keys(memoryCache).forEach(function (k) { try { localStorage.removeItem(_key(k)); } catch (e) {} });
    memoryCache = {};
    Store.initSeed(true);
  };

})(window);
