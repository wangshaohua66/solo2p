const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const { logger, verbose } = require('../utils/logger');
const { withRetry, RetryError } = require('../utils/retry');
const { ensureDir, getFileExtension, formatFileSize, generateId } = require('../utils/common');
const { paths, performanceConfig } = require('../../config/schedule');

class EmailCollector {
  constructor(orgConfig) {
    this.orgConfig = orgConfig;
    this.orgId = orgConfig.id;
    this.orgName = orgConfig.name;
    this.emailConfig = orgConfig.emailConfig || {};
    this.imap = null;
    this.connected = false;
    this.currentHost = this.emailConfig.host;
  }

  async _connect(useBackup = false) {
    const host = useBackup && this.emailConfig.backupHost ? this.emailConfig.backupHost : this.emailConfig.host;
    this.currentHost = host;
    verbose(`[${this.orgId}] 正在连接邮箱服务器 ${host}:${this.emailConfig.port}...`);

    const config = {
      host,
      port: this.emailConfig.port,
      secure: this.emailConfig.secure !== false,
      user: this.emailConfig.user,
      password: this.emailConfig.password,
      tls: { rejectUnauthorized: false },
      connTimeout: 30000,
      authTimeout: 10000,
      keepalive: true
    };

    this.imap = new Imap(config);

    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        this.connected = true;
        verbose(`[${this.orgId}] 邮箱服务器连接成功 (${host})`);
        resolve();
      });
      this.imap.once('error', (err) => {
        this.connected = false;
        reject(new Error(`邮箱连接失败(${host}): ${err.message}`));
      });
      this.imap.once('end', () => {
        this.connected = false;
        verbose(`[${this.orgId}] 邮箱连接已断开`);
      });
      try {
        this.imap.connect();
      } catch (err) {
        reject(err);
      }
    });
  }

  async connect() {
    try {
      await withRetry(
        async () => this._connect(false),
        { context: `[${this.orgId}] 连接主邮箱服务器`, maxRetries: 2 }
      );
      return true;
    } catch (primaryErr) {
      logger.warn(`[${this.orgId}] 主邮箱服务器连接失败: ${primaryErr.message}`);
      if (this.emailConfig.backupHost) {
        try {
          await withRetry(
            async () => this._connect(true),
            { context: `[${this.orgId}] 连接备用邮箱服务器`, maxRetries: 2 }
          );
          return true;
        } catch (backupErr) {
          throw new Error(`邮箱连接全部失败: 主服务器${primaryErr.message}, 备用服务器${backupErr.message}`);
        }
      }
      throw primaryErr;
    }
  }

  disconnect() {
    if (this.imap && this.connected) {
      this.imap.end();
      this.connected = false;
    }
  }

  _searchCriteria(sinceDate) {
    const criteria = ['UNSEEN'];
    if (sinceDate) {
      const dateStr = sinceDate.toISOString().split('T')[0];
      criteria.push(['ON', dateStr]);
    }
    const keywords = this.emailConfig.subjectKeywords || [];
    if (keywords.length > 0) {
      criteria.push(['OR', ['SUBJECT', keywords[0]], ['SUBJECT', keywords.join(' ')]]);
    }
    return criteria;
  }

  _isReportEmail(subject, from, keywords) {
    if (!subject) return false;
    const lowerSubject = subject.toLowerCase();
    return keywords.some((kw) => lowerSubject.includes(kw.toLowerCase()));
  }

  async fetchEmails(options = {}) {
    if (!this.connected) {
      await this.connect();
    }
    const { sinceDate, limit = 50, markSeen = true } = options;

    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', !markSeen, (err, box) => {
        if (err) {
          return reject(new Error(`打开收件箱失败: ${err.message}`));
        }
        const criteria = this._searchCriteria(sinceDate);
        verbose(`[${this.orgId}] 搜索邮件条件: ${JSON.stringify(criteria)}`);

        this.imap.search(criteria, (searchErr, results) => {
          if (searchErr) {
            return reject(new Error(`搜索邮件失败: ${searchErr.message}`));
          }
          if (!results || results.length === 0) {
            logger.info(`[${this.orgId}] 未找到符合条件的邮件`);
            return resolve([]);
          }
          const messageIds = results.slice(0, limit);
          logger.info(`[${this.orgId}] 找到 ${messageIds.length} 封候选邮件`);

          const messages = [];
          const fetch = this.imap.fetch(messageIds, {
            bodies: '',
            markSeen,
            struct: true
          });

          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, async (parseErr, parsed) => {
                if (parseErr) {
                  logger.warn(`[${this.orgId}] 解析邮件失败: ${parseErr.message}`);
                  return;
                }
                const subject = parsed.subject || '';
                const from = parsed.from?.text || '';
                const keywords = this.emailConfig.subjectKeywords || [];
                if (this._isReportEmail(subject, from, keywords)) {
                  messages.push({
                    messageId: parsed.messageId || generateId(),
                    subject,
                    from,
                    date: parsed.date || new Date(),
                    to: parsed.to?.text || '',
                    text: parsed.text || '',
                    html: parsed.html || '',
                    attachments: (parsed.attachments || []).map((att) => ({
                      filename: att.filename || `attachment_${generateId()}`,
                      content: att.content,
                      contentType: att.contentType,
                      size: att.size,
                      checksum: att.checksum
                    }))
                  });
                }
              });
            });
          });

          fetch.once('error', (fetchErr) => {
            reject(new Error(`获取邮件失败: ${fetchErr.message}`));
          });

          fetch.once('end', () => {
            setTimeout(() => {
              logger.info(`[${this.orgId}] 成功解析 ${messages.length} 封报送邮件`);
              resolve(messages);
            }, 500);
          });
        });
      });
    });
  }

  _isAllowedAttachment(filename) {
    const allowedExts = ['xlsx', 'xls', 'csv', 'zip', 'json', 'xml'];
    return allowedExts.includes(getFileExtension(filename));
  }

  async saveAttachments(emails, targetDir) {
    const baseDir = targetDir || path.join(paths.data.raw, this.orgId);
    ensureDir(baseDir);

    const savedFiles = [];
    for (const email of emails) {
      const emailTimestamp = email.date ? new Date(email.date).getTime() : Date.now();
      for (const att of email.attachments || []) {
        if (!this._isAllowedAttachment(att.filename)) {
          verbose(`[${this.orgId}] 跳过非报送附件: ${att.filename}`);
          continue;
        }
        if (att.size > performanceConfig.maxFileSizeMB * 1024 * 1024) {
          logger.warn(`[${this.orgId}] 附件超限(最大${performanceConfig.maxFileSizeMB}MB): ${att.filename}(${formatFileSize(att.size)})`);
          continue;
        }
        const safeFilename = `${emailTimestamp}_${att.filename.replace(/[^\w.\-]/g, '_')}`;
        const savePath = path.join(baseDir, safeFilename);
        fs.writeFileSync(savePath, att.content);
        const ext = getFileExtension(att.filename);
        let extractedFiles = [savePath];
        if (ext === 'zip') {
          try {
            extractedFiles = await this._extractZip(savePath, baseDir);
          } catch (e) {
            logger.warn(`[${this.orgId}] 解压ZIP失败: ${e.message}, 保留原始文件`);
            extractedFiles = [savePath];
          }
        }
        for (const fp of extractedFiles) {
          const stats = fs.existsSync(fp) ? fs.statSync(fp) : null;
          savedFiles.push({
            filePath: fp,
            filename: path.basename(fp),
            size: stats?.size || 0,
            originalFilename: att.filename,
            emailSubject: email.subject,
            emailFrom: email.from,
            emailDate: email.date,
            messageId: email.messageId,
            orgId: this.orgId,
            orgName: this.orgName,
            source: 'email',
            collectedAt: new Date().toISOString()
          });
        }
      }
    }
    logger.info(`[${this.orgId}] 保存附件 ${savedFiles.length} 个文件到 ${baseDir}`);
    return savedFiles;
  }

  async _extractZip(zipPath, outDir) {
    const extracted = [];
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
        if (err) return reject(err);
        zipfile.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
            return;
          }
          const entryExt = getFileExtension(entry.fileName);
          if (!['xlsx', 'xls', 'csv', 'json', 'xml'].includes(entryExt)) {
            zipfile.readEntry();
            return;
          }
          const outPath = path.join(outDir, path.basename(entry.fileName).replace(/[^\w.\-]/g, '_'));
          zipfile.openReadStream(entry, (readErr, readStream) => {
            if (readErr) {
              logger.warn(`读取ZIP条目失败: ${entry.fileName}`);
              return zipfile.readEntry();
            }
            const writeStream = fs.createWriteStream(outPath);
            readStream.pipe(writeStream);
            writeStream.on('close', () => {
              extracted.push(outPath);
              zipfile.readEntry();
            });
          });
        });
        zipfile.on('end', () => resolve(extracted));
        zipfile.on('error', reject);
        zipfile.readEntry();
      });
    });
  }

  async collect(options = {}) {
    const startTime = Date.now();
    let collected = [];
    try {
      await this.connect();
      const emails = await this.fetchEmails(options);
      collected = await this.saveAttachments(emails, options.targetDir);
      return {
        success: true,
        orgId: this.orgId,
        orgName: this.orgName,
        source: 'email',
        files: collected,
        emailCount: emails.length,
        fileCount: collected.length,
        durationMs: Date.now() - startTime,
        collectedAt: new Date().toISOString()
      };
    } catch (err) {
      logger.error(`[${this.orgId}] 邮箱采集失败: ${err.message}`);
      if (err instanceof RetryError) {
        throw err;
      }
      throw new Error(`邮箱采集失败: ${err.message}`);
    } finally {
      this.disconnect();
    }
  }
}

module.exports = {
  EmailCollector
};
