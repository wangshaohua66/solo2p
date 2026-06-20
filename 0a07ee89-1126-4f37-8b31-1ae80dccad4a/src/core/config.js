import fs from 'fs';
import path from 'path';
import { CHANNELS } from '../models/transaction.js';

const DEFAULT_CONFIG_DIR = path.join(process.cwd(), 'config');
const DEFAULT_CONFIG_FILE = path.join(DEFAULT_CONFIG_DIR, 'reconcile.json');

const DEFAULT_CONFIG = {
  version: '1.0.0',
  merchants: [],
  channels: [
    { id: 'wechat', name: '微信支付', enabled: true, fileFormat: 'csv', timezone: 'Asia/Shanghai' },
    { id: 'alipay', name: '支付宝', enabled: true, fileFormat: 'json', timezone: 'Asia/Shanghai' },
    { id: 'unionpay', name: '银联', enabled: true, fileFormat: 'xml', timezone: 'Asia/Shanghai' },
  ],
  rules: {
    timeWindowDays: 1,
    fuzzy: true,
    fuzzyThreshold: 0.85,
    fuzzyAmountRatio: 0.1,
    amountTolerance: 0,
    amountThreshold: 1,
    timeThresholdMs: 86400000,
    refundWindowDays: 90,
    allowPartialRefund: true,
  },
  reportTemplates: [
    { id: 'default', name: '默认对账报告', sections: ['summary', 'differences', 'suggestions'] },
  ],
  storage: {
    dataDir: path.join(process.cwd(), 'data'),
    outputDir: path.join(process.cwd(), 'reports'),
  },
};

class ConfigManager {
  constructor(configPath) {
    this.configPath = configPath || process.env.RECONCILE_CONFIG || DEFAULT_CONFIG_FILE;
    this.config = null;
  }

  load() {
    if (!fs.existsSync(this.configPath)) {
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      this.save();
      return this.config;
    }
    try {
      const raw = fs.readFileSync(this.configPath, 'utf8');
      this.config = { ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)), ...JSON.parse(raw) };
    } catch (e) {
      throw new Error(`配置文件解析失败: ${e.message}`);
    }
    return this.config;
  }

  save() {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  get() {
    if (!this.config) this.load();
    return this.config;
  }

  getMerchant(id) {
    return this.get().merchants.find((m) => m.id === id);
  }

  merchantExists(id) {
    return this.get().merchants.some((m) => m.id === id);
  }

  addMerchant(merchant) {
    const cfg = this.get();
    if (cfg.merchants.some((m) => m.id === merchant.id)) throw new Error(`商户已存在: ${merchant.id}`);
    cfg.merchants.push({ name: '', channel: 'wechat', ...merchant });
    this.save();
    return merchant;
  }

  removeMerchant(id) {
    const cfg = this.get();
    const before = cfg.merchants.length;
    cfg.merchants = cfg.merchants.filter((m) => m.id !== id);
    this.save();
    return cfg.merchants.length < before;
  }

  getChannel(id) {
    return this.get().channels.find((c) => c.id === id);
  }

  setRules(rules) {
    const cfg = this.get();
    cfg.rules = { ...cfg.rules, ...rules };
    this.save();
    return cfg.rules;
  }

  addReportTemplate(tpl) {
    const cfg = this.get();
    cfg.reportTemplates.push(tpl);
    this.save();
    return tpl;
  }

  exportConfig(destPath) {
    const cfg = this.get();
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(destPath, JSON.stringify(cfg, null, 2), 'utf8');
    return destPath;
  }

  importConfig(srcPath) {
    if (!fs.existsSync(srcPath)) throw new Error(`配置文件不存在: ${srcPath}`);
    const raw = fs.readFileSync(srcPath, 'utf8');
    const imported = JSON.parse(raw);
    this.config = { ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)), ...imported };
    this.save();
    return this.config;
  }

  validateChannel(channelId) {
    return CHANNELS.includes(channelId) && this.get().channels.some((c) => c.id === channelId);
  }
}

const globalConfig = new ConfigManager();

export { ConfigManager, DEFAULT_CONFIG, DEFAULT_CONFIG_DIR };
export default globalConfig;
