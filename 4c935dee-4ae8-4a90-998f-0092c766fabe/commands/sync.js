'use strict';

const fs = require('fs');
const crypto = require('../lib/crypto');
const config = require('../config');
const { VaultClient } = require('../lib/vault-client');
const { createLogger } = require('../lib/logger');
const store = require('../lib/store');
const { renderTable, makeSpinner, statusBadge, progressBar } = require('../lib/ui');
const { pLimit, toAppError, ERROR_CODES } = require('../lib/util');
const inquirer = require('inquirer');

function vaultFor(profileName) {
  const prof = config.resolve({ profile: profileName });
  return { profile: prof, vault: new VaultClient(prof) };
}

function applyMapping(path, opts) {
  let mapped = path;
  if (opts.mapping) {
    const map = opts.mapping;
    if (map[path]) return map[path];
    for (const [from, to] of Object.entries(map)) {
      if (path === from || path.startsWith(from + '/')) {
        return to + path.slice(from.length);
      }
    }
  }
  if (opts.srcPrefix && opts.dstPrefix !== undefined) {
    if (mapped === opts.srcPrefix || mapped.startsWith(opts.srcPrefix + '/')) {
      mapped = opts.dstPrefix + mapped.slice(opts.srcPrefix.length);
    }
  }
  return mapped;
}

async function doExport(argv) {
  const logger = createLogger({ quiet: argv.quiet, json: argv.json });
  const { profile, vault } = vaultFor(argv.profile);
  const spinner = makeSpinner({ ...argv, text: `从 ${profile.name} 导出密钥到加密文件` });
  spinner.start();
  await vault.login();
  const paths = await vault.listAll(argv.prefix || '');
  const reads = await vault.readMany(paths, (done) => {
    spinner.text = `读取密钥: ${progressBar(done, paths.length, 20)}`;
  });
  const secrets = reads.filter((r) => r.ok).map((r) => ({ path: r.path, data: r.data }));
  const failed = reads.filter((r) => !r.ok);

  const bundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceProfile: profile.name,
    vaultMount: profile.vault.mount,
    kvVersion: profile.vault.kvVersion,
    count: secrets.length,
    secrets
  };

  const passphrase = argv.passphrase || process.env.SC_SYNC_PASSPHRASE;
  if (!passphrase) {
    spinner.fail('缺少加密口令 (--passphrase 或 SC_SYNC_PASSPHRASE)');
    throw toAppError(new Error('missing passphrase'), ERROR_CODES.VALIDATION);
  }
  const encrypted = crypto.encryptToPayload(bundle, passphrase);
  const outFile = argv.out;
  const tmp = `${outFile}.tmp`;
  store.registerTemp(tmp);
  fs.writeFileSync(tmp, JSON.stringify(encrypted, null, 2));
  fs.renameSync(tmp, outFile);
  store.unregisterTemp(tmp);
  try { fs.chmodSync(outFile, 0o600); } catch { /* best effort */ }
  spinner.succeed(`导出完成: ${secrets.length} 个密钥 -> ${outFile} (失败 ${failed.length})`);

  const result = { exported: secrets.length, failed: failed.length, file: outFile, profile: profile.name };
  if (argv.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  store.recordAudit({ action: 'sync-export', secretName: '*', source: 'vault', status: 'success', profile: profile.name, message: `导出 ${secrets.length} 个密钥到 ${outFile}` });
  store.recordAudit({ action: 'access', secretName: '*', secretPath: argv.prefix || '', source: 'vault', status: 'success', profile: profile.name, message: `扫描导出 ${secrets.length} 个密钥` });
  return result;
}

async function doImport(argv) {
  const logger = createLogger({ quiet: argv.quiet, json: argv.json });
  const { profile, vault } = vaultFor(argv.profile);
  const spinner = makeSpinner({ ...argv, text: `从加密文件导入密钥到 ${profile.name}` });
  spinner.start();

  const passphrase = argv.passphrase || process.env.SC_SYNC_PASSPHRASE;
  if (!passphrase) {
    spinner.fail('缺少加密口令');
    throw toAppError(new Error('missing passphrase'), ERROR_CODES.VALIDATION);
  }

  let mapping = {};
  if (argv.mappingFile) {
    mapping = JSON.parse(fs.readFileSync(argv.mappingFile, 'utf8'));
  }

  const raw = fs.readFileSync(argv.in, 'utf8');
  const blob = JSON.parse(raw);
  const bundle = crypto.decryptPayload(blob, passphrase);

  await vault.login();

  const items = (bundle.secrets || []).map((s) => ({
    srcPath: s.path,
    dstPath: applyMapping(s.path, { mapping, srcPrefix: argv.srcPrefix, dstPrefix: argv.dstPrefix }),
    data: s.data
  }));

  const conflict = argv.conflict || 'skip';
  const results = [];
  const limit = pLimit(10);
  let processed = 0;

  for (const item of items) {
    await limit(async () => {
      let exists = false;
      try {
        const cur = await vault.readSecret(item.dstPath);
        exists = !!cur && cur.data && Object.keys(cur.data).length > 0;
      } catch (err) {
        if (err.code !== ERROR_CODES.VAULT_NOT_FOUND.code) {
          results.push({ src: item.srcPath, dst: item.dstPath, ok: false, action: 'error', error: err.message });
          return;
        }
      }

      if (exists) {
        store.recordAudit({ action: 'access', secretName: item.dstPath, secretPath: item.dstPath, source: 'vault', status: 'success', profile: profile.name, message: '同步冲突检测读取' });
      }

      let action = exists ? conflict : 'create';
      if (argv.dryRun) action = exists ? `would-${conflict}` : 'would-create';

      if (action === 'skip' || action === 'would-skip') {
        results.push({ src: item.srcPath, dst: item.dstPath, ok: true, action });
        return;
      }
      if (action === 'ask' && !argv.dryRun) {
        const ans = await inquirer.prompt([{
          type: 'confirm',
          name: 'overwrite',
          message: `路径 ${item.dstPath} 已存在，是否覆盖?`,
          default: false
        }]);
        if (!ans.overwrite) {
          results.push({ src: item.srcPath, dst: item.dstPath, ok: true, action: 'skipped-by-user' });
          return;
        }
        action = 'overwrite';
      }

      if (argv.dryRun) {
        results.push({ src: item.srcPath, dst: item.dstPath, ok: true, action });
        return;
      }

      try {
        const beforeHash = crypto.sha256(JSON.stringify(item.data));
        await vault.writeSecret(item.dstPath, item.data);
        const afterHash = crypto.sha256(JSON.stringify(item.data));
        store.recordAudit({ action: 'sync-import', secretName: item.dstPath, secretPath: item.dstPath, source: 'vault', status: 'success', profile: profile.name, beforeHash, afterHash, message: `从 ${bundle.sourceProfile} 同步 (${action})` });
        store.upsertSecret(profile.name, { path: item.dstPath, name: item.dstPath, source: 'vault', lastHash: afterHash, lastRotatedAt: new Date().toISOString() });
        results.push({ src: item.srcPath, dst: item.dstPath, ok: true, action });
      } catch (err) {
        store.recordAudit({ action: 'sync-import', secretName: item.dstPath, secretPath: item.dstPath, source: 'vault', status: 'failed', profile: profile.name, message: err.message });
        results.push({ src: item.srcPath, dst: item.dstPath, ok: false, action: 'error', error: err.message });
      }
    });
    processed += 1;
    spinner.text = `导入中: ${progressBar(processed, items.length, 20)}`;
  }

  spinner.succeed(`导入完成: 成功 ${results.filter((r) => r.ok).length} / 失败 ${results.filter((r) => !r.ok).length}`);

  const summary = {
    profile: profile.name,
    sourceProfile: bundle.sourceProfile,
    dryRun: !!argv.dryRun,
    total: items.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results
  };

  if (argv.json) process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  else {
    const headers = ['源路径', '目标路径', '状态', '动作'];
    const rows = results.map((r) => [
      r.src,
      r.dst,
      r.ok ? statusBadge(true) : statusBadge(false),
      r.action + (r.error ? ` (${r.error})` : '')
    ]);
    logger.raw(renderTable(headers, rows));
  }
  return summary;
}

async function run(argv) {
  const mode = argv.mode || 'export';
  if (mode === 'export') return doExport(argv);
  if (mode === 'import') return doImport(argv);
  throw toAppError(new Error(`未知 sync 模式: ${mode}`), ERROR_CODES.VALIDATION);
}

module.exports = {
  command: 'sync',
  describe: '多环境密钥同步：导出到加密文件 / 批量导入，支持路径映射与冲突策略',
  builder: (yargs) => yargs
    .option('mode', { type: 'string', choices: ['export', 'import'], default: 'export', describe: '同步模式' })
    .option('profile', { type: 'string', describe: '源(导出)/目标(导入)环境 profile' })
    .option('out', { type: 'string', default: 'secrets-export.json.enc', describe: '导出文件路径' })
    .option('in', { type: 'string', default: 'secrets-export.json.enc', describe: '导入文件路径' })
    .option('passphrase', { type: 'string', describe: '加密口令 (也可用 SC_SYNC_PASSPHRASE)' })
    .option('prefix', { type: 'string', describe: '导出时仅导出该前缀下的密钥' })
    .option('src-prefix', { type: 'string', describe: '导入路径映射：源前缀' })
    .option('dst-prefix', { type: 'string', describe: '导入路径映射：目标前缀' })
    .option('mapping-file', { type: 'string', describe: '导入路径精确映射 JSON 文件' })
    .option('conflict', { type: 'string', choices: ['overwrite', 'skip', 'ask'], default: 'skip', describe: '冲突处理策略' })
    .option('dry-run', { type: 'boolean', default: false, describe: '预览模式' })
    .option('format', { type: 'string', choices: ['table', 'json'], describe: '输出格式' }),
  handler: async (argv) => {
    try {
      return await run(argv);
    } catch (err) {
      const logger = createLogger({ quiet: argv.quiet, json: argv.json });
      logger.error(`${err.message}${err.hint ? '\n排查建议: ' + err.hint : ''}`);
      process.exit(1);
    }
  }
};
