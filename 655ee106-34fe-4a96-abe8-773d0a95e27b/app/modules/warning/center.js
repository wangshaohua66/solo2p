/* ==========================================================================
   app/modules/warning/center.js — 预警中心模块
   工期延误/资源冲突/关键节点滞后 三类风险分级展示与处置
   ========================================================================== */
(function (global) {
  'use strict';
  var M = {};
  var state = { pid: '', sev: '全部', type: '全部', status: '待处理' };

  var DS = function () { return global.App.DataService; };
  var UI = function () { return global.App.UI; };

  function filtered() {
    return DS().getWarnings(state.pid || null).filter(function (w) {
      if (state.sev !== '全部' && w.severity !== state.sev) return false;
      if (state.type !== '全部' && w.type !== state.type) return false;
      if (state.status !== '全部' && w.status !== state.status) return false;
      return true;
    });
  }

  function iconFor(type) {
    return type === '工期延误' ? 'bi-clock-history'
      : type === '资源冲突' ? 'bi-exclamation-triangle-fill'
        : 'bi-flag-fill';
  }

  function renderSummary($main) {
    var all = DS().getWarnings(null, '待处理');
    var high = all.filter(function (w) { return w.severity === '高'; }).length;
    var mid = all.filter(function (w) { return w.severity === '中'; }).length;
    var low = all.filter(function (w) { return w.severity === '低'; }).length;
    var cards = [
      { label: '高风险', value: high, icon: 'bi-exclamation-octagon-fill', cls: 'text-red', delta: '需立即处置' },
      { label: '中风险', value: mid, icon: 'bi-exclamation-triangle-fill', cls: 'text-amber', delta: '建议关注' },
      { label: '低风险', value: low, icon: 'bi-info-circle-fill', cls: 'text-blue', delta: '持续监控' },
      { label: '待处置总数', value: all.length, icon: 'bi-bell-fill', cls: 'text-amber', delta: '全项目汇总' }
    ];
    $main.find('#warn-stat').html(cards.map(function (c) {
      return '<div class="col-6 col-lg-3 mb-3"><div class="stat-card"><div class="label">' + UI().escape(c.label) + '</div><div class="value mono ' + c.cls + '">' + c.value + '</div><div class="delta text-muted-2">' + UI().escape(c.delta) + '</div><i class="bi ' + c.icon + ' icon"></i></div></div>';
    }).join(''));
  }

  function renderList($main) {
    var list = filtered();
    var $box = $main.find('#warn-list');
    if (!list.length) { UI().empty($box, 'bi-check-circle', '当前筛选条件下暂无预警'); return; }
    $box.html('<div class="stagger">' + list.map(function (w) {
      var proj = DS().getProject(w.projectId);
      var sev = w.severity === '高' ? 'sev-high' : (w.severity === '中' ? 'sev-mid' : 'sev-low');
      return '<div class="warn-card ' + sev + ' ' + (w.status !== '待处理' ? w.status : '') + '">' +
        '<div class="sev-bar"></div>' +
        '<i class="bi ' + iconFor(w.type) + ' wi"></i>' +
        '<div class="wc-body">' +
        '<div class="wc-title">' + UI().escape(w.type) + ' ' + UI().riskBadge(w.severity) + ' ' + UI().statusTag(w.status) + '</div>' +
        '<div class="wc-desc">' + UI().escape(w.description) + '</div>' +
        '<div class="wc-meta"><span><i class="bi bi-building"></i> ' + UI().escape(proj ? proj.name : w.projectId) + '</span><span><i class="bi bi-calendar3"></i> ' + moment(w.createdAt).format('MM-DD') + '</span></div>' +
        '</div>' +
        '<div class="wc-actions">' +
        (w.status === '待处理' ? '<button class="btn btn-amber btn-sm btn-warn-act" data-id="' + w.id + '" data-act="confirm">确认</button><button class="btn btn-ghost btn-sm btn-warn-act" data-id="' + w.id + '" data-act="ignore">忽略</button>' : '<button class="btn btn-ghost btn-sm btn-warn-act" data-id="' + w.id + '" data-act="reopen">重置</button>') +
        '</div></div>';
    }).join('') + '</div>');
  }

  function act(id, act) {
    var w = DS().getWarnings(null).find(function (x) { return x.id === id; });
    if (!w) return;
    if (act === 'confirm') {
      UI().confirm({ title: '确认预警处置', message: '确认预警「' + w.type + '」已处置？该预警将标记为已确认。', okText: '确认处置' }, function () {
        DS().updateWarning(id, '已确认'); UI().toast('预警已标记为已确认', 'success', 1400); after();
      });
    } else if (act === 'ignore') {
      DS().updateWarning(id, '已忽略'); UI().toast('预警已忽略', 'info', 1400); after();
    } else {
      DS().updateWarning(id, '待处理'); UI().toast('预警已重置', 'info', 1400); after();
    }
    function after() { renderSummary($('#app-main')); renderList($('#app-main')); global.App.refreshChrome && global.App.refreshChrome(); }
  }

  M.render = function ($main) {
    var projs = [{ id: '', name: '全部项目' }].concat(DS().getProjects());
    var sel = projs.map(function (p) { return '<option value="' + p.id + '"' + (p.id === state.pid ? ' selected' : '') + '>' + UI().escape(p.name) + '</option>'; }).join('');
    $main.html(
      '<div id="warn-stat" class="row"></div>' +
      '<div class="filter-bar mb-3">' +
      '<select class="form-select form-select-sm" id="f-proj" style="width:auto;max-width:220px">' + sel + '</select>' +
      seg('sev', ['全部', '高', '中', '低']) +
      seg('type', ['全部', '工期延误', '资源冲突', '关键节点滞后']) +
      seg('status', ['全部', '待处理', '已确认', '已忽略']) +
      '<button class="btn btn-ghost btn-sm ms-auto" id="refresh-warn"><i class="bi bi-arrow-clockwise"></i> 重新检测</button>' +
      '</div>' +
      '<div id="warn-list"></div>'
    );
    state = { pid: '', sev: '全部', type: '全部', status: '待处理' };
    renderSummary($main); renderList($main);
    $main.find('#f-proj').on('change', function () { state.pid = $(this).val(); renderList($main); });
    $main.find('[data-seg]').each(function () {
      var key = $(this).data('seg');
      $(this).find('button').on('click', function () {
        state[key] = $(this).data('val'); $(this).siblings().removeClass('on').end().addClass('on'); renderList($main);
      });
    });
    $main.find('#refresh-warn').on('click', function () {
      DS().refreshWarnings(DS().load(), state.pid || null);
      UI().toast('已重新检测风险预警', 'success', 1400);
      renderSummary($main); renderList($main); global.App.refreshChrome && global.App.refreshChrome();
    });
    $main.on('click', '.btn-warn-act', function () { act($(this).data('id'), $(this).data('act')); });
  };

  function seg(key, vals) {
    return '<div class="seg" data-seg="' + key + '">' + vals.map(function (v, i) { return '<button class="' + (i === 0 ? 'on' : '') + '" data-val="' + v + '">' + v + '</button>'; }).join('') + '</div>';
  }

  global.App = global.App || {};
  global.App.Modules = global.App.Modules || {};
  global.App.Modules.warning = M;
})(window);
