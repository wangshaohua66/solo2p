#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const dayjs = require('dayjs');
const watch = require('node-watch');

const config = require('../src/config');
const reader = require('../src/reader');
const parser = require('../src/parser');
const { PatternEngine } = require('../src/pattern');
const { StatsAggregator } = require('../src/stats');
const { AlertDetector } = require('../src/alert');
const { ArchiveManager } = require('../src/archive');
const output = require('../src/output');

function buildCLI() {
  return yargs(hideBin(process.argv))
    .scriptName('logwatch')
    .usage('$0 <command> [options]')
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to YAML configuration file',
      default: config.getDefaultConfigPath()
    })
    .option('format', {
      alias: 'f',
      type: 'string',
      choices: ['table', 'json', 'csv', 'markdown'],
      description: 'Output format',
      default: 'table'
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Show verbose output',
      default: false
    })
    .command(
      'analyze',
      'Analyze log files with pattern matching and statistics',
      (yargs) => {
        return yargs
          .option('source', {
            alias: 's',
            type: 'string',
            description: 'Specific source name to analyze (default: all)'
          })
          .option('window', {
            alias: 'w',
            type: 'string',
            choices: ['minute', 'hour', 'day'],
            description: 'Time window for aggregation',
            default: 'minute'
          })
          .option('from', {
            type: 'string',
            description: 'Start time (ISO 8601 or relative e.g. 1h, 24h, 7d)'
          })
          .option('to', {
            type: 'string',
            description: 'End time (ISO 8601 or relative)'
          })
          .option('output', {
            alias: 'o',
            type: 'string',
            description: 'Output file path'
          })
          .option('patterns', {
            alias: 'p',
            type: 'boolean',
            description: 'Include pattern matching results',
            default: true
          })
          .option('stats', {
            type: 'boolean',
            description: 'Include time-series statistics',
            default: true
          })
          .option('alerts', {
            alias: 'a',
            type: 'boolean',
            description: 'Run alert detection',
            default: true
          });
      },
      handleAnalyze
    )
    .command(
      'monitor',
      'Real-time log monitoring with pattern matching',
      (yargs) => {
        return yargs
          .option('source', {
            alias: 's',
            type: 'string',
            description: 'Specific source name to monitor'
          })
          .option('patterns', {
            alias: 'p',
            type: 'boolean',
            description: 'Enable pattern matching',
            default: true
          })
          .option('alerts', {
            alias: 'a',
            type: 'boolean',
            description: 'Enable alert detection',
            default: true
          });
      },
      handleMonitor
    )
    .command(
      'archive',
      'Archive and compress log files',
      (yargs) => {
        return yargs
          .option('source', {
            alias: 's',
            type: 'string',
            description: 'Specific source name to archive'
          })
          .option('date', {
            alias: 'd',
            type: 'string',
            description: 'Archive files from specific date (YYYY-MM-DD)'
          })
          .option('older-than', {
            type: 'number',
            description: 'Archive files older than N days'
          })
          .option('no-cleanup', {
            type: 'boolean',
            description: 'Do not delete source files after archiving',
            default: false
          })
          .option('stats', {
            type: 'boolean',
            description: 'Show archive statistics',
            default: false
          })
          .option('cleanup', {
            type: 'boolean',
            description: 'Clean up archives older than retention period',
            default: false
          });
      },
      handleArchive
    )
    .command(
      'report',
      'Generate analysis report in various formats',
      (yargs) => {
        return yargs
          .option('source', {
            alias: 's',
            type: 'string',
            description: 'Specific source name'
          })
          .option('window', {
            alias: 'w',
            type: 'string',
            choices: ['minute', 'hour', 'day'],
            description: 'Time window for aggregation',
            default: 'hour'
          })
          .option('from', {
            type: 'string',
            description: 'Start time'
          })
          .option('to', {
            type: 'string',
            description: 'End time'
          })
          .option('output', {
            alias: 'o',
            type: 'string',
            description: 'Output file path',
            demandOption: true
          })
          .option('correlate', {
            type: 'boolean',
            description: 'Enable cross-source correlation',
            default: false
          });
      },
      handleReport
    )
    .command(
      'config',
      'Manage configuration',
      (yargs) => {
        return yargs
          .command(
            'init',
            'Create default configuration file',
            (yargs) => {
              return yargs.option('force', {
                type: 'boolean',
                description: 'Overwrite existing config',
                default: false
              });
            },
            handleConfigInit
          )
          .command(
            'validate',
            'Validate configuration file',
            {},
            handleConfigValidate
          )
          .command(
            'show',
            'Display current configuration',
            {},
            handleConfigShow
          )
          .demandCommand(1, 'Specify a config sub-command: init, validate, show');
      },
      () => {}
    )
    .demandCommand(1, 'Specify a command: analyze, monitor, archive, report, config')
    .strict()
    .help()
    .alias('help', 'h')
    .epilog('Documentation: https://github.com/example/logwatch')
    .wrap(null);
}

async function loadAndValidateConfig(configPath, verbose) {
  const spinner = ora('Loading configuration...').start();
  try {
    const cfg = await config.loadConfig(configPath);
    spinner.succeed(`Configuration loaded: ${cfg.sources.length} source(s), ${cfg.patterns.length} pattern(s), ${cfg.alerts.length} alert rule(s)`);
    if (verbose) {
      console.log(chalk.gray(`  Config path: ${path.resolve(configPath)}`));
    }
    return cfg;
  } catch (e) {
    spinner.fail('Configuration error');
    console.error(chalk.red(`  ${e.message}`));
    process.exit(1);
  }
}

function parseTimeArg(timeStr) {
  if (!timeStr) return null;

  const relativeMatch = timeStr.match(/^(\d+)(m|h|d)$/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = { m: 'minute', h: 'hour', d: 'day' }[relativeMatch[2]];
    return dayjs().subtract(amount, unit).toISOString();
  }

  const parsed = dayjs(timeStr);
  if (parsed.isValid()) return parsed.toISOString();

  throw new Error(`Invalid time format: ${timeStr}. Use ISO 8601 or relative (e.g. 1h, 24h, 7d)`);
}

async function handleAnalyze(argv) {
  const cfg = await loadAndValidateConfig(argv.config, argv.verbose);
  const sources = argv.source
    ? cfg.sources.filter(s => s.name === argv.source)
    : cfg.sources;

  if (sources.length === 0) {
    console.error(chalk.red('No matching log sources found.'));
    process.exit(1);
  }

  const patternEngine = new PatternEngine(cfg.patterns);
  const statsAgg = new StatsAggregator({ windowSize: argv.window });
  const alertDetector = new AlertDetector(cfg.alerts);

  const fromTime = parseTimeArg(argv.from);
  const toTime = parseTimeArg(argv.to);

  const spinner = ora('Analyzing log files...').start();
  let totalLines = 0;
  const concurrency = cfg.monitoring.concurrency || 8;

  const allFiles = [];
  for (const source of sources) {
    const files = await reader.resolveSourceFiles(source, process.cwd());
    if (files.length === 0) {
      if (argv.verbose) {
        spinner.info(`No files found for source '${source.name}' (path: ${source.path})`);
        spinner.start();
      }
      continue;
    }
    const parse = parser.createParser(source);
    for (const file of files) {
      allFiles.push({ file, source, parse });
    }
  }

  if (allFiles.length === 0) {
    spinner.warn('No log files found to analyze');
    return;
  }

  spinner.text = `Analyzing ${allFiles.length} file(s) with ${concurrency} concurrent workers...`;

  const semaphore = {
    count: 0,
    waiting: [],
    acquire() {
      return new Promise(resolve => {
        if (this.count < concurrency) {
          this.count++;
          resolve();
        } else {
          this.waiting.push(resolve);
        }
      });
    },
    release() {
      this.count--;
      if (this.waiting.length > 0) {
        this.count++;
        this.waiting.shift()();
      }
    }
  };

  const fileResults = await Promise.all(allFiles.map(async ({ file, source, parse }) => {
    await semaphore.acquire();
    try {
      let fileLines = 0;
      for await (const lineData of reader.streamLines(file.path, { encoding: source.encoding || 'utf-8' })) {
        fileLines++;

        const parsed = parse(lineData);
        if (parsed) {
          if (fromTime && parsed._timestamp && parsed._timestamp < fromTime) continue;
          if (toTime && parsed._timestamp && parsed._timestamp > toTime) continue;

          statsAgg.addRecord(parsed);

          if (argv.patterns) {
            const matches = patternEngine.matchLine(parsed);
            for (const match of matches) {
              statsAgg.addPatternMatch(match);
            }
          }
        }
      }

      const currentTotal = totalLines += fileLines;
      if (currentTotal % 100000 === 0) {
        spinner.text = `Processed ${currentTotal.toLocaleString()} lines across ${allFiles.length} file(s)...`;
      }

      return { file: file.path, lines: fileLines, success: true };
    } catch (e) {
      return { file: file.path, error: e.message, success: false };
    } finally {
      semaphore.release();
    }
  }));

  const successCount = fileResults.filter(r => r.success).length;
  const errorCount = fileResults.filter(r => !r.success).length;

  spinner.succeed(`Analysis complete: ${totalLines.toLocaleString()} lines processed (${successCount} files, ${errorCount} errors)`);

  if (errorCount > 0 && argv.verbose) {
    for (const r of fileResults.filter(r => !r.success)) {
      console.error(chalk.red(`  Error reading ${r.file}: ${r.error}`));
    }
  }

  const summary = statsAgg.getSummary();
  const patternStats = patternEngine.getStats();
  const timeSeries = statsAgg.getTimeSeries();

  let alerts = [];
  if (argv.alerts && cfg.alerts.length > 0) {
    alerts = alertDetector.evaluate(summary, patternStats);
  }

  if (argv.format === 'json') {
    const result = { summary, patterns: patternStats, timeSeries, alerts };
    await output.writeOutput(output.toJSON(result), argv.output);
  } else if (argv.format === 'csv') {
    let csvContent = '';
    if (argv.patterns) csvContent += output.patternStatsToCSV(patternStats) + '\n\n';
    if (argv.stats) csvContent += output.timeSeriesToCSV(timeSeries);
    await output.writeOutput(csvContent, argv.output);
  } else if (argv.format === 'markdown') {
    let md = '# Log Analysis Report\n\n';
    md += `**Generated:** ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    md += '## Summary\n';
    md += `- Total Lines: ${summary.totalLines}\n`;
    md += `- Error Rate: ${summary.errorRate}%\n\n`;
    if (argv.patterns) md += '## Pattern Matches\n\n' + output.patternStatsToMarkdown(patternStats) + '\n\n';
    if (argv.stats) md += '## Time Series\n\n' + output.timeSeriesToMarkdown(timeSeries) + '\n';
    await output.writeOutput(md, argv.output);
  } else {
    console.log('');
    console.log(output.formatStatsSummary(summary));
    if (argv.patterns && patternStats.length > 0) {
      console.log('');
      console.log(chalk.bold.cyan('═══ Pattern Matches ═══'));
      console.log(output.formatPatternStats(patternStats));
    }
    if (argv.stats && timeSeries.length > 0 && timeSeries.length <= 50) {
      console.log('');
      console.log(chalk.bold.cyan('═══ Time Series ═══'));
      console.log(output.formatTimeSeries(timeSeries));
    }
    if (alerts.length > 0) {
      console.log('');
      console.log(output.formatAlerts(alerts));
    }
    if (argv.output) {
      const result = { summary, patterns: patternStats, timeSeries, alerts };
      await output.writeOutput(output.toJSON(result), argv.output);
      console.log(chalk.green(`\nResults written to ${argv.output}`));
    }
  }
}

async function handleMonitor(argv) {
  const cfg = await loadAndValidateConfig(argv.config, argv.verbose);
  const sources = argv.source
    ? cfg.sources.filter(s => s.name === argv.source)
    : cfg.sources;

  if (sources.length === 0) {
    console.error(chalk.red('No matching log sources found.'));
    process.exit(1);
  }

  const patternEngine = argv.patterns ? new PatternEngine(cfg.patterns) : null;
  const statsAgg = new StatsAggregator({ windowSize: 'minute' });
  const alertDetector = argv.alerts ? new AlertDetector(cfg.alerts) : null;

  const watchers = [];
  const fileLineCounts = new Map();
  let totalLineCount = 0;
  let matchCount = 0;

  console.log(chalk.bold.cyan('═══ LogWatch Monitor ═══'));
  console.log(chalk.gray(`Watching ${sources.length} source(s)... Press Ctrl+C to stop\n`));

  for (const source of sources) {
    const files = await reader.resolveSourceFiles(source, process.cwd());
    const parse = parser.createParser(source);

    for (const file of files) {
      const dirPath = path.dirname(file.path);
      const baseName = path.basename(file.path);
      fileLineCounts.set(file.path, 0);

      try {
        const watcher = watch(dirPath, { filter: f => path.basename(f) === baseName, persistent: true }, (evt, name) => {
          if (evt === 'update') {
            handleFileUpdate(name, source, parse, patternEngine, statsAgg, alertDetector);
          }
        });
        watchers.push(watcher);
      } catch (e) {
        console.error(chalk.red(`Failed to watch ${file.path}: ${e.message}`));
      }
    }
  }

  async function handleFileUpdate(filePath, source, parse, patternEngine, statsAgg, alertDetector) {
    try {
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, source.encoding || 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      const lastLineCount = fileLineCounts.get(filePath) || 0;
      const newLines = lines.slice(Math.max(0, lastLineCount));
      fileLineCounts.set(filePath, lines.length);

      for (const line of newLines) {
        totalLineCount++;
        const parsed = parse(line);
        if (!parsed) continue;

        const ts = parsed._timestamp ? formatShort(parsed._timestamp) : dayjs().format('HH:mm:ss');
        const sourceLabel = chalk.cyan(`[${source.name}]`);
        const levelLabel = parsed._level ? formatLevel(parsed._level) : '';
        const message = (parsed.message || line).slice(0, 120);

        console.log(`${chalk.gray(ts)} ${sourceLabel} ${levelLabel} ${message}`);

        statsAgg.addRecord(parsed);

        if (patternEngine) {
          const matches = patternEngine.matchLine(parsed);
          for (const match of matches) {
            matchCount++;
            statsAgg.addPatternMatch(match);
            console.log(chalk.yellow(`  ↳ Pattern match: ${match.pattern} (${match.severity})`));
          }
        }
      }

      if (alertDetector && totalLineCount % 100 === 0) {
        const summary = statsAgg.getSummary();
        const patternStats = patternEngine ? patternEngine.getStats() : [];
        const alerts = alertDetector.evaluate(summary, patternStats);
        for (const alert of alerts) {
          console.log(output.formatAlert(alert));
        }
      }
    } catch (e) {
      if (argv.verbose) {
        console.error(chalk.red(`Error reading ${filePath}: ${e.message}`));
      }
    }
  }

  function formatShort(ts) {
    try {
      return dayjs(ts).format('HH:mm:ss');
    } catch {
      return ts;
    }
  }

  function formatLevel(level) {
    const l = level.toUpperCase();
    if (['ERROR', 'FATAL', 'CRITICAL'].includes(l)) return chalk.red(`[${l}]`);
    if (['WARN', 'WARNING'].includes(l)) return chalk.yellow(`[${l}]`);
    if (['INFO'].includes(l)) return chalk.green(`[${l}]`);
    return chalk.gray(`[${l}]`);
  }

  const gracefulShutdown = () => {
    console.log(chalk.bold.yellow('\n\nStopping monitor...'));
    for (const w of watchers) {
      w.close();
    }

    console.log(chalk.bold.cyan('═══ Monitor Summary ═══'));
    const summary = statsAgg.getSummary();
    console.log(`Lines processed: ${summary.totalLines}`);
    console.log(`Errors: ${summary.totalErrors}`);
    console.log(`Pattern matches: ${matchCount}`);

    if (patternEngine) {
      const patternStats = patternEngine.getStats().filter(p => p.count > 0);
      if (patternStats.length > 0) {
        console.log(output.formatPatternStats(patternStats));
      }
    }

    if (alertDetector) {
      const history = alertDetector.getAlertHistory();
      if (history.length > 0) {
        console.log(output.formatAlerts(history));
      }
    }

    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  await new Promise(() => {});
}

async function handleArchive(argv) {
  const cfg = await loadAndValidateConfig(argv.config, argv.verbose);
  const archiveMgr = new ArchiveManager(cfg.archive);

  if (argv.stats) {
    const stats = await archiveMgr.getArchiveStats();
    console.log(chalk.bold.cyan('═══ Archive Statistics ═══'));
    console.log(`Total files: ${stats.totalFiles}`);
    console.log(`Total size: ${stats.totalSizeHuman}`);
    console.log(`Date directories: ${stats.dateDirs.length}`);
    if (stats.dateDirs.length > 0) {
      console.log(`  Earliest: ${stats.dateDirs[0]}`);
      console.log(`  Latest: ${stats.dateDirs[stats.dateDirs.length - 1]}`);
    }
    return;
  }

  if (argv.cleanup) {
    const spinner = ora('Cleaning up old archives...').start();
    const removed = await archiveMgr.cleanup();
    spinner.succeed(`Cleaned up ${removed.length} old archive(s)`);
    for (const r of removed) {
      console.log(chalk.gray(`  Removed: ${r.removed} (${r.date})`));
    }
    return;
  }

  const sources = argv.source
    ? cfg.sources.filter(s => s.name === argv.source)
    : cfg.sources;

  if (sources.length === 0) {
    console.error(chalk.red('No matching log sources found.'));
    process.exit(1);
  }

  const spinner = ora('Archiving log files...').start();
  const allResults = [];

  for (const source of sources) {
    const files = await reader.resolveSourceFiles(source, process.cwd());
    for (const file of files) {
      const stat = await fs.stat(file.path);
      const fileDate = dayjs(stat.mtime).format('YYYY-MM-DD');

      if (argv.date && fileDate !== argv.date) continue;
      if (argv.olderThan) {
        const cutoff = dayjs().subtract(argv.olderThan, 'day');
        if (dayjs(stat.mtime).isAfter(cutoff)) continue;
      }

      try {
        spinner.text = `Archiving ${path.basename(file.path)}...`;
        const result = await archiveMgr.archiveFile(file.path, {
          cleanup: !argv.noCleanup
        });
        allResults.push(result);
      } catch (e) {
        allResults.push({ original: file.path, error: e.message });
      }
    }
  }

  if (allResults.length === 0) {
    spinner.info('No files to archive.');
    return;
  }

  const successCount = allResults.filter(r => !r.error).length;
  const errorCount = allResults.filter(r => r.error).length;
  spinner.succeed(`Archived ${successCount} file(s)${errorCount > 0 ? `, ${errorCount} error(s)` : ''}`);

  console.log(output.formatArchiveResults(allResults));

  const totalOriginal = allResults.filter(r => !r.error).reduce((s, r) => s + r.originalSize, 0);
  const totalArchived = allResults.filter(r => !r.error).reduce((s, r) => s + r.archivedSize, 0);
  if (totalOriginal > 0) {
    const ratio = ((1 - totalArchived / totalOriginal) * 100).toFixed(1);
    console.log(chalk.gray(`\nTotal: ${output.formatBytes(totalOriginal)} → ${output.formatBytes(totalArchived)} (${ratio}% compression)`));
  }
}

async function handleReport(argv) {
  const cfg = await loadAndValidateConfig(argv.config, argv.verbose);
  const sources = argv.source
    ? cfg.sources.filter(s => s.name === argv.source)
    : cfg.sources;

  if (sources.length === 0) {
    console.error(chalk.red('No matching log sources found.'));
    process.exit(1);
  }

  const patternEngine = new PatternEngine(cfg.patterns);
  const statsAgg = new StatsAggregator({ windowSize: argv.window });
  const alertDetector = new AlertDetector(cfg.alerts);
  const fromTime = parseTimeArg(argv.from);
  const toTime = parseTimeArg(argv.to);

  const spinner = ora('Generating report...').start();
  let totalLines = 0;
  const sourceData = new Map();

  for (const source of sources) {
    const files = await reader.resolveSourceFiles(source, process.cwd());
    const parse = parser.createParser(source);
    const sourceRecords = [];

    for (const file of files) {
      for await (const lineData of reader.streamLines(file.path, { encoding: source.encoding || 'utf-8' })) {
        totalLines++;
        const parsed = parse(lineData);
        if (!parsed) continue;

        if (fromTime && parsed._timestamp && parsed._timestamp < fromTime) continue;
        if (toTime && parsed._timestamp && parsed._timestamp > toTime) continue;

        statsAgg.addRecord(parsed);
        const matches = patternEngine.matchLine(parsed);
        for (const match of matches) {
          statsAgg.addPatternMatch(match);
        }

        sourceRecords.push(parsed);
      }
    }

    sourceData.set(source.name, sourceRecords);
    spinner.text = `Processing: ${totalLines.toLocaleString()} lines...`;
  }

  spinner.succeed(`Report data collected: ${totalLines.toLocaleString()} lines`);

  const summary = statsAgg.getSummary();
  const patternStats = patternEngine.getStats();
  const timeSeries = statsAgg.getTimeSeries();
  const alerts = alertDetector.evaluate(summary, patternStats);

  let content;

  if (argv.format === 'json') {
    const reportData = { generated: dayjs().toISOString(), summary, patterns: patternStats, timeSeries, alerts, sources: sources.map(s => s.name) };

    if (argv.correlate && cfg.correlation) {
      reportData.correlation = generateCorrelation(sourceData, cfg.correlation);
    }

    content = output.toJSON(reportData);
  } else if (argv.format === 'csv') {
    content = '# Pattern Stats\n' + output.patternStatsToCSV(patternStats) + '\n\n# Time Series\n' + output.timeSeriesToCSV(timeSeries);
  } else if (argv.format === 'markdown') {
    content = generateMarkdownReport(summary, patternStats, timeSeries, alerts, sources, argv);
  } else {
    content = generateMarkdownReport(summary, patternStats, timeSeries, alerts, sources, argv);
  }

  await output.writeOutput(content, argv.output);
  console.log(chalk.green(`Report written to ${argv.output}`));
}

function generateMarkdownReport(summary, patternStats, timeSeries, alerts, sources, argv) {
  let md = '# LogWatch Analysis Report\n\n';
  md += `**Generated:** ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n`;
  md += `**Sources:** ${sources.map(s => s.name).join(', ')}\n`;
  md += `**Window:** ${argv.window}\n\n`;

  md += '## Summary\n\n';
  md += `| Metric | Value |\n| --- | --- |\n`;
  md += `| Total Lines | ${summary.totalLines.toLocaleString()} |\n`;
  md += `| Total Errors | ${summary.totalErrors.toLocaleString()} |\n`;
  md += `| Error Rate | ${summary.errorRate}% |\n`;

  if (summary.responseTime && summary.responseTime.avg > 0) {
    md += `| P50 Response Time | ${output.formatMs(summary.responseTime.p50)} |\n`;
    md += `| P95 Response Time | ${output.formatMs(summary.responseTime.p95)} |\n`;
    md += `| P99 Response Time | ${output.formatMs(summary.responseTime.p99)} |\n`;
  }

  md += '\n## Pattern Matches\n\n';
  md += output.patternStatsToMarkdown(patternStats) + '\n\n';

  if (timeSeries.length > 0) {
    md += '## Time Series\n\n';
    md += output.timeSeriesToMarkdown(timeSeries.slice(0, 100)) + '\n\n';
  }

  if (alerts.length > 0) {
    md += '## Alerts\n\n';
    for (const alert of alerts) {
      md += `- **[${alert.severity.toUpperCase()}] ${alert.name}**: ${alert.metric} = ${alert.value} ${alert.comparator} ${alert.threshold} at ${alert.timestamp}\n`;
    }
    md += '\n';
  }

  return md;
}

function generateCorrelation(sourceData, correlationConfig) {
  const windowSeconds = correlationConfig.time_window_seconds || 60;
  const keys = correlationConfig.keys || [];
  const events = [];

  for (const [sourceName, records] of sourceData) {
    for (const record of records) {
      if (record._timestamp) {
        events.push({
          source: sourceName,
          timestamp: record._timestamp,
          record,
          correlationKeys: keys.reduce((acc, k) => {
            if (record[k] !== undefined) acc[k] = record[k];
            return acc;
          }, {})
        });
      }
    }
  }

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const correlated = [];
  const used = new Set();

  for (let i = 0; i < events.length; i++) {
    if (used.has(i)) continue;

    const group = { events: [events[i]], sources: [events[i].source] };

    for (let j = i + 1; j < events.length; j++) {
      if (used.has(j)) continue;

      const timeDiff = Math.abs(new Date(events[j].timestamp) - new Date(events[i].timestamp)) / 1000;
      if (timeDiff > windowSeconds) break;

      const hasMatchingKey = keys.some(k =>
        events[i].correlationKeys[k] && events[j].correlationKeys[k] &&
        events[i].correlationKeys[k] === events[j].correlationKeys[k]
      );

      if (hasMatchingKey || keys.length === 0) {
        group.events.push(events[j]);
        if (!group.sources.includes(events[j].source)) {
          group.sources.push(events[j].source);
        }
        used.add(j);
      }
    }

    if (group.sources.length > 1) {
      correlated.push({
        timestamp: events[i].timestamp,
        sources: group.sources,
        eventCount: group.events.length,
        events: group.events.map(e => ({ source: e.source, timestamp: e.timestamp, keys: e.correlationKeys }))
      });
    }
  }

  return {
    totalCorrelations: correlated.length,
    windowSeconds,
    keys,
    correlations: correlated.slice(0, 100)
  };
}

async function handleConfigInit(argv) {
  const configPath = path.resolve(argv.config);
  const exists = await fs.pathExists(configPath);

  if (exists && !argv.force) {
    console.error(chalk.yellow(`Configuration file already exists: ${configPath}`));
    console.error(chalk.gray('Use --force to overwrite.'));
    process.exit(1);
  }

  const yamlContent = config.generateDefaultConfigYaml();
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeFile(configPath, yamlContent, 'utf-8');

  console.log(chalk.green(`Configuration file created: ${configPath}`));
  console.log(chalk.gray('Edit this file to customize your log sources, patterns, and alert rules.'));
}

async function handleConfigValidate(argv) {
  try {
    const cfg = await config.loadConfig(argv.config);
    console.log(chalk.green('✓ Configuration is valid'));
    console.log(`  Sources: ${cfg.sources.length}`);
    console.log(`  Patterns: ${cfg.patterns.length}`);
    console.log(`  Alerts: ${cfg.alerts.length}`);
    console.log(`  Archive: ${cfg.archive.path} (retention: ${cfg.archive.retention_days} days)`);
  } catch (e) {
    console.error(chalk.red('✗ Configuration validation failed'));
    console.error(chalk.red(`  ${e.message}`));
    process.exit(1);
  }
}

async function handleConfigShow(argv) {
  try {
    const cfg = await config.loadConfig(argv.config);
    console.log(output.toJSON(cfg));
  } catch (e) {
    console.error(chalk.red(`Failed to load config: ${e.message}`));
    process.exit(1);
  }
}

function main() {
  const cli = buildCLI();
  cli.parse();
}

main();
