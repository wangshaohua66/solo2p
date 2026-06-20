#!/usr/bin/env node
'use strict';

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const pkg = require('./package.json');

const commands = [
  require('./commands/scan'),
  require('./commands/cert'),
  require('./commands/rotate'),
  require('./commands/sync'),
  require('./commands/audit'),
  require('./commands/diff'),
  require('./commands/interactive'),
  require('./commands/config')
];

function buildParser() {
  const parser = yargs(hideBin(process.argv))
    .scriptName('sc-cli')
    .usage('用法: $0 <命令> [选项]\n\n密钥与证书生命周期管理 CLI (Vault + Kubernetes)')
    .version(pkg.version)
    .demandCommand(1, '请指定一个命令，使用 --help 查看可用命令')
    .strict(false)
    .fail((msg, err, y) => {
      if (err) {
        const logger = require('./lib/logger').createLogger({});
        logger.error(err.message || String(err));
        if (err.hint) logger.raw('排查建议: ' + err.hint);
        process.exit(1);
      }
      y.showHelp('stderr');
      process.stderr.write(`\n错误: ${msg}\n`);
      process.exit(1);
    });

  for (const cmd of commands) parser.command(cmd);

  parser
    .option('profile', { type: 'string', alias: 'p', describe: '目标环境 profile (dev/test/staging/prod)' })
    .option('json', { type: 'boolean', default: false, describe: '输出机器可读 JSON (适合 CI/CD)' })
    .option('quiet', { type: 'boolean', alias: 'q', default: false, describe: '静默模式，仅输出错误' })
    .option('format', { type: 'string', describe: '输出格式 (table|json|html)' })
    .global(['profile', 'json', 'quiet', 'format'])
    .middleware((argv) => {
      if (argv.quiet) process.env.SC_QUIET_RETRY = '1';
      if (process.env.SC_DEBUG) {} 
      if (argv.json) argv.format = argv.format || 'json';
    }, true)
    .example('$0 scan ./configs --vault --k8s', '扫描本地配置及 Vault/K8s 密钥')
    .example('$0 cert ./certs --critical --notify', '检查证书并推送紧急过期告警')
    .example('$0 rotate mysql/app --field password --dry-run', '预览密钥轮换')
    .example('$0 sync --mode export --out secrets.enc --passphrase xxx', '导出密钥到加密文件')
    .example('$0 audit --mode report --format html --out report.html', '生成 HTML 合规审计报告')
    .example('$0 diff ./configs --suggest', '分析僵尸/缺失密钥')
    .help('help', '显示帮助')
    .alias('help', 'h')
    .completion('completion', '生成 shell 补全脚本')
    .wrap(process.stdout.columns ? Math.min(process.stdout.columns, 120) : 120);

  return parser;
}

async function main() {
  const parser = buildParser();
  await parser.parseAsync();
}

if (require.main === module) {
  main().catch((err) => {
    const logger = require('./lib/logger').createLogger({});
    logger.error(err && err.message ? err.message : String(err));
    if (err && err.hint) logger.raw('排查建议: ' + err.hint);
    process.exit(1);
  });
}

module.exports = { buildParser, commands, main };
