'use strict';

const path = require('path');
const scanner = require('../lib/scanner');
const { buildContext } = require('../lib/runtime');
const { renderTable, makeSpinner } = require('../lib/ui');
const { getHttpStatus } = require('../lib/util');

async function run(argv) {
  const ctx = buildContext(argv);
  const { logger } = ctx;
  const rawDirs = Array.isArray(argv.dir) ? argv.dir : (argv.dir ? [argv.dir] : []);
  const dirs = rawDirs.filter(Boolean).length ? rawDirs.filter(Boolean) : ['.'];
  const useVault = argv.vault !== false;
  const useK8s = argv.k8s !== false;
  const format = argv.format || (argv.json ? 'json' : 'table');

  const findings = [];
  let fileCount = 0;
  const fileFindings = [];

  for (const dir of dirs) {
    const abs = path.resolve(dir);
    const spinner = makeSpinner({ ...argv, text: `扫描目录 ${abs}` });
    spinner.start();
    try {
      const res = await scanner.scanDirectory(abs);
      fileCount += res.files;
      fileFindings.push(...res.findings);
      spinner.succeed(`扫描目录 ${abs}: ${res.files} 个文件, ${res.findings.length} 个疑似密钥`);
    } catch (err) {
      spinner.fail(`扫描目录 ${abs} 失败: ${err.message}`);
    }
  }

  findings.push(...fileFindings);

  if (useVault) {
    const spinner = makeSpinner({ ...argv, text: '连接 Vault 列出已存储密钥' });
    spinner.start();
    try {
      await ctx.vault.login();
      const paths = await ctx.vault.listAll('');
      for (const p of paths) {
        findings.push({
          name: p,
          type: 'vault-secret',
          source: 'vault',
          location: `vault://${ctx.profile.vault.mount}/${p}`,
          preview: '',
          file: '',
          line: 0
        });
      }
      spinner.succeed(`Vault: 列出 ${paths.length} 个密钥路径`);
    } catch (err) {
      spinner.warn(`Vault 不可用: ${err.message} (status=${getHttpStatus(err)})`);
    }
  }

  if (useK8s) {
    const spinner = makeSpinner({ ...argv, text: '连接 Kubernetes 列出 Secret' });
    spinner.start();
    try {
      const secrets = await ctx.k8s.listSecrets();
      for (const s of secrets) {
        for (const key of s.keys) {
          findings.push({
            name: `${s.name}/${key}`,
            type: 'k8s-secret',
            source: 'k8s',
            location: `k8s://${s.namespace}/${s.name}`,
            preview: '',
            file: '',
            line: 0
          });
        }
      }
      spinner.succeed(`Kubernetes: 列出 ${secrets.length} 个 Secret`);
    } catch (err) {
      spinner.warn(`Kubernetes 不可用: ${err.message} (status=${getHttpStatus(err)})`);
    }
  }

  const grouped = scanner.dedupe(findings);
  const inventory = [];
  for (const [key, items] of grouped) {
    const first = items[0];
    inventory.push({
      name: first.name,
      type: first.type,
      sources: items.map((i) => i.source),
      locations: items.map((i) => i.location),
      preview: first.preview,
      count: items.length
    });
  }
  inventory.sort((a, b) => a.name.localeCompare(b.name));

  const result = {
    profile: ctx.profile.name,
    scannedFiles: fileCount,
    totalFindings: findings.length,
    uniqueSecrets: inventory.length,
    secrets: inventory
  };

  if (argv.json || format === 'json') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return result;
  }

  logger.info(`去重后共 ${inventory.length} 个独立密钥 (扫描 ${fileCount} 个文件)`);
  if (inventory.length === 0) {
    logger.warn('未发现任何密钥资产');
    return result;
  }

  const headers = ['名称', '类型', '来源', '位置', '预览'];
  const rows = inventory.map((s) => [
    s.name,
    s.type,
    s.sources.join(','),
    s.locations[0] + (s.locations.length > 1 ? ` (+${s.locations.length - 1})` : ''),
    s.preview
  ]);
  logger.raw(renderTable(headers, rows));
  return result;
}

module.exports = {
  command: 'scan [dir...]',
  describe: '扫描配置文件 / Vault / Kubernetes 中的密钥资产',
  builder: (yargs) => yargs
    .positional('dir', { type: 'string', describe: '要扫描的目录 (可多个)' })
    .option('format', { type: 'string', choices: ['table', 'json'], describe: '输出格式' })
    .option('vault', { type: 'boolean', default: true, describe: '是否扫描 Vault' })
    .option('k8s', { type: 'boolean', default: true, describe: '是否扫描 Kubernetes Secret' }),
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
