const { getScheduler } = require('./crawler/scheduler');
const { getPatientService } = require('./model/patient');
const { getAppointmentService } = require('./model/appointment');
const { getNotifierService } = require('./service/notifier');
const { getCaptchaService } = require('./service/captcha');
const { getStorage } = require('./utils/storage');
const { createLogger } = require('./utils/logger');
const { HOSPITALS } = require('../config/hospitals');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const logger = createLogger('Main');

class App {
  constructor() {
    this.scheduler = null;
    this.patientService = null;
    this.appointmentService = null;
    this.notifierService = null;
    this.captchaService = null;
    this.storage = null;
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;

    logger.info('='.repeat(60));
    logger.info('医疗号源监控系统启动中...');
    logger.info('='.repeat(60));

    logger.info(`配置医院数量: ${HOSPITALS.length} 家`);

    const startTime = Date.now();

    this.storage = await getStorage();
    logger.info('✓ 数据库初始化完成');

    this.patientService = await getPatientService();
    logger.info('✓ 患者服务初始化完成');

    this.appointmentService = await getAppointmentService();
    logger.info('✓ 号源服务初始化完成');

    this.notifierService = await getNotifierService();
    logger.info('✓ 通知服务初始化完成');

    this.captchaService = await getCaptchaService();
    logger.info('✓ 验证码服务初始化完成');

    this.scheduler = await getScheduler();
    logger.info('✓ 调度器初始化完成');

    const duration = Date.now() - startTime;
    logger.info(`系统初始化完成，耗时 ${duration}ms`);
    logger.info('='.repeat(60));

    this._initialized = true;
  }

  async start() {
    await this.init();

    logger.info('启动号源监控...');
    this.scheduler.start();

    this.scheduler.onAppointmentAvailable((data) => {
      logger.info(`发现新号源: ${data.appointments.length} 条，发送通知: ${data.notifications.length} 条`);
    });

    setInterval(() => {
      const stats = this.scheduler.getStats();
      logger.debug(
        `状态监控 - 活跃任务: ${stats.activeTasks}, ` +
        `浏览器: ${stats.activeBrowsers}, ` +
        `队列: ${stats.queueSize}, ` +
        `成功率: ${stats.successRate}`
      );
    }, 60000);

    return true;
  }

  async stop() {
    logger.info('正在停止系统...');

    if (this.scheduler) {
      await this.scheduler.close();
    }

    if (this.captchaService) {
      await this.captchaService.close();
    }

    if (this.storage) {
      await this.storage.close();
    }

    logger.info('系统已停止');
    this._initialized = false;
  }

  async seedDemoData() {
    await this.init();

    logger.info('添加示例患者数据...');

    const demoPatients = [
      {
        name: '张大爷',
        phone: '13800138001',
        email: 'zhang@example.com',
        wechatId: 'zhang_wechat',
        departments: ['cardiology', 'neurology'],
        expertLevel: 5,
        priority: 8,
        timePreference: { morning: true, weekdays: true }
      },
      {
        name: '李阿姨',
        phone: '13800138002',
        email: 'li@example.com',
        departments: ['orthopedics', 'cardiology'],
        expertLevel: 4,
        priority: 6,
        timePreference: { afternoon: true }
      },
      {
        name: '王先生',
        phone: '13800138003',
        email: 'wang@example.com',
        departments: ['neurology', 'oncology'],
        expertLevel: 5,
        priority: 9,
        hospitalPreference: ['h001', 'h002']
      },
      {
        name: '赵女士',
        phone: '13800138004',
        departments: ['endocrinology', 'dermatology'],
        expertLevel: 3,
        priority: 4
      },
      {
        name: '刘叔叔',
        phone: '13800138005',
        departments: ['orthopedics', 'gastroenterology'],
        expertLevel: 5,
        priority: 7,
        hospitalPreference: ['h003', 'h004']
      }
    ];

    for (const p of demoPatients) {
      await this.patientService.addPatient(p);
    }

    logger.info(`添加了 ${demoPatients.length} 个示例患者`);

    logger.info('添加示例号源数据...');

    const demoAppointments = [];
    const hospitals = HOSPITALS.slice(0, 6);
    const departments = ['cardiology', 'neurology', 'orthopedics'];

    for (let i = 0; i < 30; i++) {
      const hospital = hospitals[Math.floor(Math.random() * hospitals.length)];
      const dept = departments[Math.floor(Math.random() * departments.length)];
      const date = dayjs().add(Math.floor(Math.random() * 7), 'day').format('YYYY-MM-DD');
      const timeSlots = ['上午 08:00', '上午 09:30', '下午 14:00', '下午 15:30'];
      const timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
      const doctors = ['李医生', '王医生', '张教授', '刘主任', '陈医生', '赵医生'];
      const doctor = doctors[Math.floor(Math.random() * doctors.length)];

      demoAppointments.push({
        id: `${hospital.id}-${dept}-${doctor}-${date}-${timeSlot}`.replace(/\s+/g, '_'),
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        department: dept,
        departmentName: hospital.departments[dept]?.name || dept,
        doctorName: doctor,
        expertLevel: Math.floor(Math.random() * 4) + 2,
        appointmentDate: date,
        timeSlot: timeSlot,
        availableCount: Math.floor(Math.random() * 5),
        totalCount: 10,
        fee: 100 + Math.floor(Math.random() * 400),
        sourceUrl: hospital.baseUrl,
        crawlTime: new Date().toISOString()
      });
    }

    await this.appointmentService.saveAppointments(demoAppointments);
    logger.info(`添加了 ${demoAppointments.length} 条示例号源`);

    return true;
  }

  getStats() {
    if (!this.scheduler) return null;
    return this.scheduler.getStats();
  }
}

let appInstance = null;

async function getApp() {
  if (!appInstance) {
    appInstance = new App();
  }
  return appInstance;
}

if (require.main === module) {
  (async () => {
    try {
      const app = await getApp();
      await app.init();

      const args = process.argv.slice(2);

      if (args.includes('--seed') || args.includes('--demo')) {
        await app.seedDemoData();
        console.log('示例数据已添加');
      }

      if (args.includes('--cli') || args.length === 0) {
        const { getCLI } = require('./cli');
        const cli = await getCLI();
        await cli.start();
      } else if (args.includes('--start') || args.includes('--daemon')) {
        await app.start();

        process.on('SIGINT', async () => {
          logger.info('收到退出信号...');
          await app.stop();
          process.exit(0);
        });

        process.on('SIGTERM', async () => {
          await app.stop();
          process.exit(0);
        });
      }
    } catch (err) {
      logger.error('系统启动失败:', err);
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = {
  App,
  getApp,
  default: App
};
