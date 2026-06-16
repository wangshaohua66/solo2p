import winston from 'winston';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loggers = new Map();

const levelColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  verbose: 'cyan'
};

function createConsoleFormat(moduleName) {
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      const levelUpper = level.toUpperCase();
      let coloredLevel;
      
      switch (level) {
        case 'error':
          coloredLevel = chalk.red.bold(`[${levelUpper}]`);
          break;
        case 'warn':
          coloredLevel = chalk.yellow.bold(`[${levelUpper}]`);
          break;
        case 'info':
          coloredLevel = chalk.green.bold(`[${levelUpper}]`);
          break;
        case 'debug':
          coloredLevel = chalk.blue.bold(`[${levelUpper}]`);
          break;
        default:
          coloredLevel = chalk.white(`[${levelUpper}]`);
      }

      const coloredTimestamp = chalk.gray(`[${timestamp}]`);
      const coloredModule = chalk.cyan(`[${moduleName}]`);

      return `${coloredTimestamp} ${coloredLevel} ${coloredModule} ${message}`;
    })
  );
}

function createFileFormat() {
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  );
}

function ensureLogDir(logDir) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

export function createLogger(moduleName, options = {}) {
  if (loggers.has(moduleName)) {
    return loggers.get(moduleName);
  }

  const level = options.level || process.env.LOG_LEVEL || 'info';
  const logDir = options.dir || process.env.LOG_DIR || path.resolve(__dirname, '../../logs');
  const consoleEnabled = options.console !== false && process.env.LOG_CONSOLE !== 'false';
  const fileEnabled = options.file !== false && process.env.LOG_FILE !== 'false';
  const maxSize = options.maxSize || parseInt(process.env.LOG_MAX_SIZE, 10) || 5 * 1024 * 1024;
  const maxFiles = options.maxFiles || parseInt(process.env.LOG_MAX_FILES, 10) || 10;

  const transports = [];

  if (consoleEnabled) {
    transports.push(
      new winston.transports.Console({
        format: createConsoleFormat(moduleName),
        level
      })
    );
  }

  if (fileEnabled) {
    ensureLogDir(logDir);

    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: createFileFormat(),
        level,
        maxsize: maxSize,
        maxFiles
      })
    );

    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        format: createFileFormat(),
        level: 'error',
        maxsize: maxSize,
        maxFiles
      })
    );
  }

  const logger = winston.createLogger({
    level,
    transports,
    exitOnError: false
  });

  loggers.set(moduleName, logger);
  return logger;
}

export function getLogger(moduleName) {
  if (loggers.has(moduleName)) {
    return loggers.get(moduleName);
  }
  return createLogger(moduleName);
}

export function closeAllLoggers() {
  for (const [name, logger] of loggers) {
    logger.close();
  }
  loggers.clear();
}

export default {
  createLogger,
  getLogger,
  closeAllLoggers
};
