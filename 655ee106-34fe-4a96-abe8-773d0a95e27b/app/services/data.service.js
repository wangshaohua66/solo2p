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
    var teamNames = ['钢筋一班', '钢筋二班', '钢筋三班', '模板班组', '模板二班组', '混凝土班组', '混凝土二班组', '架子工班', '架子工二班', '水电班组', '消防班组', '暖通班组', '泥工班组', '泥工二班组', '防水班组', '保温班组', '幕墙班组', '装饰班组', '土方班组', '桩基班组'];
    var equipNames = ['塔吊 TC6010', '塔吊 TC7030', '挖掘机 CAT320', '挖掘机 PC360', '混凝土泵车', '混凝土搅拌车', '施工升降机 SC200', '施工升降机 SC100', '汽车吊 QY25', '汽车吊 QY50', '装载机 ZL50', '压路机 20t', '推土机 D6', '自卸车 8x4', '高空作业车'];

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

      // 精细化工期阶段模板（每类工程 6-7 个阶段，每阶段 30-90 个子任务，总计约 250-450 个）
      // 每个阶段结构：{ name, segments: [{ taskCategory, 重复次数, 基础工期, 按栋号/区段倍数, isMilestone? }] }
      function buildPhaseTemplates(projectType) {
        // 楼层/区段倍数：住宅 30 层 × 4 工序，商业 25 层，市政按里程段
        var tierFloors = { '住宅': 28, '商业': 22, '市政': 18 }[projectType] || 20;
        var zoneCount = { '住宅': 4, '商业': 3, '市政': 6 }[projectType] || 3;

        function floors(seg) { return seg; }
        function zones(seg) { return seg; }

        if (projectType === '住宅' || projectType === '商业') {
          return [
            { name: '施工准备', ratio: 0.05, segments: [
              { cat: '现场围挡搭设', n: 1, dur: 3 },
              { cat: '临时道路施工', n: 1, dur: 3 },
              { cat: '办公区板房安装', n: 1, dur: 4 },
              { cat: '临水临电布设', n: 2, dur: 3 },
              { cat: '测量放线（首级控制网）', n: 1, dur: 3 },
              { cat: '施工组织设计报审', n: 1, dur: 5, milestone: true },
              { cat: '施工图会审', n: 1, dur: 4 },
              { cat: '劳务班组进场', n: zoneCount(2), dur: 2 },
              { cat: '机械设备进场', n: 3, dur: 2 }
            ]},
            { name: '土方与桩基工程', ratio: 0.10, segments: [
              { cat: '场地清表与平整', n: 1, dur: 4 },
              { cat: '测量放线（工程定位）', n: zoneCount(2), dur: 1 },
              { cat: '土方开挖（深基坑支护）', n: zoneCount(4), dur: 4 },
              { cat: '基坑降水工程', n: 1, dur: 12 },
              { cat: '土钉墙/锚杆支护', n: zoneCount(4), dur: 3 },
              { cat: '桩基测量放线', n: zoneCount(2), dur: 1 },
              { cat: '灌注桩钻孔施工', n: tierFloors, dur: 1 },
              { cat: '灌注桩钢筋笼制作', n: Math.ceil(tierFloors * 0.5), dur: 2 },
              { cat: '灌注桩混凝土浇筑', n: tierFloors, dur: 1 },
              { cat: '桩基检测（低应变）', n: 1, dur: 5 },
              { cat: '桩基检测（静载试验）', n: 1, dur: 7, milestone: true },
              { cat: '土方回填（肥槽）', n: zoneCount(2), dur: 3 }
            ]},
            { name: '地下结构（地下室）', ratio: 0.12, segments: [
              { cat: '地下室底板垫层浇筑', n: zoneCount(2), dur: 2 },
              { cat: '地下室底板防水卷材', n: zoneCount(2), dur: 3 },
              { cat: '地下室底板防水保护层', n: zoneCount(2), dur: 2 },
              { cat: '地下室底板钢筋绑扎', n: zoneCount(2), dur: 6 },
              { cat: '地下室底板预埋管线', n: zoneCount(2), dur: 2 },
              { cat: '地下室底板混凝土浇筑', n: zoneCount(1), dur: 2 },
              { cat: '地下室墙板模板支设', n: { 住宅: 3, 商业: 4, 市政: 3 }[projectType], dur: 5 },
              { cat: '地下室墙板钢筋绑扎', n: { 住宅: 3, 商业: 4, 市政: 3 }[projectType], dur: 4 },
              { cat: '地下室柱梁模板支设', n: { 住宅: 3, 商业: 4, 市政: 3 }[projectType], dur: 5 },
              { cat: '地下室柱梁钢筋绑扎', n: { 住宅: 3, 商业: 4, 市政: 3 }[projectType], dur: 4 },
              { cat: '地下室墙板柱混凝土浇筑', n: { 住宅: 3, 商业: 4, 市政: 3 }[projectType], dur: 2 },
              { cat: '地下室顶板模板支设', n: 1, dur: 5 },
              { cat: '地下室顶板钢筋绑扎', n: 1, dur: 4 },
              { cat: '地下室顶板预埋管线', n: 1, dur: 2 },
              { cat: '地下室顶板混凝土浇筑', n: 1, dur: 2, milestone: true },
              { cat: '地下室外墙防水施工', n: 2, dur: 3 },
              { cat: '地下室结构验收', n: 1, dur: 3, milestone: true }
            ]},
            { name: '主体结构（地上）', ratio: 0.30, segments: (function () {
              var arr = [];
              for (var f = 1; f <= tierFloors; f++) {
                arr.push({ cat: f + '层柱梁模板支设', n: 1, dur: 2 });
                arr.push({ cat: f + '层柱梁钢筋绑扎', n: 1, dur: 2 });
                arr.push({ cat: f + '层顶板模板支设', n: 1, dur: 2 });
                arr.push({ cat: f + '层顶板钢筋绑扎', n: 1, dur: 2 });
                arr.push({ cat: f + '层预埋管线', n: 1, dur: 1 });
                arr.push({ cat: f + '层混凝土浇筑', n: 1, dur: 1 });
                if (f % 10 === 0) arr.push({ cat: f + '层结构验收', n: 1, dur: 2, milestone: true });
              }
              arr.push({ cat: '屋面层结构施工', n: 1, dur: 4 });
              arr.push({ cat: '主体结构封顶验收', n: 1, dur: 5, milestone: true });
              // 砌体工程（按楼层）
              for (var m = 1; m <= tierFloors; m++) {
                arr.push({ cat: m + '层砌筑工程（填充墙）', n: 1, dur: 2 });
                arr.push({ cat: m + '层构造柱/圈梁支模', n: 1, dur: 1 });
                arr.push({ cat: m + '层构造柱/圈梁浇筑', n: 1, dur: 1 });
              }
              return arr;
            })() },
            { name: '二次结构与初装', ratio: 0.12, segments: [
              { cat: '室内抹灰（顶棚）', n: Math.ceil(tierFloors / 2), dur: 2 },
              { cat: '室内抹灰（墙面）', n: tierFloors, dur: 2 },
              { cat: '室内抹灰（地面垫层）', n: tierFloors, dur: 1 },
              { cat: '外墙抹灰/找平层', n: zoneCount(3), dur: 3 },
              { cat: '厨卫间防水施工', n: Math.ceil(tierFloors / 2), dur: 2 },
              { cat: '屋面防水（SBS卷材）', n: 1, dur: 6 },
              { cat: '屋面保温层施工', n: 1, dur: 4 },
              { cat: '屋面保护层/找坡层', n: 2, dur: 3 },
              { cat: '地下室后浇带封闭', n: 2, dur: 3 },
              { cat: '门窗洞口收口', n: tierFloors, dur: 1 },
              { cat: '初装修验收', n: 1, dur: 3, milestone: true }
            ]},
            { name: '机电安装工程', ratio: 0.10, segments: [
              { cat: '给排水主管（地下室）', n: 2, dur: 4 },
              { cat: '消防喷淋主管安装', n: 2, dur: 4 },
              { cat: '电气桥架敷设', n: zoneCount(2), dur: 3 },
              { cat: '低压配电柜安装', n: 1, dur: 5 },
              { cat: '暖通风管制作安装', n: zoneCount(3), dur: 3 },
              { cat: '弱电综合布线', n: zoneCount(2), dur: 3 },
              { cat: '给排水立管安装', n: 1, dur: 10 },
              { cat: '消火栓系统安装', n: Math.ceil(tierFloors / 3), dur: 2 },
              { cat: '照明配管穿线', n: tierFloors, dur: 1 },
              { cat: '通风设备安装', n: zoneCount(2), dur: 3 },
              { cat: '智能化系统安装', n: zoneCount(2), dur: 3 },
              { cat: '机电单机调试', n: 1, dur: 5 },
              { cat: '机电系统联调', n: 1, dur: 7, milestone: true }
            ]},
            { name: '装饰装修工程', ratio: 0.15, segments: [
              { cat: '外墙保温板粘贴', n: zoneCount(4), dur: 4 },
              { cat: '外墙抗裂砂浆', n: zoneCount(3), dur: 3 },
              { cat: '外墙涂料/真石漆', n: zoneCount(4), dur: 3 },
              { cat: '断桥铝窗框安装', n: Math.ceil(tierFloors / 2), dur: 2 },
              { cat: '玻璃/窗扇安装', n: tierFloors, dur: 1 },
              { cat: '防火门安装', n: Math.ceil(tierFloors / 2), dur: 2 },
              { cat: '入户门安装', n: Math.ceil(tierFloors / 3), dur: 2 },
              { cat: '室内地砖铺贴', n: tierFloors, dur: 2 },
              { cat: '室内墙面面层（腻子+乳胶漆）', n: tierFloors, dur: 2 },
              { cat: '吊顶龙骨安装', n: Math.ceil(tierFloors / 2), dur: 2 },
              { cat: '吊顶饰面板安装', n: tierFloors, dur: 1 },
              { cat: '楼梯间装饰施工', n: Math.ceil(tierFloors / 4), dur: 2 },
              { cat: '公共区域精装修', n: zoneCount(2), dur: 4 },
              { cat: '电梯厅装饰', n: Math.ceil(tierFloors / 3), dur: 2 },
              ...(projectType === '商业' ? [
                { cat: '幕墙预埋埋件（跟进结构）', n: 1, dur: 12 },
                { cat: '幕墙龙骨安装', n: zoneCount(5), dur: 4 },
                { cat: '幕墙玻璃/铝板安装', n: zoneCount(6), dur: 4 },
                { cat: '幕墙打胶封缝', n: zoneCount(3), dur: 3 },
                { cat: '幕墙四性试验', n: 1, dur: 7, milestone: true },
                { cat: '大堂精装修', n: 1, dur: 15 },
                { cat: '公共区域精装修（商场）', n: zoneCount(4), dur: 5 }
              ] : [])
            ]},
            { name: '市政配套与竣工验收', ratio: 0.06, segments: [
              { cat: '室外给排水管网', n: zoneCount(2), dur: 4 },
              { cat: '室外电力管网', n: zoneCount(2), dur: 4 },
              { cat: '室外热力/燃气管网', n: zoneCount(2), dur: 3 },
              { cat: '室外道路硬化', n: zoneCount(2), dur: 4 },
              { cat: '室外园林绿化', n: 1, dur: 10 },
              { cat: '室外照明/监控', n: 1, dur: 5 },
              { cat: '消防专项验收', n: 1, dur: 5, milestone: true },
              { cat: '规划专项验收', n: 1, dur: 3 },
              { cat: '节能专项验收', n: 1, dur: 3 },
              { cat: '人防专项验收', n: 1, dur: 3 },
              { cat: '环保专项验收', n: 1, dur: 3 },
              { cat: '竣工综合验收', n: 1, dur: 5, milestone: true },
              { cat: '竣工资料移交', n: 1, dur: 3 },
              { cat: '物业交接', n: 1, dur: 2, milestone: true }
            ]}
          ];
        }
        // 市政工程（道路/桥梁/管网）
        var segCount = 8; // 施工分段
        return [
          { name: '施工准备', ratio: 0.05, segments: [
            { cat: '现场围挡搭设', n: 4, dur: 2 },
            { cat: '临时便道施工', n: 3, dur: 3 },
            { cat: '临时排水设施', n: 2, dur: 3 },
            { cat: '测量控制网布设', n: 1, dur: 4 },
            { cat: '交通导改方案审批', n: 1, dur: 5 },
            { cat: '地下管线探测', n: 2, dur: 3 },
            { cat: '施工方案专家论证', n: 1, dur: 5, milestone: true },
            { cat: '设备/劳务进场', n: 4, dur: 2 }
          ]},
          { name: '管线迁改工程', ratio: 0.10, segments: [
            { cat: '雨水管线沟槽开挖', n: segCount, dur: 2 },
            { cat: '雨水管基础浇筑', n: segCount, dur: 1 },
            { cat: '雨水管铺设安装', n: segCount, dur: 2 },
            { cat: '雨水检查井砌筑', n: segCount * 2, dur: 1 },
            { cat: '污水管线沟槽开挖', n: segCount, dur: 2 },
            { cat: '污水管基础浇筑', n: segCount, dur: 1 },
            { cat: '污水管铺设安装', n: segCount, dur: 2 },
            { cat: '污水检查井砌筑', n: segCount * 2, dur: 1 },
            { cat: '给水管线安装', n: segCount, dur: 2 },
            { cat: '电力沟槽开挖与排管', n: segCount, dur: 2 },
            { cat: '通信沟槽开挖与排管', n: segCount, dur: 2 },
            { cat: '热力/燃气管线安装', n: Math.floor(segCount * 0.75), dur: 2 },
            { cat: '管线闭水试验', n: 2, dur: 3 },
            { cat: '管线综合验收', n: 1, dur: 3, milestone: true },
            { cat: '沟槽回填夯实', n: segCount * 2, dur: 1 }
          ]},
          { name: '道路路基工程', ratio: 0.12, segments: [
            { cat: '原地面清表与挖除', n: segCount, dur: 2 },
            { cat: '软弱地基处理', n: segCount, dur: 3 },
            { cat: '路基土方开挖', n: segCount, dur: 2 },
            { cat: '路基土方填筑', n: segCount * 2, dur: 2 },
            { cat: '路基分层碾压', n: segCount * 3, dur: 1 },
            { cat: '压实度检测（环刀法）', n: segCount * 2, dur: 1 },
            { cat: '路基边坡修整', n: segCount, dur: 2 },
            { cat: '边沟砌筑', n: segCount, dur: 2 },
            { cat: '路基验收（弯沉检测）', n: 1, dur: 4, milestone: true }
          ]},
          { name: '道路基层工程', ratio: 0.10, segments: [
            { cat: '石灰土底基层摊铺', n: segCount, dur: 2 },
            { cat: '石灰土底基层碾压', n: segCount, dur: 1 },
            { cat: '水泥稳定碎石基层摊铺', n: segCount, dur: 2 },
            { cat: '水稳层碾压成型', n: segCount, dur: 1 },
            { cat: '水稳层养护', n: segCount, dur: 3 },
            { cat: '基层钻芯取样检测', n: 2, dur: 3 },
            { cat: '路缘石安装', n: segCount * 2, dur: 1 },
            { cat: '平石安装', n: segCount * 2, dur: 1 },
            { cat: '人行道基础', n: segCount, dur: 2 },
            { cat: '基层验收', n: 1, dur: 3, milestone: true }
          ]},
          { name: '桥梁结构工程', ratio: 0.22, segments: [
            { cat: '钻孔灌注桩放线', n: 3, dur: 1 },
            { cat: '钻孔灌注桩钻孔', n: 12, dur: 2 },
            { cat: '灌注桩钢筋笼制作', n: 6, dur: 2 },
            { cat: '灌注桩水下混凝土', n: 12, dur: 1 },
            { cat: '桩头凿除与检测', n: 4, dur: 2 },
            { cat: '承台基坑开挖', n: 4, dur: 3 },
            { cat: '承台垫层与砖模', n: 4, dur: 2 },
            { cat: '承台钢筋绑扎', n: 4, dur: 3 },
            { cat: '承台模板支设', n: 4, dur: 2 },
            { cat: '承台混凝土浇筑', n: 4, dur: 2 },
            { cat: '墩柱钢筋绑扎', n: 4, dur: 3 },
            { cat: '墩柱模板支设', n: 4, dur: 3 },
            { cat: '墩柱混凝土浇筑', n: 4, dur: 2 },
            { cat: '盖梁支架搭设', n: 2, dur: 3 },
            { cat: '盖梁钢筋绑扎', n: 2, dur: 3 },
            { cat: '盖梁模板支设', n: 2, dur: 2 },
            { cat: '盖梁混凝土浇筑', n: 2, dur: 2 },
            { cat: '箱梁满堂支架搭设', n: 2, dur: 7 },
            { cat: '箱梁预压与卸载', n: 1, dur: 5 },
            { cat: '箱梁底模铺设', n: 2, dur: 3 },
            { cat: '箱梁腹板钢筋绑扎', n: 2, dur: 4 },
            { cat: '箱梁内模安装', n: 2, dur: 3 },
            { cat: '箱梁顶板钢筋绑扎', n: 2, dur: 3 },
            { cat: '箱梁预应力管道布设', n: 2, dur: 2 },
            { cat: '箱梁混凝土浇筑', n: 2, dur: 3 },
            { cat: '箱梁养护与拆模', n: 2, dur: 5 },
            { cat: '预应力张拉', n: 2, dur: 3 },
            { cat: '孔道压浆', n: 2, dur: 2 },
            { cat: '封锚施工', n: 2, dur: 1 },
            { cat: '桥面防水层施工', n: 2, dur: 3 },
            { cat: '桥面铺装混凝土', n: 2, dur: 3 },
            { cat: '桥梁伸缩缝安装', n: 2, dur: 2 },
            { cat: '防撞护栏浇筑', n: segCount, dur: 1 },
            { cat: '桥梁荷载试验', n: 1, dur: 5, milestone: true }
          ]},
          { name: '路面面层工程', ratio: 0.10, segments: [
            { cat: '透层/粘层油洒布', n: segCount, dur: 1 },
            { cat: '沥青下面层摊铺', n: segCount, dur: 2 },
            { cat: '沥青下面层碾压', n: segCount, dur: 1 },
            { cat: '沥青中面层摊铺', n: segCount, dur: 2 },
            { cat: '沥青中面层碾压', n: segCount, dur: 1 },
            { cat: '沥青上面层（SMA）摊铺', n: segCount, dur: 2 },
            { cat: '沥青上面层碾压', n: segCount, dur: 1 },
            { cat: '路面标线施划', n: segCount, dur: 2 },
            { cat: '交通标志牌安装', n: segCount, dur: 1 },
            { cat: '交通信号灯安装', n: 4, dur: 2 },
            { cat: '路面钻芯检测', n: 2, dur: 3 },
            { cat: '路面平整度检测', n: 1, dur: 2 }
          ]},
          { name: '附属设施与绿化', ratio: 0.08, segments: [
            { cat: '人行道砖铺装', n: segCount * 2, dur: 1 },
            { cat: '盲道砖铺装', n: segCount, dur: 1 },
            { cat: '树池砌筑', n: segCount * 2, dur: 1 },
            { cat: '行道树栽植', n: segCount * 2, dur: 1 },
            { cat: '中分带绿化土回填', n: segCount, dur: 2 },
            { cat: '中分带灌木栽植', n: segCount, dur: 2 },
            { cat: '路灯基础浇筑', n: segCount * 2, dur: 1 },
            { cat: '路灯灯杆安装', n: segCount * 2, dur: 1 },
            { cat: '监控摄像头安装', n: Math.floor(segCount / 2), dur: 2 },
            { cat: '公交站台施工', n: Math.floor(segCount / 2), dur: 3 },
            { cat: '过街天桥装饰', n: 1, dur: 5 },
            { cat: '环保降噪措施', n: 2, dur: 3 }
          ]},
          { name: '竣工验收与移交', ratio: 0.05, segments: [
            { cat: '道路专项验收', n: 1, dur: 4 },
            { cat: '桥梁专项验收', n: 1, dur: 4 },
            { cat: '排水专项验收', n: 1, dur: 3 },
            { cat: '照明专项验收', n: 1, dur: 3 },
            { cat: '绿化专项验收', n: 1, dur: 3 },
            { cat: '交通工程验收', n: 1, dur: 3 },
            { cat: '竣工综合验收', n: 1, dur: 5, milestone: true },
            { cat: '竣工资料归档移交', n: 1, dur: 4 },
            { cat: '养护移交与缺陷修复', n: 1, dur: 7, milestone: true }
          ]}
        ];
      }

      // 资源
      var resources = [];
      var teamCount = 8 + Math.floor(Math.random() * 5);
      for (var t = 0; t < teamCount; t++) {
        var rid = 'R' + pid.slice(1) + 'T' + t;
        resources.push({ id: rid, projectId: pid, name: teamNames[(t + idx) % teamNames.length], type: '班组', startDate: project.startDate, endDate: project.endDate, capacity: 10 + Math.floor(Math.random() * 16) });
      }
      var equipCount = 5 + Math.floor(Math.random() * 4);
      for (var e = 0; e < equipCount; e++) {
        var eid = 'R' + pid.slice(1) + 'E' + e;
        resources.push({ id: eid, projectId: pid, name: equipNames[(e + idx) % equipNames.length], type: '设备', startDate: project.startDate, endDate: project.endDate, capacity: 1 });
      }
      resources.forEach(function (r) { data.resources.push(r); });

      // 任务节点（按阶段生成，总数量 200-500）
      var tasks = [];
      var phases = buildPhaseTemplates(tpl.type);
      var totalSeg = phases.reduce(function (s, p) { return s + p.segments.reduce(function (x, sg) { return x + (sg.n || 1); }, 0); }, 0);
      // 如不足 200 则在主体阶段追加子任务；如超过 500 则精简
      var target = Math.max(200, Math.min(500, 220 + Math.floor(Math.random() * 180)));
      // 阶段工期分布（按比例分配总工期）
      var ratioSum = phases.reduce(function (s, p) { return s + (p.ratio || 0); }, 0) || 1;
      var phaseDurTotal = phases.reduce(function (sum, ph) {
        var d = ph.segments.reduce(function (s, sg) { return s + (sg.n || 1) * (sg.dur || 2); }, 0);
        return sum + d;
      }, 0);
      var dayScale = tpl.dur / phaseDurTotal; // 把基准总工期缩放到 tpl.dur
      var cursor = start.clone();
      var phaseStartIds = [];
      var seq = 0;
      phases.forEach(function (ph) {
        var phaseStart = cursor.clone();
        // 本阶段内所有子任务（按顺序）
        var phaseTaskIds = [];
        ph.segments.forEach(function (sg) {
          var count = sg.n || 1;
          // 子任务可以并行（按区段并行度 2-3）
          var parallel = Math.min(count, 2 + Math.floor(Math.random() * 2));
          var rowCount = Math.ceil(count / parallel);
          for (var r = 0; r < rowCount; r++) {
            // 每一行 parallel 个并行任务，链接到上一行末（或阶段首）
            var rowStart = cursor.clone();
            if (phaseTaskIds.length) {
              var anchor = phaseTaskIds[phaseTaskIds.length - 1];
              var anchorTask = tasks.find(function (x) { return x.id === anchor; });
              if (anchorTask) rowStart = moment(anchorTask.endDate);
            }
            var rowEnd = rowStart.clone();
            var rowPrevIds = [];
            var rowFirst = true;
            for (var i = 0; i < parallel && (r * parallel + i) < count; i++) {
              var idxN = r * parallel + i + 1;
              var dur = Math.max(1, Math.round((sg.dur || 2) * (0.7 + Math.random() * 0.6) * dayScale));
              var ts = rowStart.clone();
              // 链内串行小步
              if (rowPrevIds.length) {
                var prevT = tasks.find(function (x) { return x.id === rowPrevIds[rowPrevIds.length - 1]; });
                if (prevT) ts = moment(prevT.endDate);
              }
              var te = ts.clone().add(Math.max(1, dur), 'days');
              if (te.isAfter(rowEnd)) rowEnd = te.clone();
              var plannedPct = 0;
              var actualPct = 0;
              if (te.isBefore(today)) { plannedPct = 100; actualPct = Math.min(100, 78 + Math.floor(Math.random() * 27)); }
              else if (ts.isBefore(today)) {
                plannedPct = Math.min(100, Math.round(today.diff(ts, 'days') / Math.max(1, dur) * 100));
                actualPct = Math.max(0, plannedPct - Math.floor(Math.random() * 30));
              } else { plannedPct = 0; actualPct = 0; }
              var res = resources[(seq + idxN + idx) % resources.length];
              // 前置依赖：行首任务链接阶段上一个任务；其余链接行内前一个
              var predId = '';
              if (rowFirst && i === 0 && phaseTaskIds.length) {
                predId = phaseTaskIds[phaseTaskIds.length - 1];
              } else if (rowPrevIds.length) {
                predId = rowPrevIds[rowPrevIds.length - 1];
              } else if (!phaseTaskIds.length && phaseStartIds.length) {
                predId = phaseStartIds[phaseStartIds.length - 1];
              }
              rowFirst = false;
              var task = {
                id: pid + 'K' + String(seq + 1).padStart(4, '0'),
                projectId: pid,
                name: ph.name + '-' + sg.cat + (count > 1 ? ('#' + idxN) : ''),
                phase: ph.name, category: sg.cat,
                startDate: ts.format('YYYY-MM-DD'), endDate: te.format('YYYY-MM-DD'),
                duration: Math.max(1, dur), progress: actualPct, plannedPercent: plannedPct,
                predecessorIds: predId,
                isCritical: false, floatDays: 0, resourceId: res.id,
                assignee: res.type === '班组' ? res.name : '设备调度',
                milestone: !!sg.milestone
              };
              tasks.push(task);
              phaseTaskIds.push(task.id);
              rowPrevIds.push(task.id);
              seq++;
            }
            cursor = rowEnd.clone();
          }
        });
        // 里程碑节点
        var ms = ph.segments.filter(function (sg) { return sg.milestone; });
        if (ms.length === 0 && phaseTaskIds.length && ph !== phases[0]) {
          // 阶段末自动加一个"阶段验收"里程碑（当本阶段末任务未带里程碑）
          var lastT = tasks.find(function (x) { return x.id === phaseTaskIds[phaseTaskIds.length - 1]; });
          if (lastT && !lastT.milestone) {
            var mDur = 2;
            var mTs = moment(lastT.endDate);
            var mTe = mTs.clone().add(mDur, 'days');
            var mPlanned = mTe.isBefore(today) ? 100 : (mTs.isBefore(today) ? 50 : 0);
            var mActual = mPlanned ? Math.max(0, mPlanned - Math.floor(Math.random() * 20)) : 0;
            var mRes = resources[(seq + idx) % resources.length];
            tasks.push({
              id: pid + 'M' + String(phases.indexOf(ph) + 1).padStart(2, '0'),
              projectId: pid, name: ph.name + '·阶段验收', phase: ph.name, category: '阶段验收',
              startDate: mTs.format('YYYY-MM-DD'), endDate: mTe.format('YYYY-MM-DD'),
              duration: mDur, progress: mActual, plannedPercent: mPlanned,
              predecessorIds: lastT.id, isCritical: false, floatDays: 0, resourceId: mRes.id,
              assignee: '质量部', milestone: true
            });
            phaseTaskIds.push(tasks[tasks.length - 1].id);
            seq++;
          }
        }
        if (phaseTaskIds.length) phaseStartIds.push(phaseTaskIds[phaseTaskIds.length - 1]);
      });

      // 如果总数不足 target（200+），在主体/装饰阶段内按区段再附加精修任务
      while (tasks.length < target) {
        var extraPhases = tasks.length ? phases.slice(3, -1) : phases;
        if (!extraPhases.length) break;
        var eph = extraPhases[Math.floor(Math.random() * extraPhases.length)];
        var candidate = tasks.filter(function (tk) { return tk.phase === eph.name; });
        if (!candidate.length) break;
        var anchorTk = candidate[Math.floor(Math.random() * candidate.length)];
        var eDur = Math.max(1, Math.round((1 + Math.random() * 2) * dayScale));
        var eTs = moment(anchorTk.endDate);
        var eTe = eTs.clone().add(eDur, 'days');
        var ePlanned = eTe.isBefore(today) ? 100 : (eTs.isBefore(today) ? Math.round(today.diff(eTs, 'days') / Math.max(1, eDur) * 100) : 0);
        var eActual = ePlanned ? Math.max(0, ePlanned - Math.floor(Math.random() * 25)) : 0;
        var eRes = resources[(seq + idx) % resources.length];
        tasks.push({
          id: pid + 'X' + String(tasks.length + 1).padStart(4, '0'),
          projectId: pid, name: eph.name + '-精修补项#' + (tasks.length + 1), phase: eph.name, category: '精修补项',
          startDate: eTs.format('YYYY-MM-DD'), endDate: eTe.format('YYYY-MM-DD'),
          duration: Math.max(1, eDur), progress: eActual, plannedPercent: ePlanned,
          predecessorIds: anchorTk.id, isCritical: false, floatDays: 0, resourceId: eRes.id,
          assignee: eRes.type === '班组' ? eRes.name : '设备调度', milestone: false
        });
        seq++;
      }
      // 如超过 500 则从末尾裁切（保留里程碑）
      if (tasks.length > 500) {
        var milestones = tasks.filter(function (t) { return t.milestone; });
        var nonMs = tasks.filter(function (t) { return !t.milestone; }).slice(0, 500 - milestones.length);
        tasks = nonMs.concat(milestones);
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
