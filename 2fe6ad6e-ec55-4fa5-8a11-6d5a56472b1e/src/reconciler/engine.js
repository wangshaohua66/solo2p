'use strict';

/**
 * 还款核对引擎
 * 职责：将标准化还款记录与中心系统当期应还计划比对，识别异常：
 *  - overdue  逾期还款：实还日期晚于应还日期
 *  - partial  部分还款：实还金额小于应还金额
 *  - early    提前还款：实还金额大于应还金额且合同标记提前结清
 *  - rate_change 利率调整：当期利率与上期不一致
 *  - unmatched 未匹配：无对应应还计划
 * 每类异常生成独立标记；逾期/部分还款实时回调通知（供钉钉推送）。
 */

const db = require('../utils/db');
const logger = require('../utils/logger');
const log = logger.forBank('RECONCILE');

const TOLERANCE = 0.01; // 金额容差（元）

/**
 * @param {Array<object>} records 标准化还款记录
 * @param {object} opts { runId, month, onException }
 * @returns {Promise<{summary:object, exceptions:Array}>}
 */
async function reconcile(records, opts) {
  const { runId, month, onException } = opts || {};
  const plans = await loadPlans(month);
  const planMap = buildPlanMap(plans);

  const exceptions = [];
  const summary = {
    total: records.length,
    matched: 0,
    overdue: 0, partial: 0, early: 0, rate_change: 0, unmatched: 0,
    overdueAmount: 0, partialAmount: 0,
    byBank: {},
  };

  for (const rec of records) {
    const bc = rec.bank_code;
    summary.byBank[bc] = summary.byBank[bc] || { total: 0, matched: 0, exceptions: 0, dueTotal: 0, actualTotal: 0 };
    summary.byBank[bc].total++;

    const key = `${rec.contract_no}#${rec.period}`;
    const plan = planMap.get(key);

    if (!plan) {
      summary.unmatched++;
      const ex = makeException(rec, 'unmatched', runId, {
        detail: `未找到应还计划: 合同号=${rec.contract_no} 期次=${rec.period}`,
      });
      exceptions.push(ex);
      continue;
    }
    summary.matched++;
    summary.byBank[bc].matched++;

    const dueTotal = round2((plan.due_principal || 0) + (plan.due_interest || 0));
    const dueDate = plan.due_date;
    const actual = rec.actual_amount || 0;
    summary.byBank[bc].dueTotal = round2(summary.byBank[bc].dueTotal + dueTotal);
    summary.byBank[bc].actualTotal = round2(summary.byBank[bc].actualTotal + actual);

    // 1) 逾期还款
    if (dueDate && rec.repay_date && rec.repay_date > dueDate) {
      const overdueDays = daysBetween(dueDate, rec.repay_date);
      summary.overdue++;
      summary.overdueAmount += Math.max(0, dueTotal - actual);
      const ex = makeException(rec, 'overdue', runId, {
        due_amount: dueTotal, actual_amount: actual,
        due_date: dueDate, repay_date: rec.repay_date,
        overdue_days: overdueDays,
        detail: `逾期 ${overdueDays} 天，应还 ${dueTotal} 元，实还 ${actual} 元`,
      });
      exceptions.push(ex);
      await emit(ex, onException);
    }

    // 2) 部分还款
    if (actual > 0 && actual < dueTotal - TOLERANCE) {
      summary.partial++;
      summary.partialAmount += (dueTotal - actual);
      const ex = makeException(rec, 'partial', runId, {
        due_amount: dueTotal, actual_amount: actual,
        due_date: dueDate, repay_date: rec.repay_date,
        detail: `部分还款，应还 ${dueTotal} 元，实还 ${actual} 元，差额 ${round2(dueTotal - actual)} 元`,
      });
      exceptions.push(ex);
      await emit(ex, onException);
    }

    // 3) 提前还款（实还大于应还且标记提前结清）
    if (actual > dueTotal + TOLERANCE) {
      const isEarly = plan.early_settlement === 1 || plan.early_settlement === true ||
        actual >= round2((plan.due_principal || 0)) * 1.5;
      if (isEarly) {
        summary.early++;
        const ex = makeException(rec, 'early', runId, {
          due_amount: dueTotal, actual_amount: actual,
          due_date: dueDate, repay_date: rec.repay_date,
          detail: `提前还款，实还 ${actual} 元超出应还 ${dueTotal} 元`,
        });
        exceptions.push(ex);
        await emit(ex, onException);
      }
    }

    // 4) 利率调整：与上一期计划利率比对
    if (rec.rate != null && rec.rate !== '') {
      const prevRate = await getPrevRate(rec.contract_no, rec.period);
      if (prevRate != null && Math.abs(Number(rec.rate) - Number(prevRate)) > 1e-6) {
        summary.rate_change++;
        const ex = makeException(rec, 'rate_change', runId, {
          due_amount: dueTotal, actual_amount: actual,
          due_date: dueDate, repay_date: rec.repay_date,
          detail: `利率调整：上期 ${prevRate}% 当期 ${rec.rate}%`,
        });
        exceptions.push(ex);
      }
    }
  }

  // 按银行统计异常数
  for (const ex of exceptions) {
    const bc = ex.bank_code;
    if (summary.byBank[bc]) summary.byBank[bc].exceptions++;
  }

  // 持久化异常
  for (const ex of exceptions) {
    try { await db.insertException(ex); } catch (e) { log.debug(`异常落库失败: ${e.message}`); }
  }

  summary.overdueAmount = round2(summary.overdueAmount);
  summary.partialAmount = round2(summary.partialAmount);
  log.info(`核对完成: 共 ${summary.total} 条，匹配 ${summary.matched}，逾期 ${summary.overdue}，部分 ${summary.partial}，提前 ${summary.early}，利率调整 ${summary.rate_change}，未匹配 ${summary.unmatched}`);
  return { summary, exceptions };
}

async function emit(ex, onException) {
  if (typeof onException === 'function') {
    try { await onException(ex); } catch (e) { log.debug(`实时通知回调失败: ${e.message}`); }
  }
}

async function loadPlans(month) {
  if (!month) return [];
  return db.getPlansByMonth(month);
}

function buildPlanMap(plans) {
  const m = new Map();
  for (const p of plans) {
    m.set(`${p.contract_no}#${p.period}`, p);
  }
  return m;
}

async function getPrevRate(contractNo, period) {
  if (!contractNo || period == null) return null;
  const prev = await db.getPlan(contractNo, period - 1);
  if (!prev) return null;
  return prev.rate != null ? Number(prev.rate) : null;
}

function makeException(rec, type, runId, extra) {
  return {
    run_id: runId,
    bank_code: rec.bank_code,
    contract_no: rec.contract_no,
    borrower_name: rec.borrower_name,
    period: rec.period,
    type,
    due_amount: extra.due_amount != null ? extra.due_amount : 0,
    actual_amount: extra.actual_amount != null ? extra.actual_amount : 0,
    due_date: extra.due_date || null,
    repay_date: extra.repay_date || null,
    overdue_days: extra.overdue_days || 0,
    detail: extra.detail || '',
  };
}

function daysBetween(due, actual) {
  const a = new Date(actual); const b = new Date(due);
  return Math.max(0, Math.round((a - b) / 86400000));
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

module.exports = { reconcile };
