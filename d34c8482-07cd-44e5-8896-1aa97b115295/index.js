#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const cliProgress = require('cli-progress');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const Storage = require('./src/storage');
const Parser = require('./src/parser');
const Crawler = require('./src/crawler');
const Comparator = require('./src/comparator');
const Scheduler = require('./src/scheduler');
const Reporter = require('./src/reporter');
const Monitor = require('./src/monitor');

const config = require('./config/default.json');
const sitesConfig = require('./config/sites.json');

const program = new Command();

class CopyrightMonitorApp {
  constructor() {
    this.storage = null;
    this.parser = null;
    this.crawler = null;
    this.comparator = null;
    this.scheduler = null;
    this.reporter = null;
    this.monitor = null;
    this.progressBars = new Map();
  }

  async init() {
    console.log(
      chalk.bold.cyan(`
╔══════════════════════════════════════════════════════════════╗
║            新闻版权监控系统 v1.0.0                            ║
║  News Copyright Monitoring System - 自动化侵权转载监测平台      ║
╚══════════════════════════════════════════════════════════════╝`)
    );

    this.storage = new Storage();
    await this.storage.init();
    this.parser = new Parser();
    this.crawler = new Crawler(this.storage, this.parser);
    this.comparator = new Comparator(this.storage);
    this.scheduler = new Scheduler(this.storage, this.crawler, this.comparator);
    this.reporter = new Reporter(this.storage);
    this.monitor = new Monitor(this.storage, this.crawler, this.scheduler, this.comparator);

    await this.scheduler.syncSitesToDB();
  }

  async shutdown() {
    if (this.scheduler) this.scheduler.cancelAllJobs();
    if (this.crawler) await this.crawler.close();
    if (this.storage) await this.storage.close();
    console.log(chalk.gray('\n系统已优雅关闭。'));
  }

  _createProgressBar(siteName, total) {
    const bar = new cliProgress.SingleBar({
      format: `${chalk.yellow('{bar}')} ${chalk.cyan('{percentage}%')} | ${chalk.green(siteName)} | {value}/{total} 条 | 成功:{success} 失败:{failed}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: true
    }, cliProgress.Presets.shades_classic);
    bar.start(total, 0, { success: 0, failed: 0 });
    return bar;
  }

  async cmdImport(filePath) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      console.error(chalk.red(`文件不存在: ${absPath}`));
      process.exit(1);
    }

    console.log(chalk.cyan(`\n正在导入稿件数据: ${chalk.italic(absPath)}`));

    let articles;
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      articles = JSON.parse(content);
    } catch (err) {
      console.error(chalk.red(`解析失败: ${err.message}`));
      if (absPath.endsWith('.csv')) {
        console.log(chalk.yellow('提示: 请将CSV转为JSON格式，格式: [{title, content, publish_time, source, url}]'));
      }
      process.exit(1);
    }

    if (!Array.isArray(articles)) {
      console.error(chalk.red('JSON格式错误: 需要数组格式'));
      process.exit(1);
    }

    const bar = new cliProgress.SingleBar({
      format: `${chalk.cyan('导入进度')} ${chalk.blue('{bar}')} {percentage}% | {value}/{total}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591'
    }, cliProgress.Presets.shades_classic);
    bar.start(articles.length, 0);

    let added = 0;
    for (const article of articles) {
      await this.storage.addOriginalArticle(article);
      added++;
      bar.update(added);
    }
    bar.stop();

    const total = await this.storage.getOriginalArticleCount();
    console.log(chalk.green(`\n✓ 成功处理 ${articles.length} 条，当前稿件库: ${chalk.bold(total.toLocaleString())} 篇`));
  }

  async cmdCrawl(options) {
    await this.crawler.init();
    const startTime = Date.now();

    if (options.target) {
      const allSites = this.scheduler.getAllSites();
      const site = allSites.find((s) => s.id === options.target);
      if (!site) {
        console.error(chalk.red(`未找到站点: ${options.target}. 可用站点:`));
        allSites.forEach((s) => console.log(`  ${chalk.cyan(s.id)} - ${s.name}`));
        process.exit(1);
      }

      console.log(chalk.bold.yellow(`\n[单站点测试] ${site.name} (${site.id})`));
      const result = await this.scheduler.runSingleSite(options.target, {
        maxArticles: options.maxArticles || 10,
        onProgress: (p) => {
          console.log(
            chalk.gray(
              `  ${p.current}/${p.total} | 成功:${chalk.green(p.success)} 失败:${chalk.red(p.failed)}`
            )
          );
        }
      });

      this._printSingleSiteResult(result);
    } else {
      if (options.schedule) {
        this.scheduler.registerJobs();
        console.log(chalk.green('\n✓ 定时任务已注册。等待执行... (Ctrl+C 退出)'));
        console.log(chalk.gray('已配置定时任务:'));
        this.scheduler.listJobs().forEach((j) => {
          console.log(`  ${chalk.cyan(j.name)} - cron: ${j.cron} - 下次: ${dayjs(j.nextRun).format('YYYY-MM-DD HH:mm')}`);
        });

        this._setupGracefulShutdown();
        return;
      }

      console.log(chalk.bold.magenta(`\n[全量巡检] 开始执行 ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`));
      const result = await this.scheduler.runNow(options.roundName || '手动巡检');
      this._printRoundResult(result);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const crawlerStats = await this.crawler.getStats();
    console.log(chalk.cyan(`\n爬虫统计: 请求${crawlerStats.totalRequests} 成功率${crawlerStats.successRate} 耗时${elapsed}s`));
  }

  async cmdReport(options) {
    const period = options.period || 'day';
    const formats = options.format
      ? options.format.split(',').map((f) => f.trim())
      : ['pdf', 'excel'];

    console.log(chalk.bold.cyan(`\n[生成报告] 周期: ${period}报 | 格式: ${formats.join(', ')}`));

    const result = await this.reporter.generateReport(period, formats);

    const table = new Table({
      head: [chalk.cyan('项目'), chalk.cyan('数值')],
      colWidths: [25, 55]
    });

    table.push(
      ['报告编号', result.reportId.slice(0, 12)],
      ['统计范围', `${result.dateRange.start} ~ ${result.dateRange.end.split(' ')[0]}`],
      ['监测站点', `${result.summary.monitoredSites} 个`],
      ['原创稿件', `${result.summary.originalArticles.toLocaleString()} 篇`],
      [chalk.red('侵权匹配'), `${result.summary.totalMatches.toLocaleString()} 条`],
      [chalk.red('  疑似侵权'), `${chalk.bold(result.summary.suspectedCount.toLocaleString())} 条`],
      [chalk.red('  确认侵权'), `${result.summary.confirmedCount.toLocaleString()} 条`],
      ['涉及站点', `${result.summary.sitesInvolved} 个`]
    );

    console.log('\n' + table.toString());

    console.log(chalk.green('\n✓ 已生成报告文件:'));
    for (const f of result.generatedFiles) {
      console.log(`  ${chalk.bold('[' + f.format.toUpperCase() + ']')} ${f.path}`);
    }

    if (options.evidence && result.matches.length > 0) {
      console.log(chalk.cyan('\n正在生成证据包 (TOP 3)...'));
      for (const m of result.matches.slice(0, 3)) {
        try {
          const ev = await this.reporter.generateEvidencePackage(m.match_id);
          console.log(`  ${chalk.green('✓')} ${m.match_id.slice(0, 8)} -> ${ev.package_path}`);
        } catch (e) {
          console.log(`  ${chalk.red('✗')} ${m.match_id.slice(0, 8)}: ${e.message}`);
        }
      }
    }
  }

  async cmdStatus() {
    console.log(chalk.bold.cyan('\n[系统状态] ') + dayjs().format('YYYY-MM-DD HH:mm:ss'));

    console.log(chalk.bold.yellow('\n▌ 系统健康检查'));
    console.log(this.monitor.renderSystemHealthTable());

    console.log(chalk.bold.yellow('\n▌ 数据统计汇总'));
    const storageStats = await this.monitor.getStorageStats();
    console.log(this.monitor.renderInfringementSummary(storageStats));

    console.log(chalk.bold.yellow('\n▌ 监控站点状态'));
    const sites = await this.monitor.getSiteStatus();
    console.log(this.monitor.renderSitesTable(sites));

    const schedStatus = this.monitor.getSchedulerStatus();
    if (schedStatus) {
      console.log(chalk.bold.yellow('\n▌ 调度器状态'));
      if (schedStatus.isRunning) {
        const run = schedStatus.currentRun || {};
        console.log(chalk.green(`  当前正在执行: ${run.round || '未知任务'}`));
        if (run.totalArticles) {
          console.log(`  进度: ${run.totalArticles}链接 ${run.totalSuccess || 0}成功 ${run.totalFailed || 0}失败`);
          console.log(`  疑似侵权: ${chalk.red(run.suspectedCount || 0)} 条`);
        }
      } else {
        console.log(chalk.gray('  当前无运行中的任务'));
      }

      if (schedStatus.nextRuns.length > 0) {
        console.log(chalk.cyan('  即将执行:'));
        schedStatus.nextRuns.forEach((r) => {
          console.log(`    ${r.name} - ${dayjs(r.nextRun).format('YYYY-MM-DD HH:mm')}`);
        });
      }
    }

    const alerts = await this.monitor.checkAlerts();
    if (alerts.length > 0) {
      console.log(chalk.bold.red('\n▌ 告警信息'));
      for (const a of alerts) {
        const color = a.level === 'critical' ? chalk.red.bold : chalk.yellow;
        console.log(`  ${color('[' + a.level + ']')} [${a.type}] ${a.message}`);
      }
    } else {
      console.log(chalk.bold.green('\n▌ 告警: 无异常 ✓'));
    }
  }

  async cmdMatches(options) {
    const start = options.from || dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    const end = options.to || dayjs().format('YYYY-MM-DD 23:59:59');

    const matches = await this.storage.getSuspectedMatches({
      siteId: options.site || null,
      startDate: start + ' 00:00:00',
      endDate: end,
      limit: options.limit ? parseInt(options.limit) : 50
    });

    console.log(chalk.bold.cyan(`\n[疑似侵权列表] ${start} ~ ${end} | 共 ${matches.length} 条`));
    if (matches.length === 0) {
      console.log(chalk.gray('  暂无匹配记录'));
      return;
    }

    const typeLabels = {
      exact_copy: chalk.red('原文照搬'),
      substantial_copy: chalk.red('大量抄袭'),
      partial_rewrite: chalk.yellow('改头换面'),
      title_copy: chalk.yellow('标题复制'),
      content_fragment: chalk.cyan('拼凑剪辑'),
      weak_similarity: chalk.gray('弱相似')
    };

    const table = new Table({
      head: [
        chalk.bold('#'),
        chalk.bold('类型'),
        chalk.bold('站点'),
        chalk.bold('原创标题'),
        chalk.bold('标题%'),
        chalk.bold('正文%'),
        chalk.bold('发现时间')
      ],
      colWidths: [4, 10, 12, 35, 8, 8, 18],
      wordWrap: true
    });

    matches.forEach((m, idx) => {
      table.push([
        idx + 1,
        typeLabels[m.match_type] || m.match_type,
        m.site_name || m.site_id,
        (m.original_title || '').slice(0, 30),
        (m.title_similarity * 100).toFixed(0) + '%',
        (m.content_similarity * 100).toFixed(0) + '%',
        dayjs(m.created_at).format('MM-DD HH:mm')
      ]);
    });

    console.log(table.toString());

    if (options.export) {
      const report = await this.reporter.generateReport('day', ['excel']);
      console.log(chalk.green(`\n已导出: ${report.generatedFiles.find((f) => f.format === 'excel').path}`));
    }
  }

  async cmdEvidence(matchId) {
    console.log(chalk.cyan(`\n[生成证据包] ${matchId}`));
    try {
      const evidence = await this.reporter.generateEvidencePackage(matchId);
      console.log(chalk.green('✓ 证据包生成成功!'));
      console.log(`  证据ID: ${evidence.evidence_id}`);
      console.log(`  SHA256: ${evidence.hash_value}`);
      console.log(`  路径: ${evidence.package_path}`);
      console.log(`  截图: ${evidence.screenshot_path || '(无)'}`);
    } catch (err) {
      console.error(chalk.red(`失败: ${err.message}`));
      process.exit(1);
    }
  }

  async cmdListSites(category = null) {
    const allSites = this.scheduler.getAllSites();
    let sites = allSites;

    if (category) {
      sites = allSites.filter((s) => s.category === category);
    }

    console.log(chalk.bold.cyan(`\n[监控站点列表] 共 ${sites.length} 个`));

    const byCategory = {};
    for (const s of sites) {
      if (!byCategory[s.category]) byCategory[s.category] = [];
      byCategory[s.category].push(s);
    }

    for (const [cat, list] of Object.entries(byCategory)) {
      const catName = sitesConfig.categories.find((c) => c.id === cat)?.name || cat;
      console.log(chalk.bold.yellow(`\n▌ ${catName} (${list.length}个)`));

      const table = new Table({
        head: [chalk.cyan('ID'), chalk.cyan('名称'), chalk.cyan('优先级'), chalk.cyan('域名'), chalk.cyan('分页类型')],
        colWidths: [14, 16, 10, 28, 12]
      });

      list.forEach((s) => {
        const prio = s.priority === 1
          ? chalk.red('P1 高')
          : s.priority === 2
            ? chalk.yellow('P2 中')
            : chalk.cyan('P3 低');
        const ptype = s.infiniteScroll
          ? chalk.cyan('无限滚动')
          : chalk.yellow('分页');
        table.push([s.id, s.name, prio, s.domain || '-', ptype]);
      });

      console.log(table.toString());
    }
  }

  async cmdInteractive() {
    console.log(chalk.bold.green('\n进入交互模式 (输入 help 查看命令, exit 退出)'));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    this._setupGracefulShutdown();

    const showHelp = () => {
      const cmds = [
        ['status', '查看系统状态'],
        ['sites [cat]', '查看监控站点 [按分类过滤]'],
        ['crawl <id>', '抓取单个站点 (如: crawl toutiao)'],
        ['crawl-all', '执行全量巡检'],
        ['matches [-n N]', '查看疑似侵权列表'],
        ['report [day|week|month]', '生成报告'],
        ['import <file>', '导入稿件 JSON'],
        ['evidence <id>', '生成指定证据包'],
        ['help', '显示帮助'],
        ['exit', '退出系统']
      ];
      const t = new Table({ head: [chalk.cyan('命令'), chalk.cyan('说明')], colWidths: [22, 45] });
      cmds.forEach((c) => t.push(c));
      console.log(t.toString());
    };

    const question = (q) => new Promise((res) => rl.question(chalk.cyan('monitor> ') + q, res));

    const handleCommand = async (line) => {
      const parts = line.trim().split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      try {
        switch (cmd) {
          case 'status':
          case 'st':
            await this.cmdStatus();
            break;
          case 'sites':
            await this.cmdListSites(args[0] || null);
            break;
          case 'crawl':
            if (!args[0]) {
              console.log(chalk.red('请指定站点ID，使用 sites 查看可用站点'));
            } else {
              await this.crawler.init();
              const r = await this.scheduler.runSingleSite(args[0], { maxArticles: parseInt(args[1]) || 5 });
              this._printSingleSiteResult(r);
            }
            break;
          case 'crawl-all':
            await this.crawler.init();
            const result = await this.scheduler.runNow('交互式巡检');
            this._printRoundResult(result);
            break;
          case 'matches': {
            const opts = {};
            for (let i = 0; i < args.length; i++) {
              if (args[i] === '-n' && args[i + 1]) opts.limit = args[++i];
              if (args[i] === '-s' && args[i + 1]) opts.site = args[++i];
            }
            await this.cmdMatches(opts);
            break;
          }
          case 'report':
            await this.cmdReport({ period: args[0] || 'day', format: 'pdf,excel' });
            break;
          case 'import':
            if (!args[0]) console.log(chalk.red('请指定文件路径'));
            else await this.cmdImport(args[0]);
            break;
          case 'evidence':
            if (!args[0]) console.log(chalk.red('请指定匹配ID'));
            else await this.cmdEvidence(args[0]);
            break;
          case 'help':
          case '?':
            showHelp();
            break;
          case 'exit':
          case 'quit':
          case 'q':
            rl.close();
            await this.shutdown();
            process.exit(0);
          case '':
            break;
          default:
            console.log(chalk.red(`未知命令: ${cmd}，输入 help 查看可用命令`));
        }
      } catch (err) {
        console.error(chalk.red(`执行错误: ${err.message}`));
        if (program.verbose) console.error(err.stack);
      }

      setTimeout(runLoop, 100);
    };

    const runLoop = async () => {
      const line = await question('');
      await handleCommand(line);
    };

    runLoop();
  }

  _printSingleSiteResult(result) {
    console.log('\n' + chalk.bold('单站点测试结果:'));
    const table = new Table({ colWidths: [20, 60] });
    table.push(
      ['站点', `${result.siteName} (${result.siteId})`],
      ['状态', result.success ? chalk.green('成功') : chalk.red('失败')],
      ['抓取链接', result.totalLinks || 0],
      ['成功抓取', chalk.green(result.successCount || 0)],
      ['抓取失败', chalk.red(result.failedCount || 0)],
      ['疑似侵权', chalk.red(result.suspectedCount || 0)],
      ['耗时', `${result.durationSeconds || 0}秒`]
    );
    if (result.error) table.push([chalk.red('错误'), result.error]);
    console.log(table.toString());
  }

  _printRoundResult(result) {
    if (!result) return;
    console.log(chalk.bold.green(`\n═════════ 巡检结束 [${result.round || ''}] ═════════`));
    const table = new Table({ colWidths: [20, 60] });
    table.push(
      ['轮次ID', result.taskId ? result.taskId.slice(0, 12) : '-'],
      ['总链接数', (result.totalArticles || 0).toLocaleString()],
      ['成功抓取', chalk.green((result.totalSuccess || 0).toLocaleString())],
      ['抓取失败', chalk.red((result.totalFailed || 0).toLocaleString())],
      [chalk.bold.red('疑似侵权数'), chalk.bold.red((result.suspectedCount || 0).toLocaleString())],
      ['总耗时', `${result.durationSeconds || 0}秒 (${Math.floor((result.durationSeconds || 0) / 60)}分)`]
    );
    console.log(table.toString());
  }

  _setupGracefulShutdown() {
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\n收到中断信号，正在关闭...'));
      if (this.scheduler) this.scheduler.cancelAllJobs();
      await this.shutdown();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      console.log(chalk.yellow('\n收到终止信号，正在关闭...'));
      await this.shutdown();
      process.exit(0);
    });
  }
}

program
  .name('copyright-monitor')
  .description('新闻版权监控系统 - 自动化侵权转载监测与取证平台')
  .version('1.0.0')
  .option('-v, --verbose', '输出详细调试日志')
  .hook('preSubcommand', async () => {
    if (program.verbose) {
      config.logging.level = 'debug';
      config.logging.consoleLevel = 'debug';
    }
  });

program
  .command('import <file>')
  .description('从JSON文件导入原创稿件到稿件库')
  .action(async (file) => {
    const app = new CopyrightMonitorApp();
    await app.init();
    try {
      await app.cmdImport(file);
    } finally {
      await app.storage.close();
    }
  });

program
  .command('crawl')
  .description('执行抓取巡检任务')
  .option('-t, --target <siteId>', '指定单个站点进行测试抓取')
  .option('-n, --max-articles <number>', '单站点最大抓取条数 (默认200)')
  .option('-s, --schedule', '启动定时调度模式，按配置时间执行')
  .option('-r, --round-name <name>', '自定义轮次名称')
  .action(async (options) => {
    const app = new CopyrightMonitorApp();
    await app.init();
    try {
      await app.cmdCrawl(options);
    } finally {
      if (!options.schedule) await app.shutdown();
    }
  });

program
  .command('report')
  .description('生成侵权统计报告')
  .option('-p, --period <period>', '报告周期: day(日报)/week(周报)/month(月报)', 'day')
  .option('-f, --format <formats>', '输出格式 (pdf,excel)，逗号分隔', 'pdf,excel')
  .option('-e, --evidence', '同时生成TOP侵权证据包')
  .action(async (options) => {
    const app = new CopyrightMonitorApp();
    await app.init();
    try {
      await app.cmdReport(options);
    } finally {
      await app.storage.close();
    }
  });

program
  .command('status')
  .description('查看系统状态、站点健康情况与统计数据')
  .action(async () => {
    const app = new CopyrightMonitorApp();
    await app.init();
    try {
      await app.cmdStatus();
    } finally {
      await app.storage.close();
    }
  });

program
  .command('matches')
  .description('查看疑似侵权匹配记录')
  .option('-s, --site <siteId>', '按站点过滤')
  .option('-f, --from <date>', '起始日期 YYYY-MM-DD')
  .option('-t, --to <date>', '结束日期 YYYY-MM-DD')
  .option('-n, --limit <number>', '返回条数上限', '50')
  .option('-e, --export', '导出为Excel')
  .action(async (options) => {
    const app = new CopyrightMonitorApp();
    await app.init();
    try {
      await app.cmdMatches(options);
    } finally {
      await app.storage.close();
    }
  });

program
  .command('evidence <matchId>')
  .description('为指定匹配记录生成司法取证证据包')
  .action(async (matchId) => {
    const app = new CopyrightMonitorApp();
    await app.init();
    try {
      await app.cmdEvidence(matchId);
    } finally {
      await app.storage.close();
    }
  });

program
  .command('sites [category]')
  .description('查看监控站点列表 (分类: mainstream/aggregator/provincial)')
  .action(async (category) => {
    const app = new CopyrightMonitorApp();
    await app.init();
    await app.cmdListSites(category);
    await app.storage.close();
  });

program
  .command('interactive')
  .alias('i')
  .description('启动交互式控制台 (完整功能模式)')
  .action(async () => {
    const app = new CopyrightMonitorApp();
    await app.init();
    await app.cmdInteractive();
  });

program.parseAsync(process.argv).catch(async (err) => {
  console.error(chalk.red('\n✗ 执行失败: ' + err.message));
  if (program.verbose) console.error(err.stack);
  process.exit(1);
});
