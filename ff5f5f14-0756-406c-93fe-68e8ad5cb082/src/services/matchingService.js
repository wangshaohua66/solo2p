const { getDb } = require('../models/db');
const logger = require('../utils/logger');

const URGENCY_PRIORITY = {
  '急诊': 100,
  '紧急': 50,
  '常规': 0
};

function calculatePriority(request) {
  let priority = URGENCY_PRIORITY[request.urgency] || 0;
  const waitingHours = (Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60);
  priority += Math.floor(waitingHours * 0.5);
  return priority;
}

function crossMatch(donorAbo, donorRh, patientAbo, patientRh) {
  let major = '相合';
  let minor = '相合';

  const aboCompatibility = {
    'A': ['A', 'AB'],
    'B': ['B', 'AB'],
    'AB': ['AB'],
    'O': ['O', 'A', 'B', 'AB']
  };

  if (!aboCompatibility[donorAbo] || !aboCompatibility[donorAbo].includes(patientAbo)) {
    major = '不相合';
  }

  if (donorRh === '+' && patientRh === '-') {
    minor = '不相合';
  }

  const final = (major === '相合' && minor === '相合') ? '配血成功' : '配血失败';

  return { major, minor, final };
}

function findMatchingInventory(requestId, limit = 100) {
  const startTime = Date.now();
  const db = getDb();

  const request = db.prepare(`
    SELECT br.*, h.name as hospital_name
    FROM blood_requests br
    JOIN hospitals h ON br.hospital_id = h.id
    WHERE br.id = ?
  `).get(requestId);

  if (!request) {
    throw new Error('用血申请不存在');
  }

  const available = db.prepare(`
    SELECT
      ib.id as inventory_id,
      ib.expiry_date,
      cp.product_code,
      cp.component_type,
      cp.blood_type_abo,
      cp.blood_type_rh,
      cp.parent_bag_id,
      bb.bag_no,
      d.name as donor_name,
      julianday(ib.expiry_date) - julianday('now') as days_remaining
    FROM inventory_batches ib
    JOIN component_products cp ON ib.product_id = cp.id
    LEFT JOIN blood_bags bb ON cp.parent_bag_id = bb.id
    LEFT JOIN donors d ON bb.donor_id = d.id
    WHERE ib.status = '在库'
      AND cp.component_type = ?
      AND (
        (cp.blood_type_abo = ? AND cp.blood_type_rh = ?)
        OR (? = 'AB' AND cp.blood_type_abo IN ('A', 'B', 'AB', 'O') AND cp.blood_type_rh = ?)
        OR (? = 'O' AND cp.blood_type_rh = ?)
      )
    ORDER BY days_remaining ASC
    LIMIT ?
  `).all(
    request.component_type,
    request.patient_blood_type_abo, request.patient_blood_type_rh,
    request.patient_blood_type_abo, request.patient_blood_type_rh,
    request.patient_blood_type_abo, request.patient_blood_type_rh,
    limit
  );

  const results = [];
  let matchedCount = 0;

  for (const item of available) {
    if (matchedCount >= request.quantity) break;

    const match = crossMatch(
      item.blood_type_abo, item.blood_type_rh,
      request.patient_blood_type_abo, request.patient_blood_type_rh
    );

    if (match.final === '配血成功') {
      results.push({
        ...item,
        match_result: match
      });
      matchedCount++;
    }
  }

  const duration = Date.now() - startTime;
  logger.info(`交叉配血: 申请${requestId} 匹配${results.length}/${request.quantity}单位 耗时${duration}ms`);

  if (duration > 200) {
    logger.warn(`交叉配血超过200ms约束: ${duration}ms`);
  }

  return {
    request,
    matched_units: results,
    matched_count: results.length,
    requested_count: request.quantity,
    is_fully_matched: results.length >= request.quantity,
    duration_ms: duration
  };
}

function saveMatchingResults(requestId, matchedUnits, userId) {
  const db = getDb();
  const tx = db.transaction(() => {
    for (const unit of matchedUnits) {
      db.prepare(`
        INSERT INTO matching_results (
          request_id, inventory_id,
          major_match_result, minor_match_result, final_result, matched_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        requestId, unit.inventory_id,
        unit.match_result.major, unit.match_result.minor, unit.match_result.final, userId
      );

      db.prepare(`
        UPDATE inventory_batches
        SET status = '已锁定', lock_reason = '配血锁定', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(unit.inventory_id);
    }

    const matched = db.prepare('SELECT COUNT(*) as cnt FROM matching_results WHERE request_id = ?').get(requestId).cnt;
    const request = db.prepare('SELECT * FROM blood_requests WHERE id = ?').get(requestId);

    let newStatus = '部分配血';
    if (matched >= request.quantity) {
      newStatus = '已配血';
    } else if (matched === 0) {
      newStatus = '待配血';
    }

    const priority = calculatePriority(request);
    db.prepare(`
      UPDATE blood_requests
      SET status = ?, priority_score = ?
      WHERE id = ?
    `).run(newStatus, priority, requestId);

    return { status: newStatus, matched, requested: request.quantity };
  });

  return tx();
}

function getPendingRequestsByPriority() {
  const db = getDb();
  return db.prepare(`
    SELECT br.*, h.name as hospital_name, h.code as hospital_code
    FROM blood_requests br
    JOIN hospitals h ON br.hospital_id = h.id
    WHERE br.status IN ('待配血', '部分配血')
    ORDER BY br.priority_score DESC, br.created_at ASC
  `).all();
}

module.exports = {
  crossMatch,
  findMatchingInventory,
  saveMatchingResults,
  calculatePriority,
  getPendingRequestsByPriority
};
