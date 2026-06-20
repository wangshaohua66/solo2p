/* ==========================================================================
   data.service.js — 数据服务层
   封装 LocalStorage 持久化、种子数据生成、CPM 关键路径计算、资源冲突检测
   ========================================================================== */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'cps_data_v1';
  var MAX_BYTES = 10 * 1024 * 1024; // 10MB 上限

  var DS = {
    _cache: null,
    version: '1.0.0'
  };

  /* ---------- 底层读写 ---------- */
  function readRaw() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('[DataService] 读取本地数据失败', e);
      return null;
    }
  }
  function writeRaw(data) {
    data.version = DS.version;
    data.updatedAt = new Date().toISOString();
    var json = JSON.stringify(data);
    if (json.length > MAX_BYTES) {
      throw new Error('数据体积超过 10MB 上限，请导出并清理后再操作。当前占用约 ' + (json.length / 1024 / 1024).toFixed(2) + ' MB');
    }
    localStorage.setItem(STORAGE_KEY, json);
    DS._cache = data;
    return data;
  }

  DS.load = function () {
    if (DS._cache) return DS._cache;
    var data = readRaw();
    if (!data) {
      data = DS.seed();
    }
    DS._cache = data;
    return data;
  };

  DS.persist = function () {
    var data = DS._cache || DS.load();
    writeRaw(data);
    return data;
  };

  DS.reset = function () {
    DS._cache = null;
    localStorage.removeItem(STORAGE_KEY);
    return DS.seed();
  };

  DS.getStorageUsage = function () {
    var raw = localStorage.getItem(STORAGE_KEY) || '';
    return { bytes: raw.length, mb: +(raw.length / 1024 / 1024).toFixed(2), limit: 10 };
  };

  DS.exportJSON = function () {
    var data = DS.load();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'construction-progress-backup-' + moment().format('YYYYMMDD-HHmm') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  DS.importJSON = function (file, done, fail) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!data.projects || !data.tasks) throw new Error('文件结构不合法');
        writeRaw(data);
        done && done(data);
      } catch (err) {
        fail && fail(err);
      }
    };
    reader.onerror = function () { fail && fail(reader.error); };
    reader.readAsText(file);
  };

  /* ---------- 通用 ID ---------- */
  DS.uid = function (prefix) {
    return (prefix || 'X') + Date.now().toString(36).slice(-5).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
  };

  /* ========================================================================
     种子数据生成
     ======================================================================== */
  DS.seed = function () {
    var data = { projects: [], tasks: [], resources: [], progressLogs: [], warnings: [], changes: [] };

    var projectTemplates = [
      { name: '滨江壹号住宅小区', type: '住宅', stage: '主体', mgr: '张建国', risk: '中', dur: 360 },
      { name: '云岭商务广场', type: '商业', stage: '基础', mgr: '李明轩', risk: '高', dur: 420 },
      { name: '经开市政主干道工程', type: '市政', stage: '主体', mgr: '王海涛', risk: '低', dur: 300 },
      { name: '翠湖湾住宅一期', type: '住宅', stage: '装饰', mgr: '陈志强', risk: '低', dur: 330 },
      { name: '中央金融中心', type: '商业', stage: '主体', mgr: '刘德海', risk: '高', dur: 540 },
      { name: '城南污水处理厂', type: '市政', stage: '基础', mgr: '赵建国', risk: '中', dur: 390 },
      { name: '锦绣华庭住宅小区', type: '住宅', stage: '基础', mgr: '孙伟', risk: '中', dur: 350 },
      { name: '环球贸易大厦', type: '商业', stage: '装饰', mgr: '周建华', risk: '中', dur: 480 },
      { name: '滨河路改造工程', type: '市政', stage: '装饰', mgr: '吴永刚', risk: '低', dur: 270 },
      { name: '阳光花园保障房', type: '住宅', stage: '主体', mgr: '郑国良', risk: '高', dur: 380 },
      { name: '万达商业综合体', type: '商业', stage: '基础', mgr: '黄文博', risk: '高', dur: 560 },
      { name: '高新园区路网工程', type: '市政', stage: '主体', mgr: '梁志远', risk: '中', dur: 320 },
      { name: '万科城三期住宅', type: '住宅', stage: '竣工', mgr: '徐立军', risk: '低', dur: 300 },
      { name: '国际会展中心', type: '商业', stage: '主体', mgr: '胡庆丰', risk: '中', dur: 500 },
      { name: '北环快速路桥梁', type: '市政', stage: '基础', mgr: '郭海军', risk: '高', dur: 410 }
    ];

    var today = moment('2026-06-20');
    var taskCategories = ['钢筋绑扎', '混凝土浇筑', '模板支设', '土方开挖', '桩基施工', '砌筑工程', '抹灰工程', '水电安装', '外墙保温', '屋面工程', '脚手架搭设', '防水工程'];
    var teamNames = ['钢筋一班', '钢筋二班', '模板班组', '混凝土班组', '架子工班', '水电班组', '泥工班组', '防水班组'];
    var equipNames = ['塔吊 TC6010', '挖掘机 CAT320', '混凝土泵车', '施工升降机', '汽车吊 QY25', '装载机 ZL50'];

    projectTemplates.forEach(function (tpl, idx) {
      var pid = 'P' + String(idx + 1).padStart(3, '0');
      var start = today.clone().subtract(tpl.dur * (0.3 + Math.random() * 0.3), 'days');
      var end = start.clone().add(tpl.dur, 'days');
      var project = {
        id: pid, name: tpl.name, type: tpl.type, stage: tpl.stage,
        riskLevel: tpl.risk, startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'), manager: tpl.mgr,
        progress: 0, createdAt: start.clone().subtract(7, 'days').format('YYYY-MM-DD'),
        order: idx
      };
      data.projects.push(project);

      // 资源
      var resources = [];
      var teamCount = 3 + Math.floor(Math.random() * 2);
      for (var t = 0; t < teamCount; t++) {
        var rid = 'R' + pid.slice(1) + 'T' + t;
        resources.push({ id: rid, projectId: pid, name: teamNames[(t + idx) % teamNames.length], type: '班组', startDate: project.startDate, endDate: project.endDate, capacity: 12 + Math.floor(Math.random() * 12) });
      }
      var equipCount = 2 + Math.floor(Math.random() * 2);
      for (var e = 0; e < equipCount; e++) {
        var eid = 'R' + pid.slice(1) + 'E' + e;
        resources.push({ id: eid, projectId: pid, name: equipNames[(e + idx) % equipNames.length], type: '设备', startDate: project.startDate, endDate: project.endDate, capacity: 1 });
      }
      resources.forEach(function (r) { data.resources.push(r); });

      // 任务节点（~38 个，含依赖链）
      var tasks = [];
      var phases = [
        { name: '基础工程', count: 9 },
        { name: '主体结构', count: 12 },
        { name: '装饰装修', count: 9 },
        { name: '机电与收尾', count: 8 }
      ];
      var cursor = start.clone();
      var prevIds = [];
      var seq = 0;
      phases.forEach(function (ph, pi) {
        var phaseStart = cursor.clone();
        var phasePrevIds = prevIds.slice();
        for (var i = 0; i < ph.count; i++) {
          var cat = taskCategories[(seq + idx) % taskCategories.length];
          var dur = 4 + Math.floor(Math.random() * 12);
          var ts = phaseStart.clone();
          if (phasePrevIds.length) {
            // 链接到前一阶段末任务或本阶段前一个
            var depId = (i === 0) ? phasePrevIds[phasePrevIds.length - 1] : tasks[tasks.length - 1].id;
            var depTask = tasks.find(function (x) { return x.id === depId; });
            if (depTask) ts = moment(depTask.endDate);
          }
          var te = ts.clone().add(dur, 'days');
          var plannedPct = 0;
          var actualPct = 0;
          if (te.isBefore(today)) { plannedPct = 100; actualPct = Math.min(100, 80 + Math.floor(Math.random() * 25)); }
          else if (ts.isBefore(today)) { plannedPct = Math.round(today.diff(ts, 'days') / dur * 100); actualPct = Math.max(0, plannedPct - Math.floor(Math.random() * 30)); }
          else { plannedPct = 0; actualPct = 0; }
          var res = resources[seq % resources.length];
          var task = {
            id: pid + 'K' + String(seq + 1).padStart(3, '0'),
            projectId: pid, name: ph.name + '-' + cat + (i + 1),
            phase: ph.name, category: cat,
            startDate: ts.format('YYYY-MM-DD'), endDate: te.format('YYYY-MM-DD'),
            duration: dur, progress: actualPct, plannedPercent: plannedPct,
            predecessorIds: phasePrevIds.length && i === 0 ? phasePrevIds[phasePrevIds.length - 1] : (i > 0 ? tasks[tasks.length - 1].id : ''),
            isCritical: false, floatDays: 0, resourceId: res.id,
            assignee: res.type === '班组' ? res.name : '设备调度', milestone: false
          };
          tasks.push(task);
          seq++;
          if (i === ph.count - 1) { cursor = te.clone(); prevIds = [task.id]; }
        }
      });

      // 随机加入并行分支（独立链，链接到主链某任务，制造浮动）
      var branchStart = tasks[Math.floor(tasks.length / 2)];
      if (branchStart) {
        var bcursor = moment(branchStart.endDate);
        for (var b = 0; b < 5; b++) {
          var bcat = taskCategories[(b + idx + 3) % taskCategories.length];
          var bdur = 3 + Math.floor(Math.random() * 8);
          var bte = bcursor.clone().add(bdur, 'days');
          var btask = {
            id: pid + 'B' + String(b + 1).padStart(3, '0'),
            projectId: pid, name: '附属-' + bcat + (b + 1),
            phase: '附属工程', category: bcat,
            startDate: bcursor.format('YYYY-MM-DD'), endDate: bte.format('YYYY-MM-DD'),
            duration: bdur, progress: bte.isBefore(today) ? 100 : (bcursor.isBefore(today) ? Math.floor(Math.random() * 60) : 0),
            plannedPercent: bte.isBefore(today) ? 100 : 0,
            predecessorIds: b === 0 ? branchStart.id : tasks[tasks.length - 1].id,
            isCritical: false, floatDays: 0,
            resourceId: resources[(b + 1) % resources.length].id,
            assignee: '附属班组', milestone: false
          };
          tasks.push(btask);
          bcursor = bte.clone();
        }
      }

      tasks.forEach(function (tk) { data.tasks.push(tk); });

      // 进度填报（已完成或在进行的任务）
      tasks.filter(function (tk) { return tk.progress > 0 && tk.progress < 100; }).slice(0, 6).forEach(function (tk) {
        var logDate = today.clone().subtract(Math.floor(Math.random() * 5), 'days');
        var deviation = tk.progress - tk.plannedPercent;
        data.progressLogs.push({
          id: DS.uid('L'), taskId: tk.id, projectId: pid,
          reportDate: logDate.format('YYYY-MM-DD'),
          actualPercent: tk.progress, actualHours: tk.duration * 8 * (0.6 + Math.random() * 0.6),
          photos: [], deviation: deviation, note: '现场施工正常推进'
        });
      });
    });

    // 计算关键路径与项目进度
    data.projects.forEach(function (p) {
      DS.recomputeProject(data, p.id);
    });

    // 生成预警
    data.warnings = DS.generateWarnings(data);

    writeRaw(data);
    DS._cache = data;
    return data;
  };

  /* ========================================================================
     CPM 关键路径 / 浮动时间计算
     ======================================================================== */
  DS.computeCriticalPath = function (tasks) {
    var byId = {};
    tasks.forEach(function (t) { byId[t.id] = t; });
    // 前置/后置
    var succ = {}; tasks.forEach(function (t) { succ[t.id] = []; });
    tasks.forEach(function (t) {
      if (t.predecessorIds) {
        String(t.predecessorIds).split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (pid) {
          if (byId[pid] && succ[pid].indexOf(t.id) < 0) succ[pid].push(t.id);
        });
      }
    });
    // 拓扑序
    var indeg = {}; tasks.forEach(function (t) { indeg[t.id] = 0; });
    tasks.forEach(function (t) { succ[t.id].forEach(function (s) { indeg[s]++; }); });
    var queue = tasks.filter(function (t) { return indeg[t.id] === 0; }).map(function (t) { return t.id; });
    var topo = [];
    while (queue.length) {
      var n = queue.shift(); topo.push(n);
      succ[n].forEach(function (s) { if (--indeg[s] === 0) queue.push(s); });
    }
    // 前向 ES/EF（以天为单位偏移，基准取最小 startDate）
    var base = null;
    tasks.forEach(function (t) { var d = moment(t.startDate); if (!base || d.isBefore(base)) base = d; });
    if (!base) base = moment();
    var es = {}, ef = {};
    topo.forEach(function (id) {
      var t = byId[id];
      var est = 0;
      var preds = t.predecessorIds ? String(t.predecessorIds).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
      preds.forEach(function (pid) { if (ef[pid] != null && ef[pid] > est) est = ef[pid]; });
      es[id] = est; ef[id] = est + (t.duration || 1);
    });
    var maxEF = 0; for (var k in ef) if (ef[k] > maxEF) maxEF = ef[k];
    // 后向 LS/LF
    var ls = {}, lf = {};
    var rev = topo.slice().reverse();
    rev.forEach(function (id) {
      var t = byId[id];
      var s = succ[id];
      var lft = maxEF;
      s.forEach(function (sid) { if (ls[sid] != null && ls[sid] < lft) lft = ls[sid]; });
      lf[id] = lft; ls[id] = lft - (t.duration || 1);
    });
    // 浮动 = LF - EF
    tasks.forEach(function (t) {
      var f = (lf[t.id] != null ? lf[t.id] : 0) - (ef[t.id] != null ? ef[t.id] : 0);
      t.floatDays = Math.max(0, Math.round(f));
      t.isCritical = Math.abs(f) < 0.001;
    });
    return { critical: tasks.filter(function (t) { return t.isCritical; }).map(function (t) { return t.id; }), es: es, ef: ef, ls: ls, lf: lf, duration: maxEF };
  };

  DS.recomputeProject = function (data, projectId) {
    var tasks = data.tasks.filter(function (t) { return t.projectId === projectId; });
    DS.computeCriticalPath(tasks);
    var total = tasks.length;
    var done = tasks.filter(function (t) { return t.progress >= 100; }).length;
    var prog = total ? Math.round(tasks.reduce(function (s, t) { return s + t.progress; }, 0) / total) : 0;
    var proj = data.projects.find(function (p) { return p.id === projectId; });
    if (proj) proj.progress = prog;
    return proj;
  };

  /* ========================================================================
     资源冲突检测（同一资源同一日期被多任务占用）
     ======================================================================== */
  DS.detectResourceConflicts = function (data, projectId) {
    var tasks = data.tasks.filter(function (t) { return (!projectId || t.projectId === projectId) && t.resourceId; });
    var map = {}; // resourceId -> { date -> [taskIds] }
    tasks.forEach(function (t) {
      var d = moment(t.startDate), e = moment(t.endDate);
      while (d.isSameOrBefore(e)) {
        var key = t.resourceId + '|' + d.format('YYYY-MM-DD');
        (map[key] = map[key] || []).push(t);
        d.add(1, 'day');
      }
    });
    var conflicts = [];
    for (var key in map) {
      if (map[key].length > 1) {
        var parts = key.split('|');
        conflicts.push({ resourceId: parts[0], date: parts[1], tasks: map[key].map(function (t) { return { id: t.id, name: t.name, projectId: t.projectId }; }) });
      }
    }
    return conflicts;
  };

  /* ========================================================================
     预警生成
     ======================================================================== */
  DS.generateWarnings = function (data, projectId) {
    var warns = (data.warnings || []).filter(function (w) { return w.status !== '待处理'; });
    var today = moment('2026-06-20');
    var projects = data.projects.filter(function (p) { return !projectId || p.id === projectId; });
    projects.forEach(function (p) {
      var tasks = data.tasks.filter(function (t) { return t.projectId === p.id; });
      // 1) 工期延误：在进行的任务 实际进度 < 计划进度 且差值 > 15
      tasks.forEach(function (t) {
        if (t.progress < 100 && moment(t.startDate).isSameOrBefore(today) && t.plannedPercent > 0) {
          var dev = t.plannedPercent - t.progress;
          if (dev >= 15) {
            warns.push({
              id: DS.uid('W'), projectId: p.id, type: '工期延误',
              severity: dev >= 30 ? '高' : (dev >= 20 ? '中' : '低'),
              status: '待处理',
              description: '任务「' + t.name + '」计划完成 ' + t.plannedPercent + '%，实际仅 ' + t.progress + '%，偏差 ' + dev + '%。',
              refId: t.id, refType: 'task', createdAt: today.format('YYYY-MM-DD')
            });
          }
        }
      });
      // 2) 关键节点滞后：关键路径任务延期
      tasks.filter(function (t) { return t.isCritical && t.progress < 100 && moment(t.endDate).isBefore(today); }).forEach(function (t) {
        warns.push({
          id: DS.uid('W'), projectId: p.id, type: '关键节点滞后',
          severity: '高', status: '待处理',
          description: '关键路径任务「' + t.name + '」应于 ' + t.endDate + ' 完成，当前进度 ' + t.progress + '%，已滞后 ' + today.diff(moment(t.endDate), 'days') + ' 天。',
          refId: t.id, refType: 'task', createdAt: today.format('YYYY-MM-DD')
        });
      });
    });
    // 3) 资源冲突
    var conflicts = DS.detectResourceConflicts(data, projectId);
    conflicts.slice(0, 12).forEach(function (c) {
      var res = data.resources.find(function (r) { return r.id === c.resourceId; });
      warns.push({
        id: DS.uid('W'), projectId: c.tasks[0].projectId, type: '资源冲突',
        severity: '中', status: '待处理',
        description: (res ? res.name : c.resourceId) + ' 在 ' + c.date + ' 被 ' + c.tasks.length + ' 个任务同时占用，存在超载风险。',
        refId: c.resourceId, refType: 'resource', createdAt: today.format('YYYY-MM-DD')
      });
    });
    return warns;
  };

  DS.refreshWarnings = function (data, projectId) {
    data.warnings = DS.generateWarnings(data, projectId);
    DS.persist();
    return data.warnings;
  };

  /* ========================================================================
     业务 CRUD
     ======================================================================== */
  DS.getProjects = function () { return DS.load().projects; };
  DS.getProject = function (id) { return DS.load().projects.find(function (p) { return p.id === id; }); };
  DS.saveProject = function (p) {
    var data = DS.load();
    var i = data.projects.findIndex(function (x) { return x.id === p.id; });
    if (i >= 0) data.projects[i] = p; else { p.id = p.id || DS.uid('P'); p.order = data.projects.length; data.projects.push(p); }
    DS.persist(); return p;
  };
  DS.deleteProject = function (id) {
    var data = DS.load();
    data.projects = data.projects.filter(function (p) { return p.id !== id; });
    data.tasks = data.tasks.filter(function (t) { return t.projectId !== id; });
    data.resources = data.resources.filter(function (r) { return r.projectId !== id; });
    data.progressLogs = data.progressLogs.filter(function (l) { return l.projectId !== id; });
    data.warnings = data.warnings.filter(function (w) { return w.projectId !== id; });
    data.changes = data.changes.filter(function (c) { return c.projectId !== id; });
    DS.persist();
  };
  DS.reorderProjects = function (orders) {
    var data = DS.load();
    orders.forEach(function (id, i) { var p = data.projects.find(function (x) { return x.id === id; }); if (p) p.order = i; });
    DS.persist();
  };

  DS.getTasks = function (projectId) { return DS.load().tasks.filter(function (t) { return !projectId || t.projectId === projectId; }); };
  DS.getTask = function (id) { return DS.load().tasks.find(function (t) { return t.id === id; }); };
  DS.saveTask = function (t, opts) {
    var data = DS.load();
    var i = data.tasks.findIndex(function (x) { return x.id === t.id; });
    if (i >= 0) data.tasks[i] = t; else { t.id = t.id || DS.uid('T'); data.tasks.push(t); }
    t.duration = Math.max(1, moment(t.endDate).diff(moment(t.startDate), 'days') + 1);
    if (!(opts && opts.skipRecompute)) DS.recomputeProject(data, t.projectId);
    DS.persist(); return t;
  };
  DS.deleteTask = function (id) {
    var data = DS.load();
    var t = data.tasks.find(function (x) { return x.id === id; });
    data.tasks = data.tasks.filter(function (x) { return x.id !== id; });
    // 清理依赖
    data.tasks.forEach(function (x) {
      if (x.predecessorIds) {
        var kept = String(x.predecessorIds).split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s && s !== id; });
        x.predecessorIds = kept.join(',');
      }
    });
    if (t) DS.recomputeProject(data, t.projectId);
    DS.persist();
  };

  DS.getResources = function (projectId) { return DS.load().resources.filter(function (r) { return !projectId || r.projectId === projectId; }); };
  DS.saveResource = function (r) {
    var data = DS.load();
    var i = data.resources.findIndex(function (x) { return x.id === r.id; });
    if (i >= 0) data.resources[i] = r; else { r.id = r.id || DS.uid('R'); data.resources.push(r); }
    DS.persist(); return r;
  };
  DS.deleteResource = function (id) {
    var data = DS.load();
    data.resources = data.resources.filter(function (r) { return r.id !== id; });
    DS.persist();
  };

  DS.getProgressLogs = function (projectId) { return DS.load().progressLogs.filter(function (l) { return !projectId || l.projectId === projectId; }); };
  DS.saveProgressLog = function (log) {
    var data = DS.load();
    var i = data.progressLogs.findIndex(function (x) { return x.id === log.id; });
    if (i >= 0) data.progressLogs[i] = log; else { log.id = log.id || DS.uid('L'); data.progressLogs.push(log); }
    // 同步任务进度
    var t = data.tasks.find(function (x) { return x.id === log.taskId; });
    if (t) { t.progress = log.actualPercent; DS.recomputeProject(data, t.projectId); }
    DS.persist(); return log;
  };

  DS.getWarnings = function (projectId, status) {
    return DS.load().warnings.filter(function (w) {
      return (!projectId || w.projectId === projectId) && (!status || w.status === status);
    });
  };
  DS.updateWarning = function (id, status) {
    var data = DS.load();
    var w = data.warnings.find(function (x) { return x.id === id; });
    if (w) { w.status = status; DS.persist(); }
    return w;
  };

  DS.getChanges = function (projectId) { return DS.load().changes.filter(function (c) { return !projectId || c.projectId === projectId; }); };
  DS.saveChange = function (c) {
    var data = DS.load();
    c.id = c.id || DS.uid('C');
    c.changeDate = c.changeDate || moment().format('YYYY-MM-DD');
    data.changes.push(c);
    // 联动受影响任务工期
    if (c.affectedTaskIds && c.durationDelta) {
      String(c.affectedTaskIds).split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (tid) {
        var t = data.tasks.find(function (x) { return x.id === tid; });
        if (t) {
          var newDur = Math.max(1, t.duration + Number(c.durationDelta));
          t.endDate = moment(t.startDate).add(newDur - 1, 'days').format('YYYY-MM-DD');
          t.duration = newDur;
        }
      });
      var pid = c.projectId;
      DS.recomputeProject(data, pid);
      DS.generateWarnings(data, pid);
    }
    DS.persist(); return c;
  };

  global.App = global.App || {};
  global.App.DataService = DS;
})(window);
