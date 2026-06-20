'use strict';

const inquirer = require('inquirer');
const chalk = require('chalk');
const { buildContext } = require('../lib/runtime');
const crypto = require('../lib/crypto');
const scanner = require('../lib/scanner');

const undoStack = [];

function pushUndo(undo) {
  undoStack.push(undo);
}

async function performUndo(ctx) {
  const op = undoStack.pop();
  if (!op) {
    console.log(chalk.yellow('没有可撤销的操作'));
    return false;
  }
  try {
    await op.restore();
    ctx.store.recordAudit({
      action: 'undo',
      secretName: op.path,
      secretPath: op.path,
      source: op.source || 'vault',
      status: 'success',
      profile: ctx.profile.name,
      message: op.message
    });
    console.log(chalk.green(`已撤销: ${op.message}`));
    return true;
  } catch (err) {
    console.log(chalk.red(`撤销失败: ${err.message}`));
    return false;
  }
}

async function loadSecrets(ctx, argv) {
  const sources = [];
  if (argv.dir) {
    const res = await scanner.scanDirectory(argv.dir);
    for (const f of res.findings) {
      if (f.source === 'file') sources.push({ name: f.name, type: f.type, source: 'file', location: f.location, path: f.name });
    }
  }
  let vaultSecrets = [];
  try {
    await ctx.vault.login();
    vaultSecrets = await ctx.vault.listAll('');
    for (const p of vaultSecrets) {
      sources.push({ name: p, type: 'vault', source: 'vault', location: `vault://${ctx.profile.vault.mount}/${p}`, path: p });
    }
  } catch (err) {
    console.log(chalk.yellow(`Vault 不可用: ${err.message}`));
  }
  const seen = new Set();
  const deduped = [];
  for (const s of sources) {
    const key = `${s.source}:${s.path}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(s); }
  }
  return deduped;
}

function previewMetadata(secret, storeRecord) {
  const lines = [];
  lines.push(chalk.cyan(`\n=== ${secret.name} ===`));
  lines.push(`来源: ${secret.source}`);
  lines.push(`位置: ${secret.location}`);
  lines.push(`类型: ${secret.type}`);
  if (storeRecord) {
    lines.push(`上次轮换: ${storeRecord.lastRotatedAt || chalk.yellow('从未')}`);
    lines.push(`当前哈希: ${chalk.gray((storeRecord.lastHash || '').slice(0, 16))}...`);
    if (storeRecord.prevHash) lines.push(`前次哈希: ${chalk.gray(storeRecord.prevHash.slice(0, 16))}...`);
  } else {
    lines.push(chalk.gray('(本地状态中无该密钥的轮换记录)'));
  }
  lines.push(chalk.gray('提示: 出于安全考虑，此处不展示密钥实际值\n'));
  return lines.join('\n');
}

async function rotateInteractive(ctx, secret) {
  const { field } = await inquirer.prompt([{
    type: 'input',
    name: 'field',
    message: '要轮换的字段名:',
    default: 'password'
  }]);
  const { length } = await inquirer.prompt([{
    type: 'number',
    name: 'length',
    message: '新密码长度:',
    default: 24
  }]);
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: chalk.yellow(`确认轮换 ${secret.path} 的 ${field} 字段?`),
    default: false
  }]);
  if (!confirm) { console.log(chalk.gray('已取消')); return; }

  let beforeData;
  try {
    const s = await ctx.vault.readSecret(secret.path);
    beforeData = s.data || {};
  } catch (err) {
    console.log(chalk.red(`读取失败: ${err.message}`));
    return;
  }
  const oldValue = beforeData[field];
  const beforeHash = crypto.sha256(oldValue);
  const newValue = crypto.generatePassword({ length });
  const afterHash = crypto.sha256(newValue);
  const newData = Object.assign({}, beforeData, { [field]: newValue });
  const priorRecord = ctx.store.getSecrets(ctx.profile.name).find((r) => r.path === secret.path);

  try {
    await ctx.vault.writeSecret(secret.path, newData);
    ctx.store.recordAudit({ action: 'rotate', secretName: secret.path, secretPath: secret.path, source: 'vault', status: 'success', profile: ctx.profile.name, beforeHash, afterHash, message: `交互式轮换字段 ${field}` });
    ctx.store.upsertSecret(ctx.profile.name, { path: secret.path, name: secret.path, source: 'vault', lastHash: afterHash, prevHash: beforeHash, lastRotatedAt: new Date().toISOString() });
    pushUndo({
      path: secret.path,
      source: 'vault',
      message: `轮换 ${secret.path}.${field}`,
      restore: async () => {
        await ctx.vault.writeSecret(secret.path, beforeData);
        ctx.store.upsertSecret(ctx.profile.name, {
          path: secret.path,
          name: secret.path,
          source: 'vault',
          lastHash: beforeHash,
          prevHash: priorRecord ? priorRecord.prevHash : '',
          lastRotatedAt: priorRecord ? priorRecord.lastRotatedAt : null
        });
        ctx.store.recordAudit({ action: 'undo', secretName: secret.path, secretPath: secret.path, source: 'vault', status: 'success', profile: ctx.profile.name, message: `撤销轮换 ${secret.path}.${field}` });
      }
    });
    console.log(chalk.green(`轮换成功: ${secret.path}.${field}`));
    console.log(chalk.gray(`哈希变化: ${beforeHash.slice(0, 12)} -> ${afterHash.slice(0, 12)}`));
  } catch (err) {
    console.log(chalk.red(`轮换失败: ${err.message}`));
    ctx.store.recordAudit({ action: 'rotate', secretName: secret.path, secretPath: secret.path, source: 'vault', status: 'failed', profile: ctx.profile.name, message: err.message });
  }
}

async function deleteInteractive(ctx, secret) {
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: chalk.red(`确认删除 Vault 密钥 ${secret.path}? 此操作可撤销(仅本会话)`),
    default: false
  }]);
  if (!confirm) { console.log(chalk.gray('已取消')); return; }
  let beforeData;
  try {
    const s = await ctx.vault.readSecret(secret.path);
    beforeData = s.data || {};
  } catch { beforeData = {}; }
  try {
    await ctx.vault.deleteSecret(secret.path);
    ctx.store.recordAudit({ action: 'delete', secretName: secret.path, secretPath: secret.path, source: 'vault', status: 'success', profile: ctx.profile.name, message: '交互式删除' });
    pushUndo({
      path: secret.path,
      source: 'vault',
      message: `删除 ${secret.path}`,
      restore: async () => { await ctx.vault.writeSecret(secret.path, beforeData); }
    });
    console.log(chalk.green(`已删除: ${secret.path}`));
  } catch (err) {
    console.log(chalk.red(`删除失败: ${err.message}`));
  }
}

async function run(argv) {
  const ctx = buildContext(argv);
  console.log(chalk.cyan(`\n🔐 密钥管理交互式控制台 [环境: ${ctx.profile.name}]\n`));
  const secrets = await loadSecrets(ctx, argv);
  if (!secrets.length) {
    console.log(chalk.yellow('未发现任何密钥。可使用 --dir 扫描本地配置，或检查 Vault 连接。'));
    return;
  }
  console.log(chalk.gray(`已加载 ${secrets.length} 个密钥\n`));

  let running = true;
  while (running) {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '请选择操作:',
      choices: [
        { name: '🔍 搜索/选择密钥', value: 'search' },
        { name: `↩  撤销上次操作 ${undoStack.length ? chalk.yellow(`(${undoStack.length} 个可撤销)`) : ''}`, value: 'undo' },
        { name: '📋 列出全部密钥', value: 'list' },
        { name: '🚪 退出', value: 'exit' }
      ]
    }]);
    if (action === 'exit') { running = false; continue; }
    if (action === 'undo') { await performUndo(ctx); continue; }

    let candidates = secrets;
    if (action === 'search') {
      const { keyword } = await inquirer.prompt([{
        type: 'input',
        name: 'keyword',
        message: '输入搜索关键字 (回车显示全部):'
      }]);
      const kw = (keyword || '').toLowerCase();
      candidates = kw ? secrets.filter((s) => s.name.toLowerCase().includes(kw) || s.path.toLowerCase().includes(kw)) : secrets;
    }

    if (!candidates.length) { console.log(chalk.yellow('没有匹配的密钥')); continue; }

    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message: '选择密钥:',
      pageSize: 15,
      choices: candidates.slice(0, 100).map((s) => ({ name: `[${s.source}] ${s.name}`, value: s })).concat([{ name: chalk.gray('↩ 返回'), value: null }])
    }]);
    if (!selected) continue;

    const record = ctx.store.getSecrets(ctx.profile.name).find((r) => r.path === selected.path);
    console.log(previewMetadata(selected, record));

    const { op } = await inquirer.prompt([{
      type: 'list',
      name: 'op',
      message: '对该密钥执行:',
      choices: [
        { name: '🔄 轮换 (生成新密码)', value: 'rotate' },
        { name: '🗑  删除 (可撤销)', value: 'delete' },
        { name: '↩  返回', value: 'back' }
      ]
    }]);
    if (op === 'rotate' && selected.source === 'vault') await rotateInteractive(ctx, selected);
    else if (op === 'delete' && selected.source === 'vault') await deleteInteractive(ctx, selected);
    else if (op !== 'back') console.log(chalk.yellow('该来源的密钥不支持此操作 (仅 Vault 密钥可轮换/删除)'));
  }
  console.log(chalk.cyan('\n再见 👋'));
}

module.exports = {
  command: 'interactive',
  describe: '交互式密钥管理：模糊搜索、元数据预览、确认后操作、支持撤销',
  aliases: ['ui'],
  builder: (yargs) => yargs
    .option('dir', { type: 'string', describe: '同时扫描本地配置目录' }),
  handler: async (argv) => {
    try {
      return await run(argv);
    } catch (err) {
      if (err && err.name === 'ExitPromptError') return;
      const logger = require('../lib/logger').createLogger({ quiet: argv.quiet, json: argv.json });
      logger.error(`${err.message}${err.hint ? '\n排查建议: ' + err.hint : ''}`);
      process.exit(1);
    }
  }
};
