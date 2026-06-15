const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./utils/logger');
const config = require('../config/config');
const { getStore } = require('../db/store');

class EvidenceCollector {
  constructor() {
    this.evidenceDir = config.evidence.dir;
    this._ensureDir(this.evidenceDir);
    this.store = getStore();
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _getEvidencePath(projectNo, type) {
    const dateDir = new Date().toISOString().split('T')[0];
    const projectDir = path.join(this.evidenceDir, dateDir, projectNo);
    this._ensureDir(projectDir);
    return projectDir;
  }

  async capturePage(page, projectNo, projectName = '') {
    const evidenceDir = this._getEvidencePath(projectNo, 'screenshot');
    const timestamp = new Date().toISOString();
    const safeProjectName = projectName.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);

    const screenshotPath = path.join(evidenceDir, `${safeProjectName || projectNo}_screenshot.png`);
    const htmlPath = path.join(evidenceDir, `${safeProjectName || projectNo}_source.html`);
    const metaPath = path.join(evidenceDir, `${safeProjectName || projectNo}_meta.json`);

    try {
      const screenshotBuffer = await this._takeFullScreenshot(page, screenshotPath);
      const htmlContent = await page.content();
      fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

      const screenshotHash = this._calculateHash(screenshotBuffer);
      const htmlHash = this._calculateHash(htmlContent);

      const metadata = {
        projectNo,
        projectName,
        timestamp,
        url: page.url(),
        screenshot: {
          path: screenshotPath,
          hash: screenshotHash,
          size: screenshotBuffer.length,
          hashAlgorithm: 'SHA-256',
        },
        html: {
          path: htmlPath,
          hash: htmlHash,
          size: Buffer.byteLength(htmlContent),
          hashAlgorithm: 'SHA-256',
        },
        userAgent: await page.evaluate(() => navigator.userAgent),
      };

      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

      const combinedHash = this._calculateHash(screenshotHash + htmlHash);

      logger.success(`证据固定完成: ${projectNo}`, 'Evidence');
      logger.debug(`截图: ${screenshotPath}`, 'Evidence');
      logger.debug(`HTML: ${htmlPath}`, 'Evidence');

      return {
        screenshotPath,
        htmlPath,
        screenshotHash,
        htmlHash,
        combinedHash,
        metadata,
      };
    } catch (error) {
      logger.error(`证据固定失败 ${projectNo}: ${error.message}`, 'Evidence');
      throw error;
    }
  }

  async _takeFullScreenshot(page, outputPath) {
    const quality = config.evidence.screenshotQuality;

    await this._injectWatermark(page);

    const buffer = await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: 'png',
      quality: quality,
    });

    const fileSizeMB = buffer.length / (1024 * 1024);
    if (fileSizeMB > config.evidence.maxScreenshotSizeMB) {
      logger.warn(`截图文件 ${fileSizeMB.toFixed(2)}MB 超过限制 ${config.evidence.maxScreenshotSizeMB}MB`, 'Evidence');
    }

    return buffer;
  }

  async _injectWatermark(page) {
    const timestamp = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
    });
    const url = page.url();

    await page.evaluate(({ timestamp, url }) => {
      const existing = document.getElementById('evidence-watermark');
      if (existing) {
        existing.remove();
      }

      const watermark = document.createElement('div');
      watermark.id = 'evidence-watermark';
      watermark.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.75);
        color: #ffffff;
        padding: 10px 14px;
        font-size: 13px;
        font-family: 'Microsoft YaHei', 'SimHei', monospace;
        border-radius: 6px;
        z-index: 2147483647;
        line-height: 1.6;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        pointer-events: none;
        user-select: none;
        max-width: 400px;
        word-break: break-all;
      `;
      watermark.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: #ff6b6b;">
          ⚠️ 证据固定 - 取证时间
        </div>
        <div style="font-family: monospace;">${timestamp}</div>
        <div style="font-size: 11px; margin-top: 4px; opacity: 0.9;">${url}</div>
      `;

      document.body.appendChild(watermark);

      const cornerLeft = watermark.cloneNode(true);
      cornerLeft.id = 'evidence-watermark-left';
      cornerLeft.style.left = '20px';
      cornerLeft.style.right = 'auto';
      cornerLeft.style.top = '20px';
      cornerLeft.style.bottom = 'auto';
      document.body.appendChild(cornerLeft);

      document.body.classList.add('evidence-captured');
    }, { timestamp, url });

    await page.waitForTimeout(200);
  }

  _calculateHash(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  async collectEvidenceForRisk(riskEvent, page) {
    try {
      const evidence = await this.capturePage(page, riskEvent.projectNo, riskEvent.projectName);

      this.store.db.prepare(`
        UPDATE risk_events
        SET evidence_screenshot = ?,
            evidence_html = ?,
            evidence_hash = ?,
            status = 'evidence_collected'
        WHERE id = ?
      `).run(
        evidence.screenshotPath,
        evidence.htmlPath,
        evidence.combinedHash,
        riskEvent.id
      );

      logger.success(`风险事件 ${riskEvent.id} 证据已固定`, 'Evidence');

      return evidence;
    } catch (error) {
      logger.error(`风险事件 ${riskEvent.id} 证据固定失败: ${error.message}`, 'Evidence');
      throw error;
    }
  }

  async batchCollectHighRisk(browserPool, platform, threshold = config.analysis.highRiskThreshold) {
    const { db } = this.store;
    const highRisks = db.prepare(`
      SELECT * FROM risk_events
      WHERE risk_score >= ? AND status = 'pending'
      ORDER BY risk_score DESC
      LIMIT 20
    `).all(threshold);

    logger.info(`开始为 ${highRisks.length} 个高危项目固定证据`, 'Evidence');

    const contextWrapper = await browserPool.acquire();
    const page = await browserPool.newPage(contextWrapper);

    try {
      for (const risk of highRisks) {
        try {
          const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(risk.project_id);
          if (project && project.notice_url) {
            await page.goto(project.notice_url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1000);
            await this.collectEvidenceForRisk(risk, page);
          }
        } catch (e) {
          logger.error(`处理风险事件 ${risk.id} 失败: ${e.message}`, 'Evidence');
        }
      }
    } finally {
      await page.close();
      await browserPool.release(contextWrapper);
    }

    return highRisks.length;
  }

  verifyEvidence(evidencePath) {
    if (!fs.existsSync(evidencePath)) {
      return { valid: false, reason: '文件不存在' };
    }

    const metaPath = evidencePath.replace(/\.[^.]+$/, '_meta.json');
    if (!fs.existsSync(metaPath)) {
      return { valid: false, reason: '元数据文件不存在' };
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

      if (metadata.screenshot && fs.existsSync(metadata.screenshot.path)) {
        const actualHash = this._calculateHash(fs.readFileSync(metadata.screenshot.path));
        if (actualHash !== metadata.screenshot.hash) {
          return { valid: false, reason: '截图文件哈希不匹配' };
        }
      }

      if (metadata.html && fs.existsSync(metadata.html.path)) {
        const actualHash = this._calculateHash(fs.readFileSync(metadata.html.path));
        if (actualHash !== metadata.html.hash) {
          return { valid: false, reason: 'HTML文件哈希不匹配' };
        }
      }

      return { valid: true, metadata };
    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  getEvidenceList(startDate, endDate) {
    const result = [];
    const startDir = startDate ? new Date(startDate).toISOString().split('T')[0] : null;
    const endDir = endDate ? new Date(endDate).toISOString().split('T')[0] : null;

    if (!fs.existsSync(this.evidenceDir)) {
      return result;
    }

    const dateDirs = fs.readdirSync(this.evidenceDir).filter(d => {
      if (startDir && d < startDir) return false;
      if (endDir && d > endDir) return false;
      return true;
    }).sort().reverse();

    for (const dateDir of dateDirs) {
      const datePath = path.join(this.evidenceDir, dateDir);
      const projectDirs = fs.readdirSync(datePath);

      for (const projectDir of projectDirs) {
        const projectPath = path.join(datePath, projectDir);
        const files = fs.readdirSync(projectPath);

        const metaFile = files.find(f => f.endsWith('_meta.json'));
        if (metaFile) {
          const metaPath = path.join(projectPath, metaFile);
          try {
            const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            result.push(metadata);
          } catch (e) {
            // ignore
          }
        }
      }
    }

    return result;
  }
}

let evidenceInstance = null;

function getEvidenceCollector() {
  if (!evidenceInstance) {
    evidenceInstance = new EvidenceCollector();
  }
  return evidenceInstance;
}

module.exports = {
  EvidenceCollector,
  getEvidenceCollector,
};
