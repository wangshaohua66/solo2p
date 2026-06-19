const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');
const { EXPERT_LEVELS } = require('../../config/hospitals');
const { getStorage } = require('../utils/storage');

const logger = createLogger('PatientModel');

class Patient {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.phone = data.phone || null;
    this.email = data.email || null;
    this.wechatId = data.wechatId || null;
    this.idCard = data.idCard || null;
    this.departments = data.departments || [];
    this.expertLevel = data.expertLevel || 3;
    this.timePreference = data.timePreference || null;
    this.hospitalPreference = data.hospitalPreference || [];
    this.priority = data.priority || 5;
    this.status = data.status || 'active';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      phone: this.phone,
      email: this.email,
      wechatId: this.wechatId,
      idCard: this.idCard,
      departments: this.departments,
      expertLevel: this.expertLevel,
      timePreference: this.timePreference,
      hospitalPreference: this.hospitalPreference,
      priority: this.priority,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class PatientService {
  constructor() {
    this.storage = null;
  }

  async _init() {
    if (!this.storage) {
      this.storage = await getStorage();
    }
  }

  async addPatient(patientData) {
    await this._init();
    const patient = new Patient(patientData);
    await this.storage.insertPatient(patient.toJSON());
    logger.info(`添加患者: ${patient.name} (${patient.id})`);
    return patient;
  }

  async updatePatient(id, updates) {
    await this._init();
    const existing = await this.storage.getPatient(id);
    if (!existing) {
      throw new Error(`患者不存在: ${id}`);
    }

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await this.storage.insertPatient(updated);
    logger.info(`更新患者信息: ${id}`);
    return new Patient(updated);
  }

  async getPatient(id) {
    await this._init();
    const data = await this.storage.getPatient(id);
    return data ? new Patient(data) : null;
  }

  async listPatients(options = {}) {
    await this._init();
    const status = options.status || 'active';
    const rows = await this.storage.getAllPatients(status);
    return rows.map(r => new Patient(r));
  }

  async deletePatient(id) {
    await this._init();
    await this.storage.run(
      'UPDATE patients SET status = ? WHERE id = ?',
      ['inactive', id]
    );
    logger.info(`停用患者: ${id}`);
    return true;
  }

  matchAppointments(patient, appointments, options = {}) {
    const results = [];
    const { fuzzyMatch = true } = options;

    for (const appt of appointments) {
      const match = this._calculateMatch(patient, appt, fuzzyMatch);
      if (match.score > 0) {
        results.push({
          appointment: appt,
          matchScore: match.score,
          matchDetails: match.details,
          priority: patient.priority
        });
      }
    }

    results.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.matchScore - a.matchScore;
    });

    return results;
  }

  _calculateMatch(patient, appointment, fuzzyMatch) {
    let score = 0;
    const details = [];

    const deptMatch = patient.departments.includes(appointment.department);
    if (deptMatch) {
      score += 40;
      details.push('科室匹配: +40');
    } else if (fuzzyMatch) {
      const deptName = appointment.departmentName || '';
      const fuzzyMatchFound = patient.departments.some(d =>
        deptName.includes(d) || d.includes(deptName)
      );
      if (fuzzyMatchFound) {
        score += 20;
        details.push('科室模糊匹配: +20');
      }
    }

    if (score === 0 && !fuzzyMatch) {
      return { score: 0, details: ['科室不匹配'] };
    }

    if (patient.expertLevel) {
      const apptLevel = appointment.expertLevel || 3;
      if (apptLevel >= patient.expertLevel) {
        score += 25;
        details.push('专家级别满足: +25');
      } else if (apptLevel >= patient.expertLevel - 1) {
        score += 15;
        details.push('专家级别接近: +15');
      }
    }

    if (patient.hospitalPreference && patient.hospitalPreference.length > 0) {
      if (patient.hospitalPreference.includes(appointment.hospitalId)) {
        score += 20;
        details.push('医院偏好匹配: +20');
      }
    }

    if (patient.timePreference) {
      const match = this._checkTimePreference(patient.timePreference, appointment);
      if (match === 'perfect') {
        score += 15;
        details.push('时间偏好匹配: +15');
      } else if (match === 'partial') {
        score += 8;
        details.push('时间偏好部分匹配: +8');
      }
    }

    if (appointment.availableCount && appointment.availableCount > 0) {
      score += 10;
      details.push('号源充足: +10');
    }

    return { score, details };
  }

  _checkTimePreference(timePref, appointment) {
    if (!timePref || !appointment.timeSlot) return 'none';

    const timeSlot = appointment.timeSlot;

    if (timePref.morning && (timeSlot.includes('上午') || timeSlot.includes('早') || timeSlot.match(/0?[6-9]:|1[01]:/))) {
      return 'perfect';
    }

    if (timePref.afternoon && (timeSlot.includes('下午') || timeSlot.match(/1[2-7]:/))) {
      return 'perfect';
    }

    if (timePref.evening && (timeSlot.includes('晚上') || timeSlot.includes('夜') || timeSlot.match(/1[89]:|2[0-3]:/))) {
      return 'perfect';
    }

    if (timePref.days && timePref.days.length > 0 && appointment.appointmentDate) {
      const date = new Date(appointment.appointmentDate);
      const dayOfWeek = date.getDay();
      if (timePref.days.includes(dayOfWeek)) {
        return 'perfect';
      }
    }

    if (timePref.weekdays && /^(周一|周二|周三|周四|周五)/.test(appointment.appointmentDate || '')) {
      return 'partial';
    }

    if (timePref.weekends && /^(周六|周日)/.test(appointment.appointmentDate || '')) {
      return 'partial';
    }

    return 'none';
  }

  matchAllPatients(appointments) {
    const results = [];

    const patients = this.listPatients();

    for (const patient of patients) {
      if (patient.status !== 'active') continue;

      const matches = this.matchAppointments(patient, appointments);
      if (matches.length > 0) {
        results.push({
          patient,
          matches: matches.slice(0, 10)
        });
      }
    }

    results.sort((a, b) => b.patient.priority - a.patient.priority);

    return results;
  }
}

let patientServiceInstance = null;

async function getPatientService() {
  if (!patientServiceInstance) {
    patientServiceInstance = new PatientService();
    await patientServiceInstance._init();
  }
  return patientServiceInstance;
}

module.exports = {
  Patient,
  PatientService,
  getPatientService,
  default: PatientService
};
