/* ==========================================================================
   report-generator.js — 审定报告生成
   组合 jsPDF(数值表PDF) + SheetJS(Excel汇总) + 打印(全中文审定书PDF)
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- 组装某品种的审定报告数据 ---------- */
  function buildReportData(varietyId, state) {
    var DS = global.DataStore, AE = global.AnalysisEngine;
    state = state || DS.getState();
    var year = state.currentYear, cropCode = state.currentCrop;
    var variety = DS.getVariety(varietyId);
    if (!variety) return null;
    var crop = DS.getCrop(variety.cropCode);
    var plans = DS.getTrialPlans({ year: year, crop: variety.cropCode });
    if (!plans.length) return null;
    var plan = plans[0];
    var varieties = plan.varietyIds.map(function (id) { return DS.getVariety(id); }).filter(Boolean);
    var stations = plan.stationCodes.map(function (c) { return DS.getStation(c); }).filter(Boolean);
    var records = DS.getRecords({ planId: plan.id });
    var summary = AE.multiPointSummary(records, varieties, stations);
    var row = summary.rows.find(function (r) { return r.varietyId === varietyId; });
    var control = summary.rows.find(function (r) { return r.varietyId === plan.controlId; });
    var adapt = AE.adaptability(records, varieties, stations).find(function (a) { return a.varietyId === varietyId; });
    var anova = AE.anova(records, varieties, stations);
    var ge = summary.ge;
    var stationYields = stations.map(function (s, j) {
      var idx = ge.genoIds.indexOf(varietyId);
      return { station: s.name, code: s.code, yield: ge.matrix[idx] ? round2(ge.matrix[idx][j]) : null, envMean: round2(ge.envMeans[j]) };
    });
    var verdict = buildVerdict(row, control, crop, adapt);

    return {
      variety: variety, crop: crop, plan: plan, year: year,
      row: row, control: control, adapt: adapt, anova: anova,
      stationYields: stationYields, verdict: verdict,
      grandMean: round2(ge.grandMean), generatedAt: new Date()
    };
  }

  function round2(n) { return Math.round((n || 0) * 100) / 100; }

  /* ---------- 生成审定意见文本 ---------- */
  function buildVerdict(row, control, crop, adapt) {
    if (!row) return { yield: '—', stability: '—', adapt: '—', conclusion: '数据不足', level: 'gray' };
    var yieldTxt, stabTxt, adaptTxt, conclusion, level;
    var diffPct = control ? ((row.mean - control.mean) / control.mean) * 100 : 0;
    if (diffPct >= 5) { yieldTxt = '丰产性突出，较对照增产 ' + round2(diffPct) + '%'; }
    else if (diffPct >= 0) { yieldTxt = '丰产性良好，较对照增产 ' + round2(diffPct) + '%'; }
    else if (diffPct >= -5) { yieldTxt = '丰产性一般，较对照减产 ' + round2(Math.abs(diffPct)) + '%'; }
    else { yieldTxt = '丰产性偏低，较对照减产 ' + round2(Math.abs(diffPct)) + '%'; }

    if (row.shuklaVar <= row.mean * 0.02) { stabTxt = '稳产性优秀(Shukla方差 ' + row.shuklaVar + ')，跨环境波动小'; }
    else if (row.shuklaVar <= row.mean * 0.05) { stabTxt = '稳产性良好(Shukla方差 ' + row.shuklaVar + ')'; }
    else { stabTxt = '稳产性一般(Shukla方差 ' + row.shuklaVar + ')，环境敏感度较高'; }

    var ar = adapt ? adapt.adaptRate : 0;
    if (ar >= 70) { adaptTxt = '适应性广，在 ' + ar + '% 站点表现达环境均值以上'; }
    else if (ar >= 50) { adaptTxt = '适应性中等，在 ' + ar + '% 站点达环境均值以上'; }
    else { adaptTxt = '适应性较窄，仅在 ' + ar + '% 站点达环境均值以上'; }

    if (diffPct >= 5 && row.shuklaVar <= row.mean * 0.05) { conclusion = '推荐通过审定'; level = 'green'; }
    else if (diffPct >= 0 && ar >= 50) { conclusion = '建议继续试验(续试)'; level = 'gold'; }
    else { conclusion = '建议终止试验'; level = 'warn'; }

    return { yield: yieldTxt, stability: stabTxt, adapt: adaptTxt, conclusion: conclusion, level: level, diffPct: round2(diffPct) };
  }

  /* ---------- 审定书 HTML(用于预览与打印) ---------- */
  function renderReportHTML(data) {
    var v = data.variety, c = data.crop, r = data.row, ct = data.control, ad = data.adapt, vd = data.verdict;
    var levelClass = { green: 'badge-green', gold: 'badge-gold', warn: 'badge-warn', gray: 'badge-gray' }[vd.level] || 'badge-gray';
    var rows = data.stationYields.map(function (s) {
      var diff = s.yield != null && s.envMean ? round2(s.yield - s.envMean) : null;
      var diffCls = diff == null ? '' : (diff >= 0 ? 'up' : 'down');
      return '<tr><td>' + s.code + ' ' + s.station + '</td><td class="num">' + (s.yield != null ? s.yield : '—') + '</td><td class="num">' + (s.envMean != null ? s.envMean : '—') + '</td><td class="num ' + diffCls + '">' + (diff != null ? (diff >= 0 ? '+' : '') + diff : '—') + '</td></tr>';
    }).join('');
    return ''
      + '<div class="report-sheet" id="reportSheet">'
      + '  <div class="rp-letterhead">'
      + '    <div class="rp-seal"><i class="bi bi-flower1"></i></div>'
      + '    <div><h2>农作物品种审定意见书</h2><div class="rp-org">区域农作物品种试验管理中心 · 品种审定委员会</div></div>'
      + '  </div>'
      + '  <div class="rp-meta">'
      + '    <div><b>品种名称：</b>' + v.name + ' (' + v.code + ')</div>'
      + '    <div><b>参试作物：</b>' + c.name + '</div>'
      + '    <div><b>选育来源：</b>' + v.source + '</div>'
      + '    <div><b>试验年度：</b>' + data.year + ' 年度</div>'
      + '    <div><b>试验方案：</b>' + data.plan.id + ' · ' + data.plan.version + '</div>'
      + '    <div><b>参试站点：</b>' + data.stationYields.length + ' 个</div>'
      + '  </div>'
      + '  <h3><i class="bi bi-bar-chart-line"></i>一、产量表现</h3>'
      + '  <p>该品种在 ' + data.year + ' 年度区域试验中，' + data.stationYields.length + ' 个站点平均亩产 <b>' + r.mean + ' ' + c.unit + '</b>，'
      + '较对照品种 ' + (ct ? ct.name : '—') + ' (' + (ct ? ct.mean : '—') + ') ' + (vd.diffPct >= 0 ? '增产' : '减产') + ' <b>' + Math.abs(vd.diffPct) + '%</b>。'
      + '产量变异系数 ' + r.cv + '%，幅度 ' + r.min + '～' + r.max + ' ' + c.unit + '。</p>'
      + '  <h3><i class="bi bi-table"></i>各站点产量明细</h3>'
      + '  <table><thead><tr><th>站点</th><th>亩产</th><th>环境均值</th><th>较均值</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '  <h3><i class="bi bi-shield-check"></i>二、稳定性评价</h3>'
      + '  <p>' + vd.stability + '。Shukla 稳定性方差 ' + r.shuklaVar + '，生态价 ' + r.ecovalence + '，稳定性排序第 ' + r.stabilityRank + ' 位(共 ' + data.stationYields.length + ' 品种)。</p>'
      + '  <h3><i class="bi bi-geo-alt"></i>三、适应区域</h3>'
      + '  <p>' + vd.adapt + '。最佳表现站点为 <b>' + (ad ? ad.bestEnv : '—') + '</b>，亩产达 ' + (ad ? ad.bestYield : '—') + ' ' + c.unit + '。</p>'
      + '  <h3><i class="bi bi-clipboard2-check"></i>四、综合审定意见</h3>'
      + '  <p>综合上述产量、稳定性与适应性分析，本品种在区域试验中的整体表现评价如下：</p>'
      + '  <div class="rp-verdict">' + vd.yield + '；' + vd.stability + '；' + vd.adapt + '。<br/>'
      + '  <b>审定结论：</b><span class="badge-soft ' + levelClass + '">' + vd.conclusion + '</span></div>'
      + '  <div style="margin-top:22px;display:flex;justify-content:space-between;font-size:12px;color:#828c7e;">'
      + '    <span>报告生成时间：' + fmtDate(data.generatedAt) + '</span>'
      + '    <span>审定委员会(盖章)</span>'
      + '  </div>'
      + '</div>';
  }
  function fmtDate(d) {
    function p(n) { return n < 10 ? '0' + n : n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------- 打印审定书(全中文PDF) ---------- */
  function printReport(data) {
    var html = renderReportHTML(data);
    var w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { return false; }
    w.document.write(''
      + '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>审定意见书-' + data.variety.name + '</title>'
      + '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">'
      + '<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Spline+Sans:wght@400;500;600&family=IBM+Plex+Mono&display=swap" rel="stylesheet">'
      + '<style>' + printStyles() + '</style></head><body>'
      + html
      + '<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>'
      + '</body></html>');
    w.document.close();
    return true;
  }

  function printStyles() {
    return ''
      + 'body{font-family:"Spline Sans",system-ui,sans-serif;background:#faf7f0;margin:0;padding:32px;color:#23291f;}'
      + '.report-sheet{max-width:780px;margin:0 auto;background:#fff;padding:48px 52px;box-shadow:0 14px 40px rgba(31,61,34,.12);border-radius:12px;}'
      + '.rp-letterhead{display:flex;align-items:center;gap:16px;padding-bottom:18px;border-bottom:3px double #2b5530;margin-bottom:22px;}'
      + '.rp-seal{width:52px;height:52px;border-radius:50%;background:linear-gradient(145deg,#2b5530,#14301a);color:#efce9b;display:grid;place-items:center;font-size:24px;}'
      + '.rp-letterhead h2{font-family:"Fraunces",serif;font-weight:700;font-size:22px;color:#14301a;margin:0;letter-spacing:.02em;}'
      + '.rp-org{font-size:12px;color:#828c7e;}'
      + '.rp-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 18px;font-size:13px;margin-bottom:18px;}'
      + '.rp-meta b{color:#5d6a59;font-weight:600;}'
      + 'h3{font-family:"Fraunces",serif;font-weight:600;font-size:15px;color:#2b5530;margin:20px 0 8px;padding-bottom:5px;border-bottom:1px solid #efe9da;}'
      + 'p{line-height:1.8;font-size:13.5px;}'
      + 'table{width:100%;font-size:12.5px;border-collapse:collapse;margin:8px 0;}'
      + 'th,td{padding:7px 10px;border:1px solid #e4ddcd;text-align:right;}'
      + 'th:first-child,td:first-child{text-align:left;}'
      + 'th{background:#e7efe0;color:#2b5530;font-weight:600;}'
      + '.up{color:#2f7a4a;} .down{color:#b5402f;}'
      + '.rp-verdict{background:#faf1de;border-left:4px solid #c8902f;padding:14px 16px;border-radius:0 8px 8px 0;font-size:13.5px;line-height:1.8;}'
      + '.badge-soft{font-weight:600;padding:3px 10px;border-radius:6px;font-size:12px;}'
      + '.badge-green{background:#e2f0e6;color:#2f7a4a;} .badge-gold{background:#faf1de;color:#9c6a1d;} .badge-warn{background:#fbe9e5;color:#b5402f;} .badge-gray{background:#f3eee2;color:#5d6a59;}'
      + '@media print{body{background:#fff;padding:0;} .report-sheet{box-shadow:none;border-radius:0;max-width:none;padding:24px 28px;}}';
  }

  /* ---------- jsPDF 数值表导出(品种代码+数值，ASCII友好) ---------- */
  function exportDataTablePDF(state) {
    var DS = global.DataStore, AE = global.AnalysisEngine;
    state = state || DS.getState();
    var year = state.currentYear, cropCode = state.currentCrop;
    var crop = DS.getCrop(cropCode);
    var plans = DS.getTrialPlans({ year: year, crop: cropCode });
    if (!plans.length) { App.toast('warn', '无方案', '当前年度/作物无试验方案'); return; }
    var plan = plans[0];
    var varieties = plan.varietyIds.map(function (id) { return DS.getVariety(id); }).filter(Boolean);
    var stations = plan.stationCodes.map(function (c) { return DS.getStation(c); }).filter(Boolean);
    var records = DS.getRecords({ planId: plan.id });
    var summary = AE.multiPointSummary(records, varieties, stations);
    var anova = AE.anova(records, varieties, stations);

    var jsPDF = global.jspdf && global.jspdf.jsPDF;
    if (!jsPDF) { App.toast('error', '导出失败', 'jsPDF 未加载'); return; }
    var doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16); doc.setTextColor(31, 61, 34);
    doc.text(crop.name + ' Regional Trial - ' + year + ' (' + crop.code.toUpperCase() + ')', 40, 40);
    doc.setFontSize(10); doc.setTextColor(93, 106, 89);
    doc.text('Plan: ' + plan.id + ' | Genotypes: ' + varieties.length + ' | Env: ' + stations.length + ' | Gen: ' + new Date().toLocaleString(), 40, 56);

    // 表1 产量与稳定性
    doc.autoTable({
      startY: 70,
      head: [['Code', 'Variety', 'Mean', 'SD', 'CV(%)', 'Min', 'Max', 'Shukla Var', 'Ecovalence', 'YieldRank', 'StabRank', 'IdealScore']],
      body: summary.rows.map(function (r) { return [r.varietyId, r.name, r.mean, r.sd, r.cv, r.min, r.max, r.shuklaVar, r.ecovalence, r.rank, r.stabilityRank, r.idealScore]; }),
      styles: { fontSize: 8, cellPadding: 3, halign: 'right', lineColor: [228, 221, 205], lineWidth: 0.5 },
      headStyles: { fillColor: [43, 85, 48], textColor: 250, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [251, 249, 243] },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left', cellWidth: 80 } }
    });

    // 表2 ANOVA
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 22,
      head: [['Source', 'df', 'SS', 'MS', 'F', 'Sig.']],
      body: anova.rows.map(function (r) { return [r.source, r.df, r.ss, r.ms, r.f, r.sig]; }),
      styles: { fontSize: 8.5, cellPadding: 3, halign: 'right', lineColor: [228, 221, 205], lineWidth: 0.5 },
      headStyles: { fillColor: [200, 144, 47], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'left', cellWidth: 110 } }
    });

    // 表3 品种×环境 产量矩阵
    var head3 = [['Code'].concat(stations.map(function (s) { return s.code; }), ['Mean'])];
    var body3 = summary.ge.genoIds.map(function (vid, i) {
      var row = [varieties[i].code];
      summary.ge.matrix[i].forEach(function (v) { row.push(v != null ? round2(v) : '-'); });
      row.push(round2(summary.ge.genoMeans[i]));
      return row;
    });
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 22,
      head: head3, body: body3,
      styles: { fontSize: 7.5, cellPadding: 2.5, halign: 'right', lineColor: [228, 221, 205], lineWidth: 0.5 },
      headStyles: { fillColor: [31, 61, 34], textColor: 250 },
      columnStyles: { 0: { halign: 'left' } }
    });

    doc.save(crop.code + '_trial_' + year + '_summary.pdf');
    App.toast('success', '已导出', crop.name + ' ' + year + ' 数值汇总PDF');
  }

  /* ---------- SheetJS Excel 多表导出 ---------- */
  function exportExcel(state) {
    var DS = global.DataStore, AE = global.AnalysisEngine, XLSX = global.XLSX;
    if (!XLSX) { App.toast('error', '导出失败', 'SheetJS 未加载'); return; }
    state = state || DS.getState();
    var year = state.currentYear, cropCode = state.currentCrop;
    var crop = DS.getCrop(cropCode);
    var plans = DS.getTrialPlans({ year: year, crop: cropCode });
    if (!plans.length) { App.toast('warn', '无方案', '当前年度/作物无试验方案'); return; }
    var plan = plans[0];
    var varieties = plan.varietyIds.map(function (id) { return DS.getVariety(id); }).filter(Boolean);
    var stations = plan.stationCodes.map(function (c) { return DS.getStation(c); }).filter(Boolean);
    var records = DS.getRecords({ planId: plan.id });
    var summary = AE.multiPointSummary(records, varieties, stations);
    var anova = AE.anova(records, varieties, stations);
    var issues = DS.getValidationIssues({ planId: plan.id });

    var wb = XLSX.utils.book_new();

    // Sheet1 产量汇总
    var s1 = [['品种编号', '品种名称', '亩产均值', '标准差', '变异系数(%)', '最小值', '最大值', 'Shukla稳定性方差', '生态价', '产量排名', '稳定性排名', '综合理想评分']];
    summary.rows.forEach(function (r) { s1.push([r.varietyId, r.name, r.mean, r.sd, r.cv, r.min, r.max, r.shuklaVar, r.ecovalence, r.rank, r.stabilityRank, r.idealScore]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s1), '产量汇总');

    // Sheet2 品种×站点矩阵
    var s2 = [['品种编号']].concat(stations.map(function (s) { return s.name; }), ['均值']);
    var head2 = [['品种编号'].concat(stations.map(function (s) { return s.name; }), ['均值'])];
    summary.ge.genoIds.forEach(function (vid, i) {
      var row = [varieties[i].code];
      summary.ge.matrix[i].forEach(function (v) { row.push(v != null ? round2(v) : ''); });
      row.push(round2(summary.ge.genoMeans[i]));
      head2.push(row);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(head2), '品种站点矩阵');

    // Sheet3 方差分析
    var s3 = [['变异来源', '自由度', '平方和', '均方', 'F值', '显著性']];
    anova.rows.forEach(function (r) { s3.push([r.source, r.df, r.ss, r.ms, r.f, r.sig]); });
    s3.push([], ['总均值', anova.grandMean], ['误差变异系数CV(%)', anova.CV]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s3), '方差分析');

    // Sheet4 异常清单
    var s4 = [['记录ID', '类型', '字段', '描述', '严重度']];
    issues.forEach(function (iss) { s4.push([iss.recordId, iss.type, iss.field, iss.msg, iss.severity || 'mid']); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s4), '异常清单');

    // Sheet5 原始记录(前500条)
    var s5 = [['记录ID', '站点', '品种', '重复', '亩产', '小区产量', '株高', '千粒重', '倒伏', '病害', '状态']];
    records.slice(0, 500).forEach(function (r) {
      s5.push([r.id, r.stationCode, r.varietyName, r.replication, r.muYield, r.plotYield, r.agronomic.plantHeight, r.agronomic.thousandGrainWeight, r.resistance.lodgingScore, r.resistance.diseaseLevel, r.status]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s5), '原始记录');

    XLSX.writeFile(wb, crop.code + '_trial_' + year + '_summary.xlsx');
    App.toast('success', '已导出', crop.name + ' ' + year + ' Excel汇总表(5个工作表)');
  }

  /* ---------- 导出 Excel 录入模板 ---------- */
  function downloadTemplate(planId) {
    var DS = global.DataStore, XLSX = global.XLSX;
    if (!XLSX) { App.toast('error', '失败', 'SheetJS 未加载'); return; }
    var plan = DS.getTrialPlan(planId);
    if (!plan) { App.toast('warn', '无方案', '请先选择方案'); return; }
    var stations = DS.getStations();
    var varieties = plan.varietyIds.map(function (id) { return DS.getVariety(id); }).filter(Boolean);
    var traits = DS.AGRONOMIC_TRAITS, resDefs = DS.RESISTANCE_DEFS;
    var header = ['planId', 'stationCode', 'varietyId', 'varietyName', 'replication', 'muYield', 'plotYield',
      'sowingDate', 'emergenceDate', 'headingDate', 'maturityDate'];
    traits.forEach(function (t) { header.push(t.key); });
    resDefs.forEach(function (r) { header.push(r.key); });
    var rows = [header];
    varieties.forEach(function (v) {
      stations.forEach(function (s) {
        for (var rep = 1; rep <= plan.replications; rep++) {
          var row = [plan.id, s.code, v.id, v.name, rep, '', '', '', '', '', ''];
          traits.forEach(function () { row.push(''); });
          resDefs.forEach(function () { row.push(''); });
          rows.push(row);
        }
      });
    });
    var ws = XLSX.utils.aoa_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '录入模板');
    XLSX.writeFile(wb, plan.id + '_录入模板.xlsx');
    App.toast('success', '模板已下载', '共 ' + (rows.length - 1) + ' 条待录入行');
  }

  /* ---------- 批量导入 Excel ---------- */
  function parseImportFile(file, cb) {
    var DS = global.DataStore, XLSX = global.XLSX;
    if (!XLSX) { cb(new Error('SheetJS 未加载'), null); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        var records = json.map(function (row, i) {
          var rec = {
            id: 'IMP' + Date.now() + '_' + i,
            planId: row.planId, year: DS.getState().currentYear,
            cropCode: DS.getState().currentCrop,
            stationCode: row.stationCode, varietyId: row.varietyId,
            varietyName: row.varietyName || '', replication: Number(row.replication) || 1,
            plotYield: row.plotYield ? Number(row.plotYield) : null,
            muYield: row.muYield ? Number(row.muYield) : null,
            phenology: {
              sowingDate: row.sowingDate ? Number(row.sowingDate) : null,
              emergenceDate: row.emergenceDate ? Number(row.emergenceDate) : null,
              headingDate: row.headingDate ? Number(row.headingDate) : null,
              maturityDate: row.maturityDate ? Number(row.maturityDate) : null,
              growthDays: null
            },
            agronomic: {}, resistance: {},
            status: 'normal'
          };
          DS.AGRONOMIC_TRAITS.forEach(function (t) { rec.agronomic[t.key] = row[t.key] !== '' ? Number(row[t.key]) : null; });
          DS.RESISTANCE_DEFS.forEach(function (r) { rec.resistance[r.key] = row[r.key] !== '' ? Number(row[r.key]) : null; });
          if (rec.phenology.sowingDate != null && rec.phenology.maturityDate != null) {
            rec.phenology.growthDays = rec.phenology.maturityDate - rec.phenology.sowingDate;
          }
          return rec;
        }).filter(function (r) { return r.planId && r.stationCode && r.varietyId; });
        cb(null, records);
      } catch (err) { cb(err, null); }
    };
    reader.readAsArrayBuffer(file);
  }

  global.ReportGenerator = {
    buildReportData: buildReportData,
    buildVerdict: buildVerdict,
    renderReportHTML: renderReportHTML,
    printReport: printReport,
    exportDataTablePDF: exportDataTablePDF,
    exportExcel: exportExcel,
    downloadTemplate: downloadTemplate,
    parseImportFile: parseImportFile
  };
})(window);
