'use strict';

const fs = require('fs');
const crypto = require('../lib/crypto');
const { buildContext } = require('../lib/runtime');
const { renderTable, makeSpinner, statusBadge } = require('../lib/ui');
const { pLimit, toAppError, ERROR_CODES } = require('../lib/util');

function resolveTargets(argv, ctx) {
  const targets = [];
  if (argv.manifest) {
    const raw = fs.readFileSync(argv.manifest, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw toAppError(new Error('manifest 必须是 JSON 数组'), ERROR_CODES.VALIDATION);
    for (const t of list) {
      targets.push(normalizeTarget(t, argv));
    }
    return targets;
  }
  const paths = Array.isArray(argv.paths) ? argv.paths : (argv.paths ? [argv.paths] : []);
  if (paths.length === 0 && argv.tag) {
    const tagged = ctx.store.getSecrets(ctx.profile.name).filter((s) => {
      const tags = (s.metadata && s.metadata.tags) || [];
      return Array.isArray(tags) ? tags.includes(argv.tag) : false;
    });
    for (const s of tagged) targets.push(normalizeTarget({ path: s.path, field: argv.field, k8s: argv.k8sName ? { name: argv.k8sName, namespace: argv.k8sNamespace, key: argv.k8sKey } : null, length: argv.length }, argv));
    return targets;
  }
  for (const p of paths) {
    targets.push(normalizeTarget({ path: p, field: argv.field, k8s: argv.k8sName ? { name: argv.k8sName, namespace: argv.k8sNamespace, key: argv.k8sKey } : null, length: argv.length }, argv));
  }
  return targets;
}

function normalizeTarget(t, argv) {
  return {
    path: t.path,
    field: t.field || (argv && argv.field) || 'password',
    length: t.length || (argv && argv.length) || 24,
    k8s: t.k8s || null
  };
}

async function rotateOne(target, ctx, opts) {
  const dryRun = !!opts.dryRun;
  const result = { path: target.path, field: target.field, ok: false, rolledBack: false };

  let beforeData;
  try {
    const secret = await ctx.vault.readSecret(target.path);
    beforeData = secret.data || {};
  } catch (err) {
    result.error = err.message;
    result.code = err.code;
    ctx.store.recordAudit({ action: 'rotate', secretName: target.path, secretPath: target.path, source: 'vault', status: 'failed', profile: ctx.profile.name, message: `读取失败: ${err.message}` });
    return result;
  }

  const oldValue = beforeData[target.field];
  const beforeHash = crypto.sha256(oldValue);
  const newValue = crypto.generatePassword({ length: target.length });
  const afterHash = crypto.sha256(newValue);

  result.beforeHash = beforeHash;
  result.afterHash = afterHash;
  result.preview = `${beforeHash.slice(0, 8)} -> ${afterHash.slice(0, 8)}`;

  if (dryRun) {
    result.ok = true;
    result.dryRun = true;
    return result;
  }

  const newData = Object.assign({}, beforeData, { [target.field]: newValue });

  try {
    await ctx.vault.writeSecret(target.path, newData);
  } catch (err) {
    result.error = `Vault 写入失败: ${err.message}`;
    result.code = err.code;
    ctx.store.recordAudit({ action: 'rotate', secretName: target.path, secretPath: target.path, source: 'vault', status: 'failed', profile: ctx.profile.name, beforeHash, message: result.error });
    return result;
  }

  if (target.k8s && target.k8s.name) {
    let prevK8sData = null;
    try {
      const existing = await ctx.k8s.readSecret(target.k8s.name, target.k8s.namespace);
      prevK8sData = existing ? existing.data : {};
      const k8sData = Object.assign({}, prevK8sData, { [target.k8s.key || target.field]: newValue });
      await ctx.k8s.writeSecret(target.k8s.name, k8sData, { namespace: target.k8s.namespace });
      result.k8s = { name: target.k8s.name, ok: true };
    } catch (err) {
      result.rolledBack = true;
      result.k8s = { name: target.k8s.name, ok: false, error: err.message };
      try {
        await ctx.vault.writeSecret(target.path, beforeData);
        result.rollback = 'vault-restored';
      } catch (rbErr) {
        result.rollback = `vault-restore-failed: ${rbErr.message}`;
      }
      if (prevK8sData) {
        try { await ctx.k8s.writeSecret(target.k8s.name, prevK8sData, { namespace: target.k8s.namespace }); } catch { /* best effort */ }
      }
      ctx.store.recordAudit({ action: 'rotate', secretName: target.path, secretPath: target.path, source: 'vault+k8s', status: 'failed', profile: ctx.profile.name, beforeHash, afterHash, message: `K8s 同步失败已回滚: ${err.message}` });
      result.error = `K8s 同步失败已回滚: ${err.message}`;
      return result;
    }
  }

  result.ok = true;
  ctx.store.recordAudit({
    action: 'rotate',
    secretName: target.path,
    secretPath: target.path,
    source: target.k8s && target.k8s.name ? 'vault+k8s' : 'vault',
    status: 'success',
    profile: ctx.profile.name,
    beforeHash,
    afterHash,
    message: `轮换字段 ${target.field}`
  });
  ctx.store.upsertSecret(ctx.profile.name, {
    path: target.path,
    name: target.path,
    source: 'vault',
    lastHash: afterHash,
    prevHash: beforeHash,
    lastRotatedAt: new Date().toISOString()
  });
  return result;
}

async function run(argv) {
  const ctx = buildContext(argv);
  const { logger } = ctx;
  const targets = resolveTargets(argv, ctx);

  if (!targets.length) {
    logger.error('未指定要轮换的密钥 (使用 paths / --manifest / --tag)');
    throw toAppError(new Error('no rotation targets'), ERROR_CODES.VALIDATION);
  }

  const label = argv.dryRun ? '预览轮换 (dry-run)' : '执行密钥轮换';
  const spinner = makeSpinner({ ...argv, text: `${label}: ${targets.length} 个目标` });
  spinner.start();

  await ctx.vault.login();

  const limit = pLimit(10);
  let completed = 0;
  const results = await Promise.all(targets.map((t) => limit(async () => {
    const r = await rotateOne(t, ctx, { dryRun: argv.dryRun });
    completed += 1;
    spinner.text = `${label}: ${completed}/${targets.length}`;
    return r;
  })));

  spinner.succeed(`${label} 完成: 成功 ${results.filter((r) => r.ok).length} / 失败 ${results.filter((r) => !r.ok).length}`);

  const summary = {
    profile: ctx.profile.name,
    dryRun: !!argv.dryRun,
    total: targets.length,
    success: results.filter((r) => r.ok && !r.rolledBack).length,
    failed: results.filter((r) => !r.ok).length,
    rolledBack: results.filter((r) => r.rolledBack).length,
    results
  };

  if (argv.json || argv.format === 'json') {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    return summary;
  }

  const headers = ['密钥路径', '字段', '状态', '哈希变化', '说明'];
  const rows = results.map((r) => [
    r.path,
    r.field,
    r.dryRun ? '预览' : (r.ok ? statusBadge(true) : statusBadge(false)),
    r.preview || '-',
    r.rolledBack ? '已回滚' : (r.error ? r.error : '成功')
  ]);
  logger.raw(renderTable(headers, rows));

  if (argv.notify && !argv.dryRun) {
    const { title, markdown } = ctx.notifier.formatRotateAlert(results, ctx.profile.name);
    const res = await ctx.notifier.notifyAll(title, markdown);
    logger.info(`轮换报告推送: ${JSON.stringify(res)}`);
  }

  return summary;
}

module.exports = {
  command: 'rotate [paths...]',
  describe: '密钥轮换编排：生成随机密码、更新 Vault 并同步 K8s，记录 SHA256 哈希',
  builder: (yargs) => yargs
    .positional('paths', { type: 'string', describe: 'Vault 中的密钥逻辑路径 (可多个)' })
    .option('manifest', { type: 'string', describe: '轮换清单 JSON 文件' })
    .option('field', { type: 'string', default: 'password', describe: '要轮换的字段名' })
    .option('length', { type: 'number', default: 24, describe: '新密码长度' })
    .option('tag', { type: 'string', describe: '按标签筛选密钥' })
    .option('k8s-name', { type: 'string', describe: '关联的 K8s Secret 名称' })
    .option('k8s-namespace', { type: 'string', describe: 'K8s Secret 命名空间' })
    .option('k8s-key', { type: 'string', describe: 'K8s Secret 中的字段名' })
    .option('dry-run', { type: 'boolean', default: false, describe: '预览模式，不实际修改' })
    .option('notify', { type: 'boolean', default: false, describe: '推送轮换报告' })
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
