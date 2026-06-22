const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { generateInvoiceKey } = require('../utils/format');
const { checkDatabaseSize, checkRecordCount, DB_SIZE_LIMIT_MB, DB_RECORD_LIMIT } = require('./monitor');
const { getLogger } = require('./logger');

const PLATFORMS = {
  HANGXIN: 'hangxin',
  BAIWANG: 'baiwang',
  TENCENT: 'tencent',
  ALIPAY: 'alipay',
  JD: 'jd',
  TMALL: 'tmall',
  UNKNOWN: 'unknown'
};

const INVOICE_TYPES = {
  INPUT: 'input',
  OUTPUT: 'output',
  UNKNOWN: 'unknown'
};

class InvoiceDB {
  constructor(dbPath = null) {
    if (!dbPath) {
      const dataDir = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      dbPath = path.join(dataDir, 'invoices.db');
    }
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000');
    this.db.pragma('foreign_keys = ON');
    this._initTables();
    this._initStatements();
  }

  _initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS merchants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        tax_id TEXT,
        contact TEXT,
        address TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_code TEXT,
        invoice_number TEXT NOT NULL,
        invoice_key TEXT NOT NULL UNIQUE,
        invoice_date TEXT NOT NULL,
        buyer_name TEXT,
        buyer_tax_id TEXT,
        seller_name TEXT,
        seller_tax_id TEXT,
        amount REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        tax_rate REAL,
        invoice_type TEXT NOT NULL DEFAULT 'unknown',
        platform TEXT NOT NULL DEFAULT 'unknown',
        merchant_id INTEGER,
        raw_data TEXT,
        source_file TEXT,
        checksum TEXT,
        is_valid INTEGER DEFAULT 1,
        validation_errors TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (merchant_id) REFERENCES merchants(id)
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
      CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
      CREATE INDEX IF NOT EXISTS idx_invoices_platform ON invoices(platform);
      CREATE INDEX IF NOT EXISTS idx_invoices_buyer ON invoices(buyer_name);
      CREATE INDEX IF NOT EXISTS idx_invoices_seller ON invoices(seller_name);
      CREATE INDEX IF NOT EXISTS idx_invoices_merchant ON invoices(merchant_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_total ON invoices(total);

      CREATE TABLE IF NOT EXISTS deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period TEXT NOT NULL,
        output_invoice_id INTEGER,
        input_invoice_id INTEGER,
        match_key TEXT,
        deductible_amount REAL DEFAULT 0,
        deductible_tax REAL DEFAULT 0,
        deduction_status TEXT NOT NULL DEFAULT 'deductible',
        deduction_reason TEXT,
        deduction_rate REAL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (output_invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (input_invoice_id) REFERENCES invoices(id)
      );

      CREATE INDEX IF NOT EXISTS idx_deductions_period ON deductions(period);
      CREATE INDEX IF NOT EXISTS idx_deductions_status ON deductions(deduction_status);

      CREATE TABLE IF NOT EXISTS import_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_file TEXT NOT NULL,
        platform TEXT,
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        duplicate_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        error_details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  _initStatements() {
    this._getMerchantByName = this.db.prepare('SELECT * FROM merchants WHERE name = ?');
    this._insertMerchant = this.db.prepare(`
      INSERT INTO merchants (name, tax_id, contact, address) VALUES (?, ?, ?, ?)
    `);
    this._upsertMerchant = this.db.prepare(`
      INSERT INTO merchants (name, tax_id, contact, address) VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        tax_id = COALESCE(excluded.tax_id, merchants.tax_id),
        contact = COALESCE(excluded.contact, merchants.contact),
        address = COALESCE(excluded.address, merchants.address),
        updated_at = datetime('now')
    `);
    this._getInvoiceByKey = this.db.prepare('SELECT id FROM invoices WHERE invoice_key = ?');
    this._insertInvoice = this.db.prepare(`
      INSERT INTO invoices (
        invoice_code, invoice_number, invoice_key, invoice_date,
        buyer_name, buyer_tax_id, seller_name, seller_tax_id,
        amount, tax, total, tax_rate, invoice_type, platform,
        merchant_id, raw_data, source_file, is_valid, validation_errors
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this._countInvoices = this.db.prepare('SELECT COUNT(*) as c FROM invoices');
    this._insertImportLog = this.db.prepare(`
      INSERT INTO import_logs (source_file, platform, total_count, success_count, duplicate_count, failed_count, duration_ms, error_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this._clearDeductionsByPeriod = this.db.prepare('DELETE FROM deductions WHERE period = ?');
    this._insertDeduction = this.db.prepare(`
      INSERT INTO deductions (period, output_invoice_id, input_invoice_id, match_key, deductible_amount, deductible_tax, deduction_status, deduction_reason, deduction_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  getOrCreateMerchant(name, taxId = null, contact = null, address = null) {
    if (!name || !name.trim()) return null;
    const trimmed = name.trim();
    const existing = this._getMerchantByName.get(trimmed);
    if (existing) return existing;
    const info = this._upsertMerchant.run(trimmed, taxId, contact, address);
    return { id: info.lastInsertRowid, name: trimmed };
  }

  invoiceExists(invoiceCode, invoiceNumber) {
    const key = generateInvoiceKey(invoiceCode, invoiceNumber);
    return !!this._getInvoiceByKey.get(key);
  }

  insertInvoice(inv, merchantId = null) {
    const key = generateInvoiceKey(inv.invoiceCode, inv.invoiceNumber);
    if (this._getInvoiceByKey.get(key)) return { success: false, duplicate: true };
    const total = inv.total != null ? inv.total : (Number(inv.amount || 0) + Number(inv.tax || 0));
    const info = this._insertInvoice.run(
      inv.invoiceCode ? String(inv.invoiceCode).trim() : null,
      String(inv.invoiceNumber).trim(),
      key,
      inv.invoiceDate,
      inv.buyerName ? inv.buyerName.trim() : null,
      inv.buyerTaxId ? inv.buyerTaxId.trim() : null,
      inv.sellerName ? inv.sellerName.trim() : null,
      inv.sellerTaxId ? inv.sellerTaxId.trim() : null,
      Number(inv.amount || 0),
      Number(inv.tax || 0),
      Number(total),
      inv.taxRate != null ? Number(inv.taxRate) : null,
      inv.invoiceType || INVOICE_TYPES.UNKNOWN,
      inv.platform || PLATFORMS.UNKNOWN,
      merchantId,
      inv.rawData ? JSON.stringify(inv.rawData).substring(0, 10000) : null,
      inv.sourceFile || null,
      inv.isValid !== false ? 1 : 0,
      inv.validationErrors ? JSON.stringify(inv.validationErrors).substring(0, 2000) : null
    );
    return { success: true, id: info.lastInsertRowid, duplicate: false };
  }

  batchInsertInvoices(invoices, merchantName = null) {
    const result = { success: 0, duplicate: 0, failed: 0, errors: [] };
    let merchantId = null;
    if (merchantName) {
      const m = this.getOrCreateMerchant(merchantName);
      if (m) merchantId = m.id;
    }
    const tx = this.db.transaction((list) => {
      for (const inv of list) {
        try {
          const r = this.insertInvoice(inv, merchantId);
          if (r.duplicate) result.duplicate++;
          else if (r.success) result.success++;
          else result.failed++;
        } catch (e) {
          result.failed++;
          result.errors.push({ invoice: inv.invoiceNumber, error: e.message });
        }
      }
    });
    tx(invoices);
    return result;
  }

  queryInvoices(options = {}) {
    const where = [];
    const params = [];
    if (options.startDate) {
      where.push('invoice_date >= ?');
      params.push(options.startDate);
    }
    if (options.endDate) {
      where.push('invoice_date <= ?');
      params.push(options.endDate);
    }
    if (options.invoiceType && options.invoiceType !== 'all') {
      where.push('invoice_type = ?');
      params.push(options.invoiceType);
    }
    if (options.platform && options.platform !== 'all') {
      where.push('platform = ?');
      params.push(options.platform);
    }
    if (options.merchantName) {
      where.push('(buyer_name LIKE ? OR seller_name LIKE ?)');
      const like = `%${options.merchantName}%`;
      params.push(like, like);
    }
    if (options.invoiceNumber) {
      if (options.exactMatch) {
        where.push('invoice_number = ?');
        params.push(options.invoiceNumber);
      } else {
        where.push('invoice_number LIKE ?');
        params.push(`%${options.invoiceNumber}%`);
      }
    }
    if (options.minAmount != null) {
      where.push('total >= ?');
      params.push(Number(options.minAmount));
    }
    if (options.maxAmount != null) {
      where.push('total <= ?');
      params.push(Number(options.maxAmount));
    }
    const sql = `SELECT i.*, m.name as merchant_name FROM invoices i
      LEFT JOIN merchants m ON i.merchant_id = m.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY invoice_date DESC, id DESC
      ${options.limit ? 'LIMIT ' + Number(options.limit) : ''}`;
    return this.db.prepare(sql).all(...params);
  }

  getInvoiceStats(periodStart, periodEnd) {
    const sql = `
      SELECT
        invoice_type,
        platform,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        SUM(tax) as total_tax,
        SUM(total) as total_sum
      FROM invoices
      WHERE invoice_date >= ? AND invoice_date <= ?
      GROUP BY invoice_type, platform
      ORDER BY invoice_type, platform
    `;
    return this.db.prepare(sql).all(periodStart, periodEnd);
  }

  getTopMerchants(periodStart, periodEnd, limit = 10) {
    const sql = `
      SELECT
        COALESCE(m.name,
          CASE WHEN invoice_type = 'output' THEN buyer_name ELSE seller_name END
        ) as merchant_name,
        COUNT(*) as invoice_count,
        SUM(amount) as total_amount,
        SUM(tax) as total_tax,
        SUM(total) as total_sum
      FROM invoices i
      LEFT JOIN merchants m ON i.merchant_id = m.id
      WHERE invoice_date >= ? AND invoice_date <= ?
      GROUP BY merchant_name
      ORDER BY total_sum DESC
      LIMIT ?
    `;
    return this.db.prepare(sql).all(periodStart, periodEnd, limit);
  }

  getSummary(periodStart, periodEnd) {
    const input = this.db.prepare(`
      SELECT COUNT(*) as c, SUM(amount) a, SUM(tax) t, SUM(total) s FROM invoices
      WHERE invoice_type = 'input' AND invoice_date >= ? AND invoice_date <= ?
    `).get(periodStart, periodEnd);
    const output = this.db.prepare(`
      SELECT COUNT(*) as c, SUM(amount) a, SUM(tax) t, SUM(total) s FROM invoices
      WHERE invoice_type = 'output' AND invoice_date >= ? AND invoice_date <= ?
    `).get(periodStart, periodEnd);
    return {
      input: { count: input.c || 0, amount: input.a || 0, tax: input.t || 0, total: input.s || 0 },
      output: { count: output.c || 0, amount: output.a || 0, tax: output.t || 0, total: output.s || 0 }
    };
  }

  saveDeductions(period, deductions) {
    const tx = this.db.transaction((list) => {
      this._clearDeductionsByPeriod.run(period);
      for (const d of list) {
        this._insertDeduction.run(
          period,
          d.outputInvoiceId || null,
          d.inputInvoiceId || null,
          d.matchKey || null,
          Number(d.deductibleAmount || 0),
          Number(d.deductibleTax || 0),
          d.status || 'deductible',
          d.reason || null,
          Number(d.rate || 1)
        );
      }
    });
    tx(deductions);
    return deductions.length;
  }

  getDeductions(period) {
    return this.db.prepare(`
      SELECT d.*,
        o.invoice_number as output_number, o.invoice_date as output_date, o.seller_name as output_seller, o.total as output_total,
        i.invoice_number as input_number, i.invoice_date as input_date, i.buyer_name as input_buyer, i.total as input_total
      FROM deductions d
      LEFT JOIN invoices o ON d.output_invoice_id = o.id
      LEFT JOIN invoices i ON d.input_invoice_id = i.id
      WHERE d.period = ?
      ORDER BY d.id
    `).all(period);
  }

  countInvoices() {
    return this._countInvoices.get().c;
  }

  logImport(sourceFile, platform, stats, durationMs, errors) {
    this._insertImportLog.run(
      sourceFile,
      platform,
      stats.total || 0,
      stats.success || 0,
      stats.duplicate || 0,
      stats.failed || 0,
      durationMs,
      errors && errors.length ? JSON.stringify(errors).substring(0, 5000) : null
    );
  }

  close() {
    try {
      this.db.close();
    } catch (e) {
    }
  }

  getDbSizeMB() {
    try {
      if (!fs.existsSync(this.dbPath)) return 0;
      const stats = fs.statSync(this.dbPath);
      return stats.size / 1024 / 1024;
    } catch (e) {
      return 0;
    }
  }

  checkCapacity(extraRecords = 0) {
    const logger = getLogger();
    const sizeMB = this.getDbSizeMB();
    const recordCount = this.countInvoices();
    const issues = [];

    if (sizeMB > DB_SIZE_LIMIT_MB) {
      issues.push(`数据库文件 ${sizeMB.toFixed(2)}MB 已超过 ${DB_SIZE_LIMIT_MB}MB 限制`);
    } else if (sizeMB > DB_SIZE_LIMIT_MB * 0.9) {
      issues.push(`数据库文件 ${sizeMB.toFixed(2)}MB 已达 ${DB_SIZE_LIMIT_MB}MB 限制的 90%`);
    }

    if (recordCount + extraRecords > DB_RECORD_LIMIT) {
      issues.push(`记录数 ${recordCount}${extraRecords ? ' + ' + extraRecords + '新' : ''} 将超过 ${DB_RECORD_LIMIT} 条限制`);
    } else if (recordCount + extraRecords > DB_RECORD_LIMIT * 0.9) {
      issues.push(`记录数 ${recordCount}${extraRecords ? ' + ' + extraRecords + '新' : ''} 已达 ${DB_RECORD_LIMIT} 条限制的 90%`);
    }

    for (const msg of issues) {
      logger.warn(`[容量预警] ${msg}`, { operation: 'DB_CAPACITY' });
    }

    return {
      sizeMB,
      recordCount,
      sizeLimitMB: DB_SIZE_LIMIT_MB,
      recordLimit: DB_RECORD_LIMIT,
      overSize: sizeMB > DB_SIZE_LIMIT_MB,
      overCount: recordCount + extraRecords > DB_RECORD_LIMIT,
      warnings: issues
    };
  }

  enforceCapacity(extraRecords = 0) {
    const cap = this.checkCapacity(extraRecords);
    if (cap.overSize || cap.overCount) {
      throw new Error(`数据库容量超限: ${cap.warnings.join('; ')}`);
    }
    return cap;
  }
}

let dbInstance = null;
function getDB(dbPath = null) {
  if (!dbInstance) dbInstance = new InvoiceDB(dbPath);
  return dbInstance;
}

module.exports = { InvoiceDB, getDB, PLATFORMS, INVOICE_TYPES };
