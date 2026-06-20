'use strict';

/**
 * 彩色日志模块（chalk 4.x CommonJS 版本）
 * 提供：分银行前缀、分级着色、进度阶段标记、告警高亮。
 * 设计为单例，进程内共享。日志同时输出到控制台与文件（按银行+日期切分）。
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, success: 50 };
const ENV_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const THRESHOLD = LEVELS[ENV_LEVEL] !== undefined ? LEVELS[ENV_LEVEL] : LEVELS.info;

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fileLog(bankCode, level, msg) {
  const dateTag = new Date().toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `${dateTag}-${bankCode || 'system'}.log`);
  fs.appendFileSync(file, `[${stamp()}] [${level.toUpperCase()}] ${msg}\n`, 'utf8');
}

function paint(level, msg) {
  switch (level) {
    case 'error': return chalk.red.bold(msg);
    case 'warn': return chalk.yellow.bold(msg);
    case 'success': return chalk.green(msg);
    case 'debug': return chalk.gray(msg);
    case 'info':
    default: return chalk.cyan(msg);
  }
}

const bankColors = [
  chalk.white, chalk.blue, chalk.magenta, chalk.green,
  chalk.yellow, chalk.red, chalk.cyan, chalk.gray,
];

function bankTagColor(code) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) & 0x7fffffff;
  return bankColors[h % bankColors.length];
}

function write(level, tag, msg) {
  if (LEVELS[level] === undefined) level = 'info';
  if (LEVELS[level] < THRESHOLD) return;
  const head = `[${stamp()}]${tag ? ' ' + tag : ''}`;
  const line = `${chalk.gray(head)} ${paint(level, msg)}`;
  console.log(line);
  fileLog(tag ? tag.replace(/[\[\]]/g, '') : null, level, msg);
}

const logger = {
  level: ENV_LEVEL,
  raw(line) { console.log(line); },

  info(msg, tag) { write('info', tag, msg); },
  warn(msg, tag) { write('warn', tag, msg); },
  error(msg, tag) { write('error', tag, msg); },
  success(msg, tag) { write('success', tag, msg); },
  debug(msg, tag) { write('debug', tag, msg); },

  /** 银行作用域日志：自动加上 [BANK] 彩色前缀 */
  forBank(code) {
    const tag = bankTagColor(code)(`[${code}]`);
    return {
      info: (m) => write('info', tag, m),
      warn: (m) => write('warn', tag, m),
      error: (m) => write('error', tag, m),
      success: (m) => write('success', tag, m),
      debug: (m) => write('debug', tag, m),
    };
  },

  /** 告警高亮：红色背景 */
  alert(msg) {
    write('error', chalk.bgRed.white('[ALERT]'), msg);
  },

  /** 阶段标记：登录中 / 导出中 / 解析中 / 核对中 */
  stage(bankCode, stageName) {
    const stageMap = {
      登录中: chalk.bgBlue.white,
      导出中: chalk.bgMagenta.white,
      解析中: chalk.bgCyan.black,
      核对中: chalk.bgGreen.black,
    };
    const painter = stageMap[stageName] || chalk.bgGray.white;
    write('info', painter(`[${bankCode}:${stageName}]`), `${bankCode} 进入 ${stageName} 阶段`);
  },
};

module.exports = logger;
