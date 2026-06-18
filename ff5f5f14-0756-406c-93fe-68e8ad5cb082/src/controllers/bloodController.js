const { getDb } = require('../models/db');
const logger = require('../utils/logger');

const COMPONENT_SHELF_LIFE = {
  '红细胞悬液': 35,
  '新鲜冰冻血浆': 365,
  '冷沉淀': 365,
  '血小板': 5,
  '全血': 35
};

async function createTestRecord(req, res) {
  const db = getDb();
  const { bag_id, test_batch_no, test_date, hbsag, anti_hcv, anti_hiv, syphilis } = req.body;

  if (!bag_id || !test_batch_no) {
    return res.status(400).json({ error: '采血袋ID和检验批次号为必填项' });
  }

  const tx = db.transaction(() => {
    const bag = db.prepare('SELECT * FROM blood_bags WHERE id = ?').get(bag_id);
    if (!bag) throw new Error('采血袋不存在');
    if (bag.status !== '待检测') throw new Error('采血袋状态不是待检测');

    let result = '合格';
    if (hbsag === '阳性' || anti_hcv === '阳性' || anti_hiv === '阳性' || syphilis === '阳性') {
      result = '不合格';
    }

    const info = db.prepare(`
      INSERT INTO test_records (bag_id, test_batch_no, test_date, hbsag, anti_hcv, anti_hiv, syphilis, result, tested_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bag_id, test_batch_no, test_date || new Date().toISOString().slice(0, 10),
      hbsag, anti_hcv, anti_hiv, syphilis, result, req.user.id
    );

    const newStatus = result === '合格' ? '检测合格' : '检测不合格';
    db.prepare('UPDATE blood_bags SET status = ? WHERE id = ?').run(newStatus, bag_id);

    if (result === '不合格') {
      db.prepare(`
        INSERT INTO blocklist (donor_id, reason, permanent, blocked_by)
        VALUES (?, ?, 1, ?)
      `).run(bag.donor_id, `ELISA检测阳性，批次:${test_batch_no}`, req.user.id);
    }

    return {
      test: db.prepare('SELECT * FROM test_records WHERE id = ?').get(info.lastInsertRowid),
      bag: db.prepare('SELECT * FROM blood_bags WHERE id = ?').get(bag_id)
    };
  });

  try {
    const result = tx();
    logger.info(`检验记录创建: 采血袋${bag_id} 批次:${test_batch_no} 结果:${result.test.result}`);
    res.status(201).json(result);
  } catch (err) {
    logger.error(`检验记录创建失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function createComponentProducts(req, res) {
  const db = getDb();
  const { parent_bag_id, components, preparation_date, preparation_batch_no } = req.body;

  if (!parent_bag_id || !components || !Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ error: '母血袋ID和成分为必填项' });
  }

  const tx = db.transaction(() => {
    const parentBag = db.prepare(`
      SELECT bb.*, d.blood_type_abo, d.blood_type_rh
      FROM blood_bags bb
      JOIN donors d ON bb.donor_id = d.id
      WHERE bb.id = ?
    `).get(parent_bag_id);

    if (!parentBag) throw new Error('母血袋不存在');
    if (parentBag.status !== '检测合格') throw new Error('母血袋未检测合格');

    const prepDate = preparation_date || new Date().toISOString().slice(0, 10);
    const batchNo = preparation_batch_no || `PREP${Date.now()}`;
    const products = [];

    for (const comp of components) {
      const { component_type, volume } = comp;
      if (!COMPONENT_SHELF_LIFE[component_type]) {
        throw new Error(`未知成分类型: ${component_type}`);
      }

      const expiryDate = new Date(prepDate);
      expiryDate.setDate(expiryDate.getDate() + COMPONENT_SHELF_LIFE[component_type]);
      const expiryStr = expiryDate.toISOString().slice(0, 10);

      const productCode = `P${comp.type || component_type.slice(0, 2).toUpperCase()}${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const productInfo = db.prepare(`
        INSERT INTO component_products (
          product_code, parent_bag_id, component_type, blood_type_abo, blood_type_rh,
          volume, preparation_date, expiry_date, preparation_batch_no, prepared_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productCode, parent_bag_id, component_type,
        parentBag.blood_type_abo, parentBag.blood_type_rh,
        volume || 200, prepDate, expiryStr, batchNo, req.user.id
      );

      const product = db.prepare('SELECT * FROM component_products WHERE id = ?').get(productInfo.lastInsertRowid);

      db.prepare(`
        INSERT INTO inventory_batches (product_id, status, expiry_date)
        VALUES (?, '在库', ?)
      `).run(product.id, expiryStr);

      products.push(product);
    }

    db.prepare('UPDATE blood_bags SET status = ? WHERE id = ?').run('已制备', parent_bag_id);

    return { products, batch_no: batchNo };
  });

  try {
    const result = tx();
    logger.info(`成分制备完成: 母血袋${parent_bag_id} 产品数:${result.products.length}`);
    res.status(201).json(result);
  } catch (err) {
    logger.error(`成分制备失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function getTestRecords(req, res) {
  const db = getDb();
  const { bag_id, test_batch_no, page = 1, page_size = 20 } = req.query;

  let sql = `
    SELECT tr.*, bb.bag_no, u.full_name as tested_by_name
    FROM test_records tr
    JOIN blood_bags bb ON tr.bag_id = bb.id
    JOIN users u ON tr.tested_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (bag_id) { sql += ' AND tr.bag_id = ?'; params.push(bag_id); }
  if (test_batch_no) { sql += ' AND tr.test_batch_no = ?'; params.push(test_batch_no); }

  sql += ' ORDER BY tr.test_date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));

  const items = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM test_records').get().cnt;

  res.json({ items, total, page: parseInt(page), page_size: parseInt(page_size) });
}

async function getComponentProducts(req, res) {
  const db = getDb();
  const { parent_bag_id, component_type, blood_type_abo, blood_type_rh, page = 1, page_size = 20 } = req.query;

  let sql = `
    SELECT cp.*, bb.bag_no, u.full_name as prepared_by_name
    FROM component_products cp
    LEFT JOIN blood_bags bb ON cp.parent_bag_id = bb.id
    JOIN users u ON cp.prepared_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (parent_bag_id) { sql += ' AND cp.parent_bag_id = ?'; params.push(parent_bag_id); }
  if (component_type) { sql += ' AND cp.component_type = ?'; params.push(component_type); }
  if (blood_type_abo) { sql += ' AND cp.blood_type_abo = ?'; params.push(blood_type_abo); }
  if (blood_type_rh) { sql += ' AND cp.blood_type_rh = ?'; params.push(blood_type_rh); }

  sql += ' ORDER BY cp.preparation_date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));

  const items = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM component_products').get().cnt;

  res.json({ items, total, page: parseInt(page), page_size: parseInt(page_size) });
}

async function getBloodBags(req, res) {
  const db = getDb();
  const { status, donor_id, page = 1, page_size = 20 } = req.query;

  let sql = `
    SELECT bb.*, d.name, d.donor_card_no, u.full_name as collected_by_name
    FROM blood_bags bb
    JOIN donors d ON bb.donor_id = d.id
    JOIN users u ON bb.collected_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status) { sql += ' AND bb.status = ?'; params.push(status); }
  if (donor_id) { sql += ' AND bb.donor_id = ?'; params.push(donor_id); }

  sql += ' ORDER BY bb.collection_date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));

  const items = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM blood_bags').get().cnt;

  res.json({ items, total, page: parseInt(page), page_size: parseInt(page_size) });
}

module.exports = {
  createTestRecord,
  createComponentProducts,
  getTestRecords,
  getComponentProducts,
  getBloodBags
};
