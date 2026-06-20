#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { setLogger } from '../src/utils/logger.js';
import configManager, { ConfigManager } from '../src/core/config.js';
import importCmd from '../src/commands/import.js';
import matchCmd from '../src/commands/match.js';
import diffCmd from '../src/commands/diff.js';
import reportCmd from '../src/commands/report.js';
import auditCmd from '../src/commands/audit.js';
import configCmd from '../src/commands/config.js';
import historyCmd from '../src/commands/history.js';

const program = new Command();

program
  .name('reconcile')
  .description('第三方支付多通道对账 CLI - 微信/支付宝/银联流水导入、匹配、差异分析、报告与审计')
  .version('1.0.0')
  .usage('[options] <command> [args]')
  .option('-v, --verbose', '详细输出模式')
  .option('-s, --silent', '静默模式（仅输出错误）')
  .option('--no-color', '禁用彩色输出')
  .option('-c, --config <path>', '指定配置文件路径')
  .option('--data-dir <dir>', '指定数据存储目录')
  .hook('preAction', (thisCommand, actionCommand) => {
    const opts = { ...thisCommand.opts(), ...actionCommand.opts() };
    setLogger({
      verbose: opts.verbose,
      silent: opts.silent,
      color: opts.color !== false,
    });
    if (opts.config) {
      process.env.RECONCILE_CONFIG = opts.config;
      configManager.configPath = opts.config;
      configManager.load();
    }
  });

function withCommon(cmd) {
  return cmd
    .option('-v, --verbose', '详细模式')
    .option('-s, --silent', '静默模式')
    .option('--dry-run', '预检模式，不落盘')
    .option('--no-color', '禁用彩色输出')
    .option('--data-dir <dir>', '数据存储目录');
}

function mergeOpts(thisCmd) {
  return { ...program.opts(), ...thisCmd.opts() };
}

function handleError(e, code = 1) {
  if (e && e.field) {
    console.error(chalk.red.bold(`参数校验失败: ${e.message}`));
  } else {
    console.error(chalk.red.bold(`错误: ${e.message || e}`));
    if (e.stack && process.env.RECONCILE_DEBUG) console.error(e.stack);
  }
  process.exit(code);
}

withCommon(
  program
    .command('import <source>')
    .alias('i')
    .alias('im')
    .description('导入支付通道流水文件或目录，自动识别 CSV/JSON/XML 格式')
    .option('-ch, --channel <channel>', '支付通道: wechat|alipay|unionpay')
    .option('-f, --format <format>', '强制文件格式: csv|json|ndjson|xml|auto', 'auto')
    .option('--force', '强制重新导入（忽略增量记录）')
    .option('--no-incremental', '禁用增量导入（不检查断点）')
    .option('--integrity', '展示文件完整性校验报告')
    .option('--no-integrity-check', '禁用文件完整性校验')
    .option('--memory-limit <mb>', '内存限制(MB)，默认 500', '500')
    .option('--concurrency <n>', '文件并发解析数，默认 4', '4')
    .addHelpText('after', '\n示例:\n  $ reconcile import ./data/wechat_202401.csv --channel wechat\n  $ reconcile import ./data/transactions --dry-run -v --integrity')
)
.action(async function () {
  try {
    await importCmd.run({ source: this.args[0], ...mergeOpts(this) });
  } catch (e) {
    handleError(e);
  }
});

withCommon(
  program
    .command('match')
    .alias('m')
    .description('执行订单与通道流水匹配，支持跨日跨月、模糊匹配')
    .option('-o, --orders <path>', '订单数据路径（文件/目录/存储名）')
    .option('-t, --transactions <path>', '通道流水数据路径')
    .option('-m, --merchant <id>', '按商户ID筛选')
    .option('-ch, --channel <channel>', '按支付通道筛选')
    .option('-w, --time-window <days>', '跨日时间窗口 T+0~T+3', '1')
    .option('--fuzzy', '启用模糊匹配', true)
    .option('--no-fuzzy', '禁用模糊匹配')
    .option('--fuzzy-threshold <n>', '模糊匹配阈值', '0.85')
    .option('--amount-threshold <cents>', '金额差异阈值(分)', '1')
    .option('-r, --result <name>', '使用已有导入结果')
    .option('--output <name>', '匹配结果保存名')
    .option('--memory-limit <mb>', '内存限制(MB)，默认 500', '500')
    .option('--concurrency <n>', '商户并发对账数，默认 8', '8')
    .addHelpText('after', '\n示例:\n  $ reconcile match --orders ./data/orders.json -t ./data/transactions -v\n  $ reconcile match -m M001 -w 2 --dry-run')
)
.action(async function () {
  try {
    await matchCmd.run({ ...mergeOpts(this), timeWindowDays: Number(this.opts().timeWindow) });
  } catch (e) {
    handleError(e);
  }
});

withCommon(
  program
    .command('diff')
    .alias('d')
    .description('差异分析：计算金额/时间/状态差异，分类统计，阈值过滤')
    .option('-r, --result <name>', '基于已有匹配结果分析')
    .option('-o, --orders <path>', '订单数据路径（无 --result 时重新匹配）')
    .option('--transactions <path>', '通道流水数据路径')
    .option('-m, --merchant <id>', '按商户筛选')
    .option('-ch, --channel <channel>', '按通道筛选')
    .option('--type <types>', '差异类型过滤(逗号分隔)')
    .option('--min-amount-diff <cents>', '最小金额差异(分)')
    .option('--amount-threshold <cents>', '金额差异阈值(分)')
    .option('--time-threshold-ms <ms>', '时间差异阈值(毫秒)')
    .option('--by-merchant', '按商户分组输出')
    .option('-l, --limit <n>', '明细展示条数', '50')
    .option('--output <name>', '结果保存名')
    .addHelpText('after', '\n示例:\n  $ reconcile diff --result match-1234 --type amount,time -v\n  $ reconcile diff --by-merchant --min-amount-diff 100')
)
.action(async function () {
  try {
    await diffCmd.run({ ...mergeOpts(this), limit: Number(this.opts().limit) });
  } catch (e) {
    handleError(e);
  }
});

withCommon(
  program
    .command('report')
    .alias('r')
    .description('生成对账报告（Excel/PDF），含汇总、差异明细、追溯建议')
    .option('-r, --result <name>', '基于已有匹配结果生成')
    .option('-o, --orders <path>', '订单数据路径（无 --result 时重新匹配）')
    .option('--transactions <path>', '通道流水数据路径')
    .option('-f, --format <format>', '报告格式: xlsx|pdf|both', 'both')
    .option('-t, --template <id>', '报告模板ID')
    .option('-n, --name <name>', '报告文件名')
    .option('-m, --merchant <id>', '按商户生成报告')
    .option('--by-merchant', '按商户分组输出多sheet')
    .option('--output-dir <dir>', '报告输出目录')
    .addHelpText('after', '\n示例:\n  $ reconcile report --result match-1234 -f xlsx\n  $ reconcile report --by-merchant -f both -v')
)
.action(async function () {
  try {
    await reportCmd.run(mergeOpts(this));
  } catch (e) {
    handleError(e);
  }
});

withCommon(
  program
    .command('audit <target>')
    .alias('a')
    .description('审计单笔差异交易，追溯完整生命周期与关联链路')
    .option('-r, --result <name>', '基于已有匹配结果审计')
    .option('-o, --orders <path>', '订单数据路径（无 --result 时重新匹配）')
    .option('--transactions <path>', '通道流水数据路径')
    .option('-m, --merchant <id>', '商户ID（校验）')
    .addHelpText('after', '\n示例:\n  $ reconcile audit 202401150001 --result match-1234 -v\n  $ reconcile audit TXN20240115001 --dry-run')
)
.action(async function () {
  try {
    await auditCmd.run({ target: this.args[0], ...mergeOpts(this) });
  } catch (e) {
    handleError(e);
  }
});

withCommon(
  program
    .command('config [action]')
    .alias('c')
    .description('配置管理: list|add-merchant|remove-merchant|set-rules|add-template|export|import|wizard')
    .option('--id <id>', '商户/模板ID')
    .option('--name <name>', '名称')
    .option('-ch, --channel <channel>', '支付通道')
    .option('--enabled <bool>', '是否启用')
    .option('--time-window <days>', '时间窗口')
    .option('--fuzzy <bool>', '模糊匹配')
    .option('--fuzzy-threshold <n>', '模糊阈值')
    .option('--amount-threshold <cents>', '金额阈值')
    .option('--sections <list>', '模板模块(逗号分隔)')
    .option('--output <path>', '导出路径')
    .option('--input <path>', '导入路径')
    .addHelpText('after', '\n示例:\n  $ reconcile config list\n  $ reconcile config add-merchant --id M001 --name 商户A --channel wechat\n  $ reconcile config wizard')
)
.action(async function () {
  try {
    await configCmd.run(this.args[0] || 'list', { ...mergeOpts(this), channel: this.opts().channel });
  } catch (e) {
    handleError(e);
  }
});

withCommon(
  program
    .command('history [action]')
    .alias('h')
    .description('查询历史对账记录，按时间/商户/通道筛选并导出')
    .option('-m, --merchant <id>', '按商户筛选')
    .option('-ch, --channel <channel>', '按通道筛选')
    .option('--type <type>', '按记录类型筛选: import|match|report|audit')
    .option('--start-date <date>', '开始日期')
    .option('--end-date <date>', '结束日期')
    .option('-l, --limit <n>', '展示条数', '50')
    .option('-f, --format <format>', '导出格式: json|xlsx')
    .option('--output-dir <dir>', '导出目录')
    .addHelpText('after', '\n示例:\n  $ reconcile history --start-date 2024-01-01 --end-date 2024-01-31 -v\n  $ reconcile history export -f xlsx')
)
.action(async function () {
  try {
    await historyCmd.run(this.args[0], { ...mergeOpts(this), limit: Number(this.opts().limit) });
  } catch (e) {
    handleError(e);
  }
});

program
  .command('completion [shell]')
  .description('生成命令自动补全脚本 (bash|zsh)')
  .action((shell) => {
    const target = shell || (process.env.SHELL && process.env.SHELL.includes('zsh') ? 'zsh' : 'bash');
    const cmds = ['import', 'match', 'diff', 'report', 'audit', 'config', 'history', 'completion'];
    const list = cmds.join(' ');
    if (target === 'zsh') {
      const script = [
        '# zsh completion for reconcile',
        '_reconcile() {',
        `  local commands=(${list})`,
        '  compadd -- "${commands[@]}"',
        '}',
        'compdef _reconcile reconcile',
        '',
      ].join('\n');
      console.log(script);
    } else {
      const script = [
        '# bash completion for reconcile',
        '_reconcile() {',
        '  local cur="${COMP_WORDS[COMP_CWORD]}"',
        `  local cmds="${list}"`,
        '  COMPREPLY=( $(compgen -W "$cmds" -- "$cur") )',
        '}',
        'complete -F _reconcile reconcile',
        '',
      ].join('\n');
      console.log(script);
    }
  });

program.addHelpText('after', `
${chalk.bold('快速开始:')}
  $ reconcile config wizard            # 交互式配置向导
  $ reconcile import ./data/transactions --dry-run -v   # 预检导入
  $ reconcile match -v                 # 执行匹配
  $ reconcile diff --by-merchant       # 差异分析
  $ reconcile report -f both           # 生成报告
  $ reconcile history                  # 查询历史

${chalk.gray('提示:')} 全局选项 -v (详细) -s (静默) --dry-run (预检) 可置于任意命令
`);

program.parseAsync(process.argv).catch((e) => handleError(e));
