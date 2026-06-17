var FollowupView = (function() {
  'use strict';

  var tab = 'plan';
  var searchKw = '';
  var selectedRxId = null;

  function buildStatCard(title, value, icon, grad, href) {
    return '<div class="col-md-3 col-sm-6">'
      + '<div class="stat-card ' + grad + ' shadow-sm">'
      + '<div class="d-flex align-items-start justify-content-between mb-2">'
      + '<div class="stat-icon"><i class="bi ' + icon + '"></i></div>'
      + (href ? '<a class="stat-link small text-decoration-none text-white opacity-75" href="#' + href + '">查看 →</a>' : '')
      + '</div>'
      + '<div class="stat-value">' + value + '</div>'
      + '<div class="stat-label">' + title + '</div>'
      + '</div></div>';
  }

  function renderAll() {
    if (tab === 'plan') renderPlanList();
    else if (tab === 'adverse') renderAdverseList();
    else if (tab === 'stats') renderStats();
  }

  function renderPlanList() {
    var $root = $('#followupPage');
    var plans = AppStore.getState(AppStore.KEYS.FOLLOWUPS) || [];
    var rxList = AppStore.getState(AppStore.KEYS.PRESCRIPTIONS) || [];
    var rxMap = {};
    rxList.forEach(function(r) { rxMap[r.id] = r; });
    plans = plans.slice().sort(function(a, b) { return b.days[0].scheduledDate.localeCompare(a.days[0].scheduledDate); });
    if (searchKw) {
      plans = plans.filter(function(p) {
        return (p.patientName || '').indexOf(searchKw) >= 0
          || (p.diagnosis || '').indexOf(searchKw) >= 0
          || (p.summary || '').indexOf(searchKw) >= 0;
      });
    }
    var pending = 0, done = 0, adverse = 0;
    plans.forEach(function(p) {
      p.days.forEach(function(d) {
        if (d.status === '待随访') pending++;
        else if (d.status === '已完成') done++;
        if (d.reaction === '不良反应') adverse++;
      });
    });
    var html = buildTabBar()
      + '<div class="row g-3 mb-3">'
      + buildStatCard('随访计划数', plans.length + ' 张', 'bi-calendar2-check', 'grad-blue', null)
      + buildStatCard('待随访次数', pending + ' 次', 'bi-clock-history', 'grad-orange', null)
      + buildStatCard('已完成随访', done + ' 次', 'bi-check2-circle', 'grad-green', null)
      + buildStatCard('不良反应报告', adverse + ' 条', 'bi-exclamation-octagon-fill', 'grad-red', null)
      + '</div>'

      + '<div class="card border-0 shadow-sm mb-3"><div class="card-header bg-white d-flex align-items-center gap-2 py-3">'
      + '<div class="input-group input-group-sm" style="max-width:320px"><span class="input-group-text"><i class="bi bi-search"></i></span>'
      + '<input type="text" class="form-control" id="fuSearch" placeholder="搜索患者/诊断" value="' + searchKw + '"></div>'
      + '<button class="btn btn-sm btn-herb ms-auto" id="syncFuBtn"><i class="bi bi-arrow-repeat me-1"></i>同步处方生成随访</button>'
      + '</div><div class="card-body p-0">';

    if (plans.length === 0) {
      html += '<div class="text-center py-5 text-muted"><i class="bi bi-calendar-x fs-1 d-block mb-2 opacity-25"></i>'
        + '<p class="mb-1">暂无随访计划</p><small>调配处方后将自动生成7日随访计划</small></div>';
    } else {
      html += '<div class="row g-3 p-3" style="max-height:72vh;overflow:auto">';
      plans.forEach(function(p) {
        var today = formatDate(Date.now());
        var pendingDays = p.days.filter(function(d) { return d.status === '待随访'; }).length;
        var hasBad = p.days.some(function(d) { return d.reaction === '不良反应'; });
        var statusCard = hasBad ? 'border-danger shadow-sm border-2'
          : (pendingDays > 0 ? 'border-info border-1' : 'border-success border-1');
        html += '<div class="col-lg-4 col-md-6 col-sm-12"><div class="card h-100 ' + statusCard + ' followup-card cursor-pointer" data-rx="' + p.prescriptionId + '">'
          + '<div class="card-header bg-white d-flex align-items-center py-2">'
          + '<div class="me-2"><div class="fw-bold mb-0">' + p.patientName + '</div><small class="text-muted">' + p.patientGender + ' ' + p.patientAge + '岁</small></div>'
          + (hasBad ? '<span class="badge bg-danger text-white ms-auto"><i class="bi bi-exclamation-octagon me-1"></i>不良反应</span>'
            : (pendingDays > 0 ? '<span class="badge bg-info text-white ms-auto">' + pendingDays + '次待随访</span>'
                : '<span class="badge bg-success text-white ms-auto"><i class="bi bi-check2-all me-1"></i>全部完成</span>'))
          + '</div><div class="card-body py-2"><div class="small"><span class="badge bg-light text-dark me-1">' + (p.totalDose||3) + '剂</span>'
          + '<span class="badge bg-light text-dark">' + (p.herbCount||0) + '味</span>'
          + '<span class="text-herb-green-dark ms-2 fw-medium">' + (p.diagnosis || '-') + '</span></div>'
          + '<div class="followup-timeline mt-3">';
        p.days.forEach(function(d) {
          var isToday = d.scheduledDate === today;
          var done = d.status !== '待随访';
          var adverse = d.reaction === '不良反应';
          var cls = done ? (adverse ? 'danger' : 'done') : (isToday ? 'today' : '');
          var tip = '第' + d.day + '天 ' + d.scheduledDate + ' - ' + (d.reaction || d.status);
          html += '<div class="followup-day ' + cls + '" title="' + tip + '">'
            + (isToday && !done ? '<div class="pulse-dot"></div>' : '')
            + (d.day) + '</div>';
        });
        html += '</div><div class="small mt-2 text-muted">随访起点：' + p.days[0].scheduledDate + ' → ' + p.days[p.days.length-1].scheduledDate + '</div>';
        if (p.summary) {
          html += '<div class="mt-2 p-2 bg-light rounded small"><b class="text-herb-green-dark">病程总结：</b>' + p.summary + '</div>';
        }
        html += '</div>'
          + '<div class="card-footer bg-white py-2 d-flex">'
          + '<button class="btn btn-sm btn-outline-primary flex-grow-1 me-1 open-detail" data-rx="' + p.prescriptionId + '">'
          + '<i class="bi bi-journal-text me-1"></i>记录随访</button>'
          + '<button class="btn btn-sm btn-outline-secondary view-rx" data-rx="' + p.prescriptionId + '">'
          + '<i class="bi bi-receipt"></i></button></div>'
          + '</div></div>';
      });
      html += '</div>';
    }
    html += '</div></div>';
    $root.html(html);
    bindEvents();
  }

  function renderAdverseList() {
    var $root = $('#followupPage');
    var plans = AppStore.getState(AppStore.KEYS.FOLLOWUPS) || [];
    var reports = [];
    plans.forEach(function(p) {
      p.days.forEach(function(d) {
        if (d.reaction === '不良反应' || (d.notes && d.notes.indexOf('不良') >= 0)) {
          reports.push({ plan: p, day: d });
        }
      });
    });
    reports.sort(function(a, b) { return (b.day.contactedAt || 0) - (a.day.contactedAt || 0); });

    var html = buildTabBar()
      + '<div class="row g-3 mb-3">'
      + buildStatCard('累计不良反应', reports.length + ' 条', 'bi-exclamation-octagon-fill', 'grad-red', null)
      + buildStatCard('近30天报告', reports.filter(function(r) { return (r.day.contactedAt || 0) > Date.now() - 30*86400000; }).length + ' 条', 'bi-activity', 'grad-orange', null)
      + buildStatCard('回溯处方', reports.length + ' 张', 'bi-receipt', 'grad-purple', null)
      + buildStatCard('报告率', plans.length ? (reports.length / plans.length * 100).toFixed(1) : '0.0' + ' %', 'bi-graph-up-arrow', 'grad-teal', null)
      + '</div>'
      + '<div class="card border-0 shadow-sm border-danger"><div class="card-header bg-danger-subtle py-3">'
      + '<h6 class="mb-0 fw-bold text-danger"><i class="bi bi-exclamation-octagon-fill me-2"></i>不良反应登记（可回溯处方）</h6></div>'
      + '<div class="card-body p-0">';
    if (reports.length === 0) {
      html += '<div class="text-center py-5 text-muted"><i class="bi bi-shield-check fs-1 d-block mb-2 text-success opacity-50"></i>暂无不良反应报告</div>';
    } else {
      html += '<div class="table-responsive" style="max-height:68vh"><table class="table align-middle mb-0">'
        + '<thead class="sticky-top"><tr><th>患者</th><th>诊断</th><th>随访日</th><th>症状描述</th><th>联系时间</th><th>操作</th></tr></thead><tbody>';
      reports.forEach(function(r) {
        html += '<tr class="inventory-expiring-row">'
          + '<td><b>' + r.plan.patientName + '</b><small class="text-muted d-block">' + r.plan.patientGender + ' ' + r.plan.patientAge + '岁</small></td>'
          + '<td><span class="text-herb-green-dark fw-medium">' + (r.plan.diagnosis || '-') + '</span></td>'
          + '<td><span class="badge bg-warning text-white">第' + r.day.day + '天</span> ' + r.day.scheduledDate + '</td>'
          + '<td class="small">' + (r.day.notes || '<span class="text-muted">详见纸质记录</span>') + '</td>'
          + '<td class="small font-mono">' + (r.day.contactedAt ? relativeTime(r.day.contactedAt) : '-') + '</td>'
          + '<td><button class="btn btn-sm btn-outline-primary view-rx" data-rx="' + r.plan.prescriptionId + '"><i class="bi bi-receipt me-1"></i>回溯处方</button></td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div></div>';
    $root.html(html);
    bindEvents();
  }

  function renderStats() {
    var $root = $('#followupPage');
    var plans = AppStore.getState(AppStore.KEYS.FOLLOWUPS) || [];
    var total = plans.length;
    var allDays = plans.reduce(function(s, p) { return s + p.days.length; }, 0);
    var doneDays = plans.reduce(function(s, p) { return s + p.days.filter(function(d) { return d.status === '已完成'; }).length; }, 0);
    var reportRate = allDays ? (doneDays / allDays * 100).toFixed(1) : '0.0';
    var advDays = plans.reduce(function(s, p) { return s + p.days.filter(function(d) { return d.reaction === '不良反应'; }).length; }, 0);
    var html = buildTabBar()
      + '<div class="row g-3 mb-3">'
      + buildStatCard('随访计划总数', total + ' 张', 'bi-journal-medical', 'grad-blue', null)
      + buildStatCard('7日回访覆盖率', reportRate + ' %', 'bi-clipboard2-data', 'grad-green', null)
      + buildStatCard('不良反应率', allDays ? (advDays / allDays * 100).toFixed(1) : '0.0' + ' %', 'bi-heart-pulse', 'grad-red', null)
      + buildStatCard('计划完成度', doneDays + '/' + allDays, 'bi-check-all', 'grad-teal', null)
      + '</div>'

      + '<div class="row g-3"><div class="col-md-8"><div class="card border-0 shadow-sm h-100">'
      + '<div class="card-header bg-white py-3"><h6 class="mb-0 fw-bold"><i class="bi bi-graph-up me-2 text-herb-green"></i>每周随访完成趋势</h6></div>'
      + '<div class="card-body"><canvas id="fuCanvas" style="width:100%;height:280px"></canvas></div></div></div>'

      + '<div class="col-md-4"><div class="card border-0 shadow-sm h-100">'
      + '<div class="card-header bg-white py-3"><h6 class="mb-0 fw-bold"><i class="bi bi-pie-chart me-2 text-herb-green"></i>患者反馈分布</h6></div>'
      + '<div class="card-body"><canvas id="fuPie" style="width:100%;height:280px"></canvas></div></div></div>'

      + '<div class="col-md-12"><div class="card border-0 shadow-sm">'
      + '<div class="card-header bg-white py-3"><h6 class="mb-0 fw-bold"><i class="bi bi-list-check me-2 text-herb-green"></i>今日待随访清单</h6></div>'
      + '<div class="card-body p-0">';
    var today = formatDate(Date.now());
    var todoList = [];
    plans.forEach(function(p) {
      p.days.forEach(function(d) {
        if (d.scheduledDate === today && d.status === '待随访') {
          todoList.push({ plan: p, day: d });
        }
      });
    });
    if (todoList.length === 0) {
      html += '<div class="text-center py-4 text-muted"><i class="bi bi-check2-all d-block fs-1 mb-2 text-success opacity-50"></i>今日待随访任务已全部完成</div>';
    } else {
      html += '<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>患者</th><th>诊断</th><th>第几天</th><th>上次反应</th><th>操作</th></tr></thead><tbody>';
      todoList.forEach(function(r) {
        var prev = r.plan.days.slice(0, r.day.day - 1).reverse().find(function(d) { return d.status === '已完成'; });
        html += '<tr>'
          + '<td><b>' + r.plan.patientName + '</b> <small class="text-muted">' + r.plan.patientGender + ' ' + r.plan.patientAge + '岁</small></td>'
          + '<td class="text-herb-green-dark fw-medium">' + (r.plan.diagnosis || '-') + '</td>'
          + '<td><span class="badge bg-info text-white">第' + r.day.day + '天</span></td>'
          + '<td class="small">' + (prev ? (prev.reaction || prev.status) : '<span class="text-muted">首次随访</span>') + '</td>'
          + '<td><button class="btn btn-sm btn-herb open-detail" data-rx="' + r.plan.prescriptionId + '"><i class="bi bi-journal-text me-1"></i>开始随访</button></td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div></div></div></div>';
    $root.html(html);
    setTimeout(function() { drawFuCharts(todoList.length); }, 100);
    bindEvents();
  }

  function drawFuCharts(todoCount) {
    var plans = AppStore.getState(AppStore.KEYS.FOLLOWUPS) || [];
    var wkDone = [0,0,0,0,0,0,0], wkTotal = [0,0,0,0,0,0,0];
    plans.forEach(function(p) {
      p.days.forEach(function(d) {
        var idx = d.day - 1;
        if (idx < 7) {
          wkTotal[idx]++;
          if (d.status === '已完成') wkDone[idx]++;
        }
      });
    });
    App.drawBarLine('fuCanvas', {
      title: '',
      xLabels: ['第1天','第2天','第3天','第4天','第5天','第6天','第7天'],
      bars: wkDone.map(function(v, i) { return Math.round(wkTotal[i] ? v/wkTotal[i]*100 : 0); }),
      barLabel: '回访覆盖率%',
      line: wkTotal,
      lineLabel: '总计划数'
    });
    var good = 0, ok = 0, bad = 0;
    plans.forEach(function(p) {
      p.days.forEach(function(d) {
        if (d.status !== '已完成') return;
        if (d.reaction === '不良反应') bad++;
        else if (d.reaction === '症状缓解' || d.reaction === '痊愈') good++;
        else ok++;
      });
    });
    App.drawPie('fuPie', [
      { label: '疗效显著', value: good, color: '#2D6A4F' },
      { label: '症状平稳', value: ok, color: '#40916C' },
      { label: '不良反应', value: bad, color: '#9B2335' }
    ]);
  }

  function buildTabBar() {
    var tabs = [
      { k: 'plan', label: '随访计划', icon: 'bi-calendar2-check' },
      { k: 'adverse', label: '不良反应', icon: 'bi-exclamation-octagon-fill' },
      { k: 'stats', label: '随访统计', icon: 'bi-bar-chart-line' }
    ];
    return '<ul class="nav nav-tabs nav-tabs-herb mb-3">'
      + tabs.map(function(t) {
          return '<li class="nav-item"><a class="nav-link ' + (tab===t.k?'active':'') + '" data-tab="' + t.k + '" href="javascript:void(0)">'
            + '<i class="bi ' + t.icon + ' me-1"></i>' + t.label + '</a></li>';
        }).join('')
      + '</ul>';
  }

  function bindEvents() {
    $(document).off('click', '[data-tab]').on('click', '[data-tab]', function() { tab = $(this).data('tab'); renderAll(); });
    $(document).off('input', '#fuSearch').on('input', '#fuSearch', function() {
      clearTimeout(bindEvents._t);
      var v = $(this).val();
      bindEvents._t = setTimeout(function() { searchKw = v; renderAll(); }, 200);
    });
    $(document).off('click', '#syncFuBtn').on('click', '#syncFuBtn', function() {
      var rxList = AppStore.getState(AppStore.KEYS.PRESCRIPTIONS) || [];
      var plans = AppStore.getState(AppStore.KEYS.FOLLOWUPS) || [];
      var existIds = {}; plans.forEach(function(p) { existIds[p.prescriptionId] = 1; });
      var added = 0;
      rxList.forEach(function(rx) {
        if (existIds[rx.id]) return;
        AppStore.addFollowup(PrescriptionEngine.createFollowupPlan(rx));
        added++;
      });
      if (added > 0) Toast.success('同步完成，新增 ' + added + ' 张随访计划');
      else Toast.info('所有处方已生成随访计划，无需重复同步');
      renderAll();
    });
    $(document).off('click', '.open-detail').on('click', '.open-detail', function(e) {
      e.stopPropagation();
      openDetailModal($(this).data('rx'));
    });
    $(document).off('click', '.view-rx').on('click', '.view-rx', function(e) {
      e.stopPropagation();
      viewPrescription($(this).data('rx'));
    });
    $(document).off('click', '.followup-card').on('click', '.followup-card', function() {
      openDetailModal($(this).data('rx'));
    });
  }

  function openDetailModal(rxId) {
    var plans = AppStore.getState(AppStore.KEYS.FOLLOWUPS) || [];
    var plan = plans.find(function(p) { return p.prescriptionId === rxId; });
    if (!plan) { Toast.danger('未找到随访计划'); return; }
    var html = '<div class="modal-header bg-herb-green text-white border-0">'
      + '<div><h5 class="modal-title mb-0"><i class="bi bi-journal-medical me-2"></i>' + plan.patientName + ' - 7日用药随访</h5>'
      + '<small class="opacity-75">' + plan.patientGender + ' ' + plan.patientAge + '岁 | ' + (plan.diagnosis || '-') + '</small></div>'
      + '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>'
      + '<div class="modal-body p-0">'
      + '<div class="p-3 border-bottom bg-light"><div class="d-flex flex-wrap gap-2 mb-2">';
    plan.days.forEach(function(d, i) {
      var done = d.status === '已完成';
      var bad = d.reaction === '不良反应';
      var cls = done ? (bad ? 'bg-danger text-white' : 'bg-success text-white') : 'bg-white border';
      html += '<button class="day-jump-btn btn btn-sm ' + cls + '" data-day-idx="' + i + '">第' + d.day + '天<br><small>' + d.scheduledDate + '</small></button>';
    });
    html += '</div><small class="text-muted">提示：点击上方天数快速跳转，完成后请点击"保存随访记录"</small></div>'
      + '<div class="p-3" id="dayFormWrap">';
    plan.days.forEach(function(d, i) {
      html += '<div class="mb-4 p-3 rounded day-form" data-day-idx="' + i + '" style="border-left:4px solid ' + (d.reaction==='不良反应'?'#9B2335':'#2D6A4F') + ';background:#fff">'
        + '<h6 class="fw-bold mb-2"><i class="bi bi-calendar-day me-2 text-herb-green"></i>第' + d.day + '天随访 · ' + d.scheduledDate + '</h6>'
        + '<div class="row g-3 mb-2">'
        + '<div class="col-md-4"><label class="form-label small">随访状态</label>'
        + '<select class="form-select status-select" data-i="' + i + '">'
        + ['待随访','已完成','患者无应答','已退方'].map(function(s) { return '<option' + (d.status===s?' selected':'') + '>' + s + '</option>'; }).join('')
        + '</select></div>'
        + '<div class="col-md-4"><label class="form-label small">患者反馈</label>'
        + '<select class="form-select reaction-select" data-i="' + i + '">'
        + ['-','痊愈','症状缓解','无明显变化','症状加重','不良反应'].map(function(s) { return '<option' + ((d.reaction||'-')===s?' selected':'') + '>' + (s==='-'?'未记录':s) + '</option>'; }).join('')
        + '</select></div>'
        + '<div class="col-md-4"><label class="form-label small">联系时间</label>'
        + '<input type="datetime-local" class="form-control contact-input" data-i="' + i + '" value="' + (d.contactedAt ? formatDate(d.contactedAt,'YYYY-MM-DDTHH:mm') : formatDate(Date.now(),'YYYY-MM-DDTHH:mm')) + '"></div>'
        + '</div>'
        + '<div class="mb-2"><label class="form-label small">详细记录（症状/服药情况/饮食睡眠）</label>'
        + '<textarea class="form-control notes-ta" rows="2" data-i="' + i + '" placeholder="例：服药2剂后汗出热退，咳嗽减轻，睡眠好转，嘱多饮水...">' + (d.notes || '') + '</textarea></div>'
        + '</div>';
    });
    html += '<div class="mb-4 p-3 bg-warning-subtle rounded border-start border-warning border-4">'
      + '<h6 class="fw-bold mb-2 text-warning"><i class="bi bi-file-text me-2"></i>本次疗程总结（选填）</h6>'
      + '<textarea class="form-control" id="summaryTa" rows="2" placeholder="例：7剂服完，表证已解，正气渐复，嘱清淡饮食，二周后复诊...">' + (plan.summary || '') + '</textarea></div>'
      + '</div></div>'
      + '<div class="modal-footer bg-light border-0">'
      + '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">暂不保存</button>'
      + '<button type="button" class="btn btn-herb" id="saveFollowupBtn"><i class="bi bi-save2 me-1"></i>保存随访记录</button></div>';

    var $wrap = $('<div class="modal fade" id="fuDetailModal" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content"></div></div></div>');
    $wrap.find('.modal-content').html(html);
    $('body').append($wrap);
    var mdl = new bootstrap.Modal($wrap[0]);
    mdl.show();
    $wrap.on('click', '.day-jump-btn', function() {
      var i = $(this).data('dayIdx');
      var $target = $('.day-form[data-day-idx=' + i + ']');
      if ($target.length) $target[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $wrap.on('change', '.reaction-select', function() {
      var v = $(this).val();
      if (v === '不良反应') {
        Toast.warning('已标记为不良反应，该记录将在不良反应登记表中高亮可回溯');
      }
    });
    $wrap.on('click', '#saveFollowupBtn', function() {
      plans.forEach(function(p) {
        if (p.prescriptionId !== rxId) return;
        p.summary = $('#summaryTa').val();
        p.days.forEach(function(d, i) {
          d.status = $('.status-select[data-i=' + i + ']').val();
          var rv = $('.reaction-select[data-i=' + i + ']').val();
          d.reaction = rv === '未记录' ? null : rv;
          var cv = $('.contact-input[data-i=' + i + ']').val();
          d.contactedAt = cv ? new Date(cv).getTime() : Date.now();
          d.notes = $('.notes-ta[data-i=' + i + ']').val();
        });
      });
      AppStore.saveKey(AppStore.KEYS.FOLLOWUPS, plans);
      Toast.success('随访记录已保存');
      mdl.hide();
      setTimeout(function() { $wrap.remove(); }, 500);
      renderAll();
    });
  }

  function viewPrescription(rxId) {
    var rxList = AppStore.getState(AppStore.KEYS.PRESCRIPTIONS) || [];
    var rx = rxList.find(function(r) { return r.id === rxId; });
    if (!rx) { Toast.danger('未找到处方记录'); return; }
    window.location.hash = '#/prescription/view/' + rxId;
  }

  return {
    init: function(opts) {
      tab = (opts && opts.tab) || 'plan';
      renderAll();
    }
  };
})();
