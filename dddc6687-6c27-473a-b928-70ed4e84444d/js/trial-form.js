/* ==========================================================================
   trial-form.js — 多步录入表单(物候 / 农艺 / 抗性)
   分步向导、实时校验、Excel批量导入
   ========================================================================== */
(function (global) {
  'use strict';
  var $ = global.jQuery;
  var DS = global.DataStore;

  function daysBetween(a, b) {
    if (!a || !b) return null;
    var d1 = new Date(a), d2 = new Date(b);
    if (isNaN(d1) || isNaN(d2)) return null;
    return Math.round((d2 - d1) / 86400000);
  }

  /* ---------- 渲染录入向导 ---------- */
  function render(container, opts) {
    opts = opts || {};
    var $c = $(container);
    var state = DS.getState();
    var cropCode = opts.cropCode || state.currentCrop;
    var year = opts.year || state.currentYear;
    var crop = DS.getCrop(cropCode);
    var plans = DS.getTrialPlans({ year: year, crop: cropCode });
    var stations = DS.getStations();
    var traits = DS.AGRONOMIC_TRAITS;
    var resDefs = DS.RESISTANCE_DEFS;
    var editRec = opts.record ? DS.getRecord(opts.record) : null;

    if (!plans.length) {
      $c.html('<div class="empty-state"><i class="bi bi-exclamation-circle"></i><h5>暂无试验方案</h5><p>当前年度/作物尚未配置试验方案，请先到「方案配置」创建。</p><button class="btn btn-primary" onclick="location.hash=\'#/trials\'"><i class="bi bi-arrow-right"></i> 前往方案配置</button></div>');
      return;
    }

    var html = ''
      + '<div class="page-head">'
      + '  <div><h1 class="page-title">田间数据录入<small>分站点 · 分品种 · 三步向导(物候 → 农艺 → 抗性)</small></h1></div>'
      + '  <div class="crumb"><i class="bi bi-house"></i> 工作台 <span class="sep">/</span> 数据录入</div>'
      + '</div>'

      + '<div class="card mb-3"><div class="card-body">'
      + '  <div class="row g-3 align-items-end">'
      + '    <div class="col-md-4"><label class="form-label">试验方案 <span class="req">*</span></label><select id="tfPlan" class="form-select"></select></div>'
      + '    <div class="col-md-3"><label class="form-label">试验站点 <span class="req">*</span></label><select id="tfStation" class="form-select"></select></div>'
      + '    <div class="col-md-3"><label class="form-label">参试品种 <span class="req">*</span></label><select id="tfVariety" class="form-select"></select></div>'
      + '    <div class="col-md-2"><label class="form-label">重复</label><select id="tfRep" class="form-select"><option>1</option><option>2</option><option>3</option></select></div>'
      + '  </div>'
      + '</div></div>'

      + '<div class="wizard-steps">'
      + '  <div class="wstep active" data-step="1"><div class="wstep-dot">1</div><div class="wstep-text"><span class="wstep-title">物候期</span><span class="wstep-sub">播期·出苗·抽穗·成熟</span></div><div class="wstep-bar"></div></div>'
      + '  <div class="wstep" data-step="2"><div class="wstep-dot">2</div><div class="wstep-text"><span class="wstep-title">农艺性状</span><span class="wstep-sub">12项指标数值校验</span></div><div class="wstep-bar"></div></div>'
      + '  <div class="wstep" data-step="3"><div class="wstep-dot">3</div><div class="wstep-text"><span class="wstep-title">抗性指标</span><span class="wstep-sub">倒伏·病害·耐逆性</span></div></div>'
      + '</div>'

      + '<div class="card"><div class="card-body">'
      + '  <div class="accordion accordion-flush" id="tfAccordion">'

      // 步骤1 物候
      + '    <div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#tfPheno"><i class="bi bi-calendar2-week me-2"></i>第一步 · 物候期记载</button></h2>'
      + '      <div id="tfPheno" class="accordion-collapse collapse show" data-bs-parent="#tfAccordion"><div class="accordion-body">'
      + '        <div class="row g-3">'
      + '          <div class="col-md-3"><label class="form-label">播期 <span class="req">*</span></label><input type="date" class="form-control" id="tfSow" /></div>'
      + '          <div class="col-md-3"><label class="form-label">出苗期</label><input type="date" class="form-control" id="tfEmg" /></div>'
      + '          <div class="col-md-3"><label class="form-label">抽穗(穗)期</label><input type="date" class="form-control" id="tfHead" /></div>'
      + '          <div class="col-md-3"><label class="form-label">成熟期 <span class="req">*</span></label><input type="date" class="form-control" id="tfMat" /></div>'
      + '        </div>'
      + '        <div class="mt-3 d-flex align-items-center gap-3"><label class="form-label mb-0">生育天数 <span class="hint">自动计算</span></label><span class="badge-soft badge-green" id="tfGrowthDays">— 天</span>'
      + '          <span class="text-muted-2 small" id="tfPhenoWarn"></span></div>'
      + '        <div class="mt-3 row g-3">'
      + '          <div class="col-md-4"><label class="form-label">小区产量(kg) <span class="hint">实测</span></label><input type="number" step="0.01" class="form-control num" id="tfPlot" placeholder="如 12.5" /></div>'
      + '          <div class="col-md-4"><label class="form-label">折算亩产(' + (crop ? crop.unit : 'kg/亩') + ') <span class="req">*</span></label><input type="number" step="0.01" class="form-control num" id="tfMu" placeholder="如 540" /></div>'
      + '          <div class="col-md-4 d-flex align-items-end"><button class="btn btn-outline-green btn-sm" id="tfCalcMu"><i class="bi bi-calculator"></i> 由小区折算</button></div>'
      + '        </div>'
      + '      </div></div></div>'

      // 步骤2 农艺
      + '    <div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#tfAgr"><i class="bi bi-rulers me-2"></i>第二步 · 农艺性状(12项)</button></h2>'
      + '      <div id="tfAgr" class="accordion-collapse collapse" data-bs-parent="#tfAccordion"><div class="accordion-body">'
      + '        <div class="row g-3">' + traits.map(function (t, i) {
          return '<div class="col-md-3 col-sm-6"><label class="form-label">' + t.label + ' <span class="hint">' + t.min + '-' + t.max + t.unit + '</span></label>'
            + '<div class="input-group input-group-sm"><input type="number" step="0.01" class="form-control agr-input" data-key="' + t.key + '" data-min="' + t.min + '" data-max="' + t.max + '" placeholder="' + t.min + '～' + t.max + '" /><span class="input-group-text">' + t.unit + '</span></div>'
            + '<div class="invalid-feedback"></div></div>';
        }).join('') + '</div>'
      + '      </div></div></div>'

      // 步骤3 抗性
      + '    <div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#tfRes"><i class="bi bi-shield-exclamation me-2"></i>第三步 · 抗性指标</button></h2>'
      + '      <div id="tfRes" class="accordion-collapse collapse" data-bs-parent="#tfAccordion"><div class="accordion-body">'
      + '        <div class="row g-3">' + resDefs.map(function (r) {
          var opts2 = r.optionLabels.map(function (lab, i) { return '<option value="' + r.options[i] + '">' + lab + '</option>'; }).join('');
          return '<div class="col-md-4 col-sm-6"><label class="form-label">' + r.label + '</label><select class="form-select res-input" data-key="' + r.key + '"><option value="">未记载</option>' + opts2 + '</select></div>';
        }).join('') + '</div>'
      + '      </div></div></div>'

      + '  </div>'
      + '  <div class="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">'
      + '    <button class="btn btn-ghost" id="tfReset"><i class="bi bi-arrow-counterclockwise"></i> 重置</button>'
      + '    <div class="d-flex gap-2">'
      + '      <button class="btn btn-outline-green" id="tfPrev" disabled><i class="bi bi-chevron-left"></i> 上一步</button>'
      + '      <button class="btn btn-outline-gold" id="tfNext">下一步 <i class="bi bi-chevron-right"></i></button>'
      + '      <button class="btn btn-primary" id="tfSave"><i class="bi bi-check2-circle"></i> 保存记录</button>'
      + '    </div>'
      + '  </div>'
      + '</div></div>';

    $c.html(html);

    // 填充下拉
    var $plan = $('#tfPlan');
    plans.forEach(function (p) { $plan.append('<option value="' + p.id + '">' + p.id + ' · ' + p.cropName + ' · ' + p.year + '年度 (' + p.varietyIds.length + '品种/' + p.stationCodes.length + '站点)</option>'); });
    var $st = $('#tfStation');
    stations.forEach(function (s) { $st.append('<option value="' + s.code + '">' + s.code + ' ' + s.name + ' (' + s.region + ')</option>'); });
    refreshVarieties(plans[0]);

    if (editRec) fillForm(editRec);

    var step = 1;
    // 事件绑定
    $plan.on('change', function () { refreshVarieties(DS.getTrialPlan(this.value)); });
    $('#tfSow,#tfMat').on('change input', updateGrowthDays);
    $('#tfEmg,#tfHead').on('change', updateGrowthDays);
    $('#tfCalcMu').on('click', function () {
      var plot = parseFloat($('#tfPlot').val());
      if (!plot || plot <= 0) { App.toast('warn', '请输入小区产量', '先填写小区实测产量'); return; }
      $('#tfMu').val((plot / DS.PLOT_AREA_MU).toFixed(2));
    });
    $('.agr-input').on('input', function () { validateAgrField(this); });
    $('#tfNext').on('click', function () { if (validateStep(step)) { step = Math.min(3, step + 1); goToStep(step); } });
    $('#tfPrev').on('click', function () { step = Math.max(1, step - 1); goToStep(step); });
    $('#tfReset').on('click', function () { if (confirm('确认重置当前表单？未保存数据将丢失。')) { $c.find('input,select').val(''); updateGrowthDays(); step = 1; goToStep(1); } });
    $('#tfSave').on('click', function () { if (validateAll()) saveRecord(); });

    function refreshVarieties(plan) {
      var $v = $('#tfVariety'); $v.empty();
      plan.varietyIds.forEach(function (vid) {
        var v = DS.getVariety(vid);
        if (v) $v.append('<option value="' + v.id + '"' + (v.isControl ? ' data-ctrl="1"' : '') + '>' + v.code + ' ' + v.name + (v.isControl ? ' (对照)' : '') + '</option>');
      });
    }

    function fillForm(rec) {
      $('#tfPlan').val(rec.planId); refreshVarieties(DS.getTrialPlan(rec.planId));
      $('#tfStation').val(rec.stationCode); $('#tfVariety').val(rec.varietyId); $('#tfRep').val(rec.replication);
      if (rec.phenology) {
        var p = rec.phenology;
        setDate('#tfSow', p.sowingDate); setDate('#tfEmg', p.emergenceDate); setDate('#tfHead', p.headingDate); setDate('#tfMat', p.maturityDate);
      }
      $('#tfPlot').val(rec.plotYield); $('#tfMu').val(rec.muYield);
      if (rec.agronomic) traits.forEach(function (t) { $('.agr-input[data-key="' + t.key + '"]').val(rec.agronomic[t.key]); });
      if (rec.resistance) resDefs.forEach(function (r) { $('.res-input[data-key="' + r.key + '"]').val(rec.resistance[r.key]); });
      updateGrowthDays();
    }
    function setDate(sel, val) {
      if (val == null || val === '') return;
      if (typeof val === 'number') return; // 种子数据用相对天数，不回填日期
      $(sel).val(val);
    }

    function updateGrowthDays() {
      var d = daysBetween($('#tfSow').val(), $('#tfMat').val());
      $('#tfGrowthDays').text(d != null ? d + ' 天' : '— 天');
      var warn = '';
      var emg = $('#tfEmg').val(), sow = $('#tfSow').val(), mat = $('#tfMat').val(), head = $('#tfHead').val();
      if (sow && emg && emg < sow) warn = '出苗期早于播期，请检查';
      else if (sow && head && head < sow) warn = '抽穗期早于播期，请检查';
      else if (sow && mat && mat <= sow) warn = '成熟期早于播期，逻辑矛盾';
      $('#tfPhenoWarn').text(warn).css('color', warn ? 'var(--warn-600)' : '');
      if (warn) $('#tfGrowthDays').removeClass('badge-green').addClass('badge-warn'); else $('#tfGrowthDays').addClass('badge-green').removeClass('badge-warn');
    }

    function validateAgrField(el) {
      var $el = $(el), val = $el.val(), min = parseFloat($el.data('min')), max = parseFloat($el.data('max')), num = parseFloat(val);
      var $fb = $el.siblings('.invalid-feedback');
      if (val === '') { $el.removeClass('is-invalid is-valid'); $fb.text(''); return true; }
      if (isNaN(num)) { $el.addClass('is-invalid'); $fb.text('请输入数字'); return false; }
      if (num < min || num > max) { $el.addClass('is-invalid'); $fb.text('超出合理范围 ' + min + '-' + max); return false; }
      $el.removeClass('is-invalid').addClass('is-valid'); $fb.text(''); return true;
    }

    function validateStep(s) {
      var ok = true;
      if (s === 1) {
        if (!$('#tfSow').val()) { markInvalid('#tfSow', '请选择播期'); ok = false; } else clearInvalid('#tfSow');
        if (!$('#tfMat').val()) { markInvalid('#tfMat', '请选择成熟期'); ok = false; } else clearInvalid('#tfMat');
        if (!$('#tfMu').val()) { markInvalid('#tfMu', '请填写亩产'); ok = false; } else clearInvalid('#tfMu');
        updateGrowthDays();
        if (!$('#tfPhenoWarn').text() === false) ok = false;
        if (ok) App.toast('success', '物候数据有效', '可继续填写农艺性状');
      } else if (s === 2) {
        $('.agr-input').each(function () { if (!validateAgrField(this)) ok = false; });
      }
      return ok;
    }
    function markInvalid(sel, msg) { $(sel).addClass('is-invalid'); if ($(sel).siblings('.invalid-feedback').length) $(sel).siblings('.invalid-feedback').text(msg); else $(sel).after('<div class="invalid-feedback d-block">' + msg + '</div>'); }
    function clearInvalid(sel) { $(sel).removeClass('is-invalid'); }

    function validateAll() {
      var ok = validateStep(1) && validateStep(2);
      if (!ok) { App.toast('warn', '校验未通过', '请修正标红字段'); goToStep(ok ? 3 : 1); }
      return ok;
    }

    function goToStep(s) {
      $('.wstep').removeClass('active').each(function (i) {
        if (i + 1 < s) $(this).addClass('done');
        if (i + 1 === s) $(this).addClass('active');
      });
      $('#tfPrev').prop('disabled', s === 1);
      $('#tfNext').toggle(s < 3);
      // 展开对应折叠面板(原生 Collapse API，防御性兜底)
      var target = s === 1 ? '#tfPheno' : (s === 2 ? '#tfAgr' : '#tfRes');
      try {
        document.querySelectorAll('.accordion-collapse').forEach(function (el) {
          if (el.id === target.substring(1)) {
            if (window.bootstrap && bootstrap.Collapse) bootstrap.Collapse.getOrCreateInstance(el).show();
            else el.classList.add('show');
          } else {
            if (window.bootstrap && bootstrap.Collapse) bootstrap.Collapse.getOrCreateInstance(el).hide();
            else el.classList.remove('show');
          }
        });
      } catch (e) {
        $('.accordion-collapse').removeClass('show');
        $(target).addClass('show');
      }
    }

    function saveRecord() {
      var plan = DS.getTrialPlan($('#tfPlan').val());
      var rec = {
        id: editRec ? editRec.id : null,
        planId: $('#tfPlan').val(),
        year: plan.year,
        cropCode: plan.cropCode,
        stationCode: $('#tfStation').val(),
        varietyId: $('#tfVariety').val(),
        varietyName: $('#tfVariety option:selected').text().replace(/^\S+\s/, ''),
        replication: parseInt($('#tfRep').val(), 10),
        plotYield: $('#tfPlot').val() ? parseFloat($('#tfPlot').val()) : null,
        muYield: parseFloat($('#tfMu').val()),
        phenology: {
          sowingDate: $('#tfSow').val() || null,
          emergenceDate: $('#tfEmg').val() || null,
          headingDate: $('#tfHead').val() || null,
          maturityDate: $('#tfMat').val() || null,
          growthDays: daysBetween($('#tfSow').val(), $('#tfMat').val())
        },
        agronomic: {},
        resistance: {},
        status: 'normal'
      };
      traits.forEach(function (t) { var v = $('.agr-input[data-key="' + t.key + '"]').val(); rec.agronomic[t.key] = v !== '' ? parseFloat(v) : null; });
      resDefs.forEach(function (r) { var v = $('.res-input[data-key="' + r.key + '"]').val(); rec.resistance[r.key] = v !== '' ? parseInt(v, 10) : null; });
      var saved = DS.saveRecord(rec);
      var issues = saved._issues || [];
      if (issues.length) {
        App.toast('warn', '已保存但存在异常', issues.length + ' 项需核查: ' + issues[0].msg);
      } else {
        App.toast('success', '保存成功', rec.varietyName + ' / ' + rec.stationCode + ' / 重复' + rec.replication);
      }
      if (opts.onSaved) opts.onSaved(saved);
      else { $c.find('input[type=date],input[type=number],input[type=text]').val(''); $('.agr-input,.res-input').val('').removeClass('is-valid is-invalid'); updateGrowthDays(); step = 1; goToStep(1); }
    }

    goToStep(1);
  }

  /* ---------- Excel 批量导入区 ---------- */
  function renderImportCard(container) {
    var $c = $(container);
    var state = DS.getState();
    var plans = DS.getTrialPlans({ year: state.currentYear, crop: state.currentCrop });
    var planId = plans.length ? plans[0].id : '';
    var html = ''
      + '<div class="card"><div class="card-header"><i class="bi bi-file-earmark-spreadsheet"></i> Excel 批量导入'
      + '  <div class="actions"><button class="btn btn-sm btn-outline-gold" id="dlTpl"><i class="bi bi-download"></i> 下载模板</button></div></div>'
      + '<div class="card-body">'
      + '  <p class="text-muted-2 small mb-2">按模板填写后上传，系统将自动校验并批量写入。当前方案：<b id="impPlanLabel">' + planId + '</b></p>'
      + '  <div class="d-flex gap-2 align-items-center flex-wrap">'
      + '    <input class="form-control form-control-sm" type="file" id="impFile" accept=".xlsx,.xls" style="max-width:300px;" />'
      + '    <button class="btn btn-sm btn-primary" id="impBtn"><i class="bi bi-upload"></i> 解析并导入</button>'
      + '    <span class="small text-muted-2" id="impStatus"></span>'
      + '  </div>'
      + '  <div id="impResult" class="mt-3"></div>'
      + '</div></div>';
    $c.html(html);
    $('#dlTpl').on('click', function () { global.ReportGenerator.downloadTemplate(planId); });
    $('#impBtn').on('click', function () {
      var f = document.getElementById('impFile').files[0];
      if (!f) { App.toast('warn', '请选择文件', '支持 .xlsx/.xls'); return; }
      $('#impStatus').text('解析中...').attr('class', 'small text-muted-2');
      global.ReportGenerator.parseImportFile(f, function (err, records) {
        if (err) { $('#impStatus').text('解析失败: ' + err.message).attr('class', 'small').css('color', 'var(--warn-600)'); return; }
        var res = DS.bulkImport(records);
        $('#impStatus').text('导入完成').attr('class', 'small').css('color', 'var(--ok-600)');
        $('#impResult').html('<div class="alert alert-success py-2"><i class="bi bi-check-circle"></i> 成功导入 <b>' + res.imported + '</b> 条，跳过 <b>' + res.skipped + '</b> 条无效行。</div>');
        App.toast('success', '批量导入完成', '成功 ' + res.imported + ' 条');
      });
    });
  }

  global.TrialForm = { render: render, renderImportCard: renderImportCard };
})(window);
