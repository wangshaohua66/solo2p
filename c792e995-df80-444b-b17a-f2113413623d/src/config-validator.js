const path = require('path');
const fs = require('fs-extra');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const chalk = require('chalk');
const Logger = require('./logger');

class ConfigValidator {
  constructor(options = {}) {
    this.logger = options.logger || new Logger({ quiet: true });
    this.schemaDir = options.schemaDir || path.join(__dirname, '..', 'schemas');
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      schemas: this.loadSchemas(),
    });
    addFormats(this.ajv);
  }

  loadSchemas() {
    const schemas = [];
    if (!fs.existsSync(this.schemaDir)) return schemas;

    const files = fs.readdirSync(this.schemaDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const schemaPath = path.join(this.schemaDir, file);
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        schemas.push(schema);
      } catch (err) {
        this.logger.warn(`Failed to load schema ${file}: ${err.message}`);
      }
    }
    return schemas;
  }

  validate(config) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      resourceType: config.resourceType,
      name: config.name,
      namespace: config.namespace,
      filePath: config.relativePath,
    };

    result.errors.push(...this.validateStructure(config.content));
    result.warnings.push(...this.validateBestPractices(config));

    const schemaKey = config.resourceType.toLowerCase();
    const validate = this.ajv.getSchema(undefined);
    if (validate) {
      try {
        const valid = validate(config.content);
        if (!valid && validate.errors) {
          for (const err of validate.errors) {
            result.errors.push({
              field: err.instancePath || '/',
              message: err.message,
              suggestion: this.getSuggestion(err),
              severity: 'error',
            });
          }
        }
      } catch (e) {
        // Schema validation may fail for unsupported resource types
      }
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  validateAll(configs) {
    const results = [];
    let validCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (const config of configs) {
      const result = this.validate(config);
      results.push(result);
      if (result.valid) validCount++;
      errorCount += result.errors.length;
      warningCount += result.warnings.length;
    }

    return {
      total: results.length,
      valid: validCount,
      errors: errorCount,
      warnings: warningCount,
      results,
    };
  }

  validateStructure(content) {
    const errors = [];

    if (!content.apiVersion) {
      errors.push({
        field: '/apiVersion',
        message: 'missing required field: apiVersion',
        suggestion: 'Add apiVersion such as "apps/v1" or "v1"',
        severity: 'error',
      });
    }

    if (!content.kind) {
      errors.push({
        field: '/kind',
        message: 'missing required field: kind',
        suggestion: 'Add kind such as "Deployment" or "Service"',
        severity: 'error',
      });
    }

    if (!content.metadata) {
      errors.push({
        field: '/metadata',
        message: 'missing required field: metadata',
        suggestion: 'Add metadata section with at least "name"',
        severity: 'error',
      });
    } else if (!content.metadata.name) {
      errors.push({
        field: '/metadata/name',
        message: 'missing required field: metadata.name',
        suggestion: 'Add a name for this resource',
        severity: 'error',
      });
    }

    return errors;
  }

  validateBestPractices(config) {
    const warnings = [];
    const content = config.content;

    if (content.kind === 'Deployment') {
      if (content.spec && content.spec.template && content.spec.template.spec) {
        const containers = content.spec.template.spec.containers || [];
        for (let i = 0; i < containers.length; i++) {
          const container = containers[i];
          if (!container.resources) {
            warnings.push({
              field: `/spec/template/spec/containers/${i}/resources`,
              message: 'container does not specify resource requests/limits',
              suggestion: 'Add resources.requests and resources.limits for CPU and memory',
              severity: 'warning',
            });
          }
          if (!container.imagePullPolicy) {
            warnings.push({
              field: `/spec/template/spec/containers/${i}/imagePullPolicy`,
              message: 'imagePullPolicy not specified',
              suggestion: 'Set imagePullPolicy to "Always" for latest tags or "IfNotPresent" for versioned tags',
              severity: 'warning',
            });
          }
          if (container.image && container.image.endsWith(':latest')) {
            warnings.push({
              field: `/spec/template/spec/containers/${i}/image`,
              message: 'using :latest tag is not recommended for production',
              suggestion: 'Use a specific version tag or digest instead',
              severity: 'warning',
            });
          }
        }
      }
      if (content.spec && typeof content.spec.replicas === 'undefined') {
        warnings.push({
          field: '/spec/replicas',
          message: 'replicas not specified, defaulting to 1',
          suggestion: 'Explicitly set the number of replicas',
          severity: 'warning',
        });
      }
    }

    if (content.kind === 'Service') {
      if (content.spec && content.spec.type === 'LoadBalancer') {
        warnings.push({
          field: '/spec/type',
          message: 'LoadBalancer type may incur cloud costs',
          suggestion: 'Consider using Ingress for HTTP traffic instead',
          severity: 'warning',
        });
      }
    }

    return warnings;
  }

  getSuggestion(ajvError) {
    const { keyword, params, instancePath } = ajvError;

    if (keyword === 'required') {
      return `Add the missing required field: "${params.missingProperty}"`;
    }
    if (keyword === 'type') {
      return `Ensure field ${instancePath} is of type "${params.type}"`;
    }
    if (keyword === 'enum') {
      return `Use one of the allowed values: ${params.allowedValues.join(', ')}`;
    }
    if (keyword === 'minimum' || keyword === 'maximum') {
      return `Ensure value is within the valid range`;
    }
    if (keyword === 'pattern') {
      return `Ensure value matches the required naming pattern`;
    }
    return 'Check Kubernetes documentation for field requirements';
  }

  renderReport(report, options = {}) {
    const { format = 'text' } = options;

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    const lines = [];

    lines.push(chalk.cyan('='.repeat(70)));
    lines.push(chalk.cyan('  Validation Report'));
    lines.push(chalk.cyan('='.repeat(70)));
    lines.push('');

    lines.push(`Total files checked: ${report.total}`);
    lines.push(chalk.green(`Valid: ${report.valid}`));
    lines.push(chalk.red(`Errors: ${report.errors}`));
    lines.push(chalk.yellow(`Warnings: ${report.warnings}`));
    lines.push('');

    for (const result of report.results) {
      if (result.valid && result.warnings.length === 0) continue;

      const status = result.valid
        ? chalk.yellow('⚠  WARN')
        : chalk.red('✗ FAIL');
      lines.push(
        `${status} [${result.resourceType}] ${result.namespace}/${result.name}`
      );
      lines.push(`   ${result.filePath}`);

      for (const err of result.errors) {
        lines.push(chalk.red(`   ERROR: ${err.field}`));
        lines.push(chalk.red(`     ${err.message}`));
        lines.push(chalk.blue(`     Suggestion: ${err.suggestion}`));
      }

      for (const warn of result.warnings) {
        lines.push(chalk.yellow(`   WARN:  ${warn.field}`));
        lines.push(chalk.yellow(`     ${warn.message}`));
        lines.push(chalk.blue(`     Suggestion: ${warn.suggestion}`));
      }
      lines.push('');
    }

    if (report.errors === 0 && report.warnings === 0) {
      lines.push(chalk.green('All configurations are valid!'));
    }

    return lines.join('\n');
  }
}

module.exports = ConfigValidator;
