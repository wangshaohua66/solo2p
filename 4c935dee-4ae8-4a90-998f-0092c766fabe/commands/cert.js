'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('../lib/crypto');
const { buildContext } = require('../lib/runtime');
const { renderTable, makeSpinner, tierColor } = require('../lib/ui');
const { pLimit } = require('../lib/util');

const CERT_EXTENSIONS = new Set(['.pem', '.crt', '.cer', '.der', '.cert']);
const PEM_HEADER = /-----BEGIN CERTIFICATE-----/;

async function findCertFiles(dirs) {
  const files = [];
  const stack = dirs.slice();
  const ignore = new Set(['node_modules', '.git', 'dist', 'build']);
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        if (CERT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          files.push(full);
        }
      }
    }
  }
  return files;
}

function splitPemCertificates(content) {
  const blocks = [];
  const re = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  let m;
  while ((m = re.exec(content)) !== null) blocks.push(m[0]);
  if (!blocks.length && content.includes('BEGIN CERTIFICATE')) blocks.push(content);
  return blocks;
}

async function parseCertFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const blocks = splitPemCertificates(content);
  const results = [];
  for (let idx = 0; idx < blocks.length; idx++) {
    try {
      const info = crypto.parseCertificate(blocks[idx], 'pem');
      const tier = crypto.expiryTier(info.daysRemaining, info.isExpired);
      results.push({ ...info, tier, source: file, index: idx });
    } catch (err) {
      results.push({ source: file, index: idx, error: err.message, tier: 'error' });
    }
  }
  return results;
}

function isCritical(tier) {
  return tier === 'expired' || tier === 'critical' || tier === 'high';
}

async function run(argv) {
  const ctx = buildContext(argv);
  const { logger, notifier } = ctx;
  const rawPaths = Array.isArray(argv.paths) ? argv.paths : (argv.paths ? [argv.paths] : []);
  const paths = rawPaths.filter(Boolean).length ? rawPaths.filter(Boolean) : ['.'];

  const spinner = makeSpinner({ ...argv, text: '解析 X.509 证书' });
  spinner.start();

  const certFiles = [];
  for (const p of paths) {
    const abs = path.resolve(p);
    try {
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        certFiles.push(...(await findCertFiles([abs])));
      } else {
        certFiles.push(abs);
      }
    } catch (err) {
      logger.warn(`路径不可访问: ${abs} (${err.message})`);
    }
  }

  const limit = pLimit(16);
  const allCerts = [];
  await Promise.all(certFiles.map((file) => limit(async () => {
    const parsed = await parseCertFile(file);
    allCerts.push(...parsed);
  })));

  let certs = allCerts.filter((c) => !c.error);
  const errors = allCerts.filter((c) => c.error);

  if (argv.critical) {
    certs = certs.filter((c) => isCritical(c.tier));
  }

  certs.sort((a, b) => crypto.TIER_RANK[a.tier] - crypto.TIER_RANK[b.tier]);

  spinner.succeed(`解析完成: ${certFiles.length} 个文件, ${allCerts.length} 张证书, ${errors.length} 个解析错误`);

  const summary = {
    profile: ctx.profile.name,
    total: allCerts.length,
    expired: certs.filter((c) => c.tier === 'expired').length,
    critical: certs.filter((c) => c.tier === 'critical').length,
    high: certs.filter((c) => c.tier === 'high').length,
    medium: certs.filter((c) => c.tier === 'medium').length,
    low: certs.filter((c) => c.tier === 'low').length,
    ok: certs.filter((c) => c.tier === 'ok').length,
    errors: errors.length
  };

  const result = {
    summary,
    certs: certs.map((c) => ({
      cn: c.cn,
      sans: c.sans,
      issuer: c.issuer,
      notBefore: c.notBefore,
      notAfter: c.notAfter,
      daysRemaining: c.daysRemaining,
      isExpired: c.isExpired,
      tier: c.tier,
      tierLabel: crypto.TIER_LABEL[c.tier],
      serialNumber: c.serialNumber,
      fingerprint: c.fingerprint,
      source: c.source
    }))
  };

  if (argv.json || argv.format === 'json') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return result;
  }

  logger.info(`证书统计: 过期 ${summary.expired} | 紧急 ${summary.critical} | 高 ${summary.high} | 中 ${summary.medium} | 低 ${summary.low} | 正常 ${summary.ok}`);

  if (certs.length === 0) {
    logger.success('没有需要预警的证书');
    return result;
  }

  const headers = ['CN', '颁发者', '到期日', '剩余天数', '级别', '来源'];
  const rows = certs.map((c) => [
    c.cn || c.fingerprint.slice(0, 16),
    c.issuer || '-',
    (c.notAfter || '').slice(0, 10),
    String(c.daysRemaining),
    tierColor(c.tier, crypto.TIER_LABEL[c.tier]),
    path.basename(c.source)
  ]);
  logger.raw(renderTable(headers, rows));

  if (argv.notify) {
    const alertItems = certs.filter((c) => c.tier !== 'ok');
    if (alertItems.length) {
      const { title, markdown } = notifier.formatCertAlert(alertItems.map((c) => ({
        cn: c.cn, sans: c.sans, daysRemaining: c.daysRemaining, tier: c.tier, notAfter: c.notAfter, fingerprint: c.fingerprint
      })), ctx.profile.name);
      const res = await notifier.notifyAll(title, markdown);
      logger.info(`告警推送: ${JSON.stringify(res)}`);
      for (const c of alertItems) {
        ctx.store.recordAudit({
          action: 'cert-alert',
          secretName: c.cn || c.fingerprint.slice(0, 16),
          secretPath: c.source,
          source: 'file',
          status: 'success',
          profile: ctx.profile.name,
          message: `证书将在 ${c.daysRemaining} 天后到期 (${crypto.TIER_LABEL[c.tier]})`,
          metadata: { tier: c.tier, daysRemaining: c.daysRemaining, notAfter: c.notAfter, handled: false }
        });
      }
    } else {
      logger.info('无紧急证书，跳过告警推送');
    }
  }

  return result;
}

module.exports = {
  command: 'cert [paths...]',
  describe: 'X.509 证书生命周期管理：解析证书并按 30/14/7/3 天分级预警',
  builder: (yargs) => yargs
    .positional('paths', { type: 'string', describe: '证书文件或目录' })
    .option('critical', { type: 'boolean', default: false, describe: '仅输出紧急过期证书 (<=7天或已过期)' })
    .option('notify', { type: 'boolean', default: false, describe: '推送告警到钉钉/企业微信 webhook' })
    .option('format', { type: 'string', choices: ['table', 'json'], describe: '输出格式' }),
  handler: async (argv) => {
    try {
      return await run(argv);
    } catch (err) {
      const logger = require('../lib/logger').createLogger({ quiet: argv.quiet, json: argv.json });
      logger.error(`${err.message}${err.hint ? '\n排查建议: ' + err.hint : ''}`);
      process.exit(1);
    }
  }
};
