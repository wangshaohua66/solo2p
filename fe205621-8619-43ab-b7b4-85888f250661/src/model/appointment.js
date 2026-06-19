const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');
const { getStorage } = require('../utils/storage');
const { HOSPITALS, EXPERT_LEVELS } = require('../../config/hospitals');
const dayjs = require('dayjs');

const logger = createLogger('AppointmentModel');

class Appointment {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.hospitalId = data.hospitalId;
    this.hospitalName = data.hospitalName;
    this.department = data.department;
    this.departmentName = data.departmentName;
    this.doctorId = data.doctorId || null;
    this.doctorName = data.doctorName || '';
    this.expertLevel = data.expertLevel || null;
    this.appointmentDate = data.appointmentDate;
    this.timeSlot = data.timeSlot || null;
    this.availableCount = data.availableCount || 0;
    this.totalCount = data.totalCount || 0;
    this.fee = data.fee || null;
    this.rawData = data.rawData || null;
    this.sourceUrl = data.sourceUrl || null;
    this.crawlTime = data.crawlTime || new Date().toISOString();
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  isAvailable() {
    return this.availableCount > 0;
  }

  getExpertLevelName() {
    if (!this.expertLevel) return '未知';
    return EXPERT_LEVELS[this.expertLevel]?.name || '未知';
  }
}

class AppointmentService {
  constructor() {
    this.storage = null;
    this._cache = new Map();
  }

  async _init() {
    if (!this.storage) {
      this.storage = await getStorage();
    }
  }

  async saveAppointments(appointments) {
    await this._init();

    const results = [];
    for (const appt of appointments) {
      const appointment = appt instanceof Appointment ? appt : new Appointment(appt);
      try {
        await this.storage.insertAppointment(appointment);
        this._cache.set(appointment.id, appointment);
        results.push({ id: appointment.id, success: true });
      } catch (err) {
        logger.error(`保存号源失败: ${appointment.id} - ${err.message}`);
        results.push({ id: appointment.id, success: false, error: err.message });
      }
    }

    logger.info(`保存号源数据完成: ${appointments.length} 条`);
    return results;
  }

  async getAvailableAppointments(filters = {}) {
    await this._init();
    const rows = await this.storage.getAvailableAppointments(filters);
    return rows.map(r => new Appointment(r));
  }

  async getAppointmentById(id) {
    await this._init();
    const row = await this.storage.get(
      'SELECT * FROM appointments WHERE id = ?',
      [id]
    );
    return row ? new Appointment(row) : null;
  }

  async getByHospitalAndDepartment(hospitalId, department, options = {}) {
    await this._init();

    let sql = 'SELECT * FROM appointments WHERE hospital_id = ? AND department = ?';
    const params = [hospitalId, department];

    if (options.startDate) {
      sql += ' AND appointment_date >= ?';
      params.push(options.startDate);
    }
    if (options.endDate) {
      sql += ' AND appointment_date <= ?';
      params.push(options.endDate);
    }

    sql += ' ORDER BY appointment_date ASC, available_count DESC';

    const rows = await this.storage.all(sql, params);
    return rows.map(r => new Appointment(r));
  }

  async getHotDepartments(days = 7) {
    await this._init();
    const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');

    const rows = await this.storage.all(`
      SELECT 
        hospital_id, 
        hospital_name,
        department, 
        department_name,
        COUNT(*) as total_slots,
        SUM(available_count) as total_available,
        AVG(available_count) as avg_available
      FROM appointments 
      WHERE appointment_date >= ?
      GROUP BY hospital_id, department
      ORDER BY total_slots DESC
      LIMIT 20
    `, [startDate]);

    return rows;
  }

  async getReleasePatterns(hospitalId, department, days = 30) {
    await this._init();
    const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');

    const rows = await this.storage.all(`
      SELECT 
        appointment_date,
        COUNT(*) as slot_count,
        SUM(CASE WHEN available_count > 0 THEN 1 ELSE 0 END) as available_count,
        MAX(crawl_time) as last_crawl
      FROM appointments
      WHERE hospital_id = ? AND department = ? AND appointment_date >= ?
      GROUP BY appointment_date
      ORDER BY appointment_date DESC
    `, [hospitalId, department, startDate]);

    return {
      hospitalId,
      department,
      days,
      data: rows,
      stats: this._analyzePatterns(rows)
    };
  }

  _analyzePatterns(rows) {
    if (rows.length === 0) return null;

    const totalDays = rows.length;
    const availableDays = rows.filter(r => r.available_count > 0).length;
    const availabilityRate = (availableDays / totalDays * 100).toFixed(1);

    const avgSlotsPerDay = rows.reduce((sum, r) => sum + r.slot_count, 0) / totalDays;

    const hotSpots = [];
    rows.forEach((row, idx) => {
      if (idx > 0 && row.available_count > rows[idx - 1].available_count * 2) {
        hotSpots.push({
          date: row.appointment_date,
          spike: true,
          count: row.available_count
        });
      }
    });

    return {
      totalDays,
      availableDays,
      availabilityRate: availabilityRate + '%',
      avgSlotsPerDay: avgSlotsPerDay.toFixed(1),
      hotSpots,
      bestTimeToCheck: this._suggestBestTime(rows)
    };
  }

  _suggestBestTime(rows) {
    if (rows.length < 3) return '数据不足';

    const sorted = [...rows].sort((a, b) => b.available_count - a.available_count);
    const topDays = sorted.slice(0, Math.min(3, sorted.length));

    if (topDays.length > 0) {
      return `建议在 ${topDays.map(d => d.appointment_date).join('、')} 附近关注号源`;
    }

    return '暂无推荐';
  }

  async getStatistics(dateStr) {
    await this._init();
    const rows = await this.storage.getStatistics(dateStr);
    return rows;
  }

  async cleanupOldData(days = 30) {
    await this._init();
    return await this.storage.cleanupOldData(days);
  }

  async getAppointmentsByDateRange(startDate, endDate, filters = {}) {
    await this._init();

    let sql = 'SELECT * FROM appointments WHERE appointment_date BETWEEN ? AND ?';
    const params = [startDate, endDate];

    if (filters.hospitalId) {
      sql += ' AND hospital_id = ?';
      params.push(filters.hospitalId);
    }
    if (filters.department) {
      sql += ' AND department = ?';
      params.push(filters.department);
    }

    sql += ' ORDER BY appointment_date ASC, available_count DESC';

    const rows = await this.storage.all(sql, params);
    return rows.map(r => new Appointment(r));
  }
}

let appointmentServiceInstance = null;

async function getAppointmentService() {
  if (!appointmentServiceInstance) {
    appointmentServiceInstance = new AppointmentService();
    await appointmentServiceInstance._init();
  }
  return appointmentServiceInstance;
}

module.exports = {
  Appointment,
  AppointmentService,
  getAppointmentService,
  default: AppointmentService
};
