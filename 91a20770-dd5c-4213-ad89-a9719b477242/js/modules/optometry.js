/* optometry.js — 验光数据管理：记录列表 + 录入表单 + 历史处方对比 + 配镜建议 */
(function (global) {
  "use strict";

  var Optometry = {
    renderList: function () {
      var sid = Store.currentStoreId();
      var all = Store.query("optometry", function (o) { return o.storeId === sid; });

      var html = '<div class="d-flex justify-content-between align-items-center mb-3"><div><h4 class="fw-serif mb-0">验光记录</h4><div class="text-muted small mt-1">当前门店共 ' + all.length + ' 条验光记录</div></div>' +
        '<button class="btn btn-teal" id="btnNewOpt"><i class="bi bi-plus-lg me-1"></i>新增验光</button></div>';

      html += '<div class="card table-card"><div class="card-body p-3"><div class="filter-bar">' +
        '<div class="search-input flex-grow-1" style="min-width:260px"><i class="bi bi-search"></i><input class="form-control" id="optSearch" placeholder="搜索顾客姓名 / 手机号"></div>' +
        '<select class="form-select" id="optDiagFilter" style="width:150px"><option value="">全部类型</option><option value="近视">近视</option><option value="远视">远视</option><option value="散光">含散光</option></select>' +
        '<input type="date" class="form-control" id="optDateFrom" style="width:160px" title="开始日期">' +
        '<span class="text-muted">至</span>' +
        '<input type="date" class="form-control" id="optDateTo" style="width:160px" title="结束日期">' +
        '<button class="btn btn-outline-teal" id="optReset"><i class="bi bi-arrow-counterclockwise"></i></button>' +
        "</div></div>";

      html += '<div id="optTableWrap"></div></div>';
      $("#appContent").html(html);

      var tableInst = null;
      function buildRows() {
        var kw = $("#optSearch").val().trim().toLowerCase();
        var diag = $("#optDiagFilter").val();
        var dFrom = $("#optDateFrom").val();
        var dTo = $("#optDateTo").val();
        return all.filter(function (o) {
          if (kw) { var c = Store.findById("customers", o.customerId); var phone = c ? c.phone : ""; if ((o.customerName || "").toLowerCase().indexOf(kw) < 0 && (phone || "").indexOf(kw) < 0) return false; }
          if (diag === "近视" && o.diagnosis.indexOf("近视") < 0) return false;
          if (diag === "远视" && o.diagnosis.indexOf("远视") < 0) return false;
          if (diag === "散光" && o.diagnosis.indexOf("散光") < 0) return false;
          if (dFrom && o.date < dFrom) return false;
          if (dTo && o.date > dTo) return false;
          return true;
        });
      }
      function renderTable() {
        var rows = buildRows();
        if (tableInst) tableInst.refresh(rows); else {
          tableInst = UI.dataTable($("#optTableWrap"), {
            columns: [
              { key: "customerName", label: "顾客", sortable: true, render: function (r) { return '<span class="cell-link">' + UI.escape(r.customerName) + "</span>"; } },
              { key: "date", label: "验光日期", sortable: true, render: function (r) { return UI.formatDateOnly(r.date); } },
              { key: "optometristName", label: "验光师", sortable: true },
              { key: "nakedL", label: "裸眼视力", sortable: true, render: function (r) { return "L " + r.nakedL + " / R " + r.nakedR; } },
              { key: "sphereL", label: "球镜", sortable: true, render: function (r) { return "L " + r.sphereL + " / R " + r.sphereR; }, sortValue: function (r) { return r.sphereL; } },
              { key: "cylinderL", label: "柱镜", sortable: true, render: function (r) { return r.cylinderL ? "L " + r.cylinderL + " / R " + r.cylinderR : "—"; }, sortValue: function (r) { return r.cylinderL; } },
              { key: "pd", label: "瞳距", sortable: true, render: function (r) { return r.pd + "mm"; } },
              { key: "diagnosis", label: "诊断", sortable: true, render: function (r) { var t = r.diagnosis.indexOf("散光") >= 0 ? "warn" : r.diagnosis.indexOf("近视") >= 0 ? "info" : "purple"; return UI.badge(r.diagnosis, t); } },
              { key: "createdAt", label: "操作", sortable: false, render: function (r) { return '<button class="btn btn-sm btn-outline-teal btn-view-opt" data-id="' + r.id + '"><i class="bi bi-eye"></i> 详情</button>'; } }
            ],
            rows: rows, pageSize: 12,
            onRowClick: function (r) { Router.go("/optometry/" + r.id); },
            emptyText: "暂无验光记录"
          });
        }
      }
      renderTable();
      $("#optSearch,#optDiagFilter,#optDateFrom,#optDateTo").on("input change", renderTable);
      $("#optReset").on("click", function () { $("#optSearch,#optDiagFilter").val(""); $("#optDateFrom,#optDateTo").val(""); renderTable(); });
      $("#btnNewOpt").on("click", function () { Router.go("/optometry/new"); });
    },

    renderForm: function () {
      var sid = Store.currentStoreId();
      var store = Store.currentStore();
      var optometrists = Store.query("technicians", function (t) { return t.storeId === sid && t.role === "optometrist"; });
      var customers = Store.query("customers", function (c) { return c.storeId === sid; });
      var today = new Date().toISOString().slice(0, 10);

      function field(label, name, type, ph, extra) {
        type = type || "text"; ph = ph || ""; extra = extra || "";
        return '<div class="mb-2"><label class="form-label">' + label + '</label><input type="' + type + '" class="form-control opt-field" data-name="' + name + '" placeholder="' + ph + '" ' + extra + "></div>";
      }

      var html = '<div class="d-flex justify-content-between align-items-center mb-3"><div><h4 class="fw-serif mb-0">新增验光记录</h4><div class="text-muted small mt-1">' + UI.escape(store ? store.name : "") + " · " + today + '</div></div><button class="btn btn-light" id="optBack"><i class="bi bi-arrow-left me-1"></i>返回</button></div>';

      html += '<div class="card mb-3"><div class="card-body">';
      html += UI.sectionTitle("bi-person-vcard", "基础信息");
      html += '<div class="row g-3"><div class="col-md-4"><label class="form-label">顾客</label><select class="form-select opt-field" data-name="customerId"><option value="">选择顾客</option>';
      customers.forEach(function (c) { html += '<option value="' + c.id + '">' + UI.escape(c.name) + " · " + c.phone + "</option>"; });
      html += '</select><div class="small text-muted mt-1">或 <a href="javascript:void(0)" id="newCustToggle">录入新顾客</a></div></div>';
      html += '<div class="col-md-4"><label class="form-label">验光师</label><select class="form-select opt-field" data-name="optometristId">';
      optometrists.forEach(function (t) { html += '<option value="' + t.id + '">' + UI.escape(t.name) + " · " + t.title + "</option>"; });
      html += "</select></div>";
      html += '<div class="col-md-4"><label class="form-label">验光日期</label><input type="date" class="form-control opt-field" data-name="date" value="' + today + '"></div>';
      html += '<div class="col-12" id="newCustFields" style="display:none"><div class="row g-3"><div class="col-md-3"><label class="form-label">新顾客姓名</label><input class="form-control" id="newCustName"></div><div class="col-md-3"><label class="form-label">手机号</label><input class="form-control" id="newCustPhone"></div><div class="col-md-2"><label class="form-label">性别</label><select class="form-select" id="newCustGender"><option value="male">男</option><option value="female">女</option></select></div><div class="col-md-3"><label class="form-label">生日</label><input type="date" class="form-control" id="newCustBirthday"></div></div></div>';
      html += "</div></div>";

      html += '<div class="card mb-3"><div class="card-body">';
      html += UI.sectionTitle("bi-eye", "视力检查");
      html += '<div class="row g-3"><div class="col-md-3">' + field("裸眼视力 左(L)", "nakedL", "number", "0.1-1.5", 'step="0.1"') + "</div>";
      html += '<div class="col-md-3">' + field("裸眼视力 右(R)", "nakedR", "number", "0.1-1.5", 'step="0.1"') + "</div>";
      html += '<div class="col-md-3">' + field("矫正视力 左(L)", "correctedL", "number", "0.8-1.5", 'step="0.1"') + "</div>";
      html += '<div class="col-md-3">' + field("矫正视力 右(R)", "correctedR", "number", "0.8-1.5", 'step="0.1"') + "</div></div></div>";

      html += '<div class="card mb-3"><div class="card-body">';
      html += UI.sectionTitle("bi-rulers", "屈光参数");
      html += '<div class="row g-3"><div class="col-md-2">' + field("球镜 左(SPH-L)", "sphereL", "number", "如 -2.50", 'step="0.25"') + "</div>";
      html += '<div class="col-md-2">' + field("球镜 右(SPH-R)", "sphereR", "number", "如 -2.75", 'step="0.25"') + "</div>";
      html += '<div class="col-md-2">' + field("柱镜 左(CYL-L)", "cylinderL", "number", "如 -0.75", 'step="0.25"') + "</div>";
      html += '<div class="col-md-2">' + field("柱镜 右(CYL-R)", "cylinderR", "number", "如 -0.50", 'step="0.25"') + "</div>";
      html += '<div class="col-md-2">' + field("轴位 左(AXIS-L)", "axisL", "number", "1-180") + "</div>";
      html += '<div class="col-md-2">' + field("轴位 右(AXIS-R)", "axisR", "number", "1-180") + "</div></div>";
      html += '<div class="row g-3 mt-1"><div class="col-md-2">' + field("瞳距(PD)", "pd", "number", "mm") + "</div>";
      html += '<div class="col-md-2">' + field("瞳高(PH)", "ph", "number", "mm") + "</div>";
      html += '<div class="col-md-2">' + field("下加光(ADD)", "add", "number", "老视", 'step="0.25"') + "</div></div>";
      html += '<div class="alert bg-teal-soft border-0 mt-3" id="diagPreview"><i class="bi bi-lightbulb-fill text-teal me-2"></i><span class="fw-semibold">智能诊断：</span><span id="diagText">请录入屈光参数后自动生成诊断与配镜建议</span></div>';
      html += "</div></div>";

      html += '<div class="card mb-3"><div class="card-body">';
      html += UI.sectionTitle("bi-chat-left-text", "备注与建议");
      html += '<div class="mb-2"><label class="form-label">验光建议（可编辑）</label><textarea class="form-control opt-field" data-name="suggestion" rows="2" id="suggestionInput"></textarea></div>';
      html += '<div><label class="form-label">备注</label><textarea class="form-control opt-field" data-name="note" rows="2" placeholder="特殊用眼需求等"></textarea></div>';
      html += "</div></div>";

      html += '<div class="d-flex gap-2 justify-content-end"><button class="btn btn-light" id="optCancel">取消</button><button class="btn btn-teal" id="optSave"><i class="bi bi-check-lg me-1"></i>保存验光记录</button></div>';

      $("#appContent").html(html);

      function updateDiagnosis() {
        var sL = parseFloat($('[data-name="sphereL"]').val()), sR = parseFloat($('[data-name="sphereR"]').val());
        var cL = parseFloat($('[data-name="cylinderL"]').val()), cR = parseFloat($('[data-name="cylinderR"]').val());
        var add = parseFloat($('[data-name="add"]').val());
        if (isNaN(sL) && isNaN(sR)) { $("#diagText").html("请录入屈光参数后自动生成诊断与配镜建议"); return; }
        var sL2 = isNaN(sL) ? 0 : sL, sR2 = isNaN(sR) ? 0 : sR;
        var diag = [];
        if (sL2 < 0 || sR2 < 0) diag.push("近视");
        else if (sL2 > 0 || sR2 > 0) diag.push("远视");
        var hasAstig = (!isNaN(cL) && cL !== 0) || (!isNaN(cR) && cR !== 0);
        if (hasAstig) diag.push("散光");
        if (!isNaN(add) && add > 0) diag.push("老视");
        var maxMyopia = Math.min(sL2, sR2);
        var idx = maxMyopia <= -6 ? "1.67/1.74 高折射率镜片" : maxMyopia <= -4 ? "1.60 中折射率镜片" : "1.56 常规折射率镜片";
        var sug = "诊断为" + (diag.join("+") || "正视") + "。建议配戴" + idx + (hasAstig ? "，需定制散光柱镜" : "") + "，瞳距 " + ($('[data-name="pd"]').val() || "—") + "mm。";
        $("#diagText").html('<span class="badge-status bg-soft-' + (diag.indexOf("近视") >= 0 ? "info" : diag.indexOf("远视") >= 0 ? "purple" : "teal") + '">' + (diag.join("+") || "正视") + '</span> <span class="ms-2">' + UI.escape(sug) + "</span>");
        $("#suggestionInput").val(sug);
      }
      $(".opt-field").on("input", updateDiagnosis);
      $("#newCustToggle").on("click", function () { $("#newCustFields").slideToggle(); });
      $("#optBack,#optCancel").on("click", function () { Router.go("/optometry"); });

      $("#optSave").on("click", function () {
        var data = {};
        $(".opt-field").each(function () { data[$(this).data("name")] = $(this).val(); });
        if (!data.customerId && !$("#newCustName").val()) { UI.toast("请选择或录入顾客信息", "warn"); return; }
        if (isNaN(parseFloat(data.sphereL)) && isNaN(parseFloat(data.sphereR))) { UI.toast("请录入至少一侧球镜度数", "warn"); return; }

        var customerId = data.customerId, customerName = "";
        if (!customerId) {
          var cust = Store.insert("customers", { name: $("#newCustName").val(), phone: $("#newCustPhone").val(), gender: $("#newCustGender").val(), birthday: $("#newCustBirthday").val() || "", storeId: sid, points: 0, level: "normal", joinDate: today });
          customerId = cust.id; customerName = cust.name;
        } else {
          var c = Store.findById("customers", customerId); customerName = c ? c.name : "";
        }
        var opt = Store.findById("technicians", data.optometristId);
        ["nakedL", "nakedR", "correctedL", "correctedR", "sphereL", "sphereR", "cylinderL", "cylinderR", "axisL", "axisR", "pd", "ph", "add"].forEach(function (k) { data[k] = data[k] === "" ? 0 : parseFloat(data[k]) || 0; });
        var sL = data.sphereL, cL = data.cylinderL;
        var diagParts = [];
        if (sL < 0 || data.sphereR < 0) diagParts.push("近视"); else if (sL > 0 || data.sphereR > 0) diagParts.push("远视");
        if (cL !== 0 || data.cylinderR !== 0) diagParts.push("散光");
        if (data.add > 0) diagParts.push("老视");
        var rec = Store.insert("optometry", {
          customerId: customerId, customerName: customerName, storeId: sid,
          optometristId: data.optometristId, optometristName: opt ? opt.name : "",
          date: data.date, nakedL: data.nakedL, nakedR: data.nakedR, correctedL: data.correctedL, correctedR: data.correctedR,
          sphereL: data.sphereL, sphereR: data.sphereR, cylinderL: data.cylinderL, cylinderR: data.cylinderR, axisL: data.axisL, axisR: data.axisR,
          pd: data.pd, ph: data.ph, add: data.add, diagnosis: diagParts.join("+") || "正视", suggestion: data.suggestion, note: data.note || ""
        });
        Store.flushNow("optometry");
        UI.toast("验光记录已保存", "success");
        Router.go("/optometry/" + rec.id);
      });
    },

    renderDetail: function (id) {
      var rec = Store.findById("optometry", id);
      if (!rec) { $("#appContent").html(UI.emptyState("bi-clipboard-x", "记录不存在")); return; }
      var cust = Store.findById("customers", rec.customerId);
      var history = Store.query("optometry", function (o) { return o.customerId === rec.customerId; }).sort(function (a, b) { return b.date < a.date ? -1 : 1; });
      var prev = history[history.indexOf(rec) + 1];

      var html = '<div class="d-flex justify-content-between align-items-center mb-3"><div><h4 class="fw-serif mb-0">验光处方详情</h4><div class="text-muted small mt-1">' + UI.escape(rec.customerName) + " · " + UI.formatDateOnly(rec.date) + '</div></div><button class="btn btn-light" id="optBack"><i class="bi bi-arrow-left me-1"></i>返回列表</button></div>';

      html += '<div class="row g-3"><div class="col-lg-8">';
      html += '<div class="card mb-3"><div class="card-header"><span class="card-title"><i class="bi bi-person-circle text-teal me-2"></i>顾客信息</span></div><div class="card-body"><div class="row g-3">';
      html += '<div class="col-md-4"><div class="text-muted small">姓名</div><div class="fw-bold">' + UI.escape(rec.customerName) + "</div></div>";
      html += '<div class="col-md-4"><div class="text-muted small">手机</div><div>' + UI.escape(cust ? cust.phone : "—") + "</div></div>";
      html += '<div class="col-md-2"><div class="text-muted small">性别</div><div>' + UI.genderText(cust ? cust.gender : "") + "</div></div>";
      html += '<div class="col-md-2"><div class="text-muted small">生日</div><div>' + (cust ? UI.formatDateOnly(cust.birthday) : "—") + "</div></div>";
      html += '<div class="col-md-4"><div class="text-muted small">验光师</div><div>' + UI.escape(rec.optometristName) + "</div></div>";
      html += '<div class="col-md-4"><div class="text-muted small">诊断</div><div>' + UI.badge(rec.diagnosis, rec.diagnosis.indexOf("散光") >= 0 ? "warn" : "info") + "</div></div>";
      html += "</div></div></div>";

      html += '<div class="card mb-3"><div class="card-header"><span class="card-title"><i class="bi bi-eyeglasses text-teal me-2"></i>屈光处方参数</span>';
      if (prev) html += '<button class="btn btn-sm btn-outline-teal" id="btnCompare"><i class="bi bi-arrow-left-right me-1"></i>对比上次处方</button>';
      html += "</div><div class='card-body'><div class='row g-3'>";
      var params = [
        { label: "裸眼视力", l: rec.nakedL, r: rec.nakedR, unit: "" },
        { label: "矫正视力", l: rec.correctedL, r: rec.correctedR, unit: "" },
        { label: "球镜 SPH", l: rec.sphereL, r: rec.sphereR, unit: "D" },
        { label: "柱镜 CYL", l: rec.cylinderL, r: rec.cylinderR, unit: "D" },
        { label: "轴位 AXIS", l: rec.axisL, r: rec.axisR, unit: "°" },
        { label: "瞳距 PD", l: rec.pd, r: "", unit: "mm" },
        { label: "瞳高 PH", l: rec.ph, r: "", unit: "mm" },
        { label: "下加光 ADD", l: rec.add || 0, r: "", unit: "D" }
      ];
      params.forEach(function (p) {
        var pl = String(p.l) + p.unit, pr = p.r !== "" ? String(p.r) + p.unit : "—";
        var diff = "";
        if (prev && p.label === "球镜 SPH" && typeof p.l === "number" && typeof prev.sphereL === "number") { var d = rec.sphereL - prev.sphereL; if (d !== 0) diff = '<span class="badge-status bg-soft-' + (d < 0 ? "danger" : "success") + ' ms-2">' + (d > 0 ? "+" : "") + d + "</span>"; }
        html += '<div class="col-md-3"><div class="text-muted small">' + p.label + '</div><div class="fw-bold">' + pl + diff + "</div><div class='small text-muted'>右眼 " + pr + "</div></div>";
      });
      html += "</div></div></div>";

      html += '<div class="card"><div class="card-header"><span class="card-title"><i class="bi bi-lightbulb text-teal me-2"></i>配镜建议</span></div><div class="card-body"><div class="alert bg-teal-soft border-0 mb-0"><i class="bi bi-info-circle-fill text-teal me-2"></i>' + UI.escape(rec.suggestion) + "</div></div></div>";

      html += '</div><div class="col-lg-4">';
      html += '<div class="card"><div class="card-header"><span class="card-title"><i class="bi bi-clock-history text-teal me-2"></i>历史处方</span></div><div class="card-body"><div class="timeline">';
      history.forEach(function (h, idx) {
        var active = h.id === rec.id;
        html += '<div class="timeline-item"><div class="tl-dot" style="' + (active ? "" : "background:#cbd5e1;box-shadow:0 0 0 1px #e5e7eb;") + '"></div>';
        html += '<div class="d-flex justify-content-between"><span class="fw-bold' + (active ? " text-teal" : "") + '">' + UI.formatDateOnly(h.date) + "</span>" + (active ? UI.badge("当前", "teal") : '<a href="#/optometry/' + h.id + '" class="cell-link small">查看</a>') + "</div>";
        html += '<div class="small text-muted mt-1">SPH L ' + h.sphereL + " / R " + h.sphereR + " · CYL " + (h.cylinderL || "—") + " · PD " + h.pd + "mm</div>";
        html += '<div class="small mt-1">' + UI.badge(h.diagnosis, h.diagnosis.indexOf("散光") >= 0 ? "warn" : "info") + "</div></div>";
      });
      html += "</div></div></div>";
      html += "</div></div>";

      $("#appContent").html(html);
      $("#optBack").on("click", function () { Router.go("/optometry"); });
      $("#btnCompare").on("click", function () { Optometry.showCompare(rec, prev); });
    },

    showCompare: function (cur, prev) {
      var rows = [
        { label: "验光日期", cur: UI.formatDateOnly(cur.date), prev: UI.formatDateOnly(prev.date) },
        { label: "裸眼视力 L", cur: cur.nakedL, prev: prev.nakedL },
        { label: "裸眼视力 R", cur: cur.nakedR, prev: prev.nakedR },
        { label: "球镜 SPH-L", cur: cur.sphereL, prev: prev.sphereL },
        { label: "球镜 SPH-R", cur: cur.sphereR, prev: prev.sphereR },
        { label: "柱镜 CYL-L", cur: cur.cylinderL, prev: prev.cylinderL },
        { label: "柱镜 CYL-R", cur: cur.cylinderR, prev: prev.cylinderR },
        { label: "瞳距 PD", cur: cur.pd, prev: prev.pd }
      ];
      var body = '<table class="data-table"><thead><tr><th>参数</th><th>本次（' + UI.formatDateOnly(cur.date) + "）</th><th>上次（" + UI.formatDateOnly(prev.date) + '）</th><th>变化</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        var diff = "";
        if (typeof r.cur === "number" && typeof r.prev === "number") { var d = r.cur - r.prev; if (d !== 0) diff = '<span class="badge-status bg-soft-' + (Math.abs(d) >= 0.5 ? "danger" : "warn") + '">' + (d > 0 ? "+" : "") + d + "</span>"; else diff = '<span class="text-muted">无变化</span>'; }
        body += "<tr><td>" + r.label + "</td><td class='fw-bold'>" + r.cur + "</td><td>" + r.prev + "</td><td>" + diff + "</td></tr>";
      });
      body += "</tbody></table>";
      UI.modal({ title: "处方对比分析", size: "lg", body: body, footer: '<button class="btn btn-teal" data-bs-dismiss="modal">关闭</button>' });
    }
  };

  global.Optometry = Optometry;
})(window);
