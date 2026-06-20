(function(global) {
  'use strict';

  const FlipPlanView = {
    $container: null,
    warehouseId: null,
    draggedPlan: null,
    DAYS: 14,

    mount($container, whId) {
      this.$container = $container;
      this.warehouseId = whId;
      this.render();
    },

    unmount() { this.$container = null; this.draggedPlan = null; },

    refresh(whId) { this.warehouseId = whId; this.render(); },

    render() {
      const operators = global.Store.getFlipOperators();
      const needing = global.Store.getBatchesNeedingFlip();
      const pendingPlans = global.Store.getFlipPlans({ status: 'pending' });
      const completedPlans = global.Store.getFlipPlans({ status: 'completed' });
      const today = new Date();

      const dates = [];
      for (let i = 0; i < this.DAYS; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push({ key: global.Store.formatDate(d), label: `${d.getMonth()+1}/${d.getDate()}`, isWeekend: d.getDay() === 0 || d.getDay() === 6, isToday: i === 0 });
      }

      this.$container.html(`
        <h4 class="mb-4"><i class="bi bi-arrow-repeat me-2"></i>翻垛计划编排
          <small class="text-muted fw-normal ms-2">待翻垛 ${needing.length} 垛 · 待执行计划 ${pendingPlans.length} · 已完成 ${completedPlans.length}</small>
        </h4>

        <div class="row g-4">
          <div class="col-lg-4">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-list-ul me-1"></i>待翻垛批次</h6>
                <span class="badge bg-danger rounded-pill">${needing.length}</span>
              </div>
              <div class="card-body p-0" style="max-height:520px;overflow-y:auto;">
                <div class="list-group list-group-flush">
                  ${needing.slice(0, 80).map(b => {
                    const flip = global.BatchModel.computeFlipDue(b);
                    return `<div class="list-group-item list-group-item-action py-2 pending-item" draggable="true" data-batch-id="${b.id}" style="cursor:grab;">
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>${b.id}</strong> · <small>${b.producingArea} ${b.grade}</small>
                          <div class="small text-muted">${global.Store.getWarehouseById(b.warehouseId).name} R${b.row+1}C${b.col+1} · ${b.variety}</div>
                        </div>
                        <span class="badge ${flip.daysOverdue>15?'bg-danger':flip.daysOverdue>5?'bg-warning':'bg-info'} rounded-pill">超${flip.daysOverdue}天</span>
                      </div>
                    </div>`;
                  }).join('') || '<div class="text-center text-muted py-4">暂无待翻垛批次</div>'}
                </div>
              </div>
            </div>
          </div>

          <div class="col-lg-8">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-calendar3 me-1"></i>未来14天甘特图（拖拽批次到指定日期/人员）</h6>
                <button class="btn btn-sm btn-outline-primary add-plan"><i class="bi bi-plus me-1"></i>手动添加</button>
              </div>
              <div class="card-body p-0" style="overflow-x:auto;">
                <div style="min-width:900px;">
                  <div class="d-flex border-bottom">
                    <div style="width:140px;flex-shrink:0;padding:8px;font-weight:bold;background:#f8f9fa;">操作人员 \ 日期</div>
                    ${dates.map(d => `<div style="flex:1;padding:8px;text-align:center;font-weight:bold;background:${d.isToday?'#e7f1ff':d.isWeekend?'#f8f9fa':'#fff'};border-left:1px solid #dee2e6;">${d.label}${d.isToday?'<br><small class="text-primary">今天</small>':d.isWeekend?'<br><small class="text-muted">周末</small>':''}</div>`).join('')}
                  </div>
                  ${operators.map(op => `
                    <div class="d-flex border-bottom">
                      <div style="width:140px;flex-shrink:0;padding:8px;font-weight:500;background:#f8f9fa;">
                        <i class="bi bi-person me-1"></i>${op}
                      </div>
                      ${dates.map(d => `
                        <div class="drop-zone" style="flex:1;min-height:60px;padding:4px;border-left:1px solid #dee2e6;background:${d.isToday?'#fafbff':'transparent'};"
                             data-operator="${op}" data-date="${d.key}">
                          ${pendingPlans.filter(p => p.operator === op && p.date === d.key).map(p => {
                            const b = global.Store.getBatchById(p.batchId);
                            const hasConflict = this.hasConflict(p);
                            return `<div class="gantt-bar ${hasConflict?'conflict':''}" style="position:static;width:auto;margin-bottom:4px;"
                                        draggable="true" data-plan-id="${p.id}" data-batch-id="${p.batchId}" data-operator="${op}" data-date="${d.key}">
                              ${b ? b.id.slice(-4) : p.batchId.slice(-4)} ${hasConflict?'⚠':''}
                            </div>`;
                          }).join('')}
                        </div>
                      `).join('')}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-header"><h6 class="mb-0"><i class="bi bi-check-circle me-1"></i>今日待执行计划</h6></div>
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="table table-sm align-middle mb-0">
                    <thead><tr><th>批次</th><th>库房垛位</th><th>产区/品种/等级</th><th>操作人</th><th>计划日期</th><th>操作</th></tr></thead>
                    <tbody>
                      ${pendingPlans.slice(0, 15).map(p => {
                        const b = global.Store.getBatchById(p.batchId);
                        if (!b) return '';
                        const conflict = this.hasConflict(p);
                        return `<tr class="${conflict?'table-danger':''}">
                          <td><strong>${b.id}</strong></td>
                          <td>${global.Store.getWarehouseById(p.warehouseId)?.name || p.warehouseId} R${b.row+1}C${b.col+1}</td>
                          <td>${b.producingArea} / ${b.variety} / ${b.grade}</td>
                          <td><i class="bi bi-person me-1"></i>${p.operator}</td>
                          <td>${p.date}${conflict?' <span class="badge bg-danger">冲突</span>':''}</td>
                          <td>
                            <button class="btn btn-sm btn-success complete-plan" data-plan-id="${p.id}">完成</button>
                            <button class="btn btn-sm btn-outline-danger remove-plan" data-plan-id="${p.id}">移除</button>
                          </td>
                        </tr>`;
                      }).join('') || '<tr><td colspan="6" class="text-center text-muted py-3">暂无待执行计划</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);

      this.bindEvents();
    },

    hasConflict(plan) {
      const same = global.Store.getFlipPlans().filter(p => p.id !== plan.id && p.operator === plan.operator && p.date === plan.date && p.status === 'pending');
      const whs = new Set(same.map(p => p.warehouseId));
      whs.add(plan.warehouseId);
      return whs.size > 1;
    },

    bindEvents() {
      const self = this;

      this.$container.off('dragstart').on('dragstart', '.pending-item, .gantt-bar', function(e) {
        self.draggedPlan = {
          batchId: $(this).data('batch-id'),
          planId: $(this).data('plan-id'),
          fromOperator: $(this).data('operator'),
          fromDate: $(this).data('date')
        };
        $(this).addClass('dragging');
        e.originalEvent.dataTransfer.effectAllowed = 'move';
      });

      this.$container.off('dragend').on('dragend', '.pending-item, .gantt-bar', function() {
        $(this).removeClass('dragging');
      });

      this.$container.off('dragover').on('dragover', '.drop-zone', function(e) {
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = 'move';
        $(this).addClass('drag-over');
      });

      this.$container.off('dragleave').on('dragleave', '.drop-zone', function() {
        $(this).removeClass('drag-over');
      });

      this.$container.off('drop').on('drop', '.drop-zone', function(e) {
        e.preventDefault();
        $(this).removeClass('drag-over');
        if (!self.draggedPlan) return;
        const targetOperator = $(this).data('operator');
        const targetDate = $(this).data('date');
        const batch = global.Store.getBatchById(self.draggedPlan.batchId);

        if (self.draggedPlan.planId) {
          if (global.Store.checkFlipConflict(targetOperator, targetDate, self.draggedPlan.planId)) {
            global.App.showToast('该操作人当日已分配多个库房，存在冲突', 'warning');
          }
          global.Store.updateFlipPlan(self.draggedPlan.planId, {
            operator: targetOperator,
            date: targetDate,
            warehouseId: batch?.warehouseId
          });
        } else {
          const existing = global.Store.getFlipPlans().find(p => p.batchId === self.draggedPlan.batchId && p.status === 'pending');
          if (existing) {
            global.App.showToast('该批次已有待执行翻垛计划', 'warning');
            self.render();
            return;
          }
          if (global.Store.checkFlipConflict(targetOperator, targetDate)) {
            global.App.showToast('该操作人当日已分配多个库房，存在冲突', 'warning');
          }
          global.Store.addFlipPlan({
            batchId: self.draggedPlan.batchId,
            operator: targetOperator,
            date: targetDate,
            warehouseId: batch?.warehouseId
          });
        }

        self.draggedPlan = null;
        global.App.showToast('翻垛计划已更新', 'success');
        self.render();
      });

      this.$container.off('click.complete').on('click.complete', '.complete-plan', function() {
        const pid = $(this).data('plan-id');
        const plan = global.Store.getFlipPlans().find(p => p.id === pid);
        if (plan) {
          global.Store.updateFlipPlan(pid, { status: 'completed' });
          const batch = global.Store.getBatchById(plan.batchId);
          if (batch) {
            global.Store.updateBatch(plan.batchId, {
              lastFlipDate: plan.date,
              flipCount: (batch.flipCount || 0) + 1
            });
          }
          global.App.showToast('翻垛已完成', 'success');
          global.App.updateQuickStats();
          self.render();
        }
      });

      this.$container.off('click.remove').on('click.remove', '.remove-plan', function() {
        const pid = $(this).data('plan-id');
        global.Store.removeFlipPlan(pid);
        global.App.showToast('计划已移除', 'info');
        self.render();
      });

      this.$container.off('click.add').on('click.add', '.add-plan', () => this.showAddPlanDialog());

      this.$container.off('click.bar').on('click.bar', '.gantt-bar', function() {
        const pid = $(this).data('plan-id');
        const plan = global.Store.getFlipPlans().find(p => p.id === pid);
        if (plan) self.showPlanDetail(plan);
      });
    },

    showAddPlanDialog() {
      const operators = global.Store.getFlipOperators();
      const needing = global.Store.getBatchesNeedingFlip().slice(0, 50);
      const today = global.Store.formatDate(new Date());

      global.App.showModal({
        title: '手动添加翻垛计划',
        body: `
          <form id="addPlanForm">
            <div class="mb-3">
              <label class="form-label">选择批次</label>
              <select class="form-select" name="batchId" required>
                <option value="">请选择待翻垛批次</option>
                ${needing.map(b => `<option value="${b.id}">${b.id} - ${b.producingArea} ${b.variety} ${b.grade} (${global.Store.getWarehouseById(b.warehouseId).name})</option>`).join('')}
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">计划日期</label>
              <input type="date" class="form-control" name="date" value="${today}" required>
            </div>
            <div class="mb-3">
              <label class="form-label">操作人员</label>
              <select class="form-select" name="operator" required>
                ${operators.map(o => `<option value="${o}">${o}</option>`).join('')}
              </select>
            </div>
          </form>
        `,
        footer: `
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
          <button type="button" class="btn btn-primary" id="confirmAddPlan"><i class="bi bi-plus me-1"></i>添加计划</button>
        `,
        onShown: () => {
          const self = this;
          if ($.validator) $('#addPlanForm').validate();
          $('#confirmAddPlan').off('click').on('click', function() {
            if ($.validator && !$('#addPlanForm').valid()) return;
            const fd = $('#addPlanForm').serializeArray().reduce((o, x) => { o[x.name] = x.value; return o; }, {});
            const batch = global.Store.getBatchById(fd.batchId);
            const v = global.Validator.validateFlipPlan({ ...fd, warehouseId: batch?.warehouseId });
            if (!v.valid) { global.App.showToast(v.errors.join('；'), 'error'); return; }
            global.Store.addFlipPlan({ ...fd, warehouseId: batch?.warehouseId });
            global.App.showToast('翻垛计划已添加', 'success');
            global.App.hideModal();
            self.render();
          });
        }
      });
    },

    showPlanDetail(plan) {
      const b = global.Store.getBatchById(plan.batchId);
      const flip = b ? global.BatchModel.computeFlipDue(b) : null;
      global.App.showModal({
        title: `翻垛计划 - ${plan.id}`,
        body: `
          <div class="row g-3 mb-3">
            <div class="col-md-6"><strong>批次：</strong>${plan.batchId}</div>
            <div class="col-md-6"><strong>状态：</strong>
              <span class="badge ${plan.status==='completed'?'bg-success':'bg-warning'}">${plan.status==='completed'?'已完成':'待执行'}</span>
            </div>
            ${b ? `
              <div class="col-md-6"><strong>产区/品种/等级：</strong>${b.producingArea} / ${b.variety} / ${b.grade}</div>
              <div class="col-md-6"><strong>垛位：</strong>${global.Store.getWarehouseById(b.warehouseId)?.name} R${b.row+1}C${b.col+1}</div>
              <div class="col-md-6"><strong>入库日期：</strong>${b.entryDate}</div>
              <div class="col-md-6"><strong>上次翻垛：</strong>${b.lastFlipDate}${flip?` (${flip.daysSince}天前)`:''}</div>
            ` : ''}
            <div class="col-md-6"><strong>操作人员：</strong>${plan.operator}</div>
            <div class="col-md-6"><strong>计划日期：</strong>${plan.date}</div>
          </div>
        `,
        footer: `
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
          ${plan.status !== 'completed' ? `<button type="button" class="btn btn-danger" id="delPlan"><i class="bi bi-trash me-1"></i>删除计划</button>` : ''}
        `,
        onShown: () => {
          const self = this;
          $('#delPlan').off('click').on('click', () => {
            global.Store.removeFlipPlan(plan.id);
            global.App.showToast('计划已删除', 'info');
            global.App.hideModal();
            self.render();
          });
        }
      });
    }
  };

  global.FlipPlanView = FlipPlanView;
})(window);
