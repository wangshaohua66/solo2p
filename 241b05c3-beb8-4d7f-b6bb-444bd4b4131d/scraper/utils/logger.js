const chalk = require('chalk');

const levels = {
  debug: { level: 0, color: chalk.gray, label: 'DEBUG' },
  info: { level: 1, color: chalk.blue, label: 'INFO' },
  warn: { level: 2, color: chalk.yellow, label: 'WARN' },
  error: { level: 3, color: chalk.red, label: 'ERROR' },
  success: { level: 1, color: chalk.green, label: 'SUCCESS' },
  risk: { level: 2, color: chalk.red.bold, label: 'RISK' },
};

let currentLevel = process.env.LOG_LEVEL || 'info';
let isBlinking = false;

function setLevel(level) {
  currentLevel = level;
}

function formatMessage(level, platform, message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const levelInfo = levels[level] || levels.info;
  const platformStr = platform ? `[${platform}]` : '';
  return `${chalk.gray(timestamp)} ${levelInfo.color(levelInfo.label)} ${chalk.cyan(platformStr)} ${message}`;
}

function log(level, message, platform) {
  const levelInfo = levels[level];
  if (!levelInfo || levelInfo.level < levels[currentLevel]?.level) {
    return;
  }
  console.log(formatMessage(level, platform, message));
}

function info(message, platform) {
  log('info', message, platform);
}

function warn(message, platform) {
  log('warn', message, platform);
}

function error(message, platform) {
  log('error', message, platform);
}

function debug(message, platform) {
  log('debug', message, platform);
}

function success(message, platform) {
  log('success', message, platform);
}

function risk(message, platform) {
  const blinkMsg = chalk.red.bold(message);
  if (isBlinking) {
    console.log(formatMessage('risk', platform, blinkMsg));
  } else {
    log('risk', blinkMsg, platform);
  }
}

function progress(current, total, label = '') {
  const percent = Math.floor((current / total) * 100);
  const barLength = 30;
  const filled = Math.floor(barLength * (current / total));
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  process.stdout.write(`\r${chalk.cyan(label)} [${bar}] ${percent}% (${current}/${total})`);
  if (current >= total) {
    process.stdout.write('\n');
  }
}

function status(stats) {
  console.log('\n' + chalk.bold('=== 巡查状态 ==='));
  console.log(`${chalk.blue('平台')}: ${stats.platform || '-'}`);
  console.log(`${chalk.green('当前页')}: ${stats.page || 0}`);
  console.log(`${chalk.yellow('抓取条目')}: ${stats.items || 0}`);
  console.log(`${chalk.red('风险事件')}: ${stats.risks || 0}`);
  console.log('================\n');
}

module.exports = {
  info,
  warn,
  error,
  debug,
  success,
  risk,
  progress,
  status,
  setLevel,
};
