/* Services — 模拟 ASP.NET Core 8.0 Controllers + DataAggregationService */
/* 全部端点服务端校验并返回结构化错误，对应 Swagger/OpenAPI 3.0 接口文档 */
(function (global) {
  function ApiError(code, message, field) { this.success = false; this.code = code; this.message = message; this.field = field; }
  function ok(data) { return { success: true, data: data }; }
  function val(cond, code, msg, field) { if (!cond) throw new ApiError(code || 'VALIDATION_ERROR', msg || '参数校验失败', field); }

  function statusOf(level, warn, danger) {
    if (level >= danger) return 'danger';
    if (level >= warn) return 'warning';
    return 'normal';
  }
  function sevLabel(s) { return s === 'danger' ? '超保证水位' : s === 'warning' ? '超警戒水位' : '正常'; }

  /* ---- 历史时序数据生成（确定性） ---- */
  function genHistory(reservoir, points, stepMin, endTs) {
    const rng = DB.rng(reservoir.seed);
    const cur = reservoir.current.level, base = reservoir.normalLevel;
    const end = endTs || Date.now();
    const out = [];
    let lvl = base - (cur - base) * 0.6;
    for (let i = points - 1; i >= 0; i--) {
      const t = end - i * stepMin * 60000;
      const target = base + (cur - base) * (1 - i / points) * (0.7 + rng() * 0.6);
      lvl = lvl + (target - lvl) * 0.35 + (rng() - 0.5) * 0.4;
      const inflow = Math.max(0, reservoir.current.inflow * (0.6 + rng() * 0.9) * (1 - i / points * 0.3));
      const rain = Math.max(0, reservoir.current.rainfall * (0.2 + rng() * 1.1));
      out.push({ t, level: +lvl.toFixed(2), inflow: Math.round(inflow), rainfall: +rain.toFixed(1) });
    }
    out[out.length - 1].level = cur;
    return out;
  }

  const API = {

    /* ====== WaterLevelController ====== */
    waterlevel: {
      latest() {
        const res = DB.all('reservoirs');
        return res.map(r => {
          const st = statusOf(r.current.level, r.warningLevel, r.dangerLevel);
          return {
            id: r._id, name: r.name, code: r.code, type: 'reservoir',
            level: r.current.level, inflow: r.current.inflow, rainfall: r.current.rainfall,
            warningLevel: r.warningLevel, dangerLevel: r.dangerLevel, normalLevel: r.normalLevel,
            capacity: r.capacity, status: st, statusLabel: sevLabel(st),
            location: r.location, updatedAt: r.current.updatedAt
          };
        });
      },
      stations() {
        return DB.all('stations').map(s => ({
          id: s._id, name: s.name, rainfall: s.rainfall, location: s.location, reservoirId: s.reservoirId
        }));
      },
      history(reservoirId, start, end) {
        val(reservoirId, 'VALIDATION_ERROR', '缺少站点ID', 'reservoirId');
        const r = DB.findOne('reservoirs', { _id: reservoirId });
        val(r, 'NOT_FOUND', '水库不存在', 'reservoirId');
        const e = end ? +end : Date.now();
        const s = start ? +start : e - 24 * 3600 * 1000;
        const hours = Math.min(72, Math.max(1, (e - s) / 3600000));
        const points = Math.min(200, Math.max(12, Math.round(hours * 6)));
        return genHistory(r, points, 10, e).filter(p => p.t >= s && p.t <= e);
      },
      floodSim(params) {
        val(params && params.reservoirId, 'VALIDATION_ERROR', '缺少水库ID', 'reservoirId');
        val(params.inflow >= 0, 'VALIDATION_ERROR', '入库流量需为非负数', 'inflow');
        val(params.discharge >= 0, 'VALIDATION_ERROR', '泄洪流量需为非负数', 'discharge');
        const r = DB.findOne('reservoirs', { _id: params.reservoirId });
        val(r, 'NOT_FOUND', '水库不存在', 'reservoirId');
        const inflow = +params.inflow, discharge = +params.discharge;
        const cur = r.current.level;
        const area = (r.capacity * 1e8 / ((r.dangerLevel - r.normalLevel) || 10)) / 1e4; // 简化水面面积 km²
        const net = inflow - discharge;
        const hours = 12, step = 0.5, n = hours / step + 1;
        const sections = [
          { name: '坝下断面 0km', dist: 0, base: r.normalLevel - 4 },
          { name: '镇区断面 5km', dist: 5, base: r.normalLevel - 7 },
          { name: '平原断面 12km', dist: 12, base: r.normalLevel - 10 },
          { name: '河口断面 25km', dist: 25, base: r.normalLevel - 13 }
        ];
        const waveSpeed = 18; // km/h
        const decay = 22;
        const amp = discharge * 0.012;
        const reservoirLevel = [];
        const sectionSeries = sections.map(s => ({ name: s.name, dist: s.dist, series: [] }));
        let lvl = cur;
        for (let i = 0; i < n; i++) {
          const t = i * step;
          lvl = lvl + (net / (area * 36 + 1)) * step * 0.6; // 水位变化（简化）
          reservoirLevel.push({ t: +t.toFixed(1), level: +lvl.toFixed(2) });
          sections.forEach((s, si) => {
            const delay = s.dist / waveSpeed;
            const att = Math.exp(-s.dist / decay);
            const tp = t - delay;
            let comp = 0;
            if (tp > 0) {
              const shape = Math.pow(tp, 1.3) * Math.exp(-tp / 3.2);
              comp = amp * att * shape;
            }
            sectionSeries[si].series.push({ t: +t.toFixed(1), level: +(s.base + comp).toFixed(2) });
          });
        }
        const peakLevel = Math.max.apply(null, sectionSeries.map(s => Math.max.apply(null, s.series.map(p => p.level))));
        const peakSection = sectionSeries.reduce((a, b) => Math.max.apply(null, a.series.map(p => p.level)) >= Math.max.apply(null, b.series.map(p => p.level)) ? a : b);
        return {
          reservoir: r.name, inflow, discharge, net, startLevel: cur, endLevel: +lvl.toFixed(2),
          peakLevel: +peakLevel.toFixed(2), peakSection: peakSection.name,
          reservoirLevel, sections: sectionSeries,
          safe: peakLevel < (r.normalLevel - 6)
        };
      }
    },

    /* ====== DataAggregationService ====== */
    aggregation: {
      warnings() {
        const res = DB.all('reservoirs');
        const list = [];
        res.forEach(r => {
          const st = statusOf(r.current.level, r.warningLevel, r.dangerLevel);
          if (st !== 'normal') {
            list.push({
              reservoirId: r._id, name: r.name, level: r.current.level,
              warningLevel: r.warningLevel, dangerLevel: r.dangerLevel,
              over: +(r.current.level - r.warningLevel).toFixed(2), severity: st,
              inflow: r.current.inflow, rainfall: r.current.rainfall
            });
          }
        });
        return list;
      },
      overview() {
        const res = DB.all('reservoirs');
        const w = this.warnings();
        return {
          total: res.length,
          warning: w.filter(x => x.severity === 'warning').length,
          danger: w.filter(x => x.severity === 'danger').length,
          normal: res.length - w.length,
          avgRain: +(res.reduce((s, r) => s + r.current.rainfall, 0) / res.length).toFixed(1),
          totalInflow: res.reduce((s, r) => s + r.current.inflow, 0)
        };
      }
    },

    /* ====== DispatchController ====== */
    dispatch: {
      gates() {
        return DB.all('gates').map(g => ({ id: g._id, name: g.name, reservoirName: g.reservoirName, maxOpening: g.maxOpening, type: g.type }));
      },
      receivers() {
        const out = [];
        ['维护人员', '巡检员'].forEach(role => {
          DB.all('contacts').filter(c => c.role === role).forEach(c => out.push({ id: c._id, name: c.name, phone: c.phone, role: c.role }));
        });
        return out;
      },
      list(filter) {
        let rows = DB.all('dispatchOrders');
        if (filter && filter.status) rows = rows.filter(o => o.status === filter.status);
        if (filter && filter.from) rows = rows.filter(o => o.sendTime >= +filter.from);
        return rows.sort((a, b) => b.sendTime - a.sendTime);
      },
      get(id) {
        val(id, 'VALIDATION_ERROR', '缺少指令ID', 'id');
        const o = DB.findOne('dispatchOrders', { _id: id });
        val(o, 'NOT_FOUND', '指令不存在', 'id');
        return o;
      },
      create(body) {
        val(body && body.gateId, 'VALIDATION_ERROR', '请选择闸门', 'gateId');
        val(body.receiver, 'VALIDATION_ERROR', '请选择接收人', 'receiver');
        val(body.opening != null && body.opening > 0, 'VALIDATION_ERROR', '开度须大于0', 'opening');
        const g = DB.findOne('gates', { _id: body.gateId });
        val(g, 'NOT_FOUND', '闸门不存在', 'gateId');
        val(body.opening <= g.maxOpening, 'VALIDATION_ERROR', '开度超过闸门最大值(' + g.maxOpening + ')', 'opening');
        const now = Date.now();
        const idx = DB.count('dispatchOrders') + 1;
        const order = {
          _id: 'do_' + now.toString(36), code: 'DD' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + String(100 + idx),
          gateId: g._id, gateName: g.name, reservoirName: g.reservoirName,
          opening: +body.opening, actualOpening: null,
          sender: body.sender || '当前调度员', receiver: body.receiver, sendTime: now, deadline: now + 30 * 60000,
          confirmTime: null, status: 'pending', remark: body.remark || '',
          trace: [{ time: now, op: '指令下发', by: body.sender || '调度员', node: 'start' }, { time: now + 30000, op: '推送至接收方', by: '系统', node: 'info' }]
        };
        return DB.insert('dispatchOrders', order);
      },
      confirm(id, actualOpening) {
        const o = this.get(id);
        val(actualOpening != null && actualOpening >= 0, 'VALIDATION_ERROR', '实际开度须为非负数', 'actualOpening');
        val(o.status === 'pending' || o.status === 'overdue', 'STATE_ERROR', '当前指令状态不可确认', 'status');
        const now = Date.now();
        const late = now > o.deadline;
        return DB.update('dispatchOrders', id, {
          actualOpening: +actualOpening, confirmTime: now,
          status: late ? 'overdue' : 'confirmed',
          trace: (o.trace || []).concat([
            { time: now, op: '接收方确认指令', by: o.receiver, node: 'ok' },
            { time: now + 1000, op: '回填实际开度', by: o.receiver, node: late ? 'warn' : 'ok' }
          ])
        });
      },
      close(id) {
        const o = this.get(id);
        return DB.update('dispatchOrders', id, { status: 'closed', trace: (o.trace || []).concat([{ time: Date.now(), op: '执行完毕归档', by: '系统', node: 'ok' }]) });
      },
      trace(id) {
        const o = this.get(id);
        return o.trace || [];
      },
      stats() {
        const rows = DB.all('dispatchOrders');
        const byGate = {};
        rows.forEach(o => {
          byGate[o.gateName] = byGate[o.gateName] || { gate: o.gateName, count: 0, confirmed: 0, totalResp: 0, respN: 0 };
          byGate[o.gateName].count++;
          if (o.status === 'confirmed' || o.status === 'closed') { byGate[o.gateName].confirmed++; if (o.confirmTime) { byGate[o.gateName].totalResp += (o.confirmTime - o.sendTime); byGate[o.gateName].respN++; } }
        });
        const gates = Object.values(byGate).map(g => ({ gate: g.gate, count: g.count, confirmed: g.confirmed, avgRespMin: g.respN ? Math.round(g.totalResp / g.respN / 60000) : 0 }));
        return {
          total: rows.length, pending: rows.filter(o => o.status === 'pending').length,
          confirmed: rows.filter(o => o.status === 'confirmed' || o.status === 'closed').length,
          overdue: rows.filter(o => o.status === 'overdue').length, byGate: gates
        };
      }
    },

    /* ====== InspectionController ====== */
    inspection: {
      list(filter) {
        let rows = DB.all('inspections');
        if (filter && filter.status) rows = rows.filter(t => t.status === filter.status);
        return rows.sort((a, b) => (a.dueDate - b.dueDate));
      },
      get(id) {
        val(id, 'VALIDATION_ERROR', '缺少任务ID', 'id');
        const t = DB.findOne('inspections', { _id: id });
        val(t, 'NOT_FOUND', '任务不存在', 'id');
        return t;
      },
      generatePlan(month) {
        val(month, 'VALIDATION_ERROR', '请选择月份', 'month');
        const routes = ['北堤段 0+000~2+500', '东坝段 2+500~5+000', '南渠段 5+000~8+000', '西闸段 8+000~10+500', '主坝面及溢洪道', '输水洞及启闭机房'];
        const inspectors = DB.find('contacts', { role: '巡检员' });
        const created = [];
        const base = new Date(month + '-01').getTime();
        for (let i = 0; i < routes.length; i++) {
          const ins = inspectors[i % inspectors.length];
          const t = { _id: 'ins_' + month.replace(/-/g, '') + '_' + i, month, route: routes[i], inspector: ins.name, status: 'pending', dueDate: base + (i + 1) * 4 * 86400000, defects: [], startedAt: null, finishedAt: null };
          created.push(DB.insert('inspections', t));
        }
        return created;
      },
      addDefect(taskId, defect) {
        const t = this.get(taskId);
        val(defect.severity, 'VALIDATION_ERROR', '请选择严重等级', 'severity');
        val(defect.part, 'VALIDATION_ERROR', '请关联工程部位', 'part');
        const d = {
          id: 'def_' + Date.now().toString(36), photo: !!defect.photo, photoData: defect.photoData || null,
          location: defect.location || t.route.split(' ')[0], severity: defect.severity, part: defect.part,
          status: 'open', createdAt: Date.now(), desc: defect.desc || ''
        };
        t.defects = t.defects || [];
        t.defects.push(d);
        return DB.update('inspections', taskId, { defects: t.defects });
      },
      resolveDefect(taskId, defectId) {
        const t = this.get(taskId);
        const d = (t.defects || []).find(x => x.id === defectId);
        val(d, 'NOT_FOUND', '缺陷不存在', 'defectId');
        d.status = 'closed';
        return DB.update('inspections', taskId, { defects: t.defects });
      },
      defectStats(filter) {
        const tasks = DB.all('inspections');
        const all = [];
        tasks.forEach(t => (t.defects || []).forEach(d => all.push(Object.assign({ task: t._id, route: t.route, inspector: t.inspector }, d))));
        let defs = all;
        if (filter && filter.severity) defs = defs.filter(d => d.severity === filter.severity);
        if (filter && filter.status) defs = defs.filter(d => d.status === filter.status);
        const bySev = { '一般': 0, '较重': 0, '严重': 0 };
        const byStatus = { open: 0, processing: 0, closed: 0 };
        defs.forEach(d => { bySev[d.severity] = (bySev[d.severity] || 0) + 1; byStatus[d.status] = (byStatus[d.status] || 0) + 1; });
        const byPart = {};
        defs.forEach(d => { byPart[d.part] = (byPart[d.part] || 0) + 1; });
        return { total: defs.length, bySev, byStatus, byPart: Object.entries(byPart).map(([k, v]) => ({ part: k, count: v })).sort((a, b) => b.count - a.count), list: defs };
      },
      stats() {
        const tasks = DB.all('inspections');
        return {
          total: tasks.length, pending: tasks.filter(t => t.status === 'pending').length,
          done: tasks.filter(t => t.status === 'done').length, overdue: tasks.filter(t => t.status === 'overdue').length,
          defects: tasks.reduce((s, t) => s + (t.defects ? t.defects.length : 0), 0)
        };
      }
    },

    /* ====== EmergencyController ====== */
    emergency: {
      planTree() {
        return DB.all('emergencyPlans').map(p => ({
          reservoirId: p.reservoirId, reservoirName: p.reservoirName,
          versions: p.versions
        }));
      },
      versions(reservoirId) {
        val(reservoirId, 'VALIDATION_ERROR', '缺少水库ID', 'reservoirId');
        return DB.all('emergencyPlans_' + reservoirId);
      },
      getVersion(vid) {
        const idx = DB.all('emergencyPlans');
        for (const p of idx) {
          const v = DB.all('emergencyPlans_' + p.reservoirId).find(x => x._id === vid || x.version === vid);
          if (v) return v;
        }
        return null;
      },
      diff(reservoirId, v1, v2) {
        const vers = this.versions(reservoirId);
        const a = vers.find(x => x._id === v1 || String(x.version) === String(v1)) || vers[0];
        const b = vers.find(x => x._id === v2 || String(x.version) === String(v2)) || vers[vers.length - 1];
        const out = [];
        const maxLv = Math.max(a.levels.length, b.levels.length);
        for (let i = 0; i < maxLv; i++) {
          const la = a.levels[i], lb = b.levels[i];
          const name = (lb || la).name;
          const lines = [];
          const setA = (la ? la.measures : []);
          const setB = (lb ? lb.measures : []);
          setB.forEach(m => lines.push(setA.includes(m) ? { type: 'eq', text: m } : { type: 'add', text: m }));
          setA.forEach(m => { if (!setB.includes(m)) lines.push({ type: 'del', text: m }); });
          out.push({ level: name, threshold: (lb || la).threshold, lines });
        }
        return { v1: a.version, v2: b.version, levels: out };
      },
      match(reservoirId, level) {
        val(reservoirId, 'VALIDATION_ERROR', '缺少水库ID', 'reservoirId');
        val(level != null && level >= 0, 'VALIDATION_ERROR', '水位须为非负数', 'level');
        const vers = this.versions(reservoirId).filter(v => !v.draft);
        const cur = vers.find(v => v.current) || vers[vers.length - 1];
        val(cur, 'NOT_FOUND', '未找到预案', 'reservoirId');
        const matched = cur.levels.slice().reverse().find(l => level >= l.threshold) || cur.levels[0];
        return {
          reservoirId, reservoirName: cur.reservoirName, version: cur.version, inputLevel: level,
          matchedLevel: matched.name, threshold: matched.threshold, measures: matched.measures,
          allLevels: cur.levels.map(l => ({ name: l.name, threshold: l.threshold, active: level >= l.threshold }))
        };
      }
    },

    /* ====== Contacts ====== */
    contacts: {
      list(role) {
        let rows = DB.all('contacts');
        if (role && role !== 'all') rows = rows.filter(c => c.role === role);
        const groups = {};
        rows.forEach(c => { (groups[c.group] = groups[c.group] || []).push(c); });
        return groups;
      },
      search(kw) {
        if (!kw) return this.list('all');
        const rows = DB.all('contacts').filter(c => c.name.indexOf(kw) >= 0 || String(c.phone).indexOf(kw) >= 0 || c.role.indexOf(kw) >= 0);
        const groups = {};
        rows.forEach(c => { (groups[c.group] = groups[c.group] || []).push(c); });
        return groups;
      },
      notify(ids, message) {
        val(ids && ids.length, 'VALIDATION_ERROR', '请选择通知对象', 'ids');
        val(message, 'VALIDATION_ERROR', '请填写通知内容', 'message');
        const now = Date.now();
        const logs = ids.map(id => {
          const c = DB.findOne('contacts', { _id: id });
          return { _id: 'nl_' + now.toString(36) + '_' + id, contactId: id, name: c ? c.name : id, phone: c ? c.phone : '', message, sentAt: now, status: 'sent' };
        });
        logs.forEach(l => DB.insert('notifyLogs', l));
        return { count: logs.length, sentAt: now, logs };
      },
      notifyLogs() { return DB.all('notifyLogs').sort((a, b) => b.sentAt - a.sentAt).slice(0, 50); }
    },

    /* ====== 统计聚合 ====== */
    report: {
      levelCurve(reservoirId, range) {
        const r = DB.findOne('reservoirs', { _id: reservoirId }) || DB.all('reservoirs')[0];
        const days = range === 'year' ? 365 : range === 'month' ? 30 : 1;
        const points = range === 'year' ? 36 : range === 'month' ? 30 : 24;
        return genHistory(r, points, range === 'day' ? 30 : (days * 24 / points) * 60, Date.now()).map(p => ({ t: p.t, level: p.level }));
      },
      rainfallIsohyet() {
        return DB.all('stations').map(s => ({ name: s.name, x: s.location.x, y: s.location.y, value: s.rainfall + Math.round(Math.random() * 8 - 4) }));
      },
      dispatchOps() { return API.dispatch.stats(); },
      defectRatio() { return API.inspection.defectStats({}); }
    }
  };

  API.ApiError = ApiError;
  global.API = API;
})(window);
