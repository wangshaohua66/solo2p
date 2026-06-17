#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const {
  loadConfig,
  initConfig,
  saveConfig,
  listSchemes,
  setActiveScheme,
  getConfigPath
} = require('./lib/config');
const { ValidationError } = require('./lib/validator');

const registerCommand = require('./commands/register');
const progressCommand = require('./commands/progress');
const reportCommand = require('./commands/report');
const statsCommand = require('./commands/stats');

const program = new Command();

program
  .name('fscli')
  .description('区域食品安全检测中心样品管理与检测系统')
  .version('1.0.0', '-v, --version', '输出版本号')
  .hook('preAction', () => {
    process.on('uncaughtException', handleError);
    process.on('unhandledRejection', handleError);
  });

function handleError(err) {
  if (err instanceof ValidationError) {
    console.error(chalk.red.bold('\n✗ 参数校验错误:'));
    console.error(chalk.red(`  ${err.message}`));
    if (err.field) {
      console.error(chalk.gray(`  字段: ${err.field}`));
    }
    if (err.value !== undefined) {
      console.error(chalk.gray(`  值: ${JSON.stringify(err.value)}`));
    }
  } else {
    console.error(chalk.red.bold('\n✗ 系统错误:'));
    console.error(chalk.red(`  ${err.message}`));
    if (process.env.DEBUG) {
      console.error(chalk.gray(err.stack));
    }
  }
  process.exit(1);
}

program
  .command('config')
  .description('配置管理')
  .addCommand(
    new Command('init')
      .description('初始化配置文件')
      .option('-f, --force', '覆盖已存在的配置文件')
      .action((options) => {
        const result = initConfig(options.force);
        if (result.exists) {
          console.log(chalk.yellow(`配置文件已存在: ${result.path}`));
          console.log(chalk.yellow('使用 --force 覆盖现有配置'));
        } else {
          console.log(chalk.green(`✓ 配置文件已创建: ${result.path}`));
        }
      })
  )
  .addCommand(
    new Command('show')
      .description('查看当前配置')
      .action(() => {
        const config = loadConfig();
        const configPath = getConfigPath();
        console.log(chalk.cyan.bold('\n当前配置信息'));
        console.log(chalk.gray(`配置文件路径: ${configPath}`));
        console.log(chalk.cyan('\n实验室信息:'));
        console.log(`  名称: ${config.lab.name}`);
        console.log(`  编码: ${config.lab.code}`);
        if (config.lab.address) console.log(`  地址: ${config.lab.address}`);
        if (config.lab.contact) console.log(`  联系: ${config.lab.contact}`);
        console.log(chalk.cyan('\n检测类别与项目:'));
        for (const [key, cat] of Object.entries(config.categories)) {
          console.log(`  ${chalk.yellow(key)} (${cat.name}): ${cat.projects.join('、')}`);
        }
        console.log(chalk.cyan('\n阈值方案:'));
        const schemes = listSchemes(config);
        for (const s of schemes) {
          const marker = s.active ? chalk.green('[当前]') : '      ';
          console.log(`  ${marker} ${s.key} - ${s.name} (${s.projectCount}个项目)`);
        }
        console.log(chalk.cyan('\n状态流转:'));
        for (const [key, flow] of Object.entries(config.statusFlow)) {
          const nextNames = flow.next.map(n => config.statusFlow[n].name).join('→') || '(终点)';
          console.log(`  ${flow.name}: ${nextNames}`);
        }
      })
  )
  .addCommand(
    new Command('scheme')
      .description('切换判定阈值方案')
      .argument('[schemeKey]', '阈值方案键名 (留空列出所有方案)')
      .action((schemeKey) => {
        const config = loadConfig();
        if (!schemeKey) {
          const schemes = listSchemes(config);
          console.log(chalk.cyan.bold('\n可用阈值方案:'));
          for (const s of schemes) {
            const marker = s.active ? chalk.green('  ● ') : '    ';
            console.log(`${marker}${chalk.bold(s.key)} - ${s.name}`);
            if (s.description) {
              console.log(`      ${chalk.gray(s.description)}`);
            }
            console.log(`      项目数: ${s.projectCount}`);
          }
          return;
        }
        try {
          setActiveScheme(config, schemeKey);
          saveConfig(config);
          console.log(chalk.green(`✓ 已切换到方案: ${schemeKey}`));
        } catch (e) {
          console.error(chalk.red(e.message));
          process.exit(1);
        }
      })
  );

registerCommand.register(program);
progressCommand.register(program);
reportCommand.register(program);
statsCommand.register(program);

program.parse(process.argv);
