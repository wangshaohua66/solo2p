const fs = require('fs');
const path = require('path');
const { MigrationError } = require('./errors');
const Validator = require('./validator');

const validator = new Validator();

class MigrationManager {
  constructor(options = {}) {
    this.migrationDir = options.migrationDir || 'migrations';
    this.versionTable = options.versionTable || 'schema_migrations';
    this.db = options.db;
  }

  discoverMigrations() {
    const resolvedDir = path.resolve(this.migrationDir);
    validator.validateDirectory(resolvedDir);

    const files = fs.readdirSync(resolvedDir)
      .filter(f => f.endsWith('.js'))
      .sort();

    const migrations = [];
    const seenVersions = new Set();

    for (const file of files) {
      try {
        validator.validateMigrationFileName(file);
      } catch (err) {
        continue;
      }

      const version = file.substring(0, 14);
      const name = file.substring(15, file.length - 3);

      if (seenVersions.has(version)) {
        throw new MigrationError(
          'VERSION_CONFLICT',
          `Duplicate migration version "${version}" detected. Files: ${files.filter(f => f.startsWith(version)).join(', ')}`,
          { version, files: files.filter(f => f.startsWith(version)) }
        );
      }
      seenVersions.add(version);

      const filePath = path.join(resolvedDir, file);
      let migration = null;
      let dependencies = [];
      let syntaxValid = true;
      let syntaxError = null;

      try {
        validator.validateMigrationScript(filePath);
        migration = require(filePath);
        dependencies = migration.dependencies || [];
      } catch (err) {
        syntaxValid = false;
        syntaxError = err.message;
      }

      migrations.push({
        version,
        name,
        fileName: file,
        filePath,
        migration,
        dependencies,
        syntaxValid,
        syntaxError,
      });
    }

    return migrations;
  }

  getStatus() {
    const localMigrations = this.discoverMigrations();
    const appliedMigrations = this.db ? [] : [];

    return {
      local: localMigrations,
      applied: appliedMigrations,
      pending: [],
      conflicts: [],
    };
  }

  async getFullStatus() {
    const localMigrations = this.discoverMigrations();

    if (!this.db || !this.db.connected) {
      return {
        local: localMigrations,
        applied: [],
        pending: localMigrations.map(m => ({ ...m, status: 'pending' })),
        conflicts: [],
      };
    }

    let appliedRecords = [];
    try {
      await this.db.ensureVersionTable(this.versionTable);
      appliedRecords = await this.db.getAppliedMigrations(this.versionTable);
    } catch (err) {
      throw new MigrationError(
        'QUERY_FAILED',
        `Failed to query migration status: ${err.message}`,
        { originalError: err.message }
      );
    }

    const appliedMap = new Map();
    for (const record of appliedRecords) {
      appliedMap.set(record.version, record);
    }

    const pending = [];
    const applied = [];
    const conflicts = [];

    for (const migration of localMigrations) {
      if (appliedMap.has(migration.version)) {
        const record = appliedMap.get(migration.version);
        applied.push({
          ...migration,
          status: 'applied',
          executedAt: record.executed_at,
          executionTimeMs: record.execution_time_ms,
        });
        appliedMap.delete(migration.version);
      } else if (!migration.syntaxValid) {
        conflicts.push({
          ...migration,
          status: 'conflict',
          reason: `Syntax error: ${migration.syntaxError}`,
        });
      } else {
        pending.push({
          ...migration,
          status: 'pending',
        });
      }
    }

    for (const [, record] of appliedMap) {
      conflicts.push({
        version: record.version,
        name: record.name,
        fileName: null,
        filePath: null,
        status: 'conflict',
        reason: 'Applied in database but migration file is missing locally',
        executedAt: record.executed_at,
      });
    }

    return { local: localMigrations, applied, pending, conflicts };
  }

  sortMigrations(migrations) {
    const sorted = [...migrations].sort((a, b) => a.version.localeCompare(b.version));

    const dependencyGraph = new Map();
    for (const m of sorted) {
      dependencyGraph.set(m.version, m.dependencies || []);
    }

    this._detectCircularDependencies(dependencyGraph);

    return this._topologicalSort(sorted, dependencyGraph);
  }

  _detectCircularDependencies(dependencyGraph) {
    const visited = new Set();
    const recursionStack = new Set();
    const cyclePath = [];

    const dfs = (version) => {
      visited.add(version);
      recursionStack.add(version);
      cyclePath.push(version);

      const deps = dependencyGraph.get(version) || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          if (dfs(dep)) return true;
        } else if (recursionStack.has(dep)) {
          cyclePath.push(dep);
          throw new MigrationError(
            'VERSION_CONFLICT',
            `Circular dependency detected: ${cyclePath.join(' -> ')}`,
            { cyclePath: [...cyclePath] }
          );
        }
      }

      recursionStack.delete(version);
      cyclePath.pop();
      return false;
    };

    for (const version of dependencyGraph.keys()) {
      if (!visited.has(version)) {
        dfs(version);
      }
    }
  }

  _topologicalSort(migrations, dependencyGraph) {
    const migrationMap = new Map();
    for (const m of migrations) {
      migrationMap.set(m.version, m);
    }

    const result = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (version) => {
      if (visited.has(version)) return;
      if (visiting.has(version)) return;

      visiting.add(version);

      const deps = dependencyGraph.get(version) || [];
      for (const dep of deps) {
        if (migrationMap.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(version);
      visited.add(version);

      const migration = migrationMap.get(version);
      if (migration) {
        result.push(migration);
      }
    };

    const sortedByVersion = [...migrations].sort((a, b) => a.version.localeCompare(b.version));
    for (const m of sortedByVersion) {
      visit(m.version);
    }

    return result;
  }

  generateTimestamp() {
    const now = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  generateMigrationFilePath(name, migrationDir) {
    const version = this.generateTimestamp();
    validator.validateMigrationName(name);
    validator.checkFileNameConflict(version, migrationDir || this.migrationDir);

    const fileName = `${version}_${name}.js`;
    const dir = migrationDir || this.migrationDir;
    const resolvedDir = path.resolve(dir);

    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    }

    return {
      version,
      fileName,
      filePath: path.join(resolvedDir, fileName),
    };
  }
}

module.exports = MigrationManager;
