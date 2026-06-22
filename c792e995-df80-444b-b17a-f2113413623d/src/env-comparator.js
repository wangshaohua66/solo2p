const { diffLines, diffJson } = require('diff');
const yaml = require('js-yaml');
const chalk = require('chalk');
const Logger = require('./logger');

const KEY_FIELDS = [
  'spec.template.spec.containers[*].image',
  'spec.replicas',
  'spec.template.spec.containers[*].resources',
  'spec.template.spec.containers[*].env',
  'spec.template.spec.containers[*].volumeMounts',
  'spec.template.spec.volumes',
  'spec.selector',
  'spec.ports',
  'metadata.labels',
  'metadata.annotations',
];

class EnvComparator {
  constructor(options = {}) {
    this.logger = options.logger || new Logger({ quiet: true });
  }

  compare(configs1, configs2, env1, env2) {
    const startTime = Date.now();
    const report = {
      env1,
      env2,
      totalInEnv1: configs1.length,
      totalInEnv2: configs2.length,
      differences: [],
      onlyInEnv1: [],
      onlyInEnv2: [],
      byResourceType: {},
    };

    const map1 = this.buildConfigMap(configs1);
    const map2 = this.buildConfigMap(configs2);

    const allKeys = new Set([...Object.keys(map1), ...Object.keys(map2)]);

    for (const key of allKeys) {
      const c1 = map1[key];
      const c2 = map2[key];

      if (c1 && !c2) {
        report.onlyInEnv1.push(this.summarize(c1));
        this.addToByType(report, c1.resourceType, 'onlyInEnv1', c1);
      } else if (!c1 && c2) {
        report.onlyInEnv2.push(this.summarize(c2));
        this.addToByType(report, c2.resourceType, 'onlyInEnv2', c2);
      } else if (c1 && c2) {
        const diffResult = this.compareConfigs(c1, c2);
        if (diffResult.hasDifferences) {
          report.differences.push(diffResult);
          this.addToByType(report, c1.resourceType, 'modified', diffResult);
        }
      }
    }

    report.elapsed = Date.now() - startTime;
    report.totalDifferences = report.differences.length;
    return report;
  }

  buildConfigMap(configs) {
    const map = {};
    for (const config of configs) {
      const key = `${config.resourceType}:${config.namespace}:${config.name}`;
      map[key] = config;
    }
    return map;
  }

  summarize(config) {
    return {
      project: config.project,
      env: config.env,
      resourceType: config.resourceType,
      namespace: config.namespace,
      name: config.name,
      filePath: config.relativePath,
    };
  }

  addToByType(report, resourceType, category, data) {
    if (!report.byResourceType[resourceType]) {
      report.byResourceType[resourceType] = {
        modified: [],
        onlyInEnv1: [],
        onlyInEnv2: [],
      };
    }
    report.byResourceType[resourceType][category].push(data);
  }

  compareConfigs(config1, config2) {
    const result = {
      project: config1.project,
      resourceType: config1.resourceType,
      namespace: config1.namespace,
      name: config1.name,
      filePath1: config1.relativePath,
      filePath2: config2.relativePath,
      fieldDifferences: [],
      hasDifferences: false,
      isCritical: false,
    };

    for (const fieldPath of KEY_FIELDS) {
      const values1 = this.extractValues(config1.content, fieldPath);
      const values2 = this.extractValues(config2.content, fieldPath);

      const str1 = JSON.stringify(values1, null, 2);
      const str2 = JSON.stringify(values2, null, 2);

      if (str1 !== str2) {
        const fieldDiff = {
          field: fieldPath,
          value1: values1,
          value2: values2,
          isCritical: this.isCriticalField(fieldPath),
        };
        result.fieldDifferences.push(fieldDiff);
        result.hasDifferences = true;
        if (fieldDiff.isCritical) {
          result.isCritical = true;
        }
      }
    }

    if (JSON.stringify(config1.content) !== JSON.stringify(config2.content)) {
      result.fullDiff = this.generateFullDiff(config1.content, config2.content);
    }

    return result;
  }

  extractValues(obj, path) {
    const patterns = path.split('[*]');
    let results = [obj];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i].replace(/^\./, '');
      const isArrayWildcard = i < patterns.length - 1;

      const newResults = [];
      for (const result of results) {
        if (result === undefined || result === null) continue;

        if (pattern && !isArrayWildcard) {
          const value = this.getNestedValue(result, pattern);
          if (value !== undefined) newResults.push(value);
        } else if (pattern && isArrayWildcard) {
          const arr = this.getNestedValue(result, pattern);
          if (Array.isArray(arr)) {
            newResults.push(...arr);
          }
        } else if (!pattern && isArrayWildcard) {
          if (Array.isArray(result)) {
            newResults.push(...result);
          }
        }
      }
      results = newResults;
    }

    if (results.length === 0) return undefined;
    if (results.length === 1) return results[0];
    return results;
  }

  getNestedValue(obj, path) {
    const parts = path.split('.').filter(Boolean);
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  isCriticalField(fieldPath) {
    return (
      fieldPath.includes('.image') ||
      fieldPath.includes('replicas') ||
      fieldPath.includes('resources') ||
      fieldPath.includes('.env')
    );
  }

  generateFullDiff(obj1, obj2) {
    const json1 = JSON.stringify(obj1, null, 2);
    const json2 = JSON.stringify(obj2, null, 2);
    return diffLines(json1, json2);
  }

  renderSideBySide(config1, config2) {
    const yaml1 = yaml.dump(config1.content, { lineWidth: -1 });
    const yaml2 = yaml.dump(config2.content, { lineWidth: -1 });

    const lines1 = yaml1.split('\n');
    const lines2 = yaml2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);

    const leftWidth = 50;
    const result = [];

    result.push(
      `${chalk.cyan('Env 1: ' + config1.env).padEnd(leftWidth)}${chalk.cyan(
        'Env 2: ' + config2.env
      )}`
    );
    result.push('─'.repeat(leftWidth * 2));

    for (let i = 0; i < maxLines; i++) {
      const line1 = (lines1[i] || '').padEnd(leftWidth - 2);
      const line2 = lines2[i] || '';

      if (lines1[i] === lines2[i]) {
        result.push(`${chalk.gray(line1)}  ${chalk.gray(line2)}`);
      } else if (!lines1[i]) {
        result.push(`${chalk.gray(' '.repeat(leftWidth - 2))}  ${chalk.green('+ ' + line2)}`);
      } else if (!lines2[i]) {
        result.push(`${chalk.red('- ' + line1.slice(0, leftWidth - 4))}  ${chalk.gray('')}`);
      } else {
        result.push(`${chalk.red('- ' + line1.slice(0, leftWidth - 4))}  ${chalk.green('+ ' + line2)}`);
      }
    }

    return result.join('\n');
  }

  renderReport(report, options = {}) {
    const lines = [];
    const { format = 'text' } = options;

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    lines.push(chalk.cyan('='.repeat(70)));
    lines.push(
      chalk.cyan(`  Environment Comparison: ${report.env1} ↔ ${report.env2}`)
    );
    lines.push(chalk.cyan('='.repeat(70)));
    lines.push('');

    lines.push(
      `Total configs in ${report.env1}: ${report.totalInEnv1}`
    );
    lines.push(
      `Total configs in ${report.env2}: ${report.totalInEnv2}`
    );
    lines.push(
      chalk.yellow(`Differences found: ${report.totalDifferences}`)
    );
    lines.push(
      chalk.red(`Only in ${report.env1}: ${report.onlyInEnv1.length}`)
    );
    lines.push(
      chalk.green(`Only in ${report.env2}: ${report.onlyInEnv2.length}`)
    );
    lines.push(`Duration: ${report.elapsed}ms`);
    lines.push('');

    if (report.onlyInEnv1.length > 0) {
      lines.push(chalk.red(`── Configs only in ${report.env1} ──`));
      for (const item of report.onlyInEnv1) {
        lines.push(
          `  ${chalk.red('-')} [${item.resourceType}] ${item.namespace}/${item.name}`
        );
        lines.push(`      ${item.filePath}`);
      }
      lines.push('');
    }

    if (report.onlyInEnv2.length > 0) {
      lines.push(chalk.green(`── Configs only in ${report.env2} ──`));
      for (const item of report.onlyInEnv2) {
        lines.push(
          `  ${chalk.green('+')} [${item.resourceType}] ${item.namespace}/${item.name}`
        );
        lines.push(`      ${item.filePath}`);
      }
      lines.push('');
    }

    if (report.differences.length > 0) {
      lines.push(chalk.yellow('── Modified Configs ──'));
      lines.push('');

      for (const diff of report.differences) {
        const criticalMark = diff.isCritical ? chalk.red(' ⚠ CRITICAL') : '';
        lines.push(
          chalk.bold(
            `  [${diff.resourceType}] ${diff.namespace}/${diff.name}${criticalMark}`
          )
        );

        for (const fieldDiff of diff.fieldDifferences) {
          const mark = fieldDiff.isCritical ? chalk.red('  !') : chalk.yellow('  ~');
          lines.push(`${mark} ${fieldDiff.field}`);
          const v1 =
            typeof fieldDiff.value1 === 'object'
              ? JSON.stringify(fieldDiff.value1)
              : String(fieldDiff.value1);
          const v2 =
            typeof fieldDiff.value2 === 'object'
              ? JSON.stringify(fieldDiff.value2)
              : String(fieldDiff.value2);
          lines.push(
            `      ${chalk.red('-')} ${this.truncate(v1, 60)}`
          );
          lines.push(
            `      ${chalk.green('+')} ${this.truncate(v2, 60)}`
          );
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
  }
}

module.exports = EnvComparator;
