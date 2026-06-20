(function(global) {
  'use strict';

  const PRODUCING_AREAS = ['云南', '贵州', '湖南', '四川', '福建'];
  const VARIETIES = ['K326', '红花大金元', '云烟87', '云烟97', 'NC89', '中烟100'];
  const GRADES = ['B2F', 'B3F', 'C2F', 'C3F', 'C4F', 'X2F', 'X3F', 'B1K', 'C1L'];
  const FLIP_OPERATORS = ['张伟', '李强', '王建国', '赵德柱'];
  const TASTERS = ['陈品评', '刘品鉴', '周鉴香', '吴识味', '郑闻香', '孙辨醇'];
  const WAREHOUSE_NAMES = ['1号库', '2号库', '3号库', '4号库', '5号库', '6号库', '7号库', '8号库'];

  const VARIETY_FLIP_INTERVAL = {
    'K326': 90, '红花大金元': 100, '云烟87': 95, '云烟97': 95, 'NC89': 85, '中烟100': 90
  };

  const GRADE_AGING_MONTHS = {
    'B2F': [24, 30], 'B3F': [24, 30], 'C2F': [24, 36], 'C3F': [24, 36],
    'C4F': [24, 36], 'X2F': [24, 30], 'X3F': [24, 30], 'B1K': [18, 24], 'C1L': [20, 28]
  };

  function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function monthsBetween(d1, d2) {
    return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  }

  const store = {
    warehouses: [],
    batches: [],
    inspections: [],
    tastings: [],
    flipPlans: [],
    outboundOrders: [],
    alerts: [],

    init() {
      this.initWarehouses();
      this.initBatches();
      this.initInspections();
      this.initTastings();
      this.initFlipPlans();
    },

    initWarehouses() {
      this.warehouses = WAREHOUSE_NAMES.map((name, idx) => ({
        id: 'WH' + (idx + 1),
        name,
        rows: 25,
        cols: 20,
        temperatureMin: 18,
        temperatureMax: 24,
        humidityMin: 55,
        humidityMax: 70
      }));
    },

    initBatches() {
      const total = 12000;
      const perWh = Math.floor(total / 8);
      const now = new Date();
      let id = 1;
      this.batches = [];

      this.warehouses.forEach((wh, whIdx) => {
        const count = whIdx < 7 ? perWh : total - perWh * 7;
        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / wh.cols);
          const col = i % wh.cols;
          const variety = randChoice(VARIETIES);
          const grade = randChoice(GRADES);
          const agingRange = GRADE_AGING_MONTHS[grade];
          const monthsAgo = randInt(0, agingRange[1] + 6);
          const entryDate = new Date(now);
          entryDate.setMonth(entryDate.getMonth() - monthsAgo);

          const lastFlipDaysAgo = randInt(0, VARIETY_FLIP_INTERVAL[variety] + 30);
          const lastFlip = new Date(now);
          lastFlip.setDate(lastFlip.getDate() - lastFlipDaysAgo);

          this.batches.push({
            id: 'B' + String(id++).padStart(5, '0'),
            warehouseId: wh.id,
            row,
            col,
            producingArea: randChoice(PRODUCING_AREAS),
            variety,
            grade,
            entryYear: entryDate.getFullYear(),
            entryDate: formatDate(entryDate),
            lastFlipDate: formatDate(lastFlip),
            flipCount: randInt(0, 4),
            quantity: randInt(40, 60),
            status: 'in-stock',
            outboundDate: null,
            tastingScores: []
          });
        }
      });
    },

    initInspections() {
      this.inspections = [];
      const now = new Date();
      this.warehouses.forEach(wh => {
        for (let d = 0; d < 30; d++) {
          const date = new Date(now);
          date.setDate(date.getDate() - d);
          if (Math.random() < 0.8) {
            const temp = randInt(16, 28);
            const humid = randInt(50, 78);
            const overTemp = temp < wh.temperatureMin || temp > wh.temperatureMax;
            const overHumid = humid < wh.humidityMin || humid > wh.humidityMax;
            this.inspections.push({
              id: 'INSP' + this.inspections.length,
              warehouseId: wh.id,
              date: formatDate(date),
              temperature: temp,
              humidity: humid,
              operator: randChoice(['仓储张', '仓储李', '仓储王', '仓储赵']),
              hasAlert: overTemp || overHumid,
              alertType: overTemp && overHumid ? '温湿度均超标' : overTemp ? '温度超标' : overHumid ? '湿度超标' : null
            });
          }
        }
      });
      this.alerts = this.inspections.filter(i => i.hasAlert).map(i => ({
        id: 'ALT' + i.id,
        type: i.alertType,
        warehouseId: i.warehouseId,
        date: i.date,
        read: false
      }));
    },

    initTastings() {
      this.tastings = [];
      const now = new Date();
      this.batches.forEach(b => {
        const entryDate = new Date(b.entryDate);
        const monthsStored = monthsBetween(entryDate, now);
        const tastingCount = Math.min(Math.floor(monthsStored), 6);
        for (let t = 0; t < tastingCount; t++) {
          const td = new Date(entryDate);
          td.setMonth(td.getMonth() + t + 1);
          if (td > now) break;
          const scores = {
            aromaQuality: randInt(60, 95),
            aromaAmount: randInt(55, 95),
            impurity: randInt(50, 90),
            aftertaste: randInt(55, 92),
            irritation: randInt(50, 90)
          };
          const total = (scores.aromaQuality + scores.aromaAmount + scores.impurity + scores.aftertaste + scores.irritation) / 5;
          this.tastings.push({
            id: 'T' + this.tastings.length,
            batchId: b.id,
            date: formatDate(td),
            taster: randChoice(TASTERS),
            scores,
            overall: Number(total.toFixed(1))
          });
        }
      });
    },

    initFlipPlans() {
      this.flipPlans = [];
      const now = new Date();
      const candidates = this.getBatchesNeedingFlip().slice(0, 60);
      candidates.forEach((b, idx) => {
        const planDate = new Date(now);
        planDate.setDate(planDate.getDate() + (idx % 14));
        this.flipPlans.push({
          id: 'FP' + idx,
          batchId: b.id,
          date: formatDate(planDate),
          operator: randChoice(FLIP_OPERATORS),
          warehouseId: b.warehouseId,
          status: idx < 20 ? 'completed' : 'pending'
        });
      });
    },

    getWarehouses() { return this.warehouses; },
    getWarehouseById(id) { return this.warehouses.find(w => w.id === id); },

    getBatches(filter = {}) {
      let result = this.batches.slice();
      if (filter.warehouseId) result = result.filter(b => b.warehouseId === filter.warehouseId);
      if (filter.producingArea) result = result.filter(b => b.producingArea === filter.producingArea);
      if (filter.variety) result = result.filter(b => b.variety === filter.variety);
      if (filter.grade) result = result.filter(b => b.grade === filter.grade);
      if (filter.status) result = result.filter(b => b.status === filter.status);
      if (filter.minAgingMonths != null) {
        const now = new Date();
        result = result.filter(b => monthsBetween(new Date(b.entryDate), now) >= filter.minAgingMonths);
      }
      if (filter.maxAgingMonths != null) {
        const now = new Date();
        result = result.filter(b => monthsBetween(new Date(b.entryDate), now) <= filter.maxAgingMonths);
      }
      if (filter.minOverallScore != null) {
        result = result.filter(b => {
          const last = this.getLatestTasting(b.id);
          return last && last.overall >= filter.minOverallScore;
        });
      }
      if (filter.agingStatus) {
        result = result.filter(b => {
          const s = global.BatchModel ? global.BatchModel.computeAgingStatus(b) : null;
          return s && s.status === filter.agingStatus;
        });
      }
      return result;
    },

    getBatchById(id) { return this.batches.find(b => b.id === id); },

    updateBatch(id, updates) {
      const b = this.getBatchById(id);
      if (b) Object.assign(b, updates);
      return b;
    },

    getBatchesByWarehouse(whId) { return this.batches.filter(b => b.warehouseId === whId); },

    getInspections(filter = {}) {
      let result = this.inspections.slice();
      if (filter.warehouseId) result = result.filter(i => i.warehouseId === filter.warehouseId);
      result.sort((a, b) => new Date(b.date) - new Date(a.date));
      return result;
    },

    addInspection(data) {
      const insp = { id: 'INSP' + this.inspections.length, ...data };
      this.inspections.push(insp);
      if (insp.hasAlert) {
        this.alerts.unshift({
          id: 'ALT' + insp.id,
          type: insp.alertType,
          warehouseId: insp.warehouseId,
          date: insp.date,
          read: false
        });
      }
      return insp;
    },

    getTastings(filter = {}) {
      let result = this.tastings.slice();
      if (filter.batchId) result = result.filter(t => t.batchId === filter.batchId);
      result.sort((a, b) => new Date(a.date) - new Date(b.date));
      return result;
    },

    getLatestTasting(batchId) {
      const ts = this.getTastings({ batchId }).sort((a, b) => new Date(b.date) - new Date(a.date));
      return ts[0] || null;
    },

    addTasting(data) {
      const t = {
        id: 'T' + this.tastings.length,
        ...data,
        overall: Number(((data.scores.aromaQuality + data.scores.aromaAmount + data.scores.impurity + data.scores.aftertaste + data.scores.irritation) / 5).toFixed(1))
      };
      this.tastings.push(t);
      return t;
    },

    getFlipPlans(filter = {}) {
      let result = this.flipPlans.slice();
      if (filter.status) result = result.filter(f => f.status === filter.status);
      if (filter.date) result = result.filter(f => f.date === filter.date);
      if (filter.operator) result = result.filter(f => f.operator === filter.operator);
      return result;
    },

    addFlipPlan(data) {
      const plan = { id: 'FP' + this.flipPlans.length, status: 'pending', ...data };
      this.flipPlans.push(plan);
      return plan;
    },

    updateFlipPlan(id, updates) {
      const p = this.flipPlans.find(f => f.id === id);
      if (p) Object.assign(p, updates);
      return p;
    },

    removeFlipPlan(id) {
      const idx = this.flipPlans.findIndex(f => f.id === id);
      if (idx >= 0) return this.flipPlans.splice(idx, 1)[0];
      return null;
    },

    checkFlipConflict(operator, date, excludeId = null) {
      const plans = this.getFlipPlans().filter(p => p.operator === operator && p.date === date && p.id !== excludeId);
      const warehouses = new Set(plans.map(p => p.warehouseId));
      return warehouses.size > 1 || (warehouses.size === 1 && plans.length > 1 ? false : false);
    },

    getBatchesNeedingFlip() {
      const now = new Date();
      return this.batches.filter(b => {
        if (b.status !== 'in-stock') return false;
        const interval = VARIETY_FLIP_INTERVAL[b.variety] || 90;
        const last = new Date(b.lastFlipDate);
        const diff = Math.floor((now - last) / (1000 * 60 * 60 * 24));
        return diff >= interval;
      });
    },

    getFlipOperators() { return FLIP_OPERATORS; },
    getTasters() { return TASTERS; },
    getProducingAreas() { return PRODUCING_AREAS.slice(); },
    getVarieties() { return VARIETIES.slice(); },
    getGrades() { return GRADES.slice(); },
    getFlipInterval(variety) { return VARIETY_FLIP_INTERVAL[variety] || 90; },
    getGradeAgingMonths(grade) { return GRADE_AGING_MONTHS[grade] || [24, 36]; },

    createOutboundOrder(batchIds, operator) {
      const order = {
        id: 'OUT' + this.outboundOrders.length,
        date: formatDate(new Date()),
        operator,
        items: batchIds.map(id => ({ batchId: id }))
      };
      batchIds.forEach(id => {
        this.updateBatch(id, { status: 'outbound', outboundDate: order.date });
      });
      this.outboundOrders.push(order);
      return order;
    },

    getOutboundOrders() { return this.outboundOrders.slice(); },

    getAlerts() { return this.alerts.slice(); },
    markAlertRead(id) { const a = this.alerts.find(x => x.id === id); if (a) a.read = true; },

    getStatistics() {
      const now = new Date();
      const counts = { new: 0, aging: 0, ready: 0, overdue: 0, outbound: 0 };
      this.batches.forEach(b => {
        if (b.status === 'outbound') { counts.outbound++; return; }
        const s = global.BatchModel ? global.BatchModel.computeAgingStatus(b) : null;
        if (s) counts[s.status] = (counts[s.status] || 0) + 1;
      });
      const needsFlip = this.getBatchesNeedingFlip().length;
      const unreadAlerts = this.alerts.filter(a => !a.read).length;
      return { ...counts, needsFlip, unreadAlerts, total: this.batches.length };
    }
  };

  store.formatDate = formatDate;
  store.monthsBetween = monthsBetween;

  global.Store = store;
})(window);
