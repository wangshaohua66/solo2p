const winston = require('winston');
const { taskLogs } = require('../store/db');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'white',
  silly: 'grey'
};

winston.addColors(colors);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}] ${info.message}${info.meta ? ' ' + JSON.stringify(info.meta) : ''}`
  )
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat
  })
];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  transports,
  exitOnError: false
});

class TaskLogger {
  constructor(taskId, carrierId, carrierName, taskType) {
    this.taskId = taskId;
    this.carrierId = carrierId;
    this.carrierName = carrierName;
    this.taskType = taskType;
    this.startTime = Date.now();
    this.recordsParsed = 0;
    this.recordsFailed = 0;
    this.errorMessage = null;
    this.httpStatus = null;
    this.retryCount = 0;
    this.logId = null;
  }

  async start() {
    this.logId = taskLogs.create({
      task_id: this.taskId,
      carrier_id: this.carrierId,
      carrier_name: this.carrierName,
      task_type: this.taskType,
      status: 'running',
      start_time: new Date().toISOString()
    });
    logger.info(`[${this.carrierName}] 任务开始: ${this.taskType}`, { taskId: this.taskId });
    return this.logId;
  }

  setHttpStatus(status) {
    this.httpStatus = status;
    if (this.logId) {
      taskLogs.update(this.logId, { http_status: status });
    }
  }

  incrementParsed(count = 1) {
    this.recordsParsed += count;
  }

  incrementFailed(count = 1) {
    this.recordsFailed += count;
  }

  setRetryCount(count) {
    this.retryCount = count;
    if (this.logId) {
      taskLogs.update(this.logId, { retry_count: count });
    }
  }

  async success(message = '任务完成') {
    const duration = Date.now() - this.startTime;
    if (this.logId) {
      taskLogs.finishTask(
        this.logId,
        'success',
        duration,
        this.recordsParsed,
        this.recordsFailed,
        null
      );
    }
    logger.info(`[${this.carrierName}] ${message}`, {
      taskId: this.taskId,
      duration: `${duration}ms`,
      parsed: this.recordsParsed,
      failed: this.recordsFailed
    });
    return { status: 'success', duration, parsed: this.recordsParsed, failed: this.recordsFailed };
  }

  async fail(error) {
    const duration = Date.now() - this.startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.errorMessage = errorMsg;
    
    if (this.logId) {
      taskLogs.finishTask(
        this.logId,
        'failed',
        duration,
        this.recordsParsed,
        this.recordsFailed,
        errorMsg
      );
    }
    logger.error(`[${this.carrierName}] 任务失败: ${errorMsg}`, {
      taskId: this.taskId,
      duration: `${duration}ms`
    });
    return { status: 'failed', duration, error: errorMsg };
  }
}

logger.TaskLogger = TaskLogger;

logger.createTaskLogger = (taskId, carrierId, carrierName, taskType) => {
  return new TaskLogger(taskId, carrierId, carrierName, taskType);
};

module.exports = logger;
