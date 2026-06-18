/* 水情总览页 — 地图、实时数据、水位柱状图、告警、洪水演进模拟 */
App.registerPage('overview', {
  title: '水情总览',
  sub: '辖区水情雨情实时监测 · 超阈值告警 · 洪水演进模拟',
  async render($el, App) {
    const api = App.api;

    const stationsRaw = await api.waterlevel.stations();
    const resRaw = await api.waterlevel.latest();
    const warningsRaw = await api.aggregation.warnings();

    const stations = adaptStations(stationsRaw);
    const res = adaptStations(resRaw.filter(s => s.type === 'reservoir' || s.Type === 'reservoir'));
    const allStations = adaptStations(stationsRaw);
    const rainStations = allStations.filter(s => s.type === 'rain');

    const ov = computeOverview(res, warningsRaw);
    const warnings = adaptWarnings(warningsRaw);

    App.setQuickStats(
      statChip('水库', ov.total, 'info') +
      statChip('超警戒', ov.warning, 'warn') +
      statChip('超保证', ov.danger, 'bad') +
      statChip('面均雨量', ov.avgRain + 'mm', 'info') +
      statChip('总入库', ov.totalInflow + 'm³/s', 'ok')
    );

    $el.html(`
      <div class="row g-3">
        <div class="col-12 col-xl-8">
          <div class="panel">
            <div class="panel-head">
              <span class="panel-title"><i class="bi bi-map"></i>辖区水情态势图</span>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-light active" data-layer="all">全部</button>
                <button class="btn btn-outline-light" data-layer="res">水库</button>
                <button class="btn btn-outline-light" data-layer="rain">雨量站</button>
              </div>
            </div>
            <div class="panel-body p-0">
              <div class="map-stage" id="mapStage">
                ${mapSVG(res, rainStations)}
                <div class="map-legend">
                  <div><span class="dot ok"></span> 水库正常</div>
                  <div><span class="dot warn"></span> 超警戒</div>
                  <div><span class="dot bad"></span> 超保证</div>
                  <div><span style="display:inline-block;width:8px;height:8px;background:var(--gold);transform:rotate(45deg)"></span> 雨量站</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-xl-4">
          <div class="panel mb-3">
            <div class="panel-head"><span class="panel-title"><i class="bi bi-graph-up"></i>各库水位实时柱状图</span></div>
            <div class="panel-body"><div style="height:260px"><canvas id="levelChart"></canvas></div></div>
          </div>
          <div class="panel">
            <div class="panel-head">
              <span class="panel-title"><i class="bi bi-exclamation-octagon"></i>实时告警 <span class="tag bad${warnings.length ? ' pulse' : ''}">${warnings.length}</span></span>
            </div>
            <div class="panel-body p-0"><div class="list-scroll" style="max-height:200px" id="alertList">${alertList(warnings, App)}</div></div>
          </div>
        </div>
      </div>

      <div class="row g-3 mt-1">
        <div class="col-12 col-xl-7">
          <div class="panel">
            <div class="panel-head"><span class="panel-title"><i class="bi bi-water"></i>洪水演进模拟</span><span class="small text-muted">简化水动力学模型 · 计算耗时 &lt;5s</span></div>
            <div class="panel-body">
              <form id="floodForm" class="row g-2 align-items-end">
                <div class="col-6 col-md-3">
                  <label class="form-label">水库</label>
                  <select class="form-select form-select-sm" id="fsRes"></select>
                </div>
                <div class="col-6 col-md-2">
                  <label class="form-label">当前水位(m)</label>
                  <input class="form-control form-control-sm mono" id="fsLevel" readonly>
                </div>
                <div class="col-6 col-md-2">
                  <label class="form-label">入库流量(m³/s)</label>
                  <input class="form-control form-control-sm mono" id="fsInflow" type="number" value="800">
                </div>
                <div class="col-6 col-md-2">
                  <label class="form-label">泄洪流量(m³/s)</label>
                  <input class="form-control form-control-sm mono" id="fsDischarge" type="number" value="600">
                </div>
                <div class="col-12 col-md-3 d-grid">
                  <button class="btn btn-primary btn-sm" type="submit"><i class="bi bi-calculator"></i> 运行模拟</button>
                </div>
              </form>
              <div id="floodResult" class="mt-3"></div>
            </div>
          </div>
        </div>
        <div class="col-12 col-xl-5">
          <div class="panel h-100">
            <div class="panel-head"><span class="panel-title"><i class="bi bi-clock-history"></i>历史水位查询</span></div>
            <div class="panel-body">
              <div class="row g-2 align-items-end mb-2">
                <div class="col-7"><select class="form-select form-select-sm" id="histRes"></select></div>
                <div class="col-5"><select class="form-select form-select-sm" id="histRange">
                  <option value="24">近24小时</option><option value="48">近48小时</option><option value="72">近72小时</option>
                </select></div>
              </div>
              <div style="height:230px"><canvas id="histChart"></canvas></div>
            </div>
          </div>
        </div>
      </div>
    `);

    const resOpts = res.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    $('#fsRes').html(resOpts);
    $('#histRes').html(resOpts);

    drawLevelChart(App, res);
    drawHistChart(App, res[0].id, 24);

    bindMap(App, res, rainStations);

    $('#histRes,#histRange').on('change', function () { drawHistChart(App, $('#histRes').val(), +$('#histRange').val()); });

    fillFloodForm(res);
    $('#fsRes').on('change', function () { fillFloodForm(res); });
    $('#floodForm').on('submit', async function (e) {
      e.preventDefault();
      const rid = $('#fsRes').val(), r = res.find(x => x.id === rid);
      const inflow = +$('#fsInflow').val(), discharge = +$('#fsDischarge').val();
      if (!(inflow >= 0)) { App.toast('入库流量需为非负数', 'warn'); return; }
      if (!(discharge >= 0)) { App.toast('泄洪流量需为非负数', 'warn'); return; }
      const t0 = performance.now();
      try {
        const resultRaw = await api.waterlevel.floodSim({
          reservoirId: rid,
          currentWaterLevel: r.level,
          inflowRate: inflow,
          outflowRate: discharge,
          simulationHours: 12
        });
        const result = adaptFloodResult(resultRaw, r);
        const cost = (performance.now() - t0).toFixed(0);
        renderFloodResult(App, r, result, cost);
        App.toast('洪水演进模拟完成，耗时 ' + cost + 'ms', 'success');
      } catch (err) {
        App.toast(err.message || '模拟失败', 'error');
      }
    });

    $('#alertList').on('click', '.alert-row', function () {
      const rid = $(this).data('id');
      $('#histRes').val(rid); drawHistChart(App, rid, 24);
      $('html,body').animate({ scrollTop: $('#floodForm').offset().top - 80 }, 300);
    });
  }
});

function adaptStations(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(s => {
    const lon = s.location?.x ?? s.longitude ?? s.Longitude ?? 119.5;
    const lat = s.location?.y ?? s.latitude ?? s.Latitude ?? 30.4;
    const xy = lonLatToSvg(lon, lat);
    return {
      id: s.id || s.Id || s._id,
      name: s.name || s.Name || s.stationName,
      type: (s.type || s.Type || '').toLowerCase() || (s.stationType || '').toLowerCase(),
      level: s.currentWaterLevel ?? s.CurrentWaterLevel ?? s.level ?? 0,
      warningLevel: s.warningLevel ?? s.WarningLevel ?? s.warningLevel ?? 0,
      dangerLevel: s.dangerLevel ?? s.DangerLevel ?? s.dangerLevel ?? 0,
      inflow: s.inflow ?? s.Inflow ?? s.inflowRate ?? 0,
      rainfall: s.rainfall ?? s.Rainfall ?? s.cumulativeRainfall ?? 0,
      status: s.status || s.Status || 'normal',
      location: { x: xy.x, y: xy.y, lon, lat },
      updateTime: s.lastUpdate || s.LastUpdate || s.timestamp || Date.now()
    };
  });
}

const SVG_BOUNDS = { minLon: 118.7, maxLon: 120.4, minLat: 29.7, maxLat: 31.1, width: 100, height: 56 };
function lonLatToSvg(lon, lat) {
  const x = ((lon - SVG_BOUNDS.minLon) / (SVG_BOUNDS.maxLon - SVG_BOUNDS.minLon)) * SVG_BOUNDS.width;
  const y = SVG_BOUNDS.height - ((lat - SVG_BOUNDS.minLat) / (SVG_BOUNDS.maxLat - SVG_BOUNDS.minLat)) * SVG_BOUNDS.height;
  return { x: Math.max(3, Math.min(SVG_BOUNDS.width - 3, x)), y: Math.max(3, Math.min(SVG_BOUNDS.height - 3, y)) };
}

function computeOverview(res, warningsRaw) {
  const total = res.length;
  const warning = res.filter(r => r.status === 'warning' || r.status === 'danger').length;
  const danger = res.filter(r => r.status === 'danger').length;
  const avgRain = total > 0 ? (res.reduce((s, r) => s + (r.rainfall || 0), 0) / total).toFixed(1) : 0;
  const totalInflow = res.reduce((s, r) => s + (r.inflow || 0), 0).toFixed(0);
  return { total, warning, danger, avgRain, totalInflow };
}

function adaptWarnings(raw) {
  if (!raw) return [];
  const list = raw.warnings || raw.Warnings || (Array.isArray(raw) ? raw : []);
  if (!Array.isArray(list)) return [];
  return list.map(w => ({
    reservoirId: w.stationId || w.StationId || w.reservoirId,
    name: w.stationName || w.StationName || w.name,
    severity: w.warningLevel || w.WarningLevel || 'warning',
    level: w.currentLevel ?? w.CurrentLevel ?? w.level ?? 0,
    over: (w.currentLevel ?? w.CurrentLevel ?? 0) - (w.threshold ?? w.Threshold ?? 0),
    inflow: w.inflow || 0,
    rainfall: w.rainfall || 0,
    time: w.triggerTime || w.TriggerTime || Date.now()
  }));
}

function adaptFloodResult(raw, r) {
  if (!raw) return { safe: true, startLevel: r.level, endLevel: r.level, peakLevel: r.level, peakSection: '', reservoirLevel: [], sections: [] };
  const timestamps = raw.timestamps || raw.Timestamps || [];
  const sections = raw.sections || raw.Sections || [];
  const reservoirLevel = timestamps.map((t, i) => ({ t: i + 'h', level: r.level }));
  const adaptedSections = sections.map(s => ({
    name: s.sectionName || s.SectionName || '断面',
    series: (s.waterLevels || s.WaterLevels || []).map((lv, i) => ({ t: i + 'h', level: lv }))
  }));
  const peakSection = sections[0] ? (sections[0].sectionName || sections[0].SectionName || '') : '';
  const peakLevel = sections.reduce((m, s) => Math.max(m, s.peakLevel ?? s.PeakLevel ?? 0), 0);
  const endLevel = adaptedSections.length > 0 && adaptedSections[0].series.length > 0
    ? adaptedSections[0].series[adaptedSections[0].series.length - 1].level
    : r.level;
  return {
    safe: peakLevel < r.dangerLevel,
    startLevel: r.level,
    endLevel: +endLevel.toFixed(2),
    peakLevel: +peakLevel.toFixed(2),
    peakSection: peakSection,
    reservoirLevel: reservoirLevel,
    sections: adaptedSections
  };
}

function statChip(label, val, tone) {
  return `<div class="qstat"><span class="dot ${tone}"></span>${label} <b>${val}</b></div>`;
}

function mapSVG(res, stations) {
  const river = '<path d="M 6,44 Q 22,36 34,40 T 58,46 T 82,44 T 96,50" fill="none" stroke="#1a4d6e" stroke-width="6" stroke-linecap="round" opacity="0.7"/>' +
    '<path d="M 6,44 Q 22,36 34,40 T 58,46 T 82,44 T 96,50" fill="none" stroke="#1a9fb5" stroke-width="1.5" stroke-dasharray="3 4" opacity="0.5"/>';
  const resPins = res.map(r => {
    const x = r.location.x, y = r.location.y;
    const cls = r.status === 'danger' ? 'alert' : (r.status === 'warning' ? 'alert' : '');
    const fill = r.status === 'danger' ? '#e63946' : r.status === 'warning' ? '#e9b949' : '#1a9fb5';
    return `<g class="station-pin ${cls}" data-id="${r.id}" data-type="reservoir" data-x="${x}" data-y="${y}">
      <circle class="ring" cx="${x}" cy="${y}" r="11" fill="${fill}" opacity="0.18"/>
      <circle class="core" cx="${x}" cy="${y}" r="5.5" fill="${fill}" stroke="#fff" stroke-width="1.2"/>
      <text x="${x}" y="${y - 8}" fill="#cfe3f0" font-size="3.4" text-anchor="middle" font-weight="700">${r.name}</text>
    </g>`;
  }).join('');
  const rainPins = stations.map(s => {
    const x = s.location.x, y = s.location.y;
    return `<g class="station-pin" data-id="${s.id}" data-type="rain" data-x="${x}" data-y="${y}">
      <rect x="${x - 2.4}" y="${y - 2.4}" width="4.8" height="4.8" fill="#f4a261" transform="rotate(45 ${x} ${y})" opacity="0.85"/>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 100 56" preserveAspectRatio="none">${river}${resPins}${rainPins}</svg>`;
}

function bindMap(App, res, stations) {
  const $stage = $('#mapStage');
  $stage.on('click', '.station-pin', function (e) {
    const id = $(this).data('id'), type = $(this).data('type');
    const x = +$(this).data('x'), y = +$(this).data('y');
    let html;
    if (type === 'reservoir') {
      const r = res.find(s => s.id === id);
      if (!r) return;
      html = `<div class="map-popup" style="left:${x}%;top:${y}%">
        <h6><span class="dot ${r.status === 'danger' ? 'bad' : r.status === 'warning' ? 'warn' : 'ok'}"></span>${r.name} ${App.statusTag(r.status)}</h6>
        <div class="row-x"><span>当前水位</span><b>${r.level} m</b></div>
        <div class="row-x"><span>警戒水位</span><b style="color:#e9b949">${r.warningLevel} m</b></div>
        <div class="row-x"><span>保证水位</span><b style="color:#ff9ba3">${r.dangerLevel} m</b></div>
        <div class="row-x"><span>入库流量</span><b>${r.inflow} m³/s</b></div>
        <div class="row-x"><span>累计降雨</span><b>${r.rainfall} mm</b></div>
        <div class="row-x"><span>更新时间</span><b>${App.fmtTime(r.updateTime)}</b></div>
      </div>`;
    } else {
      const s = stations.find(t => t.id === id);
      if (!s) return;
      html = `<div class="map-popup" style="left:${x}%;top:${y}%">
        <h6><i class="bi bi-cloud-rain-heavy" style="color:var(--gold)"></i>${s.name}</h6>
        <div class="row-x"><span>累计降雨</span><b>${s.value || s.rainfall} mm</b></div>
        <div class="row-x"><span>站类型</span><b>遥测雨量站</b></div>
      </div>`;
    }
    $('.map-popup').remove();
    $stage.append(html);
  });
  $stage.on('click', function (e) { if (e.target.tagName === 'svg' || e.target === this) $('.map-popup').remove(); });
  $('.panel-head .btn-group .btn').on('click', function () {
    $(this).siblings().removeClass('active'); $(this).addClass('active');
    const layer = $(this).data('layer');
    $('.station-pin').show();
    if (layer === 'res') $('.station-pin[data-type="rain"]').hide();
    if (layer === 'rain') $('.station-pin[data-type="reservoir"]').hide();
  });
}

function alertList(warnings, App) {
  if (!warnings.length) return '<div class="empty"><i class="bi bi-shield-check"></i>暂无超阈值告警</div>';
  return warnings.map(w => `
    <div class="order-item alert-row" data-id="${w.reservoirId}">
      <div class="d-flex justify-content-between align-items-center">
        <span class="fw-bold">${w.name}</span>${App.statusTag(w.severity)}
      </div>
      <div class="small text-muted mt-1 mono">水位 ${w.level}m · 超警 ${w.over}m · 入库 ${w.inflow}m³/s · 降雨 ${w.rainfall}mm</div>
    </div>`).join('');
}

function drawLevelChart(App, res) {
  const ctx = document.getElementById('levelChart');
  const colors = res.map(r => r.status === 'danger' ? '#e63946' : r.status === 'warning' ? '#e9b949' : '#1a9fb5');
  App.charts.level = new Chart(ctx, {
    type: 'bar',
    data: { labels: res.map(r => r.name.replace('水库', '')), datasets: [{ data: res.map(r => r.level), backgroundColor: colors, borderRadius: 4, barThickness: 18 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '水位 ' + c.parsed.y + 'm · 警戒 ' + res[c.dataIndex].warningLevel + 'm · 保证 ' + res[c.dataIndex].dangerLevel + 'm' } } },
      scales: {
        x: { ticks: { color: '#9fb4c7', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#6a8197' }, grid: { color: 'rgba(28,59,87,.5)' } }
      }
    }
  });
}

async function drawHistChart(App, rid, hours) {
  try {
    const dataRaw = await App.api.waterlevel.history(rid, new Date(Date.now() - hours * 3600 * 1000).toISOString(), new Date().toISOString());
    const data = adaptHistoryData(dataRaw);
    const ctx = document.getElementById('histChart');
    if (App.charts.hist) App.charts.hist.destroy();
    App.charts.hist = new Chart(ctx, {
      type: 'line',
      data: { labels: data.map(d => App.fmtTime(d.t).slice(6)), datasets: [
        { label: '水位(m)', data: data.map(d => d.level), borderColor: '#1a9fb5', backgroundColor: 'rgba(26,159,181,.15)', fill: true, tension: .35, pointRadius: 0, borderWidth: 2 },
        { label: '降雨(mm)', data: data.map(d => d.rainfall), borderColor: '#f4a261', yAxisID: 'y1', tension: .3, pointRadius: 0, borderDash: [4, 4], borderWidth: 1.5 }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#9fb4c7', font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: '#6a8197', font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: 'rgba(28,59,87,.4)' } },
          y: { ticks: { color: '#6a8197' }, grid: { color: 'rgba(28,59,87,.5)' } },
          y1: { position: 'right', ticks: { color: '#f4a261' }, grid: { display: false } }
        }
      }
    });
  } catch (err) {
    App.toast(err.message || '历史数据加载失败', 'error');
  }
}

function adaptHistoryData(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(r => ({
    t: r.timestamp || r.Timestamp || r.t || Date.now(),
    level: r.waterLevel ?? r.WaterLevel ?? r.level ?? 0,
    rainfall: r.rainfall ?? r.Rainfall ?? 0,
    inflow: r.inflow ?? r.Inflow ?? 0
  })).reverse();
}

function fillFloodForm(res) {
  const r = res.find(x => x.id === $('#fsRes').val()) || res[0];
  if (!r) return;
  $('#fsLevel').val(r.level);
  $('#fsInflow').val(r.inflow);
  $('#fsDischarge').val(Math.round(r.inflow * 0.8));
}

function renderFloodResult(App, r, result, cost) {
  const safe = result.safe ? '<span class="tag ok"><span class="dot ok"></span>下游安全</span>' : '<span class="tag bad"><span class="dot bad"></span>需关注下游</span>';
  $('#floodResult').html(`
    <div class="d-flex flex-wrap gap-2 mb-2">
      <span class="tag info">起调水位 ${result.startLevel}m</span>
      <span class="tag ${result.endLevel > result.startLevel ? 'warn' : 'ok'}">12h后 ${result.endLevel}m</span>
      <span class="tag bad">下游峰值 ${result.peakLevel}m</span>
      <span class="tag warn">${result.peakSection}</span>
      ${safe}
      <span class="tag mute">耗时 ${cost}ms</span>
    </div>
    <div style="height:240px"><canvas id="floodChart"></canvas></div>
  `);
  const labels = result.reservoirLevel.map(p => p.t);
  const ds = [{ label: '水库水位', data: result.reservoirLevel.map(p => p.level), borderColor: '#1a9fb5', fill: true, backgroundColor: 'rgba(26,159,181,.12)', tension: .3, pointRadius: 0, borderWidth: 2 }];
  const palette = ['#f4a261', '#e63946', '#7b6ed6', '#2a9d8f'];
  result.sections.forEach((s, i) => ds.push({ label: s.name, data: s.series.map(p => p.level), borderColor: palette[i], tension: .3, pointRadius: 0, borderWidth: 1.5, borderDash: i === 0 ? [] : [4, 3] }));
  if (App.charts.flood) App.charts.flood.destroy();
  App.charts.flood = new Chart(document.getElementById('floodChart'), {
    type: 'line',
    data: { labels, datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#9fb4c7', font: { size: 10 }, boxWidth: 12 } } },
      scales: {
        x: { title: { display: true, text: '时间(h)', color: '#6a8197' }, ticks: { color: '#6a8197', font: { size: 9 } }, grid: { color: 'rgba(28,59,87,.4)' } },
        y: { title: { display: true, text: '水位(m)', color: '#6a8197' }, ticks: { color: '#6a8197' }, grid: { color: 'rgba(28,59,87,.5)' } }
      }
    }
  });
}
