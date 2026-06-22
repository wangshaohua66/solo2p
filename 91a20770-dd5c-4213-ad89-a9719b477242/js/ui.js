/* ui.js — 共享 UI 组件库（表格/徽章/模态框/分页/Toast/工具函数） */
(function (global) {
  "use strict";

  var UI = {};

  /* ===== 工具函数 ===== */
  UI.escape = function (str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  UI.formatDate = function (ts) {
    if (!ts) return "—";
    var d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    var h = String(d.getHours()).padStart(2, "0"), mi = String(d.getMinutes()).padStart(2, "0");
    return y + "-" + m + "-" + day + " " + h + ":" + mi;
  };
  UI.formatDateOnly = function (ts) {
    if (!ts) return "—";
    var d = ts instanceof Date ? ts : (typeof ts === "string" && ts.length <= 10 ? new Date(ts + "T00:00:00") : new Date(ts));
    if (isNaN(d.getTime())) return String(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  UI.fromNow = function (ts) {
    if (!ts) return "";
    var diff = Date.now() - ts;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
    return Math.floor(diff / 86400000) + "天前";
  };
  UI.formatMoney = function (n) {
    if (n === null || n === undefined || isNaN(n)) return "0";
    return "¥" + Number(n).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  };
  UI.formatNumber = function (n) {
    if (n === null || n === undefined || isNaN(n)) return "0";
    return Number(n).toLocaleString("zh-CN");
  };

  /* ===== 徽章 ===== */
  var BADGE_MAP = { teal: "bg-soft-teal", info: "bg-soft-info", warn: "bg-soft-warn", danger: "bg-soft-danger", success: "bg-soft-success", muted: "bg-soft-muted", purple: "bg-soft-purple" };
  UI.badge = function (text, type) {
    type = type || "teal";
    var cls = BADGE_MAP[type] || "bg-soft-teal";
    return '<span class="badge-status ' + cls + '">' + UI.escape(text) + "</span>";
  };

  var ORDER_STATUS = {
    received: { label: "接单", type: "info" }, processing: { label: "镜片加工", type: "warn" },
    adjusting: { label: "镜架调整", type: "purple" }, quality: { label: "质检", type: "teal" },
    delivered: { label: "已交付", type: "success" }
  };
  UI.orderStatusBadge = function (status) {
    var s = ORDER_STATUS[status] || { label: status, type: "muted" };
    return UI.badge(s.label, s.type);
  };
  UI.orderStatusList = function () { return ORDER_STATUS; };

  var TRANSFER_STATUS = { pending: { label: "待确认", type: "warn" }, confirmed: { label: "已确认", type: "info" }, shipped: { label: "已发货", type: "teal" }, received: { label: "已入库", type: "success" }, rejected: { label: "已拒绝", type: "danger" } };
  UI.transferStatusBadge = function (s) { var t = TRANSFER_STATUS[s] || { label: s, type: "muted" }; return UI.badge(t.label, t.type); };
  UI.transferStatusList = function () { return TRANSFER_STATUS; };

  var PROMO_STATUS = { active: { label: "进行中", type: "success" }, expired: { label: "已结束", type: "muted" }, paused: { label: "已暂停", type: "warn" } };
  UI.promoStatusBadge = function (s) { var t = PROMO_STATUS[s] || { label: s, type: "muted" }; return UI.badge(t.label, t.type); };

  var MEMBER_LEVEL = { gold: { label: "黄金会员", type: "warn" }, silver: { label: "银卡会员", type: "muted" }, normal: { label: "普通会员", type: "teal" } };
  UI.memberLevelBadge = function (s) { var t = MEMBER_LEVEL[s] || { label: s, type: "teal" }; return UI.badge(t.label, t.type); };

  UI.genderText = function (g) { return g === "male" ? "男" : g === "female" ? "女" : "—"; };

  /* ===== 空状态 ===== */
  UI.emptyState = function (icon, text, sub) {
    sub = sub || "";
    return '<div class="empty-state"><i class="bi ' + (icon || "bi-inbox") + ' d-block"></i><div class="fw-semibold">' + UI.escape(text) + "</div>" + (sub ? '<div class="small mt-1">' + UI.escape(sub) + "</div>" : "") + "</div>";
  };

  /* ===== Toast ===== */
  UI.toast = function (message, type) {
    type = type || "success";
    var icon = { success: "bi-check-circle-fill text-success", error: "bi-x-circle-fill text-danger", warn: "bi-exclamation-triangle-fill text-warning", info: "bi-info-circle-fill text-info" }[type] || "bi-info-circle-fill text-info";
    var html = '<div class="toast align-items-center border-0 shadow" role="alert">' +
      '<div class="d-flex">' +
      '<div class="toast-body"><i class="bi ' + icon + ' me-2"></i>' + UI.escape(message) + "</div>" +
      '<button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>' +
      "</div></div>";
    var $t = $(html);
    $("#toastRoot").append($t);
    var toast = new bootstrap.Toast($t[0], { delay: 2600 });
    toast.show();
    $t.on("hidden.bs.toast", function () { $t.remove(); });
  };

  /* ===== 模态框 ===== */
  UI.modal = function (opts) {
    opts = opts || {};
    var id = "modal_" + Date.now();
    var sizeClass = opts.size === "lg" ? "modal-lg" : opts.size === "sm" ? "modal-sm" : opts.size === "xl" ? "modal-xl" : "";
    var html = '<div class="modal fade" id="' + id + '" tabindex="-1"><div class="modal-dialog modal-dialog-centered ' + sizeClass + ' modal-dialog-scrollable">' +
      '<div class="modal-content">' +
      '<div class="modal-header"><h5 class="modal-title">' + UI.escape(opts.title || "") + '</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
      '<div class="modal-body">' + (opts.body || "") + "</div>" +
      (opts.footer ? '<div class="modal-footer">' + opts.footer + "</div>" : "") +
      "</div></div></div>";
    var $m = $(html);
    $("#modalRoot").append($m);
    var bsModal = new bootstrap.Modal($m[0], { backdrop: opts.backdrop === false ? false : true });
    if (opts.onShown) $m.on("shown.bs.modal", opts.onShown);
    $m.on("hidden.bs.modal", function () { $m.remove(); if (opts.onHidden) opts.onHidden(); });
    bsModal.show();
    return { $el: $m, modal: bsModal, hide: function () { bsModal.hide(); }, updateBody: function (body) { $m.find(".modal-body").html(body); } };
  };

  UI.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var footer = '<button type="button" class="btn btn-light" data-bs-dismiss="modal">' + UI.escape(opts.cancelText || "取消") + "</button>" +
        '<button type="button" class="btn ' + (opts.danger ? "btn-danger" : "btn-teal") + '" id="' + id + '_ok">' + UI.escape(opts.okText || "确定") + "</button>";
      var id = "cfm_" + Date.now();
      var m = UI.modal({
        title: opts.title || "确认操作",
        body: '<div class="d-flex gap-3 align-items-start"><i class="bi ' + (opts.danger ? "bi-exclamation-triangle-fill text-danger" : "bi-question-circle-fill text-teal") + ' fs-3"></i><div class="pt-1">' + UI.escape(message) + "</div></div>",
        footer: footer
      });
      m.$el.find("#" + id + "_ok").on("click", function () { m.hide(); resolve(true); });
      m.$el.on("hidden.bs.modal", function () { resolve(false); });
    });
  };

  UI.alert = function (message, opts) {
    opts = opts || {};
    var id = "alt_" + Date.now();
    var m = UI.modal({
      title: opts.title || "提示",
      body: '<div class="d-flex gap-3 align-items-start"><i class="bi bi-info-circle-fill text-teal fs-3"></i><div class="pt-1">' + UI.escape(message) + "</div></div>",
      footer: '<button type="button" class="btn btn-teal" data-bs-dismiss="modal">知道了</button>'
    });
    return m;
  };

  /* ===== 分页 ===== */
  UI.pagination = function (total, page, pageSize, onChange) {
    var pages = Math.max(1, Math.ceil(total / pageSize));
    if (page > pages) page = pages;
    if (page < 1) page = 1;
    var $nav = $('<nav class="d-flex justify-content-between align-items-center flex-wrap gap-2">');
    var info = '<span class="text-muted small">共 ' + total + ' 条，第 ' + page + "/" + pages + " 页</span>";
    var $ul = $('<ul class="pagination mb-0"></ul>');
    var addPage = function (p, label, active, disabled) {
      var cls = active ? " active" : "";
      var dis = disabled ? " disabled" : "";
      var $li = $('<li class="page-item' + cls + dis + '"><a class="page-link" href="javascript:void(0)">' + label + "</a></li>");
      if (!disabled && !active) $li.find("a").on("click", function () { onChange(p); });
      $ul.append($li);
    };
    addPage(page - 1, '<i class="bi bi-chevron-left"></i>', false, page <= 1);
    var start = Math.max(1, page - 2), end = Math.min(pages, page + 2);
    if (start > 1) { addPage(1, "1", false, false); if (start > 2) $ul.append('<li class="page-item disabled"><span class="page-link">…</span></li>'); }
    for (var p = start; p <= end; p++) addPage(p, String(p), p === page, false);
    if (end < pages) { if (end < pages - 1) $ul.append('<li class="page-item disabled"><span class="page-link">…</span></li>'); addPage(pages, String(pages), false, false); }
    addPage(page + 1, '<i class="bi bi-chevron-right"></i>', false, page >= pages);
    $nav.append(info, $ul);
    return $nav;
  };

  /* ===== 数据表格（排序+分页+滚动） ===== */
  /*
    config = {
      columns: [{ key, label, sortable, render(row)->html, sortValue(row)->val, width }],
      rows: [],
      pageSize: 15,
      onRowClick: function(row),
      rowClass: function(row)->string,
      emptyText: "暂无数据"
    }
  */
  UI.dataTable = function ($container, config) {
    var state = { sortKey: null, sortDir: "asc", page: 1, pageSize: config.pageSize || 15 };
    var rows = config.rows || [];

    function sortedRows() {
      if (!state.sortKey) return rows.slice();
      var col = config.columns.filter(function (c) { return c.key === state.sortKey; })[0];
      if (!col) return rows.slice();
      var arr = rows.slice();
      arr.sort(function (a, b) {
        var va = col.sortValue ? col.sortValue(a) : a[col.key];
        var vb = col.sortValue ? col.sortValue(b) : b[col.key];
        if (va === vb) return 0;
        if (typeof va === "number" && typeof vb === "number") return state.sortDir === "asc" ? va - vb : vb - va;
        return state.sortDir === "asc" ? String(va).localeCompare(String(vb), "zh") : String(vb).localeCompare(String(va), "zh");
      });
      return arr;
    }

    function render() {
      var sorted = sortedRows();
      var total = sorted.length;
      var pages = Math.max(1, Math.ceil(total / state.pageSize));
      if (state.page > pages) state.page = pages;
      var start = (state.page - 1) * state.pageSize;
      var pageRows = sorted.slice(start, start + state.pageSize);

      var thead = "<tr>";
      config.columns.forEach(function (col) {
        var sortIcon = "";
        if (col.sortable) {
          var active = state.sortKey === col.key;
          var icon = active ? (state.sortDir === "asc" ? "bi-arrow-up" : "bi-arrow-down") : "bi-arrow-down-up";
          sortIcon = '<i class="bi ' + icon + (active ? " sort-active" : "") + '"></i>';
        }
        thead += '<th class="' + (col.sortable ? "" : "no-sort") + '" data-key="' + (col.key || "") + '" ' + (col.width ? 'style="width:' + col.width + '"' : "") + ">" + UI.escape(col.label || "") + sortIcon + "</th>";
      });
      thead += "</tr>";

      var tbody = "";
      if (!pageRows.length) {
        tbody = '<tr><td colspan="' + config.columns.length + '">' + UI.emptyState(config.emptyIcon || "bi-inbox", config.emptyText || "暂无数据") + "</td></tr>";
      } else {
        pageRows.forEach(function (row) {
          var rc = config.rowClass ? config.rowClass(row) : "";
          tbody += '<tr data-id="' + UI.escape(row.id) + '" class="' + rc + '">';
          config.columns.forEach(function (col) {
            var cell = col.render ? col.render(row) : UI.escape(row[col.key] != null ? row[col.key] : "—");
            tbody += "<td>" + cell + "</td>";
          });
          tbody += "</tr>";
        });
      }

      var html = '<div class="table-scroll"><table class="data-table"><thead>' + thead + "</thead><tbody>" + tbody + "</tbody></table></div>";
      var $table = $(html);
      var $pager = UI.pagination(total, state.page, state.pageSize, function (p) { state.page = p; render(); });

      $container.empty().append($table, $('<div class="d-flex justify-content-end"></div>').append($pager));

      $table.find("th[data-key]").each(function () {
        var $th = $(this);
        if ($th.hasClass("no-sort")) return;
        var key = $th.data("key");
        $th.on("click", function () {
          if (state.sortKey === key) { state.sortDir = state.sortDir === "asc" ? "desc" : "asc"; }
          else { state.sortKey = key; state.sortDir = "asc"; }
          state.page = 1;
          render();
        });
      });

      if (config.onRowClick) {
        $table.find("tbody tr[data-id]").on("click", function () {
          var id = $(this).data("id");
          var found = rows.filter(function (r) { return String(r.id) === String(id); })[0];
          if (found) config.onRowClick(found);
        });
      }
    }

    render();
    return {
      refresh: function (newRows) { if (newRows) rows = newRows; render(); },
      setPage: function (p) { state.page = p; render(); },
      getState: function () { return state; }
    };
  };

  /* ===== 段落标题 ===== */
  UI.sectionTitle = function (icon, text) {
    return '<div class="form-section-title"><i class="bi ' + icon + '"></i>' + UI.escape(text) + "</div>";
  };

  UI.storeName = function (storeId) {
    var s = Store.findById("stores", storeId);
    return s ? s.name : "—";
  };

  global.UI = UI;
})(window);
