#!/usr/bin/env node

import process from 'process';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { createLogger, getLogger, setDebugMode, setQuietMode, isDebugMode, isQuietMode, audit } from './lib/logger.js';
import { setupGlobalErrorHandler, handleError, ErrorCodes, createError } from './lib/errors.js';
import {
  loadConfig, reloadConfig, getConfig, saveProjectConfig,
  addEnvironment, removeEnvironment, getEnvironment, listEnvironments,
  setBaseline, getBaseline, isInitialized, getDataDir, PROJECT_CONFIG_NAME
} from './lib/config-loader.js';
import { scanEnvironment, buildEnvironmentIndex, parseFile, findConfigFiles, writeConfigFile, detectFormat, stringifyConfig } from './lib/parser.js';
import { diffEnvironments, scanDrift, DiffType, Severity } from './lib/diff-engine.js';
import { scanEnvironment as scanSecrets, validateEnvironment } from './lib/validator.js';
import {
  createSnapshot, listSnapshots, queryHistory, getChangeHistoryForKey,
  getChangeHistoryForService, OperationType, recordChange, flush as flushHistory
} from './lib/history.js';
import {
  ReportFormat, generateDiffReportConsole, generateDriftReportConsole,
  generateSecretsReportConsole, generateValidationReportConsole,
  generateHistoryReportConsole, generateJsonReport, generateHtmlReport,
  saveReportToFile, exportToMarkdown, exportToCsv
} from './lib/reporter.js';
import {
  generateSyncPlan, executeSyncPlan, ConflictResolution, SyncMode
} from './lib/sync.js';
import { resolvePath, dirExists, fileExists, ensureDir, formatDuration, formatDate } from './lib/utils.js';

const program = new Command();

program
  .name('config-drift')
  .description('企业级配置漂移检测与管理工具 - ConfigDrift Checker')
  .version('1.0.0', '-v, --version', '输出版本号')
  .option('--debug', '启用调试模式，输出详细日志和堆栈信息')
  .option('--quiet', '静默模式，禁止控制台输出')
  .option('--json', '以JSON格式输出结果')
  .option('-c, --config <path>', `指定项目配置文件路径 (默认: ./${PROJECT_CONFIG_NAME})`)
  .hook('preAction', (thisCommand, actionCommand) => {
    const opts = program.opts();
    setDebugMode(!!opts.debug);
    setQuietMode(!!opts.quiet);
    createLogger({ debug: opts.debug, quiet: opts.quiet });
    loadConfig({ configPath: opts.config });
    const logger = getLogger();
    setupGlobalErrorHandler(logger, opts.debug);
    logger.debug(`执行命令: ${actionCommand.name()}`, { args: actionCommand.args });
  });

program
  .command('init')
  .description('初始化项目配置，引导配置环境信息')
  .option('-y, --yes', '使用默认配置，跳过交互式确认')
  .option('-d, --dir <path>', '配置文件根目录', process.cwd())
  .action(async (options) => {
    const logger = getLogger();
    const spinner = ora('正在初始化项目...').start();

    try {
      const interactive = !options.yes;
      const baseDir = resolvePath(options.dir);
      let config = getConfig();

      spinner.text = '扫描项目目录结构...';

      const detectedEnvs = [];
      const candidates = ['dev', 'development', 'test', 'testing', 'staging', 'pre', 'prod', 'production'];
      for (const name of candidates) {
        const envPath1 = path.join(baseDir, 'environments', name);
        const envPath2 = path.join(baseDir, 'env', name);
        const envPath3 = path.join(baseDir, 'config', name);
        const envPath4 = path.join(baseDir, 'deploy', name);
        for (const p of [envPath1, envPath2, envPath3, envPath4, path.join(baseDir, name)]) {
          if (dirExists(p)) {
            const hasConfigs = findConfigFiles(p, { maxDepth: 5 }).length > 0;
            if (hasConfigs) {
              detectedEnvs.push({ name, path: p });
              break;
            }
          }
        }
      }

      spinner.stop();
      console.log('');
      console.log(chalk.cyan.bold('='.repeat(70)));
      console.log(chalk.cyan.bold('🚀 ConfigDrift 初始化向导'));
      console.log(chalk.cyan.bold('='.repeat(70)));
      console.log('');

      let answers = {};
      if (interactive) {
        answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'projectName',
            message: '请输入项目名称:',
            default: path.basename(baseDir)
          },
          {
            type: 'input',
            name: 'projectDesc',
            message: '请输入项目描述 (可选):',
            default: ''
          },
          {
            type: 'input',
            name: 'baselineEnv',
            message: '请输入基准环境名称 (用于漂移对比):',
            default: 'staging',
            validate: (v) => v && v.length > 0 || '请输入环境名称'
          }
        ]);
      } else {
        answers = {
          projectName: path.basename(baseDir),
          projectDesc: '',
          baselineEnv: 'staging'
        };
      }

      config.projectName = answers.projectName;
      config.projectDescription = answers.projectDesc;
      config.createdAt = new Date().toISOString();

      console.log('');
      console.log(chalk.bold('📂 环境配置'));

      let envs = [];
      if (interactive) {
        console.log(chalk.gray(`  自动检测到 ${detectedEnvs.length} 个潜在环境目录`));
        const envAnswers = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'useDetected',
            message: '选择要添加的环境 (自动检测):',
            choices: detectedEnvs.map(e => ({
              name: `${e.name}  →  ${e.path}`,
              value: e,
              checked: true
            }))
          },
          {
            type: 'confirm',
            name: 'addMore',
            message: '是否需要手动添加更多环境?',
            default: detectedEnvs.length === 0
          }
        ]);
        envs = envAnswers.useDetected || [];

        while (envAnswers.addMore) {
          const more = await inquirer.prompt([
            {
              type: 'input',
              name: 'envName',
              message: '环境名称 (dev/test/staging/prod 等):',
              validate: (v) => v && v.length > 0 || '请输入环境名称'
            },
            {
              type: 'input',
              name: 'envPath',
              message: '配置文件根目录路径:',
              validate: (v) => {
                const p = resolvePath(v);
                return dirExists(p) || `目录不存在: ${p}`;
              }
            },
            {
              type: 'input',
              name: 'envDesc',
              message: '环境描述 (可选):',
              default: ''
            },
            {
              type: 'confirm',
              name: 'addAnother',
              message: '继续添加?',
              default: false
            }
          ]);
          envs.push({ name: more.envName, path: resolvePath(more.envPath), description: more.envDesc });
          if (!more.addAnother) break;
        }
      } else {
        envs = detectedEnvs.length > 0 ? detectedEnvs : [
          { name: 'dev', path: path.join(baseDir, 'dev'), description: '开发环境' },
          { name: 'test', path: path.join(baseDir, 'test'), description: '测试环境' },
          { name: 'staging', path: path.join(baseDir, 'staging'), description: '预发布环境' },
          { name: 'prod', path: path.join(baseDir, 'prod'), description: '生产环境' }
        ];
      }

      for (const env of envs) {
        config = addEnvironment(env.name, {
          name: env.description || env.name,
          path: env.path,
          description: env.description || ''
        });
      }

      if (answers.baselineEnv && config.environments?.[answers.baselineEnv]) {
        config = setBaseline(answers.baselineEnv);
      } else if (Object.keys(config.environments || {}).length > 0) {
        const firstKey = Object.keys(config.environments)[0];
        config = setBaseline(firstKey);
      }

      const savePath = path.join(baseDir, PROJECT_CONFIG_NAME);
      let doSave = true;
      if (interactive) {
        const confirm = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'save',
            message: `保存配置到 ${savePath}?`,
            default: true
          }
        ]);
        doSave = confirm.save;
      }

      if (doSave) {
        saveProjectConfig(config, savePath);
        audit('INIT', { path: savePath, environments: Object.keys(config.environments || {}) });
        console.log('');
        console.log(chalk.green.bold('✓ 初始化成功!'));
        console.log('');
        console.log(chalk.bold('📋 配置摘要:'));
        console.log(`  项目: ${chalk.cyan(config.projectName)}`);
        console.log(`  配置文件: ${chalk.underline(savePath)}`);
        console.log(`  环境数量: ${chalk.yellow(Object.keys(config.environments || {}).length)}`);

        const envTable = new Table({
          head: [chalk.white('环境名'), chalk.white('描述'), chalk.white('路径'), chalk.white('基准')],
          colWidths: [12, 20, 40, 8]
        });
        for (const [key, env] of Object.entries(config.environments || {})) {
          envTable.push([
            key,
            env.description || '-',
            env.path,
            config.baseline === key ? chalk.green(' ✓ ') : ''
          ]);
        }
        console.log(envTable.toString());

        console.log('');
        console.log(chalk.cyan('💡 下一步:'));
        console.log(`  ${chalk.gray('1.')} 运行 ${chalk.bold('config-drift validate')} 校验配置`);
        console.log(`  ${chalk.gray('2.')} 运行 ${chalk.bold('config-drift diff dev test')} 对比环境差异`);
        console.log(`  ${chalk.gray('3.')} 运行 ${chalk.bold('config-drift scan')} 检测生产配置漂移`);
        console.log(`  ${chalk.gray('4.')} 运行 ${chalk.bold('config-drift secrets')} 扫描敏感信息`);
        console.log('');

        if (program.opts().json) {
          console.log(JSON.stringify({
            success: true,
            configPath: savePath,
            projectName: config.projectName,
            environments: config.environments,
            baseline: config.baseline
          }, null, 2));
        }
      } else {
        console.log(chalk.yellow('已取消保存配置。'));
      }
    } catch (error) {
      spinner.fail('初始化失败');
      handleError(error, { logger, debug: program.opts().debug });
      if (!program.opts().quiet) {
        console.error(chalk.red(`\n错误: ${error.message}`));
        if (program.opts().debug && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      }
      process.exit(error.code || ErrorCodes.UNKNOWN_ERROR);
    }
  });

program
  .command('diff <source> <target>')
  .description('对比两个环境的配置差异')
  .option('-s, --service <name>', '仅对比指定微服务 (可多次指定)', (v, p) => [...p, v], [])
  .option('--key <pattern>', '仅对比匹配的配置键 (支持通配符)')
  .option('--show-all', '显示所有文件（包括无差异的）')
  .option('-o, --output <format>', '输出格式: console/json/html', 'console')
  .option('-f, --file <path>', '将报告保存到文件')
  .option('--full-details', '显示完整差异详情（默认显示前50项）')
  .action(async (sourceName, targetName, options) => {
    const logger = getLogger();
    const spinner = ora(`正在加载环境配置...`).start();

    try {
      if (!isInitialized()) {
        throw createError(
          '项目尚未初始化，请先运行 config-drift init',
          ErrorCodes.CONFIG_NOT_INITIALIZED
        );
      }

      const sourceEnvCfg = getEnvironment(sourceName);
      const targetEnvCfg = getEnvironment(targetName);
      if (!sourceEnvCfg) {
        throw createError(`源环境不存在: ${sourceName}`, ErrorCodes.ENVIRONMENT_NOT_FOUND);
      }
      if (!targetEnvCfg) {
        throw createError(`目标环境不存在: ${targetName}`, ErrorCodes.ENVIRONMENT_NOT_FOUND);
      }

      spinner.text = `扫描环境: ${sourceName} (${sourceEnvCfg.path})`;
      const sourceEnv = scanEnvironment(sourceName, sourceEnvCfg.path);

      spinner.text = `扫描环境: ${targetName} (${targetEnvCfg.path})`;
      const targetEnv = scanEnvironment(targetName, targetEnvCfg.path);

      spinner.text = `正在计算差异...`;
      const diffResult = diffEnvironments(sourceEnv, targetEnv, {
        sourceEnvName: sourceName,
        targetEnvName: targetName,
        groupByService: true
      });

      let diffData = diffResult;
      if (options.service && options.service.length > 0) {
        const filteredServices = {};
        for (const svc of options.service) {
          if (diffResult.byService?.[svc]) {
            filteredServices[svc] = diffResult.byService[svc];
          }
        }
        diffData = { ...diffResult, byService: filteredServices };
      }

      spinner.succeed(`差异检测完成: ${diffResult.summary.totalChanges} 处差异`);

      let output = '';
      if (options.output === 'json') {
        output = generateJsonReport(diffData, 'diff');
      } else if (options.output === 'html') {
        output = generateHtmlReport(diffData, 'diff',
          `配置差异报告 - ${sourceName} vs ${targetName}`);
      } else {
        output = generateDiffReportConsole(diffData, {
          showAll: options.showAll,
          maxChangesPerFile: options.fullDetails ? 9999 : 50
        });
      }

      if (options.file) {
        const result = saveReportToFile(output, options.output, 'diff', `${sourceName}_vs_${targetName}`);
        console.log(chalk.green(`\n✓ 报告已保存: ${chalk.underline(result.filePath)}`));
      }

      if (!program.opts().quiet && options.output !== 'json' || program.opts().json) {
        console.log(output);
      }

      if (program.opts().json && !options.file) {
        console.log(generateJsonReport(diffData, 'diff'));
      }

      audit('DIFF', { source: sourceName, target: targetName, summary: diffResult.summary });
    } catch (error) {
      spinner.fail('差异检测失败');
      handleError(error, { logger, debug: program.opts().debug });
      if (!program.opts().quiet) {
        console.error(chalk.red(`\n错误: ${error.message}`));
        if (program.opts().debug && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      }
      process.exit(error.code || ErrorCodes.UNKNOWN_ERROR);
    }
  });

program
  .command('scan')
  .description('检测生产环境与基准配置的漂移情况')
  .option('-e, --env <name>', '指定检测环境（默认: 生产环境 prod）', 'prod')
  .option('-b, --baseline <name>', `指定基准环境（默认: 配置文件中的 baseline）`)
  .option('-s, --service <name>', '仅检测指定微服务', (v, p) => [...p, v], [])
  .option('--unauthorized-only', '仅显示未授权变更')
  .option('--show-all', '显示全部漂移项（默认仅高危）')
  .option('-o, --output <format>', '输出格式: console/json/html', 'console')
  .option('-f, --file <path>', '将报告保存到文件')
  .option('--create-snapshot', '为当前环境创建快照')
  .action(async (options) => {
    const logger = getLogger();
    const spinner = ora('正在进行漂移检测...').start();

    try {
      if (!isInitialized()) {
        throw createError(
          '项目尚未初始化，请先运行 config-drift init',
          ErrorCodes.CONFIG_NOT_INITIALIZED
        );
      }

      const targetEnvName = options.env;
      const baselineName = options.baseline || getBaseline();

      if (!baselineName) {
        throw createError(
          '未配置基准环境，请使用 --baseline 指定或在 .driftrc.json 中设置 baseline',
          ErrorCodes.CONFIG_NOT_INITIALIZED
        );
      }

      const baselineCfg = getEnvironment(baselineName);
      const targetCfg = getEnvironment(targetEnvName);

      if (!baselineCfg) {
        throw createError(`基准环境不存在: ${baselineName}`, ErrorCodes.ENVIRONMENT_NOT_FOUND);
      }
      if (!targetCfg) {
        throw createError(`目标环境不存在: ${targetEnvName}`, ErrorCodes.ENVIRONMENT_NOT_FOUND);
      }

      spinner.text = `扫描基准环境: ${baselineName}`;
      const baselineEnv = scanEnvironment(baselineName, baselineCfg.path);

      spinner.text = `扫描目标环境: ${targetEnvName}`;
      const targetEnv = scanEnvironment(targetEnvName, targetCfg.path);

      spinner.text = '分析配置漂移...';
      const driftResult = scanDrift(targetEnv, baselineEnv, {
        currentName: targetEnvName,
        baselineName
      });

      if (options.unauthorizedOnly) {
        driftResult.driftItems = driftResult.driftItems.filter(d => d.isUnauthorized);
      }
      if (options.service && options.service.length > 0) {
        driftResult.driftItems = driftResult.driftItems.filter(
          d => options.service.includes(d.serviceName)
        );
      }

      if (options.createSnapshot) {
        spinner.text = '创建环境快照...';
        createSnapshot(targetEnvName, targetEnv, 'scan命令自动创建');
      }

      spinner.succeed(
        driftResult.driftSummary.driftCount > 0
          ? `检测到 ${driftResult.driftSummary.driftCount} 项漂移 (${driftResult.driftSummary.unauthorizedChanges} 项未授权)`
          : '未检测到配置漂移 ✓'
      );

      let output = '';
      if (options.output === 'json') {
        output = generateJsonReport(driftResult, 'drift');
      } else if (options.output === 'html') {
        output = generateHtmlReport(driftResult, 'drift',
          `配置漂移检测报告 - ${targetEnvName} vs ${baselineName}`);
      } else {
        output = generateDriftReportConsole(driftResult, { showAll: options.showAll });
      }

      if (options.file) {
        const result = saveReportToFile(output, options.output, 'drift',
          `${targetEnvName}_vs_${baselineName}`);
        console.log(chalk.green(`\n✓ 报告已保存: ${chalk.underline(result.filePath)}`));
      }

      if (!program.opts().quiet) {
        console.log(output);
      }

      if (program.opts().json) {
        console.log(generateJsonReport(driftResult, 'drift'));
      }

      audit('SCAN_DRIFT', {
        env: targetEnvName,
        baseline: baselineName,
        summary: driftResult.driftSummary
      });
    } catch (error) {
      spinner.fail('漂移检测失败');
      handleError(error, { logger, debug: program.opts().debug });
      if (!program.opts().quiet) {
        console.error(chalk.red(`\n错误: ${error.message}`));
        if (program.opts().debug && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      }
      process.exit(error.code || ErrorCodes.UNKNOWN_ERROR);
    }
  });

program
  .command('secrets')
  .description('识别配置文件中的敏感信息（密码、密钥、令牌等）')
  .option('-e, --env <name>', '指定环境扫描 (不指定扫描全部环境)')
  .option('-p, --path <path>', '直接扫描指定目录或文件')
  .option('-r, --rule <id>', '仅使用指定规则（可多次指定）', (v, p) => [...p, v], [])
  .option('--include-sensitive-values', '输出中包含脱敏后的敏感值')
  .option('--severity <level>', '按严重级别过滤: critical/high/medium/低危low')
  .option('--category <type>', '按类别过滤: password/api_key/private_key/pii等')
  .option('-o, --output <format>', '输出格式: console/json/html', 'console')
  .option('-f, --file <path>', '将报告保存到文件')
  .option('--export-kms', '生成KMS导入格式')
  .action(async (options) => {
    const logger = getLogger();
    const spinner = ora('正在扫描敏感信息...').start();

    try {
      if (options.path) {
        const targetPath = resolvePath(options.path);
        const envName = 'custom_scan';
        const tmpEnv = { envName, envPath: targetPath };
        const scanEnv = {
          envName,
          envPath: targetPath,
          files: [],
          summary: {}
        };

        spinner.text = `扫描路径: ${targetPath}`;
        if (fileExists(targetPath)) {
          const parsed = parseFile(targetPath);
          scanEnv.files = [{
            ...parsed,
            serviceName: 'custom',
            relativePath: path.basename(targetPath),
            envName,
            configCount: Object.keys(parsed.flatData).length
          }];
        } else {
          const result = scanEnvironment(envName, targetPath);
          scanEnv.files = result.files;
        }

        spinner.text = '分析敏感信息...';
        const scanResult = scanSecrets(scanEnv, {
          envName,
          includeMaskedValues: options.includeSensitiveValues,
          ruleIds: options.rule.length > 0 ? options.rule : null
        });

        let items = scanResult.allFindings || [];
        if (options.severity) {
          items = items.filter(f => f.severity === options.severity);
        }
        if (options.category) {
          items = items.filter(f => f.category === options.category);
        }
        scanResult.allFindings = items;
        scanResult.summary.total = items.length;

        spinner.succeed(`扫描完成，发现 ${items.length} 项敏感信息`);

        let output = '';
        if (options.output === 'json') {
          output = generateJsonReport(scanResult, 'secrets');
        } else if (options.output === 'html') {
          output = generateHtmlReport(scanResult, 'secrets', '敏感信息扫描报告');
        } else {
          output = generateSecretsReportConsole(scanResult);
        }

        if (options.file) {
          const result = saveReportToFile(output, options.output, 'secrets', envName);
          console.log(chalk.green(`\n✓ 报告已保存: ${chalk.underline(result.filePath)}`));
        }
        if (!program.opts().quiet) console.log(output);
        if (program.opts().json) console.log(generateJsonReport(scanResult, 'secrets'));
        audit('SCAN_SECRETS', { path: targetPath, summary: scanResult.summary });
        return;
      }

      if (!isInitialized()) {
        throw createError(
          '项目未初始化，请使用 --path 指定扫描路径，或先运行 config-drift init',
          ErrorCodes.CONFIG_NOT_INITIALIZED
        );
      }

      const envs = options.env ? [options.env] : listEnvironments().map(e => e.id);
      let allResults = [];
      let allFindings = [];
      const scanSummaries = [];

      for (const envName of envs) {
        const envCfg = getEnvironment(envName);
        if (!envCfg) {
          logger.warn(`环境不存在，跳过: ${envName}`);
          continue;
        }

        spinner.text = `扫描环境: ${envName} (${envCfg.path})`;
        const envData = scanEnvironment(envName, envCfg.path);

        spinner.text = `分析敏感信息: ${envName}`;
        const result = scanSecrets(envData, {
          envName,
          includeMaskedValues: options.includeSensitiveValues,
          ruleIds: options.rule.length > 0 ? options.rule : null
        });

        let items = result.allFindings || [];
        if (options.severity) items = items.filter(f => f.severity === options.severity);
        if (options.category) items = items.filter(f => f.category === options.category);
        result.allFindings = items;
        result.summary.total = items.length;

        allResults.push(result);
        allFindings = allFindings.concat(items);
        scanSummaries.push({ envName, ...result.summary });
      }

      const combined = {
        environments: allResults,
        allFindings,
        summary: {
          environmentsScanned: allResults.length,
          filesScanned: scanSummaries.reduce((s, r) => s + r.filesScanned, 0),
          total: allFindings.length,
          bySeverity: {
            critical: allFindings.filter(f => f.severity === 'critical').length,
            high: allFindings.filter(f => f.severity === 'high').length,
            medium: allFindings.filter(f => f.severity === 'medium').length,
            low: allFindings.filter(f => f.severity === 'low').length,
            info: allFindings.filter(f => f.severity === 'info').length
          },
          riskScore: allFindings.reduce((s, f) => {
            const w = { critical: 100, high: 50, medium: 20, low: 5, info: 0 };
            return s + (w[f.severity] || 0);
          }, 0),
          affectedServices: [...new Set(allFindings.map(f => f.serviceName).filter(Boolean))].length
        }
      };

      spinner.succeed(`完成: 扫描 ${combined.summary.environmentsScanned} 个环境, ${combined.summary.filesScanned} 个文件, 发现 ${combined.summary.total} 项敏感信息`);

      let output = '';
      if (options.output === 'json') {
        output = generateJsonReport(combined, 'secrets');
      } else if (options.output === 'html') {
        output = generateHtmlReport(combined, 'secrets', '敏感信息扫描报告');
      } else {
        output = generateSecretsReportConsole(combined);
      }

      if (options.exportKms) {
        const kmsData = allFindings
          .filter(f => f.type === 'sensitive' && f.key)
          .map(f => ({
            key: f.key,
            service: f.serviceName,
            file: f.file,
            category: f.category,
            rule: f.ruleId,
            current_value_placeholder: `{{${f.category.toUpperCase()}_${f.key.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}}}`
          }));
        const kmsPath = path.join(getDataDir(), `kms-export-${Date.now()}.json`);
        fs.writeFileSync(kmsPath, JSON.stringify(kmsData, null, 2));
        console.log(chalk.green(`\n✓ KMS导出文件已生成: ${chalk.underline(kmsPath)}`));
      }

      if (options.file) {
        const result = saveReportToFile(output, options.output, 'secrets', 'all_envs');
        console.log(chalk.green(`\n✓ 报告已保存: ${chalk.underline(result.filePath)}`));
      }
      if (!program.opts().quiet) console.log(output);
      if (program.opts().json) console.log(generateJsonReport(combined, 'secrets'));
      audit('SCAN_SECRETS_ALL', { envs, summary: combined.summary });
    } catch (error) {
      spinner.fail('敏感信息扫描失败');
      handleError(error, { logger, debug: program.opts().debug });
      if (!program.opts().quiet) {
        console.error(chalk.red(`\n错误: ${error.message}`));
        if (program.opts().debug && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      }
      process.exit(error.code || ErrorCodes.UNKNOWN_ERROR);
    }
  });

program
  .command('sync <source> <target>')
  .description('将源环境配置同步至目标环境')
  .option('-s, --service <name>', '仅同步指定微服务', (v, p) => [...p, v], [])
  .option('--include-key <pattern>', '仅同步匹配的配置键 (支持通配符,可多次)', (v, p) => [...p, v], [])
  .option('--exclude-key <pattern>', '排除匹配的配置键', (v, p) => [...p, v], [])
  .option('--include-sensitive', '同步包含敏感信息的配置项（默认跳过）')
  .option('-m, --mode <mode>', '同步模式: full/selective/files_only', 'selective')
  .option('-r, --resolve <strategy>', '冲突策略: overwrite/skip/merge/interactive', 'interactive')
  .option('--allow-delete', '允许删除目标环境中源环境不存在的文件')
  .option('--preview', '预览模式（默认，确认后执行）')
  .option('--apply', '直接应用（无需确认）')
  .option('-y, --yes', '自动确认所有操作')
  .option('-o, --output <format>', '输出格式: console/json', 'console')
  .option('-f, --file <path>', '将同步计划保存到文件')
  .action(async (sourceName, targetName, options) => {
    const logger = getLogger();
    const spinner = ora('正在准备同步...').start();

    try {
      if (!isInitialized()) {
        throw createError('项目尚未初始化', ErrorCodes.CONFIG_NOT_INITIALIZED);
      }

      const srcCfg = getEnvironment(sourceName);
      const tgtCfg = getEnvironment(targetName);
      if (!srcCfg) throw createError(`源环境不存在: ${sourceName}`, ErrorCodes.ENVIRONMENT_NOT_FOUND);
      if (!tgtCfg) throw createError(`目标环境不存在: ${targetName}`, ErrorCodes.ENVIRONMENT_NOT_FOUND);

      if (sourceName === targetName) {
        throw createError('源环境和目标环境不能相同', ErrorCodes.INVALID_ARGUMENT);
      }

      spinner.text = `扫描源环境: ${sourceName}`;
      const sourceEnv = scanEnvironment(sourceName, srcCfg.path);

      spinner.text = `扫描目标环境: ${targetName}`;
      const targetEnv = scanEnvironment(targetName, tgtCfg.path);

      spinner.text = '计算差异...';
      const diffResult = diffEnvironments(sourceEnv, targetEnv, {
        sourceEnvName: sourceName, targetEnvName: targetName
      });

      const dryRun = !options.apply;

      spinner.text = '生成同步计划...';
      const plan = generateSyncPlan(sourceEnv, targetEnv, diffResult, {
        mode: options.mode,
        conflictResolution: options.resolve,
        services: options.service.length > 0 ? options.service : null,
        includeKeys: options.includeKey.length > 0 ? options.includeKey : null,
        excludeKeys: options.excludeKey.length > 0 ? options.excludeKey : null,
        includeSensitive: options.includeSensitive,
        dryRun,
        allowDelete: options.allowDelete
      });

      spinner.succeed(`同步计划已生成: ${plan.summary.totalActions} 个操作`);

      if (!program.opts().quiet) {
        console.log('');
        console.log(chalk.bold.cyan('📋 同步计划概要'));
        const s = plan.summary;
        const planTable = new Table({
          head: [chalk.white('操作类型'), chalk.white('数量'), chalk.white('说明')],
          colWidths: [18, 12, 40]
        });
        planTable.push(
          [chalk.green('新增文件'), s.filesToCreate, `${s.keysToAdd} 个配置项将被写入`],
          [chalk.yellow('更新文件'), s.filesToUpdate, `+${s.keysToAdd} 新增 ~${s.keysToUpdate} 修改 -${s.keysToDelete} 删除`],
          [s.filesToDelete > 0 ? chalk.red('删除文件') : chalk.gray('删除文件'), s.filesToDelete, options.allowDelete ? '将删除' : '已禁用'],
          [chalk.magenta('冲突'), s.conflicts, `策略: ${options.resolve}`],
          [chalk.gray('跳过'), s.skipped, '已排除或匹配过滤规则']
        );
        console.log(planTable.toString());

        if (plan.actions.length > 0 && plan.actions.length <= 50) {
          console.log('');
          console.log(chalk.bold('操作明细:'));
          for (const action of plan.actions.slice(0, 30)) {
            const icon = action.type === 'create_file' ? '+' : action.type === 'update_file' ? '~' : '-';
            const color = action.type === 'create_file' ? chalk.green : action.type === 'update_file' ? chalk.yellow : chalk.red;
            const conflictTag = action.conflict ? chalk.bgMagenta.white(' 冲突 ') : '';
            console.log(`  ${color(icon)} [${action.serviceName || '-'}] ${action.targetPath || action.sourcePath} ${conflictTag}`);
            if (action.type === 'update_file' && action.changes) {
              for (const c of action.changes.slice(0, 3)) {
                const p = c.type === 'added' ? '+' : c.type === 'removed' ? '-' : '~';
                console.log(`    ${chalk.gray(p)} ${c.key}${c.type === 'modified' ? chalk.gray(' = '+ (typeof c.oldValue === 'string' ? c.oldValue.substring(0, 10) : '') + ' -> ' + (typeof c.newValue === 'string' ? c.newValue.substring(0, 10) : '')) : ''}`);
              }
              if (action.changes.length > 3) {
                console.log(`    ${chalk.gray(`... 还有 ${action.changes.length - 3} 项变更`)}`);
              }
            }
          }
        }
      }

      if (options.output === 'json' || options.file) {
        const json = generateJsonReport({ plan }, 'sync_plan');
        if (options.file) {
          saveReportToFile(json, 'json', 'sync_plan', `${sourceName}_to_${targetName}`);
        }
        if (program.opts().json || options.output === 'json') {
          console.log(json);
        }
      }

      let confirmed = options.yes || options.apply;
      if (!confirmed && !program.opts().quiet && plan.summary.totalActions > 0) {
        console.log('');
        const confirm = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'apply',
            message: dryRun
              ? `当前为预演模式，确认要执行上述 ${plan.summary.totalActions} 个同步操作吗?`
              : `确认执行 ${plan.summary.totalActions} 个同步操作?`,
            default: false
          }
        ]);
        confirmed = confirm.apply;
      }

      if (!confirmed) {
        console.log(chalk.yellow('\n已取消同步操作。使用 --apply 或确认后执行。'));
        return;
      }

      spinner.start('执行同步操作...');
      const result = await executeSyncPlan(plan, tgtCfg.path, {
        confirmCallback: async (action) => {
          const answer = await inquirer.prompt([
            {
              type: 'list',
              name: 'decision',
              message: `检测到冲突 [${action.serviceName}] ${action.targetPath}，请选择处理方式:`,
              choices: [
                { name: '覆盖目标值 (源环境优先)', value: ConflictResolution.OVERWRITE },
                { name: '保留目标值 (不修改)', value: ConflictResolution.PRESERVE_TARGET },
                { name: '跳过此文件', value: ConflictResolution.SKIP }
              ],
              default: ConflictResolution.OVERWRITE
            }
          ]);
          return answer.decision;
        }
      });

      spinner.succeed(`同步完成: 完成=${result.summary.completed}, 跳过=${result.summary.skipped}, 失败=${result.summary.failed}`);

      if (!program.opts().quiet) {
        console.log('');
        console.log(chalk.bold.green('✅ 同步结果'));
        const resultTable = new Table({
          head: [chalk.white('指标'), chalk.white('数量')],
          colWidths: [25, 20]
        });
        resultTable.push(
          ['总操作数', result.summary.total],
          [chalk.green('成功'), result.summary.completed],
          [chalk.yellow('跳过'), result.summary.skipped],
          [chalk.red('失败'), result.summary.failed],
          ['配置项新增', result.summary.keysAdded],
          ['配置项更新', result.summary.keysUpdated],
          ['配置项删除', result.summary.keysDeleted]
        );
        console.log(resultTable.toString());
      }

      audit('SYNC', { source: sourceName, target: targetName, summary: result.summary });
    } catch (error) {
      spinner.fail('同步失败');
      handleError(error, { logger, debug: program.opts().debug });
      if (!program.opts().quiet) {
        console.error(chalk.red(`\n错误: ${error.message}`));
        if (program.opts().debug && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      }
      process.exit(error.code || ErrorCodes.UNKNOWN_ERROR);
    }
  });

program
  .command('history')
  .description('查看配置变更历史记录')
  .option('-e, --env <name>', '按环境筛选')
  .option('-s, --service <name>', '按微服务筛选')
  .option('-k, --key <pattern>', '按配置键筛选（包含匹配）')
  .option('-o, --operator <name>', '按操作人筛选')
  .option('-t, --type <op>', '按操作类型筛选: create/update/delete/sync等')
  .option('--from <date>', '起始时间 (YYYY-MM-DD)')
  .option('--to <date>', '结束时间 (YYYY-MM-DD)')
  .option('-l, --limit <n>', '显示记录数', '50')
  .option('--offset <n>', '偏移量', '0')
  .option('--snapshots', '列出环境快照')
  .option('--create-snapshot <env>', '为指定环境创建快照')
  .option('--compare-snapshot <id>', '将当前环境与指定快照对比')
  .option('-o, --output <format>', '输出格式: console/json', 'console')
  .action(async (options) => {
    const logger = getLogger();
    const spinner = ora('加载历史记录...').start();

    try {
      if (options.createSnapshot) {
        const envName = options.createSnapshot;
        const envCfg = getEnvironment(envName);
        if (!envCfg) throw createError(`环境不存在: ${envName}`, ErrorCodes.ENVIRONMENT_NOT_FOUND);
        spinner.text = `扫描环境: ${envName}`;
        const envData = scanEnvironment(envName, envCfg.path);
        spinner.text = '创建快照...';
        const snap = createSnapshot(envName, envData);
        spinner.succeed(`快照创建成功: ${snap.id}`);
        if (!program.opts().quiet) {
          console.log(chalk.green(`\n✓ 快照ID: ${chalk.bold(snap.id)}`));
          console.log(chalk.gray(`  路径: ${snap.path}`));
        }
        if (program.opts().json) console.log(JSON.stringify(snap, null, 2));
        return;
      }

      if (options.snapshots) {
        spinner.text = '加载快照列表...';
        const snaps = listSnapshots(options.env);
        spinner.succeed(`共 ${snaps.length} 个快照`);
        if (!program.opts().quiet) {
          if (snaps.length === 0) {
            console.log(chalk.gray('暂无快照，使用 --create-snapshot <env> 创建'));
          } else {
            const t = new Table({
              head: [chalk.white('快照ID'), chalk.white('环境'), chalk.white('创建时间'), chalk.white('文件数'), chalk.white('说明')],
              colWidths: [35, 10, 22, 8, 30]
            });
            for (const s of snaps) t.push([
              chalk.cyan(s.id), s.envName, formatDate(s.createdAt, 'MM-DD HH:mm:ss'),
              s.fileCount, s.description || '-'
            ]);
            console.log(t.toString());
          }
        }
        if (program.opts().json) console.log(JSON.stringify(snaps, null, 2));
        return;
      }

      if (options.compareSnapshot) {
        spinner.text = '对比快照...';
        const envName = options.env || getBaseline() || 'prod';
        const envCfg = getEnvironment(envName);
        if (!envCfg) throw createError(`环境不存在: ${envName}`, ErrorCodes.ENVIRONMENT_NOT_FOUND);
        const envData = scanEnvironment(envName, envCfg.path);
        const { compareWithSnapshot } = await import('./lib/history.js');
        const comp = compareWithSnapshot(envData, options.compareSnapshot);
        spinner.succeed(`发现 ${comp.summary.total} 处变更`);
        if (!program.opts().quiet) {
          console.log('');
          console.log(chalk.bold(`对比: ${chalk.cyan(options.compareSnapshot)} vs 当前环境`));
          console.log(chalk.gray(`  快照创建于: ${comp.snapshotCreatedAt}`));
          const t = new Table({
            head: [chalk.white('变更类型'), chalk.white('数量')],
            colWidths: [20, 10]
          });
          t.push(
            ['新增文件', comp.summary.fileAdded],
            ['删除文件', comp.summary.fileRemoved],
            ['配置项新增', comp.summary.configAdded],
            ['配置项删除', comp.summary.configRemoved],
            ['配置项修改', comp.summary.configModified]
          );
          console.log(t.toString());
          if (comp.changes.length < 50) {
            for (const c of comp.changes.slice(0, 30)) {
              console.log(`  [${c.serviceName || '-'}] ${c.type} ${c.relativePath || c.key}`);
            }
          }
        }
        if (program.opts().json) console.log(JSON.stringify(comp, null, 2));
        return;
      }

      const filters = {};
      if (options.env) filters.envName = options.env;
      if (options.service) filters.serviceName = options.service;
      if (options.key) filters.configKey = options.key;
      if (options.operator) filters.operator = options.operator;
      if (options.type) filters.operation = options.type;
      if (options.from) filters.startTime = new Date(options.from).toISOString();
      if (options.to) {
        const d = new Date(options.to);
        d.setHours(23, 59, 59, 999);
        filters.endTime = d.toISOString();
      }

      const result = options.key
        ? getChangeHistoryForKey(options.key, {
            limit: parseInt(options.limit), offset: parseInt(options.offset)
          })
        : options.service
          ? getChangeHistoryForService(options.service, {
              limit: parseInt(options.limit), offset: parseInt(options.offset)
            })
          : queryHistory(filters, {
              limit: parseInt(options.limit), offset: parseInt(options.offset)
            });

      spinner.succeed(`查询完成: ${result.total} 条记录`);

      if (!program.opts().quiet && options.output === 'console') {
        console.log(generateHistoryReportConsole(result));
      }

      if (program.opts().json || options.output === 'json') {
        console.log(generateJsonReport(result, 'history'));
      }

      audit('QUERY_HISTORY', { filters, resultCount: result.total });
    } catch (error) {
      spinner.fail('历史查询失败');
      handleError(error, { logger, debug: program.opts().debug });
      if (!program.opts().quiet) {
        console.error(chalk.red(`\n错误: ${error.message}`));
        if (program.opts().debug && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      }
      process.exit(error.code || ErrorCodes.UNKNOWN_ERROR);
    }
  });

program
  .command('export')
  .description('导出环境配置清单和报告')
  .option('-e, --env <name>', '指定环境（不指定导出全部）')
  .option('-f, --format <format>', '导出格式: json/csv/markdown', 'json')
  .option('-o, --output <path>', '输出文件路径')
  .option('--type <type>', '导出类型: configs/services/diffs/history/secrets', 'configs')
  .option('--include-values', '包含配置项值（默认只导出键和元数据）')
  .action(async (options) => {
    const logger = getLogger();
    const spinner = ora('正在导出...').start();

    try {
      if (!isInitialized()) {
        throw createError('项目尚未初始化', ErrorCodes.CONFIG_NOT_INITIALIZED);
      }

      const envs = options.env ? [options.env] : listEnvironments().map(e => e.id);
      const exportData = {
        exportedAt: new Date().toISOString(),
        exportType: options.type,
        environments: [],
        format: options.format
      };

      for (const envName of envs) {
        const envCfg = getEnvironment(envName);
        if (!envCfg) continue;
        spinner.text = `扫描环境: ${envName}`;
        const envData = scanEnvironment(envName, envCfg.path);

        const envExport = {
          name: envName,
          path: envCfg.path,
          description: envCfg.description,
          services: [],
          totalConfigFiles: envData.files?.length || 0,
          totalConfigs: (envData.files || []).reduce((s, f) => s + f.configCount, 0)
        };

        const servicesMap = {};
        for (const file of envData.files || []) {
          if (!servicesMap[file.serviceName]) {
            servicesMap[file.serviceName] = { name: file.serviceName, files: [], totalConfigs: 0 };
          }
          const fileExport = {
            path: file.relativePath,
            absolutePath: file.filePath,
            format: file.format,
            size: file.size,
            configCount: file.configCount,
            hash: file.hash,
            lastModified: file.mtime
          };
          if (options.includeValues) {
            fileExport.configs = file.flatData;
          } else {
            fileExport.configKeys = Object.keys(file.flatData);
          }
          servicesMap[file.serviceName].files.push(fileExport);
          servicesMap[file.serviceName].totalConfigs += file.configCount;
        }
        envExport.services = Object.values(servicesMap);
        exportData.environments.push(envExport);
      }

      let content = '';
      let defaultExt = 'json';
      if (options.format === 'markdown') {
        content = exportToMarkdown({
          summary: {
            environments: exportData.environments.length,
            totalFiles: exportData.environments.reduce((s, e) => s + e.totalConfigFiles, 0),
            totalConfigs: exportData.environments.reduce((s, e) => s + e.totalConfigs, 0)
          },
          items: exportData.environments.flatMap(e =>
            e.services.flatMap(s =>
              s.files.map(f => ({
                环境: e.name,
                服务: s.name,
                文件: f.path,
                格式: f.format,
                配置项数: f.configCount,
                修改时间: f.lastModified
              }))
            )
          )
        }, '配置清单导出报告');
        defaultExt = 'md';
      } else if (options.format === 'csv') {
        const rows = exportData.environments.flatMap(e =>
          e.services.flatMap(s =>
            s.files.map(f => ({
              environment: e.name,
              service: s.name,
              filePath: f.path,
              format: f.format,
              size: f.size,
              configCount: f.configCount,
              hash: f.hash,
              lastModified: f.lastModified
            }))
          )
        );
        const cols = [
          { key: 'environment', label: '环境' },
          { key: 'service', label: '微服务' },
          { key: 'filePath', label: '文件路径' },
          { key: 'format', label: '格式' },
          { key: 'size', label: '大小' },
          { key: 'configCount', label: '配置项数' },
          { key: 'hash', label: '哈希' },
          { key: 'lastModified', label: '修改时间' }
        ];
        const csvPath = options.output || path.join(getDataDir(),
          `export_${options.type}_${Date.now()}.csv`);
        exportToCsv(rows, cols, csvPath);
        spinner.succeed(`CSV导出成功: ${csvPath}`);
        console.log(chalk.green(`\n✓ CSV文件已保存: ${chalk.underline(csvPath)}`));
        if (program.opts().json) console.log(JSON.stringify({ path: csvPath, rows: rows.length }, null, 2));
        return;
      } else {
        content = JSON.stringify(exportData, null, 2);
        defaultExt = 'json';
      }

      const outputPath = options.output || path.join(getDataDir(),
        `export_${options.type}_${Date.now()}.${defaultExt}`);
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, content, 'utf-8');
      spinner.succeed(`导出成功: ${outputPath}`);
      console.log(chalk.green(`\n✓ 文件已保存: ${chalk.underline(outputPath)}`));
      console.log(chalk.gray(`  格式: ${options.format} | 环境: ${exportData.environments.length} | ` +
        `文件: ${exportData.environments.reduce((s, e) => s + e.totalConfigFiles, 0)}`));

      if (program.opts().json) console.log(JSON.stringify({
        path: outputPath,
        environments: exportData.environments.length,
        totalFiles: exportData.environments.reduce((s, e) => s + e.totalConfigFiles, 0),
        totalConfigs: exportData.environments.reduce((s, e) => s + e.totalConfigs, 0)
      }, null, 2));

      audit('EXPORT', { format: options.format, type: options.type, path: outputPath });
    } catch (error) {
      spinner.fail('导出失败');
      handleError(error, { logger, debug: program.opts().debug });
      if (!program.opts().quiet) {
        console.error(chalk.red(`\n错误: ${error.message}`));
        if (program.opts().debug && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      }
      process.exit(error.code || ErrorCodes.UNKNOWN_ERROR);
    }
  });

program
  .command('validate')
  .description('批量校验配置文件格式、必填项和完整性')
  .option('-e, --env <name>', '指定环境校验 (默认全部)')
  .option('-s, --service <name>', '仅校验指定微服务', (v, p) => [...p, v], [])
  .option('--strict', '严格模式，将警告也视为失败')
  .option('--fail-on-warning', '存在警告时返回非零退出码')
  .option('-o, --output <format>', '输出格式: console/json/html', 'console')
  .option('-f, --file <path>', '将报告保存到文件')
  .action(async (options) => {
    const logger = getLogger();
    const spinner = ora('正在校验配置...').start();

    try {
      if (!isInitialized()) {
        throw createError('项目尚未初始化', ErrorCodes.CONFIG_NOT_INITIALIZED);
      }

      const envs = options.env ? [options.env] : listEnvironments().map(e => e.id);
      const allResults = [];
      let grandErrors = 0;
      let grandWarnings = 0;

      for (const envName of envs) {
        const envCfg = getEnvironment(envName);
        if (!envCfg) continue;
        spinner.text = `扫描环境: ${envName}`;
        const envData = scanEnvironment(envName, envCfg.path);

        if (options.service && options.service.length > 0) {
          envData.files = envData.files.filter(f => options.service.includes(f.serviceName));
        }

        spinner.text = `校验配置: ${envName}`;
        const result = validateEnvironment(envData, { envName });
        allResults.push(result);
        grandErrors += result.totalErrors;
        grandWarnings += result.totalWarnings;
      }

      const combined = {
        environments: allResults,
        summary: {
          environmentsScanned: allResults.length,
          filesScanned: allResults.reduce((s, r) => s + r.filesScanned, 0),
          validFiles: allResults.reduce((s, r) => s + r.validFiles, 0),
          invalidFiles: allResults.reduce((s, r) => s + r.invalidFiles, 0),
          totalErrors: grandErrors,
          totalWarnings: grandWarnings,
          passRate: allResults.length > 0
            ? Math.round(
                (allResults.reduce((s, r) => s + r.validFiles, 0) /
                 allResults.reduce((s, r) => s + r.filesScanned, 0)) * 100
              )
            : 0
        }
      };

      const hasError = grandErrors > 0;
      const hasWarn = grandWarnings > 0;
      spinner.succeed(
        hasError
          ? `校验失败: ${grandErrors} 个错误, ${grandWarnings} 个警告`
          : hasWarn
            ? `校验通过 (有警告): ${grandWarnings} 个警告`
            : '全部校验通过 ✓'
      );

      let output = '';
      if (options.output === 'json') {
        output = generateJsonReport(combined, 'validate');
      } else if (options.output === 'html') {
        output = generateHtmlReport(combined, 'validate', '配置校验报告');
      } else {
        output = generateValidationReportConsole(combined);
      }

      if (options.file) {
        const r = saveReportToFile(output, options.output, 'validate',
          options.env || 'all_envs');
        console.log(chalk.green(`\n✓ 报告已保存: ${chalk.underline(r.filePath)}`));
      }
      if (!program.opts().quiet) console.log(output);
      if (program.opts().json) console.log(generateJsonReport(combined, 'validate'));

      audit('VALIDATE', {
        envs,
        summary: combined.summary,
        strict: options.strict
      });

      if (hasError || (options.strict && hasWarn) || options.failOnWarning && hasWarn) {
        process.exit(ErrorCodes.VALIDATION_FAILED);
      }
    } catch (error) {
      spinner.fail('校验失败');
      handleError(error, { logger, debug: program.opts().debug });
      if (!program.opts().quiet) {
        console.error(chalk.red(`\n错误: ${error.message}`));
        if (program.opts().debug && error.stack) {
          console.error(chalk.gray(error.stack));
        }
      }
      process.exit(error.code || ErrorCodes.UNKNOWN_ERROR);
    }
  });

program
  .command('env')
  .description('管理已配置的环境列表')
  .option('-l, --list', '列出所有环境', true)
  .option('--add <name:path>', '添加环境，格式: name:path')
  .option('--remove <name>', '删除指定环境')
  .option('--set-baseline <name>', '设置基准环境')
  .action(async (options) => {
    if (!isInitialized()) {
      console.error(chalk.red('项目尚未初始化，请先运行 config-drift init'));
      process.exit(ErrorCodes.CONFIG_NOT_INITIALIZED);
    }
    let config = getConfig();

    if (options.add) {
      const [name, ...pathParts] = options.add.split(':');
      const envPath = resolvePath(pathParts.join(':'));
      if (!name || !envPath) {
        console.error(chalk.red('格式错误，应为 name:path'));
        process.exit(ErrorCodes.INVALID_ARGUMENT);
      }
      if (!dirExists(envPath)) {
        console.error(chalk.yellow(`警告: 目录不存在: ${envPath}`));
      }
      config = addEnvironment(name, { path: envPath, description: 'CLI添加' });
      saveProjectConfig(config);
      console.log(chalk.green(`✓ 已添加环境: ${name} -> ${envPath}`));
      audit('ENV_ADD', { name, path: envPath });
    }

    if (options.remove) {
      if (!config.environments?.[options.remove]) {
        console.error(chalk.red(`环境不存在: ${options.remove}`));
        process.exit(ErrorCodes.ENVIRONMENT_NOT_FOUND);
      }
      config = removeEnvironment(options.remove);
      if (config.baseline === options.remove) config.baseline = null;
      saveProjectConfig(config);
      console.log(chalk.green(`✓ 已删除环境: ${options.remove}`));
      audit('ENV_REMOVE', { name: options.remove });
    }

    if (options.setBaseline) {
      if (!config.environments?.[options.setBaseline]) {
        console.error(chalk.red(`环境不存在: ${options.setBaseline}`));
        process.exit(ErrorCodes.ENVIRONMENT_NOT_FOUND);
      }
      config = setBaseline(options.setBaseline);
      saveProjectConfig(config);
      console.log(chalk.green(`✓ 基准环境已设置为: ${options.setBaseline}`));
      audit('ENV_BASELINE', { name: options.setBaseline });
    }

    if (options.list || (!options.add && !options.remove && !options.setBaseline)) {
      const envs = listEnvironments();
      const t = new Table({
        head: [chalk.white('#'), chalk.white('环境名'), chalk.white('描述'), chalk.white('路径'), chalk.white('基准')],
        colWidths: [4, 14, 20, 45, 8]
      });
      let idx = 1;
      for (const e of envs) {
        t.push([
          String(idx++),
          chalk.cyan(e.id),
          e.description || e.name || '-',
          e.path,
          config.baseline === e.id ? chalk.green(' ✓ ') : ''
        ]);
      }
      console.log(t.toString());
      console.log(chalk.gray(`\n共 ${envs.length} 个环境。基线: ${config.baseline || '(未设置)'}`));
      if (program.opts().json) console.log(JSON.stringify(envs, null, 2));
    }
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(chalk.red(`\n未捕获错误: ${error.message}`));
  if (program.opts().debug && error.stack) {
    console.error(chalk.gray(error.stack));
  }
  process.exit(ErrorCodes.UNKNOWN_ERROR);
}
