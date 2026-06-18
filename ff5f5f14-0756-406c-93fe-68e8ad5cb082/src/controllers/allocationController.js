const { getDb } = require('../models/db');
const logger = require('../utils/logger');
const matchingService = require('../services/matchingService');

function generateRequestNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REQ${date}${random}`;
}

async function createBloodRequest(req, res) {
  const db = getDb();
  const {
    hospital_id, patient_name, patient_gender, patient_age,
    patient_blood_type_abo, patient_blood_type_rh,
    component_type, quantity, urgency, clinical_diagnosis, cross_match_required
  } = req.body;

  if (!hospital_id || !patient_blood_type_abo || !patient_blood_type_rh || !component_type || !quantity || !urgency) {
    return res.status(400).json({ error: '医院ID、患者血型、成分类型、数量、紧急程度为必填项' });
  }

  const tx = db.transaction(() => {
    const requestNo = generateRequestNo();
    const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(hospital_id);
    if (!hospital) {
      throw new Error('医院不存在');
    }

    const priority = urgency === '急诊' ? 100 : urgency === '紧急' ? 50 : 0;

    const info = db.prepare(`
      INSERT INTO blood_requests (
        request_no, hospital_id, patient_name, patient_gender, patient_age,
        patient_blood_type_abo, patient_blood_type_rh, component_type, quantity,
        urgency, clinical_diagnosis, cross_match_required, priority_score, requested_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestNo, hospital_id, patient_name, patient_gender, patient_age,
      patient_blood_type_abo, patient_blood_type_rh,
      component_type, quantity, urgency, clinical_diagnosis,
      cross_match_required !== undefined ? cross_match_required : 1,
      priority, req.user ? req.user.id : null
    );

    return db.prepare(`
      SELECT br.*, h.name as hospital_name, h.code as hospital_code
      FROM blood_requests br
      JOIN hospitals h ON br.hospital_id = h.id
      WHERE br.id = ?
    `).get(info.lastInsertRowid);
  });

  try {
    const request = tx();
    logger.info(`用血申请创建: ${request.request_no} 医院:${hospital_id} 血型:${patient_blood_type_abo}${patient_blood_type_rh} 数量:${quantity} 紧急程度:${urgency}`);
    res.status(201).json(request);
  } catch (err) {
    logger.error(`用血申请创建失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function performCrossMatch(req, res) {
  const { request_id } = req.params;

  try {
    const matchResult = matchingService.findMatchingInventory(request_id);

    if (matchResult.matched_units.length > 0) {
      matchingService.saveMatchingResults(request_id, matchResult.matched_units, req.user ? req.user.id : null);
    }

    const db = getDb();
    const updatedRequest = db.prepare(`
      SELECT br.*, h.name as hospital_name
      FROM blood_requests br
      JOIN hospitals h ON br.hospital_id = h.id
      WHERE br.id = ?
    `).get(request_id);

    const matchResults = db.prepare(`
      SELECT mr.*,
        ib.id as inventory_id,
        cp.product_code,
        cp.component_type,
        cp.blood_type_abo,
        cp.blood_type_rh,
        cp.expiry_date
      FROM matching_results mr
      JOIN inventory_batches ib ON mr.inventory_id = ib.id
      JOIN component_products cp ON ib.product_id = cp.id
      WHERE mr.request_id = ?
    `).all(request_id);

    res.json({
      request: updatedRequest,
      matching: matchResult,
      matched_units: matchResults
    });
  } catch (err) {
    logger.error(`交叉配血失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function getBloodRequests(req, res) {
  const db = getDb();
  const { hospital_id, status, urgency, page = 1, page_size = 20 } = req.query;

  let sql = `
    SELECT br.*, h.name as hospital_name, h.code as hospital_code
    FROM blood_requests br
    JOIN hospitals h ON br.hospital_id = h.id
    WHERE 1=1
  `;
  const params = [];

  if (hospital_id) { sql += ' AND br.hospital_id = ?'; params.push(hospital_id); }
  if (status) { sql += ' AND br.status = ?'; params.push(status); }
  if (urgency) { sql += ' AND br.urgency = ?'; params.push(urgency); }

  const countSql = sql.replace('SELECT br.*,', 'SELECT COUNT(*) as cnt FROM blood_requests br JOIN hospitals h ON br.hospital_id = h.id WHERE 1=1 ');
  const total = db.prepare(countSql).get(...params).cnt;

  sql += ` ORDER BY br.priority_score DESC, br.created_at ASC LIMIT ? OFFSET ?`;
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));

  const items = db.prepare(sql).all(...params);

  res.json({ items, total, page: parseInt(page), page_size: parseInt(page_size) });
}

async function getBloodRequestById(req, res) {
  const db = getDb();
  const { id } = req.params;

  const request = db.prepare(`
    SELECT br.*, h.name as hospital_name, h.code as hospital_code, h.address, h.contact_person, h.contact_phone
    FROM blood_requests br
    JOIN hospitals h ON br.hospital_id = h.id
    WHERE br.id = ?
  `).get(id);

  if (!request) {
    return res.status(404).json({ error: '用血申请不存在' });
  }

  const matchResults = db.prepare(`
    SELECT mr.*,
      ib.id as inventory_id,
      cp.product_code,
      cp.component_type,
      cp.blood_type_abo,
      cp.blood_type_rh,
      cp.expiry_date,
      bb.bag_no,
      d.name as donor_name
    FROM matching_results mr
    JOIN inventory_batches ib ON mr.inventory_id = ib.id
    JOIN component_products cp ON ib.product_id = cp.id
    LEFT JOIN blood_bags bb ON cp.parent_bag_id = bb.id
    LEFT JOIN donors d ON bb.donor_id = d.id
    WHERE mr.request_id = ?
  `).all(id);

  const delivery = db.prepare(`
    SELECT dt.*, dc.arrival_temperature, dc.arrival_time, dc.received_by
    FROM delivery_tasks dt
    LEFT JOIN delivery_confirmations dc ON dt.id = dc.delivery_task_id
    WHERE dt.request_id = ?
    ORDER BY dt.created_at DESC
    LIMIT 1
  `).get(id);

  request.matching_results = matchResults;
  request.delivery = delivery || null;

  res.json(request);
}

async function createDeliveryTask(req, res) {
  const db = getDb();
  const { request_id, cooler_box_no, temperature_logger_no, departure_temperature } = req.body;

  if (!request_id || !cooler_box_no) {
    return res.status(400).json({ error: '申请ID和冷藏箱编号为必填项' });
  }

  const tx = db.transaction(() => {
    const request = db.prepare('SELECT * FROM blood_requests WHERE id = ?').get(request_id);
    if (!request) throw new Error('用血申请不存在');
    if (request.status !== '已配血') throw new Error('申请状态不是已配血，无法创建配送');

    const taskNo = `DEL${Date.now()}`;
    const now = new Date().toISOString();
    const estimated = new Date();
    estimated.setHours(estimated.getHours() + 2);

    const info = db.prepare(`
      INSERT INTO delivery_tasks (
        task_no, request_id, cooler_box_no, temperature_logger_no,
        departure_temperature, departure_time, estimated_arrival,
        dispatcher_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskNo, request_id, cooler_box_no, temperature_logger_no,
      departure_temperature, now, estimated.toISOString(),
      req.user.id, '运输中'
    );

    db.prepare(`
      UPDATE blood_requests SET status = '配送中' WHERE id = ?
    `).run(request_id);

    return db.prepare(`
      SELECT dt.*, br.request_no, h.name as hospital_name
      FROM delivery_tasks dt
      JOIN blood_requests br ON dt.request_id = br.id
      JOIN hospitals h ON br.hospital_id = h.id
      WHERE dt.id = ?
    `).get(info.lastInsertRowid);
  });

  try {
    const task = tx();
    logger.info(`配送任务创建: ${task.task_no} 申请:${request_id} 冷藏箱:${cooler_box_no}`);
    res.status(201).json(task);
  } catch (err) {
    logger.error(`配送任务创建失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function confirmDelivery(req, res) {
  const db = getDb();
  const { delivery_task_id, arrival_temperature, received_by, remarks } = req.body;

  if (!delivery_task_id || !arrival_temperature || !received_by) {
    return res.status(400).json({ error: '配送任务ID、送达温度、接收人为必填项' });
  }

  const tx = db.transaction(() => {
    const task = db.prepare('SELECT * FROM delivery_tasks WHERE id = ?').get(delivery_task_id);
    if (!task) throw new Error('配送任务不存在');
    if (task.status !== '运输中') throw new Error('配送状态不是运输中');

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO delivery_confirmations (
        delivery_task_id, arrival_temperature, arrival_time, received_by, remarks
      ) VALUES (?, ?, ?, ?, ?)
    `).run(delivery_task_id, arrival_temperature, now, received_by, remarks);

    db.prepare(`
      UPDATE delivery_tasks
      SET status = '已签收', arrival_temperature = ?
      WHERE id = ?
    `).run(arrival_temperature, delivery_task_id);

    db.prepare(`
      UPDATE blood_requests
      SET status = '已完成'
      WHERE id = ?
    `).run(task.request_id);

    const matched = db.prepare(`
      SELECT inventory_id FROM matching_results WHERE request_id = ?
    `).all(task.request_id);

    for (const m of matched) {
      db.prepare(`
        UPDATE inventory_batches
        SET status = '已出库', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(m.inventory_id);
    }

    return db.prepare(`
      SELECT dc.*, dt.task_no, dt.request_id, br.request_no, h.name as hospital_name
      FROM delivery_confirmations dc
      JOIN delivery_tasks dt ON dc.delivery_task_id = dt.id
      JOIN blood_requests br ON dt.request_id = br.id
      JOIN hospitals h ON br.hospital_id = h.id
      WHERE dc.id = last_insert_rowid()
    `).get();
  });

  try {
    const confirmation = tx();
    logger.info(`配送确认: 任务${delivery_task_id} 温度:${arrival_temperature}℃ 接收人:${received_by}`);
    res.status(201).json(confirmation);
  } catch (err) {
    logger.error(`配送确认失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function getDeliveryTasks(req, res) {
  const db = getDb();
  const { status, request_id, page = 1, page_size = 20 } = req.query;

  let sql = `
    SELECT dt.*, br.request_no, h.name as hospital_name
    FROM delivery_tasks dt
    JOIN blood_requests br ON dt.request_id = br.id
    JOIN hospitals h ON br.hospital_id = h.id
    WHERE 1=1
  `;
  const params = [];

  if (status) { sql += ' AND dt.status = ?'; params.push(status); }
  if (request_id) { sql += ' AND dt.request_id = ?'; params.push(request_id); }

  const countSql = sql.replace('SELECT dt.*,', 'SELECT COUNT(*) as cnt FROM delivery_tasks dt JOIN blood_requests br ON dt.request_id = br.id JOIN hospitals h ON br.hospital_id = h.id WHERE 1=1 ');
  const total = db.prepare(countSql).get(...params).cnt;

  sql += ` ORDER BY dt.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));

  const items = db.prepare(sql).all(...params);

  res.json({ items, total, page: parseInt(page), page_size: parseInt(page_size) });
}

async function getHospitals(req, res) {
  const db = getDb();
  const hospitals = db.prepare('SELECT * FROM hospitals ORDER BY name').all();
  res.json(hospitals);
}

async function updateRequestStatus(req, res) {
  const db = getDb();
  const { id, status } = req.body;

  try {
    db.prepare('UPDATE blood_requests SET status = ? WHERE id = ?').run(status, id);
    const updated = db.prepare(`
      SELECT br.*, h.name as hospital_name
      FROM blood_requests br
      JOIN hospitals h ON br.hospital_id = h.id
      WHERE br.id = ?
    `).get(id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  createBloodRequest,
  performCrossMatch,
  getBloodRequests,
  getBloodRequestById,
  createDeliveryTask,
  confirmDelivery,
  getDeliveryTasks,
  getHospitals,
  updateRequestStatus
};
