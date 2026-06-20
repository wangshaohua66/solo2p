const os = require('os');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const chalk = require('chalk');
const Table = require('cli-table3');

const config = require('../config/default.json');

class Monitor {
  constructor(storage, crawler = null, scheduler = null, comparator = null) {
    this.storage = storage;
    this.crawler = crawler;
    this.scheduler = scheduler;
    this.comparator = comparator;
    this.startTime = Date.now();
  }

  async getSystemHealth() {
    const now = Date.now();
    const uptime = Math.floor((now - this.startTime) / 1000);
    const processUptime = process.uptime();

    const memory = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    let dbSize = 0;
    try {
      const dbPath = path.resolve(config.app.dbPath);
      if (fs.existsSync(dbPath)) {
        const stat = fs.statSync(dbPath);
        dbSize = stat.size;
      }
    } catch (e) { /* ignore */ }

    let evidenceSize = 0;
    let evidenceCount = 0;
    try {
      const evDir = path.resolve(config.app.evidenceDir);
      if (fs.existsSync(evDir)) {
        const items = this._walkDir(evDir);
        evidenceCount = items.length;
        evidenceSize = items.reduce((sum, f) => {
          try { return sum + fs.statSync(f).size; } catch { return sum; }
        }, 0);
      }
    } catch (e) { /* ignore */ }

    return {
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      appUptime: this._formatSeconds(uptime),
      processUptime: this._formatSeconds(Math.floor(processUptime)),
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      cpus: os.cpus().length,
      loadAvg: os.loadavg(),
      memory: {
        process: {
          heapUsed: this._formatBytes(memory.heapUsed),
          heapTotal: this._formatBytes(memory.heapTotal),
          external: this._formatBytes(memory.external),
          rss: this._formatBytes(memory.rss),
          heapUsedMB: (memory.heapUsed / 1024 / 1024).toFixed(1)
        },
        system: {
          total: this._formatBytes(totalMemory),
          free: this._formatBytes(freeMemory),
          used: this._formatBytes(totalMemory - freeMemory),
          usagePct: (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(1)
        }
      },
      storage: {
        dbSize: this._formatBytes(dbSize),
        dbSizeMB: (dbSize / 1024 / 1024).toFixed(1),
        evidenceSize: this._formatBytes(evidenceSize),
        evidenceCount
      }
    };
  }

  async getStorageStats() {
    const originalCount = await this.storage.getOriginalArticleCount();
    const monitoredSites = await this.storage.getMonitoredSites(false);
    const enabledSites = monitoredSites.filter((s) => s.is_enabled);

    const crawledRaw = await this.storage.get(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status='fetched' THEN 1 ELSE 0 END) as success,
              SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
       FROM crawled_articles WHERE created_at >= ?`,
      [dayjs().subtract(7, 'day').format('YYYY-MM-DD')]
    );
    const crawledStats = {
      total: crawledRaw?.total || 0,
      success: crawledRaw?.success || 0,
      failed: crawledRaw?.failed || 0
    };

    const matchRaw = await this.storage.get(
      `SELECT COUNT(*) as total, SUM(is_suspected) as suspected, SUM(is_confirmed) as confirmed
       FROM infringement_matches WHERE created_at >= ?`,
      [dayjs().subtract(30, 'day').format('YYYY-MM-DD')]
    );
    const matchStats = {
      total: matchRaw?.total || 0,
      suspected: matchRaw?.suspected || 0,
      confirmed: matchRaw?.confirmed || 0
    };

    const taskStats = await this.storage.all(
      `SELECT status, COUNT(*) as count FROM crawl_tasks 
       WHERE created_at >= ? GROUP BY status`,
      [dayjs().subtract(7, 'day').format('YYYY-MM-DD')]
    );

    return {
      originalArticles: originalCount,
      monitoredSites: {
        total: monitoredSites.length,
        enabled: enabledSites.length,
        disabled: monitoredSites.length - enabledSites.length
      },
      crawled7d: crawledStats || { total: 0, success: 0, failed: 0 },
      infringement30d: matchStats || { total: 0, suspected: 0, confirmed: 0 },
      tasks7d: taskStats.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {})
    };
  }

  async getSiteStatus() {
    const sites = await this.storage.getMonitoredSites(false);

    const siteStats = await this.storage.all(`
      SELECT 
        site_id,
        COUNT(*) as crawled_count,
        SUM(CASE WHEN status='fetched' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed_count,
        MAX(fetched_at) as last_crawl
      FROM crawled_articles
      WHERE fetched_at >= ?
      GROUP BY site_id
    `, [dayjs().subtract(3, 'day').format('YYYY-MM-DD')]);

    const infringementStats = await this.storage.all(`
      SELECT site_id, COUNT(*) as match_count,
             SUM(is_suspected) as suspected_count,
             SUM(is_confirmed) as confirmed_count
      FROM infringement_matches
      WHERE created_at >= ?
      GROUP BY site_id
    `, [dayjs().subtract(30, 'day').format('YYYY-MM-DD')]);

    const statsMap = {};
    for (const s of siteStats) statsMap[s.site_id] = s;
    const matchMap = {};
    for (const m of infringementStats) matchMap[m.site_id] = m;

    return sites.map((s) => ({
      id: s.site_id,
      name: s.name,
      domain: s.domain,
      priority: s.priority,
      enabled: !!s.is_enabled,
      last_crawl: statsMap[s.site_id]?.last_crawl || s.last_crawled_at || '从未',
      crawled_count: statsMap[s.site_id]?.crawled_count || 0,
      success_count: statsMap[s.site_id]?.success_count || 0,
      failed_count: statsMap[s.site_id]?.failed_count || 0,
      match_count: matchMap[s.site_id]?.match_count || 0,
      suspected_count: matchMap[s.site_id]?.suspected_count || 0,
      confirmed_count: matchMap[s.site_id]?.confirmed_count || 0,
      success_rate: statsMap[s.site_id]?.crawled_count
        ? ((statsMap[s.site_id].success_count / statsMap[s.site_id].crawled_count) * 100).toFixed(1) + '%'
        : '-'
    }));
  }

  renderSystemHealthTable() {
    const health = this.getSystemHealth_sync();
    const table = new Table({
      head: [chalk.cyan.bold('检查项'), chalk.cyan.bold('状态')],
      colWidths: [25, 55],
      wordWrap: true
    });

    const memoryUsage = parseFloat(health.memory.process.heapUsedMB);
    const memoryStatus = memoryUsage > 900
      ? chalk.red('偏高')
      : memoryUsage > 600
        ? chalk.yellow('正常')
        : chalk.green('良好');

    table.push(
      [chalk.bold('系统时间'), health.timestamp],
      [chalk.bold('应用运行时长'), health.appUptime],
      [chalk.bold('Node.js 版本'), health.nodeVersion],
      [chalk.bold('操作系统'), `${health.platform} (${health.cpus}核)`],
      [chalk.bold('系统负载'), health.loadAvg.map((l) => l.toFixed(2)).join(' / ')],
      [chalk.bold('内存使用'), `${health.memory.process.heapUsed} / ${health.memory.process.heapTotal} [${memoryStatus}]`],
      [chalk.bold('RSS 内存'), health.memory.process.rss],
      [chalk.bold('系统内存使用率'), `${health.memory.system.usagePct}% (${health.memory.system.used}/${health.memory.system.total})`],
      [chalk.bold('数据库大小'), `${health.storage.dbSize} (${health.storage.dbSizeMB}MB)`],
      [chalk.bold('证据文件数'), `${health.storage.evidenceCount} (${health.storage.evidenceSize})`]
    );

    return table.toString();
  }

  renderSitesTable(sites) {
    const table = new Table({
      head: [
        chalk.bold('#'),
        chalk.bold('站点'),
        chalk.bold('优先级'),
        chalk.bold('状态'),
        chalk.bold('3天抓取'),
        chalk.bold('成功率'),
        chalk.bold('30天侵权'),
        chalk.bold('上次抓取')
      ],
      colWidths: [4, 18, 8, 8, 10, 10, 10, 20]
    });

    sites.forEach((s, idx) => {
      const enabledLabel = s.enabled ? chalk.green('启用') : chalk.gray('禁用');
      const prioLabel = s.priority === 1
        ? chalk.red('P1')
        : s.priority === 2
          ? chalk.yellow('P2')
          : chalk.cyan('P3');

      const susLabel = s.suspected_count > 10
        ? chalk.red.bold(s.suspected_count)
        : s.suspected_count > 0
          ? chalk.yellow(s.suspected_count)
          : chalk.gray('0');

      const rateLabel = s.success_rate !== '-'
        ? (parseFloat(s.success_rate) > 95
            ? chalk.green(s.success_rate)
            : parseFloat(s.success_rate) > 80
              ? chalk.yellow(s.success_rate)
              : chalk.red(s.success_rate))
        : chalk.gray('-');

      table.push([
        idx + 1,
        s.name,
        prioLabel,
        enabledLabel,
        `${s.success_count}/${s.crawled_count}`,
        rateLabel,
        susLabel,
        s.last_crawl && s.last_crawl !== '从未' ? dayjs(s.last_crawl).format('MM-DD HH:mm') : '从未'
      ]);
    });

    return table.toString();
  }

  renderInfringementSummary(stats) {
    const table = new Table({
      head: [
        chalk.bold('统计维度'),
        chalk.bold('数值')
      ],
      colWidths: [25, 55]
    });

    table.push(
      [chalk.cyan('原创稿件库'), `${stats.originalArticles.toLocaleString()} 篇`],
      [chalk.cyan('监控站点'), `${stats.monitoredSites.enabled}/${stats.monitoredSites.total} 个启用`],
      [chalk.cyan('近7天抓取'), `${stats.crawled7d.success} 成功 / ${stats.crawled7d.failed} 失败`],
      [chalk.cyan('近30天匹配'), `${stats.infringement30d.total || 0} 条`],
      [chalk.red('  └ 疑似侵权'), `${stats.infringement30d.suspected || 0} 条`],
      [chalk.red.bold('  └ 已确认'), `${stats.infringement30d.confirmed || 0} 条`],
      [chalk.cyan('近7天任务'), Object.entries(stats.tasks7d).map(([k, v]) => `${k}:${v}`).join(', ') || '无']
    );

    return table.toString();
  }

  getSchedulerStatus() {
    if (!this.scheduler) return null;
    return this.scheduler.getRunningStatus();
  }

  getCrawlerStatus() {
    if (!this.crawler) return null;
    return this.crawler.getStats();
  }

  getComparatorStatus() {
    if (!this.comparator) return null;
    return this.comparator.getStats();
  }

  getSystemHealth_sync() {
    const now = Date.now();
    const uptime = Math.floor((now - this.startTime) / 1000);
    const processUptime = process.uptime();

    const memory = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    let dbSize = 0;
    try {
      const dbPath = path.resolve(config.app.dbPath);
      if (fs.existsSync(dbPath)) {
        dbSize = fs.statSync(dbPath).size;
      }
    } catch (e) { /* ignore */ }

    let evidenceSize = 0;
    let evidenceCount = 0;
    try {
      const evDir = path.resolve(config.app.evidenceDir);
      if (fs.existsSync(evDir)) {
        const items = this._walkDir(evDir);
        evidenceCount = items.length;
        evidenceSize = items.reduce((sum, f) => {
          try { return sum + fs.statSync(f).size; } catch { return sum; }
        }, 0);
      }
    } catch (e) { /* ignore */ }

    return {
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      appUptime: this._formatSeconds(uptime),
      processUptime: this._formatSeconds(Math.floor(processUptime)),
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      cpus: os.cpus().length,
      loadAvg: os.loadavg(),
      memory: {
        process: {
          heapUsed: this._formatBytes(memory.heapUsed),
          heapTotal: this._formatBytes(memory.heapTotal),
          external: this._formatBytes(memory.external),
          rss: this._formatBytes(memory.rss),
          heapUsedMB: (memory.heapUsed / 1024 / 1024).toFixed(1)
        },
        system: {
          total: this._formatBytes(totalMemory),
          free: this._formatBytes(freeMemory),
          used: this._formatBytes(totalMemory - freeMemory),
          usagePct: (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(1)
        }
      },
      storage: {
        dbSize: this._formatBytes(dbSize),
        dbSizeMB: (dbSize / 1024 / 1024).toFixed(1),
        evidenceSize: this._formatBytes(evidenceSize),
        evidenceCount
      }
    };
  }

  _walkDir(dir, results = []) {
    try {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const full = path.join(dir, file);
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            this._walkDir(full, results);
          } else {
            results.push(full);
          }
        } catch (e) { /* skip */ }
      }
    } catch (e) { /* skip */ }
    return results;
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _formatSeconds(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (d) parts.push(`${d}天`);
    if (h) parts.push(`${h}小时`);
    if (m) parts.push(`${m}分`);
    parts.push(`${s}秒`);
    return parts.join(' ');
  }

  async checkAlerts() {
    const alerts = [];
    const health = this.getSystemHealth_sync();

    if (parseFloat(health.memory.process.heapUsedMB) > 900) {
      alerts.push({
        level: 'critical',
        type: 'memory',
        message: `应用堆内存过高: ${health.memory.process.heapUsed} (${health.memory.process.heapUsedMB}MB)`
      });
    }

    if (parseFloat(health.memory.system.usagePct) > 90) {
      alerts.push({
        level: 'warning',
        type: 'system_memory',
        message: `系统内存使用率过高: ${health.memory.system.usagePct}%`
      });
    }

    const storage = await this.getStorageStats();
    const crawlTotal = storage.crawled7d.total || 0;
    const crawlFailed = storage.crawled7d.failed || 0;
    if (crawlTotal > 0 && (crawlFailed / crawlTotal) > 0.1) {
      alerts.push({
        level: 'warning',
        type: 'crawl',
        message: `近7天抓取失败率: ${((crawlFailed / crawlTotal) * 100).toFixed(1)}%`
      });
    }

    return alerts;
  }
}

module.exports = Monitor;
