(function(global) {
  'use strict';

  const WarehouseView = {
    $container: null,
    warehouseId: null,
    warehouse: null,
    filter: { producingArea: '', variety: '', grade: '', status: '' },
    filteredIds: null,
    batchMap: null,
    ROW_HEIGHT: 42,

    mount($container, whId) {
      this.$container = $container;
      this.warehouseId = whId;
      this.warehouse = global.Store.getWarehouseById(whId);
      this.render();
    },

    unmount() {
      this.$container = null;
      this.filteredIds = null;
      this.batchMap = null;
    },

    refresh(whId) {
      this.warehouseId = whId;
      this.warehouse = global.Store.getWarehouseById(whId);
      this.render();
    },

    render() {
      const wh = this.warehouse;
      const areas = global.Store.getProducingAreas();
      const varieties = global.Store.getVarieties();
      const grades = global.Store.getGrades();

      const batches = global.Store.getBatchesByWarehouse(wh.id);
      this.batchMap = {};
      batches.forEach(b => {
        const key = `${b.row}-${b.col}`;
        this.batchMap[key] = b;
      });
      this.applyFilter();

      this.$container.html(`
        <h4 class="mb-4"><i class="bi bi-grid-3x3-gap me-2"></i>${wh.name} 垛位布局
          <small class="text-muted fw-normal ms-2">${wh.rows}×${wh.cols} = ${wh.rows*wh.cols}个垛位 · 在库${batches.filter(b=>b.status==='in-stock').length}垛</small>
        </h4>

        <div class="filter-bar mb-4">
          <div class="row g-2 align-items-end">
            <div class="col-md-2">
              <label class="form-label small text-muted mb-1">产区</label>
              <select class="form-select form-select-sm" id="fArea">
                <option value="">全部产区</option>
                ${areas.map(a => `<option value="${a}">${a}</option>`).join('')}
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted mb-1">品种</label>
              <select class="form-select form-select-sm" id="fVariety">
                <option value="">全部品种</option>
                ${varieties.map(v => `<option value="${v}">${v}</option>`).join('')}
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted mb-1">等级</label>
              <select class="form-select form-select-sm" id="fGrade">
                <option value="">全部等级</option>
                ${grades.map(g => `<option value="${g}">${g}</option>`).join('')}
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted mb-1">醇化状态</label>
              <select class="form-select form-select-sm" id="fStatus">
                <option value="">全部状态</option>
                <option value="new">新入</option>
                <option value="aging">醇化中</option>
                <option value="ready">达标</option>
                <option value="overdue">超期</option>
              </select>
            </div>
            <div class="col-md-2">
              <button class="btn btn-sm btn-outline-secondary w-100" id="clearFilter"><i class="bi bi-x-circle me-1"></i>清空筛选</button>
            </div>
            <div class="col-md-2">
              <button class="btn btn-sm btn-outline-primary w-100" id="toggleView"><i class="bi bi-list me-1"></i>切换视图</button>
            </div>
          </div>
        </div>

        <div class="legends">
          <div class="legend-item"><span class="legend-box stack-new"></span>新入</div>
          <div class="legend-item"><span class="legend-box stack-aging"></span>醇化中</div>
          <div class="legend-item"><span class="legend-box stack-ready"></span>达标</div>
          <div class="legend-item"><span class="legend-box stack-overdue"></span>超期</div>
          <div class="legend-item"><span class="legend-box stack-empty"></span>空垛位</div>
          <div class="ms-auto small text-muted"><span id="filterCount">${this.filteredIds ? this.filteredIds.size : 0}</span> 项匹配 · <span id="matchedHint" class="text-warning" style="display:none">黄色高亮为匹配项</span></div>
        </div>

        <div id="viewGrid">
          <div class="mb-2 small text-muted d-flex justify-content-between">
            <span>列 →</span>
            <span id="colLabels"></span>
          </div>
          <div class="virtual-scroll-container" id="scrollContainer">
            <div class="virtual-scroll-phantom" id="phantom"></div>
            <div class="virtual-scroll-content" id="scrollContent"></div>
          </div>
        </div>

        <div id="viewList" style="display:none;">
          <div class="list-group" id="listContainer"></div>
        </div>
      `);

      this.renderColLabels();
      this.initVirtualScroll();
      this.bindEvents();
    },

    renderColLabels() {
      const wh = this.warehouse;
      const labels = [];
      for (let c = 0; c < wh.cols; c++) labels.push(`<span style="display:inline-block;width:${this.getCellWidth()}px;text-align:center;font-size:10px;">${c+1}</span>`);
      $('#colLabels').html(labels.join(''));
    },

    getCellWidth() {
      const containerWidth = $('#scrollContainer').width() || 800;
      const wh = this.warehouse;
      const gap = 4;
      return Math.floor((containerWidth - 20 - (wh.cols - 1) * gap) / wh.cols);
    },

    applyFilter() {
      const f = this.filter;
      const hasFilter = f.producingArea || f.variety || f.grade || f.status;
      if (!hasFilter) { this.filteredIds = null; return; }
      const t0 = performance.now();
      this.filteredIds = new Set();
      Object.values(this.batchMap).forEach(b => {
        if (b.status === 'outbound') return;
        if (f.producingArea && b.producingArea !== f.producingArea) return;
        if (f.variety && b.variety !== f.variety) return;
        if (f.grade && b.grade !== f.grade) return;
        if (f.status) {
          const s = global.BatchModel.computeAgingStatus(b);
          if (s.status !== f.status) return;
        }
        this.filteredIds.add(b.id);
      });
      console.log(`[WarehouseView] 筛选完成，匹配 ${this.filteredIds.size} 项，耗时 ${(performance.now() - t0).toFixed(1)}ms`);
    },

    initVirtualScroll() {
      const wh = this.warehouse;
      const totalHeight = wh.rows * this.ROW_HEIGHT;
      $('#phantom').height(totalHeight);
      this.renderVisibleRows();

      const self = this;
      let scrollTimer = null;
      $('#scrollContainer').off('scroll.wh').on('scroll.wh', function() {
        if (scrollTimer) cancelAnimationFrame(scrollTimer);
        scrollTimer = requestAnimationFrame(() => self.renderVisibleRows());
      });

      $(window).off('resize.wh').on('resize.wh', () => {
        this.renderColLabels();
        this.renderVisibleRows();
      });
    },

    renderVisibleRows() {
      const wh = this.warehouse;
      const container = document.getElementById('scrollContainer');
      if (!container) return;
      const scrollTop = container.scrollTop;
      const viewHeight = container.clientHeight;
      const cellW = this.getCellWidth();
      const gap = 4;

      const startRow = Math.max(0, Math.floor(scrollTop / this.ROW_HEIGHT) - 2);
      const endRow = Math.min(wh.rows, Math.ceil((scrollTop + viewHeight) / this.ROW_HEIGHT) + 2);

      const rowLabelW = 36;
      const htmlParts = [];
      for (let r = startRow; r < endRow; r++) {
        htmlParts.push(`<div style="position:absolute;top:${r*this.ROW_HEIGHT}px;left:0;right:0;height:${this.ROW_HEIGHT}px;display:flex;align-items:center;padding:0 10px;">`);
        htmlParts.push(`<span style="width:${rowLabelW}px;font-size:11px;color:#6c757d;">R${r+1}</span>`);
        htmlParts.push(`<div style="display:grid;grid-template-columns:repeat(${wh.cols},${cellW}px);gap:${gap}px;flex:1;">`);
        for (let c = 0; c < wh.cols; c++) {
          const key = `${r}-${c}`;
          const b = this.batchMap[key];
          if (!b || b.status === 'outbound') {
            htmlParts.push(`<div class="stack-cell stack-empty" style="width:${cellW}px;height:${this.ROW_HEIGHT-8}px;"></div>`);
          } else {
            const s = global.BatchModel.computeAgingStatus(b);
            const highlight = this.filteredIds && this.filteredIds.has(b.id);
            const dim = this.filteredIds && !this.filteredIds.has(b.id);
            const cls = ['stack-cell', s.cssClass, highlight ? 'highlight' : '', dim ? 'dim' : ''].filter(Boolean).join(' ');
            htmlParts.push(`<div class="${cls}" style="width:${cellW}px;height:${this.ROW_HEIGHT-8}px;" data-batch-id="${b.id}" title="${b.id} ${b.producingArea} ${b.variety} ${b.grade}">${b.id.slice(-3)}</div>`);
          }
        }
        htmlParts.push(`</div></div>`);
      }

      $('#scrollContent').html(htmlParts.join(''));
    },

    renderListView() {
      const batches = Object.values(this.batchMap).filter(b => b.status !== 'outbound');
      const filtered = this.filteredIds ? batches.filter(b => this.filteredIds.has(b.id)) : batches;
      const html = filtered.slice(0, 200).map(b => {
        const s = global.BatchModel.computeAgingStatus(b);
        return `<div class="batch-list-item" data-batch-id="${b.id}">
          <div>
            <strong>${b.id}</strong> · ${b.producingArea} · ${b.variety} · ${b.grade} · ${b.entryYear}
            <div class="small text-muted">${this.warehouse.name} R${b.row+1}C${b.col+1} · 入库${b.entryDate} · ${s.elapsedMonths}月</div>
          </div>
          <span class="badge ${s.status==='overdue'?'bg-danger':s.status==='ready'?'bg-primary':s.status==='new'?'bg-success':'bg-warning'}">${s.label}</span>
        </div>`;
      }).join('');
      $('#listContainer').html(html || '<div class="text-center text-muted py-4">暂无匹配数据</div>');
    },

    bindEvents() {
      const self = this;

      $('#fArea, #fVariety, #fGrade, #fStatus').off('change.wh').on('change.wh', function() {
        self.filter[$(this).attr('id').slice(1).toLowerCase()] = $(this).val();
        if ($(this).attr('id') === 'fStatus') self.filter.status = $(this).val();
        if ($(this).attr('id') === 'fGrade') self.filter.grade = $(this).val();
        if ($(this).attr('id') === 'fVariety') self.filter.variety = $(this).val();
        if ($(this).attr('id') === 'fArea') self.filter.producingArea = $(this).val();
        self.applyFilter();
        $('#filterCount').text(self.filteredIds ? self.filteredIds.size : 0);
        $('#matchedHint').toggle(self.filteredIds != null);
        self.renderVisibleRows();
        if (!$('#viewGrid').is(':visible')) self.renderListView();
      });

      $('#clearFilter').off('click.wh').on('click.wh', () => {
        this.filter = { producingArea: '', variety: '', grade: '', status: '' };
        $('#fArea, #fVariety, #fGrade, #fStatus').val('');
        this.applyFilter();
        $('#filterCount').text(0);
        $('#matchedHint').hide();
        this.renderVisibleRows();
        if (!$('#viewGrid').is(':visible')) this.renderListView();
      });

      $('#toggleView').off('click.wh').on('click.wh', () => {
        const showGrid = !$('#viewGrid').is(':visible');
        $('#viewGrid').toggle(showGrid);
        $('#viewList').toggle(!showGrid);
        $('#toggleView').html(showGrid ? '<i class="bi bi-list me-1"></i>切换为列表' : '<i class="bi bi-grid-3x3-gap me-1"></i>切换为网格');
        if (!showGrid) this.renderListView();
        else this.renderVisibleRows();
      });

      this.$container.off('click.wh').on('click.wh', '.stack-cell[data-batch-id], .batch-list-item', function() {
        const bid = $(this).data('batch-id');
        const b = global.Store.getBatchById(bid);
        if (b) self.showBatchDetail(b);
      });
    },

    showBatchDetail(b) {
      const aging = global.BatchModel.computeAgingStatus(b);
      const flip = global.BatchModel.computeFlipDue(b);
      const tastings = global.Store.getTastings({ batchId: b.id });
      const latest = global.Store.getLatestTasting(b.id);
      const inspections = global.Store.getInspections({ warehouseId: b.warehouseId }).slice(0, 10);
      const trend = global.InspectionModel.getTrend(inspections);

      global.App.showModal({
        title: `批次详情 - ${b.id}`,
        body: `
          <div class="row g-3 mb-3">
            <div class="col-md-4"><strong>产区：</strong>${b.producingArea}</div>
            <div class="col-md-4"><strong>品种：</strong>${b.variety}</div>
            <div class="col-md-4"><strong>等级：</strong>${b.grade}</div>
            <div class="col-md-4"><strong>入库年份：</strong>${b.entryYear}</div>
            <div class="col-md-4"><strong>入库日期：</strong>${b.entryDate}</div>
            <div class="col-md-4"><strong>数量：</strong>${b.quantity}件</div>
            <div class="col-md-4"><strong>垛位：</strong>${this.warehouse.name} R${b.row+1}C${b.col+1}</div>
            <div class="col-md-4"><strong>翻垛次数：</strong>${b.flipCount}次</div>
            <div class="col-md-4"><strong>上次翻垛：</strong>${b.lastFlipDate} (${flip.daysSince}天前)</div>
          </div>
          <div class="mb-3">
            <div class="d-flex justify-content-between mb-1">
              <span>醇化进度</span>
              <span class="badge ${aging.status==='overdue'?'bg-danger':'bg-primary'}">${aging.label} · ${aging.elapsedMonths}/${aging.maxMonths}月${aging.overdueMonths>0?` · 超期${aging.overdueMonths}月`:''}</span>
            </div>
            <div class="progress-animated"><div class="progress-bar" style="width:${aging.percent}%"></div></div>
            <div class="small text-muted mt-1">标准周期 ${aging.minMonths}-${aging.maxMonths} 个月</div>
          </div>
          ${flip.due ? `<div class="alert alert-warning small"><i class="bi bi-exclamation-triangle me-1"></i>该批次已超过翻垛间隔${flip.daysOverdue}天，建议尽快翻垛（品种${b.variety}翻垛周期${flip.interval}天）</div>` : ''}
          ${latest ? `
            <div class="mb-3">
              <strong>最新品评：</strong>综合${latest.overall}分 · ${latest.taster} · ${latest.date}
              <div class="small text-muted">香气质${latest.scores.aromaQuality} · 香气量${latest.scores.aromaAmount} · 杂气${latest.scores.impurity} · 余味${latest.scores.aftertaste} · 刺激性${latest.scores.irritation}</div>
            </div>
          ` : '<div class="mb-3 text-muted">暂无品评记录</div>'}
          ${tastings.length ? `<div class="mb-3" style="height:240px;"><canvas id="detailChart"></canvas></div>` : ''}
          ${inspections.length ? `
            <div class="mb-2 small">
              <strong>库房近期温湿度：</strong>平均${trend.avgTemp}℃ / ${trend.avgHumid}%
              <span class="badge ${trend.trend==='rising'?'bg-danger':trend.trend==='falling'?'bg-info':'bg-secondary'} ms-1">
                ${trend.trend==='rising'?'↑升温':trend.trend==='falling'?'↓降温':'→稳定'}
              </span>
            </div>
          ` : ''}
        `,
        footer: `
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
          <button type="button" class="btn btn-outline-primary" id="btnGoTasting"><i class="bi bi-stars me-1"></i>品评记录</button>
          ${flip.due ? `<button type="button" class="btn btn-warning" id="btnGoFlip"><i class="bi bi-arrow-repeat me-1"></i>安排翻垛</button>` : ''}
          ${aging.status === 'ready' ? `<button type="button" class="btn btn-primary" id="btnGoFormula"><i class="bi bi-filter-square me-1"></i>加入配方筛选</button>` : ''}
        `,
        onShown: () => {
          if (tastings.length) {
            global.ChartHelper.line(document.getElementById('detailChart'), global.ChartHelper.buildTastingTrend(tastings));
          }
          $('#btnGoTasting').off('click').on('click', () => { global.App.hideModal(); location.hash = '#/tasting'; });
          $('#btnGoFlip').off('click').on('click', () => { global.App.hideModal(); location.hash = '#/flip-plan'; });
          $('#btnGoFormula').off('click').on('click', () => { global.App.hideModal(); location.hash = '#/formula'; });
        }
      });
    }
  };

  global.WarehouseView = WarehouseView;
})(window);
