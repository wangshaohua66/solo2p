const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const DatabaseError = require('./errors').DatabaseError;

class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.driver = config.driver;
    this.pool = null;
    this.connected = false;
  }

  async connect() {
    try {
      switch (this.driver) {
        case 'mysql':
          this.pool = mysql.createPool({
            host: this.config.host,
            port: this.config.port,
            user: this.config.user,
            password: this.config.password,
            database: this.config.database,
            charset: this.config.charset || 'utf8mb4',
            connectionLimit: this.config.connectionLimit || 10,
            waitForConnections: true,
            queueLimit: 0,
          });
          const conn = await this.pool.getConnection();
          conn.release();
          break;

        case 'postgresql':
          this.pool = new Pool({
            host: this.config.host,
            port: this.config.port,
            user: this.config.user,
            password: this.config.password,
            database: this.config.database,
            max: this.config.connectionLimit || 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
          });
          const client = await this.pool.connect();
          client.release();
          break;

        case 'sqlite':
          const BetterSqlite3 = require('better-sqlite3');
          this.pool = new BetterSqlite3(this.config.database, {
            verbose: this.config.verbose || null,
          });
          this.pool.pragma('journal_mode = WAL');
          break;

        default:
          throw new DatabaseError(
            `UNSUPPORTED_DRIVER`,
            `Unsupported database driver: ${this.driver}. Supported: mysql, postgresql, sqlite`
          );
      }
      this.connected = true;
      return true;
    } catch (err) {
      throw new DatabaseError(
        `CONNECTION_FAILED`,
        `Failed to connect to ${this.driver} database: ${err.message}`,
        { originalError: err.message, config: this._sanitizeConfig() }
      );
    }
  }

  async query(sql, params = []) {
    if (!this.connected) {
      await this.connect();
    }

    try {
      switch (this.driver) {
        case 'mysql': {
          const [rows] = await this.pool.execute(sql, params);
          return rows;
        }
        case 'postgresql': {
          const { rows } = await this.pool.query(sql, params);
          return rows;
        }
        case 'sqlite': {
          const trimmed = sql.trim();
          const upper = trimmed.toUpperCase();
          if (params.length === 0 && (upper.includes(';') && this._isMultipleStatements(trimmed))) {
            this.pool.exec(trimmed);
            return { changes: 0 };
          }
          const stmt = this.pool.prepare(trimmed);
          if (upper.startsWith('SELECT')) {
            return stmt.all(...params);
          }
          return { changes: stmt.run(...params).changes };
        }
        default:
          throw new DatabaseError(`UNSUPPORTED_DRIVER`, `Driver not supported: ${this.driver}`);
      }
    } catch (err) {
      throw new DatabaseError(
        `QUERY_FAILED`,
        `Query execution failed: ${err.message}`,
        { sql, params, originalError: err.message }
      );
    }
  }

  _isMultipleStatements(sql) {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === ';' && !inSingle && !inDouble) {
        const rest = sql.substring(i + 1).trim();
        if (rest.length > 0) return true;
      }
    }
    return false;
  }

  async beginTransaction() {
    if (!this.connected) {
      await this.connect();
    }
    try {
      switch (this.driver) {
        case 'mysql':
          this._transactionConn = await this.pool.getConnection();
          await this._transactionConn.beginTransaction();
          break;
        case 'postgresql':
          this._transactionClient = await this.pool.connect();
          await this._transactionClient.query('BEGIN');
          break;
        case 'sqlite':
          this.pool.exec('BEGIN TRANSACTION');
          break;
      }
    } catch (err) {
      throw new DatabaseError(
        `TRANSACTION_BEGIN_FAILED`,
        `Failed to begin transaction: ${err.message}`,
        { originalError: err.message }
      );
    }
  }

  async executeInTransaction(sql, params = []) {
    try {
      switch (this.driver) {
        case 'mysql': {
          const [rows] = await this._transactionConn.execute(sql, params);
          return rows;
        }
        case 'postgresql': {
          const { rows } = await this._transactionClient.query(sql, params);
          return rows;
        }
        case 'sqlite': {
          const trimmed = sql.trim();
          const upper = trimmed.toUpperCase();
          if (params.length === 0 && (upper.includes(';') && this._isMultipleStatements(trimmed))) {
            this.pool.exec(trimmed);
            return { changes: 0 };
          }
          const stmt = this.pool.prepare(trimmed);
          if (upper.startsWith('SELECT')) {
            return stmt.all(...params);
          }
          return { changes: stmt.run(...params).changes };
        }
        default:
          throw new DatabaseError(`UNSUPPORTED_DRIVER`, `Driver not supported: ${this.driver}`);
      }
    } catch (err) {
      throw new DatabaseError(
        `TRANSACTION_QUERY_FAILED`,
        `Query in transaction failed: ${err.message}`,
        { sql, originalError: err.message }
      );
    }
  }

  async commitTransaction() {
    try {
      switch (this.driver) {
        case 'mysql':
          await this._transactionConn.commit();
          this._transactionConn.release();
          this._transactionConn = null;
          break;
        case 'postgresql':
          await this._transactionClient.query('COMMIT');
          this._transactionClient.release();
          this._transactionClient = null;
          break;
        case 'sqlite':
          this.pool.exec('COMMIT');
          break;
      }
    } catch (err) {
      throw new DatabaseError(
        `TRANSACTION_COMMIT_FAILED`,
        `Failed to commit transaction: ${err.message}`,
        { originalError: err.message }
      );
    }
  }

  async rollbackTransaction() {
    try {
      switch (this.driver) {
        case 'mysql':
          if (this._transactionConn) {
            await this._transactionConn.rollback();
            this._transactionConn.release();
            this._transactionConn = null;
          }
          break;
        case 'postgresql':
          if (this._transactionClient) {
            await this._transactionClient.query('ROLLBACK');
            this._transactionClient.release();
            this._transactionClient = null;
          }
          break;
        case 'sqlite':
          this.pool.exec('ROLLBACK');
          break;
      }
    } catch (err) {
      throw new DatabaseError(
        `TRANSACTION_ROLLBACK_FAILED`,
        `Failed to rollback transaction: ${err.message}`,
        { originalError: err.message }
      );
    }
  }

  async ensureVersionTable(tableName) {
    const createTableSQL = this._getCreateVersionTableSQL(tableName);
    try {
      await this.query(createTableSQL);
      return true;
    } catch (err) {
      throw new DatabaseError(
        `VERSION_TABLE_CREATE_FAILED`,
        `Failed to create schema version table "${tableName}": ${err.message}`,
        { tableName, originalError: err.message }
      );
    }
  }

  async getAppliedMigrations(tableName) {
    const sql = `SELECT version, name, executed_at, execution_time_ms FROM ${tableName} ORDER BY version ASC`;
    try {
      return await this.query(sql);
    } catch (err) {
      throw new DatabaseError(
        `MIGRATION_HISTORY_QUERY_FAILED`,
        `Failed to query migration history: ${err.message}`,
        { tableName, originalError: err.message }
      );
    }
  }

  async recordMigration(tableName, version, name, executionTimeMs) {
    const sqlMap = {
      mysql: `INSERT INTO ${tableName} (version, name, executed_at, execution_time_ms) VALUES (?, ?, NOW(), ?)`,
      postgresql: `INSERT INTO ${tableName} (version, name, executed_at, execution_time_ms) VALUES ($1, $2, NOW(), $3)`,
      sqlite: `INSERT INTO ${tableName} (version, name, executed_at, execution_time_ms) VALUES (?, ?, datetime('now'), ?)`,
    };
    const sql = sqlMap[this.driver];
    const params = this.driver === 'postgresql'
      ? [version, name, executionTimeMs]
      : [version, name, executionTimeMs];
    return await this.query(sql, params);
  }

  async removeMigrationRecord(tableName, version) {
    const sqlMap = {
      mysql: `DELETE FROM ${tableName} WHERE version = ?`,
      postgresql: `DELETE FROM ${tableName} WHERE version = $1`,
      sqlite: `DELETE FROM ${tableName} WHERE version = ?`,
    };
    const sql = sqlMap[this.driver];
    return await this.query(sql, [version]);
  }

  _getCreateVersionTableSQL(tableName) {
    switch (this.driver) {
      case 'mysql':
        return `
          CREATE TABLE IF NOT EXISTS ${tableName} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            version VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            executed_at DATETIME NOT NULL,
            execution_time_ms INT DEFAULT 0,
            INDEX idx_version (version)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `;
      case 'postgresql':
        return `
          CREATE TABLE IF NOT EXISTS ${tableName} (
            id SERIAL PRIMARY KEY,
            version VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            executed_at TIMESTAMP NOT NULL,
            execution_time_ms INT DEFAULT 0
          );
          CREATE INDEX IF NOT EXISTS idx_${tableName}_version ON ${tableName}(version);
        `;
      case 'sqlite':
        return `
          CREATE TABLE IF NOT EXISTS ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            executed_at TEXT NOT NULL,
            execution_time_ms INTEGER DEFAULT 0
          );
          CREATE INDEX IF NOT EXISTS idx_${tableName}_version ON ${tableName}(version);
        `;
      default:
        throw new DatabaseError(`UNSUPPORTED_DRIVER`, `Cannot generate DDL for driver: ${this.driver}`);
    }
  }

  _sanitizeConfig() {
    return {
      driver: this.config.driver,
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      database: this.config.database,
      password: '******',
    };
  }

  async close() {
    try {
      switch (this.driver) {
        case 'mysql':
          if (this.pool) await this.pool.end();
          break;
        case 'postgresql':
          if (this.pool) await this.pool.end();
          break;
        case 'sqlite':
          if (this.pool) this.pool.close();
          break;
      }
      this.connected = false;
      this.pool = null;
    } catch (err) {
      throw new DatabaseError(
        `CONNECTION_CLOSE_FAILED`,
        `Failed to close database connection: ${err.message}`,
        { originalError: err.message }
      );
    }
  }
}

module.exports = DatabaseManager;
