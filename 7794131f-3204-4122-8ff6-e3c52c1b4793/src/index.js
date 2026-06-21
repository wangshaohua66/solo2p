#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { setVerbose, logger } = require('./utils/logger');
const { CollectorOrchestrator } = require('./CollectorOrchestrator');
const { MultiFormatParser } = require('./parsers/MultiFormatParser');
const { FieldMapper, STANDARD_FIELDS } = require('./transformers/FieldMapper');
const { SchemaValidator } = require('./validators/SchemaValidator');
const { ErrorHandler, ERROR_CODES } = require('./handlers/ErrorHandler');
const { DuplicateChecker } = require('./utils/duplicateChecker');
const { ensureDataDirs } = require('./utils/common');

const program = new Command();

program
  .name('reg-collector')
  .description('金融监管数据自动化报送归集工具')
  .version('1.0.0')
  .option('-v, --verbose', '输出详细调试信息')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) setVerbose(true);
    ensureDataDirs();
  });

program
  .command('collect')
  .description('执行采集任务（默认全量）')
  .option('-o, --org <orgId>', '指定单个机构ID采集')
  .option('-t, --type <collectionType>', '指定采集方式: email|api')
  .option('--org-type <orgType>', '指定机构类型: micro_loan|financing_guarantee|pawnshop|equity_market|asset_management')
  .option('-n, --dry-run', '演练模式，不实际推送监管系统')
  .option('-f, --force', '强制执行（忽略节假日/周末）')
  .option('--no-push', '仅采集处理，不推送监管系统')
  .option('--no-dedup', '不检查重复报送')
  .action(async (opts) => {
    try {
      const orchestrator = new CollectorOrchestrator({
        dryRun: opts.dryRun,
        pushToRegulator: opts.push !== false,
        skipDuplicate: opts.dedup !== false
      });
      const result = await orchestrator.run({
        orgId: opts.org,
        collectionType: opts.type,
        type: opts.orgType,
        force: opts.force
      });
      process.exit(result.success ? 0 : 1);
    } catch (e) {
      logger.error(chalk.red(`采集执行异常: ${e.message}`));
      logger.debug(e.stack);
      process.exit(2);
    }
  });

program
  .command('daemon')
  .description('启动定时调度服务（按cron配置自动执行）')
  .option('-n, --dry-run', '演练模式')
  .action(async (opts) => {
    try {
      const orchestrator = new CollectorOrchestrator({
        dryRun: opts.dryRun,
        pushToRegulator: true
      });
      orchestrator.startScheduler();
      process.on('SIGINT', () => {
        logger.info(chalk.yellow('\n收到停止信号，正在关闭调度器...'));
        orchestrator.stopScheduler();
        process.exit(0);
      });
    } catch (e) {
      logger.error(chalk.red(`调度服务启动失败: ${e.message}`));
      process.exit(2);
    }
  });

program
  .command('parse <file>')
  .description('解析单个文件，输出解析结果')
  .option('-f, --format <format>', '指定文件格式 excel|csv|json|xml，默认按扩展名识别')
  .option('-e, --encoding <encoding>', '文件编码，默认auto检测')
  .option('-j, --json', '以JSON格式输出')
  .action(async (filePath, opts) => {
    try {
      const parser = new MultiFormatParser();
      const result = await parser.parse(filePath, { format: opts.format, encoding: opts.encoding });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.green(`\n✓ 文件解析成功`));
        console.log(`  格式: ${chalk.cyan(result.format)}`);
        console.log(`  记录数: ${chalk.cyan(result.recordCount)}`);
        console.log(`  解析耗时: ${chalk.cyan(result.parseDurationMs + 'ms')}`);
        if (result.recordCount > 0) {
          const sample = result.records[0];
          const fields = Object.keys(sample).filter((k) => !k.startsWith('_'));
          console.log(`  字段数: ${chalk.cyan(fields.length)}`);
          console.log(`  字段列表: ${chalk.gray(fields.join(', '))}`);
          console.log(chalk.gray('\n  首条记录预览:'));
          for (const field of fields.slice(0, 10)) {
            console.log(`    ${chalk.magenta(field)}: ${sample[field]}`);
          }
          if (fields.length > 10) console.log(chalk.gray(`    ... 省略${fields.length - 10}个字段`));
        }
      }
    } catch (e) {
      logger.error(chalk.red(`解析失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('map [file]')
  .description('测试字段映射')
  .requiredOption('-o, --org <orgId>', '机构ID (查看内置映射规则)')
  .option('-l, --list', '仅列出机构的字段映射规则')
  .option('-s, --standard', '列出全部标准字段定义')
  .action(async (filePath, opts) => {
    if (opts.standard) {
      console.log(chalk.bold('\n标准字段定义 (' + Object.keys(STANDARD_FIELDS).length + '项):\n'));
      for (const [key, schema] of Object.entries(STANDARD_FIELDS)) {
        const req = schema.required ? chalk.red('[必填]') : chalk.gray('[可选]');
        console.log(`  ${chalk.cyan(key.padEnd(28))} ${chalk.magenta(schema.type.padEnd(8))} ${req} ${schema.label}`);
      }
      return;
    }
    if (opts.list) {
      const mappings = FieldMapper.getOrgMappings(opts.org);
      if (Object.keys(mappings).length === 0) {
        console.log(chalk.yellow(`机构 ${opts.org} 暂无专属映射规则，将使用模糊匹配`));
      } else {
        console.log(chalk.bold(`\n机构 [${opts.org}] 字段映射规则 (${Object.keys(mappings).length}项):\n`));
        for (const [src, dst] of Object.entries(mappings)) {
          console.log(`  ${chalk.yellow(src.padEnd(24))} → ${chalk.green(dst)}`);
        }
      }
      return;
    }
    if (!filePath) {
      console.log(chalk.red('请指定文件路径或使用 --list/--standard'));
      process.exit(1);
    }
    try {
      const parser = new MultiFormatParser();
      const parsed = await parser.parse(filePath);
      const mapper = new FieldMapper(opts.org);
      const result = mapper.transform(parsed.records, { orgId: opts.org });
      console.log(chalk.green(`\n✓ 字段映射完成`));
      console.log(`  记录数: ${chalk.cyan(result.recordCount)}`);
      console.log(`  转换字段值: ${chalk.cyan(result.transformedFields)}`);
      if (result.unmappedFields.length > 0) {
        console.log(chalk.yellow(`  未映射字段 (${result.unmappedFields.length}): ${result.unmappedFields.join(', ')}`));
      }
      console.log(chalk.gray('\n  映射后首条记录预览:'));
      const sample = result.records[0] || {};
      for (const [key, val] of Object.entries(sample)) {
        if (!key.startsWith('_')) {
          console.log(`    ${chalk.magenta(key.padEnd(24))}: ${val}`);
        }
      }
    } catch (e) {
      logger.error(chalk.red(`映射失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('validate [file]')
  .description('执行数据合规校验')
  .requiredOption('-o, --org <orgId>', '机构ID')
  .option('-r, --report', '输出完整校验报告')
  .option('-f, --fail-on-error', '存在错误即返回非零退出码')
  .action(async (filePath, opts) => {
    try {
      if (!filePath) {
        console.log(chalk.yellow('提示: 指定文件路径可对其内容进行校验'));
      }
      let records = [];
      if (filePath) {
        const parser = new MultiFormatParser();
        const parsed = await parser.parse(filePath);
        const mapper = new FieldMapper(opts.org);
        const mapped = mapper.transform(parsed.records, { orgId: opts.org });
        records = mapped.records;
      }
      const validator = new SchemaValidator({ failOnError: opts.failOnError });
      const result = validator.validate(records, { orgId: opts.org });
      if (opts.report || result.errorCount > 0) {
        console.log('\n' + validator.generateReport(result));
      } else {
        console.log(chalk.green(`\n✓ 校验通过`));
        console.log(`  总行数: ${chalk.cyan(result.totalRows)}`);
        console.log(`  有效行数: ${chalk.cyan(result.validRows)}`);
        console.log(`  错误数: ${chalk.cyan(result.errorCount)}`);
        console.log(`  警告数: ${chalk.cyan(result.warningCount)}`);
      }
      process.exit(result.success ? 0 : 1);
    } catch (e) {
      logger.error(chalk.red(`校验失败: ${e.message}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('查看采集系统状态')
  .option('-d, --detail', '显示失败任务明细')
  .action((opts) => {
    const orchestrator = new CollectorOrchestrator();
    const status = orchestrator.status({ detail: opts.detail });
    console.log(chalk.bold('\n采集系统状态:\n'));
    console.log(`  业务日期: ${chalk.cyan(status.businessDate)}`);
    console.log(`  配置机构数: ${chalk.cyan(status.configuredOrgs)}`);
    console.log(`  失败队列: ${chalk.yellow(status.failedQueue)} (可重试: ${chalk.green(status.retryable)})`);
    console.log(`  本次失败次数: ${chalk.red(status.recentFailures)}`);
    if (opts.detail && status.failedItems && status.failedItems.length > 0) {
      console.log(chalk.bold('\n失败任务明细:'));
      status.failedItems.forEach((item, idx) => {
        console.log(`  ${idx + 1}. [${item.code}] ${item.orgId} ${item.orgName} - ${item.message}`);
        if (item.fileName) console.log(`     文件: ${item.fileName}`);
        console.log(`     重试: ${item.retries}/${3}  首次: ${item.firstFailedAt}`);
      });
    }
  });

program
  .command('retry')
  .description('重试失败队列中的任务')
  .option('-i, --id <taskId>', '重试指定任务ID')
  .option('-a, --all', '重试全部可重试任务')
  .option('-c, --clear', '清空失败队列')
  .action((opts) => {
    const orchestrator = new CollectorOrchestrator();
    if (opts.clear) {
      orchestrator.errorHandler.clearQueue();
      console.log(chalk.green('失败队列已清空'));
      return;
    }
    const retryable = orchestrator.retryFailed();
    if (Array.isArray(retryable) && retryable.length > 0) {
      console.log(chalk.yellow(`\n共 ${retryable.length} 项可重试任务，建议执行 reg-collector collect 重新采集`));
      retryable.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.id} [${item.code}] ${item.orgId} - ${item.message}`);
      });
    }
  });

program
  .command('report')
  .description('生成采集报告')
  .option('-p, --period <period>', '报告周期: day|week|month，默认week', 'week')
  .action((opts) => {
    const orchestrator = new CollectorOrchestrator();
    const report = orchestrator.generateReport(opts.period);
    console.log(report);
  });

program
  .command('errors')
  .description('查看错误代码说明')
  .option('-c, --code <code>', '查看指定错误代码')
  .action((opts) => {
    if (opts.code) {
      const err = ERROR_CODES[opts.code.toUpperCase()];
      if (!err) {
        console.log(chalk.red(`未找到错误代码: ${opts.code}`));
        process.exit(1);
      }
      console.log(chalk.bold(`\n[${err.code}] ${err.message}`));
      console.log(`  级别: ${chalk.red(err.level.toUpperCase())}`);
      console.log(`  建议: ${chalk.green(err.suggestion)}`);
      return;
    }
    console.log(chalk.bold('\n支持的错误代码 (' + Object.keys(ERROR_CODES).length + '项):\n'));
    for (const [code, info] of Object.entries(ERROR_CODES)) {
      const levelTag = info.level === 'error'
        ? chalk.red(' ERROR ')
        : info.level === 'warn'
          ? chalk.yellow(' WARN  ')
          : chalk.blue(' INFO  ');
      console.log(`  ${levelTag} ${chalk.magenta(code.padEnd(28))} ${info.message}`);
    }
    console.log(chalk.gray('\n使用 reg-collector errors -c <错误代码> 查看详细建议'));
  });

program
  .command('dedup')
  .description('管理重复报送检查')
  .option('-l, --list <orgId>', '列出指定机构已处理记录')
  .option('-d, --date <date>', '按日期查询 (YYYY-MM-DD)')
  .option('-c, --cleanup <days>', '清理N天前的去重记录')
  .action((opts) => {
    const checker = new DuplicateChecker();
    if (opts.cleanup) {
      const removed = checker.cleanup(parseInt(opts.cleanup, 10));
      console.log(chalk.green(`已清理 ${removed} 条过期记录 (保留${opts.cleanup}天)`));
      return;
    }
    let records = [];
    if (opts.list) {
      records = checker.getOrgRecords(opts.list);
    } else if (opts.date) {
      records = checker.getDateRecords(opts.date);
    }
    if (records.length === 0) {
      console.log(chalk.yellow('暂无匹配的去重记录'));
      return;
    }
    console.log(chalk.bold(`\n去重记录 (${records.length}条):\n`));
    records.forEach((r, idx) => {
      const typeTag = r.submissionType === 'new' ? chalk.green('NEW') : chalk.yellow(r.submissionType.toUpperCase());
      console.log(`  ${idx + 1}. [${typeTag}] ${r.orgId} ${r.businessDate} ${r.filename} (${r.recordCount}条)`);
    });
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error(chalk.red(`命令执行异常: ${err.message}`));
  process.exit(2);
});
