/* 统计报表页 — 水位过程线、降雨等值线、闸门操作、缺陷占比、PDF 导出 */
App.registerPage('report', {
  title: '统计报表',
  sub: '水位过程线 · 降雨等值线 · 闸门操作统计 · 缺陷分类占比 · PDF 导出',
  render($el, App) {
    const api = App.api;
    const res = api.waterlevel.latest();
    let range = 'month', rid = res[0].id;

    $el.html(`
      <div class="filter-bar mb-3">
        <select class="form-select form-select-sm" id="rRange" style="width:auto">
          <option value="day">按日</option><option value="month" selected>按月</option><option value="year">按年</option>
        </select>
        <select class="form-select form-select-sm" id="rRes" style="width:auto">${res.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}</select>
        <button class="btn btn-gold btn-sm ms-auto" id="exportPdf"><i class="bi bi-file-earmark-pdf"></i> 导出 PDF 报表</button>
      </div>
      <div id="reportArea">
        <div class="panel mb-3"><div class="panel-head"><span class="panel-title"><i class="bi bi-graph-up"></i>水位过程线</span><span class="small text-muted" id="lineMeta"></span></div>
          <div class="panel-body"><div style="height:280px"><canvas id="lineChart"></canvas></div></div></div>
        <div class="row g-3">
          <div class="col-12 col-xl-6">
            <div class="panel h-100"><div class="panel-head"><span class="panel-title"><i class="bi bi-cloud-rain-heavy"></i>降雨等值线分布</span></div>
              <div class="panel-body"><div id="isoMap" style="height:280px"></div></div></div>
          </div>
          <div class="col-12 col-xl-6">
            <div class="panel h-100"><div class="panel-head"><span class="panel-title"><i class="bi bi-toggles2"></i>闸门操作次数</span></div>
              <div class="panel-body"><div style="height:280px"><canvas id="opsChart"></canvas></div></div></div>
          </div>
        </div>
        <div class="row g-3 mt-1">
          <div class="col-12 col-xl-6">
            <div class="panel h-100"><div class="panel-head"><span class="panel-title"><i class="bi bi-pie-chart"></i>巡检缺陷分类占比</span></div>
              <div class="panel-body"><div style="height:260px"><canvas id="pieChart"></canvas></div></div></div>
          </div>
          <div class="col-12 col-xl-6">
            <div class="panel h-100"><div class="panel-head"><span class="panel-title"><i class="bi bi-list-ul"></i>缺陷部位分布</span></div>
              <div class="panel-body"><div class="table-wrap" id="partTable"></div></div></div>
          </div>
        </div>
      </div>
    `);

    function renderLine() {
      const data = api.report.levelCurve(rid, range);
      const r = res.find(x => x.id === rid);
      $('#lineMeta').text(`${r.name} · ${range === 'day' ? '近24小时' : range === 'month' ? '近30天' : '近一年'} · ${data.length}点`);
      if (App.charts.line) App.charts.line.destroy();
      App.charts.line = new Chart(document.getElementById('lineChart'), {
        type: 'line',
        data: { labels: data.map(d => App.fmtTime(d.t).slice(range === 'year' ? 0 : 5)), datasets: [
          { label: '水位(m)', data: data.map(d => d.level), borderColor: '#1a9fb5', backgroundColor: 'rgba(26,159,181,.15)', fill: true, tension: .35, pointRadius: 0, borderWidth: 2 },
          { label: '警戒水位', data: data.map(() => r.warningLevel), borderColor: '#e9b949', borderDash: [5, 4], pointRadius: 0, borderWidth: 1.2 },
          { label: '保证水位', data: data.map(() => r.dangerLevel), borderColor: '#e63946', borderDash: [5, 4], pointRadius: 0, borderWidth: 1.2 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: '#9fb4c7', font: { size: 10 } } } }, scales: { x: { ticks: { color: '#6a8197', font: { size: 9 }, maxTicksLimit: 10 }, grid: { color: 'rgba(28,59,87,.4)' } }, y: { ticks: { color: '#6a8197' }, grid: { color: 'rgba(28,59,87,.5)' } } } }
      });
    }

    function renderIso() {
      const pts = api.report.rainfallIsohyet();
      const max = Math.max.apply(null, pts.map(p => p.value)), min = Math.min.apply(null, pts.map(p => p.value));
      const color = v => {
        const t = (v - min) / ((max - min) || 1);
        const stops = [[42, 111, 176], [42, 157, 143], [233, 185, 73], [230, 57, 70]];
        const i = Math.min(stops.length - 1, Math.floor(t * (stops.length - 1)));
        const f = t * (stops.length - 1) - i;
        const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
        return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
      };
      const circles = pts.map(p => `<g><circle cx="${p.x}" cy="${p.y}" r="9" fill="${color(p.value)}" opacity="0.25"/><circle cx="${p.x}" cy="${p.y}" r="4" fill="${color(p.value)}"/><text x="${p.x}" y="${p.y - 7}" fill="#cfe3f0" font-size="3" text-anchor="middle" font-weight="700">${p.value}</text></g>`).join('');
      $('#isoMap').html(`<svg viewBox="0 0 100 56" preserveAspectRatio="none" style="width:100%;height:100%;background:radial-gradient(120% 90% at 70% 20%,rgba(26,159,181,.1),transparent 60%),linear-gradient(160deg,#08202f,#0a2740);border-radius:6px">${circles}</svg>
        <div class="map-legend"><span class="small">降雨(mm) ${min} ─</span> ${pts.slice().sort((a, b) => a.value - b.value).map((p, i, arr) => `<span style="display:inline-block;width:14px;height:8px;background:${color(p.value)};margin:0 1px"></span>`).join('')} <span class="small">${max}</span></div>`);
    }

    function renderOps() {
      const s = api.report.dispatchOps();
      if (App.charts.ops) App.charts.ops.destroy();
      App.charts.ops = new Chart(document.getElementById('opsChart'), {
        type: 'bar',
        data: { labels: s.byGate.map(g => g.gate), datasets: [{ label: '操作次数', data: s.byGate.map(g => g.count), backgroundColor: '#2f6fb0', borderRadius: 3 }, { label: '已确认', data: s.byGate.map(g => g.confirmed), backgroundColor: '#2a9d8f', borderRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9fb4c7', font: { size: 10 } } } }, scales: { x: { ticks: { color: '#9fb4c7', font: { size: 9 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: '#6a8197' }, grid: { color: 'rgba(28,59,87,.4)' } } }
      });
    }

    function renderPie() {
      const ds = api.report.defectRatio();
      const colors = { '一般': '#2a9d8f', '较重': '#e9b949', '严重': '#e63946' };
      const SEVS = ['一般', '较重', '严重'];
      if (App.charts.pie) App.charts.pie.destroy();
      App.charts.pie = new Chart(document.getElementById('pieChart'), {
        type: 'pie',
        data: { labels: SEVS, datasets: [{ data: SEVS.map(s => ds.bySev[s] || 0), backgroundColor: SEVS.map(s => colors[s]), borderColor: '#0e2236', borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#9fb4c7', font: { size: 11 } } }, tooltip: { callbacks: { label: c => c.label + ' ' + c.parsed + ' 处 (' + (ds.total ? Math.round(c.parsed / ds.total * 100) : 0) + '%)' } } } }
      });
      $('#partTable').html(`<table class="table table-sm"><thead><tr><th>工程部位</th><th>缺陷数</th><th>占比</th><th></th></tr></thead><tbody>
        ${ds.byPart.map(p => `<tr><td>${p.part}</td><td class="mono">${p.count}</td><td class="mono">${ds.total ? Math.round(p.count / ds.total * 100) : 0}%</td><td><div class="sev-bar"><i style="width:${ds.total ? Math.round(p.count / ds.total * 100) : 0}%;background:var(--teal)"></i></div></td></tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted">暂无数据</td></tr>'}
      </tbody></table>`);
    }

    $('#rRange').on('change', function () { range = $(this).val(); renderLine(); });
    $('#rRes').on('change', function () { rid = $(this).val(); renderLine(); });
    $('#exportPdf').on('click', function () {
      const $btn = $(this); const old = $btn.html();
      $btn.html('<span class="spinner-border spinner-border-sm"></span> 生成中...').prop('disabled', true);
      App.toast('正在生成 PDF 报表，请稍候...', 'info');
      const node = document.getElementById('reportArea');
      const header = document.createElement('div');
      header.style.cssText = 'padding:10px 14px;color:#e3edf6;font-size:14px;border:1px solid #1c3b57;border-radius:8px;margin-bottom:10px;background:#102a41';
      header.innerHTML = `<div style="font-size:18px;font-weight:900">水利综合调度管理平台 · 统计报表</div><div style="color:#9fb4c7;font-size:12px;margin-top:4px">生成时间：${App.fmtFull(Date.now())} · 统计范围：${range === 'day' ? '按日' : range === 'month' ? '按月' : '按年'}</div>`;
      node.insertBefore(header, node.firstChild);
      html2canvas(node, { backgroundColor: '#0a1929', scale: 2, useCORS: true }).then(canvas => {
        node.removeChild(header);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        const iw = pw - 16;
        const ih = iw * canvas.height / canvas.width;
        let heightLeft = ih, position = 8;
        const img = canvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(img, 'JPEG', 8, position, iw, ih);
        heightLeft -= (ph - 16);
        while (heightLeft > 0) {
          position = heightLeft - ih + 8;
          pdf.addPage();
          pdf.addImage(img, 'JPEG', 8, position, iw, ih);
          heightLeft -= (ph - 16);
        }
        pdf.save('水利统计报表_' + App.fmtDate(Date.now()) + '.pdf');
        $btn.html(old).prop('disabled', false);
        App.toast('PDF 报表已导出', 'success');
      }).catch(err => {
        node.removeChild(header);
        $btn.html(old).prop('disabled', false);
        App.toast('导出失败：' + (err.message || ''), 'error');
      });
    });

    renderLine(); renderIso(); renderOps(); renderPie();
  }
});
