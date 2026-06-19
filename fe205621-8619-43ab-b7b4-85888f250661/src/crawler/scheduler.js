const schedule = require('node-schedule');
const { v4: uuidv4 } = require('uuid');
const PQueue = require('p-queue').default;
const Bottleneck = require('bottleneck');
const { createLogger } = require('../utils/logger');
const { HOSPITALS, SYSTEM_CONFIG, getHospitalsByDept } = require('../../config/hospitals');
const HospitalCrawler = require('./hospital');
const { getAppointmentService } = require('../model/appointment');
const { getPatientService } = require('../model/patient');
const { getNotifierService } = require('../service/notifier');
const { getStorage } = require('../utils/storage');

const logger = createLogger('Scheduler');

class CrawlScheduler {
  constructor(options = {}) {
    this.options = {
      maxBrowsers: options.maxBrowsers || SYSTEM_CONFIG.maxBrowsers,
      maxRetries: options.maxRetries || SYSTEM_CONFIG.maxRetries,
      headless: options.headless ?? SYSTEM_CONFIG.headless,
      ...options
    };

    this.jobs = new Map();
    this.crawlers = new Map();
    this.running = false;
    this.stats = {
      totalCrawls: 0,
      successCrawls: 0,
      failedCrawls: 0,
      todayNotifications: 0,
      activeTasks: 0,
      startTime: null
    };

    this.browserQueue = new PQueue({
      concurrency: this.options.maxBrowsers,
      autoStart: true
    });

    this.rateLimiters = new Map();
    this.appointmentService = null;
    this.patientService = null;
    this.notifierService = null;
    this.storage = null;

    this._onAvailableCallbacks = [];
  }

  async init() {
    this.appointmentService = await getAppointmentService();
    this.patientService = await getPatientService();
    this.notifierService = await getNotifierService();
    this.storage = await getStorage();

    for (const hospital of HOSPITALS) {
      const limiter = new Bottleneck({
        maxConcurrent: 1,
        minTime: (60 / hospital.rateLimit) * 1000
      });
      this.rateLimiters.set(hospital.id, limiter);
    }

    logger.info(`调度器初始化完成，最大浏览器实例: ${this.options.maxBrowsers}`);
  }

  start() {
    if (this.running) {
      logger.warn('调度器已经在运行中');
      return;
    }

    this.running = true;
    this.stats.startTime = new Date().toISOString();
    logger.info('调度器启动');

    this._setupScheduledJobs();
    this._startMaintenanceJobs();

    return true;
  }

  stop() {
    if (!this.running) return;

    this.running = false;
    logger.info('停止调度器...');

    for (const job of this.jobs.values()) {
      job.cancel();
    }
    this.jobs.clear();

    for (const crawler of this.crawlers.values()) {
      try {
        crawler.close();
      } catch (e) {}
    }
    this.crawlers.clear();

    this.browserQueue.clear();

    logger.info('调度器已停止');
  }

  _setupScheduledJobs() {
    for (const hospital of HOSPITALS) {
      const departments = Object.keys(hospital.departments);

      const hotDepts = departments.filter(d => hospital.departments[d].hot);
      const normalDepts = departments.filter(d => !hospital.departments[d].hot);

      hotDepts.forEach(dept => {
        this._scheduleCrawl(hospital, dept, Math.max(60, hospital.refreshInterval / 2));
      });

      normalDepts.forEach(dept => {
        this._scheduleCrawl(hospital, dept, hospital.refreshInterval);
      });

      if (hospital.releaseSchedule) {
        this._scheduleReleaseTimeCrawl(hospital);
      }
    }

    logger.info(`已调度 ${this.jobs.size} 个定时爬取任务`);
  }

  _scheduleCrawl(hospital, department, intervalSeconds) {
    const jobId = `${hospital.id}-${department}`;

    const rule = new schedule.RecurrenceRule();
    rule.second = Math.floor(Math.random() * 60);

    const job = schedule.scheduleJob(jobId, rule, async () => {
      if (!this.running) return;
      await this._queueCrawl(hospital, department, intervalSeconds * 1000);
    });

    this.jobs.set(jobId, job);
    logger.debug(`已调度 ${hospital.name} - ${hospital.departments[department]?.name || department} (间隔: ${intervalSeconds}秒)`);
  }

  _scheduleReleaseTimeCrawl(hospital) {
    const { time, daysAhead } = hospital.releaseSchedule;
    if (!time) return;

    const [hour, minute] = time.split(':').map(Number);
    const hotDepts = Object.keys(hospital.departments).filter(
      d => hospital.departments[d].hot
    );

    const jobId = `release-${hospital.id}`;
    const rule = new schedule.RecurrenceRule();
    rule.hour = hour;
    rule.minute = Math.max(0, minute - 2);
    rule.second = 0;

    const job = schedule.scheduleJob(jobId, rule, async () => {
      if (!this.running) return;
      logger.info(`【放号时段】${hospital.name} 即将放号，启动密集监控`);

      for (const dept of hotDepts) {
        for (let i = 0; i < 10; i++) {
          setTimeout(() => {
            if (this.running) {
              this._queueCrawl(hospital, dept, 30000);
            }
          }, i * 30000);
        }
      }
    });

    this.jobs.set(jobId, job);
    logger.debug(`已配置放号监控: ${hospital.name} 每天 ${time}`);
  }

  async _queueCrawl(hospital, department) {
    this.stats.activeTasks++;

    const limiter = this.rateLimiters.get(hospital.id);

    try {
      return await limiter.schedule(async () => {
        return await this.browserQueue.add(async () => {
          return await this._executeCrawl(hospital, department);
        });
      });
    } finally {
      this.stats.activeTasks--;
    }
  }

  async _executeCrawl(hospital, department) {
    const crawlId = uuidv4();
    const startTime = Date.now();
    this.stats.totalCrawls++;

    logger.info(`[爬取开始] ${hospital.name} - ${hospital.departments[department]?.name || department}`);

    let crawler = this.crawlers.get(hospital.id);
    let needsInit = false;

    if (!crawler) {
      crawler = new HospitalCrawler(hospital, {
        headless: this.options.headless
      });
      this.crawlers.set(hospital.id, crawler);
      needsInit = true;
    }

    let retryCount = 0;
    let lastError = null;
    const maxRetries = hospital.maxRetries || this.options.maxRetries;

    while (retryCount <= maxRetries) {
      try {
        if (needsInit) {
          await crawler.initialize();
          needsInit = false;
        }

        if (!crawler.isLoggedIn) {
          const loginResult = await crawler.login();
          if (!loginResult.success) {
            throw new Error('登录失败');
          }
        }

        const result = await crawler.fetchAppointments(department);

        if (result.success) {
          await this._processAppointments(result);
          await this._logCrawlResult(crawlId, hospital, department, 'success', startTime, result);

          this.stats.successCrawls++;
          logger.info(`[爬取完成] ${hospital.name} - ${result.appointments.length} 条号源 (${Date.now() - startTime}ms)`);

          return result;
        } else {
          throw new Error(result.error || '爬取失败');
        }
      } catch (err) {
        lastError = err;
        retryCount++;

        logger.warn(`[爬取失败] ${hospital.name} 第 ${retryCount} 次重试: ${err.message}`);

        if (err.message.includes('登录') || err.message.includes('session') || err.message.includes('过期')) {
          try {
            await crawler.refreshSession();
          } catch (e) {
            logger.error(`刷新会话失败: ${e.message}`);
          }
        }

        if (retryCount <= maxRetries) {
          await this._sleep(3000 * retryCount);
        }
      }
    }

    this.stats.failedCrawls++;
    await this._logCrawlResult(crawlId, hospital, department, 'failed', startTime, { error: lastError?.message });

    logger.error(`[爬取失败] ${hospital.name} - 已达最大重试次数: ${lastError?.message}`);

    try {
      await crawler.takeScreenshot(`fail-${hospital.id}-${department}-${Date.now()}.png`);
    } catch (e) {}

    return { success: false, error: lastError?.message, hospitalId: hospital.id };
  }

  async _processAppointments(result) {
    const { appointments, hospitalId, department } = result;

    if (appointments.length === 0) return;

    await this.appointmentService.saveAppointments(appointments);

    const availableAppts = appointments.filter(a => a.availableCount > 0);
    if (availableAppts.length > 0) {
      logger.info(`发现可用号源: ${hospitalId} - ${department} 共 ${availableAppts.length} 个`);
      await this._matchAndNotify(availableAppts);
    }
  }

  async _matchAndNotify(appointments) {
    const patients = await this.patientService.listPatients();
    const notifications = [];

    for (const patient of patients) {
      if (patient.status !== 'active') continue;

      const matches = this.patientService.matchAppointments(patient, appointments);
      if (matches.length > 0) {
        const topMatch = matches[0];
        try {
          const result = await this.notifierService.notify(patient, topMatch.appointment);
          notifications.push(result);
          if (result.success) {
            this.stats.todayNotifications++;
          }
        } catch (err) {
          logger.error(`通知患者失败 ${patient.name}: ${err.message}`);
        }
      }
    }

    if (notifications.length > 0) {
      this._triggerAvailableCallbacks(appointments, notifications);
    }

    return notifications;
  }

  async _logCrawlResult(crawlId, hospital, department, status, startTime, result) {
    try {
      await this.storage.insertCrawlLog({
        id: crawlId,
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        department: department,
        status: status,
        durationMs: Date.now() - startTime,
        errorMessage: result.error || null,
        appointmentsCount: result.appointments?.length || 0
      });
    } catch (err) {
      logger.debug(`记录爬取日志失败: ${err.message}`);
    }
  }

  _startMaintenanceJobs() {
    const cleanupJob = schedule.scheduleJob('cleanup-daily', '0 2 * * *', async () => {
      logger.info('执行每日数据清理...');
      try {
        await this.appointmentService.cleanupOldData(SYSTEM_CONFIG.dataRetentionDays);
      } catch (err) {
        logger.error(`数据清理失败: ${err.message}`);
      }
    });
    this.jobs.set('cleanup-daily', cleanupJob);

    const statsJob = schedule.scheduleJob('stats-daily', '0 0 * * *', async () => {
      logger.info('生成每日统计...');
    });
    this.jobs.set('stats-daily', statsJob);
  }

  onAppointmentAvailable(callback) {
    this._onAvailableCallbacks.push(callback);
  }

  _triggerAvailableCallbacks(appointments, notifications) {
    for (const cb of this._onAvailableCallbacks) {
      try {
        cb({ appointments, notifications });
      } catch (e) {}
    }
  }

  manualCrawl(hospitalId, department) {
    const hospital = HOSPITALS.find(h => h.id === hospitalId);
    if (!hospital) {
      return Promise.reject(new Error(`未找到医院: ${hospitalId}`));
    }

    if (!hospital.departments[department]) {
      return Promise.reject(new Error(`医院${hospital.name}没有科室: ${department}`));
    }

    return this._queueCrawl(hospital, department);
  }

  async crawlAll() {
    const results = [];

    for (const hospital of HOSPITALS) {
      for (const dept of Object.keys(hospital.departments)) {
        const result = await this._queueCrawl(hospital, dept);
        results.push(result);
      }
    }

    return results;
  }

  getStats() {
    const uptime = this.stats.startTime
      ? Date.now() - new Date(this.stats.startTime).getTime()
      : 0;

    const successRate = this.stats.totalCrawls > 0
      ? ((this.stats.successCrawls / this.stats.totalCrawls) * 100).toFixed(1) + '%'
      : 'N/A';

    return {
      ...this.stats,
      uptime,
      successRate,
      activeJobs: this.jobs.size,
      activeBrowsers: this.crawlers.size,
      queueSize: this.browserQueue.size,
      pendingSize: this.browserQueue.pending
    };
  }

  getJobList() {
    return Array.from(this.jobs.keys());
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    this.stop();

    for (const crawler of this.crawlers.values()) {
      try {
        await crawler.close();
      } catch (e) {}
    }
    this.crawlers.clear();
  }
}

let schedulerInstance = null;

async function getScheduler(options) {
  if (!schedulerInstance) {
    schedulerInstance = new CrawlScheduler(options);
    await schedulerInstance.init();
  }
  return schedulerInstance;
}

module.exports = {
  CrawlScheduler,
  getScheduler,
  default: CrawlScheduler
};
