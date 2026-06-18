const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'blood_center.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('page_size = 8192');
db.pragma('cache_size = 10000');

function initDatabase() {
  const migrationStart = Date.now();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('nurse','technician','preparator','inventory','dispatcher','hospital')),
      full_name TEXT NOT NULL,
      hospital_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      contact_person TEXT,
      contact_phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS donors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_card_no TEXT UNIQUE NOT NULL,
      id_card_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      gender TEXT NOT NULL CHECK(gender IN ('男','女')),
      birth_date TEXT NOT NULL,
      blood_type_abo TEXT CHECK(blood_type_abo IN ('A','B','AB','O')),
      blood_type_rh TEXT CHECK(blood_type_rh IN ('+','-')),
      phone TEXT,
      address TEXT,
      donation_count INTEGER DEFAULT 0,
      last_donation_date TEXT,
      health_answers TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blocklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      permanent INTEGER DEFAULT 1,
      blocked_by INTEGER NOT NULL,
      blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      FOREIGN KEY (donor_id) REFERENCES donors(id),
      FOREIGN KEY (blocked_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS donor_screenings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL,
      screening_date TEXT NOT NULL,
      hemoglobin REAL,
      alt INTEGER,
      hbsag TEXT,
      anti_hcv TEXT,
      anti_hiv TEXT,
      syphilis TEXT,
      blood_type_abo TEXT,
      blood_type_rh TEXT,
      result TEXT CHECK(result IN ('合格','不合格')),
      performed_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES donors(id),
      FOREIGN KEY (performed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS blood_bags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bag_no TEXT UNIQUE NOT NULL,
      donor_id INTEGER NOT NULL,
      screening_id INTEGER,
      collection_date TEXT NOT NULL,
      collection_site TEXT,
      volume REAL DEFAULT 200,
      status TEXT DEFAULT '待检测' CHECK(status IN ('待检测','检测合格','检测不合格','已制备','报废')),
      collected_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES donors(id),
      FOREIGN KEY (screening_id) REFERENCES donor_screenings(id),
      FOREIGN KEY (collected_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS test_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bag_id INTEGER NOT NULL,
      test_batch_no TEXT NOT NULL,
      test_date TEXT NOT NULL,
      hbsag TEXT,
      anti_hcv TEXT,
      anti_hiv TEXT,
      syphilis TEXT,
      result TEXT CHECK(result IN ('合格','不合格')),
      tested_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bag_id) REFERENCES blood_bags(id),
      FOREIGN KEY (tested_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS component_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE NOT NULL,
      parent_bag_id INTEGER,
      component_type TEXT NOT NULL,
      blood_type_abo TEXT NOT NULL,
      blood_type_rh TEXT NOT NULL,
      volume REAL,
      preparation_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      preparation_batch_no TEXT,
      prepared_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_bag_id) REFERENCES blood_bags(id),
      FOREIGN KEY (prepared_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      storage_location TEXT,
      status TEXT DEFAULT '在库' CHECK(status IN ('在库','已锁定','已出库','报废')),
      expiry_date TEXT NOT NULL,
      expiry_warning_level TEXT,
      lock_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES component_products(id)
    );

    CREATE TABLE IF NOT EXISTS blood_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_no TEXT UNIQUE NOT NULL,
      hospital_id INTEGER NOT NULL,
      patient_name TEXT,
      patient_gender TEXT,
      patient_age INTEGER,
      patient_blood_type_abo TEXT,
      patient_blood_type_rh TEXT,
      component_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      urgency TEXT NOT NULL CHECK(urgency IN ('常规','紧急','急诊')),
      clinical_diagnosis TEXT,
      cross_match_required INTEGER DEFAULT 1,
      status TEXT DEFAULT '待配血' CHECK(status IN ('待配血','已配血','部分配血','配送中','已完成','已取消')),
      priority_score INTEGER DEFAULT 0,
      requested_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS matching_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      major_match_result TEXT CHECK(major_match_result IN ('相合','不相合')),
      minor_match_result TEXT CHECK(minor_match_result IN ('相合','不相合')),
      final_result TEXT CHECK(final_result IN ('配血成功','配血失败')),
      matched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      matched_by INTEGER,
      FOREIGN KEY (request_id) REFERENCES blood_requests(id),
      FOREIGN KEY (inventory_id) REFERENCES inventory_batches(id)
    );

    CREATE TABLE IF NOT EXISTS delivery_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_no TEXT UNIQUE NOT NULL,
      request_id INTEGER NOT NULL,
      cooler_box_no TEXT NOT NULL,
      temperature_logger_no TEXT,
      departure_temperature REAL,
      departure_time TEXT,
      estimated_arrival TEXT,
      dispatcher_id INTEGER NOT NULL,
      status TEXT DEFAULT '待发车' CHECK(status IN ('待发车','运输中','已送达','已签收')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES blood_requests(id),
      FOREIGN KEY (dispatcher_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS delivery_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_task_id INTEGER NOT NULL,
      arrival_temperature REAL,
      arrival_time TEXT NOT NULL,
      received_by TEXT NOT NULL,
      receiver_signature TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_task_id) REFERENCES delivery_tasks(id)
    );

    CREATE TABLE IF NOT EXISTS safety_stock_thresholds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blood_type_abo TEXT NOT NULL,
      blood_type_rh TEXT NOT NULL,
      component_type TEXT NOT NULL,
      min_quantity INTEGER DEFAULT 10,
      warning_quantity INTEGER DEFAULT 20,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(blood_type_abo, blood_type_rh, component_type)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_donors_card_no ON donors(donor_card_no);
    CREATE INDEX IF NOT EXISTS idx_donors_id_card ON donors(id_card_no);
    CREATE INDEX IF NOT EXISTS idx_donors_blood_type ON donors(blood_type_abo, blood_type_rh);
    CREATE INDEX IF NOT EXISTS idx_blocklist_donor ON blocklist(donor_id);
    CREATE INDEX IF NOT EXISTS idx_screenings_donor ON donor_screenings(donor_id);
    CREATE INDEX IF NOT EXISTS idx_screenings_date ON donor_screenings(screening_date);
    CREATE INDEX IF NOT EXISTS idx_blood_bags_donor ON blood_bags(donor_id);
    CREATE INDEX IF NOT EXISTS idx_blood_bags_status ON blood_bags(status);
    CREATE INDEX IF NOT EXISTS idx_blood_bags_date ON blood_bags(collection_date);
    CREATE INDEX IF NOT EXISTS idx_test_records_bag ON test_records(bag_id);
    CREATE INDEX IF NOT EXISTS idx_test_records_batch ON test_records(test_batch_no);
    CREATE INDEX IF NOT EXISTS idx_products_parent ON component_products(parent_bag_id);
    CREATE INDEX IF NOT EXISTS idx_products_type ON component_products(component_type, blood_type_abo, blood_type_rh);
    CREATE INDEX IF NOT EXISTS idx_products_expiry ON component_products(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_batches(product_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_batches(status);
    CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory_batches(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_requests_hospital ON blood_requests(hospital_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON blood_requests(status);
    CREATE INDEX IF NOT EXISTS idx_requests_priority ON blood_requests(priority_score DESC, created_at);
    CREATE INDEX IF NOT EXISTS idx_matching_request ON matching_results(request_id);
    CREATE INDEX IF NOT EXISTS idx_matching_inventory ON matching_results(inventory_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_request ON delivery_tasks(request_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_confirmation_task ON delivery_confirmations(delivery_task_id);
  `);

  insertSeedData();

  logger.info(`数据库初始化完成，耗时: ${Date.now() - migrationStart}ms`);
}

function insertSeedData() {
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  if (userCount === 0) {
    const hospitalStmt = db.prepare(`INSERT INTO hospitals (code, name, address, contact_person, contact_phone) VALUES (?, ?, ?, ?, ?)`);
    for (let i = 1; i <= 18; i++) {
      hospitalStmt.run(`HOS${String(i).padStart(3, '0')}`, `辖区第${i}人民医院`, `城市路${i * 100}号`, `联系人${i}`, `1380000${String(i).padStart(4, '0')}`);
    }

    const userStmt = db.prepare(`INSERT INTO users (username, password_hash, role, full_name, hospital_id) VALUES (?, ?, ?, ?, ?)`);
    userStmt.run('nurse01', 'hash1', 'nurse', '采血护士甲', null);
    userStmt.run('tech01', 'hash2', 'technician', '检验技师甲', null);
    userStmt.run('prep01', 'hash3', 'preparator', '成分制备员甲', null);
    userStmt.run('inv01', 'hash4', 'inventory', '库存管理员甲', null);
    userStmt.run('disp01', 'hash5', 'dispatcher', '配送调度员甲', null);
    userStmt.run('hosp01', 'hash6', 'hospital', '医院输血科甲', 1);

    const thresholdStmt = db.prepare(`INSERT INTO safety_stock_thresholds (blood_type_abo, blood_type_rh, component_type, min_quantity, warning_quantity) VALUES (?, ?, ?, ?, ?)`);
    const aboTypes = ['A', 'B', 'AB', 'O'];
    const rhTypes = ['+', '-'];
    const componentTypes = ['红细胞悬液', '新鲜冰冻血浆', '冷沉淀', '血小板'];
    for (const abo of aboTypes) {
      for (const rh of rhTypes) {
        for (const comp of componentTypes) {
          thresholdStmt.run(abo, rh, comp, 10, 30);
        }
      }
    }
    logger.info('种子数据插入完成');
  }
}

function getDb() {
  return db;
}

module.exports = {
  initDatabase,
  getDb
};
