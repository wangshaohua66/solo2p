const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const { databaseConfig, ORDER_STATUS, LOGISTICS_STATUS } = require('./config');

class Storage {
  constructor(dbPath = databaseConfig.path) {
    this.dbPath = dbPath;
    this.db = null;
    this._ensureDirectory(dbPath);
  }

  _ensureDirectory(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) return reject(err);
      });

      this.db.serialize(() => {
        this.db.run(`PRAGMA journal_mode = ${databaseConfig.journalMode}`);
        this.db.run(`PRAGMA busy_timeout = ${databaseConfig.busyTimeout}`);
        this.db.run(`PRAGMA cache_size = ${databaseConfig.cacheSize}`);
        this.db.run('PRAGMA foreign_keys = ON');

        this._createTables()
          .then(() => this._createIndexes())
          .then(() => resolve(this))
          .catch(reject);
      });
    });
  }

  _createTables() {
    return Promise.all([
      this._run(`
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_no TEXT NOT NULL,
          platform TEXT NOT NULL,
          platform_order_id TEXT NOT NULL,
          status TEXT NOT NULL,
          order_date TEXT NOT NULL,
          total_amount REAL NOT NULL DEFAULT 0,
          currency TEXT DEFAULT 'USD',
          buyer_name TEXT,
          buyer_email TEXT,
          buyer_phone TEXT,
          shipping_address TEXT,
          country TEXT,
          items_count INTEGER DEFAULT 0,
          remark TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(platform, platform_order_id)
        )
      `),
      this._run(`
        CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          sku TEXT,
          product_name TEXT,
          quantity INTEGER DEFAULT 1,
          unit_price REAL DEFAULT 0,
          subtotal REAL DEFAULT 0,
          platform_item_id TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
      `),
      this._run(`
        CREATE TABLE IF NOT EXISTS logistics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          tracking_no TEXT,
          carrier TEXT,
          status TEXT NOT NULL,
          shipped_date TEXT,
          estimated_delivery_date TEXT,
          actual_delivery_date TEXT,
          current_location TEXT,
          is_delayed INTEGER DEFAULT 0,
          delay_reason TEXT,
          raw_tracking_data TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
      `),
      this._run(`
        CREATE TABLE IF NOT EXISTS order_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          field_name TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          changed_at TEXT NOT NULL,
          FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
      `),
      this._run(`
        CREATE TABLE IF NOT EXISTS fetch_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL,
          fetch_date TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT,
          status TEXT NOT NULL,
          orders_fetched INTEGER DEFAULT 0,
          orders_inserted INTEGER DEFAULT 0,
          orders_updated INTEGER DEFAULT 0,
          error_message TEXT,
          duration_ms INTEGER
        )
      `)
    ]);
  }

  _createIndexes() {
    return Promise.all([
      this._run('CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform)'),
      this._run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)'),
      this._run('CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date)'),
      this._run('CREATE INDEX IF NOT EXISTS idx_orders_platform_order_id ON orders(platform, platform_order_id)'),
      this._run('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)'),
      this._run('CREATE INDEX IF NOT EXISTS idx_logistics_order_id ON logistics(order_id)'),
      this._run('CREATE INDEX IF NOT EXISTS idx_logistics_status ON logistics(status)'),
      this._run('CREATE INDEX IF NOT EXISTS idx_fetch_logs_platform_date ON fetch_logs(platform, fetch_date)')
    ]);
  }

  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  _get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async upsertOrder(orderData, items = []) {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const existing = await this._get(
      'SELECT * FROM orders WHERE platform = ? AND platform_order_id = ?',
      [orderData.platform, orderData.platform_order_id]
    );

    let orderId;
    const fieldsChanged = [];

    if (existing) {
      orderId = existing.id;
      const updates = [];
      const updateParams = [];

      Object.keys(orderData).forEach(key => {
        if (['platform', 'platform_order_id', 'created_at'].includes(key)) return;
        const oldVal = existing[key];
        const newVal = orderData[key];
        if (String(oldVal) !== String(newVal)) {
          updates.push(`${key} = ?`);
          updateParams.push(newVal);
          fieldsChanged.push({ field: key, old: oldVal, new: newVal });
        }
      });

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        updateParams.push(now);
        updateParams.push(existing.id);
        await this._run(
          `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
          updateParams
        );

        for (const change of fieldsChanged) {
          await this._run(
            'INSERT INTO order_history (order_id, field_name, old_value, new_value, changed_at) VALUES (?, ?, ?, ?, ?)',
            [orderId, change.field, String(change.old), String(change.new), now]
          );
        }
      }

      return { id: orderId, inserted: false, updated: fieldsChanged.length > 0, changes: fieldsChanged };
    } else {
      const result = await this._run(`
        INSERT INTO orders (
          order_no, platform, platform_order_id, status, order_date,
          total_amount, currency, buyer_name, buyer_email, buyer_phone,
          shipping_address, country, items_count, remark, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderData.order_no || orderData.platform_order_id,
        orderData.platform,
        orderData.platform_order_id,
        orderData.status,
        orderData.order_date,
        orderData.total_amount || 0,
        orderData.currency || 'USD',
        orderData.buyer_name || null,
        orderData.buyer_email || null,
        orderData.buyer_phone || null,
        orderData.shipping_address || null,
        orderData.country || null,
        orderData.items_count || (items.length || 0),
        orderData.remark || null,
        now,
        now
      ]);
      orderId = result.lastID;
    }

    if (items && items.length > 0) {
      await this._run('DELETE FROM order_items WHERE order_id = ?', [orderId]);
      for (const item of items) {
        await this._run(`
          INSERT INTO order_items (
            order_id, sku, product_name, quantity, unit_price, subtotal, platform_item_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderId,
          item.sku || null,
          item.product_name || null,
          item.quantity || 1,
          item.unit_price || 0,
          item.subtotal || ((item.unit_price || 0) * (item.quantity || 1)),
          item.platform_item_id || null,
          now
        ]);
      }
    }

    return { id: orderId, inserted: true, updated: false, changes: [] };
  }

  async upsertLogistics(orderId, logisticsData) {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const existing = await this._get(
      'SELECT * FROM logistics WHERE order_id = ?',
      [orderId]
    );

    if (existing) {
      const updates = [];
      const updateParams = [];

      Object.keys(logisticsData).forEach(key => {
        if (['order_id', 'created_at'].includes(key)) return;
        if (String(existing[key]) !== String(logisticsData[key])) {
          updates.push(`${key} = ?`);
          updateParams.push(logisticsData[key]);
        }
      });

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        updateParams.push(now);
        updateParams.push(existing.id);
        await this._run(
          `UPDATE logistics SET ${updates.join(', ')} WHERE id = ?`,
          updateParams
        );
        return { id: existing.id, updated: true };
      }
      return { id: existing.id, updated: false };
    } else {
      const result = await this._run(`
        INSERT INTO logistics (
          order_id, tracking_no, carrier, status, shipped_date,
          estimated_delivery_date, actual_delivery_date, current_location,
          is_delayed, delay_reason, raw_tracking_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        logisticsData.tracking_no || null,
        logisticsData.carrier || null,
        logisticsData.status || LOGISTICS_STATUS.PENDING,
        logisticsData.shipped_date || null,
        logisticsData.estimated_delivery_date || null,
        logisticsData.actual_delivery_date || null,
        logisticsData.current_location || null,
        logisticsData.is_delayed ? 1 : 0,
        logisticsData.delay_reason || null,
        logisticsData.raw_tracking_data ? JSON.stringify(logisticsData.raw_tracking_data) : null,
        now,
        now
      ]);
      return { id: result.lastID, inserted: true };
    }
  }

  async queryOrders(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.platform) {
      conditions.push('o.platform = ?');
      params.push(filters.platform);
    }
    if (filters.status) {
      conditions.push('o.status = ?');
      params.push(filters.status);
    }
    if (filters.startDate) {
      conditions.push('o.order_date >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('o.order_date <= ?');
      params.push(filters.endDate + ' 23:59:59');
    }
    if (filters.order_no) {
      conditions.push('(o.order_no LIKE ? OR o.platform_order_id LIKE ?)');
      params.push(`%${filters.order_no}%`, `%${filters.order_no}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = 'ORDER BY o.order_date DESC, o.id DESC';
    const limit = filters.limit ? `LIMIT ${parseInt(filters.limit)}` : '';
    const offset = filters.offset ? `OFFSET ${parseInt(filters.offset)}` : '';

    return this._all(`
      SELECT o.*, l.tracking_no, l.status AS logistics_status, l.carrier
      FROM orders o
      LEFT JOIN logistics l ON l.order_id = o.id
      ${where}
      ${orderBy}
      ${limit} ${offset}
    `, params);
  }

  async getOrderDetails(orderId) {
    const order = await this._get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return null;

    const [items, logistics, history] = await Promise.all([
      this._all('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [orderId]),
      this._all('SELECT * FROM logistics WHERE order_id = ? ORDER BY updated_at DESC', [orderId]),
      this._all('SELECT * FROM order_history WHERE order_id = ? ORDER BY changed_at DESC', [orderId])
    ]);

    return { ...order, items, logistics, history };
  }

  async getStatistics(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.platform) {
      conditions.push('platform = ?');
      params.push(filters.platform);
    }
    if (filters.startDate) {
      conditions.push('order_date >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('order_date <= ?');
      params.push(filters.endDate + ' 23:59:59');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const stats = await this._all(`
      SELECT
        platform,
        status,
        COUNT(*) as order_count,
        SUM(total_amount) as total_amount,
        SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as completed_amount,
        SUM(items_count) as total_items
      FROM orders
      ${where}
      GROUP BY platform, status
      ORDER BY platform, status
    `, params);

    const dailyStats = await this._all(`
      SELECT
        DATE(order_date) as date,
        platform,
        COUNT(*) as order_count,
        SUM(total_amount) as total_amount
      FROM orders
      ${where}
      GROUP BY DATE(order_date), platform
      ORDER BY date DESC, platform
    `, params);

    return { summary: stats, daily: dailyStats };
  }

  async getHotProducts(filters = {}, limit = 20) {
    const conditions = [];
    const params = [];

    if (filters.platform) {
      conditions.push('o.platform = ?');
      params.push(filters.platform);
    }
    if (filters.startDate) {
      conditions.push('o.order_date >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('o.order_date <= ?');
      params.push(filters.endDate + ' 23:59:59');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this._all(`
      SELECT
        o.platform,
        oi.sku,
        oi.product_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.subtotal) as total_revenue,
        COUNT(DISTINCT o.id) as order_count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      ${where}
      GROUP BY o.platform, oi.sku, oi.product_name
      ORDER BY total_quantity DESC
      LIMIT ${parseInt(limit)}
    `, params);
  }

  async getExceptionOrders(filters = {}) {
    const conditions = ['(o.status = ? OR l.status = ? OR l.is_delayed = 1)'];
    const params = [ORDER_STATUS.CANCELLED, LOGISTICS_STATUS.EXCEPTION];

    if (filters.platform) {
      conditions.push('o.platform = ?');
      params.push(filters.platform);
    }
    if (filters.startDate) {
      conditions.push('o.order_date >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('o.order_date <= ?');
      params.push(filters.endDate + ' 23:59:59');
    }

    return this._all(`
      SELECT
        o.*,
        l.tracking_no,
        l.status AS logistics_status,
        l.is_delayed,
        l.delay_reason
      FROM orders o
      LEFT JOIN logistics l ON l.order_id = o.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY o.order_date DESC
    `, params);
  }

  async addFetchLog(logData) {
    return this._run(`
      INSERT INTO fetch_logs (
        platform, fetch_date, start_time, end_time, status,
        orders_fetched, orders_inserted, orders_updated, error_message, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      logData.platform,
      logData.fetch_date,
      logData.start_time,
      logData.end_time || null,
      logData.status,
      logData.orders_fetched || 0,
      logData.orders_inserted || 0,
      logData.orders_updated || 0,
      logData.error_message || null,
      logData.duration_ms || null
    ]);
  }

  async getFetchLogs(platform, limit = 50) {
    const conditions = [];
    const params = [];

    if (platform) {
      conditions.push('platform = ?');
      params.push(platform);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this._all(`
      SELECT * FROM fetch_logs
      ${where}
      ORDER BY id DESC
      LIMIT ${parseInt(limit)}
    `, params);
  }

  close() {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      this.db.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

let storageInstance = null;

async function getStorage() {
  if (!storageInstance) {
    storageInstance = new Storage();
    await storageInstance.initialize();
  }
  return storageInstance;
}

module.exports = { Storage, getStorage };
