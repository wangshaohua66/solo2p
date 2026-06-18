const { getDb } = require('../models/db');
const logger = require('../utils/logger');
const expiryService = require('../services/expiryService');

async function getInventorySummary(req, res) {
  const startTime = Date.now();
  const db = getDb();

  const { blood_type_abo, blood_type_rh, component_type, status } = req.query;

  let sql = `
    SELECT
      cp.blood_type_abo,
      cp.blood_type_abo || cp.blood_type_rh as blood_type_full,
      cp.component_type,
      COUNT(*) as total_quantity,
      SUM(CASE WHEN ib.status = '在库' THEN 1 ELSE 0 END) as available_quantity,
      sst.min_quantity,
      sst.warning_quantity,
      MIN(julianday(ib.expiry_date) - julianday('now')) as min_days_remaining
    FROM inventory_batches ib
    JOIN component_products cp ON ib.product_id = cp.id
    LEFT JOIN safety_stock_thresholds sst
      ON cp.blood_type_abo = sst.blood_type_abo
      AND cp.blood_type_rh = sst.blood_type_rh
      AND cp.component_type = sst.component_type
    WHERE 1=1
  `;

  const params = [];
  if (blood_type_abo) { sql += ' AND cp.blood_type_abo = ?'; params.push(blood_type_abo); }
  if (blood_type_rh) { sql += ' AND cp.blood_type_rh = ?'; params.push(blood_type_rh); }
  if (component_type) { sql += ' AND cp.component_type = ?'; params.push(component_type); }
  if (status) { sql += ' AND ib.status = ?'; params.push(status); }

  sql += `
    GROUP BY cp.blood_type_abo, cp.blood_type_rh, cp.component_type
    ORDER BY cp.blood_type_abo, cp.blood_type_rh, cp.component_type
  `;

  const summary = db.prepare(sql).all(...params);

  const result = summary.map(s => ({
    ...s,
    stock_status: s.available_quantity <= (s.min_quantity || 0) ? '低于安全库存' :
                  s.available_quantity <= (s.warning_quantity || 0) ? '预警' : '正常',
    stock_shortfall: Math.max(0, (s.warning_quantity || 0) - (s.available_quantity || 0))
  }));

  const duration = Date.now() - startTime;
  if (duration > 80) {
    logger.warn(`库存查询超过80ms约束: ${duration}ms`);
  }

  logger.info(`库存汇总查询: 返回${result.length}条 耗时${duration}ms`);
  res.json(result);
}

async function getInventoryDetails(req, res) {
  const startTime = Date.now();
  const db = getDb();

  const {
    blood_type_abo, blood_type_rh, component_type, status,
    expiry_from, expiry_to, page = 1, page_size = 50
  } = req.query;

  let sql = `
    SELECT
      ib.*,
      cp.product_code,
      cp.component_type,
      cp.blood_type_abo,
      cp.blood_type_rh,
      cp.preparation_date,
      cp.expiry_date as product_expiry,
      bb.bag_no,
      d.name as donor_name,
      d.donor_card_no,
      julianday(ib.expiry_date) - julianday('now') as days_remaining
    FROM inventory_batches ib
    JOIN component_products cp ON ib.product_id = cp.id
    LEFT JOIN blood_bags bb ON cp.parent_bag_id = bb.id
    LEFT JOIN donors d ON bb.donor_id = d.id
    WHERE 1=1
  `;

  const params = [];
  if (blood_type_abo) { sql += ' AND cp.blood_type_abo = ?'; params.push(blood_type_abo); }
  if (blood_type_rh) { sql += ' AND cp.blood_type_rh = ?'; params.push(blood_type_rh); }
  if (component_type) { sql += ' AND cp.component_type = ?'; params.push(component_type); }
  if (status) { sql += ' AND ib.status = ?'; params.push(status); }
  if (expiry_from) { sql += ' AND ib.expiry_date >= ?'; params.push(expiry_from); }
  if (expiry_to) { sql += ' AND ib.expiry_date <= ?'; params.push(expiry_to); }

  const countSql = sql.replace('SELECT ib.*,', 'SELECT COUNT(*) as cnt FROM inventory_batches ib JOIN component_products cp ON ib.product_id = cp.id LEFT JOIN blood_bags bb ON cp.parent_bag_id = bb.id LEFT JOIN donors d ON bb.donor_id = d.id WHERE 1=1 ');
  const total = db.prepare(countSql).get(...params).cnt;

  sql += ` ORDER BY ib.expiry_date ASC LIMIT ? OFFSET ?`;
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));

  const items = db.prepare(sql).all(...params);

  const result = items.map(item => ({
    ...item,
    expiry_warning_level: expiryService.getWarningLevel(Math.floor(item.days_remaining))
  }));

  const duration = Date.now() - startTime;
  if (duration > 80) {
    logger.warn(`库存详情查询超过80ms约束: ${duration}ms`);
  }

  res.json({ items: result, total, page: parseInt(page), page_size: parseInt(page_size), duration_ms: duration });
}

async function manualScrapInventory(req, res) {
  const db = getDb();
  const { id, reason } = req.body;

  if (!id || !reason) {
    return res.status(400).json({ error: '库存ID和报废原因为必填项' });
  }

  try {
    const item = db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ error: '库存记录不存在' });
    }
    if (item.status === '报废' || item.status === '已出库') {
      return res.status(400).json({ error: '该库存状态不允许报废' });
    }

    db.prepare(`
      UPDATE inventory_batches
      SET status = '报废', lock_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason, id);

    logger.warn(`库存手动报废: ID=${id} 原因=${reason}`);

    res.json({ success: true, id, status: '报废' });
  } catch (err) {
    logger.error(`库存报废失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function getSafetyThresholds(req, res) {
  const db = getDb();
  const thresholds = db.prepare('SELECT * FROM safety_stock_thresholds ORDER BY blood_type_abo, blood_type_rh, component_type').all();
  res.json(thresholds);
}

async function updateSafetyThreshold(req, res) {
  const db = getDb();
  const { id, min_quantity, warning_quantity } = req.body;

  try {
    db.prepare(`
      UPDATE safety_stock_thresholds
      SET min_quantity = ?, warning_quantity = ?
      WHERE id = ?
    `).run(min_quantity, warning_quantity, id);

    const updated = db.prepare('SELECT * FROM safety_stock_thresholds WHERE id = ?').get(id);
    logger.info(`安全库存阈值更新: ${JSON.stringify(updated)}`);
    res.json(updated);
  } catch (err) {
    logger.error(`阈值更新失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function runExpiryScan(req, res) {
  try {
    const result = expiryService.scanExpiry();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getExpiryWarnings(req, res) {
  const stats = expiryService.getExpiryStats();
  res.json(stats);
}

async function stockOut(req, res) {
  const db = getDb();
  const { inventory_ids } = req.body;

  if (!Array.isArray(inventory_ids)) {
    return res.status(400).json({ error: '库存ID列表为必填项' });
  }

  const tx = db.transaction(() => {
    for (const id of inventory_ids) {
      const item = db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(id);
      if (!item) throw new Error(`库存${id}不存在`);
      if (item.status !== '已锁定') throw new Error(`库存${id}状态不是已锁定，无法出库`);

      db.prepare(`
        UPDATE inventory_batches
        SET status = '已出库', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);
    }
    return { success: true, count: inventory_ids.length };
  });

  try {
    const result = tx();
    logger.info(`血液出库: ${inventory_ids.length}件`);
    res.json(result);
  } catch (err) {
    logger.error(`出库失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function getStatistics(req, res) {
  const db = getDb();
  const { period = 'month', year, month, quarter } = req.query;

  let dateFilter = '';
  const params = [];

  if (year) {
    if (period === 'month' && month) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      dateFilter = "AND strftime('%Y-%m', bb.collection_date) = ?";
      params.push(monthStr);
    } else if (period === 'quarter' && quarter) {
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      dateFilter = "AND strftime('%Y', bb.collection_date) = ? AND CAST(strftime('%m', bb.collection_date) AS INTEGER) BETWEEN ? AND ?";
      params.push(year, startMonth, endMonth);
    } else {
      dateFilter = "AND strftime('%Y', bb.collection_date) = ?";
      params.push(year);
    }
  }

  const collected = db.prepare(`
    SELECT COUNT(*) as cnt, SUM(volume) as total_volume
    FROM blood_bags bb
    WHERE status != '报废' ${dateFilter}
  `).get(...params);

  const testedDateFilter = dateFilter.replace(/bb\./g, 'tr.');
  const tested = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN result = '合格' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN result = '不合格' THEN 1 ELSE 0 END) as failed
    FROM test_records tr
    JOIN blood_bags bb ON tr.bag_id = bb.id
    WHERE 1=1 ${testedDateFilter}
  `).get(...params);

  const prepDateFilter = dateFilter.replace(/bb\./g, 'cp.');
  const prepared = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM component_products cp
    JOIN blood_bags bb ON cp.parent_bag_id = bb.id
    WHERE 1=1 ${prepDateFilter}
  `).get(...params);

  const supplyDateFilter = dateFilter.replace(/bb\./g, 'mr.');
  const supplied = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM matching_results mr
    JOIN blood_requests br ON mr.request_id = br.id
    WHERE mr.final_result = '配血成功'
      ${supplyDateFilter}
  `).get(...params);

  const reqDateFilter = dateFilter.replace(/bb\./g, 'br.');
  const requested = db.prepare(`
    SELECT SUM(quantity) as total
    FROM blood_requests br
    WHERE status != '已取消' ${reqDateFilter}
  `).get(...params);

  const failRate = tested.total > 0 ? ((tested.failed || 0) / tested.total * 100).toFixed(2) : 0;
  const prepRate = collected.cnt > 0 ? (prepared.cnt / collected.cnt * 100).toFixed(2) : 0;
  const supplyRate = (requested.total || 0) > 0 ? (supplied.cnt / (requested.total || 0) * 100).toFixed(2) : 0;

  res.json({
    period: { year, month, quarter, period },
    collection: {
      units: collected.cnt || 0,
      volume_ml: collected.total_volume || 0
    },
    testing: {
      total: tested.total || 0,
      passed: tested.passed || 0,
      failed: tested.failed || 0,
      failure_rate_percent: parseFloat(failRate)
    },
    component_preparation: {
      units: prepared.cnt || 0,
      preparation_rate_percent: parseFloat(prepRate)
    },
    clinical_supply: {
      requested_units: requested.total || 0,
      supplied_units: supplied.cnt || 0,
      fulfillment_rate_percent: parseFloat(supplyRate)
    }
  });
}

async function exportRegulatoryData(req, res) {
  const db = getDb();
  const { year, month } = req.query;

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const exportData = {
    report_period: monthStr,
    report_type: '血液管理信息系统上报',
    generated_at: new Date().toISOString(),
    sections: {
      donors: db.prepare(`
        SELECT
          COUNT(*) as total_registered,
          SUM(CASE WHEN gender = '男' THEN 1 ELSE 0 END) as male_count,
          SUM(CASE WHEN gender = '女' THEN 1 ELSE 0 END) as female_count
        FROM donors
        WHERE strftime('%Y-%m', created_at) = ?
      `).get(monthStr),

      collections: db.prepare(`
        SELECT
          COUNT(*) as total_units,
          SUM(bb.volume) as total_volume,
          d.blood_type_abo,
          d.blood_type_rh
        FROM blood_bags bb
        JOIN donors d ON bb.donor_id = d.id
        WHERE strftime('%Y-%m', bb.collection_date) = ?
        GROUP BY d.blood_type_abo, d.blood_type_rh
      `).all(monthStr),

      testing: db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN result = '不合格' THEN 1 ELSE 0 END) as failed
        FROM test_records
        WHERE strftime('%Y-%m', test_date) = ?
      `).get(monthStr),

      components: db.prepare(`
        SELECT component_type, COUNT(*) as count
        FROM component_products
        WHERE strftime('%Y-%m', preparation_date) = ?
        GROUP BY component_type
      `).all(monthStr),

      distribution: db.prepare(`
        SELECT h.name, h.code, COUNT(*) as units_supplied
        FROM blood_requests br
        JOIN hospitals h ON br.hospital_id = h.id
        JOIN matching_results mr ON br.id = mr.request_id
        WHERE mr.final_result = '配血成功'
          AND strftime('%Y-%m', br.created_at) = ?
        GROUP BY h.id
      `).all(monthStr)
    }
  };

  logger.info(`监管数据导出: ${monthStr}`);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="blood-center-report-${monthStr}.json"`);
  res.json(exportData);
}

module.exports = {
  getInventorySummary,
  getInventoryDetails,
  manualScrapInventory,
  getSafetyThresholds,
  updateSafetyThreshold,
  runExpiryScan,
  getExpiryWarnings,
  stockOut,
  getStatistics,
  exportRegulatoryData
};
