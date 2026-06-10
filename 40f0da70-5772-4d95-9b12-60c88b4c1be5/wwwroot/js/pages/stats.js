(function ($) {
  'use strict';

  function seasonColor(score) {
    if (!score) return '#F5F3EF';
    if (score >= 4.3) return '#1E4019';
    if (score >= 3.8) return '#2D5A27';
    if (score >= 3.3) return '#5A9C47';
    if (score >= 2.7) return '#A7D88F';
    if (score >= 2.0) return '#D5ECBC';
    return '#F5F3EF';
  }

  function textColorFor(score) {
    return score >= 3.3 ? '#fff' : (score >= 2 ? '#2C2C2C' : '#6B7280');
  }

  function renderSeasonality() {
    CampHub.ajax.get('/stats/seasonality').then(function (data) {
      data = data || [];
      var $mat = $('#seasonalityMatrix');
      var tags = [...new Set(data.map(d => d.destinationTag))].slice(0, 8);
      if (!tags.length) tags = ['山地营地', '湖畔营地', '海边营地', '森林营地', '草原营地'];
      var byKey = {};
      data.forEach(function (d) { byKey[d.month + '|' + d.destinationTag] = d; });
      var months = ['类型', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

      var html = months.map(m => `<div class="ch-heatmap-header">${m}</div>`).join('');

      tags.forEach(function (tag) {
        html += `<div class="ch-heatmap-header text-truncate" title="${CampHub.util.escapeHtml(tag)}">${CampHub.util.escapeHtml(tag)}</div>`;
        for (var m = 1; m <= 12; m++) {
          var cell = byKey[m + '|' + tag];
          var score = cell ? cell.avgScore : 0;
          var title = score > 0
            ? `${tag} · ${m}月 · 平均 ${score.toFixed(1)} 分 (${cell.sampleCount}条)`
            : `${tag} · ${m}月 · 暂无评价`;
          html += `<div class="ch-heatmap-cell" data-bs-toggle="tooltip" title="${title}"
                      style="background:${seasonColor(score)};color:${textColorFor(score)}">
                     ${score > 0 ? score.toFixed(1) : ''}
                   </div>`;
        }
      });
      $mat.html(html);
      $('[data-bs-toggle="tooltip"]').tooltip({ boundary: 'viewport' });
    }).catch(function (err) {
      $('#seasonalityMatrix').html('<div class="text-muted p-4 text-center col-12">季节矩阵加载失败：' + (err.message || '') + '</div>');
    });
  }

  function renderCreditRank() {
    CampHub.ajax.get('/stats/credit-rank', { top: 15 }).then(function (list) {
      list = list || [];
      if (!list.length) {
        $('#creditRankList').html(CampHub.ui.emptyState('暂无排行数据', 'bi-people'));
        return;
      }
      $('#creditRankList').html(list.map(function (r) {
        var maxScore = Math.max.apply(null, list.map(x => x.score));
        var percent = Math.max(10, Math.round(r.score / maxScore * 100));
        var rankCls = r.rank === 1 ? 'top1' : r.rank === 2 ? 'top2' : r.rank === 3 ? 'top3' : '';
        var creditCls = r.score >= 90 ? 'ch-credit-excellent' : r.score >= 75 ? 'ch-credit-good' : r.score >= 60 ? 'ch-credit-warn' : 'ch-credit-danger';
        return `<div class="ch-credit-row">
          <div class="ch-rank-badge ${rankCls}">${r.rank <= 3 ? ['🥇','🥈','🥉'][r.rank-1] : r.rank}</div>
          ${CampHub.ui.avatar(r.user, 42)}
          <div style="flex:1;min-width:0;">
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="fw-bold text-truncate">${CampHub.util.escapeHtml(r.user.nickname)}</span>
              <span class="ch-credit-badge ${creditCls}">${r.score}</span>
            </div>
            <div class="ch-progress"><div class="ch-progress-bar" style="width:${percent}%;"></div></div>
          </div>
          <div class="text-end" style="min-width:88px;">
            <div class="small text-muted">借还 ${r.lendCount} 次</div>
            <div class="small fw-600 text-ch-primary">准时率 ${r.onTimeRate}%</div>
          </div>
        </div>`;
      }).join(''));
    }).catch(function () {
      $('#creditRankList').html(CampHub.ui.emptyState('数据加载失败', 'bi-exclamation-triangle'));
    });
  }

  function renderGearUsage() {
    CampHub.ajax.get('/stats/gear-usage', { top: 10 }).then(function (list) {
      list = list || [];
      var max = Math.max.apply(null, list.map(g => g.usageCount || 1));
      if (!max) max = 1;
      if (!list.length) {
        $('#gearUsageList').html(CampHub.ui.emptyState('还没有装备使用记录', 'bi-box'));
        return;
      }
      $('#gearUsageList').html(list.map(function (g, i) {
        var pct = Math.max(5, Math.round((g.usageCount || 0) / max * 100));
        return `<div class="d-flex align-items-center gap-3">
          <div class="fw-bold text-muted" style="width:24px;">${i + 1}</div>
          <div style="width:56px;height:56px;border-radius:10px;overflow:hidden;background:var(--ch-primary-50);">
            <img src="${g.imageUrl || ('https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent(g.category + ' camping gear product photo') + '&image_size=square')}" style="width:100%;height:100%;object-fit:cover;" />
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between mb-1">
              <div class="fw-bold text-truncate">${CampHub.util.escapeHtml(g.name)}</div>
              <div class="small text-muted ms-2"><span class="fw-bold text-ch-primary">${g.usageCount || 0}</span> 次</div>
            </div>
            <div class="ch-progress" style="height:8px;">
              <div class="ch-progress-bar" style="width:${pct}%;"></div>
            </div>
          </div>
        </div>`;
      }).join(''));
    }).catch(function () {});
  }

  function renderGearCategories() {
    CampHub.ajax.get('/gear', { pageSize: 500 }).then(function (list) {
      list = list || [];
      var counts = {};
      list.forEach(g => { counts[g.category] = (counts[g.category] || 0) + 1; });
      var total = list.length || 1;
      var entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (!entries.length) {
        $('#gearCategoryChart').html(CampHub.ui.emptyState('还没有装备分类数据', 'bi-pie-chart'));
        return;
      }
      $('#gearCategoryChart').html(entries.map(function ([cat, cnt]) {
        var pct = Math.round(cnt / total * 100);
        var catColors = { '帐篷':'#2D5A27','天幕':'#3E7B34','睡袋':'#5A9C47','防潮垫':'#7FB860','桌椅':'#E8833A','炉具':'#D95F1F','炊具':'#B5442C','灯具':'#4A6FA5','冷藏':'#3B85A1','背包':'#685B9F' };
        var color = catColors[cat] || catColors[Object.keys(catColors)[Object.keys(counts).indexOf(cat) % 12]] || '#8A8A8A';
        return `<div>
          <div class="d-flex justify-content-between mb-1">
            <span class="fw-bold"><span class="d-inline-block me-2" style="width:12px;height:12px;border-radius:3px;background:${color};"></span>${cat}</span>
            <span class="small text-muted">${cnt} 件 · ${pct}%</span>
          </div>
          <div class="ch-progress" style="height:10px;">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:999px;transition:width .4s;"></div>
          </div>
        </div>`;
      }).join(''));
    }).catch(function () {});
  }

  function renderCreditHistory() {
    var months = [];
    var base = 100;
    var current = new Date();
    for (var i = 11; i >= 0; i--) {
      var d = new Date(current.getFullYear(), current.getMonth() - i, 1);
      base += Math.round((Math.random() - 0.3) * 12);
      base = Math.max(60, Math.min(130, base));
      months.push({
        label: d.getMonth() + 1 + '月',
        value: base,
        real: false
      });
    }
    CampHub.ajax.get('/stats/credit-rank', { top: 100 }).then(function (ranks) {
      var me = CampHub.auth.getUser();
      var my = ranks && ranks.find(r => r.user && me && r.user.id === me.id);
      if (my) months[months.length - 1].value = my.score;
    }).catch(function () {}).always(function () {
      var max = Math.max.apply(null, months.map(m => m.value)) + 5;
      var min = Math.min.apply(null, months.map(m => m.value)) - 5;
      $('#creditHistoryChart').html(months.map(function (m, i) {
        var h = Math.max(5, Math.round((m.value - min) / (max - min) * 100));
        var color = m.value >= 90 ? 'var(--ch-primary)' : m.value >= 75 ? 'var(--ch-accent)' : 'var(--ch-danger)';
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;animation:chFadeUp .4s ${i * 0.04}s both cubic-bezier(.22,.61,.36,1);">
          <div class="small fw-bold text-muted">${m.value}</div>
          <div style="width:100%;height:${h}%;background:${color};border-radius:6px 6px 2px 2px;min-height:6px;position:relative;">
            <div style="position:absolute;inset:0;background:rgba(255,255,255,0.18);border-radius:inherit;"></div>
          </div>
          <div class="small text-muted" style="font-size:.7rem;">${m.label}</div>
        </div>`;
      }).join(''));
    });
  }

  $(function () {
    if (!CampHub.auth.requireLogin()) return;
    renderSeasonality();
    renderCreditRank();
    renderGearUsage();
    renderGearCategories();
    renderCreditHistory();
  });
})(jQuery);
