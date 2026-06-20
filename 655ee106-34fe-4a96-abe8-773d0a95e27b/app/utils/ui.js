/* ==========================================================================
   ui.js — 共享 UI 辅助：Toast、确认框、加载、格式化、模板转义
   ========================================================================== */
(function (global) {
  'use strict';

  var UI = {};

  UI.escape = function (str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  UI.toast = function (msg, type, timeout) {
    type = type || 'info';
    var $host = $('#toast-host');
    if (!$host.length) { $host = $('<div class="toast-host" id="toast-host"></div>').appendTo('body'); }
    var icon = type === 'success' ? 'bi-check-circle-fill'
      : type === 'error' ? 'bi-x-circle-fill'
        : type === 'warn' ? 'bi-exclamation-triangle-fill'
          : 'bi-info-circle-fill';
    var $t = $('<div class="toast-msg ' + type + '"><i class="bi ' + icon + '"></i><span>' + UI.escape(msg) + '</span></div>');
    $host.append($t);
    setTimeout(function () { $t.fadeOut(200, function () { $t.remove(); }); }, timeout || 2800);
  };

  UI.confirm = function (opts, onOk, onCancel) {
    opts = opts || {};
    var id = 'confirm-' + Date.now();
    var html =
      '<div class="modal fade" id="' + id + '" tabindex="-1">' +
      '<div class="modal-dialog modal-dialog-centered"><div class="modal-content">' +
      '<div class="modal-header"><h5 class="modal-title"><i class="bi ' + (opts.icon || 'bi-exclamation-triangle-fill') + ' text-amber me-2"></i>' + UI.escape(opts.title || '确认操作') + '</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
      '<div class="modal-body">' + (opts.html || UI.escape(opts.message || '')) + '</div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-bs-dismiss="modal">' + UI.escape(opts.cancelText || '取消') + '</button>' +
      '<button type="button" class="btn btn-amber btn-sm" data-ok="1">' + UI.escape(opts.okText || '确认') + '</button>' +
      '</div></div></div></div>';
    var $m = $(html).appendTo('body');
    var modal = new bootstrap.Modal($m[0]);
    $m.find('[data-ok]').on('click', function () { modal.hide(); onOk && onOk(); });
    $m.on('hidden.bs.modal', function () { $m.remove(); onCancel && onCancel(); });
    modal.show();
  };

  UI.modal = function (opts) {
    opts = opts || {};
    var id = opts.id || ('modal-' + Date.now());
    var sizeClass = opts.size === 'lg' ? 'modal-lg' : (opts.size === 'xl' ? 'modal-xl' : '');
    var html =
      '<div class="modal fade" id="' + id + '" tabindex="-1">' +
      '<div class="modal-dialog modal-dialog-centered ' + sizeClass + ' ' + (opts.scrollable ? 'modal-dialog-scrollable' : '') + '"><div class="modal-content">' +
      '<div class="modal-header"><h5 class="modal-title">' + (opts.title || '') + '</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (opts.footer ? '<div class="modal-footer">' + opts.footer + '</div>' : '') +
      '</div></div></div></div>';
    var $m = $(html).appendTo('body');
    var modal = new bootstrap.Modal($m[0]);
    $m.on('hidden.bs.modal', function () { $m.remove(); });
    modal.show();
    return { $el: $m, modal: modal, id: id };
  };

  UI.loading = function ($el, text) {
    $el.html('<div class="empty-state"><div class="spinner-border spinner-border-sm text-amber me-2"></div>' + UI.escape(text || '加载中…') + '</div>');
  };

  UI.empty = function ($el, icon, text) {
    $el.html('<div class="empty-state"><i class="bi ' + (icon || 'bi-inbox') + '"></i><div>' + UI.escape(text || '暂无数据') + '</div></div>');
  };

  /* ---- 格式化 ---- */
  UI.fmtDate = function (d, fmt) {
    if (!d) return '—';
    return moment(d).format(fmt || 'YYYY-MM-DD');
  };
  UI.fmtPct = function (n) { return (n == null ? '—' : Math.round(n) + '%'); };
  UI.fmtMoney = function (n) {
    if (n == null) return '—';
    return '¥' + Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  };
  UI.fmtDays = function (n) { return (n == null ? '—' : n + ' 天'); };
  UI.fmtNum = function (n) { return n == null ? '—' : Number(n).toLocaleString('zh-CN'); };

  UI.riskBadge = function (level) {
    var map = { '高': 'sev-tag high', '中': 'sev-tag mid', '低': 'sev-tag low' };
    return '<span class="' + (map[level] || 'sev-tag low') + '">' + (level || '低') + '</span>';
  };
  UI.stageBadge = function (stage) {
    return '<span class="badge-stage">' + UI.escape(stage || '—') + '</span>';
  };
  UI.typeColor = function (type) {
    return type === '住宅' ? 'var(--green)' : type === '商业' ? 'var(--amber)' : 'var(--cyan)';
  };

  UI.progressBar = function (pct, color) {
    pct = Math.max(0, Math.min(100, pct || 0));
    return '<div style="height:6px;background:var(--steel-700);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + (color || 'var(--amber)') + ';transition:width .4s"></div></div>';
  };

  UI.ringSVG = function (pct, size, stroke, color) {
    pct = Math.max(0, Math.min(100, pct || 0));
    size = size || 74; stroke = stroke || 7; color = color || 'var(--amber)';
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var off = c * (1 - pct / 100);
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--steel-600)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" style="transition:stroke-dashoffset .6s"/>' +
      '</svg><div class="ring-val">' + Math.round(pct) + '%</div></div>';
  };

  UI.statusTag = function (status) {
    var map = { '待处理': 'pending', '已确认': 'confirmed', '已忽略': 'ignored' };
    return '<span class="status-tag ' + (map[status] || 'pending') + '">' + UI.escape(status || '待处理') + '</span>';
  };

  global.App = global.App || {};
  global.App.UI = UI;
})(window);
