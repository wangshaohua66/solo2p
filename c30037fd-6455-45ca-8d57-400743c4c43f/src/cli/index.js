'use strict';

const path = require('path');
const ConfigLoader = require('../utils/configLoader');
const { logger } = require('../utils/logger');
const repository = require('../storage/repository');
const CaptchaHandler = require('../captcha/captchaHandler');
const AlertEngine = require('../alert/alertEngine');
const TaskScheduler = require('../scheduler/taskScheduler');
const ReportGenerator = require('../report/reportGenerator');
const CLIDashboard = require('./dashboard');

async function start() {
  const args = process.argv.slice(2);
  const cliMode = args.length > 0;
  const command = args[0];

  const configDir = process.env.CONFIG_DIR || path.resolve(process.cwd(), 'config');
  const configLoader = new ConfigLoader(configDir);
  await configLoader.init();

  try {
    await repository.init();
  } catch (err) {
    logger.error('存储层初始化失败，请检查 MongoDB 与 Redis 连接配置', { error: err.message });
    if (!cliMode) process.exit(1);
  }

  const captchaHandler = new CaptchaHandler(configLoader.get('system') || {});
  const alertEngine = new AlertEngine(configLoader.getAlertRules(), configLoader.getUrgencyLevels());
  configLoader.on('alertRules:changed', ({ new: n }) => alertEngine.reload(n?.alert_rules || {}, n?.urgency_levels || {}));

  const scheduler = new TaskScheduler(configLoader, { captchaHandler, alertEngine });
  const reportGenerator = new ReportGenerator();
  const dashboard = new CLIDashboard(scheduler, captchaHandler, alertEngine, configLoader, reportGenerator);

  if (cliMode) {
    await runCliCommand(command, args.slice(1), { scheduler, captchaHandler, alertEngine, reportGenerator, configLoader });
    await repository.close();
    process.exit(0);
  }

  dashboard.on('request:stop', async () => {
    await scheduler.stop();
    await repository.close();
    dashboard.stop();
    process.exit(0);
  });

  await scheduler.start();
  await dashboard.start();

  process.on('SIGINT', async () => {
    logger.info('收到终止信号，正在优雅关闭...');
    try {
      await scheduler.stop();
      await repository.close();
      dashboard.stop();
    } catch (_) {}
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    try { await scheduler.stop(); await repository.close(); dashboard.stop(); } catch (_) {}
    process.exit(0);
  });
}

async function runCliCommand(command, args, deps) {
  const { scheduler, reportGenerator, configLoader } = deps;
  switch (command) {
    case '--command':
    case '-c': {
      const cmd = args[0];
      if (cmd === 'report') {
        const type = args.includes('--type') ? args[args.indexOf('--type') + 1] : 'weekly';
        const r = type === 'monthly' ? await reportGenerator.generateMonthly() : await reportGenerator.generateWeekly();
        console.log(`报告已生成: ${r.filePath}`);
      } else if (cmd === 'run') {
        await scheduler.start();
        const platformKey = args[1] || 'all';
        if (platformKey === 'all') {
          const tasks = await scheduler.runAllNow();
          console.log(`已调度 ${tasks.length} 个任务`);
        } else {
          const t = await scheduler.runNow(platformKey);
          console.log(`任务已调度: ${t._id}`);
        }
        await new Promise((r) => setTimeout(r, 30000));
        await scheduler.stop();
      } else if (cmd === 'captcha') {
        const pending = await deps.captchaHandler.listPending(10);
        console.table(pending.map((c) => ({
          ID: c.captchaId.substring(0, 12),
          平台: c.platformName || c.platform,
          类型: c.type,
          截图: c.screenshot ? '是' : '否',
        })));
      }
      break;
    }
    default:
      console.log(`用法: node src/cli/index.js --command <report|run|captcha> [选项]`);
      console.log(`  report --type weekly|monthly`);
      console.log(`  run <platformKey|all> [dataType]`);
      console.log(`  captcha list`);
  }
}

start().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
