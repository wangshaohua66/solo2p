const { getDb } = require('../models/db');
const logger = require('../utils/logger');

const WARNING_LEVELS = {
  RED: 1,
  ORANGE: 3,
  YELLOW: 7
};

function daysUntilExpiry(expiryDateStr) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const t1 = new Date(todayStr + 'T00:00:00');
  const t2 = new Date(expiryDateStr + 'T00:00:00');
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

function getWarningLevel(days) {
  if (days <= 0) return '已过期';
  if (days <= WARNING_LEVELS.RED) return '红色';
  if (days <= WARNING_LEVELS.ORANGE) return '橙色';
  if (days <= WARNING_LEVELS.YELLOW) return '黄色';
  return '正常';
}

function scanExpiry() {
  const startTime = Date.now();
  const db = getDb();

  try {
    db.exec('BEGIN IMMEDIATE');

    const items = db.prepare(`
      SELECT ib.id, ib.product_id, ib.status, ib.expiry_date, cp.component_type
      FROM inventory_batches ib
      JOIN component_products cp ON ib.product_id = cp.id
      WHERE ib.status IN ('在库', '已锁定')
    `).all();

    let expiredCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      const days = daysUntilExpiry(item.expiry_date);
      const level = getWarningLevel(days);

      if (days <= 0 && item.status === '在库') {
        db.prepare(`
          UPDATE inventory_batches
          SET status = '报废', expiry_warning_level = '已过期', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(item.id);
        expiredCount++;
        logger.warn(`血液产品已过期自动报废: 库存ID=${item.id}, 产品ID=${item.product_id}, 类型=${item.component_type}`);
      } else {
        db.prepare(`
          UPDATE inventory_batches
          SET expiry_warning_level = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND (expiry_warning_level IS NULL OR expiry_warning_level != ?)
        `).run(level, item.id, level);
        updatedCount++;
      }
    }

    db.exec('COMMIT');

    const duration = Date.now() - startTime;
    logger.info(`效期扫描完成: 扫描${items.length}件, 报废${expiredCount}件, 更新预警${updatedCount}件, 耗时${duration}ms`);

    if (duration > 3000) {
      logger.warn(`效期扫描超过3秒约束: ${duration}ms`);
    }

    return { scanned: items.length, expired: expiredCount, updated: updatedCount, duration_ms: duration };
  } catch (err) {
    db.exec('ROLLBACK');
    logger.error(`效期扫描失败: ${err.message}`);
    throw err;
  }
}

function getExpiryStats() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const stats = db.prepare(`
    SELECT
      cp.blood_type_abo,
      cp.blood_type_rh,
      cp.component_type,
      COUNT(CASE WHEN julianday(ib.expiry_date) - julianday(?) <= 0 THEN 1 END) as expired,
      COUNT(CASE WHEN julianday(ib.expiry_date) - julianday(?) BETWEEN 1 AND 1 THEN 1 END) as warning_red,
      COUNT(CASE WHEN julianday(ib.expiry_date) - julianday(?) BETWEEN 2 AND 3 THEN 1 END) as warning_orange,
      COUNT(CASE WHEN julianday(ib.expiry_date) - julianday(?) BETWEEN 4 AND 7 THEN 1 END) as warning_yellow,
      COUNT(CASE WHEN julianday(ib.expiry_date) - julianday(?) > 7 THEN 1 END) as normal
    FROM inventory_batches ib
    JOIN component_products cp ON ib.product_id = cp.id
    WHERE ib.status = '在库'
    GROUP BY cp.blood_type_abo, cp.blood_type_rh, cp.component_type
    ORDER BY cp.blood_type_abo, cp.blood_type_rh, cp.component_type
  `).all(today, today, today, today, today);

  return stats;
}

function checkExpiryAndMark(expiryDateStr) {
  const days = daysUntilExpiry(expiryDateStr);
  return {
    days_remaining: days,
    is_expired: days <= 0,
    warning_level: getWarningLevel(days)
  };
}

module.exports = {
  scanExpiry,
  getExpiryStats,
  checkExpiryAndMark,
  daysUntilExpiry,
  getWarningLevel
};
