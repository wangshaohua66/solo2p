const cron = require('node-cron');
const cliProgress = require('cli-progress');
const { logger, chalk, verbose, setVerbose } = require('./utils/logger');
const {
  ensureDataDirs,
  formatDuration,
  formatFileSize,
  generateId,
  businessDate,
  shouldSkipToday
} = require('./utils/common');
const { EmailCollector } = require('./collectors/EmailCollector');
const { ApiCollector } = require('./collectors/ApiCollector');
const { MultiFormatParser } = require('./parsers/MultiFormatParser');
const { FieldMapper } = require('./transformers/FieldMapper');
const { SchemaValidator } = require('./validators/SchemaValidator');
const { RegulatorPusher } = require('./pushers/RegulatorPusher');
const { ErrorHandler } = require('./handlers/ErrorHandler');
const { DuplicateChecker } = require('./utils/duplicateChecker');
const { organizations, performanceConfig, paths } = require('../config/schedule');

class CollectorOrchestrator {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      pushToRegulator: true,
      skipDuplicate: true,
      saveReports: true,
      ...options
    };
    this.parser = new MultiFormatParser();
    this.validator = new SchemaValidator({ failOnError: false });
    this.pusher = new RegulatorPusher();
    this.errorHandler = new ErrorHandler();
    this.duplicateChecker = new DuplicateChecker();
    this.taskResults = [];
    this._runningTasks = new Map();
    ensureDataDirs();
  }

  _filterOrganizations(filter = {}) {
    return organizations.filter((org) => {
      if (filter.orgId && org.id !== filter.orgId) return false;
      if (filter.type && org.type !== filter.type) return false;
      if (filter.collectionType && org.collectionMethod !== filter.collectionType) return false;
      return true;
    });
  }

  async _processSingleFile(fileMeta, orgConfig, progress) {
    const orgId = orgConfig.id;
    const orgName = orgConfig.name;
    const { filePath, filename } = fileMeta;
    const stageContext = {
      orgId,
      orgName,
      filePath,
      fileName: filename,
      source: fileMeta.source
    };

    try {
      if (this.options.skipDuplicate) {
        const dupCheck = await this.duplicateChecker.isDuplicate(filePath, orgId, {
          filename,
          businessDate: businessDate()
        });
        if (dupCheck.isDuplicate && dupCheck.submissionType === 'duplicate') {
          this.errorHandler.handle(
            Object.assign(new Error(`重复报送已跳过: ${filename}`), { code: 'DUPLICATE_SUBMISSION' }),
            { ...stageContext, stage: '去重检查' }
          );
          progress?.increment?.(1);
          return { skipped: true, reason: 'duplicate', file: filename };
        }
        stageContext.fileMd5 = dupCheck.fileMd5;
        stageContext.submissionType = dupCheck.submissionType;
      }

      verbose(`[${orgId}] 解析文件: ${filename}`);
      const parseResult = await this.parser.parse(filePath, { filename });
      verbose(`[${orgId}] 解析完成: ${parseResult.recordCount}条记录`);

      const mapper = new FieldMapper(orgId);
      const mapResult = mapper.transform(parseResult.records, {
        orgId,
        orgName,
        reportDate: businessDate(),
        businessDate: businessDate()
      });
      if (mapResult.unmappedFields && mapResult.unmappedFields.length > 0) {
        this.errorHandler.handle(
          Object.assign(new Error(`未映射字段: ${mapResult.unmappedFields.join(', ')}`), { code: 'FIELD_MAPPING_INCOMPLETE' }),
          { ...stageContext, stage: '字段映射' }
        );
      }

      const validationResult = this.validator.validate(mapResult.records, { orgId });
      if (this.options.saveReports && validationResult.errorCount > 0) {
        const fs = require('fs');
        const path = require('path');
        const reportDir = require('path').join(paths.data.processed, orgId);
        require('./utils/common').ensureDir(reportDir);
        const reportPath = path.join(reportDir, `${businessDate()}_validation_${generateId().substring(0, 6)}.txt`);
        fs.writeFileSync(reportPath, this.validator.generateReport(validationResult));
        verbose(`[${orgId}] 校验报告已保存: ${reportPath}`);
      }

      const recordsToPush = validationResult.validRecords || [];
      let pushResult = { success: true, skipped: true, pushedCount: 0 };
      if (this.options.pushToRegulator && !this.options.dryRun && recordsToPush.length > 0) {
        pushResult = await this.pusher.push(recordsToPush, {
          orgId,
          orgName,
          businessDate: businessDate()
        });
        this.pusher.savePushResult(pushResult, { orgId, businessDate: businessDate() });
      }

      this.duplicateChecker.markProcessed(filePath, orgId, { filename }, {
        fileMd5: stageContext.fileMd5,
        recordCount: recordsToPush.length,
        status: pushResult.success ? 'success' : 'partial'
      });

      progress?.increment?.(1);

      return {
        success: true,
        skipped: false,
        file: filename,
        format: parseResult.format,
        parsedRecords: parseResult.recordCount,
        validRecords: recordsToPush.length,
        errors: validationResult.errorCount,
        warnings: validationResult.warningCount,
        pushed: pushResult.pushedCount || 0,
        parseDurationMs: parseResult.parseDurationMs,
        transformDurationMs: mapResult.transformDurationMs,
        validateDurationMs: validationResult.validateDurationMs,
        pushDurationMs: pushResult.pushDurationMs || 0
      };
    } catch (err) {
      this.errorHandler.handle(err, { ...stageContext, stage: stageContext.stage || '文件处理' });
      progress?.increment?.(1);
      return {
        success: false,
        skipped: false,
        file: filename,
        error: err.message
      };
    }
  }

  async _collectAndProcessOrg(orgConfig, globalProgress) {
    const orgId = orgConfig.id;
    const orgName = orgConfig.name;
    const method = orgConfig.collectionMethod;
    logger.info(chalk.cyan(`\n━━━ 处理机构 [${orgId}] ${orgName} (${method}) ━━━`));

    try {
      let collectResult;
      if (method === 'email') {
        const collector = new EmailCollector(orgConfig);
        collectResult = await collector.collect({ sinceDate: new Date() });
      } else if (method === 'api') {
        const collector = new ApiCollector(orgConfig);
        collectResult = await collector.collect({ businessDate: businessDate() });
      } else {
        throw new Error(`不支持的采集方式: ${method}`);
      }

      const files = collectResult.files || [];
      logger.info(`[${orgId}] 采集完成: ${collectResult.fileCount || 0}个文件, ${collectResult.recordCount || 0}条记录`);

      if (files.length === 0) {
        this.taskResults.push({
          orgId,
          orgName,
          method,
          success: true,
          fileCount: 0,
          note: '无采集文件'
        });
        return { orgId, success: true, processedFiles: 0 };
      }

      const fileProgress = new cliProgress.SingleBar(
        {
          format: `  ${chalk.cyan(orgId)} 处理文件 {bar} {value}/{total} | {filename}`,
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true
        },
        cliProgress.Presets.shades_classic
      );
      fileProgress.start(files.length, 0, { filename: '' });

      const fileResults = [];
      for (const fileMeta of files) {
        fileProgress.update({ filename: fileMeta.filename });
        const result = await this._processSingleFile(fileMeta, orgConfig, fileProgress);
        fileResults.push(result);
      }
      fileProgress.stop();

      const successCount = fileResults.filter((r) => r.success && !r.skipped).length;
      const skippedCount = fileResults.filter((r) => r.skipped).length;
      const failedCount = fileResults.filter((r) => !r.success).length;
      const totalValidRecords = fileResults.reduce((sum, r) => sum + (r.validRecords || 0), 0);
      const totalPushed = fileResults.reduce((sum, r) => sum + (r.pushed || 0), 0);

      const orgSummary = {
        orgId,
        orgName,
        method,
        success: failedCount === 0,
        fileCount: files.length,
        successCount,
        skippedCount,
        failedCount,
        validRecords: totalValidRecords,
        pushedRecords: totalPushed,
        fileResults,
        collectDurationMs: collectResult.durationMs || 0
      };
      this.taskResults.push(orgSummary);

      logger.info(chalk.green(
        `[${orgId}] 处理完成: 成功${successCount}, 跳过${skippedCount}, 失败${failedCount}, 有效记录${totalValidRecords}, 推送${totalPushed}`
      ));
      globalProgress?.increment?.(1);
      return orgSummary;
    } catch (err) {
      this.errorHandler.handle(err, { orgId, orgName, stage: '机构采集' });
      this.taskResults.push({ orgId, orgName, method, success: false, error: err.message });
      globalProgress?.increment?.(1);
      return { orgId, success: false, error: err.message };
    }
  }

  async run(options = {}) {
    const startTime = Date.now();
    logger.info(chalk.bold.green('\n╔══════════════════════════════════════════════════════╗'));
    logger.info(chalk.bold.green('║       金融监管数据自动化报送归集系统 启动            ║'));
    logger.info(chalk.bold.green('╚══════════════════════════════════════════════════════╝'));
    logger.info(`模式: ${this.options.dryRun ? chalk.yellow('演练模式(不推送)') : chalk.green('生产模式')}`);
    logger.info(`业务日期: ${businessDate()}`);
    logger.info(`跳过重复报送: ${this.options.skipDuplicate ? '是' : '否'}`);

    if (shouldSkipToday() && !options.force) {
      logger.warn(chalk.yellow('今日为节假日或周末，已自动跳过采集。使用 --force 参数可强制执行。'));
      return { skipped: true, reason: 'holiday' };
    }

    const orgs = this._filterOrganizations(options);
    if (orgs.length === 0) {
      logger.warn('没有匹配的机构需要采集');
      return { skipped: true, reason: 'no_orgs' };
    }
    logger.info(`待处理机构数: ${orgs.length}`);

    const globalProgress = new cliProgress.SingleBar(
      {
        format: `${chalk.bold('总进度')} {bar} {value}/{total} 机构 | 已用时间: {duration_formatted}`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      },
      cliProgress.Presets.shades_classic
    );
    globalProgress.start(orgs.length, 0);

    const sortedOrgs = [...orgs].sort((a, b) => (a.priority || 99) - (b.priority || 99));

    for (const orgConfig of sortedOrgs) {
      const timeoutMs = performanceConfig.taskTimeoutMinutes * 60 * 1000;
      const taskPromise = this._collectAndProcessOrg(orgConfig, globalProgress);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error(`机构处理超时(${performanceConfig.taskTimeoutMinutes}分钟)`), { code: 'TIMEOUT' })), timeoutMs)
      );
      try {
        await Promise.race([taskPromise, timeoutPromise]);
      } catch (timeoutErr) {
        this.errorHandler.handle(timeoutErr, { orgId: orgConfig.id, orgName: orgConfig.name, stage: '总控调度' });
        globalProgress.increment(1);
      }
    }
    globalProgress.stop();

    const duration = Date.now() - startTime;
    const finalSummary = this._generateFinalSummary(duration);
    logger.info(chalk.bold('\n' + finalSummary));
    this.errorHandler.printSummary();

    this.duplicateChecker.cleanup(90);

    return {
      success: this.taskResults.every((r) => r.success),
      taskResults: this.taskResults,
      totalDurationMs: duration,
      businessDate: businessDate(),
      errorStats: this.errorHandler.getStats()
    };
  }

  _generateFinalSummary(durationMs) {
    const lines = [];
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('                    采集任务汇总报告');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push(`执行时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`总耗时: ${formatDuration(durationMs)}`);
    lines.push(`处理机构数: ${this.taskResults.length}`);

    const successOrgs = this.taskResults.filter((r) => r.success).length;
    const failedOrgs = this.taskResults.filter((r) => !r.success).length;
    lines.push(`成功机构: ${successOrgs}   失败机构: ${failedOrgs}`);

    const totalFiles = this.taskResults.reduce((sum, r) => sum + (r.fileCount || 0), 0);
    const totalValid = this.taskResults.reduce((sum, r) => sum + (r.validRecords || 0), 0);
    const totalPushed = this.taskResults.reduce((sum, r) => sum + (r.pushedRecords || 0), 0);
    lines.push(`采集文件总数: ${totalFiles}`);
    lines.push(`有效记录总数: ${totalValid}`);
    lines.push(`推送记录总数: ${totalPushed}`);
    lines.push('');
    lines.push('机构明细:');
    for (const r of this.taskResults) {
      const status = r.success ? chalk.green('✓') : chalk.red('✗');
      const note = r.error ? ` (错误: ${r.error})` : r.note ? ` (${r.note})` : '';
      lines.push(`  ${status} [${r.orgId}] ${r.orgName} - ${r.method}${note}`);
    }
    lines.push('═══════════════════════════════════════════════════════');
    return lines.join('\n');
  }

  retryFailed(options = {}) {
    const retryable = this.errorHandler.getRetryableItems();
    logger.info(`失败队列中有 ${retryable.length} 项可重试任务`);
    if (retryable.length === 0) {
      logger.info('没有可重试的失败任务');
      return { retried: 0 };
    }
    return retryable;
  }

  status(options = {}) {
    const errStats = this.errorHandler.getStats();
    const failedQueue = this.errorHandler.getFailedQueue();
    const summary = {
      businessDate: businessDate(),
      configuredOrgs: organizations.length,
      failedQueue: errStats.queueLength,
      retryable: errStats.retryableCount,
      recentFailures: errStats.total,
      byCode: errStats.byCode || {},
      byOrg: errStats.byOrg || {}
    };
    if (options.detail) {
      summary.failedItems = failedQueue;
    }
    return summary;
  }

  generateReport(period = 'week') {
    const lines = [];
    const title = period === 'week' ? '周报' : period === 'month' ? '月报' : '日报';
    lines.push(`\n${'='.repeat(60)}`);
    lines.push(`                  采集任务${title}`);
    lines.push(`${'='.repeat(60)}`);
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`业务日期: ${businessDate()}`);
    lines.push(`配置机构数: ${organizations.length}`);
    const errStats = this.errorHandler.getStats();
    lines.push(`失败队列: ${errStats.queueLength} (可重试: ${errStats.retryableCount})`);
    if (Object.keys(errStats.byCode || {}).length > 0) {
      lines.push('');
      lines.push('错误类型统计:');
      for (const [code, count] of Object.entries(errStats.byCode || {})) {
        lines.push(`  ${code}: ${count}次`);
      }
    }
    if (Object.keys(errStats.byOrg || {}).length > 0) {
      lines.push('');
      lines.push('机构错误统计:');
      for (const [orgId, count] of Object.entries(errStats.byOrg || {})) {
        const org = organizations.find((o) => o.id === orgId);
        lines.push(`  ${orgId} ${org?.name || ''}: ${count}次`);
      }
    }
    lines.push(`${'='.repeat(60)}`);
    return lines.join('\n');
  }

  startScheduler() {
    logger.info(chalk.bold.blue('定时调度模式已启动，按Ctrl+C退出'));
    for (const org of organizations) {
      const task = cron.schedule(org.cron, async () => {
        logger.info(chalk.blue(`[定时触发] ${org.id} ${org.name}`));
        try {
          await this.run({ orgId: org.id });
        } catch (e) {
          logger.error(`定时任务执行失败 ${org.id}: ${e.message}`);
        }
      }, {
        scheduled: true,
        timezone: 'Asia/Shanghai'
      });
      this._runningTasks.set(org.id, task);
      logger.info(`已注册任务 [${org.id}] cron=${org.cron} ${org.name}`);
    }
  }

  stopScheduler() {
    for (const [orgId, task] of this._runningTasks) {
      task.stop();
      logger.info(`已停止任务 [${orgId}]`);
    }
    this._runningTasks.clear();
  }
}

module.exports = {
  CollectorOrchestrator
};
