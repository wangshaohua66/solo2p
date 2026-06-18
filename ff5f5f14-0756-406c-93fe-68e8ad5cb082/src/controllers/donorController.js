const { getDb } = require('../models/db');
const logger = require('../utils/logger');

function generateDonorCardNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `D${date}${random}`;
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

async function registerDonor(req, res) {
  const db = getDb();
  const { id_card_no, name, gender, birth_date, phone, address, health_answers } = req.body;

  if (!id_card_no || !name || !gender || !birth_date) {
    return res.status(400).json({ error: '身份证号、姓名、性别、出生日期为必填项' });
  }

  const tx = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM blocklist bl JOIN donors d ON bl.donor_id = d.id WHERE d.id_card_no = ? AND bl.permanent = 1').get(id_card_no);
    if (existing) {
      throw new Error('该献血者在永久屏蔽名单中，禁止登记');
    }

    const donorCardNo = generateDonorCardNo();
    const info = db.prepare(`
      INSERT INTO donors (donor_card_no, id_card_no, name, gender, birth_date, phone, address, health_answers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(donorCardNo, id_card_no, name, gender, birth_date, phone, address, JSON.stringify(health_answers || {}));

    return db.prepare('SELECT * FROM donors WHERE id = ?').get(info.lastInsertRowid);
  });

  try {
    const donor = tx();
    logger.info(`献血者登记成功: ${donor.donor_card_no} - ${name}`);
    res.status(201).json(donor);
  } catch (err) {
    logger.error(`献血者登记失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function getDonorById(req, res) {
  const db = getDb();
  const { id } = req.params;
  const donor = db.prepare('SELECT * FROM donors WHERE id = ? OR donor_card_no = ? OR id_card_no = ?').get(id, id, id);
  if (!donor) {
    return res.status(404).json({ error: '献血者不存在' });
  }

  const block = db.prepare('SELECT * FROM blocklist WHERE donor_id = ? ORDER BY blocked_at DESC LIMIT 1').get(donor.id);
  const history = db.prepare(`
    SELECT bb.*, ds.result as screening_result
    FROM blood_bags bb
    LEFT JOIN donor_screenings ds ON bb.screening_id = ds.id
    WHERE bb.donor_id = ?
    ORDER BY bb.collection_date DESC
  `).all(donor.id);

  donor.is_blocked = !!block;
  donor.block_reason = block ? block.reason : null;
  donor.donation_history = history;
  donor.health_answers = donor.health_answers ? JSON.parse(donor.health_answers) : null;

  res.json(donor);
}

async function createScreening(req, res) {
  const db = getDb();
  const { donor_id, hemoglobin, alt, hbsag, anti_hcv, anti_hiv, syphilis, blood_type_abo, blood_type_rh, screening_date } = req.body;

  if (!donor_id) {
    return res.status(400).json({ error: '献血者ID为必填项' });
  }

  const tx = db.transaction(() => {
    const donor = db.prepare('SELECT * FROM donors WHERE id = ?').get(donor_id);
    if (!donor) throw new Error('献血者不存在');

    const blocked = db.prepare('SELECT * FROM blocklist WHERE donor_id = ? AND permanent = 1').get(donor_id);
    if (blocked) throw new Error('该献血者在永久屏蔽名单中');

    if (donor.last_donation_date) {
      const interval = daysBetween(donor.last_donation_date, screening_date || new Date().toISOString().slice(0, 10));
      if (interval < 180) {
        throw new Error(`献血间隔期不足，上次献血距今${interval}天，需满180天`);
      }
    }

    let result = '合格';
    if (hemoglobin && hemoglobin < 120) result = '不合格';
    if (alt && alt > 40) result = '不合格';
    if (hbsag === '阳性' || anti_hcv === '阳性' || anti_hiv === '阳性' || syphilis === '阳性') {
      result = '不合格';
    }

    const info = db.prepare(`
      INSERT INTO donor_screenings (donor_id, screening_date, hemoglobin, alt, hbsag, anti_hcv, anti_hiv, syphilis, blood_type_abo, blood_type_rh, result, performed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      donor_id,
      screening_date || new Date().toISOString().slice(0, 10),
      hemoglobin, alt, hbsag, anti_hcv, anti_hiv, syphilis,
      blood_type_abo, blood_type_rh, result, req.user.id
    );

    if (result === '合格' && blood_type_abo && blood_type_rh) {
      db.prepare('UPDATE donors SET blood_type_abo = ?, blood_type_rh = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(blood_type_abo, blood_type_rh, donor_id);
    }

    if (result === '不合格' && (hbsag === '阳性' || anti_hiv === '阳性' || syphilis === '阳性')) {
      db.prepare(`
        INSERT INTO blocklist (donor_id, reason, permanent, blocked_by)
        VALUES (?, ?, 1, ?)
      `).run(donor_id, `初筛传染病阳性: ${[hbsag && 'HBsAg', anti_hiv && 'HIV', syphilis && '梅毒'].filter(Boolean).join(',')}`, req.user.id);
    }

    return db.prepare('SELECT * FROM donor_screenings WHERE id = ?').get(info.lastInsertRowid);
  });

  try {
    const screening = tx();
    logger.info(`初筛记录创建: 献血者${donor_id} 结果: ${screening.result}`);
    res.status(201).json(screening);
  } catch (err) {
    logger.error(`初筛创建失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function createBloodBag(req, res) {
  const db = getDb();
  const { donor_id, screening_id, collection_date, collection_site, volume } = req.body;

  if (!donor_id || !screening_id) {
    return res.status(400).json({ error: '献血者ID和初筛ID为必填项' });
  }

  const tx = db.transaction(() => {
    const screening = db.prepare('SELECT * FROM donor_screenings WHERE id = ?').get(screening_id);
    if (!screening) throw new Error('初筛记录不存在');
    if (screening.result !== '合格') throw new Error('初筛不合格，无法采血');

    const bagNo = `B${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    const info = db.prepare(`
      INSERT INTO blood_bags (bag_no, donor_id, screening_id, collection_date, collection_site, volume, collected_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      bagNo, donor_id, screening_id,
      collection_date || new Date().toISOString().slice(0, 10),
      collection_site || '中心采血点',
      volume || 200,
      req.user.id
    );

    db.prepare('UPDATE donors SET donation_count = donation_count + 1, last_donation_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(collection_date || new Date().toISOString().slice(0, 10), donor_id);

    return db.prepare('SELECT * FROM blood_bags WHERE id = ?').get(info.lastInsertRowid);
  });

  try {
    const bag = tx();
    logger.info(`采血袋登记: ${bag.bag_no} 献血者: ${donor_id}`);
    res.status(201).json(bag);
  } catch (err) {
    logger.error(`采血袋登记失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function addToBlocklist(req, res) {
  const db = getDb();
  const { donor_id, reason, permanent, expires_at } = req.body;

  if (!donor_id || !reason) {
    return res.status(400).json({ error: '献血者ID和屏蔽原因为必填项' });
  }

  try {
    const info = db.prepare(`
      INSERT INTO blocklist (donor_id, reason, permanent, blocked_by, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(donor_id, reason, permanent !== undefined ? permanent : 1, req.user.id, expires_at);

    logger.warn(`献血者${donor_id}加入屏蔽名单，原因: ${reason}`);
    res.status(201).json(db.prepare('SELECT * FROM blocklist WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    logger.error(`添加屏蔽名单失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

async function getBlocklist(req, res) {
  const db = getDb();
  const list = db.prepare(`
    SELECT bl.*, d.name, d.id_card_no, d.donor_card_no, u.full_name as blocked_by_name
    FROM blocklist bl
    JOIN donors d ON bl.donor_id = d.id
    JOIN users u ON bl.blocked_by = u.id
    ORDER BY bl.blocked_at DESC
  `).all();
  res.json(list);
}

async function searchDonors(req, res) {
  const db = getDb();
  const { name, id_card_no, donor_card_no, blood_type_abo, blood_type_rh, page = 1, page_size = 20 } = req.query;

  let sql = 'SELECT * FROM donors WHERE 1=1';
  const params = [];

  if (name) { sql += ' AND name LIKE ?'; params.push(`%${name}%`); }
  if (id_card_no) { sql += ' AND id_card_no LIKE ?'; params.push(`%${id_card_no}%`); }
  if (donor_card_no) { sql += ' AND donor_card_no LIKE ?'; params.push(`%${donor_card_no}%`); }
  if (blood_type_abo) { sql += ' AND blood_type_abo = ?'; params.push(blood_type_abo); }
  if (blood_type_rh) { sql += ' AND blood_type_rh = ?'; params.push(blood_type_rh); }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));

  const items = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM donors WHERE 1=1').get().cnt;

  res.json({ items, total, page: parseInt(page), page_size: parseInt(page_size) });
}

module.exports = {
  registerDonor,
  getDonorById,
  createScreening,
  createBloodBag,
  addToBlocklist,
  getBlocklist,
  searchDonors
};
