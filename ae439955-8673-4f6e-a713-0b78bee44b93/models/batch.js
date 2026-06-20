(function(global) {
  'use strict';

  const STATUS_LABELS = {
    new: '新入',
    aging: '醇化中',
    ready: '达标',
    overdue: '超期'
  };

  const STATUS_CSS_CLASS = {
    new: 'stack-new',
    aging: 'stack-aging',
    ready: 'stack-ready',
    overdue: 'stack-overdue'
  };

  function getAgingRange(grade) {
    return global.Store ? global.Store.getGradeAgingMonths(grade) : [24, 36];
  }

  const BatchModel = {
    computeAgingStatus(batch) {
      if (!batch || batch.status === 'outbound') {
        return { status: 'outbound', percent: 100, elapsedMonths: 0, label: '已出库' };
      }
      const now = new Date();
      const entry = new Date(batch.entryDate);
      const elapsedMonths = global.Store
        ? global.Store.monthsBetween(entry, now)
        : (now.getFullYear() - entry.getFullYear()) * 12 + (now.getMonth() - entry.getMonth());
      const [minMonths, maxMonths] = getAgingRange(batch.grade);

      let status, percent;
      if (elapsedMonths < 3) {
        status = 'new';
        percent = Math.min(100, Math.round((elapsedMonths / minMonths) * 100));
      } else if (elapsedMonths < minMonths) {
        status = 'aging';
        percent = Math.min(100, Math.round((elapsedMonths / minMonths) * 100));
      } else if (elapsedMonths <= maxMonths) {
        status = 'ready';
        percent = 100;
      } else {
        status = 'overdue';
        percent = 100;
      }

      return {
        status,
        percent,
        elapsedMonths,
        minMonths,
        maxMonths,
        overdueMonths: Math.max(0, elapsedMonths - maxMonths),
        label: STATUS_LABELS[status] || status,
        cssClass: STATUS_CSS_CLASS[status] || ''
      };
    },

    getStatusLabel(status) { return STATUS_LABELS[status] || status; },
    getStatusClass(status) { return STATUS_CSS_CLASS[status] || ''; },

    computeFlipDue(batch) {
      if (!batch) return { due: false, daysSince: 0, interval: 90, daysOverdue: 0 };
      const now = new Date();
      const last = new Date(batch.lastFlipDate);
      const daysSince = Math.floor((now - last) / (1000 * 60 * 60 * 24));
      const interval = global.Store ? global.Store.getFlipInterval(batch.variety) : 90;
      const overdue = Math.max(0, daysSince - interval);
      return { due: daysSince >= interval, daysSince, interval, daysOverdue: overdue };
    },

    getBatchSummary(batch) {
      const aging = this.computeAgingStatus(batch);
      const flip = this.computeFlipDue(batch);
      const latest = global.Store ? global.Store.getLatestTasting(batch.id) : null;
      return { batch, aging, flip, latestTasting: latest };
    }
  };

  global.BatchModel = BatchModel;
})(window);
