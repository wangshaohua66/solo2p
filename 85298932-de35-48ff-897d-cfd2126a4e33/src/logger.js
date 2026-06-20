const path = require('path');
const fs = require('fs-extra');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const yaml = require('js-yaml');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'accounts.yaml');

function loadConfig() {
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    return yaml.load(content);
  } catch (err) {
    console.error('[logger] 加载配置失败，使用默认日志配置:', err.message);
    return {
      logging: {
        level: 'info',
        dir: './logs',
        maxFileSizeMB: 50,
        maxFiles: 30
      }
    };
  }
}

const config = loadConfig();
const logConfig = config.logging || {};
const logDir = path.resolve(logConfig.dir || './logs');
fs.ensureDirSync(logDir);

const { combine, timestamp, printf, errors, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const ts = timestamp;
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  const logMsg = stack ? `${message}\n${stack}` : message;
  return `[${ts}] [${level.toUpperCase()}] ${logMsg} ${metaStr}`.trim();
});

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  logFormat
);

const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  logFormat
);

const logger = winston.createLogger({
  level: logConfig.level || 'info',
  exitOnError: false,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'assessment-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: `${logConfig.maxFileSizeMB || 50}m`,
      maxFiles: logConfig.maxFiles || '30d',
      format: fileFormat,
      handleExceptions: true
    })
  ]
});

logger.stream = {
  write: function (message) {
    logger.info(message.trim());
  }
};

logger.setLevel = (lvl) => { logger.level = lvl; };

module.exports = logger;
