/* ==========================================================================
   data-store.js — localStorage 持久层
   封装品种、站点、试验方案、试验记录的 CRUD 与种子数据生成
   ========================================================================== */
(function (global) {
  'use strict';

  var KEYS = {
    crops: 'ct_crops',
    stations: 'ct_stations',
    varieties: 'ct_varieties',
    plans: 'ct_trial_plans',
    records: 'ct_records',
    meta: 'ct_meta'
  };

  var PLOT_AREA_MU = 0.02; // 小区面积(亩)

  /* ---------- 主数据定义 ---------- */
  var CROPS = [
    { code: 'rice', name: '水稻', icon: 'bi-droplet-half', growthDays: 122, baseYield: 540, unit: 'kg/亩' },
    { code: 'wheat', name: '小麦', icon: 'bi-wheat', growthDays: 148, baseYield: 490, unit: 'kg/亩' },
    { code: 'corn', name: '玉米', icon: 'bi-flower2', growthDays: 108, baseYield: 640, unit: 'kg/亩' },
    { code: 'soybean', name: '大豆', icon: 'bi-circle', growthDays: 96, baseYield: 215, unit: 'kg/亩' },
    { code: 'rapeseed', name: '油菜', icon: 'bi-flower1', growthDays: 178, baseYield: 195, unit: 'kg/亩' }
  ];

  var STATIONS = [
    { code: 'BJ', name: '华北试验站', region: '华北平原', lat: 39.92, lng: 116.46, envIndex: 0.9 },
    { code: 'SY', name: '辽中试验站', region: '东北平原', lat: 41.80, lng: 123.43, envIndex: 0.7 },
    { code: 'HRB', name: '松北试验站', region: '东北寒地', lat: 45.75, lng: 126.63, envIndex: 0.5 },
    { code: 'ZZ', name: '黄淮试验站', region: '黄淮海', lat: 34.75, lng: 113.65, envIndex: 1.0 },
    { code: 'YL', name: '关中试验站', region: '西北旱作', lat: 34.27, lng: 108.07, envIndex: 0.6 },
    { code: 'NJ', name: '苏南试验站', region: '长江下游', lat: 32.06, lng: 118.80, envIndex: 1.1 },
    { code: 'WH', name: '江汉试验站', region: '长江中游', lat: 30.59, lng: 114.31, envIndex: 1.05 },
    { code: 'CS', name: '湘中试验站', region: '江南丘陵', lat: 28.23, lng: 112.94, envIndex: 1.0 },
    { code: 'CD', name: '川西试验站', region: '西南盆地', lat: 30.67, lng: 104.07, envIndex: 0.95 },
    { code: 'GZ', name: '岭南试验站', region: '华南热区', lat: 23.13, lng: 113.27, envIndex: 1.15 },
    { code: 'NN', name: '桂南试验站', region: '华南丘陵', lat: 22.82, lng: 108.37, envIndex: 1.1 },
    { code: 'LS', name: '藏南试验站', region: '青藏高原', lat: 29.65, lng: 91.13, envIndex: 0.4 }
  ];

  var AGRONOMIC_TRAITS = [
    { key: 'plantHeight', label: '株高', unit: 'cm', min: 30, max: 280 },
    { key: 'earLength', label: '穗长', unit: 'cm', min: 4, max: 45 },
    { key: 'thousandGrainWeight', label: '千粒重', unit: 'g', min: 5, max: 90 },
    { key: 'spikeletsPerEar', label: '每穗粒数', unit: '粒', min: 20, max: 320 },
    { key: 'grainsPerSpike', label: '穗粒数', unit: '粒', min: 15, max: 300 },
    { key: 'earDiameter', label: '穗粗', unit: 'mm', min: 6, max: 70 },
    { key: 'branchNumber', label: '分枝数', unit: '个', min: 0, max: 24 },
    { key: 'nodeNumber', label: '节数', unit: '节', min: 3, max: 32 },
    { key: 'leafArea', label: '叶面积', unit: 'cm²', min: 15, max: 450 },
    { key: 'stemDiameter', label: '茎粗', unit: 'mm', min: 2, max: 45 },
    { key: 'rootLength', label: '根长', unit: 'cm', min: 10, max: 130 },
    { key: 'biomass', label: '生物量', unit: 'g', min: 40, max: 1600 }
  ];

  var RESISTANCE_DEFS = [
    { key: 'lodgingScore', label: '倒伏性', min: 1, max: 5, lowerBetter: true, options: [1, 2, 3, 4, 5], optionLabels: ['1 高抗', '2 抗', '3 中抗', '4 感', '5 高感'] },
    { key: 'diseaseLevel', label: '病害等级', min: 1, max: 9, lowerBetter: true, options: [1, 3, 5, 7, 9], optionLabels: ['1 高抗', '3 抗', '5 中抗', '7 感', '9 高感'] },
    { key: 'pestLevel', label: '虫害等级', min: 1, max: 9, lowerBetter: true, options: [1, 3, 5, 7, 9], optionLabels: ['1 高抗', '3 抗', '5 中抗', '7 感', '9 高感'] },
    { key: 'coldTolerance', label: '耐寒性', min: 1, max: 9, lowerBetter: false, options: [1, 3, 5, 7, 9], optionLabels: ['1 极弱', '3 弱', '5 中', '7 强', '9 极强'] },
    { key: 'droughtTolerance', label: '耐旱性', min: 1, max: 9, lowerBetter: false, options: [1, 3, 5, 7, 9], optionLabels: ['1 极弱', '3 弱', '5 中', '7 强', '9 极强'] }
  ];

  /* ---------- 种子数据：品种库 ---------- */
  var VARIETY_POOL = {
    rice: [
      ['R01', '嘉丰优18'], ['R02', '甬优1540'], ['R03', '中嘉优9号'], ['R04', '隆粳898'],
      ['R05', '南粳9108'], ['R06', '华占稻7号'], ['R07', '晶两优534'], ['R08', '荃优丝苗'],
      ['R09', '野香优莉丝'], ['R10', '中科发5号'], ['R11', '吉粳816'], ['R12', '盐粳15号'],
      ['R13', '武运粳31'], ['R14', '扬稻6号']
    ],
    wheat: [
      ['W01', '济麦22'], ['W02', '郑麦119'], ['W03', '百农207'], ['W04', '周麦36'],
      ['W05', '西农979'], ['W06', '中麦175'], ['W07', '鲁原502'], ['W08', '烟农999'],
      ['W09', '淮麦33'], ['W10', '邯麦13'], ['W11', '洛麦23'], ['W12', '石麦15'],
      ['W13', '郑麦1860'], ['W14', '衡观35']
    ],
    corn: [
      ['C01', '郑单958'], ['C02', '先玉335'], ['C03', '京科968'], ['C04', '登海605'],
      ['C05', '中科玉505'], ['C06', '裕丰303'], ['C07', '伟科702'], ['C08', '联创825'],
      ['C09', '东单1331'], ['C10', '迪卡517'], ['C11', '农华5号'], ['C12', '良玉99']
    ],
    soybean: [
      ['S01', '中黄301'], ['S02', '齐黄34'], ['S03', '合农85'], ['S04', '绥农42'],
      ['S05', '冀豆17'], ['S06', '汾豆78'], ['S07', '皖豆28'], ['S08', '黑河45'],
      ['S09', '南豆18'], ['S10', '中黄37']
    ],
    rapeseed: [
      ['Y01', '中油杂19'], ['Y02', '华油杂62'], ['Y03', '沣油737'], ['Y04', '秦优10号'],
      ['Y05', '浙油50'], ['Y06', '川油36'], ['Y07', '蓉油18'], ['Y08', '希望699'],
      ['Y09', '沣油823'], ['Y10', '中双11号']
    ]
  };

  var SOURCES = ['中国农科院', '省农科院', '农业大学', '种业公司', '区域所选育'];

  /* ---------- 确定性随机数（种子可复现） ---------- */
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function between(rng, lo, hi) { return lo + rng() * (hi - lo); }
  function round2(n) { return Math.round(n * 100) / 100; }

  function genPhenology(rng, crop, sowingBase) {
    var sow = sowingBase + Math.floor(between(rng, -10, 10));
    var emergence = sow + Math.floor(between(rng, 5, 12));
    var heading = emergence + Math.floor(between(rng, 40, 70));
    var maturity = heading + Math.floor(between(rng, 28, 48));
    return {
      sowingDate: sow,
      emergenceDate: emergence,
      headingDate: heading,
      maturityDate: maturity,
      growthDays: maturity - sow
    };
  }

  function genAgronomic(rng, crop) {
    var t = {};
    // 根据作物给出合理的性状基线区间
    var ranges = {
      rice: { plantHeight: [85, 125], earLength: [16, 26], thousandGrainWeight: [22, 32], spikeletsPerEar: [120, 220], grainsPerSpike: [100, 200], earDiameter: [12, 18], branchNumber: [8, 14], nodeNumber: [13, 17], leafArea: [80, 180], stemDiameter: [4, 8], rootLength: [22, 40], biomass: [300, 700] },
      wheat: { plantHeight: [70, 95], earLength: [8, 12], thousandGrainWeight: [38, 52], spikeletsPerEar: [16, 24], grainsPerSpike: [38, 60], earDiameter: [8, 12], branchNumber: [0, 2], nodeNumber: [5, 7], leafArea: [30, 70], stemDiameter: [3, 5], rootLength: [18, 32], biomass: [200, 480] },
      corn: { plantHeight: [240, 320], earLength: [16, 26], thousandGrainWeight: [280, 380], spikeletsPerEar: [400, 700], grainsPerSpike: [400, 700], earDiameter: [42, 56], branchNumber: [0, 2], nodeNumber: [14, 20], leafArea: [500, 900], stemDiameter: [22, 32], rootLength: [30, 60], biomass: [900, 1500] },
      soybean: { plantHeight: [55, 90], earLength: [3, 6], thousandGrainWeight: [160, 240], spikeletsPerEar: [40, 90], grainsPerSpike: [40, 90], earDiameter: [5, 8], branchNumber: [2, 6], nodeNumber: [12, 18], leafArea: [60, 130], stemDiameter: [5, 9], rootLength: [20, 38], biomass: [150, 320] },
      rapeseed: { plantHeight: [150, 190], earLength: [45, 70], thousandGrainWeight: [3, 5], spikeletsPerEar: [200, 400], grainsPerSpike: [180, 360], earDiameter: [4, 7], branchNumber: [6, 12], nodeNumber: [10, 16], leafArea: [120, 260], stemDiameter: [6, 10], rootLength: [24, 42], biomass: [250, 520] }
    }[crop];
    AGRONOMIC_TRAITS.forEach(function (def) {
      var r = ranges[def.key];
      t[def.key] = round2(between(rng, r[0], r[1]));
    });
    return t;
  }

  function genResistance(rng) {
    var r = {};
    RESISTANCE_DEFS.forEach(function (def) {
      var idx = Math.floor(rng() * def.options.length);
      r[def.key] = def.options[idx];
    });
    return r;
  }

  /* ---------- 生成种子数据 ---------- */
  function buildSeed() {
    var varieties = [];
    var plans = [];
    var records = [];
    var vid = 1, pid = 1, rid = 1;
    var years = [2025, 2024];

    years.forEach(function (year) {
      CROPS.forEach(function (crop) {
        // 2024 只生成水稻与小麦，减少存储压力（用于年度对比演示）
        if (year === 2024 && crop.code !== 'rice' && crop.code !== 'wheat') return;

        var pool = VARIETY_POOL[crop.code];
        var cropVarieties = [];
        pool.forEach(function (v, i) {
          var variety = {
            id: 'V' + (vid++),
            code: v[0],
            name: v[1],
            cropCode: crop.code,
            source: pick(makeRng(year * 7 + i), SOURCES),
            year: year,
            isControl: i === 0
          };
          varieties.push(variety);
          cropVarieties.push(variety);
        });

        var plan = {
          id: 'P' + (pid++),
          year: year,
          cropCode: crop.code,
          cropName: crop.name,
          varietyIds: cropVarieties.map(function (v) { return v.id; }),
          controlId: cropVarieties[0].id,
          stationCodes: STATIONS.map(function (s) { return s.code; }),
          replications: 3,
          version: 'v1.0',
          createdAt: year + '-03-01',
          status: '进行中'
        };
        plans.push(plan);

        // 为每个品种×站点×重复生成记录
        var rng = makeRng(year * 131 + crop.code.charCodeAt(0) * 17);
        cropVarieties.forEach(function (v, vi) {
          var geneticPotential = crop.baseYield * between(rng, 0.82, 1.18);
          // 品种稳定性：部分品种稳定，部分波动大
          var stability = between(rng, 0.02, 0.14);
          STATIONS.forEach(function (st, si) {
            var envEffect = (st.envIndex - 0.85) * crop.baseYield * 0.18;
            // 基因型×环境互作
            var ge = Math.sin((vi + 1) * (si + 1) * 0.6) * crop.baseYield * stability;
            for (var rep = 1; rep <= plan.replications; rep++) {
              var noise = (rng() - 0.5) * crop.baseYield * 0.05;
              var muYield = round2(Math.max(crop.baseYield * 0.5, geneticPotential + envEffect + ge + noise));
              var plotYield = round2(muYield * PLOT_AREA_MU);
              var pheno = genPhenology(rng, crop.code, (year - 1) * 1000 + 280 + si * 2);
              var rec = {
                id: 'R' + (rid++),
                planId: plan.id,
                year: year,
                cropCode: crop.code,
                stationCode: st.code,
                varietyId: v.id,
                varietyName: v.name,
                replication: rep,
                plotYield: plotYield,
                muYield: muYield,
                phenology: pheno,
                agronomic: genAgronomic(rng, crop.code),
                resistance: genResistance(rng),
                status: 'normal',
                updatedAt: year + '-10-' + (10 + si)
              };
              records.push(rec);
            }
          });
        });

        // 人为注入少量异常数据以演示校验
        if (records.length > 10) {
          var bad1 = records[2];
          bad1.muYield = round2(crop.baseYield * 2.6); bad1.plotYield = round2(bad1.muYield * PLOT_AREA_MU); bad1.status = 'abnormal';
          var bad2 = records[5];
          bad2.agronomic = bad2.agronomic || {};
          bad2.agronomic.plantHeight = 9999; bad2.status = 'abnormal';
          var bad3 = records[8];
          bad3.phenology.maturityDate = bad3.phenology.sowingDate - 5; bad3.status = 'abnormal';
        }
      });
    });

    return {
      crops: CROPS,
      stations: STATIONS,
      varieties: varieties,
      plans: plans,
      records: records,
      meta: { currentYear: 2025, currentCrop: 'rice', version: '2.0.0' }
    };
  }

  /* ---------- 存储读写 ---------- */
  function read(key, def) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : (def || null);
    } catch (e) {
      return def || null;
    }
  }
  function write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.error('localStorage 写入失败', e);
      return false;
    }
  }

  var listeners = [];
  function notify(evt) { listeners.forEach(function (cb) { try { cb(evt); } catch (e) {} }); }

  /* ---------- 数据校验引擎 ---------- */
  function validateRecord(rec) {
    var issues = [];
    if (rec.muYield == null || rec.muYield <= 0) issues.push({ type: 'missing', field: 'muYield', msg: '小区产量缺失' });
    var crop = CROPS.find(function (c) { return c.code === rec.cropCode; });
    if (crop && rec.muYield) {
      if (rec.muYield > crop.baseYield * 2.2 || rec.muYield < crop.baseYield * 0.35) {
        issues.push({ type: 'extreme', field: 'muYield', msg: '产量极端值(偏离正常范围)', severity: 'high' });
      }
    }
    if (rec.phenology) {
      var p = rec.phenology;
      if (p.sowingDate && p.maturityDate && p.maturityDate <= p.sowingDate) {
        issues.push({ type: 'logic', field: 'phenology', msg: '成熟期早于播期(物候逻辑矛盾)', severity: 'high' });
      }
      if (p.sowingDate && p.emergenceDate && p.emergenceDate < p.sowingDate) {
        issues.push({ type: 'logic', field: 'phenology', msg: '出苗期早于播期', severity: 'mid' });
      }
    }
    if (rec.agronomic) {
      AGRONOMIC_TRAITS.forEach(function (def) {
        var v = rec.agronomic[def.key];
        if (v != null && (v < def.min || v > def.max)) {
          issues.push({ type: 'extreme', field: def.key, msg: def.label + '超出合理范围(' + def.min + '-' + def.max + ')', severity: 'mid' });
        }
      });
    }
    return issues;
  }

  /* ---------- 公共 API ---------- */
  var DataStore = {
    KEYS: KEYS,
    CROPS: CROPS,
    STATIONS: STATIONS,
    AGRONOMIC_TRAITS: AGRONOMIC_TRAITS,
    RESISTANCE_DEFS: RESISTANCE_DEFS,
    PLOT_AREA_MU: PLOT_AREA_MU,

    init: function () {
      if (!localStorage.getItem(KEYS.meta)) {
        this.resetSeed();
      }
      return this;
    },

    resetSeed: function () {
      var seed = buildSeed();
      write(KEYS.crops, seed.crops);
      write(KEYS.stations, seed.stations);
      write(KEYS.varieties, seed.varieties);
      write(KEYS.plans, seed.plans);
      write(KEYS.records, seed.records);
      write(KEYS.meta, seed.meta);
      notify({ type: 'reset' });
    },

    onChange: function (cb) { listeners.push(cb); return function () { listeners = listeners.filter(function (f) { return f !== cb; }); }; },

    getState: function () { return read(KEYS.meta, { currentYear: 2025, currentCrop: 'rice' }); },
    setState: function (patch) {
      var meta = Object.assign({}, this.getState(), patch);
      write(KEYS.meta, meta);
      notify({ type: 'state', patch: patch });
      return meta;
    },

    getCrops: function () { return read(KEYS.crops, CROPS); },
    getCrop: function (code) { return this.getCrops().find(function (c) { return c.code === code; }); },
    getStations: function () { return read(KEYS.stations, STATIONS); },
    getStation: function (code) { return this.getStations().find(function (s) { return s.code === code; }); },

    getVarieties: function (filter) {
      var all = read(KEYS.varieties, []);
      if (!filter) return all;
      return all.filter(function (v) {
        if (filter.crop && v.cropCode !== filter.crop) return false;
        if (filter.year && v.year !== filter.year) return false;
        return true;
      });
    },
    getVariety: function (id) { return read(KEYS.varieties, []).find(function (v) { return v.id === id; }); },
    saveVariety: function (v) {
      var all = read(KEYS.varieties, []);
      var idx = all.findIndex(function (x) { return x.id === v.id; });
      if (idx >= 0) all[idx] = v; else all.push(v);
      write(KEYS.varieties, all);
      notify({ type: 'variety', id: v.id });
    },

    getTrialPlans: function (filter) {
      var all = read(KEYS.plans, []);
      if (!filter) return all;
      return all.filter(function (p) {
        if (filter.year && p.year !== filter.year) return false;
        if (filter.crop && p.cropCode !== filter.crop) return false;
        return true;
      });
    },
    getTrialPlan: function (id) { return read(KEYS.plans, []).find(function (p) { return p.id === id; }); },
    saveTrialPlan: function (plan) {
      var all = read(KEYS.plans, []);
      var idx = all.findIndex(function (p) { return p.id === plan.id; });
      if (idx >= 0) all[idx] = plan; else all.push(plan);
      write(KEYS.plans, all);
      notify({ type: 'plan', id: plan.id });
    },
    deleteTrialPlan: function (id) {
      var all = read(KEYS.plans, []).filter(function (p) { return p.id !== id; });
      write(KEYS.plans, all);
      // 删除关联记录
      var recs = read(KEYS.records, []).filter(function (r) { return r.planId !== id; });
      write(KEYS.records, recs);
      notify({ type: 'plan-delete', id: id });
    },

    getRecords: function (filter) {
      var all = read(KEYS.records, []);
      if (!filter) return all;
      return all.filter(function (r) {
        if (filter.planId && r.planId !== filter.planId) return false;
        if (filter.stationCode && r.stationCode !== filter.stationCode) return false;
        if (filter.varietyId && r.varietyId !== filter.varietyId) return false;
        if (filter.year && r.year !== filter.year) return false;
        if (filter.crop && r.cropCode !== filter.crop) return false;
        if (filter.status && r.status !== filter.status) return false;
        if (filter.planId_in && filter.planId_in.indexOf(r.planId) < 0) return false;
        return true;
      });
    },
    getRecord: function (id) { return read(KEYS.records, []).find(function (r) { return r.id === id; }); },

    saveRecord: function (rec) {
      var all = read(KEYS.records, []);
      if (!rec.id) rec.id = 'R' + Date.now() + Math.floor(Math.random() * 999);
      var issues = validateRecord(rec);
      rec.status = issues.length ? (issues.some(function (i) { return i.severity === 'high'; }) ? 'abnormal' : 'warning') : 'normal';
      rec._issues = issues.length ? issues : undefined;
      rec.updatedAt = rec.updatedAt || new Date().toISOString().slice(0, 10);
      var idx = all.findIndex(function (x) { return x.id === rec.id; });
      if (idx >= 0) all[idx] = rec; else all.push(rec);
      write(KEYS.records, all);
      notify({ type: 'record', id: rec.id });
      return rec;
    },

    deleteRecord: function (id) {
      var all = read(KEYS.records, []).filter(function (r) { return r.id !== id; });
      write(KEYS.records, all);
      notify({ type: 'record-delete', id: id });
    },

    bulkImport: function (records) {
      var all = read(KEYS.records, []);
      var imported = 0, skipped = 0;
      records.forEach(function (rec) {
        if (!rec.planId || !rec.stationCode || !rec.varietyId) { skipped++; return; }
        var issues = validateRecord(rec);
        rec.status = issues.length ? (issues.some(function (i) { return i.severity === 'high'; }) ? 'abnormal' : 'warning') : 'normal';
        rec._issues = issues.length ? issues : undefined;
        all.push(rec);
        imported++;
      });
      write(KEYS.records, all);
      notify({ type: 'import', count: imported });
      return { imported: imported, skipped: skipped };
    },

    getValidationIssues: function (filter) {
      var recs = this.getRecords(filter);
      var issues = [];
      recs.forEach(function (rec) {
        var found = validateRecord(rec);
        if (found.length) {
          found.forEach(function (iss) {
            issues.push(Object.assign({ recordId: rec.id, recordLabel: rec.varietyName + ' / ' + rec.stationCode + ' / 重复' + rec.replication }, iss));
          });
        }
        // 缺失小区检测：对照方案应有重复数
        if (rec.muYield == null) issues.push({ recordId: rec.id, type: 'missing', field: 'muYield', msg: '小区数据缺失', recordLabel: rec.varietyName + ' / ' + rec.stationCode, severity: 'high' });
      });
      return issues;
    },

    /* 检查方案下缺失的小区组合 */
    getMissingPlots: function (planId) {
      var plan = this.getTrialPlan(planId);
      if (!plan) return [];
      var recs = this.getRecords({ planId: planId });
      var existing = {};
      recs.forEach(function (r) { existing[r.stationCode + '_' + r.varietyId + '_' + r.replication] = true; });
      var missing = [];
      plan.varietyIds.forEach(function (vid) {
        plan.stationCodes.forEach(function (sc) {
          for (var rep = 1; rep <= plan.replications; rep++) {
            if (!existing[sc + '_' + vid + '_' + rep]) {
              missing.push({ planId: planId, stationCode: sc, varietyId: vid, replication: rep });
            }
          }
        });
      });
      return missing;
    },

    getYears: function () {
      var plans = read(KEYS.plans, []);
      var years = {};
      plans.forEach(function (p) { years[p.year] = true; });
      return Object.keys(years).map(Number).sort(function (a, b) { return b - a; });
    },

    getStorageUsage: function () {
      var total = 5 * 1024 * 1024; // 5MB 上限
      var used = 0;
      Object.keys(KEYS).forEach(function (k) {
        var v = localStorage.getItem(KEYS[k]);
        if (v) used += v.length * 2; // UTF-16 近似
      });
      return { used: used, total: total, percent: Math.min(100, Math.round((used / total) * 100)) };
    },

    exportYear: function (year) {
      return {
        meta: this.getState(),
        crops: this.getCrops(),
        stations: this.getStations(),
        varieties: this.getVarieties({ year: year }),
        plans: this.getTrialPlans({ year: year }),
        records: this.getRecords({ year: year }),
        exportedAt: new Date().toISOString()
      };
    },

    /* 田间日序号转日期串(种子中用相对天数，仅展示用) */
    formatDay: function (dayNum) {
      if (dayNum == null || isNaN(dayNum)) return '—';
      // 种子日期以 (year-1)*1000+280 为基准的相对天数，这里转为可读串
      return 'D' + dayNum;
    },

    validateRecord: validateRecord
  };

  global.DataStore = DataStore;
})(window);
