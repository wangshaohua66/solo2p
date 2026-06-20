(function(global) {
  'use strict';

  const FlipPlanView = {
    $container: null,
    warehouseId: null,
    draggedPlan: null,
    dragMode: null,
    dragStartX: 0,
    dragStartDate: null,
    dragStartDuration: null,
    DAYS: 14,
    DAY_WIDTH: 70,

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
        dates.push({
          key: global.Store.formatDate(d),
          label: `${d.getMonth()+1}/${d.getDate()}`,
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
          isToday: i === 0,
          index: i
        });
      }

      this.$container.html(`
        <h4 class="mb-4"><i class="bi bi-arrow-repeat me-2"></i>翻垛计划编排
          <small class="text-muted fw-normal ms-2">待翻垛 ${needing.length} 垛 · 待执行计划 ${pendingPlans.length} · 已完成 ${completedPlans.length}</small>
        </h4>

        <div class="row g-4">
          <div class="col-lg-3">
            <div class="card h-100">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-list-ul me-1"></i>待翻垛批次</h6>
                <span class="badge bg-danger rounded-pill">${needing.length}</span>
              </div>
              <div class="card-body p-0" id="pendingList" style="max-height:560px;overflow-y:auto;">
                <div class="list-group list-group-flush">
                  ${needing.map(b => {
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

          <div class="col-lg-9">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0"><i class="bi bi-calendar3 me-1"></i>未来14天甘特图（拖拽批次到甘特图，拖拽横条调整日期/时长）</h6>
                <button class="btn btn-sm btn-outline-primary add-plan"><i class="bi bi-plus me-1"></i>手动添加</button>
              </div>
              <div class="card-body p-0" style="overflow-x:auto;">
                <div id="ganttContainer" style="min-width:${this.DAYS * this.DAY_WIDTH + 140}px;position:relative;">
                  <div class="d-flex border-bottom sticky-top bg-white" style="z-index:10;">
                    <div style="width:140px;flex-shrink:0;padding:8px;font-weight:bold;background:#f8f9fa;border-right:1px solid #dee2e6;">操作人员</div>
                    <div style="display:flex;flex:1;">
                      ${dates.map(d => `<div style="width:${this.DAY_WIDTH}px;padding:8px;text-align:center;font-weight:bold;background:${d.isToday?'#e7f1ff':d.isWeekend?'#f8f9fa':'#fff'};border-right:1px solid #dee2e6;flex-shrink:0;">${d.label}${d.isToday?'<br><small class="text-primary">今天</small>':d.isWeekend?'<br><small class="text-muted">周末</small>':''}</div>`).join('')}
                    </div>
                  </div>
                  <div id="ganttBody">
                    ${operators.map((op, opIdx) => `
                      <div class="gantt-row d-flex border-bottom" data-operator="${op}" style="min-height:70px;">
                        <div style="width:140px;flex-shrink:0;padding:8px;font-weight:500;background:#f8f9fa;border-right:1px solid #dee2e6;display:flex;align-items:center;">
                          <i class="bi bi-person me-1"></i>${op}
                        </div>
                        <div class="gantt-track" data-operator="${op}" style="flex:1;position:relative;background:${opIdx%2===0?'#fff':'#fcfcfc'};">
                          ${dates.map((d, i) => `<div class="gantt-day-slot" data-date="${d.key}" data-day-index="${i}" style="position:absolute;left:${i*this.DAY_WIDTH}px;top:0;width:${this.DAY_WIDTH}px;height:100%;border-right:1px dashed #e9ecef;box-sizing:border-box;"></div>`).join('')}
                          ${pendingPlans.filter(p => p.operator === op).map(p => {
                            const b = global.Store.getBatchById(p.batchId);
                            const hasConflict = this.hasConflict(p);
                            const startIdx = this.getDateIndex(p.startDate || p.date, dates);
                            const duration = p.durationDays || 1;
                            const left = startIdx * this.DAY_WIDTH;
                            const width = duration * this.DAY_WIDTH - 4;
                            if (startIdx < 0 || startIdx >= this.DAYS) return '';
                            return `<div class="gantt-bar ${hasConflict?'conflict':''}" 
                                        data-plan-id="${p.id}" 
                                        data-batch-id="${p.batchId}"
                                        data-operator="${op}"
                                        style="position:absolute;left:${left+2}px;top:8px;width:${width}px;height:54px;cursor:move;z-index:5;"
                                        draggable="false">
                              <div class="gantt-bar-resize gantt-bar-resize-left" data-resize="left" style="position:absolute;left:0;top:0;width:8px;height:100%;cursor:ew-resize;"></div>
                              <div class="gantt-bar-content" style="padding:4px 10px;height:100%;display:flex;flex-direction:column;justify-content:center;">
                                <div class="fw-bold text-white small">${b ? b.id : p.batchId} ${hasConflict?'⚠':''}</div>
                                <div class="text-white-50 small" style="font-size:10px;">${b ? b.variety : ''} · ${duration}天</div>
                              </div>
                              <div class="gantt-bar-resize gantt-bar-resize-right" data-resize="right" style="position:absolute;right:0;top:0;width:8px;height:100%;cursor:ew-resize;"></div>
                            </div>`;
                          }).join('')}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-header"><h6 class="mb-0"><i class="bi bi-check-circle me-1"></i>今日待执行计划</h6></div>
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="table table-sm align-middle mb-0">
                    <thead><tr><th>批次</th><th>库房垛位</th><th>产区/品种/等级</th><th>操作人</th><th>计划时段</th><th>操作</th></tr></thead>
                    <tbody>
                      ${pendingPlans.slice(0, 15).map(p => {
                        const b = global.Store.getBatchById(p.batchId);
                        if (!b) return '';
                        const conflict = this.hasConflict(p);
                        const duration = p.durationDays || 1;
                        return `<tr class="${conflict?'table-danger':''}">
                          <td><strong>${b.id}</strong></td>
                          <td>${global.Store.getWarehouseById(p.warehouseId)?.name || p.warehouseId} R${b.row+1}C${b.col+1}</td>
                          <td>${b.producingArea} / ${b.variety} / ${b.grade}</td>
                          <td><i class="bi bi-person me-1"></i>${p.operator}</td>
                          <td>${p.startDate || p.date} ~ ${p.endDate || p.date} (${duration}天)${conflict?' <span class="badge bg-danger">冲突</span>':''}</td>
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

    getDateIndex(dateStr, dates) {
      const target = new Date(dateStr).toDateString();
      for (let i = 0; i < dates.length; i++) {
        if (new Date(dates[i].key).toDateString() === target) return i;
      }
      return -1;
    },

    hasConflict(plan) {
      return global.Store.checkFlipConflict(
        plan.operator,
        plan.startDate || plan.date,
        plan.warehouseId,
        plan.id,
        plan.endDate || plan.date
      );
    },

    bindEvents() {
      const self = this;

      this.$container.off('dragstart').on('dragstart', '.pending-item', function(e) {
        self.draggedPlan = {
          batchId: $(this).data('batch-id'),
          planId: null,
          mode: 'new'
        };
        $(this).addClass('dragging');
        e.originalEvent.dataTransfer.effectAllowed = 'copy';
        e.originalEvent.dataTransfer.setData('text/plain', $(this).data('batch-id'));
      });

      this.$container.off('dragend').on('dragend', '.pending-item, .gantt-bar', function() {
        $(this).removeClass('dragging');
      });

      this.$container.off('dragover').on('dragover', '.gantt-track, .gantt-day-slot', function(e) {
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = 'copy';
        if ($(this).hasClass('gantt-track')) {
          $(this).addClass('drag-over');
        } else {
          $(this).closest('.gantt-track').addClass('drag-over');
        }
      });

      this.$container.off('dragleave').on('dragleave', '.gantt-track, .gantt-day-slot', function(e) {
        if ($(this).hasClass('gantt-track')) {
          $(this).removeClass('drag-over');
        } else {
          $(this).closest('.gantt-track').removeClass('drag-over');
        }
      });

      this.$container.off('drop').on('drop', '.gantt-track, .gantt-day-slot', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const $track = $(this).hasClass('gantt-track') ? $(this) : $(this).closest('.gantt-track');
        $track.removeClass('drag-over');

        if (!self.draggedPlan || self.draggedPlan.mode !== 'new') return;

        const targetOperator = $track.data('operator');
        const offsetX = e.originalEvent.clientX - $track.offset().left;
        const dayIndex = Math.max(0, Math.min(self.DAYS - 1, Math.floor(offsetX / self.DAY_WIDTH)));

        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + dayIndex);
        const dateStr = global.Store.formatDate(targetDate);

        const batch = global.Store.getBatchById(self.draggedPlan.batchId);

        const existing = global.Store.getFlipPlans().find(p => p.batchId === self.draggedPlan.batchId && p.status === 'pending');
        if (existing) {
          global.App.showToast('该批次已有待执行翻垛计划', 'warning');
          self.draggedPlan = null;
          self.render();
          return;
        }

        if (global.Store.checkFlipConflict(targetOperator, dateStr, batch?.warehouseId, null, dateStr)) {
          global.App.showToast('该操作人当日已分配多个库房，存在冲突，无法分配', 'error');
          self.draggedPlan = null;
          self.render();
          return;
        }

        global.Store.addFlipPlan({
          batchId: self.draggedPlan.batchId,
          operator: targetOperator,
          startDate: dateStr,
          endDate: dateStr,
          date: dateStr,
          durationDays: 1,
          warehouseId: batch?.warehouseId
        });

        self.draggedPlan = null;
        global.App.showToast('翻垛计划已添加', 'success');
        self.render();
      });

      let isDraggingBar = false;
      let barDragData = null;

      this.$container.off('mousedown.flip').on('mousedown.flip', '.gantt-bar', function(e) {
        const $bar = $(this);
        const planId = $bar.data('plan-id');
        const plan = global.Store.getFlipPlans().find(p => p.id === planId);
        if (!plan) return;

        const $track = $bar.closest('.gantt-track');
        const operator = $track.data('operator');
        const startX = e.clientX;
        const startLeft = parseInt($bar.css('left'));
        const startWidth = $bar.width();
        const startDate = plan.startDate || plan.date;
        const startDuration = plan.durationDays || 1;

        const resizeDir = $(e.target).data('resize');

        isDraggingBar = true;
        barDragData = {
          planId,
          plan,
          operator,
          startX,
          startLeft,
          startWidth,
          startDate,
          startDuration,
          mode: resizeDir || 'move',
          $bar,
          $track
        };

        $('body').css('user-select', 'none');
        e.preventDefault();
      });

      $(document).off('mousemove.flip').on('mousemove.flip', function(e) {
        if (!isDraggingBar || !barDragData) return;

        const dx = e.clientX - barDragData.startX;
        const dayDelta = Math.round(dx / self.DAY_WIDTH);

        if (barDragData.mode === 'move') {
          const newLeft = barDragData.startLeft + dayDelta * self.DAY_WIDTH;
          const maxLeft = (self.DAYS - (barDragData.startDuration || 1)) * self.DAY_WIDTH;
          const clampedLeft = Math.max(0, Math.min(maxLeft, newLeft));
          barDragData.$bar.css('left', clampedLeft + 2 + 'px');
        } else if (barDragData.mode === 'left') {
          const newWidth = barDragData.startWidth - dayDelta * self.DAY_WIDTH;
          const newLeft = barDragData.startLeft + dayDelta * self.DAY_WIDTH;
          const minWidth = self.DAY_WIDTH - 4;
          if (newWidth >= minWidth && newLeft >= 2) {
            barDragData.$bar.css('width', newWidth + 'px');
            barDragData.$bar.css('left', newLeft + 2 + 'px');
          }
        } else if (barDragData.mode === 'right') {
          const newWidth = barDragData.startWidth + dayDelta * self.DAY_WIDTH;
          const maxWidth = (self.DAYS - Math.floor(barDragData.startLeft / self.DAY_WIDTH)) * self.DAY_WIDTH - 4;
          if (newWidth >= self.DAY_WIDTH - 4 && newWidth <= maxWidth) {
            barDragData.$bar.css('width', newWidth + 'px');
          }
        }
      });

      $(document).off('mouseup.flip').on('mouseup.flip', function(e) {
        if (!isDraggingBar || !barDragData) return;

        const plan = barDragData.plan;
        const $track = barDragData.$track;
        const operator = barDragData.operator;

        const currentLeft = parseInt(barDragData.$bar.css('left'));
        const currentWidth = barDragData.$bar.width();

        const startDayIndex = Math.max(0, Math.min(self.DAYS - 1, Math.round(currentLeft / self.DAY_WIDTH)));
        const durationDays = Math.max(1, Math.min(self.DAYS - startDayIndex, Math.round((currentWidth + 4) / self.DAY_WIDTH)));

        const today = new Date();
        const newStartDate = new Date(today);
        newStartDate.setDate(newStartDate.getDate() + startDayIndex);
        const startStr = global.Store.formatDate(newStartDate);

        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + durationDays - 1);
        const endStr = global.Store.formatDate(newEndDate);

        const startChanged = startStr !== (plan.startDate || plan.date);
        const durationChanged = durationDays !== (plan.durationDays || 1);

        if (startChanged || durationChanged) {
          if (global.Store.checkFlipConflict(operator, startStr, plan.warehouseId, plan.id, endStr)) {
            global.App.showToast('调整后存在跨库房冲突，已撤销', 'warning');
          } else {
            global.Store.updateFlipPlan(plan.id, {
              startDate: startStr,
              endDate: endStr,
              date: startStr,
              durationDays: durationDays,
              operator: operator
            });
            global.App.showToast('计划已调整', 'success');
          }
        }

        isDraggingBar = false;
        barDragData = null;
        $('body').css('user-select', '');
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
              lastFlipDate: plan.endDate || plan.date,
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

      this.$container.off('click.bar').on('click.bar', '.gantt-bar-content', function() {
        const pid = $(this).closest('.gantt-bar').data('plan-id');
        const plan = global.Store.getFlipPlans().find(p => p.id === pid);
        if (plan) self.showPlanDetail(plan);
      });
    },

    showAddPlanDialog() {
      const operators = global.Store.getFlipOperators();
      const needing = global.Store.getBatchesNeedingFlip();
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
            <div class="row g-3 mb-3">
              <div class="col-md-6">
                <label class="form-label">开始日期</label>
                <input type="date" class="form-control" name="startDate" value="${today}" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">持续天数</label>
                <input type="number" class="form-control" name="durationDays" value="1" min="1" max="14" required>
              </div>
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
            const duration = parseInt(fd.durationDays) || 1;
            const endDate = new Date(fd.startDate);
            endDate.setDate(endDate.getDate() + duration - 1);
            const endStr = global.Store.formatDate(endDate);

            const v = global.Validator.validateFlipPlan({
              ...fd,
              date: fd.startDate,
              warehouseId: batch?.warehouseId
            });
            if (!v.valid) { global.App.showToast(v.errors.join('；'), 'error'); return; }

            if (global.Store.checkFlipConflict(fd.operator, fd.startDate, batch?.warehouseId, null, endStr)) {
              global.App.showToast('该操作人此时段已分配其他库房，存在冲突', 'error');
              return;
            }

            global.Store.addFlipPlan({
              ...fd,
              startDate: fd.startDate,
              endDate: endStr,
              date: fd.startDate,
              durationDays: duration,
              warehouseId: batch?.warehouseId
            });
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
            <div class="col-md-6"><strong>计划时段：</strong>${plan.startDate || plan.date} ~ ${plan.endDate || plan.date}</div>
            <div class="col-md-6"><strong>持续天数：</strong>${plan.durationDays || 1} 天</div>
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

  global.FlipPlanView = FlipPlan;
})(window);
