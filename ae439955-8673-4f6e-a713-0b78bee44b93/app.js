(function(global) {
  'use strict';

  const App = {
    currentRoute: null,
    currentView: null,
    currentWarehouseId: 'WH1',

    routes: {
      dashboard: 'DashboardView',
      warehouse: 'WarehouseView',
      'flip-plan': 'FlipPlanView',
      tasting: 'TastingView',
      formula: 'FormulaView'
    },

    init() {
      const t0 = performance.now();
      global.Store.init();
      global.Validator.init();
      this.renderWarehouseList();
      this.updateQuickStats();
      this.bindEvents();

      const hash = location.hash.replace('#/', '') || 'dashboard';
      this.navigate(hash);

      window.addEventListener('hashchange', () => {
        const route = location.hash.replace('#/', '') || 'dashboard';
        this.navigate(route);
      });

      const t1 = performance.now();
      console.log(`[App] 初始化完成，耗时 ${(t1 - t0).toFixed(1)}ms，数据量: ${global.Store.batches.length} 垛`);
    },

    bindEvents() {
      $(document).on('click', '#warehouseList .list-group-item', (e) => {
        const whId = $(e.currentTarget).data('warehouse-id');
        this.selectWarehouse(whId);
      });
    },

    navigate(route) {
      const viewName = this.routes[route];
      if (!viewName) {
        location.hash = '#/dashboard';
        return;
      }

      $('[data-route]').removeClass('active');
      $(`[data-route="${route}"]`).addClass('active');

      if (this.currentView && typeof this.currentView.unmount === 'function') {
        this.currentView.unmount();
      }
      if (global.ChartHelper) global.ChartHelper.destroyAll();

      this.currentRoute = route;
      this.currentView = global[viewName];

      const $container = $('#mainContent');
      $container.empty();

      if (this.currentView && typeof this.currentView.mount === 'function') {
        this.currentView.mount($container, this.currentWarehouseId);
      }
    },

    selectWarehouse(whId) {
      this.currentWarehouseId = whId;
      $('#warehouseList .list-group-item').removeClass('active');
      $(`#warehouseList .list-group-item[data-warehouse-id="${whId}"]`).addClass('active');
      this.updateQuickStats();
      if (this.currentView && typeof this.currentView.refresh === 'function') {
        this.currentView.refresh(whId);
      }
    },

    renderWarehouseList() {
      const list = global.Store.getWarehouses();
      const $list = $('#warehouseList').empty();
      list.forEach(wh => {
        const count = global.Store.getBatchesByWarehouse(wh.id).length;
        const $item = $(`<a href="javascript:;" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" data-warehouse-id="${wh.id}"></a>`)
          .html(`<span><i class="bi bi-building me-1"></i>${wh.name}</span><span class="badge bg-secondary rounded-pill">${count}</span>`);
        if (wh.id === this.currentWarehouseId) $item.addClass('active');
        $list.append($item);
      });
    },

    updateQuickStats() {
      const stats = global.Store.getStatistics();
      const whBatches = global.Store.getBatchesByWarehouse(this.currentWarehouseId);
      let whNew = 0, whAging = 0, whReady = 0, whOverdue = 0;
      whBatches.forEach(b => {
        if (b.status === 'outbound') return;
        const s = global.BatchModel.computeAgingStatus(b);
        if (s.status === 'new') whNew++;
        else if (s.status === 'aging') whAging++;
        else if (s.status === 'ready') whReady++;
        else if (s.status === 'overdue') whOverdue++;
      });

      $('#quickStats').html(`
        <div class="mb-2"><span class="text-muted">在库垛数：</span><strong>${whBatches.filter(b => b.status === 'in-stock').length}</strong></div>
        <div class="mb-1"><span class="legend-box d-inline-block align-middle stack-new" style="width:10px;height:10px;"></span> 新入：${whNew}</div>
        <div class="mb-1"><span class="legend-box d-inline-block align-middle stack-aging" style="width:10px;height:10px;"></span> 醇化中：${whAging}</div>
        <div class="mb-1"><span class="legend-box d-inline-block align-middle stack-ready" style="width:10px;height:10px;"></span> 达标：${whReady}</div>
        <div class="mb-1"><span class="legend-box d-inline-block align-middle stack-overdue" style="width:10px;height:10px;"></span> 超期：${whOverdue}</div>
        <hr>
        <div class="text-danger small">待翻垛：${global.Store.getBatchesNeedingFlip().length}</div>
        <div class="text-warning small">预警：${stats.unreadAlerts}</div>
      `);
    },

    showToast(message, type = 'info', title = '提示') {
      $('#toastTitle').text(title);
      $('#toastBody').text(message);
      $('#toast').removeClass('bg-success bg-danger bg-warning bg-info')
        .addClass(type === 'success' ? 'bg-success text-white' : type === 'error' ? 'bg-danger text-white' : type === 'warning' ? 'bg-warning' : 'bg-info text-white');
      const toast = bootstrap.Toast.getOrCreateInstance(document.getElementById('toast'), { delay: 3000 });
      toast.show();
    },

    showModal(options) {
      $('#detailModalTitle').text(options.title || '详情');
      $('#detailModalBody').html(options.body || '');
      $('#detailModalFooter').html(options.footer || '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>');
      const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('detailModal'));
      modal.show();
      if (typeof options.onShown === 'function') {
        document.getElementById('detailModal').addEventListener('shown.bs.modal', options.onShown, { once: true });
      }
    },

    hideModal() {
      const modal = bootstrap.Modal.getInstance(document.getElementById('detailModal'));
      if (modal) modal.hide();
    }
  };

  global.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})(window);
