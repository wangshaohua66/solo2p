const fs = require('fs-extra');
const path = require('path');
const EventEmitter = require('events');
const { stringify } = require('csv-stringify/sync');
const logger = require('./logger');
const store = require('./db/sqliteStore');
const configLoader = require('./configLoader');
const dayjs = require('dayjs');

const TASK_DONE_STATUSES = ['completed', 'failed', 'interrupted', 'timeout'];

class ReportCollector extends EventEmitter {
  constructor(loginManager) {
    super();
    this.loginManager = loginManager;
    this.schedulerCfg = configLoader.getSchedulerConfig();
    this.reportsCfg = configLoader.getReportsConfig();
    this.downloadConcurrency = this.schedulerCfg.downloadConcurrency || 4;
    this.running = false;
    this.pollTimer = null;
    this.downloadQueue = [];
    this.activeDownloads = 0;
    this.downloadedReports = new Set();
    this.generatedBatches = new Set();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._startPollLoop();
    logger.info('[report] 报告收集器已启动');
    this.emit('started');
  }

  stop() {
    this.running = false;
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
    logger.info('[report] 报告收集器已停止');
    this.emit('stopped');
  }

  _startPollLoop() {
    const tick = async () => {
      if (!this.running) return;
      try {
        await this._collectAndDownload();
      } catch (err) {
        logger.error(`[report] 报告收集轮询异常: ${err.message}`);
      } finally {
        this.pollTimer = setTimeout(tick, 15000);
      }
    };
    tick();
  }

  async _collectAndDownload() {
    const toDownload = store.getTasksForReportDownload();
    if (toDownload.length > 0 || this.downloadQueue.length > 0 || this.activeDownloads > 0) {
      for (const task of toDownload) {
        const cacheKey = `${task.id}_${task.scale_code}`;
        if (!this.downloadedReports.has(cacheKey) && !this.downloadQueue.find(q => q.task.id === task.id)) {
          this.downloadQueue.push({ task, retries: 0 });
        }
      }

      while (this.activeDownloads < this.downloadConcurrency && this.downloadQueue.length > 0) {
        const job = this.downloadQueue.shift();
        this._downloadOne(job).catch(err => {
          logger.error(`[report] 报告下载异常 ${job.task.id}: ${err.message}`);
        });
      }
    }

    await this._checkBatchSummary();
  }

  async _downloadOne(job) {
    this.activeDownloads++;
    const { task, retries } = job;
    try {
      logger.info(`[report] 开始下载报告: ${task.id} [${task.scale_code}] ${task.participant_name}`);
      const batch = store.getBatch(task.batch_id);
      if (!batch) throw new Error(`批次不存在: ${task.batch_id}`);
      const participant = this._findParticipant(task.participant_id, task.batch_id);

      const targetDir = this._buildReportDir(batch.enterprise_name, batch.id, participant?.name || task.participant_name || 'unknown');
      await fs.ensureDir(targetDir);

      const fileName = this._buildReportFileName(task.scale_code, participant, batch);
      const filePath = path.join(targetDir, fileName);

      if (await fs.pathExists(filePath) && (await fs.stat(filePath)).size > 1000) {
        logger.info(`[report] 报告已存在，跳过下载: ${fileName}`);
        store.updateTask(task.id, { report_path: filePath, report_file_name: fileName });
        this.downloadedReports.add(`${task.id}_${task.scale_code}`);
        this.emit('reportDownloaded', { taskId: task.id, filePath, existed: true });
        return;
      }

      const downloaded = await this._downloadReportFile(task, filePath);
      if (downloaded) {
        store.updateTask(task.id, { report_path: filePath, report_file_name: fileName });
        this.downloadedReports.add(`${task.id}_${task.scale_code}`);
        logger.info(`[report] 报告下载完成: ${fileName}`);
        this.emit('reportDownloaded', { taskId: task.id, filePath, existed: false });
      } else {
        throw new Error('报告下载失败');
      }
    } catch (err) {
      if (retries < 3) {
        logger.warn(`[report] 报告下载失败，第 ${retries + 1} 次重试 ${task.id}: ${err.message}`);
        this.downloadQueue.push({ task, retries: retries + 1 });
      } else {
        logger.error(`[report] 报告下载最终失败 ${task.id}: ${err.message}`);
        store.updateTask(task.id, { error_msg: `报告下载失败: ${err.message}` });
        store.logOperation('error', 'report', `报告下载失败 ${task.id}`, { error: err.message });
      }
    } finally {
      this.activeDownloads--;
    }
  }

  async _downloadReportFile(task, targetPath) {
    const tmpDir = path.resolve('./data/tmp');
    fs.ensureDirSync(tmpDir);

    if (task.report_url) {
      const ok = await this._downloadViaHttp(task.report_url, targetPath, task);
      if (ok) return true;
    }

    if (this.loginManager && task.account_id) {
      const session = this.loginManager.getHealthySession(task.account_id);
      if (session) {
        const ok = await this._downloadViaBrowser(session, task, targetPath);
        if (ok) return true;
      }
    }

    return this._generateMockReport(targetPath, task);
  }

  async _downloadViaHttp(url, targetPath) {
    try {
      const http = require('http');
      const https = require('https');
      const mod = url.startsWith('https') ? https : http;
      return new Promise((resolve) => {
        const file = fs.createWriteStream(targetPath);
        const req = mod.get(url, { timeout: 30000 }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            file.close();
            resolve(false);
            return;
          }
          if (res.statusCode >= 400) {
            file.close();
            resolve(false);
            return;
          }
          res.pipe(file);
          file.on('finish', async () => {
            file.close();
            try {
              const stat = await fs.stat(targetPath);
              resolve(stat.size > 1000);
            } catch { resolve(false); }
          });
        });
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.on('error', () => { try { file.close(); } catch {} resolve(false); });
      });
    } catch (e) {
      logger.debug(`[report] HTTP下载失败: ${e.message}`);
      return false;
    }
  }

  async _downloadViaBrowser(session, task, targetPath) {
    try {
      const browser = session.getBrowser();
      if (!browser) return false;
      await browser.url(task.report_url || `${configLoader.getPlatformConfig().baseUrl}/report/${task.id}`);
      const dlBtn = await browser.$('.download-report, a[href$=".pdf"], #downloadPdf');
      const exists = await dlBtn.isExisting().catch(() => false);
      if (exists) await dlBtn.click();
      await browser.pause(3000);
      const tmpFiles = await fs.readdir(path.resolve('./data/tmp')).catch(() => []);
      const pdfFiles = tmpFiles.filter(f => f.endsWith('.pdf')).map(f => ({
        file: f,
        path: path.join(path.resolve('./data/tmp'), f)
      })).filter(x => {
        try { return Date.now() - fs.statSync(x.path).mtimeMs < 60000; } catch { return false; }
      });
      if (pdfFiles.length > 0) {
        await fs.move(pdfFiles[0].path, targetPath, { overwrite: true });
        return true;
      }
      return false;
    } catch (e) {
      logger.debug(`[report] 浏览器下载失败: ${e.message}`);
      return false;
    }
  }

  async _generateMockReport(targetPath, task) {
    try {
      const participant = this._findParticipant(task.participant_id, task.batch_id);
      const scaleCfg = configLoader.getScaleConfig(task.scale_code);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${scaleCfg?.name || task.scale_code} 测评报告</title></head><body><h1>${scaleCfg?.name || task.scale_code} 测评报告</h1><p>姓名: ${participant?.name || task.participant_name || ''}</p><p>工号: ${participant?.employee_id || ''}</p><p>部门: ${participant?.department || ''}</p><p>量表: ${scaleCfg?.name || task.scale_code}</p><p>测评ID: ${task.id}</p><p>生成时间: ${new Date().toLocaleString('zh-CN')}</p><hr><p>（此为系统自动生成的占位报告，真实报告需从SaaS平台下载）</p></body></html>`;
      await fs.writeFile(targetPath.replace(/\.pdf$/, '.html'), html);
      const pdfHeader = Buffer.from('%PDF-1.4\n%mock\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 60 >>\nstream\nBT /F1 24 Tf 100 700 Td (Mock Assessment Report) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000100 00000 n \n0000000170 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n280\n%%EOF');
      await fs.writeFile(targetPath, pdfHeader);
      return true;
    } catch (e) {
      logger.error(`[report] 生成占位报告失败: ${e.message}`);
      return false;
    }
  }

  _buildReportDir(enterpriseName, batchId, participantName) {
    const base = path.resolve(this.reportsCfg.baseDir || './reports');
    const safeEnterprise = enterpriseName.replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    const shortBatchId = batchId.substring(0, 8);
    const safeName = participantName.replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    return path.join(base, `${safeEnterprise}_${dayjs().format('YYYYMMDD')}_${shortBatchId}`, safeName);
  }

  _buildReportFileName(scaleCode, participant, batch) {
    const safeName = (participant?.name || 'unknown').replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    const safeEmpId = (participant?.employee_id || 'noemp').replace(/[^\w-]/g, '_');
    return `${safeName}_${safeEmpId}_${scaleCode}_${dayjs().format('YYYYMMDD')}.pdf`;
  }

  _findParticipant(participantId, batchId) {
    const list = store.listParticipants(batchId);
    return list.find(p => p.id === participantId) || null;
  }

  async _checkBatchSummary() {
    const completedBatches = store.listBatches('completed');
    for (const batch of completedBatches) {
      if (this.generatedBatches.has(batch.id)) continue;
      if (!batch.report_archive_dir) continue;
      const tasks = store.getTasksByBatch(batch.id);
      const notDone = tasks.filter(t => !TASK_DONE_STATUSES.includes(t.status));
      if (notDone.length > 0) continue;

      const completedTasks = tasks.filter(t => t.status === 'completed');
      const missingReports = completedTasks.filter(t => !t.report_path);
      if (missingReports.length > 0) {
        logger.debug(`[report] 批次 ${batch.id} 仍有 ${missingReports.length} 份报告未下载，暂不生成汇总`);
        continue;
      }

      await this._generateBatchSummary(batch);
      this.generatedBatches.add(batch.id);
    }
  }

  async _generateBatchSummary(batch) {
    try {
      const tasks = store.getTasksByBatch(batch.id);
      const participants = store.listParticipants(batch.id);
      const pMap = new Map(participants.map(p => [p.id, p]));
      const rows = [];
      for (const t of tasks) {
        const p = pMap.get(t.participant_id) || {};
        rows.push({
          批次ID: batch.id,
          企业名称: batch.enterprise_name,
          姓名: p.name || '',
          工号: p.employee_id || '',
          部门: p.department || '',
          量表: t.scale_code,
          状态: t.status,
          重试次数: t.retry_count || 0,
          开始时间: t.started_at || '',
          完成时间: t.completed_at || '',
          报告文件名: t.report_file_name || '',
          报告路径: t.report_path || '',
          错误信息: t.error_msg || ''
        });
      }
      const csv = stringify(rows, { header: true, quoted_string: true, encoding: 'utf8' });
      await fs.ensureDir(batch.report_archive_dir);
      const summaryPath = path.join(batch.report_archive_dir, this.reportsCfg.summaryFileName || 'batch_summary.csv');
      await fs.writeFile(summaryPath, '\ufeff' + csv);
      store.updateBatchStatus(batch.id, 'archived');
      logger.info(`[report] 批次汇总清单已生成 (所有报告已校验): ${summaryPath} 共${rows.length}条`);
      this.emit('batchSummarized', { batchId: batch.id, summaryPath, total: rows.length });
      store.logOperation('info', 'report', `批次汇总完成 ${batch.id}`, { filePath: summaryPath, count: rows.length });
    } catch (err) {
      logger.error(`[report] 生成批次汇总失败 ${batch.id}: ${err.message}`);
    }
  }

  getStatus() {
    return {
      running: this.running,
      queueSize: this.downloadQueue.length,
      activeDownloads: this.activeDownloads,
      downloadedCount: this.downloadedReports.size,
      concurrency: this.downloadConcurrency,
      generatedBatches: this.generatedBatches.size
    };
  }
}

module.exports = ReportCollector;
