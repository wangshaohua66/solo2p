const path = require('path');
const { HOSPITALS, EXPERT_LEVELS, SYSTEM_CONFIG, getHospitalById, getHospitalsByDept } = require('../config/hospitals');
const { Patient, PatientService, getPatientService } = require('../src/model/patient');
const { Appointment, AppointmentService, getAppointmentService } = require('../src/model/appointment');
const { Storage, getStorage } = require('../src/utils/storage');
const { Logger, createLogger, logger } = require('../src/utils/logger');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('医疗号源监控系统 - 基础测试');
  console.log('='.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      const result = fn();
      if (result === false) {
        console.log(`  ❌ ${name}`);
        failed++;
      } else {
        console.log(`  ✓ ${name}`);
        passed++;
      }
      return result;
    } catch (err) {
      console.log(`  ❌ ${name} - ${err.message}`);
      failed++;
      return false;
    }
  }

  async function testAsync(name, fn) {
    try {
      const result = await fn();
      if (result === false) {
        console.log(`  ❌ ${name}`);
        failed++;
      } else {
        console.log(`  ✓ ${name}`);
        passed++;
      }
      return result;
    } catch (err) {
      console.log(`  ❌ ${name} - ${err.message}`);
      failed++;
      return false;
    }
  }

  console.log('【1/5】配置模块测试');
  test('医院配置数量正确（12家）', () => HOSPITALS.length === 12);
  test('所有医院都有ID和名称', () => HOSPITALS.every(h => h.id && h.name));
  test('所有医院都有科室配置', () => HOSPITALS.every(h => h.departments && Object.keys(h.departments).length > 0));
  test('所有医院都有验证码类型配置', () => HOSPITALS.every(h => ['image', 'slider', 'none'].includes(h.captchaType)));
  test('专家级别配置正确', () => Object.keys(EXPERT_LEVELS).length >= 4);
  test('系统配置包含数据库路径', () => SYSTEM_CONFIG.databasePath);
  test('getHospitalById 函数可用', () => typeof getHospitalById === 'function');
  test('getHospitalsByDept 函数可用', () => typeof getHospitalsByDept === 'function');
  test('热门科室分布合理', () => {
    const hotDepts = HOSPITALS.map(h =>
      Object.values(h.departments).filter(d => d.hot).length
    );
    return hotDepts.every(c => c >= 2 && c <= 5);
  });
  console.log();

  console.log('【2/5】日志模块测试');
  test('Logger 类存在', () => typeof Logger === 'function');
  test('createLogger 函数可用', () => typeof createLogger === 'function');
  test('默认 logger 实例存在', () => logger !== null && typeof logger.info === 'function');
  test('Logger 实例支持 info 级别', () => {
    const log = createLogger('test');
    return typeof log.info === 'function';
  });
  test('Logger 实例支持 error 级别', () => {
    const log = createLogger('test');
    return typeof log.error === 'function';
  });
  test('Logger 支持 prefix', () => {
    const log = createLogger('my-prefix');
    return log.prefix === 'my-prefix';
  });
  console.log();

  console.log('【3/5】数据库模块测试');
  const testDbPath = path.join(__dirname, '..', 'data', 'test.db');
  let storage = null;

  await testAsync('Storage 类初始化', async () => {
    storage = new Storage(testDbPath);
    await storage.init();
    return true;
  });
  await testAsync('数据库表创建成功', async () => {
    const tables = await storage.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const expectedTables = ['appointments', 'booking_records', 'crawl_logs',
      'notification_logs', 'patients', 'statistics'];
    return expectedTables.every(t => tables.some(row => row.name === t));
  });
  console.log();

  console.log('【4/5】患者模型测试');
  let patientService = null;

  await testAsync('PatientService 初始化', async () => {
    patientService = new PatientService();
    patientService.storage = storage;
    return true;
  });

  const testPatientData = {
    id: uuidv4(),
    name: '测试患者',
    phone: '13800000000',
    email: 'test@example.com',
    departments: ['cardiology', 'neurology'],
    expertLevel: 5,
    priority: 7,
    timePreference: { morning: true },
    hospitalPreference: ['h001', 'h002']
  };

  await testAsync('添加患者', async () => {
    const patient = new Patient(testPatientData);
    await storage.insertPatient(patient.toJSON());
    return true;
  });
  await testAsync('查询患者', async () => {
    const p = await storage.getPatient(testPatientData.id);
    return p && p.name === '测试患者';
  });
  test('Patient 实例属性正确', () => {
    const p = new Patient({ name: '张三' });
    return p.name === '张三' && p.id && p.status === 'active';
  });
  test('患者 toJSON 方法正确', () => {
    const p = new Patient({ name: '李四', id: 'test-id' });
    const json = p.toJSON();
    return json.name === '李四' && json.id === 'test-id';
  });

  console.log();

  console.log('【5/5】号源模型与匹配测试');
  const testAppointment = {
    id: uuidv4(),
    hospitalId: 'h001',
    hospitalName: '北京协和医院',
    department: 'cardiology',
    departmentName: '心内科',
    doctorName: '张医生',
    expertLevel: 5,
    appointmentDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
    timeSlot: '上午 08:00',
    availableCount: 3,
    totalCount: 10,
    fee: 300,
    sourceUrl: 'https://test.com',
    crawlTime: new Date().toISOString()
  };

  await testAsync('保存号源数据', async () => {
    const appt = new Appointment(testAppointment);
    await storage.insertAppointment(appt);
    return true;
  });
  await testAsync('查询可用号源', async () => {
    const appts = await storage.getAvailableAppointments({ hospitalId: 'h001' });
    return appts.length > 0;
  });

  test('号源匹配 - 科室匹配得分高', () => {
    const patient = new Patient({
      name: '测试',
      departments: ['cardiology'],
      expertLevel: 3
    });
    const appointments = [new Appointment(testAppointment)];

    const ps = new PatientService();
    const matches = ps.matchAppointments(patient, appointments);

    return matches.length > 0 && matches[0].matchScore >= 40;
  });

  test('号源匹配 - 科室不匹配得0分', () => {
    const patient = new Patient({
      name: '测试',
      departments: ['pediatrics']
    });
    const appointments = [new Appointment(testAppointment)];

    const ps = new PatientService();
    const matches = ps.matchAppointments(patient, appointments, { fuzzyMatch: false });

    return matches.length === 0;
  });

  test('号源匹配 - 优先级排序正确', () => {
    const patient1 = new Patient({ name: '高优', priority: 9, departments: ['cardiology'] });
    const patient2 = new Patient({ name: '低优', priority: 3, departments: ['cardiology'] });
    const appointments = [new Appointment(testAppointment)];

    const ps = new PatientService();
    const match1 = ps.matchAppointments(patient1, appointments);
    const match2 = ps.matchAppointments(patient2, appointments);

    return match1[0].priority > match2[0].priority;
  });

  test('专家级别权重正确', () => {
    return EXPERT_LEVELS[5].weight >= EXPERT_LEVELS[3].weight;
  });

  test('Appointment.isAvailable 判断正确', () => {
    const a = new Appointment({ ...testAppointment, availableCount: 5 });
    return a.isAvailable() === true;
  });

  test('Appointment.isAvailable 无号时为false', () => {
    const a = new Appointment({ ...testAppointment, availableCount: 0 });
    return a.isAvailable() === false;
  });

  console.log();

  console.log('-' .repeat(60));
  console.log(`测试结果: 通过 ${passed} / ${passed + failed}`);
  const passRate = ((passed / (passed + failed)) * 100).toFixed(1);
  console.log(`通过率: ${passRate}%`);
  console.log('-' .repeat(60));

  if (storage) {
    await storage.close();
    try {
      const fs = require('fs');
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (e) {}
  }

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('测试运行失败:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
