import inquirer from 'inquirer';
import config from '../core/config.js';
import logger from '../utils/logger.js';
import { CHANNELS } from '../models/transaction.js';
import { validateOptions, ValidationError } from '../utils/validators.js';

async function run(action, options = {}) {
  const cfg = config.get();
  switch (action) {
    case 'list':
    case 'show':
      return listConfig(cfg);
    case 'add-merchant':
    case 'addMerchant':
      return addMerchant(cfg, options);
    case 'remove-merchant':
    case 'removeMerchant':
      return removeMerchant(cfg, options);
    case 'set-rules':
    case 'setRules':
      return setRules(cfg, options);
    case 'add-template':
    case 'addTemplate':
      return addTemplate(cfg, options);
    case 'export':
      return exportConfig(cfg, options);
    case 'import':
      return importConfig(cfg, options);
    case 'wizard':
      return wizard(cfg);
    default:
      logger.error(`未知配置操作: ${action}`);
      logger.info('可用操作: list, add-merchant, remove-merchant, set-rules, add-template, export, import, wizard');
      return null;
  }
}

function listConfig(cfg) {
  logger.highlight('商户列表');
  logger.table(cfg.merchants.map((m) => ({ 商户ID: m.id, 名称: m.name, 通道: m.channel, 启用: m.enabled !== false ? '是' : '否' })));
  logger.highlight('支付通道');
  logger.table(cfg.channels.map((c) => ({ 通道: c.id, 名称: c.name, 格式: c.fileFormat, 时区: c.timezone, 启用: c.enabled !== false ? '是' : '否' })));
  logger.highlight('匹配规则');
  logger.table(Object.entries(cfg.rules).map(([k, v]) => ({ 规则: k, 值: v })));
  logger.highlight('报告模板');
  logger.table(cfg.reportTemplates.map((t) => ({ 模板ID: t.id, 名称: t.name, 模块: (t.sections || []).join(', ') })));
  return cfg;
}

function addMerchant(cfg, options) {
  const errors = validateOptions(options, { id: { required: true }, channel: { type: 'channel', config: cfg } });
  if (errors.length) {
    errors.forEach((e) => logger.error(`${e.field}: ${e.message}`));
    throw new ValidationError('merchant', '商户参数校验失败');
  }
  const merchant = { id: options.id, name: options.name || options.id, channel: options.channel || 'wechat', enabled: options.enabled !== false };
  config.addMerchant(merchant);
  logger.success(`商户已添加: ${merchant.id}`);
  return merchant;
}

function removeMerchant(cfg, options) {
  if (!options.id) {
    logger.error('缺少参数 --id');
    throw new ValidationError('id', '商户ID为必填');
  }
  const ok = config.removeMerchant(options.id);
  logger[ok ? 'success' : 'warn'](ok ? `商户已删除: ${options.id}` : `商户不存在: ${options.id}`);
  return { removed: ok };
}

function setRules(cfg, options) {
  const ruleKeys = ['timeWindowDays', 'fuzzy', 'fuzzyThreshold', 'amountTolerance', 'amountThreshold', 'timeThresholdMs', 'refundWindowDays', 'allowPartialRefund'];
  const updates = {};
  for (const k of ruleKeys) {
    if (options[k] !== undefined) {
      updates[k] = k === 'fuzzy' || k === 'allowPartialRefund' ? options[k] === 'true' || options[k] === true : Number(options[k]);
    }
  }
  const rules = config.setRules(updates);
  logger.success('匹配规则已更新');
  logger.table(Object.entries(rules).map(([k, v]) => ({ 规则: k, 值: v })));
  return rules;
}

function addTemplate(cfg, options) {
  if (!options.id || !options.name) {
    logger.error('缺少参数 --id 或 --name');
    throw new ValidationError('template', '模板ID和名称为必填');
  }
  const sections = options.sections ? String(options.sections).split(',') : ['summary', 'differences', 'suggestions'];
  const tpl = { id: options.id, name: options.name, sections };
  config.addReportTemplate(tpl);
  logger.success(`报告模板已添加: ${tpl.id}`);
  return tpl;
}

function exportConfig(cfg, options) {
  const dest = options.output || './config/reconcile-export.json';
  config.exportConfig(dest);
  logger.success(`配置已导出: ${dest}`);
  return dest;
}

function importConfig(cfg, options) {
  if (!options.input) {
    logger.error('缺少参数 --input');
    throw new ValidationError('input', '配置文件路径为必填');
  }
  const imported = config.importConfig(options.input);
  logger.success(`配置已导入: ${options.input}`);
  return imported;
}

async function wizard(cfg) {
  logger.highlight('配置向导');
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择配置操作:',
      choices: ['添加商户', '修改匹配规则', '添加报告模板', '导出配置', '查看当前配置'],
    },
  ]);
  if (action === '添加商户') {
    const ans = await inquirer.prompt([
      { type: 'input', name: 'id', message: '商户ID:', validate: (v) => !!v || '不能为空' },
      { type: 'input', name: 'name', message: '商户名称:' },
      { type: 'list', name: 'channel', message: '主支付通道:', choices: CHANNELS },
      { type: 'confirm', name: 'enabled', message: '是否启用?', default: true },
    ]);
    return addMerchant(cfg, ans);
  }
  if (action === '修改匹配规则') {
    const ans = await inquirer.prompt([
      { type: 'number', name: 'timeWindowDays', message: '跨日时间窗口(T+N):', default: cfg.rules.timeWindowDays },
      { type: 'confirm', name: 'fuzzy', message: '启用模糊匹配?', default: cfg.rules.fuzzy },
      { type: 'number', name: 'fuzzyThreshold', message: '模糊匹配阈值(0-1):', default: cfg.rules.fuzzyThreshold },
      { type: 'number', name: 'amountThreshold', message: '金额差异阈值(分):', default: cfg.rules.amountThreshold },
    ]);
    return setRules(cfg, ans);
  }
  if (action === '添加报告模板') {
    const ans = await inquirer.prompt([
      { type: 'input', name: 'id', message: '模板ID:', validate: (v) => !!v || '不能为空' },
      { type: 'input', name: 'name', message: '模板名称:' },
      { type: 'checkbox', name: 'sections', message: '包含模块:', choices: ['summary', 'differences', 'suggestions'], default: ['summary', 'differences', 'suggestions'] },
    ]);
    return addTemplate(cfg, { ...ans, sections: ans.sections.join(',') });
  }
  if (action === '导出配置') {
    const { output } = await inquirer.prompt([{ type: 'input', name: 'output', message: '导出路径:', default: './config/reconcile-export.json' }]);
    return exportConfig(cfg, { output });
  }
  return listConfig(cfg);
}

export default { run };
