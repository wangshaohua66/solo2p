(function(global) {
  'use strict';

  const DashboardView = {
    $container: null,

    mount($container) {
      this.$container = $container;
      this.render();
    },

    unmount() {},

    refresh() { this.render(); },

    render() {
      const stats = global.Store.getStatistics();
      const warehouses = global.Store.getWarehouses();
      const alerts = global.Store.getAlerts().slice(0, 10);
      const needingFlip = global.Store.getBatchesNeedingFlip().slice(0, 8);

      this.$container.html(`
        <h4 class="mb-4"><i class="bi bi-speedometer2 me-2"></i>总览看板</h4>

        <div class="row g-3 mb-4">
          <div class="col-6 col-md-3"><div class="kpi-card kpi-new"><div class="kpi-value">${stats.new}</div><div class="kpi-label"><i class="bi bi-box-seam me-1"></i>新入垛位</div></div></div>
          <div class="col-6 col-md-3"><div class="kpi-card kpi-aging"><div class="kpi-value">${stats.aging}</div><div class="kpi-label"><i class="bi bi-hourglass-split me-1"></i>醇化中</div></div></div>
          <div class="col-6 col-md-3"><div class="kpi-card kpi-ready"><div class="kpi-value">${stats.ready}</div><div class="kpi-label"><i class="bi bi-check-circle me-1"></i>醇化达标</div></div></div>
          <div class="col-6 col-md-3"><div class="kpi-card kpi-overdue"><div class="kpi-value">${stats.overdue}</div><div class="kpi-label"><i class="bi bi-exclamation-triangle me-1"></i>超期预警</div></div></div>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-lg-6">
            <div class="card h-100">
              <div class="card-header"><h6 class="mb-0"><i class="bi bi-pie-chart me-1"></i>醇化状态分布</h6></div>
              <div class="card-body"><div style="height:280px;"><canvas id="chart-status"></canvas></div></div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="card h-100">
              <div class="card-header"><h6 class="mb-0"><i class="bi bi-bar-chart me-1"></i>各库库存分布</h6></div>
              <div class="card-body"><div style="height:280px;"><canvas id="chart-warehouse"></canvas></div></div>
            </div>
          </div>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-lg-6">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-arrow-repeat me-1"></i>待翻垛批次 (共${stats.needsFlip}垛)</h6>
                <a href="#/flip-plan" class="btn btn-sm btn-outline-primary">管理翻垛计划</a>
              </div>
              <div class="card-body p-0">
                <div class="list-group list-group-flush">
                  ${needingFlip.length ? needingFlip.map(b => {
                    const aging = global.BatchModel.computeAgingStatus(b);
                    const flip = global.BatchModel.computeFlipDue(b);
                    return `<a href="javascript:;" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center view-batch" data-batch-id="${b.id}">
                      <div>
                        <strong>${b.id}</strong> · ${b.producingArea} · ${b.variety} · ${b.grade}
                        <div class="small text-muted">${global.Store.getWarehouseById(b.warehouseId).name} 第${b.row+1}排${b.col+1}列 · 入库${b.entryDate}</div>
                      </div>
                      <span class="badge bg-danger rounded-pill">超${flip.daysOverdue}天</span>
                    </a>`;
                  }).join('') : '<div class="list-group-item text-muted text-center py-3">暂无待翻垛批次</div>'}
                </div>
              </div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-bell me-1"></i>温湿度预警 (未读${stats.unreadAlerts}条)</h6>
                <button class="btn btn-sm btn-outline-secondary mark-read">全部已读</button>
              </div>
              <div class="card-body p-0">
                <div class="list-group list-group-flush">
                  ${alerts.length ? alerts.map(a => `<div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <span class="badge bg-warning me-2">${a.type}</span>
                      <strong>${global.Store.getWarehouseById(a.warehouseId)?.name || a.warehouseId}</strong>
                      <div class="small text-muted">${a.date}</div>
                    </div>
                    ${!a.read ? '<span class="badge bg-danger rounded-pill">新</span>' : ''}
                  </div>`).join('') : '<div class="list-group-item text-muted text-center py-3">暂无预警</div>'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-lg-12">
            <div class="card">
              <div class="card-header"><h6 class="mb-0"><i class="bi bi-building me-1"></i>库房概览</h6></div>
              <div class="card-body">
                <div class="table-responsive">
                  <table class="table table-sm align-middle">
                    <thead><tr><th>库房</th><th>总垛数</th><th>新入</th><th>醇化中</th><th>达标</th><th>超期</th><th>操作</th></tr></thead>
                    <tbody>
                      ${warehouses.map(wh => {
                        const batches = global.Store.getBatchesByWarehouse(wh.id);
                        let nw=0,ag=0,rd=0,ov=0;
                        batches.forEach(b => {
                          if (b.status==='outbound') return;
                          const s = global.BatchModel.computeAgingStatus(b);
                          if (s.status==='new') nw++; else if (s.status==='aging') ag++; else if (s.status==='ready') rd++; else if (s.status==='overdue') ov++;
                        });
                        return `<tr>
                          <td><strong>${wh.name}</strong><div class="small text-muted">温度${wh.temperatureMin}-${wh.temperatureMax}℃ · 湿度${wh.humidityMin}-${wh.humidityMax}%</div></td>
                          <td>${batches.filter(b=>b.status==='in-stock').length}</td><td><span class="text-success">${nw}</span></td><td><span class="text-warning">${ag}</span></td>
                          <td><span class="text-primary">${rd}</span></td><td><span class="text-danger">${ov}</span></td>
                          <td><button class="btn btn-sm btn-outline-primary view-wh" data-wh-id="${wh.id}">查看垛位</button></td>
                        </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0"><i class="bi bi-thermometer-half me-1"></i>温湿度巡检录入</h6>
          </div>
          <div class="card-body">
            <form id="inspectionForm" class="row g-3">
              <div class="col-md-3">
                <label class="form-label">库房</label>
                <select class="form-select" name="warehouseId" id="inspWh">
                  ${warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label">温度(℃)</label>
                <input type="number" step="0.1" class="form-control" name="temperature" required>
              </div>
              <div class="col-md-2">
                <label class="form-label">湿度(%)</label>
                <input type="number" step="1" class="form-control" name="humidity" required>
              </div>
              <div class="col-md-3">
                <label class="form-label">巡检人员</label>
                <input type="text" class="form-control" name="operator" required placeholder="请输入姓名">
              </div>
              <div class="col-md-2 d-flex align-items-end">
                <button type="submit" class="btn btn-primary w-100"><i class="bi bi-save me-1"></i>提交巡检</button>
              </div>
            </form>
          </div>
        </div>
      `);

      this.bindEvents();
      this.renderCharts();
    },

    bindEvents() {
      const self = this;

      this.$container.off('click.dashboard').on('click.dashboard', '.view-batch', function() {
        const bid = $(this).data('batch-id');
        const b = global.Store.getBatchById(bid);
        if (b) self.showBatchDetail(b);
      });

      this.$container.off('click.dashboard2').on('click.dashboard2', '.view-wh', function() {
        const whId = $(this).data('wh-id');
        global.App.selectWarehouse(whId);
        location.hash = '#/warehouse';
      });

      this.$container.off('click.dashboard3').on('click.dashboard3', '.mark-read', () => {
        global.Store.getAlerts().forEach(a => global.Store.markAlertRead(a.id));
        global.App.updateQuickStats();
        this.render();
      });

      if ($.validator) {
        $('#inspectionForm').validate({
          rules: { temperature: { required: true, temperature: true }, humidity: { required: true, humidity: true }, operator: 'required' },
          submitHandler: (form) => {
            const fd = $(form).serializeArray().reduce((o, x) => { o[x.name] = x.name === 'temperature' || x.name === 'humidity' ? parseFloat(x.value) : x.value; return o; }, {});
            fd.date = global.Store.formatDate(new Date());
            const wh = global.Store.getWarehouseById(fd.warehouseId);
            const result = global.InspectionModel.validate(fd, wh);
            if (!result.valid) {
              global.App.showToast(result.errors.join('；'), 'error', '校验失败');
              return;
            }
            fd.hasAlert = result.hasAlert;
            fd.alertType = result.alertType;
            global.Store.addInspection(fd);
            global.App.updateQuickStats();
            global.App.showToast(result.hasAlert ? `巡检已记录，存在预警：${result.alertType}` : '巡检记录已保存', result.hasAlert ? 'warning' : 'success');
            form.reset();
            this.render();
          }
        });
      }
    },

    renderCharts() {
      const stats = global.Store.getStatistics();
      global.ChartHelper.doughnut(document.getElementById('chart-status'), {
        labels: ['新入', '醇化中', '达标', '超期', '已出库'],
        data: [stats.new, stats.aging, stats.ready, stats.overdue, stats.outbound],
        colors: ['#198754', '#ffc107', '#0d6efd', '#dc3545', '#6c757d']
      });

      const warehouses = global.Store.getWarehouses();
      const labels = warehouses.map(w => w.name);
      const newData = [], agingData = [], readyData = [], overdueData = [];
      warehouses.forEach(wh => {
        let nw = 0, ag = 0, rd = 0, ov = 0;
        global.Store.getBatchesByWarehouse(wh.id).forEach(b => {
          if (b.status === 'outbound') return;
          const s = global.BatchModel.computeAgingStatus(b);
          if (s.status === 'new') nw++; else if (s.status === 'aging') ag++; else if (s.status === 'ready') rd++; else if (s.status === 'overdue') ov++;
        });
        newData.push(nw); agingData.push(ag); readyData.push(rd); overdueData.push(ov);
      });
      global.ChartHelper.bar(document.getElementById('chart-warehouse'), {
        labels,
        datasets: [
          { label: '新入', data: newData, color: '#198754' },
          { label: '醇化中', data: agingData, color: '#ffc107' },
          { label: '达标', data: readyData, color: '#0d6efd' },
          { label: '超期', data: overdueData, color: '#dc3545' }
        ]
      });
    },

    showBatchDetail(b) {
      const aging = global.BatchModel.computeAgingStatus(b);
      const flip = global.BatchModel.computeFlipDue(b);
      const tastings = global.Store.getTastings({ batchId: b.id });
      const latest = global.Store.getLatestTasting(b.id);
      global.App.showModal({
        title: `批次详情 - ${b.id}`,
        body: `
          <div class="row g-3 mb-3">
            <div class="col-md-6"><strong>产区：</strong>${b.producingArea}</div>
            <div class="col-md-6"><strong>品种：</strong>${b.variety}</div>
            <div class="col-md-6"><strong>等级：</strong>${b.grade}</div>
            <div class="col-md-6"><strong>入库年份：</strong>${b.entryYear}</div>
            <div class="col-md-6"><strong>入库日期：</strong>${b.entryDate}</div>
            <div class="col-md-6"><strong>垛位：</strong>${global.Store.getWarehouseById(b.warehouseId).name} 第${b.row+1}排${b.col+1}列</div>
            <div class="col-md-6"><strong>数量：</strong>${b.quantity}件</div>
            <div class="col-md-6"><strong>翻垛次数：</strong>${b.flipCount}次 · 上次翻垛${flip.daysSince}天前</div>
          </div>
          <div class="mb-3">
            <div class="d-flex justify-content-between mb-1"><span>醇化进度</span><span class="badge ${aging.status==='overdue'?'bg-danger':'bg-primary'}">${aging.label} · ${aging.elapsedMonths}/${aging.maxMonths}月</span></div>
            <div class="progress-animated"><div class="progress-bar" style="width:${aging.percent}%"></div></div>
          </div>
          ${latest ? `<div class="mb-3"><strong>最新品评：</strong>综合${latest.overall}分 · ${latest.taster} · ${latest.date}</div>` : '<div class="mb-3 text-muted">暂无品评记录</div>'}
          ${tastings.length ? `<div style="height:220px;"><canvas id="detailChart"></canvas></div>` : ''}
        `,
        onShown: () => {
          if (tastings.length) {
            const cfg = global.ChartHelper.buildTastingTrend(tastings);
            global.ChartHelper.line(document.getElementById('detailChart'), cfg);
          }
        }
      });
    }
  };

  global.DashboardView = DashboardView;
})(window);
