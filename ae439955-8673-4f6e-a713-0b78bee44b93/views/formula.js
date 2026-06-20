(function(global) {
  'use strict';

  const FormulaView = {
    $container: null,
    warehouseId: null,
    selectedIds: new Set(),
    filteredBatches: [],
    listPageSize: 50,
    listLoadedCount: 0,

    mount($container, whId) {
      this.$container = $container;
      this.warehouseId = whId;
      this.selectedIds = new Set();
      this.listLoadedCount = 0;
      this.render();
    },

    unmount() { this.$container = null; this.selectedIds.clear(); },

    refresh(whId) { this.warehouseId = whId; this.selectedIds.clear(); this.render(); },

    render() {
      const areas = global.Store.getProducingAreas();
      const varieties = global.Store.getVarieties();
      const grades = global.Store.getGrades();
      const wh = global.Store.getWarehouseById(this.warehouseId);
      const warehouses = global.Store.getWarehouses();

      this.$container.html(`
        <h4 class="mb-4"><i class="bi bi-filter-square me-2"></i>配方筛选与出库</h4>

        <div class="card mb-4">
          <div class="card-header"><h6 class="mb-0"><i class="bi bi-funnel me-1"></i>筛选条件</h6></div>
          <div class="card-body">
            <form id="filterForm" class="row g-3">
              <div class="col-md-2">
                <label class="form-label">库房</label>
                <select class="form-select" name="warehouseId">
                  <option value="">全部库房</option>
                  ${warehouses.map(w => `<option value="${w.id}" ${w.id===this.warehouseId?'selected':''}>${w.name}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label">产区</label>
                <select class="form-select" name="producingArea">
                  <option value="">全部产区</option>
                  ${areas.map(a => `<option value="${a}">${a}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label">品种</label>
                <select class="form-select" name="variety">
                  <option value="">全部品种</option>
                  ${varieties.map(v => `<option value="${v}">${v}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label">等级</label>
                <select class="form-select" name="grade">
                  <option value="">全部等级</option>
                  ${grades.map(g => `<option value="${g}">${g}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label">醇化状态</label>
                <select class="form-select" name="agingStatus">
                  <option value="">全部状态</option>
                  <option value="ready" selected>仅达标</option>
                  <option value="aging">醇化中</option>
                  <option value="overdue">超期</option>
                  <option value="new">新入</option>
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label">最低综合评分</label>
                <select class="form-select" name="minOverallScore">
                  <option value="">不限</option>
                  <option value="70">≥70分</option>
                  <option value="75">≥75分</option>
                  <option value="80" selected>≥80分</option>
                  <option value="85">≥85分</option>
                  <option value="90">≥90分</option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label">醇化时长范围（月）</label>
                <div class="d-flex gap-2">
                  <input type="number" class="form-control" name="minAgingMonths" placeholder="最小" min="0" value="24">
                  <input type="number" class="form-control" name="maxAgingMonths" placeholder="最大" min="0" value="36">
                </div>
              </div>
              <div class="col-md-3 d-flex align-items-end gap-2">
                <button type="submit" class="btn btn-primary flex-grow-1"><i class="bi bi-search me-1"></i>筛选</button>
                <button type="reset" class="btn btn-outline-secondary"><i class="bi bi-arrow-counterclockwise"></i></button>
              </div>
              <div class="col-md-6 text-end">
                <span class="text-muted small" id="matchCount">匹配 0 垛</span>
              </div>
            </form>
          </div>
        </div>

        <div class="row g-4">
          <div class="col-lg-8">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-list-check me-1"></i>匹配结果</h6>
                <div>
                  <label class="form-check-label me-2"><input type="checkbox" id="selectAll" class="form-check-input"> 全选</label>
                  <button class="btn btn-sm btn-outline-primary ms-2" id="clearSelection">清除选择</button>
                </div>
              </div>
              <div class="card-body p-0">
                <div class="table-responsive" style="max-height:560px;overflow-y:auto;">
                  <table class="table table-sm table-hover align-middle mb-0">
                    <thead class="sticky-top bg-white">
                      <tr>
                        <th style="width:40px;"></th>
                        <th>批次号</th>
                        <th>库房/垛位</th>
                        <th>产区</th>
                        <th>品种</th>
                        <th>等级</th>
                        <th>入库</th>
                        <th>醇化时长</th>
                        <th>状态</th>
                        <th>评分</th>
                        <th>数量</th>
                      </tr>
                    </thead>
                    <tbody id="resultTable">
                      <tr><td colspan="11" class="text-center text-muted py-5">请设置筛选条件并点击"筛选"</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div class="col-lg-4">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-cart-check me-1"></i>出库清单</h6>
                <span class="badge bg-primary rounded-pill" id="selectedCount">0</span>
              </div>
              <div class="card-body p-0">
                <div id="selectedList" style="max-height:360px;overflow-y:auto;">
                  <div class="text-center text-muted py-4 small">请从左侧勾选批次</div>
                </div>
                <div class="p-3 border-top">
                  <div class="d-flex justify-content-between mb-2">
                    <span class="text-muted">已选垛数：</span><strong id="selBatches">0</strong>
                  </div>
                  <div class="d-flex justify-content-between mb-3">
                    <span class="text-muted">总件数：</span><strong id="selQuantity" class="text-primary">0</strong>
                  </div>
                  <button class="btn btn-primary w-100" id="createOrder" disabled>
                    <i class="bi bi-box-arrow-up me-1"></i>生成出库单
                  </button>
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-header"><h6 class="mb-0"><i class="bi bi-receipt me-1"></i>出库统计</h6></div>
              <div class="card-body p-0">
                <div class="list-group list-group-flush">
                  <div class="list-group-item d-flex justify-content-between"><span>待出库</span><strong class="text-primary" id="pendingOut">0</strong></div>
                  <div class="list-group-item d-flex justify-content-between"><span>已出库</span><strong id="totalOut">${global.Store.getBatches({status:'outbound'}).length}</strong></div>
                  <div class="list-group-item d-flex justify-content-between"><span>历史出库单</span><strong>${global.Store.getOutboundOrders().length}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);

      this.bindEvents();
      this.doFilter();
    },

    bindEvents() {
      const self = this;

      this.$container.off('submit.filter').on('submit.filter', '#filterForm', function(e) {
        e.preventDefault();
        self.doFilter();
      });

      this.$container.off('reset.filter').on('reset.filter', '#filterForm', function() {
        setTimeout(() => self.doFilter(), 10);
      });

      this.$container.off('change.check').on('change.check', '.batch-check', function() {
        const id = $(this).data('batch-id');
        if (this.checked) self.selectedIds.add(id); else self.selectedIds.delete(id);
        self.updateSelected();
      });

      this.$container.off('change.selall').on('change.selall', '#selectAll', function() {
        const checked = this.checked;
        $('.batch-check').prop('checked', checked).each(function() {
          const id = $(this).data('batch-id');
          if (checked) self.selectedIds.add(id); else self.selectedIds.delete(id);
        });
        self.updateSelected();
      });

      this.$container.off('click.clear').on('click.clear', '#clearSelection', () => {
        this.selectedIds.clear();
        $('.batch-check').prop('checked', false);
        $('#selectAll').prop('checked', false);
        this.updateSelected();
      });

      this.$container.off('click.order').on('click.order', '#createOrder', () => this.showConfirmDialog());
    },

    doFilter() {
      const t0 = performance.now();
      const form = $('#filterForm')[0];
      if (!form) return;
      const fd = new FormData(form);
      const filter = {};
      ['warehouseId', 'producingArea', 'variety', 'grade', 'agingStatus'].forEach(k => {
        const v = fd.get(k); if (v) filter[k] = v;
      });
      const minAge = fd.get('minAgingMonths');
      const maxAge = fd.get('maxAgingMonths');
      if (minAge) filter.minAgingMonths = parseInt(minAge);
      if (maxAge) filter.maxAgingMonths = parseInt(maxAge);
      const minScore = fd.get('minOverallScore');
      if (minScore) filter.minOverallScore = parseInt(minScore);
      filter.status = 'in-stock';

      const batches = global.Store.getBatches(filter);
      this.filteredBatches = batches;
      this.listLoadedCount = 0;

      $('#resultTable').empty();
      this.loadMoreResults();

      $('#matchCount').text(`匹配 ${batches.length} 垛`);
      $('#pendingOut').text(this.selectedIds.size);

      console.log(`[FormulaView] 筛选完成，匹配 ${batches.length} 项，耗时 ${(performance.now() - t0).toFixed(1)}ms`);
    },

    loadMoreResults() {
      const batches = this.filteredBatches;
      const start = this.listLoadedCount;
      const end = Math.min(batches.length, start + this.listPageSize);

      if (start >= batches.length) return;

      const slice = batches.slice(start, end);
      const html = slice.map(b => {
        const s = global.BatchModel.computeAgingStatus(b);
        const latest = global.Store.getLatestTasting(b.id);
        const checked = this.selectedIds.has(b.id);
        const wh = global.Store.getWarehouseById(b.warehouseId);
        return `<tr>
          <td><input type="checkbox" class="form-check-input batch-check" data-batch-id="${b.id}" ${checked?'checked':''}></td>
          <td><strong>${b.id}</strong></td>
          <td class="small">${wh?.name || b.warehouseId}<br>R${b.row+1}C${b.col+1}</td>
          <td>${b.producingArea}</td>
          <td>${b.variety}</td>
          <td><span class="badge bg-light text-dark">${b.grade}</span></td>
          <td class="small">${b.entryDate}</td>
          <td class="small">${s.elapsedMonths}月</td>
          <td><span class="badge ${s.status==='overdue'?'bg-danger':s.status==='ready'?'bg-primary':s.status==='new'?'bg-success':'bg-warning'}">${s.label}</span></td>
          <td>${latest?`<strong class="${latest.overall>=80?'text-success':latest.overall>=70?'text-warning':'text-danger'}">${latest.overall}</strong>`:'<span class="text-muted">-</span>'}</td>
          <td>${b.quantity}</td>
        </tr>`;
      }).join('');

      if (start === 0 && !slice.length) {
        $('#resultTable').html(`<tr><td colspan="11" class="text-center text-muted py-5">无匹配结果，请调整筛选条件</td></tr>`);
      } else {
        $('#resultTable').append(html);
      }

      this.listLoadedCount = end;

      const $tableContainer = $('#resultTable').closest('.table-responsive');
      if (this._scrollBound !== true) {
        const self = this;
        $tableContainer.on('scroll.formula', function() {
          const container = this;
          if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
            self.loadMoreResults();
          }
        });
        this._scrollBound = true;
      }

      $('#selectAll').prop('checked', batches.length > 0 && batches.every(b => this.selectedIds.has(b.id)));
    },

    updateSelected() {
      const list = [];
      let totalQty = 0;
      this.selectedIds.forEach(id => {
        const b = global.Store.getBatchById(id);
        if (b) {
          totalQty += b.quantity;
          const s = global.BatchModel.computeAgingStatus(b);
          const latest = global.Store.getLatestTasting(b.id);
          list.push(`<div class="p-2 border-bottom d-flex justify-content-between align-items-center">
            <div>
              <strong class="small">${b.id}</strong>
              <div class="small text-muted">${b.producingArea} ${b.variety} ${b.grade} · ${s.elapsedMonths}月 · ${latest?latest.overall+'分':'无评'}</div>
            </div>
            <div class="text-end">
              <div class="small fw-bold">${b.quantity}件</div>
              <button class="btn btn-sm btn-link text-danger p-0 remove-sel" data-id="${id}">移除</button>
            </div>
          </div>`);
        }
      });

      $('#selectedList').html(list.join('') || '<div class="text-center text-muted py-4 small">请从左侧勾选批次</div>');
      $('#selectedCount').text(this.selectedIds.size);
      $('#selBatches').text(this.selectedIds.size);
      $('#selQuantity').text(totalQty);
      $('#pendingOut').text(this.selectedIds.size);
      $('#createOrder').prop('disabled', this.selectedIds.size === 0);

      const self = this;
      this.$container.off('click.remove').on('click.remove', '.remove-sel', function(e) {
        const id = $(e.currentTarget).data('id');
        self.selectedIds.delete(id);
        $(`.batch-check[data-batch-id="${id}"]`).prop('checked', false);
        self.updateSelected();
      });
    },

    showConfirmDialog() {
      if (this.selectedIds.size === 0) return;
      let totalQty = 0;
      this.selectedIds.forEach(id => {
        const b = global.Store.getBatchById(id);
        if (b) totalQty += b.quantity;
      });

      global.App.showModal({
        title: '确认生成出库单',
        body: `
          <div class="alert alert-info">
            <i class="bi bi-info-circle me-1"></i>即将生成出库单，确认后所选批次将标记为已出库并扣减库存。
          </div>
          <div class="row g-2 mb-3">
            <div class="col-6"><strong>出库垛数：</strong>${this.selectedIds.size} 垛</div>
            <div class="col-6"><strong>总件数：</strong>${totalQty} 件</div>
          </div>
          <div class="mb-3">
            <label class="form-label">配方师</label>
            <select class="form-select" id="outboundOperator">
              <option value="配方师-陈">配方师-陈</option>
              <option value="配方师-李">配方师-李</option>
              <option value="配方师-王">配方师-王</option>
            </select>
          </div>
        `,
        footer: `
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
          <button type="button" class="btn btn-primary" id="confirmOutbound"><i class="bi bi-check-circle me-1"></i>确认出库</button>
        `,
        onShown: () => {
          const self = this;
          $('#confirmOutbound').off('click').on('click', () => {
            const op = $('#outboundOperator').val();
            const ids = Array.from(self.selectedIds);
            const order = global.Store.createOutboundOrder(ids, op);
            global.App.showToast(`出库单 ${order.id} 已生成，共 ${ids.length} 垛`, 'success');
            global.App.hideModal();
            global.App.updateQuickStats();
            self.selectedIds.clear();
            self.doFilter();
            self.updateSelected();
            $('#totalOut').text(global.Store.getBatches({status:'outbound'}).length);
          });
        }
      });
    }
  };

  global.FormulaView = FormulaView;
})(window);
