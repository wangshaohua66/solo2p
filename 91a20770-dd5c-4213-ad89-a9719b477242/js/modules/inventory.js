/* inventory.js — 库存管理：镜架/镜片列表 + 入库出库 + 门店调拨 + 预警 */
(function (global) {
  "use strict";

  var Inventory = {
    currentTab: "frames",
    render: function () {
      Inventory.currentTab = "frames";
      var html = '<div class="d-flex justify-content-between align-items-center mb-3"><div><h4 class="fw-serif mb-0">库存管理</h4><div class="text-muted small mt-1">维护镜架与镜片库存，支持调拨</div></div>' +
        '<div class="d-flex gap-2"><a href="#/inventory/transfer" class="btn btn-outline-teal"><i class="bi bi-arrow-left-right me-1"></i>调拨中心</a>' +
        '<button class="btn btn-teal" id="btnNewItem"><i class="bi bi-plus-lg me-1"></i>新增库存</button></div></div>';

      html += '<ul class="nav nav-tabs mb-3" id="invTabs"><li class="nav-item"><button class="nav-link active" data-tab="frames"><i class="bi bi-glasses me-1"></i>镜架库存</button></li><li class="nav-item"><button class="nav-link" data-tab="lenses"><i class="bi bi-droplet-half me-1"></i>镜片库存</button></li></ul>';
      html += '<div id="invTabContent"></div>';
      $("#appContent").html(html);

      $("#invTabs .nav-link").on("click", function () {
        $("#invTabs .nav-link").removeClass("active");
        $(this).addClass("active");
        Inventory.currentTab = $(this).data("tab");
        Inventory.renderTab();
      });
      $("#btnNewItem").on("click", function () { Inventory.showItemForm(); });
      Inventory.renderTab();
    },

    renderTab: function () {
      var sid = Store.currentStoreId();
      var isFrames = Inventory.currentTab === "frames";
      var col = isFrames ? "inventory_frames" : "inventory_lenses";
      var all = Store.query(col, function (it) { return it.storeId === sid; });

      var html = '<div class="card table-card"><div class="card-body p-3"><div class="filter-bar">' +
        '<div class="search-input flex-grow-1"><i class="bi bi-search"></i><input class="form-control inv-search" placeholder="' + (isFrames ? "搜索品牌 / 型号 / SKU" : "搜索折射率 / 膜层 / 功能") + '"></div>' +
        (isFrames ?
          '<select class="form-select inv-filter" data-k="brand" style="width:130px"><option value="">全部品牌</option></select>' +
          '<select class="form-select inv-filter" data-k="degreeRange" style="width:130px"><option value="">度数范围</option><option value="0-400">0-400</option><option value="0-600">0-600</option><option value="0-800">0-800</option><option value="0-1000">0-1000</option><option value="400-800">400-800</option><option value="600-1200">600-1200</option></select>' :
          '<select class="form-select inv-filter" data-k="refractiveIndex" style="width:130px"><option value="">折射率</option><option value="1.56">1.56</option><option value="1.60">1.60</option value="1.67"><option>1.67</option><option value="1.74">1.74</option></select>' +
          '<select class="form-select inv-filter" data-k="functionType" style="width:150px"><option value="">功能类型</option><option value="单光镜片">单光镜片</option><option value="渐进多焦">渐进多焦</option><option value="防蓝光">防蓝光</option><option value="变色镜片">变色镜片</option><option value="偏光镜片">偏光镜片</option><option value="近视防控">近视防控</option></select>') +
        '<div class="form-check ms-2"><input class="form-check-input" type="checkbox" id="invLowOnly"><label class="form-check-label" for="invLowOnly">仅显示预警</label></div>' +
        "</div></div><div id='invTableWrap'></div></div>";

      $("#invTabContent").html(html);

      if (isFrames) {
        var brands = [];
        all.forEach(function (f) { if (brands.indexOf(f.brand) < 0) brands.push(f.brand); });
        var sel = $("#invTabContent select[data-k=brand]");
        brands.forEach(function (b) { sel.append('<option value="' + UI.escape(b) + '">' + UI.escape(b) + "</option>"); });
      }

      var tableInst = null;
      function buildRows() {
        var kw = $(".inv-search").val().trim().toLowerCase();
        var filters = {};
        $(".inv-filter").each(function () { if ($(this).val()) filters[$(this).data("k")] = $(this).val(); });
        var lowOnly = $("#invLowOnly").is(":checked");
        return all.filter(function (it) {
          if (lowOnly && it.stock > it.minStock) return false;
          for (var k in filters) { if (String(it[k]) !== filters[k]) return false; }
          if (kw) {
            var hay = (isFrames ? it.brand + " " + it.model + " " + it.color + " " + it.sku : it.refractiveIndex + " " + it.coating + " " + it.functionType + " " + it.sku).toLowerCase();
            if (hay.indexOf(kw) < 0) return false;
          }
          return true;
        });
      }
      function renderTable() {
        var rows = buildRows();
        var columns = isFrames ? [
          { key: "sku", label: "SKU", sortable: true, width: "90px" },
          { key: "brand", label: "品牌", sortable: true },
          { key: "model", label: "型号", sortable: true },
          { key: "color", label: "颜色", sortable: true, render: function (r) { return '<span class="badge-status bg-soft-muted">' + UI.escape(r.color) + "</span>"; } },
          { key: "degreeRange", label: "度数范围", sortable: true, render: function (r) { return UI.badge(r.degreeRange, "info"); } },
          { key: "price", label: "单价", sortable: true, sortValue: function (r) { return r.price; }, render: function (r) { return UI.formatMoney(r.price); } },
          { key: "stock", label: "库存", sortable: true, render: function (r) { return Inventory.stockBadge(r); } },
          { key: "actions", label: "操作", sortable: false, render: function (r) { return Inventory.rowActions(r, "frame"); } }
        ] : [
          { key: "sku", label: "SKU", sortable: true, width: "90px" },
          { key: "refractiveIndex", label: "折射率", sortable: true, render: function (r) { return UI.badge(r.refractiveIndex, "teal"); } },
          { key: "coating", label: "膜层", sortable: true },
          { key: "functionType", label: "功能类型", sortable: true, render: function (r) { return UI.badge(r.functionType, "info"); } },
          { key: "price", label: "单价", sortable: true, sortValue: function (r) { return r.price; }, render: function (r) { return UI.formatMoney(r.price); } },
          { key: "stock", label: "库存", sortable: true, render: function (r) { return Inventory.stockBadge(r); } },
          { key: "actions", label: "操作", sortable: false, render: function (r) { return Inventory.rowActions(r, "lens"); } }
        ];
        if (tableInst) tableInst.refresh(rows);
        else tableInst = UI.dataTable($("#invTableWrap"), { columns: columns, rows: rows, pageSize: 12, emptyText: "暂无库存数据" });
      }
      renderTable();
      $(".inv-search,.inv-filter,#invLowOnly").on("input change", renderTable);
    },

    stockBadge: function (r) {
      var low = r.stock <= r.minStock;
      var cls = low ? "bg-soft-danger" : "bg-soft-success";
      var tag = low ? " <span class='badge-status bg-soft-danger ms-1'>预警</span>" : "";
      return '<span class="badge-status ' + cls + '">' + r.stock + '</span> / ' + r.minStock + tag;
    },

    rowActions: function (r, type) {
      var col = type === "frame" ? "inventory_frames" : "inventory_lenses";
      return '<div class="d-flex gap-1">' +
        '<button class="btn btn-sm btn-outline-teal inv-io" data-action="in" data-id="' + r.id + '" data-col="' + col + '"><i class="bi bi-plus-circle"></i> 入库</button>' +
        '<button class="btn btn-sm btn-outline-teal inv-io" data-action="out" data-id="' + r.id + '" data-col="' + col + '"><i class="bi bi-dash-circle"></i> 出库</button>' +
        '<button class="btn btn-sm btn-soft-warn inv-tr" data-id="' + r.id + '" data-col="' + col + '" data-desc="' + UI.escape(type === "frame" ? r.brand + " " + r.model : r.refractiveIndex + " " + r.functionType) + '"><i class="bi bi-arrow-left-right"></i> 调拨</button>' +
        '<button class="btn btn-sm btn-light inv-edit" data-id="' + r.id + '" data-col="' + col + '"><i class="bi bi-pencil"></i></button>' +
        "</div>";
    },

    showItemForm: function (type, id) {
      type = type || Inventory.currentTab;
      var col = type === "frames" ? "inventory_frames" : "inventory_lenses";
      var item = id ? Store.findById(col, id) : null;
      var isFrames = type === "frames";
      var title = item ? "编辑" + (isFrames ? "镜架" : "镜片") : "新增" + (isFrames ? "镜架" : "镜片");

      var body = "";
      if (isFrames) {
        body = '<div class="row g-3">' +
          '<div class="col-md-4"><label class="form-label">品牌</label><input class="form-control f-brand" value="' + UI.escape(item ? item.brand : "") + '"></div>' +
          '<div class="col-md-4"><label class="form-label">型号</label><input class="form-control f-model" value="' + UI.escape(item ? item.model : "") + '"></div>' +
          '<div class="col-md-4"><label class="form-label">颜色</label><input class="form-control f-color" value="' + UI.escape(item ? item.color : "") + '"></div>' +
          '<div class="col-md-4"><label class="form-label">度数范围</label><select class="form-select f-degree"><option value="0-400">0-400</option><option value="0-600">0-600</option><option value="0-800">0-800</option><option value="0-1000">0-1000</option><option value="400-800">400-800</option><option value="600-1200">600-1200</option></select></div>' +
          '<div class="col-md-3"><label class="form-label">单价(¥)</label><input type="number" class="form-control f-price" value="' + (item ? item.price : "") + '"></div>' +
          '<div class="col-md-3"><label class="form-label">库存数量</label><input type="number" class="form-control f-stock" value="' + (item ? item.stock : 0) + '"></div>' +
          '<div class="col-md-2"><label class="form-label">安全库存</label><input type="number" class="form-control f-min" value="' + (item ? item.minStock : 3) + '"></div>' +
          '<div class="col-12"><label class="form-label">SKU</label><input class="form-control f-sku" value="' + UI.escape(item ? item.sku : ("FR-" + Math.floor(1000 + Math.random() * 8999))) + '"></div>' +
          "</div>";
      } else {
        body = '<div class="row g-3">' +
          '<div class="col-md-3"><label class="form-label">折射率</label><select class="form-select l-idx"><option value="1.56">1.56</option><option value="1.60">1.60</option><option value="1.67">1.67</option><option value="1.74">1.74</option></select></div>' +
          '<div class="col-md-4"><label class="form-label">膜层</label><input class="form-control l-coating" value="' + UI.escape(item ? item.coating : "") + '"></div>' +
          '<div class="col-md-5"><label class="form-label">功能类型</label><select class="form-select l-func"><option value="单光镜片">单光镜片</option><option value="渐进多焦">渐进多焦</option><option value="防蓝光">防蓝光</option><option value="变色镜片">变色镜片</option><option value="偏光镜片">偏光镜片</option><option value="近视防控">近视防控</option></select></div>' +
          '<div class="col-md-3"><label class="form-label">单价(¥)</label><input type="number" class="form-control l-price" value="' + (item ? item.price : "") + '"></div>' +
          '<div class="col-md-3"><label class="form-label">库存数量</label><input type="number" class="form-control l-stock" value="' + (item ? item.stock : 0) + '"></div>' +
          '<div class="col-md-2"><label class="form-label">安全库存</label><input type="number" class="form-control l-min" value="' + (item ? item.minStock : 5) + '"></div>' +
          '<div class="col-md-4"><label class="form-label">SKU</label><input class="form-control l-sku" value="' + UI.escape(item ? item.sku : ("LE-" + Math.floor(1000 + Math.random() * 8999))) + '"></div>' +
          "</div>";
      }
      var m = UI.modal({
        title: title, size: "lg", body: body,
        footer: '<button class="btn btn-light" data-bs-dismiss="modal">取消</button><button class="btn btn-teal" id="invSave">保存</button>'
      });
      if (isFrames && item) m.$el.find(".f-degree").val(item.degreeRange);
      if (!isFrames && item) { m.$el.find(".l-idx").val(item.refractiveIndex); m.$el.find(".l-func").val(item.functionType); }
      m.$el.find("#invSave").on("click", function () {
        var sid = Store.currentStoreId();
        var patch;
        if (isFrames) {
          patch = { brand: m.$el.find(".f-brand").val(), model: m.$el.find(".f-model").val(), color: m.$el.find(".f-color").val(), degreeRange: m.$el.find(".f-degree").val(), price: parseFloat(m.$el.find(".f-price").val()) || 0, stock: parseInt(m.$el.find(".f-stock").val()) || 0, minStock: parseInt(m.$el.find(".f-min").val()) || 3, sku: m.$el.find(".f-sku").val() };
          if (!patch.brand || !patch.model) { UI.toast("请填写品牌和型号", "warn"); return; }
        } else {
          patch = { refractiveIndex: m.$el.find(".l-idx").val(), coating: m.$el.find(".l-coating").val(), functionType: m.$el.find(".l-func").val(), price: parseFloat(m.$el.find(".l-price").val()) || 0, stock: parseInt(m.$el.find(".l-stock").val()) || 0, minStock: parseInt(m.$el.find(".l-min").val()) || 5, sku: m.$el.find(".l-sku").val() };
        }
        if (item) Store.update(col, item.id, patch); else { patch.storeId = sid; Store.insert(col, patch); }
        UI.toast("已保存", "success"); m.hide(); Inventory.renderTab(); App.renderQuickPanel();
      });
    },

    stockIO: function (col, id, action) {
      var item = Store.findById(col, id);
      if (!item) return;
      var desc = col === "inventory_frames" ? item.brand + " " + item.model : item.refractiveIndex + " " + item.functionType;
      var body = '<div class="text-muted small mb-2">' + UI.escape(desc) + ' · 当前库存 ' + item.stock + "</div>" +
        '<label class="form-label">数量</label><input type="number" class="form-control" id="ioQty" value="1" min="1">' +
        '<label class="form-label mt-2">备注</label><input class="form-control" id="ioNote" placeholder="如 ' + (action === "in" ? "采购入库" : "订单扣减") + '">';
      var m = UI.modal({
        title: (action === "in" ? "入库" : "出库") + " · " + desc, size: "sm", body: body,
        footer: '<button class="btn btn-light" data-bs-dismiss="modal">取消</button><button class="btn ' + (action === "in" ? "btn-teal" : "btn-danger") + '" id="ioOk">' + (action === "in" ? "确认入库" : "确认出库") + "</button>"
      });
      m.$el.find("#ioOk").on("click", function () {
        var qty = parseInt(m.$el.find("#ioQty").val()) || 0;
        if (qty <= 0) { UI.toast("数量必须大于 0", "warn"); return; }
        var newStock = action === "in" ? item.stock + qty : item.stock - qty;
        if (newStock < 0) { UI.toast("库存不足", "error"); return; }
        Store.update(col, id, { stock: newStock });
        UI.toast((action === "in" ? "入库 " : "出库 ") + qty + " 件，当前库存 " + newStock, "success");
        m.hide(); Inventory.renderTab(); App.renderQuickPanel();
      });
    },

    showTransferForm: function (col, id, desc) {
      var sid = Store.currentStoreId();
      var item = Store.findById(col, id);
      if (!item) return;
      var stores = Store.allStores().filter(function (s) { return s.id !== sid; });
      var body = '<div class="text-muted small mb-2">调拨商品：<span class="fw-semibold text-teal">' + UI.escape(desc) + '</span> · 当前库存 ' + item.stock + "</div>" +
        '<div class="mb-3"><label class="form-label">调往门店</label><select class="form-select" id="trTo">';
      stores.forEach(function (s) { body += '<option value="' + s.id + '">' + UI.escape(s.name) + "</option>"; });
      body += '</select></div>' +
        '<div class="mb-3"><label class="form-label">调拨数量</label><input type="number" class="form-control" id="trQty" value="1" min="1" max="' + item.stock + '"></div>' +
        '<label class="form-label">备注</label><input class="form-control" id="trNote" placeholder="如 紧急调拨 / 客户订货">';
      var m = UI.modal({
        title: "发起调拨申请", size: "sm", body: body,
        footer: '<button class="btn btn-light" data-bs-dismiss="modal">取消</button><button class="btn btn-teal" id="trOk">提交申请</button>'
      });
      m.$el.find("#trOk").on("click", function () {
        var qty = parseInt(m.$el.find("#trQty").val()) || 0;
        if (qty <= 0) { UI.toast("数量必须大于 0", "warn"); return; }
        if (qty > item.stock) { UI.toast("库存不足", "error"); return; }
        Store.insert("transfers", {
          fromStoreId: sid, toStoreId: m.$el.find("#trTo").val(), itemId: id, itemType: col, itemDesc: desc, qty: qty, status: "pending", date: new Date().toISOString().slice(0, 10), note: m.$el.find("#trNote").val()
        });
        UI.toast("调拨申请已提交", "success"); m.hide();
      });
    },

    renderTransfer: function () {
      var sid = Store.currentStoreId();
      var all = Store.get("transfers") || [];
      var myPending = all.filter(function (t) { return t.toStoreId === sid && t.status === "pending"; });
      var myAll = all.filter(function (t) { return t.fromStoreId === sid || t.toStoreId === sid; });

      var html = '<div class="d-flex justify-content-between align-items-center mb-3"><div><h4 class="fw-serif mb-0">调拨中心</h4><div class="text-muted small mt-1">处理门店间库存调拨申请与确认</div></div><a href="#/inventory" class="btn btn-light"><i class="bi bi-arrow-left me-1"></i>返回库存</a></div>';

      if (myPending.length) {
        html += '<div class="card mb-3 border-warning"><div class="card-header border-warning bg-warning bg-opacity-10"><span class="card-title text-warning"><i class="bi bi-hourglass-split me-1"></i>待我确认</span><span class="badge bg-soft-warn ms-2">' + myPending.length + "</span></div><div class='card-body p-0'>";
        html += Inventory.transferListHtml(myPending, true) + "</div></div>";
      }

      html += '<div class="card table-card"><div class="card-body p-3"><div class="filter-bar">' +
        '<div class="search-input flex-grow-1"><i class="bi bi-search"></i><input class="form-control" id="trSearch" placeholder="搜索商品 / 门店"></div>' +
        '<select class="form-select" id="trStatus" style="width:140px"><option value="">全部状态</option><option value="pending">待确认</option><option value="confirmed">已确认</option><option value="shipped">已发货</option><option value="received">已入库</option><option value="rejected">已拒绝</option></select>' +
        "</div></div><div id='trTableWrap'></div></div>";
      $("#appContent").html(html);

      var tableInst = null;
      function buildRows() {
        var kw = $("#trSearch").val().trim().toLowerCase();
        var st = $("#trStatus").val();
        return myAll.filter(function (t) {
          if (st && t.status !== st) return false;
          if (kw) {
            var hay = (t.itemDesc + " " + UI.storeName(t.fromStoreId) + " " + UI.storeName(t.toStoreId)).toLowerCase();
            if (hay.indexOf(kw) < 0) return false;
          }
          return true;
        });
      }
      function renderTable() {
        var rows = buildRows();
        if (tableInst) tableInst.refresh(rows); else {
          tableInst = UI.dataTable($("#trTableWrap"), {
            columns: [
              { key: "date", label: "申请日期", sortable: true, render: function (r) { return UI.formatDateOnly(r.date); } },
              { key: "itemDesc", label: "商品", sortable: true },
              { key: "qty", label: "数量", sortable: true, render: function (r) { return '<span class="badge-status bg-soft-info">' + r.qty + "</span>"; } },
              { key: "fromStoreId", label: "调出", sortable: true, render: function (r) { return UI.storeName(r.fromStoreId); } },
              { key: "toStoreId", label: "调入", sortable: true, render: function (r) { return UI.storeName(r.toStoreId); } },
              { key: "status", label: "状态", sortable: true, render: function (r) { return UI.transferStatusBadge(r.status); } },
              { key: "actions", label: "操作", sortable: false, render: function (r) {
                if (r.toStoreId === sid && r.status === "pending") return '<button class="btn btn-sm btn-teal tr-act" data-act="confirm" data-id="' + r.id + '">确认</button> <button class="btn btn-sm btn-danger tr-act" data-act="reject" data-id="' + r.id + '">拒绝</button>';
                if (r.fromStoreId === sid && r.status === "confirmed") return '<button class="btn btn-sm btn-teal tr-act" data-act="ship" data-id="' + r.id + '">标记发货</button>';
                if (r.toStoreId === sid && r.status === "shipped") return '<button class="btn btn-sm btn-teal tr-act" data-act="receive" data-id="' + r.id + '">确认入库</button>';
                return '<span class="text-muted small">—</span>';
              }}
            ],
            rows: rows, pageSize: 12, emptyText: "暂无调拨记录"
          });
        }
      }
      renderTable();
      $("#trSearch,#trStatus").on("input change", renderTable);
      $(document).off("click.tr");
      $(document).on("click.tr", ".tr-act", function () {
        var act = $(this).data("act");
        var id = $(this).data("id");
        Inventory.handleTransfer(id, act);
      });
      $(document).off("click.tp");
      $(document).on("click.tp", ".tp-act", function () {
        Inventory.handleTransfer($(this).data("id"), $(this).data("act"));
      });

      $(document).off("click.io");
      $(document).on("click.io", ".inv-io", function () {
        Inventory.stockIO($(this).data("col"), $(this).data("id"), $(this).data("action"));
      });
      $(document).off("click.invtr");
      $(document).on("click.invtr", ".inv-tr", function () {
        Inventory.showTransferForm($(this).data("col"), $(this).data("id"), $(this).data("desc"));
      });
      $(document).off("click.invedit");
      $(document).on("click.invedit", ".inv-edit", function () {
        var col = $(this).data("col");
        Inventory.showItemForm(col === "inventory_frames" ? "frames" : "lenses", $(this).data("id"));
      });
    },

    transferListHtml: function (rows, withActions) {
      var html = '<div class="table-scroll"><table class="data-table"><thead><tr><th>商品</th><th>数量</th><th>调出</th><th>申请时间</th><th>状态</th>' + (withActions ? "<th>操作</th>" : "") + "</tr></thead><tbody>";
      rows.forEach(function (t) {
        html += "<tr><td>" + UI.escape(t.itemDesc) + "</td><td>" + t.qty + "</td><td>" + UI.storeName(t.fromStoreId) + "</td><td>" + UI.formatDateOnly(t.date) + "</td><td>" + UI.transferStatusBadge(t.status) + "</td>";
        if (withActions) html += '<td><button class="btn btn-sm btn-teal tp-act" data-act="confirm" data-id="' + t.id + '">确认</button> <button class="btn btn-sm btn-danger tp-act" data-act="reject" data-id="' + t.id + '">拒绝</button></td>';
        html += "</tr>";
      });
      return html + "</tbody></table></div>";
    },

    handleTransfer: function (id, act) {
      var t = Store.findById("transfers", id);
      if (!t) return;
      var nextStatus = { confirm: "confirmed", reject: "rejected", ship: "shipped", receive: "received" }[act];
      if (!nextStatus) return;
      Store.update("transfers", id, { status: nextStatus });
      if (act === "receive") {
        var col = t.itemType;
        var it = Store.findById(col, t.itemId);
        if (it) {
          Store.update(col, it.id, { stock: (it.stock || 0) + t.qty });
        }
      }
      if (act === "confirm") {
        var col2 = t.itemType;
        var it2 = Store.findById(col2, t.itemId);
        if (it2) Store.update(col2, it2.id, { stock: Math.max(0, (it2.stock || 0) - t.qty) });
      }
      UI.toast("操作成功", "success");
      Inventory.renderTransfer();
      App.renderQuickPanel();
    }
  };

  global.Inventory = Inventory;
})(window);
