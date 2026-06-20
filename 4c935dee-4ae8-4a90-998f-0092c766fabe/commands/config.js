'use strict';

const config = require('../config');
const { createLogger } = require('../lib/logger');
const { renderTable } = require('../lib/ui');

async function run(argv) {
  const logger = createLogger({ quiet: argv.quiet, json: argv.json });
  const action = argv.action || 'list';

  if (action === 'list') {
    const profiles = config.listProfiles();
    if (argv.json) {
      process.stdout.write(JSON.stringify({ profiles }, null, 2) + '\n');
      return profiles;
    }
    logger.info(`可用 profiles (${profiles.length}):`);
    const headers = ['名称', '描述', '活跃'];
    const rows = profiles.map((p) => [p.name, p.description, p.active ? '*' : '']);
    logger.raw(renderTable(headers, rows));
    return profiles;
  }

  if (action === 'use') {
    const name = argv.name;
    if (!name) { logger.error('缺少 profile 名称: config use <name>'); process.exit(1); }
    config.setActiveProfile(name);
    logger.success(`已切换到 profile: ${name}`);
    return { activeProfile: name };
  }

  if (action === 'show') {
    const name = argv.profile || argv.name;
    const prof = config.getProfile(name);
    if (!prof) { logger.error(`profile 不存在: ${name}`); process.exit(1); }
    const merged = config.resolve({ profile: name });
    if (argv.json) process.stdout.write(JSON.stringify(merged, null, 2) + '\n');
    else logger.raw(JSON.stringify(merged, null, 2));
    return merged;
  }

  if (action === 'set') {
    const key = argv.name;
    const value = argv.value;
    if (!key) { logger.error('用法: config set <key> <value>'); process.exit(1); }
    const profileName = argv.profile || config.ensureConfigFile().activeProfile;
    const prof = config.getProfile(profileName) || {};
    const parts = String(key).split('.');
    let obj = prof;
    for (let i = 0; i < parts.length - 1; i++) {
      obj[parts[i]] = obj[parts[i]] || {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value === undefined ? undefined : (value === 'true' ? true : value === 'false' ? false : value);
    config.setProfile(profileName, prof);
    logger.success(`已设置 ${profileName}.${key} = ${value}`);
    return { profile: profileName, key, value };
  }

  logger.error(`未知 config 操作: ${action}`);
  process.exit(1);
}

module.exports = {
  command: 'config [action] [name] [value]',
  describe: '配置与多 profile 管理 (list/use/show/set)',
  builder: (yargs) => yargs
    .positional('action', { type: 'string', default: 'list', describe: '操作: list | use <profile> | show [profile] | set <key> <value>' })
    .positional('name', { type: 'string', describe: 'profile 名称 (use/show) 或配置键 (set)' })
    .positional('value', { type: 'string', describe: '配置值 (set)' })
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
