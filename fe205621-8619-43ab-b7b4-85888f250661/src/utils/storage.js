const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { SYSTEM_CONFIG } = require('../../config/hospitals');
const { createLogger } = require('./logger');

const logger = createLogger('Storage');

class Storage {
  constructor(dbPath) {
    this.dbPath = dbPath || SYSTEM_CONFIG.databasePath;
    this.db = null;
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;

    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error(`数据库连接失败: ${err.message}`);
          reject(err);
        } else {
          logger.info(`数据库连接成功: ${this.dbPath}`);
          this._createTables()
            .then(() => {
              this._initialized = true;
              resolve();
            })
            .catch(reject);
        }
      });
    });
  }

  async _createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        wechat_id TEXT,
        id_card TEXT,
        departments TEXT,
        expert_level INTEGER,
        time_preference TEXT,
        hospital_preference TEXT,
        priority INTEGER DEFAULT 5,
        status TEXT DEFAULT 'active',
        created_at TEXT,
        updated_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        hospital_id TEXT NOT NULL,
        hospital_name TEXT,
        department TEXT NOT NULL,
        department_name TEXT,
        doctor_id TEXT,
        doctor_name TEXT,
        expert_level INTEGER,
        appointment_date TEXT NOT NULL,
        time_slot TEXT,
        available_count INTEGER DEFAULT 0,
        total_count INTEGER DEFAULT 0,
        fee REAL,
        raw_data TEXT,
        source_url TEXT,
        crawl_time TEXT,
        created_at TEXT,
        UNIQUE(hospital_id, department, doctor_id, appointment_date, time_slot)
      )`,
      `CREATE TABLE IF NOT EXISTS booking_records (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        appointment_id TEXT,
        hospital_id TEXT,
        hospital_name TEXT,
        department TEXT,
        doctor_name TEXT,
        appointment_date TEXT,
        time_slot TEXT,
        status TEXT DEFAULT 'pending',
        notify_channels TEXT,
        confirm_time TEXT,
        booking_time TEXT,
        result TEXT,
        created_at TEXT,
        updated_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS crawl_logs (
        id TEXT PRIMARY KEY,
        hospital_id TEXT,
        hospital_name TEXT,
        department TEXT,
        status TEXT,
        duration_ms INTEGER,
        error_message TEXT,
        appointments_count INTEGER,
        created_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS notification_logs (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        patient_name TEXT,
        channel TEXT,
        appointment_id TEXT,
        hospital_name TEXT,
        department TEXT,
        doctor_name TEXT,
        appointment_date TEXT,
        status TEXT,
        error_message TEXT,
        created_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS statistics (
        id TEXT PRIMARY KEY,
        stat_date TEXT,
        hospital_id TEXT,
        department TEXT,
        total_appointments INTEGER,
        booked_appointments INTEGER,
        peak_hour TEXT,
        avg_wait_time INTEGER,
        created_at TEXT,
        UNIQUE(stat_date, hospital_id, department)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_appointments_hospital ON appointments(hospital_id)`,
      `CREATE INDEX IF NOT EXISTS idx_appointments_department ON appointments(department)`,
      `CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)`,
      `CREATE INDEX IF NOT EXISTS idx_appointments_available ON appointments(available_count)`,
      `CREATE INDEX IF NOT EXISTS idx_booking_patient ON booking_records(patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_booking_status ON booking_records(status)`,
      `CREATE INDEX IF NOT EXISTS idx_crawl_hospital ON crawl_logs(hospital_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crawl_date ON crawl_logs(created_at)`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }

    logger.info('数据库表初始化完成');
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error(`SQL执行失败: ${sql} - ${err.message}`);
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error(`SQL查询失败: ${sql} - ${err.message}`);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error(`SQL查询失败: ${sql} - ${err.message}`);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async insertAppointment(appt) {
    const now = new Date().toISOString();
    const sql = `INSERT OR REPLACE INTO appointments 
      (id, hospital_id, hospital_name, department, department_name, 
       doctor_id, doctor_name, expert_level, appointment_date, 
       time_slot, available_count, total_count, fee, raw_data, 
       source_url, crawl_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    return this.run(sql, [
      appt.id,
      appt.hospitalId,
      appt.hospitalName,
      appt.department,
      appt.departmentName,
      appt.doctorId || null,
      appt.doctorName || null,
      appt.expertLevel || null,
      appt.appointmentDate,
      appt.timeSlot || null,
      appt.availableCount || 0,
      appt.totalCount || 0,
      appt.fee || null,
      appt.rawData ? JSON.stringify(appt.rawData) : null,
      appt.sourceUrl || null,
      appt.crawlTime || now,
      now
    ]);
  }

  async batchInsertAppointments(appointments) {
    const results = [];
    for (const appt of appointments) {
      try {
        const result = await this.insertAppointment(appt);
        results.push({ success: true, result });
      } catch (err) {
        results.push({ success: false, error: err.message });
      }
    }
    return results;
  }

  async getAvailableAppointments(filters = {}) {
    let sql = `SELECT * FROM appointments WHERE available_count > 0`;
    const params = [];

    if (filters.hospitalId) {
      sql += ` AND hospital_id = ?`;
      params.push(filters.hospitalId);
    }
    if (filters.department) {
      sql += ` AND department = ?`;
      params.push(filters.department);
    }
    if (filters.startDate) {
      sql += ` AND appointment_date >= ?`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND appointment_date <= ?`;
      params.push(filters.endDate);
    }
    if (filters.expertLevel) {
      sql += ` AND expert_level <= ?`;
      params.push(filters.expertLevel);
    }

    sql += ` ORDER BY appointment_date ASC, hospital_id ASC`;

    return this.all(sql, params);
  }

  async insertPatient(patient) {
    const now = new Date().toISOString();
    const sql = `INSERT OR REPLACE INTO patients 
      (id, name, phone, email, wechat_id, id_card, departments, 
       expert_level, time_preference, hospital_preference, priority, status, 
       created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    return this.run(sql, [
      patient.id,
      patient.name,
      patient.phone || null,
      patient.email || null,
      patient.wechatId || null,
      patient.idCard || null,
      patient.departments ? JSON.stringify(patient.departments) : null,
      patient.expertLevel || null,
      patient.timePreference ? JSON.stringify(patient.timePreference) : null,
      patient.hospitalPreference ? JSON.stringify(patient.hospitalPreference) : null,
      patient.priority || 5,
      patient.status || 'active',
      now,
      now
    ]);
  }

  async getPatient(id) {
    const row = await this.get('SELECT * FROM patients WHERE id = ?', [id]);
    if (row) {
      row.departments = row.departments ? JSON.parse(row.departments) : [];
      row.timePreference = row.time_preference ? JSON.parse(row.time_preference) : null;
      row.hospitalPreference = row.hospital_preference ? JSON.parse(row.hospital_preference) : [];
    }
    return row;
  }

  async getAllPatients(status = 'active') {
    const rows = await this.all('SELECT * FROM patients WHERE status = ? ORDER BY priority DESC', [status]);
    return rows.map(row => ({
      ...row,
      departments: row.departments ? JSON.parse(row.departments) : [],
      timePreference: row.time_preference ? JSON.parse(row.time_preference) : null,
      hospitalPreference: row.hospital_preference ? JSON.parse(row.hospital_preference) : []
    }));
  }

  async insertBookingRecord(record) {
    const now = new Date().toISOString();
    const sql = `INSERT INTO booking_records 
      (id, patient_id, appointment_id, hospital_id, hospital_name, 
       department, doctor_name, appointment_date, time_slot, status, 
       notify_channels, confirm_time, booking_time, result, 
       created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    return this.run(sql, [
      record.id,
      record.patientId,
      record.appointmentId || null,
      record.hospitalId || null,
      record.hospitalName || null,
      record.department || null,
      record.doctorName || null,
      record.appointmentDate || null,
      record.timeSlot || null,
      record.status || 'pending',
      record.notifyChannels ? JSON.stringify(record.notifyChannels) : null,
      record.confirmTime || null,
      record.bookingTime || null,
      record.result ? JSON.stringify(record.result) : null,
      now,
      now
    ]);
  }

  async updateBookingRecordStatus(id, status, result = null) {
    const now = new Date().toISOString();
    const sql = `UPDATE booking_records SET status = ?, result = ?, updated_at = ? WHERE id = ?`;
    return this.run(sql, [
      status,
      result ? JSON.stringify(result) : null,
      now,
      id
    ]);
  }

  async insertCrawlLog(log) {
    const sql = `INSERT INTO crawl_logs 
      (id, hospital_id, hospital_name, department, status, 
       duration_ms, error_message, appointments_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    return this.run(sql, [
      log.id,
      log.hospitalId || null,
      log.hospitalName || null,
      log.department || null,
      log.status,
      log.durationMs || null,
      log.errorMessage || null,
      log.appointmentsCount || 0,
      new Date().toISOString()
    ]);
  }

  async insertNotificationLog(log) {
    const sql = `INSERT INTO notification_logs 
      (id, patient_id, patient_name, channel, appointment_id, 
       hospital_name, department, doctor_name, appointment_date, 
       status, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    return this.run(sql, [
      log.id,
      log.patientId || null,
      log.patientName || null,
      log.channel,
      log.appointmentId || null,
      log.hospitalName || null,
      log.department || null,
      log.doctorName || null,
      log.appointmentDate || null,
      log.status,
      log.errorMessage || null,
      new Date().toISOString()
    ]);
  }

  async getStatistics(dateStr) {
    return this.all(
      'SELECT * FROM statistics WHERE stat_date = ?',
      [dateStr]
    );
  }

  async cleanupOldData(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const tables = ['appointments', 'crawl_logs', 'notification_logs', 'statistics'];
    const results = {};

    for (const table of tables) {
      const result = await this.run(
        `DELETE FROM ${table} WHERE date(created_at) < ?`,
        [cutoffStr]
      );
      results[table] = result.changes;
    }

    logger.info(`清理${days}天前历史数据完成`, results);
    return results;
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else {
            logger.info('数据库连接已关闭');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

let storageInstance = null;

async function getStorage() {
  if (!storageInstance) {
    storageInstance = new Storage();
    await storageInstance.init();
  }
  return storageInstance;
}

module.exports = {
  Storage,
  getStorage,
  default: Storage
};
