(function(global) {
  'use strict';

  const SCORE_FIELDS = [
    { key: 'aromaQuality', label: '香气质' },
    { key: 'aromaAmount', label: '香气量' },
    { key: 'impurity', label: '杂气' },
    { key: 'aftertaste', label: '余味' },
    { key: 'irritation', label: '刺激性' }
  ];

  const TastingView = {
    $container: null,
    warehouseId: null,
    selectedBatchId: null,

    mount($container, whId) {
      this.$container = $container;
      this.warehouseId = whId;
      this.render();
    },

    unmount() { this.$container = null; this.selectedBatchId = null; },

    refresh(whId) { this.warehouseId = whId; this.render(); },

    render() {
      const wh = global.Store.getWarehouseById(this.warehouseId);
      const batches = global.Store.getBatchesByWarehouse(this.warehouseId).filter(b => b.status === 'in-stock');
      const tasters = global.Store.getTasters();
      const today = global.Store.formatDate(new Date());

      this.$container.html(`
        <h4 class="mb-4"><i class="bi bi-stars me-2"></i>品评记录
          <small class="text-muted fw-normal ms-2">${wh.name} · 在库${batches.length}垛可品评</small>
        </h4>

        <div class="row g-4">
          <div class="col-lg-4">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-search me-1"></i>选择批次</h6>
              </div>
              <div class="card-body p-0">
                <div class="p-3 border-bottom">
                  <input type="text" id="batchSearch" class="form-control form-control-sm" placeholder="搜索批次号/产区/品种...">
                </div>
                <div id="batchList" style="max-height:560px;overflow-y:auto;"></div>
              </div>
            </div>
          </div>

          <div class="col-lg-8">
            <div class="card" id="detailPanel">
              <div class="card-body text-center text-muted py-5">
                <i class="bi bi-arrow-left-circle display-1 d-block mb-3"></i>
                <p>请从左侧选择要品评的烟叶批次</p>
              </div>
            </div>
          </div>
        </div>
      `);

      this.renderBatchList(batches.slice(0, 50));
      this.bindEvents();
    },

    renderBatchList(list) {
      const html = list.map(b => {
        const s = global.BatchModel.computeAgingStatus(b);
        const latest = global.Store.getLatestTasting(b.id);
        return `<div class="batch-list-item" data-batch-id="${b.id}">
          <div>
            <strong>${b.id}</strong> · ${b.producingArea} · ${b.variety} · ${b.grade}
            <div class="small text-muted">R${b.row+1}C${b.col+1} · ${s.elapsedMonths}月 · 最新评分 ${latest?latest.overall+'分':'未评'}</div>
          </div>
          <span class="badge ${s.status==='overdue'?'bg-danger':s.status==='ready'?'bg-primary':s.status==='new'?'bg-success':'bg-warning'}">${s.label}</span>
        </div>`;
      }).join('');
      $('#batchList').html(html || '<div class="text-center text-muted py-4">暂无数据</div>');
    },

    renderTastingHistory(tastings) {
      var rows = tastings.slice().reverse().slice(0, 8).map(function(t) {
        return '<tr>' +
          '<td>' + t.date + '</td><td>' + t.taster + '</td>' +
          '<td>' + t.scores.aromaQuality + '</td><td>' + t.scores.aromaAmount + '</td>' +
          '<td>' + t.scores.impurity + '</td><td>' + t.scores.aftertaste + '</td>' +
          '<td>' + t.scores.irritation + '</td>' +
          '<td><strong>' + t.overall + '</strong></td>' +
          '</tr>';
      }).join('');
      return '<h6 class="mb-3"><i class="bi bi-graph-up me-1"></i>品评趋势</h6>' +
        '<div style="height:260px;margin-bottom:20px;"><canvas id="trendChart"></canvas></div>' +
        '<h6 class="mb-3"><i class="bi bi-clock-history me-1"></i>历史记录</h6>' +
        '<div class="table-responsive mb-4">' +
        '<table class="table table-sm">' +
        '<thead><tr><th>日期</th><th>品评师</th><th>香气质</th><th>香气量</th><th>杂气</th><th>余味</th><th>刺激性</th><th>综合</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table></div>';
    },

    bindEvents() {
      const self = this;
      let searchTimer;

      this.$container.off('input.search').on('input.search', '#batchSearch', function() {
        const kw = $(this).val().trim();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const all = global.Store.getBatchesByWarehouse(self.warehouseId).filter(b => b.status === 'in-stock');
          const filtered = kw ? all.filter(b =>
            b.id.toLowerCase().includes(kw.toLowerCase()) ||
            b.producingArea.includes(kw) ||
            b.variety.includes(kw)
          ) : all;
          self.renderBatchList(filtered.slice(0, 50));
        }, 200);
      });

      this.$container.off('click.batch').on('click.batch', '.batch-list-item', function() {
        $('.batch-list-item').removeClass('selected');
        $(this).addClass('selected');
        self.selectedBatchId = $(this).data('batch-id');
        self.renderDetail();
      });

      this.$container.off('input.slider').on('input.slider', '.score-slider', function() {
        const key = $(this).data('key');
        const val = parseInt($(this).val());
        $(`#val_${key}`).text(val);
        self.updateOverall();
      });

      this.$container.off('submit.form').on('submit.form', '#tastingForm', function(e) {
        e.preventDefault();
        self.submitTasting();
      });
    },

    updateOverall() {
      let total = 0;
      SCORE_FIELDS.forEach(f => { total += parseInt($(`#slider_${f.key}`).val() || 0); });
      $('#overallScore').text((total / 5).toFixed(1));
    },

    renderDetail() {
      if (!this.selectedBatchId) return;
      const b = global.Store.getBatchById(this.selectedBatchId);
      if (!b) return;

      const aging = global.BatchModel.computeAgingStatus(b);
      const flip = global.BatchModel.computeFlipDue(b);
      const tastings = global.Store.getTastings({ batchId: b.id });
      const latest = global.Store.getLatestTasting(b.id);
      const tasters = global.Store.getTasters();
      const today = global.Store.formatDate(new Date());

      $('#detailPanel').html(`
        <div class="card-header d-flex justify-content-between align-items-center">
          <h6 class="mb-0"><i class="bi bi-file-text me-1"></i>批次品评</h6>
          <div>
            <span class="badge ${aging.status==='overdue'?'bg-danger':aging.status==='ready'?'bg-primary':'bg-warning'}">${aging.label}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="row g-3 mb-4 pb-3 border-bottom">
            <div class="col-md-3"><strong>批次号：</strong>${b.id}</div>
            <div class="col-md-3"><strong>产区：</strong>${b.producingArea}</div>
            <div class="col-md-3"><strong>品种：</strong>${b.variety}</div>
            <div class="col-md-3"><strong>等级：</strong>${b.grade}</div>
            <div class="col-md-3"><strong>入库：</strong>${b.entryDate} (${aging.elapsedMonths}月)</div>
            <div class="col-md-3"><strong>垛位：</strong>R${b.row+1}C${b.col+1}</div>
            <div class="col-md-3"><strong>翻垛：</strong>${b.flipCount}次 (${flip.daysSince}天前)</div>
            <div class="col-md-3"><strong>最新评分：</strong>${latest ? '<strong class="text-primary">' + latest.overall + '分</strong>' : '<span class="text-muted">暂无</span>'}</div>
          </div>

          ${tastings.length ? this.renderTastingHistory(tastings) : '<div class="alert alert-info small">该批次尚未进行过品评记录</div>'}

          <h6 class="mb-3"><i class="bi bi-pencil-square me-1"></i>新增品评</h6>
          <form id="tastingForm">
            <div class="row g-3">
              <div class="col-md-4">
              <label class="form-label">品评日期</label>
              <input type="date" class="form-control" name="date" value="${today}" required>
            </div>
            <div class="col-md-4">
              <label class="form-label">品评师</label>
              <select class="form-select" name="taster" required>
                ${tasters.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label">综合评分</label>
              <div class="form-control-plaintext fs-3 fw-bold text-primary" id="overallScore">${latest?latest.overall.toFixed(1):'75.0'}</div>
            </div>
          </div>
            ${SCORE_FIELDS.map(function(f) {
              var def = latest ? latest.scores[f.key] : 75;
              return '<div class="slider-group">' +
                '<label>' + f.label + '<span class="value-display" id="val_' + f.key + '">' + def + '</span></label>' +
                '<input type="range" class="score-slider" id="slider_' + f.key + '" data-key="' + f.key + '" min="0" max="100" value="' + def + '">' +
                '</div>';
            }).join('')}
            <button type="submit" class="btn btn-primary w-100 mt-2"><i class="bi bi-save me-1"></i>保存品评记录</button>
          </form>
        </div>
      `);

      setTimeout(() => {
        if (tastings.length) {
          global.ChartHelper.line(document.getElementById('trendChart'), global.ChartHelper.buildTastingTrend(tastings));
        }
      }, 50);
    },

    submitTasting() {
      const scores = {};
      SCORE_FIELDS.forEach(f => { scores[f.key] = parseInt(document.getElementById(`slider_${f.key}`).value); });
      const date = $('#tastingForm [name="date"]').val();
      const taster = $('#tastingForm [name="taster"]').val();

      const v = global.Validator.validateTastingScores(scores);
      if (!v.valid) { global.App.showToast(v.errors.join('；'), 'error'); return; }
      if (!date || !taster) { global.App.showToast('请填写日期和品评师', 'error'); return; }

      global.Store.addTasting({
        batchId: this.selectedBatchId,
        date,
        taster,
        scores
      });

      global.App.showToast('品评记录已保存', 'success');
      this.renderDetail();
      this.renderBatchList(global.Store.getBatchesByWarehouse(this.warehouseId).filter(b => b.status === 'in-stock').slice(0, 50));
    }
  };

  global.TastingView = TastingView;
})(window);
