'use strict';

const path = require('path');
const scanner = require('../lib/scanner');
const { buildContext } = require('../lib/runtime');
const { renderTable, makeSpinner } = require('../lib/ui');

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[-_.]/g, '');
}

function refTokens(name) {
  const n = normalize(name);
  const tokens = new Set([n]);
  const parts = name.toLowerCase().split(/[-_.\/]+/).filter(Boolean);
  for (const p of parts) tokens.add(p);
  return tokens;
}

function vaultPathTokens(vaultPath) {
  const segments = vaultPath.toLowerCase().split('/').filter(Boolean);
  const tokens = new Set(segments);
  for (const seg of segments) tokens.add(normalize(seg));
  tokens.add(normalize(vaultPath));
  return tokens;
}

function matches(refName, vaultPath, strict) {
  if (strict) {
    const lastSeg = vaultPath.toLowerCase().split('/').pop();
    return normalize(refName) === normalize(lastSeg) || normalize(refName) === normalize(vaultPath);
  }
  const refT = refTokens(refName);
  const vT = vaultPathTokens(vaultPath);
  for (const t of refT) {
    if (vT.has(t)) return true;
    for (const v of vT) {
      if (v.length > 3 && (v.includes(t) || t.includes(v))) return true;
    }
  }
  return false;
}

async function run(argv) {
  const ctx = buildContext(argv);
  const { logger } = ctx;
  const dir = argv.dir || '.';
  const strict = !!argv.strict;
  const includeK8s = argv.k8s !== false;

  const spinner = makeSpinner({ ...argv, text: '密钥差异分析' });
  spinner.start();

  const scanRes = await scanner.scanDirectory(path.resolve(dir));
  const references = scanRes.findings.filter((f) => f.source === 'file' && f.type !== 'certificate' && f.type !== 'privatekey');
  const refNames = [...new Set(references.map((r) => r.name))];

  const stored = [];
  let vaultOk = false;
  try {
    await ctx.vault.login();
    const paths = await ctx.vault.listAll('');
    for (const p of paths) stored.push({ path: p, source: 'vault', location: `vault://${ctx.profile.vault.mount}/${p}` });
    vaultOk = true;
  } catch (err) {
    spinner.warn(`Vault 不可用，仅基于本地引用分析: ${err.message}`);
  }

  if (includeK8s) {
    try {
      const secrets = await ctx.k8s.listSecrets();
      for (const s of secrets) {
        stored.push({ path: `${s.name}`, source: 'k8s', location: `k8s://${s.namespace}/${s.name}`, keys: s.keys });
        for (const k of s.keys) stored.push({ path: `${s.name}/${k}`, source: 'k8s', location: `k8s://${s.namespace}/${s.name}/${k}` });
      }
    } catch (err) {
      spinner.warn(`K8s 不可用: ${err.message}`);
    }
  }

  const matched = new Set();
  const matchedRefs = new Set();
  for (const ref of refNames) {
    for (const s of stored) {
      if (matches(ref, s.path, strict)) {
        matched.add(s.path);
        matchedRefs.add(ref);
      }
    }
  }

  const zombieSecrets = stored.filter((s) => !matched.has(s.path)).map((s) => ({
    path: s.path, source: s.source, location: s.location,
    suggestion: '未被任何配置引用，可考虑清理 (删除前请确认)'
  }));

  const missingSecrets = refNames.filter((r) => !matchedRefs.has(r)).map((name) => {
    const locs = references.filter((r2) => r2.name === name).map((r2) => r2.location);
    return { name, locations: locs, suggestion: vaultOk ? '配置引用但 Vault 中缺失，请补充' : '配置引用，Vault 不可用，请核实' };
  });

  spinner.succeed(`差异分析完成: 引用 ${refNames.length} | 已存储 ${stored.length} | 匹配 ${matchedRefs.size}`);

  const result = {
    profile: ctx.profile.name,
    scannedFiles: scanRes.files,
    references: refNames.length,
    stored: stored.length,
    matched: matchedRefs.size,
    zombieSecrets,
    missingSecrets,
    cleanupSuggestions: zombieSecrets.map((z) => ({ action: 'delete', target: z.path, source: z.source, reason: 'zombie' }))
  };

  if (argv.json || argv.format === 'json') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return result;
  }

  logger.info(`僵尸密钥 (Vault/K8s 中存在但未被引用): ${zombieSecrets.length}`);
  if (zombieSecrets.length) {
    const headers = ['路径', '来源', '位置', '建议'];
    const rows = zombieSecrets.map((z) => [z.path, z.source, z.location, z.suggestion]);
    logger.raw(renderTable(headers, rows));
  }

  logger.info(`缺失密钥 (配置引用但未存储): ${missingSecrets.length}`);
  if (missingSecrets.length) {
    const headers = ['引用名', '引用位置', '建议'];
    const rows = missingSecrets.map((m) => [m.name, (m.locations[0] || '') + (m.locations.length > 1 ? ` (+${m.locations.length - 1})` : ''), m.suggestion]);
    logger.raw(renderTable(headers, rows));
  }

  if (argv.suggest) {
    logger.info('清理建议:');
    for (const c of result.cleanupSuggestions) {
      logger.raw(`  - [${c.action}] ${c.target} (${c.source}) — ${c.reason}`);
    }
  }

  return result;
}

module.exports = {
  command: 'diff [dir]',
  describe: '密钥差异分析：识别僵尸密钥与缺失密钥，生成清理建议',
  builder: (yargs) => yargs
    .positional('dir', { type: 'string', default: '.', describe: '微服务配置根目录' })
    .option('strict', { type: 'boolean', default: false, describe: '严格匹配 (仅末段路径精确相等)' })
    .option('k8s', { type: 'boolean', default: true, describe: '是否纳入 K8s Secret 比较' })
    .option('suggest', { type: 'boolean', default: false, describe: '输出清理建议' })
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
