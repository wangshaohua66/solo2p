#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

const {
  PLATFORMS,
  PLATFORM_NAMES,
  ORDER_STATUS,
  LOGISTICS_STATUS,
  getDateRange
} = require('./config');
const { getStorage } = require('./storage');
const { getOrderFetcher } = require('./orderFetcher');
const { getLogisticsTracker } = require('./logisticsTracker');
const { getScheduler, TASK_TYPES } = require('./scheduler');
const { getAuthManager } = require('./authManager');
const { globalAlertManager } = require('./retryHandler');

const program = new Command();

const STATUS_LABELS = {
  [ORDER_STATUS.PENDING_SHIPMENT]: chalk.yellow('待发货'),
  [ORDER_STATUS.SHIPPED]: chalk.cyan('已发货'),
  [ORDER_STATUS.COMPLETED]: chalk.green('已完成'),
  [ORDER_STATUS.CANCELLED]: chalk.red('已取消'),
  [ORDER_STATUS.RETURNED]: chalk.magenta('已退货')
};

const LOGISTICS_LABELS = {
  [LOGISTICS_STATUS.PENDING]: chalk.yellow('待发货'),
  [LOGISTICS_STATUS.TRANSIT]: chalk.cyan('运输中'),
  [LOGISTICS_STATUS.DELIVERED]: chalk.green('已签收'),
  [LOGISTICS_STATUS.EXCEPTION]: chalk.red('异常'),
  [LOGISTICS_STATUS.RETURNED]: chalk.magenta('退回')
};

function printBanner() {
  console.log(chalk.magenta.bold(`
╔═══════════════════════════════════════════════════╗
║     跨境电商多平台订单自动化采集系统 v1.0.0        ║
║  Cross-border E-commerce Order Collector System   ║
╚═══════════════════════════════════════════════════╝
  `));
  console.log(chalk.gray(`支持平台: ${PLATFORMS.map(p => PLATFORM_NAMES[p]).join(' / ')}`));
  console.log('');
}

function ensureDataDirs() {
  const dirs = [
    path.join(__dirname, 'data'),
    path.join(__dirname, 'logs'),
    path.join(__dirname, 'exports')
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function formatNumber(n, digits = 2) {
  if (n == null || isNaN(n)) return '0.00';
  return Number(n).toFixed(digits);
}

function formatTableRow(columns, widths) {
  return columns.map((col, i) => String(col).padEnd(widths[i] || 15).slice(0, widths[i] || 15)).join(' | ');
}

async function cmdFetch(options) {
  const platforms = options.platform ? options.platform.split(',').filter(p => PLATFORMS.includes(p.trim())) : PLATFORMS;
  const days = parseInt(options.days) || 7;
  const concurrency = parseInt(options.concurrency) || 3;
  const simulate = options.simulate || false;

  if (platforms.length === 0) {
    console.log(chalk.red('错误: 没有指定有效平台'));
    process.exit(1);
  }

  const dateRange = getDateRange(days);
  const fetcher = getOrderFetcher();

  try {
    await fetcher.fetchAllPlatforms(dateRange, { platforms, concurrency, simulate });

    if (options.withLogistics) {
      console.log('');
      const tracker = getLogisticsTracker();
      await tracker.trackAllPlatforms({ platform: platforms.length === 1 ? platforms[0] : null });
    }
  } catch (err) {
    console.error(chalk.red(`\n采集任务失败: ${err.message}`));
    process.exit(1);
  }
}

async function cmdTrack(options) {
  const tracker = getLogisticsTracker();
  const platform = options.platform || null;

  try {
    await tracker.trackAllPlatforms({ platform });

    if (options.checkDelay) {
      console.log(chalk.cyan('\n--- 延误订单检测 ---'));
      const delayed = await tracker.detectDelayedOrders({
        platform,
        startDate: getDateRange(parseInt(options.days) || 30).startDateStr
      });

      if (delayed.length === 0) {
        console.log(chalk.green('未发现物流延误订单'));
      } else {
        console.log(chalk.yellow(`发现 ${delayed.length} 笔延误订单:`));
        const widths = [20, 10, 14, 20, 12, 10];
        console.log(chalk.gray(formatTableRow(
          ['订单号', '平台', '物流状态', '运单号', '发货时间', '延误(小时)'],
          widths
        )));
        for (const o of delayed.slice(0, 20)) {
          console.log(formatTableRow([
            o.platform_order_id,
            PLATFORM_NAMES[o.platform],
            LOGISTICS_LABELS[o.logistics_status] || o.logistics_status,
            o.tracking_no || '-',
            o.shipped_date ? dayjs(o.shipped_date).format('MM-DD HH:mm') : '-',
            Math.round(o.delay_hours || 0)
          ], widths));
        }
        if (delayed.length > 20) {
          console.log(chalk.gray(`  ... 省略 ${delayed.length - 20} 条`));
        }
      }
    }
  } catch (err) {
    console.error(chalk.red(`物流追踪失败: ${err.message}`));
    process.exit(1);
  }
}

async function cmdQuery(options) {
  const storage = await getStorage();
  const filters = {};

  if (options.platform) filters.platform = options.platform;
  if (options.status) filters.status = options.status;
  if (options.startDate) filters.startDate = options.startDate;
  if (options.endDate) filters.endDate = options.endDate;
  if (options.orderNo) filters.order_no = options.orderNo;
  if (options.limit) filters.limit = parseInt(options.limit);
  if (options.offset) filters.offset = parseInt(options.offset);

  if (options.recent) {
    const range = getDateRange(parseInt(options.recent));
    filters.startDate = range.startDateStr;
    filters.endDate = range.endDateStr;
  }

  try {
    const orders = await storage.queryOrders(filters);

    if (orders.length === 0) {
      console.log(chalk.yellow('未查询到符合条件的订单'));
      return;
    }

    console.log(chalk.cyan(`\n查询结果: 共 ${orders.length} 条订单\n`));

    const widths = [22, 10, 12, 10, 12, 14, 18];
    console.log(chalk.gray(formatTableRow(
      ['订单号', '平台', '状态', '金额', '国家', '下单时间', '物流单号'],
      widths
    )));
    console.log(chalk.gray('-'.repeat(widths.reduce((s, w) => s + w + 3, 0))));

    for (const o of orders) {
      console.log(formatTableRow([
        o.platform_order_id,
        PLATFORM_NAMES[o.platform] || o.platform,
        STATUS_LABELS[o.status] || o.status,
        `${o.total_amount?.toFixed(2) || '0.00'} ${o.currency || ''}`,
        o.country || '-',
        dayjs(o.order_date).format('MM-DD HH:mm'),
        o.tracking_no || '-'
      ], widths));
    }

    if (options.export) {
      await exportOrdersToCsv(orders, options.export);
    }
  } catch (err) {
    console.error(chalk.red(`查询失败: ${err.message}`));
    process.exit(1);
  }
}

async function cmdReport(options) {
  const storage = await getStorage();
  const filters = {};

  if (options.platform) filters.platform = options.platform;
  if (options.days) {
    const range = getDateRange(parseInt(options.days));
    filters.startDate = range.startDateStr;
    filters.endDate = range.endDateStr;
  } else {
    filters.startDate = getDateRange(7).startDateStr;
  }

  try {
    const [stats, hotProducts, exceptionOrders] = await Promise.all([
      storage.getStatistics(filters),
      storage.getHotProducts(filters, parseInt(options.top) || 10),
      storage.getExceptionOrders(filters)
    ]);

    console.log(chalk.cyan.bold('\n========== 销售统计报表 =========='));
    console.log(chalk.gray(`统计周期: ${filters.startDate || '全部'} ~ ${filters.endDate || '今天'}\n`));

    const summaryMap = {};
    for (const row of stats.summary) {
      if (!summaryMap[row.platform]) {
        summaryMap[row.platform] = { count: 0, amount: 0, completedAmount: 0, items: 0, byStatus: {} };
      }
      summaryMap[row.platform].count += row.order_count;
      summaryMap[row.platform].amount += row.total_amount || 0;
      summaryMap[row.platform].completedAmount += row.completed_amount || 0;
      summaryMap[row.platform].items += row.total_items || 0;
      summaryMap[row.platform].byStatus[row.status] = row.order_count;
    }

    const widths = [10, 10, 14, 14, 12, 20];
    console.log(chalk.gray(formatTableRow(['平台', '订单数', '销售总额', '完成金额', '商品数', '状态明细'], widths)));
    console.log(chalk.gray('-'.repeat(widths.reduce((s, w) => s + w + 3, 0))));

    let totalCount = 0, totalAmount = 0, totalCompleted = 0;
    for (const [platform, s] of Object.entries(summaryMap)) {
      const statusParts = Object.entries(s.byStatus)
        .map(([k, v]) => `${STATUS_LABELS[k]?.split('<')[1]?.split('>')[1] || k}:${v}`)
        .join(' ');
      console.log(formatTableRow([
        PLATFORM_NAMES[platform] || platform,
        s.count,
        `$${formatNumber(s.amount)}`,
        `$${formatNumber(s.completedAmount)}`,
        s.items,
        statusParts
      ], widths));
      totalCount += s.count;
      totalAmount += s.amount;
      totalCompleted += s.completedAmount;
    }

    if (Object.keys(summaryMap).length > 1) {
      console.log(chalk.gray('-'.repeat(widths.reduce((s, w) => s + w + 3, 0))));
      console.log(formatTableRow([
        chalk.bold('合计'), chalk.bold(totalCount),
        chalk.bold(`$${formatNumber(totalAmount)}`),
        chalk.bold(`$${formatNumber(totalCompleted)}`),
        '', ''
      ], widths));
    }

    if (stats.daily.length > 0) {
      console.log(chalk.cyan.bold('\n--- 按日统计 (前10条) ---'));
      const dw = [12, 10, 10, 14];
      console.log(chalk.gray(formatTableRow(['日期', '平台', '订单数', '销售金额'], dw)));
      for (const d of stats.daily.slice(0, 10)) {
        console.log(formatTableRow([
          d.date,
          PLATFORM_NAMES[d.platform] || d.platform,
          d.order_count,
          `$${formatNumber(d.total_amount)}`
        ], dw));
      }
    }

    if (hotProducts.length > 0) {
      console.log(chalk.cyan.bold(`\n--- 热销商品 TOP${Math.min(hotProducts.length, 10)} ---`));
      const hw = [10, 18, 8, 10, 14];
      console.log(chalk.gray(formatTableRow(['平台', '商品名称', '数量', '订单数', '销售额'], hw)));
      for (const p of hotProducts.slice(0, 10)) {
        const name = (p.product_name || p.sku || 'Unknown').substring(0, 16);
        console.log(formatTableRow([
          PLATFORM_NAMES[p.platform] || p.platform,
          name,
          p.total_quantity,
          p.order_count,
          `$${formatNumber(p.total_revenue)}`
        ], hw));
      }
    }

    if (exceptionOrders.length > 0) {
      console.log(chalk.yellow.bold(`\n--- 异常订单 (${exceptionOrders.length}条) ---`));
      const ew = [22, 10, 14, 18];
      console.log(chalk.gray(formatTableRow(['订单号', '平台', '订单状态', '物流状态/原因'], ew)));
      for (const o of exceptionOrders.slice(0, 15)) {
        const reason = o.delay_reason
          ? `延误:${o.delay_reason}`
          : (LOGISTICS_LABELS[o.logistics_status]?.split('<')[1]?.split('>')[1] || o.logistics_status || '');
        console.log(formatTableRow([
          o.platform_order_id,
          PLATFORM_NAMES[o.platform] || o.platform,
          STATUS_LABELS[o.status]?.split('<')[1]?.split('>')[1] || o.status,
          reason.substring(0, 18)
        ], ew));
      }
    }

    if (options.export) {
      await exportReportToCsv(stats, hotProducts, exceptionOrders, options.export);
    }
  } catch (err) {
    console.error(chalk.red(`报表生成失败: ${err.message}`));
    process.exit(1);
  }
}

async function cmdDaemon(options) {
  const scheduler = getScheduler();

  const schedulerOpts = {
    platforms: options.platform ? options.platform.split(',') : PLATFORMS,
    fetchInterval: parseInt(options.fetchInterval) || 60,
    logisticsInterval: parseInt(options.logisticsInterval) || 30,
    days: parseInt(options.days) || 7,
    concurrency: parseInt(options.concurrency) || 3,
    simulate: options.simulate || false,
    runOnStart: options.runOnStart !== 'false',
    trackLogistics: options.noLogistics !== true,
    dailyReport: options.noReport !== true,
    reportHour: parseInt(options.reportHour) || 9,
    reportMinute: parseInt(options.reportMinute) || 0
  };

  scheduler.start(schedulerOpts);

  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n收到停止信号，正在关闭调度器...'));
    scheduler.stop();
    try { await getAuthManager().closeAllBrowsers(); } catch (e) {}
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n收到终止信号...'));
    scheduler.stop();
    try { await getAuthManager().closeAllBrowsers(); } catch (e) {}
    process.exit(0);
  });

  setInterval(() => {
    scheduler.printStatus();
  }, 5 * 60 * 1000);

  setTimeout(() => scheduler.printStatus(), 3000);
}

async function cmdStatus() {
  const auth = getAuthManager();
  const sessions = auth.getAllSessionStatus();
  const storage = await getStorage();

  console.log(chalk.cyan.bold('\n========== 系统状态 =========='));

  console.log(chalk.cyan('\n--- 登录会话状态 ---'));
  for (const platform of PLATFORMS) {
    const info = sessions[platform];
    const name = PLATFORM_NAMES[platform];
    if (!info) {
      console.log(`  ${name.padEnd(12)}: ${chalk.red('未登录')}`);
    } else if (info.isExpired) {
      console.log(`  ${name.padEnd(12)}: ${chalk.red('已过期')}`);
    } else {
      console.log(`  ${name.padEnd(12)}: ${chalk.green(`有效 (剩 ${info.minutesRemaining}分钟)`)}`);
    }
  }

  console.log(chalk.cyan('\n--- 数据存储统计 ---'));
  try {
    const totalOrders = await storage._get('SELECT COUNT(*) as count FROM orders');
    const totalLogistics = await storage._get('SELECT COUNT(*) as count FROM logistics');
    const todayOrders = await storage._get(
      `SELECT COUNT(*) as count FROM orders WHERE DATE(order_date) = ?`,
      [dayjs().format('YYYY-MM-DD')]
    );
    const byPlatform = await storage._all(
      'SELECT platform, COUNT(*) as count, SUM(total_amount) as amount FROM orders GROUP BY platform'
    );

    console.log(`  订单总数: ${chalk.green(totalOrders?.count || 0)}`);
    console.log(`  今日新增: ${chalk.cyan(todayOrders?.count || 0)}`);
    console.log(`  物流记录: ${chalk.cyan(totalLogistics?.count || 0)}`);

    if (byPlatform.length > 0) {
      console.log('\n  分平台统计:');
      for (const p of byPlatform) {
        console.log(`    ${(PLATFORM_NAMES[p.platform] || p.platform).padEnd(10)}: ${String(p.count).padStart(6)} 笔, $${formatNumber(p.amount)}`);
      }
    }
  } catch (err) {
    console.log(chalk.red(`  统计失败: ${err.message}`));
  }

  try {
    const recentLogs = await storage.getFetchLogs(null, 5);
    if (recentLogs.length > 0) {
      console.log(chalk.cyan('\n--- 最近采集日志 (5条) ---'));
      const lw = [10, 12, 8, 8, 10, 14];
      console.log(chalk.gray(formatTableRow(['平台', '日期', '抓取', '新增', '状态', '耗时(秒)'], lw)));
      for (const log of recentLogs) {
        const statusColor = log.status === 'success' ? chalk.green : chalk.red;
        console.log(formatTableRow([
          PLATFORM_NAMES[log.platform] || log.platform,
          log.fetch_date,
          log.orders_fetched,
          log.orders_inserted,
          statusColor(log.status),
          log.duration_ms ? (log.duration_ms / 1000).toFixed(1) : '-'
        ], lw));
      }
    }
  } catch (err) { /* skip */ }

  console.log(chalk.cyan('\n===============================\n'));
}

async function cmdLogin(options) {
  const platform = options.platform;
  if (!platform || !PLATFORMS.includes(platform)) {
    console.log(chalk.red(`请指定有效平台: ${PLATFORMS.join(', ')}`));
    process.exit(1);
  }

  const auth = getAuthManager();
  const force = options.force || false;

  console.log(chalk.cyan(`正在登录 ${PLATFORM_NAMES[platform]}...`));
  try {
    const result = await auth.ensureLogin(platform, force);
    if (result.loggedIn) {
      console.log(chalk.green(`✓ ${PLATFORM_NAMES[platform]} 登录成功`));
      if (options.all) {
        for (const p of PLATFORMS) {
          if (p !== platform) {
            console.log(chalk.cyan(`正在登录 ${PLATFORM_NAMES[p]}...`));
            const r = await auth.ensureLogin(p, force);
            console.log(r.loggedIn ? chalk.green(`✓ ${PLATFORM_NAMES[p]} 登录成功`) : chalk.red(`✗ ${PLATFORM_NAMES[p]} 登录失败`));
          }
        }
      }
    } else {
      console.log(chalk.red(`✗ ${PLATFORM_NAMES[platform]} 登录失败`));
      process.exit(1);
    }
  } catch (err) {
    console.log(chalk.red(`登录异常: ${err.message}`));
    process.exit(1);
  }
}

async function cmdLogout(options) {
  const auth = getAuthManager();
  const platform = options.platform;

  if (platform) {
    if (!PLATFORMS.includes(platform)) {
      console.log(chalk.red(`无效平台: ${platform}`));
      process.exit(1);
    }
    await auth.logout(platform);
    console.log(chalk.green(`已退出 ${PLATFORM_NAMES[platform]} 登录`));
  } else {
    for (const p of PLATFORMS) {
      await auth.logout(p);
    }
    console.log(chalk.green('已退出所有平台登录'));
  }
}

async function cmdTrigger(options) {
  const scheduler = getScheduler();
  const taskMap = {
    'fetch': TASK_TYPES.FETCH_ORDERS,
    'orders': TASK_TYPES.FETCH_ORDERS,
    'logistics': TASK_TYPES.TRACK_LOGISTICS,
    'track': TASK_TYPES.TRACK_LOGISTICS,
    'report': TASK_TYPES.DAILY_REPORT
  };

  const taskName = options.task || 'fetch';
  const taskType = taskMap[taskName.toLowerCase()];

  if (!taskType) {
    console.log(chalk.red(`无效任务类型: ${taskName}, 可选: fetch, logistics, report`));
    process.exit(1);
  }

  const runOpts = {
    platforms: options.platform ? options.platform.split(',') : PLATFORMS,
    days: parseInt(options.days) || 7,
    simulate: options.simulate || false,
    concurrency: parseInt(options.concurrency) || 3
  };

  scheduler._enqueueTask({
    fn: () => {
      if (taskType === TASK_TYPES.FETCH_ORDERS) return scheduler._runFetchOrdersTask(runOpts);
      if (taskType === TASK_TYPES.TRACK_LOGISTICS) return scheduler._runTrackLogisticsTask(runOpts);
      if (taskType === TASK_TYPES.DAILY_REPORT) return scheduler._runDailyReportTask(runOpts);
    },
    timeoutMs: 60 * 60 * 1000,
    type: taskType
  }).catch(err => {
    console.error(chalk.red(`任务执行失败: ${err.message}`));
    process.exit(1);
  });
}

async function cmdTestAlert() {
  console.log(chalk.cyan('正在发送测试告警...'));
  const result = await globalAlertManager.alertSystemError(new Error('这是一条测试告警，请忽略'), { test: true });
  console.log(`告警结果: ${JSON.stringify(result, null, 2)}`);
}

async function exportOrdersToCsv(orders, filePath) {
  const exportPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, 'exports', filePath);
  const dir = path.dirname(exportPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const csvWriter = createObjectCsvWriter({
    path: exportPath,
    header: [
      { id: 'platform_order_id', title: '订单号' },
      { id: 'platform', title: '平台' },
      { id: 'status', title: '订单状态' },
      { id: 'order_date', title: '下单时间' },
      { id: 'total_amount', title: '金额' },
      { id: 'currency', title: '币种' },
      { id: 'buyer_name', title: '买家' },
      { id: 'country', title: '国家' },
      { id: 'items_count', title: '商品数' },
      { id: 'tracking_no', title: '物流单号' },
      { id: 'logistics_status', title: '物流状态' }
    ]
  });

  const records = orders.map(o => ({
    ...o,
    platform: PLATFORM_NAMES[o.platform] || o.platform
  }));

  await csvWriter.writeRecords(records);
  console.log(chalk.green(`\n✓ 订单已导出: ${exportPath} (${records.length} 条)`));
}

async function exportReportToCsv(stats, hotProducts, exceptions, filePath) {
  const baseName = path.basename(filePath, path.extname(filePath));
  const dir = path.dirname(path.isAbsolute(filePath) ? filePath : path.join(__dirname, 'exports', filePath));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await Promise.all([
    (async () => {
      const summaryWriter = createObjectCsvWriter({
        path: path.join(dir, `${baseName}_summary.csv`),
        header: [
          { id: 'platform', title: '平台' },
          { id: 'status', title: '订单状态' },
          { id: 'order_count', title: '订单数' },
          { id: 'total_amount', title: '销售总额' },
          { id: 'completed_amount', title: '完成金额' },
          { id: 'total_items', title: '商品件数' }
        ]
      });
      await summaryWriter.writeRecords(stats.summary.map(r => ({
        ...r,
        platform: PLATFORM_NAMES[r.platform] || r.platform
      })));
    })(),
    (async () => {
      const dailyWriter = createObjectCsvWriter({
        path: path.join(dir, `${baseName}_daily.csv`),
        header: [
          { id: 'date', title: '日期' },
          { id: 'platform', title: '平台' },
          { id: 'order_count', title: '订单数' },
          { id: 'total_amount', title: '销售金额' }
        ]
      });
      await dailyWriter.writeRecords(stats.daily.map(r => ({
        ...r,
        platform: PLATFORM_NAMES[r.platform] || r.platform
      })));
    })(),
    (async () => {
      const productWriter = createObjectCsvWriter({
        path: path.join(dir, `${baseName}_products.csv`),
        header: [
          { id: 'platform', title: '平台' },
          { id: 'sku', title: 'SKU' },
          { id: 'product_name', title: '商品名称' },
          { id: 'total_quantity', title: '销售数量' },
          { id: 'order_count', title: '订单数' },
          { id: 'total_revenue', title: '销售额' }
        ]
      });
      await productWriter.writeRecords(hotProducts.map(p => ({
        ...p,
        platform: PLATFORM_NAMES[p.platform] || p.platform
      })));
    })(),
    (async () => {
      const exWriter = createObjectCsvWriter({
        path: path.join(dir, `${baseName}_exceptions.csv`),
        header: [
          { id: 'platform_order_id', title: '订单号' },
          { id: 'platform', title: '平台' },
          { id: 'status', title: '订单状态' },
          { id: 'tracking_no', title: '物流单号' },
          { id: 'logistics_status', title: '物流状态' },
          { id: 'is_delayed', title: '是否延误' },
          { id: 'delay_reason', title: '延误原因' }
        ]
      });
      await exWriter.writeRecords(exceptions.map(e => ({
        ...e,
        platform: PLATFORM_NAMES[e.platform] || e.platform
      })));
    })()
  ]);

  console.log(chalk.green(`\n✓ 报表已导出到: ${dir}/${baseName}_*.csv`));
}

async function interactiveMode() {
  while (true) {
    console.log(chalk.cyan.bold('\n====== 主菜单 ======'));
    const answers = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '请选择操作',
      choices: [
        { name: '1. 立即采集订单数据', value: 'fetch' },
        { name: '2. 执行物流追踪', value: 'track' },
        { name: '3. 查询订单', value: 'query' },
        { name: '4. 生成统计报表', value: 'report' },
        { name: '5. 查看系统状态', value: 'status' },
        { name: '6. 启动定时调度(守护模式)', value: 'daemon' },
        { name: '7. 手动登录平台', value: 'login' },
        { name: '8. 退出登录', value: 'logout' },
        { name: '0. 退出程序', value: 'exit' }
      ]
    }]);

    if (answers.action === 'exit') {
      console.log(chalk.green('再见！'));
      try { await getAuthManager().closeAllBrowsers(); } catch (e) {}
      process.exit(0);
    }

    await handleInteractiveAction(answers.action);
  }
}

async function handleInteractiveAction(action) {
  switch (action) {
    case 'fetch': {
      const ans = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'platforms',
          message: '选择平台 (空格勾选)',
          choices: PLATFORMS.map(p => ({ name: PLATFORM_NAMES[p], value: p })),
          default: PLATFORMS
        },
        { type: 'input', name: 'days', message: '采集最近几天:', default: '7' },
        { type: 'confirm', name: 'simulate', message: '是否使用模拟数据(无账号时选是)?', default: true },
        { type: 'confirm', name: 'withLogistics', message: '是否同步物流追踪?', default: true }
      ]);
      const dateRange = getDateRange(parseInt(ans.days));
      const fetcher = getOrderFetcher();
      await fetcher.fetchAllPlatforms(dateRange, {
        platforms: ans.platforms,
        concurrency: 3,
        simulate: ans.simulate
      });
      if (ans.withLogistics) {
        const tracker = getLogisticsTracker();
        await tracker.trackAllPlatforms({});
      }
      break;
    }
    case 'track': {
      const tracker = getLogisticsTracker();
      await tracker.trackAllPlatforms({});
      break;
    }
    case 'query': {
      const ans = await inquirer.prompt([
        {
          type: 'list',
          name: 'platform',
          message: '平台筛选:',
          choices: [{ name: '全部', value: '' }, ...PLATFORMS.map(p => ({ name: PLATFORM_NAMES[p], value: p }))]
        },
        {
          type: 'list',
          name: 'status',
          message: '状态筛选:',
          choices: [
            { name: '全部', value: '' },
            { name: '待发货', value: ORDER_STATUS.PENDING_SHIPMENT },
            { name: '已发货', value: ORDER_STATUS.SHIPPED },
            { name: '已完成', value: ORDER_STATUS.COMPLETED },
            { name: '已取消', value: ORDER_STATUS.CANCELLED },
            { name: '已退货', value: ORDER_STATUS.RETURNED }
          ]
        },
        { type: 'input', name: 'days', message: '最近N天(0=不限制):', default: '7' },
        { type: 'input', name: 'limit', message: '返回条数:', default: '50' }
      ]);
      const filters = {};
      if (ans.platform) filters.platform = ans.platform;
      if (ans.status) filters.status = ans.status;
      if (parseInt(ans.days) > 0) {
        const r = getDateRange(parseInt(ans.days));
        filters.startDate = r.startDateStr;
        filters.endDate = r.endDateStr;
      }
      filters.limit = parseInt(ans.limit);
      await cmdQuery(filters);
      break;
    }
    case 'report': {
      const ans = await inquirer.prompt([
        { type: 'input', name: 'days', message: '统计最近N天:', default: '30' },
        { type: 'input', name: 'top', message: '热销商品TOP数:', default: '10' },
        {
          type: 'list',
          name: 'platform',
          message: '平台筛选:',
          choices: [{ name: '全部', value: '' }, ...PLATFORMS.map(p => ({ name: PLATFORM_NAMES[p], value: p }))]
        },
        { type: 'confirm', name: 'export', message: '是否导出CSV?', default: false }
      ]);
      await cmdReport({
        days: ans.days,
        top: ans.top,
        platform: ans.platform || undefined,
        export: ans.export ? `report_${dayjs().format('YYYYMMDD_HHmmss')}` : undefined
      });
      break;
    }
    case 'status':
      await cmdStatus();
      break;
    case 'daemon': {
      const ans = await inquirer.prompt([
        { type: 'input', name: 'fetchInterval', message: '订单采集间隔(分钟):', default: '60' },
        { type: 'input', name: 'logisticsInterval', message: '物流追踪间隔(分钟):', default: '30' },
        { type: 'confirm', name: 'simulate', message: '模拟数据模式(无真实账号)?', default: true }
      ]);
      await cmdDaemon({
        fetchInterval: ans.fetchInterval,
        logisticsInterval: ans.logisticsInterval,
        simulate: ans.simulate
      });
      break;
    }
    case 'login': {
      const ans = await inquirer.prompt([
        {
          type: 'list',
          name: 'platform',
          message: '选择平台:',
          choices: [{ name: '全部平台', value: 'all' }, ...PLATFORMS.map(p => ({ name: PLATFORM_NAMES[p], value: p }))]
        },
        { type: 'confirm', name: 'force', message: '强制重新登录?', default: false }
      ]);
      if (ans.platform === 'all') {
        for (const p of PLATFORMS) {
          console.log(chalk.cyan(`登录 ${PLATFORM_NAMES[p]}...`));
          try {
            await (await getAuthManager().ensureLogin(p, ans.force));
          } catch (e) {
            console.log(chalk.red(`${PLATFORM_NAMES[p]} 失败: ${e.message}`));
          }
        }
      } else {
        await cmdLogin({ platform: ans.platform, force: ans.force });
      }
      break;
    }
    case 'logout': {
      const ans = await inquirer.prompt([
        {
          type: 'list',
          name: 'platform',
          message: '选择平台:',
          choices: [{ name: '全部平台', value: '' }, ...PLATFORMS.map(p => ({ name: PLATFORM_NAMES[p], value: p }))]
        }
      ]);
      await cmdLogout({ platform: ans.platform || undefined });
      break;
    }
  }
}

function setupProgram() {
  program
    .name('order-collector')
    .description('跨境电商多平台订单自动化采集系统')
    .version('1.0.0')
    .hook('preAction', () => {
      ensureDataDirs();
    });

  program
    .command('fetch', { isDefault: false })
    .description('立即执行订单数据采集')
    .option('-p, --platform <platforms>', '指定平台,逗号分隔 (amazon,ebay,wish,shopee,lazada,aliexpress)')
    .option('-d, --days <number>', '采集最近N天数据', '7')
    .option('-c, --concurrency <number>', '并发平台数', '3')
    .option('-l, --with-logistics', '采集后同步执行物流追踪')
    .option('-s, --simulate', '使用模拟数据(无真实账号时使用)')
    .action(cmdFetch);

  program
    .command('track')
    .description('执行物流状态追踪')
    .option('-p, --platform <platform>', '指定单个平台')
    .option('--check-delay', '检测延误订单')
    .option('-d, --days <number>', '检测最近N天的订单', '30')
    .action(cmdTrack);

  program
    .command('query')
    .description('查询订单数据')
    .option('-p, --platform <platform>', '按平台筛选')
    .option('-s, --status <status>', '按状态筛选 (pending_shipment/shipped/completed/cancelled/returned)')
    .option('-n, --order-no <text>', '按订单号模糊搜索')
    .option('--start-date <YYYY-MM-DD>', '开始日期')
    .option('--end-date <YYYY-MM-DD>', '结束日期')
    .option('-r, --recent <days>', '最近N天 (快捷)')
    .option('-l, --limit <number>', '返回条数上限', '100')
    .option('-o, --offset <number>', '偏移量', '0')
    .option('-e, --export <filename>', '导出CSV文件')
    .action(cmdQuery);

  program
    .command('report')
    .description('生成统计报表')
    .option('-p, --platform <platform>', '按平台筛选')
    .option('-d, --days <number>', '统计最近N天', '7')
    .option('-t, --top <number>', '热销商品TOP数', '10')
    .option('-e, --export <basename>', '导出CSV (summary/daily/products/exceptions)')
    .action(cmdReport);

  program
    .command('daemon')
    .description('启动守护调度模式')
    .option('-p, --platform <platforms>', '指定平台,逗号分隔')
    .option('-f, --fetch-interval <minutes>', '订单采集周期(分钟)', '60')
    .option('-g, --logistics-interval <minutes>', '物流追踪周期(分钟)', '30')
    .option('-d, --days <number>', '每次采集天数范围', '7')
    .option('-c, --concurrency <number>', '最大并发平台数', '3')
    .option('-s, --simulate', '模拟数据模式')
    .option('--run-on-start <true/false>', '启动时立即执行一次', 'true')
    .option('--no-logistics', '禁用物流追踪')
    .option('--no-report', '禁用每日报表')
    .option('--report-hour <number>', '每日报表小时(0-23)', '9')
    .option('--report-minute <number>', '每日报表分钟', '0')
    .action(cmdDaemon);

  program
    .command('status')
    .description('查看系统状态、登录会话与统计')
    .action(cmdStatus);

  program
    .command('login')
    .description('手动登录平台')
    .requiredOption('-p, --platform <platform>', '指定平台')
    .option('-f, --force', '强制重新登录')
    .option('-a, --all', '登录全部平台')
    .action(cmdLogin);

  program
    .command('logout')
    .description('退出平台登录')
    .option('-p, --platform <platform>', '指定平台(默认全部)')
    .action(cmdLogout);

  program
    .command('trigger')
    .description('手动触发调度任务')
    .option('-t, --task <type>', '任务类型: fetch/logistics/report', 'fetch')
    .option('-p, --platform <platforms>', '指定平台,逗号分隔')
    .option('-d, --days <number>', '采集/统计天数', '7')
    .option('-c, --concurrency <number>', '并发数', '3')
    .option('-s, --simulate', '模拟数据模式')
    .action(cmdTrigger);

  program
    .command('test-alert')
    .description('发送测试告警消息')
    .action(cmdTestAlert);

  program
    .command('interactive', { isDefault: true })
    .description('交互式菜单模式(默认)')
    .action(async () => {
      printBanner();
      await interactiveMode();
    });
}

async function main() {
  ensureDataDirs();
  setupProgram();

  process.on('uncaughtException', async (err) => {
    console.error(chalk.red(`\n未捕获异常: ${err.message}`));
    console.error(err.stack);
    try { await globalAlertManager.alertSystemError(err); } catch (e) {}
    try { await getAuthManager().closeAllBrowsers(); } catch (e) {}
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error(chalk.red(`\n未处理的Promise拒绝: ${reason}`));
    try { await globalAlertManager.alertSystemError(new Error(String(reason))); } catch (e) {}
  });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(chalk.red(`执行错误: ${err.message}`));
    console.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  cmdFetch,
  cmdTrack,
  cmdQuery,
  cmdReport,
  cmdDaemon,
  cmdStatus,
  cmdLogin,
  cmdLogout,
  cmdTrigger,
  cmdTestAlert,
  interactiveMode,
  exportOrdersToCsv,
  exportReportToCsv
};
