const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const Logger = require('./logger');

const K8S_RESOURCE_TYPES = [
  'Deployment',
  'Service',
  'ConfigMap',
  'Secret',
  'Ingress',
  'StatefulSet',
  'DaemonSet',
  'Job',
  'CronJob',
  'PersistentVolumeClaim',
  'HorizontalPodAutoscaler',
  'NetworkPolicy',
];

class ConfigLoader {
  constructor(options = {}) {
    this.logger = options.logger || new Logger({ quiet: true });
    this.maxDepth = options.maxDepth || 10;
    this.rootDir = null;
    this.configTree = {};
    this.allConfigs = [];
  }

  scan(baseDir) {
    const startTime = Date.now();
    this.rootDir = path.resolve(baseDir);
    this.configTree = {
      projects: {},
      totalFiles: 0,
      scanPath: this.rootDir,
    };
    this.allConfigs = [];

    this.scanDirectory(this.rootDir, 0);

    const elapsed = Date.now() - startTime;
    this.logger.debug(`Scanned ${this.configTree.totalFiles} files in ${elapsed}ms`);
    return this;
  }

  scanDirectory(dir, depth) {
    if (depth > this.maxDepth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      this.logger.warn(`Cannot read directory: ${dir}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        this.scanDirectory(fullPath, depth + 1);
      } else if (entry.isFile()) {
        if (this.isConfigFile(entry.name)) {
          this.loadConfigFile(fullPath);
        }
      }
    }
  }

  isConfigFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ext === '.yaml' || ext === '.yml' || ext === '.json';
  }

  loadConfigFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const docs = this.parseContent(content, filePath);

      for (const doc of docs) {
        if (!doc || typeof doc !== 'object') continue;

        const resourceType = doc.kind;
        if (!resourceType || !K8S_RESOURCE_TYPES.includes(resourceType)) continue;

        const config = this.buildConfigObject(doc, filePath);
        this.addToTree(config);
        this.allConfigs.push(config);
        this.configTree.totalFiles++;
      }
    } catch (err) {
      this.logger.warn(`Failed to parse ${filePath}: ${err.message}`);
    }
  }

  parseContent(content, filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      try {
        return [JSON.parse(content)];
      } catch (e) {
        return [];
      }
    }

    try {
      const docs = [];
      yaml.loadAll(content, (doc) => {
        if (doc) docs.push(doc);
      });
      return docs.length > 0 ? docs : [];
    } catch (e) {
      return [];
    }
  }

  buildConfigObject(doc, filePath) {
    const relativePath = path.relative(this.rootDir, filePath);
    const pathParts = relativePath.split(path.sep);

    let project = 'default';
    let env = 'default';

    if (pathParts.length >= 2) {
      project = pathParts[0];
    }
    if (pathParts.length >= 3) {
      const secondPart = pathParts[1].toLowerCase();
      if (['dev', 'development', 'test', 'testing', 'staging', 'pre', 'prod', 'production'].includes(secondPart)) {
        env = this.normalizeEnvName(secondPart);
      }
    }

    const name = doc.metadata ? doc.metadata.name : 'unknown';
    const labels = doc.metadata ? doc.metadata.labels || {} : {};
    const namespace = doc.metadata ? doc.metadata.namespace || 'default' : 'default';

    return {
      project,
      env,
      resourceType: doc.kind,
      name,
      namespace,
      labels,
      filePath,
      relativePath,
      content: doc,
    };
  }

  normalizeEnvName(env) {
    const map = {
      dev: 'dev',
      development: 'dev',
      test: 'test',
      testing: 'test',
      staging: 'staging',
      pre: 'staging',
      prod: 'prod',
      production: 'prod',
    };
    return map[env] || env;
  }

  addToTree(config) {
    const { project, env, resourceType, name } = config;

    if (!this.configTree.projects[project]) {
      this.configTree.projects[project] = { environments: {} };
    }
    if (!this.configTree.projects[project].environments[env]) {
      this.configTree.projects[project].environments[env] = { resources: {} };
    }
    if (!this.configTree.projects[project].environments[env].resources[resourceType]) {
      this.configTree.projects[project].environments[env].resources[resourceType] = {};
    }

    this.configTree.projects[project].environments[env].resources[resourceType][name] = config;
  }

  getIndexTree() {
    return this.configTree;
  }

  getAllConfigs() {
    return this.allConfigs;
  }

  getConfigByProject(project) {
    return this.allConfigs.filter((c) => c.project === project);
  }

  getConfigByEnv(env) {
    return this.allConfigs.filter((c) => c.env === env);
  }

  getConfigByProjectAndEnv(project, env) {
    return this.allConfigs.filter((c) => c.project === project && c.env === env);
  }

  getConfigByType(resourceType) {
    return this.allConfigs.filter((c) => c.resourceType === resourceType);
  }

  query(options = {}) {
    let results = [...this.allConfigs];

    if (options.project) {
      const regex = new RegExp(options.project);
      results = results.filter((c) => regex.test(c.project));
    }

    if (options.service) {
      const regex = new RegExp(options.service);
      results = results.filter((c) => regex.test(c.name));
    }

    if (options.env) {
      results = results.filter((c) => c.env === options.env);
    }

    if (options.resourceType) {
      results = results.filter((c) => c.resourceType === options.resourceType);
    }

    if (options.labels && typeof options.labels === 'object') {
      results = results.filter((c) => {
        return Object.entries(options.labels).every(
          ([key, value]) => c.labels && c.labels[key] === value
        );
      });
    }

    if (options.namespace) {
      results = results.filter((c) => c.namespace === options.namespace);
    }

    return results;
  }

  getFieldValue(config, fieldPath) {
    const parts = fieldPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let current = config.content;

    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }

    return current;
  }

  renderTree() {
    const tree = this.configTree;
    const lines = [];

    lines.push(`📁 ${path.basename(tree.scanPath)}`);
    lines.push(`   Total: ${tree.totalFiles} configuration files`);
    lines.push('');

    for (const [projectName, projectData] of Object.entries(tree.projects)) {
      lines.push(`📂 ${projectName}/`);

      for (const [envName, envData] of Object.entries(projectData.environments)) {
        lines.push(`  📂 ${envName}/`);

        for (const [resourceType, resources] of Object.entries(envData.resources)) {
          const count = Object.keys(resources).length;
          lines.push(`    📦 ${resourceType} (${count})`);

          for (const resourceName of Object.keys(resources)) {
            lines.push(`      └─ ${resourceName}`);
          }
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

module.exports = ConfigLoader;
module.exports.K8S_RESOURCE_TYPES = K8S_RESOURCE_TYPES;
