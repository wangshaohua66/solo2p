import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { getSitesByPriority } from '../config/sites.js';

const APP_NAME = '法拍房监控系统';
const APP_VERSION = '1.0.0';

const SITE_STATUS_COLORS = {
  idle: chalk.gray,
  running: chalk.green,
  retrying: chalk.yellow,
  paused: chalk.gray,
  success: chalk.green,
  failed: chalk.red
};

const SITE_STATUS_TEXT = {
  idle: '等待中',
  running: '采集中',
  retrying: '重试中',
  paused: '已暂停',
  success: '成功',
  failed: '失败'
};

export function printLogo() {
  const logo = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   █████╗ ██╗   ██╗ ██████╗████████╗██╗ ██████╗ ███╗   ██╗   ║
║  ██╔══██╗██║   ██║██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║   ║
║  ███████║██║   ██║██║        ██║   ██║██║   ██║██╔██╗ ██║   ║
║  ██╔══██║██║   ██║██║        ██║   ██║██║   ██║██║╚██╗██║   ║
║  ██║  ██║╚██████╔╝╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║   ║
║  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ║
║                                                              ║
║           法 拍 房 投 资 监 控 系 统                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

  console.log(chalk.cyan(logo));
  console.log(chalk.yellow.bold(`  ${APP_NAME} v${APP_VERSION}`));
  console.log(chalk.gray(`  多平台司法拍卖房产自动采集与投资价值分析`));
  console.log('');
}

export function printVersion() {
  console.log(chalk.cyan.bold(`${APP_NAME} v${APP_VERSION}`));
}

export function printHelp() {
  console.log(chalk.cyan.bold('\n用法:'));
  console.log('  node src/index.js <command> [options]');
  console.log('');
  console.log(chalk.cyan.bold('命令:'));
  console.log(`  ${chalk.green('start')}        启动定时采集服务`);
  console.log(`  ${chalk.green('crawl')}        立即执行一次全量采集`);
  console.log(`  ${chalk.green('report')}       生成今日采集日报`);
  console.log(`  ${chalk.green('status')}       查看系统当前状态`);
  console.log(`  ${chalk.green('export')}       导出数据`);
  console.log(`  ${chalk.green('help')}         显示帮助信息`);
  console.log('');
  console.log(chalk.cyan.bold('选项:'));
  console.log(`  ${chalk.yellow('--site')}       指定站点名称 (用于 crawl 命令)`);
  console.log(`  ${chalk.yellow('--csv')}        导出为 CSV 格式 (用于 export 命令)`);
  console.log(`  ${chalk.yellow('--json')}       导出为 JSON 格式 (用于 export 命令)`);
  console.log(`  ${chalk.yellow('--output')}     输出文件路径 (用于 export 命令)`);
  console.log('');
  console.log(chalk.cyan.bold('示例:'));
  console.log('  npm start                    # 启动定时服务');
  console.log('  node src/index.js crawl      # 立即全量采集');
  console.log('  node src/index.js crawl --site 阿里拍卖-司法');
  console.log('  node src/index.js report');
  console.log('  node src/index.js status');
  console.log('  node src/index.js export --csv --output data.csv');
  console.log('');
}

export function printStatsPanel(stats) {
  const {
    totalSites = 0,
    successSites = 0,
    failedSites = 0,
    totalCollected = 0,
    totalNew = 0,
    totalFiltered = 0,
    totalErrors = 0,
    totalDuration = 0
  } = stats;

  const duration = formatDuration(totalDuration);
  const runningCount = totalSites - successSites - failedSites;

  console.log('');
  console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold('                    实 时 统 计 面 板') + chalk.cyan('                       ║'));
  console.log(chalk.cyan('╠══════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan('║') + ` 站点状态: ${chalk.green.bold(successSites)} 成功 / ${chalk.red.bold(failedSites)} 失败 / ${chalk.yellow.bold(runningCount)} 进行中 / ${totalSites} 总计` + ' '.repeat(14) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 采集总数: ${chalk.cyan.bold(totalCollected)} 条` + ' '.repeat(41) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 新增标的: ${chalk.green.bold(totalNew)} 条` + ' '.repeat(41) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 过滤标的: ${chalk.yellow.bold(totalFiltered)} 条` + ' '.repeat(41) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 异常数量: ${chalk.red.bold(totalErrors)} 条` + ' '.repeat(42) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 运行时长: ${chalk.magenta.bold(duration)}` + ' '.repeat(42) + chalk.cyan('║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
  console.log('');
}

export function createSiteProgressBars(sites) {
  const multibar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: (options, params, payload) => {
      const siteName = payload.name.padEnd(15, ' ');
      const statusColor = SITE_STATUS_COLORS[payload.status] || chalk.gray;
      const statusText = SITE_STATUS_TEXT[payload.status] || '等待中';
      const progress = Math.floor(params.progress * 100);
      const bar = payload.status === 'idle' ? ' '.repeat(options.barsize) : params.bar;
      
      return `${chalk.cyan(siteName)} | ${statusColor(statusText.padEnd(6, ' '))} | ${bar} | ${progress.toFixed(0)}% | ${chalk.gray(payload.statsText || '')}`;
    },
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    barsize: 30
  });

  const bars = new Map();
  const siteConfigs = getSitesByPriority();

  for (const site of siteConfigs) {
    if (sites && sites.length > 0 && !sites.includes(site.name)) {
      continue;
    }

    const bar = multibar.create(100, 0, {
      name: site.name,
      status: 'idle',
      statsText: '等待开始'
    });
    bars.set(site.name, bar);
  }

  return { multibar, bars };
}

export function updateSiteProgress(bar, data) {
  const { status, collected, total, newItems, filtered, errors } = data;

  let progress = 0;
  let statsText = '';

  if (status === 'idle') {
    statsText = '等待开始';
    progress = 0;
  } else if (status === 'running' || status === 'retrying') {
    if (total && total > 0) {
      progress = (collected / total) * 100;
    } else {
      progress = 5 + (Math.random() * 10);
    }
    statsText = `已采集 ${collected || 0}`;
  } else if (status === 'success') {
    progress = 100;
    statsText = `新增 ${newItems || 0} / 过滤 ${filtered || 0}`;
  } else if (status === 'failed') {
    statsText = `错误 ${errors || 0}`;
  }

  bar.update(Math.min(100, progress), {
    status,
    statsText,
    collected,
    total,
    newItems,
    filtered,
    errors
  });
}

export function printHighValueAlert(auction) {
  const title = auction.title || '未知标的';
  const price = formatPrice(auction.currentPrice || auction.startPrice || 0);
  const assessPrice = formatPrice(auction.assessPrice || 0);
  const discountRate = auction.discountRate ? `${auction.discountRate}%` : '未知';
  const stars = auction.starDisplay || '★★★☆☆';
  const score = auction.score || 0;

  const border = '═'.repeat(60);

  console.log('');
  console.log(chalk.bgRed.white.bold(`╔${border}╗`));
  console.log(chalk.bgRed.white.bold(`║`) + chalk.bgRed.yellow.bold(`  ⚡ 高价值标的发现！ `) + chalk.bgRed.white.bold(`${' '.repeat(37)}║`));
  console.log(chalk.bgRed.white.bold(`╠${border}╣`));
  console.log(chalk.bgRed.white.bold(`║`) + chalk.bgRed.white(`  ${stars} 评分: ${score}分`) + chalk.bgRed.white(`${' '.repeat(40)}║`));
  console.log(chalk.bgRed.white.bold(`╠${border}╣`));
  console.log(chalk.bgRed.white.bold(`║`) + chalk.bgRed.white(`  标的: ${truncate(title, 50)}`) + chalk.bgRed.white(`${' '.repeat(Math.max(0, 54 - title.length))}║`));
  console.log(chalk.bgRed.white.bold(`║`) + chalk.bgRed.white(`  当前价: ${chalk.bgRed.green.bold(price)}`) + chalk.bgRed.white(`${' '.repeat(Math.max(0, 42 - price.length))}║`));
  console.log(chalk.bgRed.white.bold(`║`) + chalk.bgRed.white(`  评估价: ${assessPrice}`) + chalk.bgRed.white(`${' '.repeat(Math.max(0, 42 - String(assessPrice).length))}║`));
  console.log(chalk.bgRed.white.bold(`║`) + chalk.bgRed.white(`  折扣率: ${chalk.bgRed.yellow.bold(discountRate)}`) + chalk.bgRed.white(`${' '.repeat(Math.max(0, 42 - discountRate.length))}║`));
  console.log(chalk.bgRed.white.bold(`╚${border}╝`));
  console.log('');
}

export function printSummaryReport(stats) {
  const {
    totalSites = 0,
    successSites = 0,
    failedSites = 0,
    totalCollected = 0,
    totalNew = 0,
    totalFiltered = 0,
    totalErrors = 0,
    totalDuration = 0,
    sites = []
  } = stats;

  const duration = formatDuration(totalDuration);
  const successRate = totalSites > 0 ? ((successSites / totalSites) * 100).toFixed(1) : '0';

  console.log('');
  console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold('                    采 集 汇 总 报 告') + chalk.cyan('                       ║'));
  console.log(chalk.cyan('╠══════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan('║') + ` 总站点数: ${totalSites}` + ' '.repeat(45) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 成功站点: ${chalk.green.bold(successSites)}` + ' '.repeat(44) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 失败站点: ${chalk.red.bold(failedSites)}` + ' '.repeat(45) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 成功率: ${chalk.yellow.bold(successRate + '%')}` + ' '.repeat(45) + chalk.cyan('║'));
  console.log(chalk.cyan('╠══════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan('║') + ` 采集总数: ${chalk.cyan.bold(totalCollected)} 条` + ' '.repeat(39) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 新增标的: ${chalk.green.bold(totalNew)} 条` + ' '.repeat(40) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 过滤标的: ${chalk.yellow.bold(totalFiltered)} 条` + ' '.repeat(40) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 异常数量: ${chalk.red.bold(totalErrors)} 条` + ' '.repeat(41) + chalk.cyan('║'));
  console.log(chalk.cyan('╠══════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan('║') + ` 总耗时: ${chalk.magenta.bold(duration)}` + ' '.repeat(45) + chalk.cyan('║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
  console.log('');

  if (sites && sites.length > 0) {
    console.log(chalk.cyan.bold('  各站点详情:'));
    console.log('');

    for (const site of sites) {
      const statusColor = SITE_STATUS_COLORS[site.status] || chalk.gray;
      const statusText = SITE_STATUS_TEXT[site.status] || '未知';
      const siteDuration = formatDuration(site.duration || 0);
      const stats = site.stats || {};

      console.log(`  ${chalk.cyan(site.name.padEnd(20, ' '))} ${statusColor(statusText.padEnd(6, ' '))} 采集: ${String(stats.collected || 0).padStart(4, ' ')} 新增: ${String(stats.newItems || 0).padStart(3, ' ')} 错误: ${String(stats.errors || 0).padStart(2, ' ')} 耗时: ${siteDuration}`);
    }
    console.log('');
  }
}

export function printStatus(status) {
  const {
    isRunning = false,
    concurrency = 0,
    pendingTasks = 0,
    runningTasks = 0,
    totalSites = 0,
    runningCount = 0,
    successCount = 0,
    failedCount = 0,
    pausedCount = 0,
    stats = {},
    scheduleJobs = [],
    sites = []
  } = status;

  console.log('');
  console.log(chalk.cyan.bold('系统状态'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`  运行状态: ${isRunning ? chalk.green.bold('运行中') : chalk.yellow.bold('空闲')}`);
  console.log(`  并发数: ${concurrency}`);
  console.log(`  待执行任务: ${pendingTasks}`);
  console.log(`  执行中任务: ${runningTasks}`);
  console.log('');

  console.log(chalk.cyan.bold('站点状态'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`  总站点: ${totalSites}`);
  console.log(`  运行中: ${chalk.green(runningCount)}`);
  console.log(`  成功: ${chalk.green(successCount)}`);
  console.log(`  失败: ${chalk.red(failedCount)}`);
  console.log(`  暂停: ${chalk.gray(pausedCount)}`);
  console.log('');

  if (scheduleJobs && scheduleJobs.length > 0) {
    console.log(chalk.cyan.bold('定时任务'));
    console.log(chalk.gray('─'.repeat(50)));
    for (const job of scheduleJobs) {
      const nextTime = job.nextInvocation ? job.nextInvocation.toString() : '未知';
      console.log(`  ${chalk.yellow(job.name)}: ${job.cronExpression}`);
      console.log(`    下次执行: ${nextTime}`);
    }
    console.log('');
  }

  if (stats) {
    console.log(chalk.cyan.bold('统计数据'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  累计采集: ${stats.collected || 0}`);
    console.log(`  累计新增: ${stats.newItems || 0}`);
    console.log(`  累计过滤: ${stats.filtered || 0}`);
    console.log(`  累计错误: ${stats.errors || 0}`);
    console.log('');
  }

  if (sites && sites.length > 0) {
    console.log(chalk.cyan.bold('站点详情'));
    console.log(chalk.gray('─'.repeat(50)));
    for (const site of sites) {
      const statusColor = SITE_STATUS_COLORS[site.status] || chalk.gray;
      const statusText = SITE_STATUS_TEXT[site.status] || '未知';
      console.log(`  ${chalk.cyan(site.name.padEnd(20, ' '))} ${statusColor(statusText.padEnd(6, ' '))}`);
      if (site.lastRunAt) {
        console.log(`    最后运行: ${site.lastRunAt}`);
      }
      if (site.lastError) {
        console.log(`    最后错误: ${chalk.red(site.lastError)}`);
      }
    }
    console.log('');
  }
}

export function printDailyReport(report) {
  const { date, stats, sites } = report;

  console.log('');
  console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold(`                   ${date} 日 报`) + chalk.cyan('                        ║'));
  console.log(chalk.cyan('╠══════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan('║') + ` 采集总数: ${stats?.collected || 0}` + ' '.repeat(43) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 新增标的: ${stats?.newItems || 0}` + ' '.repeat(44) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 过滤标的: ${stats?.filtered || 0}` + ' '.repeat(44) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + ` 异常数量: ${stats?.errors || 0}` + ' '.repeat(45) + chalk.cyan('║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
  console.log('');
}

export function formatPrice(price) {
  if (!price || price === 0) return '0元';
  if (price >= 100000000) {
    return (price / 100000000).toFixed(2) + '亿';
  }
  if (price >= 10000) {
    return (price / 10000).toFixed(2) + '万';
  }
  return price.toLocaleString() + '元';
}

export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}分${seconds}秒`;
}

function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export default {
  printLogo,
  printVersion,
  printHelp,
  printStatsPanel,
  createSiteProgressBars,
  updateSiteProgress,
  printHighValueAlert,
  printSummaryReport,
  printStatus,
  printDailyReport,
  formatPrice,
  formatDuration
};
