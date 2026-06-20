import path from 'path';
import { generateReport } from '../core/reportGenerator.js';
import logger from '../utils/logger.js';
import Storage from '../utils/storage.js';
import config from '../core/config.js';
import matchCmd from './match.js';
import { validateOptions, ValidationError } from '../utils/validators.js';

async function run(options = {}) {
  const cfg = config.get();
  const errors = validateOptions(options, {
    merchant: { type: 'merchant', config: cfg },
    channel: { type: 'channel', config: cfg },
    format: { enum: ['xlsx', 'pdf', 'both'] },
  });
  if (errors.length) {
    errors.forEach((e) => logger.error(`${e.field}: ${e.message}`));
    throw new ValidationError('report', '参数校验失败');
  }

  const storage = new Storage(options.dataDir);
  let result = options.result ? storage.loadResult(options.result) : null;
  if (!result && !options.orders && !options.transactions) {
    const latest = storage.latestResult();
    if (latest) {
      logger.info('未指定数据源，自动复用最近匹配结果');
      result = latest;
    }
  }
  if (!result) {
    logger.info('未指定已有匹配结果，将自动执行匹配...');
    result = await matchCmd.run({ ...options, dryRun: true });
  }
  if (!result || !result.summary) {
    logger.error('无可用的对账结果，无法生成报告');
    return null;
  }

  const tpl = cfg.reportTemplates.find((t) => t.id === (options.template || 'default')) || cfg.reportTemplates[0];
  const sections = tpl ? tpl.sections : ['summary', 'differences', 'suggestions'];
  const format = options.format === 'both' ? null : options.format || 'both';

  const reportOpts = {
    name: options.name || `reconcile-${options.merchant || 'all'}-${Date.now()}`,
    outputDir: options.outputDir || cfg.storage.outputDir || path.join(process.cwd(), 'reports'),
    sections,
    template: tpl ? tpl.id : 'default',
    format,
    groupByMerchant: options.byMerchant,
    merchantFilter: options.merchant,
  };

  logger.highlight(`生成对账报告（模板: ${reportOpts.template}，格式: ${format || 'both'}）`);
  const files = await generateReport(result, reportOpts);

  storage.saveHistory({
    id: `report-${Date.now()}`,
    type: 'report',
    merchantId: options.merchant,
    template: reportOpts.template,
    files,
    createdAt: new Date().toISOString(),
  });
  logger.success(`报告生成完成，共 ${files.length} 个文件`);
  return files;
}

export default { run };
