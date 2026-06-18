/* MockDB — 浏览器端模拟 MongoDB 集合，localStorage 持久化 */
/* 对应生产环境 ASP.NET Core 8.0 + MongoDB 7.0 的数据访问层 */
(function (global) {
  const PREFIX = 'wcm_';

  function read(col) {
    try { return JSON.parse(localStorage.getItem(PREFIX + col)) || []; }
    catch (e) { return []; }
  }
  function write(col, data) { localStorage.setItem(PREFIX + col, JSON.stringify(data)); }
  function uid(p) { return (p || 'id') + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }

  function match(doc, q) {
    if (!q) return true;
    for (const k in q) {
      const cond = q[k], v = doc[k];
      if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
        if ('$gte' in cond && !(v >= cond.$gte)) return false;
        if ('$lte' in cond && !(v <= cond.$lte)) return false;
        if ('$gt' in cond && !(v > cond.$gt)) return false;
        if ('$lt' in cond && !(v < cond.$lt)) return false;
        if ('$in' in cond && !cond.$in.includes(v)) return false;
        if ('$ne' in cond && v === cond.$ne) return false;
      } else if (v !== cond) return false;
    }
    return true;
  }

  // 确定性伪随机，用于历史时序数据生成（模拟5年3000万条采样的代表性切片）
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const DB = {
    find(col, q) { return read(col).filter(d => match(d, q)); },
    findOne(col, q) { return read(col).find(d => match(d, q)) || null; },
    insert(col, doc) { const a = read(col); doc._id = doc._id || uid(col.slice(0, 2)); a.push(doc); write(col, a); return doc; },
    update(col, id, patch) { const a = read(col); const i = a.findIndex(d => d._id === id); if (i < 0) return null; a[i] = Object.assign({}, a[i], patch, { _id: id }); write(col, a); return a[i]; },
    remove(col, id) { write(col, read(col).filter(d => d._id !== id)); },
    count(col, q) { return read(col).filter(d => match(d, q)).length; },
    all(col) { return read(col); },
    raw: { read, write, uid },
    rng: mulberry32,
    isSeeded() { return !!localStorage.getItem(PREFIX + 'reservoirs'); },
    reset() { ['reservoirs', 'stations', 'gates', 'dispatchOrders', 'inspections', 'emergencyPlans', 'contacts', 'notifyLogs']
      .forEach(c => localStorage.removeItem(PREFIX + c)); seed(); }
  };

  /* ---------------- 种子数据 ---------------- */
  function seed() {
    if (DB.isSeeded()) return;

    const reservoirs = [
      { name: '青山水库', code: 'QS', x: 22, y: 28, lat: 30.12, lng: 119.61, warn: 85.0, danger: 88.5, normal: 78.0, cap: 1.2, level: 83.4, inflow: 320, rain: 18 },
      { name: '翠湖水库', code: 'CH', x: 41, y: 19, lat: 30.34, lng: 119.88, warn: 76.5, danger: 80.0, normal: 70.0, cap: 0.8, level: 71.2, inflow: 140, rain: 9 },
      { name: '龙潭水库', code: 'LT', x: 60, y: 34, lat: 30.51, lng: 120.10, warn: 112.0, danger: 116.0, normal: 104.0, cap: 2.1, level: 113.4, inflow: 880, rain: 46 },
      { name: '凤栖水库', code: 'FQ', x: 31, y: 56, lat: 29.88, lng: 119.72, warn: 95.0, danger: 99.0, normal: 88.0, cap: 1.5, level: 90.6, inflow: 260, rain: 12 },
      { name: '白云水库', code: 'BY', x: 70, y: 61, lat: 29.74, lng: 120.24, warn: 64.0, danger: 67.5, normal: 58.0, cap: 0.6, level: 59.1, inflow: 95, rain: 6 },
      { name: '红旗水库', code: 'HQ', x: 50, y: 73, lat: 29.62, lng: 119.95, warn: 130.0, danger: 134.5, normal: 121.0, cap: 3.0, level: 131.8, inflow: 1240, rain: 58 },
      { name: '东溪水库', code: 'DX', x: 82, y: 43, lat: 29.91, lng: 120.41, warn: 58.0, danger: 61.5, normal: 52.0, cap: 0.9, level: 54.3, inflow: 180, rain: 14 },
      { name: '西涧水库', code: 'XJ', x: 76, y: 80, lat: 29.55, lng: 120.33, warn: 102.5, danger: 106.0, normal: 95.0, cap: 1.8, level: 103.1, inflow: 690, rain: 39 }
    ];

    const gates = [
      { name: '青山泄洪闸', rid: 0, max: 100, type: '泄洪' }, { name: '青山输水闸', rid: 0, max: 100, type: '输水' },
      { name: '翠湖泄洪闸', rid: 1, max: 100, type: '泄洪' }, { name: '翠湖进水闸', rid: 1, max: 100, type: '进水' },
      { name: '龙潭主闸', rid: 2, max: 200, type: '泄洪' }, { name: '龙潭副闸', rid: 2, max: 150, type: '泄洪' },
      { name: '凤栖泄洪闸', rid: 3, max: 100, type: '泄洪' }, { name: '白云泄洪闸', rid: 4, max: 100, type: '泄洪' },
      { name: '红旗主泄洪闸', rid: 5, max: 250, type: '泄洪' }, { name: '红旗东闸', rid: 5, max: 150, type: '泄洪' },
      { name: '东溪节制闸', rid: 6, max: 100, type: '节制' }, { name: '西涧泄洪闸', rid: 7, max: 200, type: '泄洪' },
      { name: '西涧分洪闸', rid: 7, max: 150, type: '分洪' },
      { name: '干渠节制闸', rid: null, max: 120, type: '节制' }, { name: '河口挡潮闸', rid: null, max: 180, type: '挡潮' }
    ];

    const stations = [
      { name: '青山雨量站', x: 26, y: 24, rid: 0 }, { name: '翠湖雨量站', x: 38, y: 25, rid: 1 },
      { name: '龙潭雨量站', x: 64, y: 30, rid: 2 }, { name: '北源雨量站', x: 52, y: 16, rid: null },
      { name: '凤栖雨量站', x: 27, y: 52, rid: 3 }, { name: '中游雨量站', x: 45, y: 48, rid: null },
      { name: '白云雨量站', x: 74, y: 57, rid: 4 }, { name: '红旗雨量站', x: 46, y: 78, rid: 5 },
      { name: '南港雨量站', x: 58, y: 84, rid: null }, { name: '东溪雨量站', x: 86, y: 47, rid: 6 },
      { name: '西涧雨量站', x: 80, y: 74, rid: 7 }, { name: '下游雨量站', x: 90, y: 88, rid: null }
    ];

    const resDocs = reservoirs.map((r, i) => ({
      _id: 'res_' + i, name: r.name, code: r.code, type: 'reservoir',
      warningLevel: r.warn, dangerLevel: r.danger, normalLevel: r.normal,
      capacity: r.cap, location: { x: r.x, y: r.y, lat: r.lat, lng: r.lng },
      current: { level: r.level, inflow: r.inflow, rainfall: r.rain, updatedAt: new Date().toISOString() },
      seed: 1000 + i * 7
    }));
    write('reservoirs', resDocs);

    const gateDocs = gates.map((g, i) => ({
      _id: 'gate_' + i, name: g.name, reservoirId: g.rid === null ? null : 'res_' + g.rid,
      reservoirName: g.rid === null ? '河道' : reservoirs[g.rid].name, maxOpening: g.max, type: g.type,
      currentOpening: Math.round(Math.random() * g.max * 0.4)
    }));
    write('gates', gateDocs);

    write('stations', stations.map((s, i) => ({
      _id: 'st_' + i, name: s.name, type: 'rainStation', location: { x: s.x, y: s.y },
      reservoirId: s.rid === null ? null : 'res_' + s.rid,
      rainfall: Math.round(40 - Math.random() * 30 + (s.rid !== null ? resDocs[s.rid].current.rainfall : 0))
    })));

    /* 调度指令种子 */
    const now = Date.now();
    const senders = ['调度员·王建国', '调度员·李志远', '调度员·赵敏'];
    const receivers = ['巡检员·张磊', '闸门班·刘洋', '巡检员·陈昊', '闸门班·孙强'];
    const orders = [];
    const statuses = ['pending', 'confirmed', 'overdue', 'closed'];
    for (let i = 0; i < 14; i++) {
      const g = gateDocs[i % gateDocs.length];
      const st = statuses[i % 4];
      const send = now - (i + 1) * 37 * 60000;
      const opening = 20 + Math.round(Math.random() * 60);
      const confirmed = st === 'confirmed' || st === 'closed';
      orders.push({
        _id: 'do_' + i, code: 'DD' + new Date(send).toISOString().slice(0, 10).replace(/-/g, '') + String(101 + i),
        gateId: g._id, gateName: g.name, reservoirName: g.reservoirName,
        opening, actualOpening: confirmed ? opening + Math.round((Math.random() - 0.5) * 10) : null,
        sender: senders[i % 3], receiver: receivers[i % 4], sendTime: send,
        deadline: send + 30 * 60000, confirmTime: confirmed ? send + Math.round(Math.random() * 25 + 3) * 60000 : null,
        status: st, remark: st === 'overdue' ? '接收方未在规定时间内确认' : (st === 'closed' ? '执行完毕，现场正常' : '请尽快确认并回填实际开度'),
        trace: buildTrace(st, send, confirmed ? send + 18 * 60000 : null)
      });
    }
    write('dispatchOrders', orders);

    /* 巡检任务种子 */
    const inspNames = ['周建国', '吴海涛', '郑文斌', '冯小军', '蒋明', '韩志刚', '杨建华', '朱伟'];
    const routes = ['北堤段 0+000~2+500', '东坝段 2+500~5+000', '南渠段 5+000~8+000', '西闸段 8+000~10+500', '主坝面及溢洪道', '输水洞及启闭机房'];
    const parts = ['坝顶', '上游护坡', '下游护坡', '溢洪道', '输水洞', '闸门启闭机', '坝肩', '排水沟'];
    const sevPool = ['一般', '较重', '严重'];
    const tasks = [];
    const monthKey = new Date().toISOString().slice(0, 7);
    for (let i = 0; i < 10; i++) {
      const done = i < 5;
      const defects = [];
      if (done) {
        const dn = 1 + (i % 3);
        for (let j = 0; j < dn; j++) {
          defects.push({
            id: 'def_' + i + '_' + j, photo: true, location: routes[i % routes.length].split(' ')[0],
            severity: sevPool[j % 3], part: parts[(i + j) % parts.length],
            status: j === 0 ? 'closed' : (j === 1 ? 'processing' : 'open'),
            createdAt: now - (i + 1) * 86400000 + j * 3600000,
            desc: ['护坡局部塌陷约0.5㎡', '启闭机润滑不足有异响', '排水沟淤积阻塞', '坝顶路面裂缝长约1.2m', '闸门止水橡胶老化渗水'][j % 5]
          });
        }
      }
      tasks.push({
        _id: 'ins_' + i, month: monthKey, route: routes[i % routes.length], inspector: inspNames[i % inspNames.length],
        status: done ? 'done' : (i < 8 ? 'pending' : 'overdue'), dueDate: now + (i - 4) * 86400000, defects,
        startedAt: done ? now - (i + 1) * 86400000 : null, finishedAt: done ? now - i * 86400000 : null
      });
    }
    write('inspections', tasks);

    /* 防汛预案版本种子（每水库2-3版本） */
    const planVersions = {};
    resDocs.forEach((r, ri) => {
      const levels = [
        { name: 'Ⅳ级响应', threshold: r.warningLevel, measures: ['加强水位监测，每30分钟上报一次', '通知相关水库管理所做好防汛准备', '检查闸门启闭设备运行状态'] },
        { name: 'Ⅲ级响应', threshold: r.warningLevel + (r.dangerLevel - r.warningLevel) * 0.35, measures: ['每15分钟上报水情，启动24小时值班', '开启泄洪闸预泄，控制库水位上涨', '通知下游沿河乡镇做好转移准备', '巡检人员到岗排查工程隐患'] },
        { name: 'Ⅱ级响应', threshold: r.warningLevel + (r.dangerLevel - r.warningLevel) * 0.7, measures: ['加大泄洪流量，维持库水位在警戒以下', '组织下游危险区域人员转移', '每10分钟上报水情与闸门操作', '请求上级防指支援'] },
        { name: 'Ⅰ级响应', threshold: r.dangerLevel, measures: ['全力泄洪，确保大坝安全', '下游全部人员紧急转移', '启动应急通讯，每5分钟会商', '请求部队与专业抢险队增援'] }
      ];
      planVersions[r._id] = levels;
      const versions = [];
      // v1 旧版
      versions.push({ _id: 'pl_' + ri + '_v1', reservoirId: r._id, reservoirName: r.name, version: 1, publishTime: now - 400 * 86400000, author: '管理员·钱正', levels: JSON.parse(JSON.stringify(levels)).map(l => { l.measures = l.measures.slice(0, 2); return l; }) });
      // v2 当前版（部分修订）
      const v2 = JSON.parse(JSON.stringify(levels));
      v2[1].measures.push('启用应急广播系统发布预警信息'); // 新增
      v2[2].measures[1] = '组织下游危险区域人员有序转移至安置点'; // 修改
      v2[3].measures.splice(3, 1); // 删除一条
      versions.push({ _id: 'pl_' + ri + '_v2', reservoirId: r._id, reservoirName: r.name, version: 2, publishTime: now - 120 * 86400000, author: '管理员·钱正', levels: v2, current: true });
      // v3 草案（仅红旗水库有）
      if (ri === 5) {
        const v3 = JSON.parse(JSON.stringify(v2));
        v3[0].measures.push('同步推送短信预警至全体防汛责任人');
        versions.push({ _id: 'pl_' + ri + '_v3', reservoirId: r._id, reservoirName: r.name, version: 3, publishTime: now - 15 * 86400000, author: '管理员·孙慧', levels: v3, draft: true });
      }
      versions.forEach(v => { /* version docs stored below */ });
      write('emergencyPlans_' + r._id, versions);
    });
    // 集中索引
    const planIndex = resDocs.map(r => ({ _id: 'plidx_' + r._id, reservoirId: r._id, reservoirName: r.name, versions: read('emergencyPlans_' + r._id).map(v => ({ id: v._id, version: v.version, publishTime: v.publishTime, current: !!v.current, draft: !!v.draft })) }));
    write('emergencyPlans', planIndex);

    /* 通讯录种子（调度员6/巡检员30/管理员3/维护若干） */
    const surnames = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗'];
    const givens = ['伟', '芳', '娜', '敏', '静', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '建国', '志远', '海涛', '文斌'];
    const contacts = [];
    function mk(role, group, count, prefix) {
      for (let i = 0; i < count; i++) {
        contacts.push({
          _id: 'ct_' + role + '_' + i, name: surnames[(i * 3) % surnames.length] + givens[(i * 5) % givens.length] + (count > 10 ? String(i + 1).padStart(2, '0') : ''),
          role, group, phone: '1' + (3 + (i % 7)) + (100000000 + Math.floor(Math.random() * 899999999)),
          position: prefix + (i + 1)
        });
      }
    }
    mk('调度员', '调度中心', 6, '调度员');
    mk('巡检员', '工程巡查', 30, '巡查组');
    mk('管理员', '指挥决策', 3, '管理员');
    mk('维护人员', '设备维护', 6, '闸门班');
    contacts.push({ _id: 'ct_extra_1', name: '市防指值班室', role: '上级', group: '外部联络', phone: '0571-12345678', position: '上级防指' });
    write('contacts', contacts);
    write('notifyLogs', []);
  }

  function buildTrace(status, send, confirm) {
    const t = [{ time: send, op: '指令下发', by: '调度员', node: 'start' }];
    if (status === 'pending') { t.push({ time: send + 60000, op: '推送至接收方', by: '系统', node: 'info' }); }
    if (confirm) {
      t.push({ time: confirm, op: '接收方确认指令', by: '接收方', node: 'ok' });
      t.push({ time: confirm + 300000, op: '回填实际开度', by: '接收方', node: 'ok' });
    }
    if (status === 'overdue') t.push({ time: send + 30 * 60000, op: '超时未确认', by: '系统', node: 'bad' });
    if (status === 'closed') t.push({ time: (confirm || send) + 600000, op: '执行完毕归档', by: '系统', node: 'ok' });
    return t;
  }

  global.DB = DB;
  global.DBSeed = seed;
  seed();
})(window);
