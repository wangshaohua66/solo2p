import { createLogger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('Repository');

const TRACKED_FIELDS = [
  'title', 'address', 'area', 'assess_price', 'start_price',
  'current_price', 'auction_date', 'round', 'court_name',
  'notice_url', 'status', 'bid_count'
];

let db = null;
let dbType = null;
let memoryStore = null;
let statements = {};
let nextId = 1;
let nextChangeId = 1;
let nextLogId = 1;

function initMemoryStore() {
  memoryStore = {
    auctions: [],
    auctionChanges: [],
    crawlLogs: [],
    auctionIndex: new Map()
  };
  nextId = 1;
  nextChangeId = 1;
  nextLogId = 1;
  logger.info('内存存储初始化完成');
}

export async function initDb(dbPath) {
  try {
    const Database = (await import('better-sqlite3')).default;

    const resolvedPath = dbPath || process.env.DB_PATH || './data/auction_house.db';
    const dbDir = path.dirname(resolvedPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info(`创建数据库目录: ${dbDir}`);
    }

    db = new Database(resolvedPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');
    db.pragma('foreign_keys = ON');

    dbType = 'sqlite';
    logger.info(`数据库连接成功 (SQLite): ${resolvedPath}`);

    _createTables();
    _createIndexes();
    _prepareStatements();

    logger.info('数据库初始化完成');
    return db;
  } catch (error) {
    logger.warn(`SQLite 不可用，使用内存存储: ${error.message}`);
    dbType = 'memory';
    initMemoryStore();
    logger.info('内存存储初始化完成');
    return memoryStore;
  }
}

function _createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      court TEXT NOT NULL,
      case_no TEXT NOT NULL,
      title TEXT,
      address TEXT,
      area REAL,
      assess_price INTEGER,
      start_price INTEGER,
      current_price INTEGER,
      auction_date TEXT,
      round TEXT,
      court_name TEXT,
      notice_url TEXT,
      status TEXT,
      bid_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(court, case_no)
    );

    CREATE TABLE IF NOT EXISTS auction_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_time TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS crawl_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_name TEXT NOT NULL,
      crawl_time TEXT DEFAULT (datetime('now')),
      total_count INTEGER DEFAULT 0,
      new_count INTEGER DEFAULT 0,
      filtered_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success',
      duration_ms INTEGER DEFAULT 0
    );
  `);

  logger.debug('数据表创建完成');
}

function _createIndexes() {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auctions_court_case_no ON auctions(court, case_no);
    CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
    CREATE INDEX IF NOT EXISTS idx_auctions_current_price ON auctions(current_price);
    CREATE INDEX IF NOT EXISTS idx_auctions_assess_price ON auctions(assess_price);
    CREATE INDEX IF NOT EXISTS idx_auctions_area ON auctions(area);
    CREATE INDEX IF NOT EXISTS idx_auctions_round ON auctions(round);
    CREATE INDEX IF NOT EXISTS idx_auctions_auction_date ON auctions(auction_date);
    CREATE INDEX IF NOT EXISTS idx_auctions_created_at ON auctions(created_at);
    CREATE INDEX IF NOT EXISTS idx_auctions_updated_at ON auctions(updated_at);
    CREATE INDEX IF NOT EXISTS idx_auctions_address ON auctions(address);

    CREATE INDEX IF NOT EXISTS idx_auction_changes_auction_id ON auction_changes(auction_id);
    CREATE INDEX IF NOT EXISTS idx_auction_changes_field_name ON auction_changes(field_name);
    CREATE INDEX IF NOT EXISTS idx_auction_changes_change_time ON auction_changes(change_time);

    CREATE INDEX IF NOT EXISTS idx_crawl_logs_site_name ON crawl_logs(site_name);
    CREATE INDEX IF NOT EXISTS idx_crawl_logs_crawl_time ON crawl_logs(crawl_time);
    CREATE INDEX IF NOT EXISTS idx_crawl_logs_status ON crawl_logs(status);
  `);

  logger.debug('索引创建完成');
}

function _prepareStatements() {
  statements.getAuctionByUniqueKey = db.prepare(`
    SELECT * FROM auctions WHERE court = ? AND case_no = ?
  `);

  statements.insertAuction = db.prepare(`
    INSERT INTO auctions (
      court, case_no, title, address, area, assess_price,
      start_price, current_price, auction_date, round,
      court_name, notice_url, status, bid_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  statements.updateAuction = db.prepare(`
    UPDATE auctions SET
      title = ?, address = ?, area = ?, assess_price = ?,
      start_price = ?, current_price = ?, auction_date = ?,
      round = ?, court_name = ?, notice_url = ?, status = ?,
      bid_count = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  statements.insertChange = db.prepare(`
    INSERT INTO auction_changes (auction_id, field_name, old_value, new_value)
    VALUES (?, ?, ?, ?)
  `);

  statements.getAuctionById = db.prepare(`
    SELECT * FROM auctions WHERE id = ?
  `);

  statements.getAuctionChanges = db.prepare(`
    SELECT * FROM auction_changes
    WHERE auction_id = ?
    ORDER BY change_time DESC, id DESC
  `);

  statements.countAuctions = db.prepare(`
    SELECT COUNT(*) as count FROM auctions
  `);

  statements.insertCrawlLog = db.prepare(`
    INSERT INTO crawl_logs (
      site_name, total_count, new_count, filtered_count,
      error_count, status, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  logger.debug('预备语句编译完成');
}

export function insertOrUpdateAuction(auction) {
  if (dbType === 'sqlite') {
    return _insertOrUpdateSqlite(auction);
  } else {
    return _insertOrUpdateMemory(auction);
  }
}

function _insertOrUpdateSqlite(auction) {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDb()');
  }

  if (!auction.court || !auction.case_no) {
    throw new Error('标的必须包含 court 和 case_no 字段');
  }

  const result = {
    isNew: false,
    isChanged: false,
    changes: [],
    auctionId: null
  };

  try {
    const existing = statements.getAuctionByUniqueKey.get(auction.court, auction.case_no);

    if (!existing) {
      const info = statements.insertAuction.run(
        auction.court,
        auction.case_no,
        auction.title || null,
        auction.address || null,
        auction.area || null,
        auction.assess_price || null,
        auction.start_price || null,
        auction.current_price || null,
        auction.auction_date || null,
        auction.round || null,
        auction.court_name || null,
        auction.notice_url || null,
        auction.status || null,
        auction.bid_count || 0
      );

      result.isNew = true;
      result.auctionId = info.lastInsertRowid;
      logger.debug(`新增标的: ${auction.court} - ${auction.case_no}`);
    } else {
      const changes = _detectChanges(existing, auction);

      if (changes.length > 0) {
        const updateData = { ...existing, ...auction };

        statements.updateAuction.run(
          updateData.title,
          updateData.address,
          updateData.area,
          updateData.assess_price,
          updateData.start_price,
          updateData.current_price,
          updateData.auction_date,
          updateData.round,
          updateData.court_name,
          updateData.notice_url,
          updateData.status,
          updateData.bid_count,
          existing.id
        );

        for (const change of changes) {
          statements.insertChange.run(
            existing.id,
            change.field,
            change.oldValue !== null ? String(change.oldValue) : null,
            change.newValue !== null ? String(change.newValue) : null
          );
        }

        result.isChanged = true;
        result.changes = changes;
        logger.debug(`更新标的: ${auction.court} - ${auction.case_no}, 变更字段: ${changes.map(c => c.field).join(', ')}`);
      } else {
        logger.debug(`标的无变化: ${auction.court} - ${auction.case_no}`);
      }

      result.auctionId = existing.id;
    }

    return result;
  } catch (error) {
    logger.error(`插入或更新标的失败: ${error.message}, court=${auction.court}, case_no=${auction.case_no}`);
    throw error;
  }
}

function _insertOrUpdateMemory(auction) {
  if (!memoryStore) {
    throw new Error('内存存储未初始化，请先调用 initDb()');
  }

  if (!auction.court || !auction.case_no) {
    throw new Error('标的必须包含 court 和 case_no 字段');
  }

  const result = {
    isNew: false,
    isChanged: false,
    changes: [],
    auctionId: null
  };

  const now = new Date().toISOString();
  const uniqueKey = `${auction.court}::${auction.case_no}`;
  const existingIndex = memoryStore.auctionIndex.get(uniqueKey);
  const existing = existingIndex !== undefined ? memoryStore.auctions[existingIndex] : null;

  if (!existing) {
    const newAuction = {
      id: nextId++,
      court: auction.court,
      case_no: auction.case_no,
      title: auction.title || null,
      address: auction.address || null,
      area: auction.area || null,
      assess_price: auction.assess_price || null,
      start_price: auction.start_price || null,
      current_price: auction.current_price || null,
      auction_date: auction.auction_date || null,
      round: auction.round || null,
      court_name: auction.court_name || null,
      notice_url: auction.notice_url || null,
      status: auction.status || null,
      bid_count: auction.bid_count || 0,
      created_at: now,
      updated_at: now
    };

    memoryStore.auctions.push(newAuction);
    memoryStore.auctionIndex.set(uniqueKey, memoryStore.auctions.length - 1);

    result.isNew = true;
    result.auctionId = newAuction.id;
    logger.debug(`新增标的: ${auction.court} - ${auction.case_no}`);
  } else {
    const changes = _detectChanges(existing, auction);

    if (changes.length > 0) {
      for (const change of changes) {
        existing[change.field] = change.newValue;

        memoryStore.auctionChanges.push({
          id: nextChangeId++,
          auction_id: existing.id,
          field_name: change.field,
          old_value: change.oldValue !== null ? String(change.oldValue) : null,
          new_value: change.newValue !== null ? String(change.newValue) : null,
          change_time: now
        });
      }

      existing.updated_at = now;
      result.isChanged = true;
      result.changes = changes;
      logger.debug(`更新标的: ${auction.court} - ${auction.case_no}, 变更字段: ${changes.map(c => c.field).join(', ')}`);
    } else {
      logger.debug(`标的无变化: ${auction.court} - ${auction.case_no}`);
    }

    result.auctionId = existing.id;
  }

  return result;
}

function _detectChanges(existing, incoming) {
  const changes = [];

  for (const field of TRACKED_FIELDS) {
    const incomingValue = incoming[field] ?? null;
    const existingValue = existing[field] ?? null;

    if (incomingValue === null) {
      continue;
    }

    const existingNormalized = existingValue !== null ? String(existingValue) : null;
    const incomingNormalized = String(incomingValue);

    if (existingNormalized !== incomingNormalized) {
      changes.push({
        field,
        oldValue: existingValue,
        newValue: incomingValue
      });
    }
  }

  return changes;
}

export function batchInsertOrUpdate(auctions) {
  if (!Array.isArray(auctions)) {
    throw new Error('参数必须是数组');
  }

  const result = {
    total: auctions.length,
    newCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    errorCount: 0,
    changedAuctions: []
  };

  for (const auction of auctions) {
    try {
      const res = insertOrUpdateAuction(auction);
      if (res.isNew) {
        result.newCount++;
      } else if (res.isChanged) {
        result.updatedCount++;
        result.changedAuctions.push({
          id: res.auctionId,
          changes: res.changes
        });
      } else {
        result.unchangedCount++;
      }
    } catch (error) {
      result.errorCount++;
      logger.error(`批量处理标的失败: ${error.message}, court=${auction.court}, case_no=${auction.case_no}`);
    }
  }

  logger.info(`批量处理完成: 总数=${result.total}, 新增=${result.newCount}, 更新=${result.updatedCount}, 无变化=${result.unchangedCount}, 错误=${result.errorCount}`);

  return result;
}

export function getAuctionById(id) {
  if (dbType === 'sqlite') {
    if (!db) throw new Error('数据库未初始化');
    try {
      const auction = statements.getAuctionById.get(id);
      return auction || null;
    } catch (error) {
      logger.error(`获取标的详情失败: ${error.message}, id=${id}`);
      throw error;
    }
  } else {
    if (!memoryStore) throw new Error('内存存储未初始化');
    return memoryStore.auctions.find(a => a.id === id) || null;
  }
}

export function getAuctions(filters = {}, options = {}) {
  if (dbType === 'sqlite') {
    return _getAuctionsSqlite(filters, options);
  } else {
    return _getAuctionsMemory(filters, options);
  }
}

function _getAuctionsSqlite(filters, options) {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDb()');
  }

  try {
    const { where, params } = _buildWhereClause(filters);

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const sortField = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const allowedSortFields = ['id', 'current_price', 'assess_price', 'area', 'auction_date', 'created_at', 'updated_at', 'bid_count'];
    if (!allowedSortFields.includes(sortField)) {
      throw new Error(`不支持的排序字段: ${sortField}`);
    }

    const sql = `
      SELECT * FROM auctions
      ${where}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const stmt = db.prepare(sql);
    const auctions = stmt.all([...params, pageSize, offset]);

    const countSql = `SELECT COUNT(*) as count FROM auctions ${where}`;
    const countStmt = db.prepare(countSql);
    const { count } = countStmt.get(params);

    return {
      list: auctions,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    };
  } catch (error) {
    logger.error(`查询标的列表失败: ${error.message}`);
    throw error;
  }
}

function _getAuctionsMemory(filters, options) {
  if (!memoryStore) {
    throw new Error('内存存储未初始化，请先调用 initDb()');
  }

  try {
    let filtered = [...memoryStore.auctions];

    if (filters.status !== undefined && filters.status !== null) {
      filtered = filtered.filter(a => a.status === filters.status);
    }
    if (filters.court !== undefined && filters.court !== null) {
      filtered = filtered.filter(a => a.court === filters.court);
    }
    if (filters.round !== undefined && filters.round !== null) {
      filtered = filtered.filter(a => a.round === filters.round);
    }
    if (filters.minPrice !== undefined && filters.minPrice !== null) {
      filtered = filtered.filter(a => a.current_price >= filters.minPrice);
    }
    if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
      filtered = filtered.filter(a => a.current_price !== null && a.current_price <= filters.maxPrice);
    }
    if (filters.minAssessPrice !== undefined && filters.minAssessPrice !== null) {
      filtered = filtered.filter(a => a.assess_price >= filters.minAssessPrice);
    }
    if (filters.maxAssessPrice !== undefined && filters.maxAssessPrice !== null) {
      filtered = filtered.filter(a => a.assess_price !== null && a.assess_price <= filters.maxAssessPrice);
    }
    if (filters.minArea !== undefined && filters.minArea !== null) {
      filtered = filtered.filter(a => a.area >= filters.minArea);
    }
    if (filters.maxArea !== undefined && filters.maxArea !== null) {
      filtered = filtered.filter(a => a.area !== null && a.area <= filters.maxArea);
    }
    if (filters.addressKeyword !== undefined && filters.addressKeyword !== null) {
      filtered = filtered.filter(a => a.address && a.address.includes(filters.addressKeyword));
    }
    if (filters.titleKeyword !== undefined && filters.titleKeyword !== null) {
      filtered = filtered.filter(a => a.title && a.title.includes(filters.titleKeyword));
    }

    const sortField = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;
      if (typeof valA === 'string') {
        return valA.localeCompare(valB) * sortOrder;
      }
      return (valA - valB) * sortOrder;
    });

    const total = filtered.length;
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const list = filtered.slice(offset, offset + pageSize);

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  } catch (error) {
    logger.error(`查询标的列表失败: ${error.message}`);
    throw error;
  }
}

function _buildWhereClause(filters) {
  const conditions = [];
  const params = [];

  if (filters.status !== undefined && filters.status !== null) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  if (filters.court !== undefined && filters.court !== null) {
    conditions.push('court = ?');
    params.push(filters.court);
  }

  if (filters.case_no !== undefined && filters.case_no !== null) {
    conditions.push('case_no = ?');
    params.push(filters.case_no);
  }

  if (filters.round !== undefined && filters.round !== null) {
    conditions.push('round = ?');
    params.push(filters.round);
  }

  if (filters.minPrice !== undefined && filters.minPrice !== null) {
    conditions.push('current_price >= ?');
    params.push(filters.minPrice);
  }

  if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
    conditions.push('current_price <= ?');
    params.push(filters.maxPrice);
  }

  if (filters.minAssessPrice !== undefined && filters.minAssessPrice !== null) {
    conditions.push('assess_price >= ?');
    params.push(filters.minAssessPrice);
  }

  if (filters.maxAssessPrice !== undefined && filters.maxAssessPrice !== null) {
    conditions.push('assess_price <= ?');
    params.push(filters.maxAssessPrice);
  }

  if (filters.minArea !== undefined && filters.minArea !== null) {
    conditions.push('area >= ?');
    params.push(filters.minArea);
  }

  if (filters.maxArea !== undefined && filters.maxArea !== null) {
    conditions.push('area <= ?');
    params.push(filters.maxArea);
  }

  if (filters.addressKeyword !== undefined && filters.addressKeyword !== null) {
    conditions.push('address LIKE ?');
    params.push(`%${filters.addressKeyword}%`);
  }

  if (filters.titleKeyword !== undefined && filters.titleKeyword !== null) {
    conditions.push('title LIKE ?');
    params.push(`%${filters.titleKeyword}%`);
  }

  if (filters.minBidCount !== undefined && filters.minBidCount !== null) {
    conditions.push('bid_count >= ?');
    params.push(filters.minBidCount);
  }

  if (filters.auctionDateFrom !== undefined && filters.auctionDateFrom !== null) {
    conditions.push('auction_date >= ?');
    params.push(filters.auctionDateFrom);
  }

  if (filters.auctionDateTo !== undefined && filters.auctionDateTo !== null) {
    conditions.push('auction_date <= ?');
    params.push(filters.auctionDateTo);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

export function countAuctions(filters = {}) {
  if (dbType === 'sqlite') {
    if (!db) throw new Error('数据库未初始化');
    try {
      const { where, params } = _buildWhereClause(filters);
      const sql = `SELECT COUNT(*) as count FROM auctions ${where}`;
      const stmt = db.prepare(sql);
      const { count } = stmt.get(params);
      return count;
    } catch (error) {
      logger.error(`统计标的数量失败: ${error.message}`);
      throw error;
    }
  } else {
    const { total } = getAuctions(filters, { page: 1, pageSize: 1 });
    return total;
  }
}

export function getAuctionChanges(auctionId) {
  if (dbType === 'sqlite') {
    if (!db) throw new Error('数据库未初始化');
    try {
      const changes = statements.getAuctionChanges.all(auctionId);
      return changes;
    } catch (error) {
      logger.error(`获取标的变更历史失败: ${error.message}, auctionId=${auctionId}`);
      throw error;
    }
  } else {
    if (!memoryStore) throw new Error('内存存储未初始化');
    return memoryStore.auctionChanges
      .filter(c => c.auction_id === auctionId)
      .sort((a, b) => new Date(b.change_time) - new Date(a.change_time));
  }
}

export function getChangedAuctions(sinceTime) {
  if (dbType === 'sqlite') {
    if (!db) throw new Error('数据库未初始化');
    try {
      const since = sinceTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const sql = `
        SELECT DISTINCT a.*,
          (SELECT GROUP_CONCAT(field_name, ',')
           FROM auction_changes ac
           WHERE ac.auction_id = a.id AND ac.change_time >= ?) as changed_fields
        FROM auctions a
        INNER JOIN auction_changes ac ON a.id = ac.auction_id
        WHERE ac.change_time >= ?
        GROUP BY a.id
        ORDER BY a.updated_at DESC
      `;
      const stmt = db.prepare(sql);
      return stmt.all(since, since);
    } catch (error) {
      logger.error(`获取变更标的列表失败: ${error.message}`);
      throw error;
    }
  } else {
    if (!memoryStore) throw new Error('内存存储未初始化');
    const since = sinceTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const changedIds = new Set();
    const changedFieldsMap = new Map();

    for (const change of memoryStore.auctionChanges) {
      if (change.change_time >= since) {
        changedIds.add(change.auction_id);
        if (!changedFieldsMap.has(change.auction_id)) {
          changedFieldsMap.set(change.auction_id, []);
        }
        changedFieldsMap.get(change.auction_id).push(change.field_name);
      }
    }

    return memoryStore.auctions
      .filter(a => changedIds.has(a.id))
      .map(a => ({
        ...a,
        changed_fields: (changedFieldsMap.get(a.id) || []).join(',')
      }))
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }
}

export function recordCrawlLog(log) {
  if (!log.site_name) {
    throw new Error('采集日志必须包含 site_name 字段');
  }

  if (dbType === 'sqlite') {
    if (!db) throw new Error('数据库未初始化');
    try {
      const info = statements.insertCrawlLog.run(
        log.site_name,
        log.total_count || 0,
        log.new_count || 0,
        log.filtered_count || 0,
        log.error_count || 0,
        log.status || 'success',
        log.duration_ms || 0
      );
      logger.debug(`采集日志已记录: ${log.site_name}, 状态=${log.status || 'success'}`);
      return info.lastInsertRowid;
    } catch (error) {
      logger.error(`记录采集日志失败: ${error.message}`);
      throw error;
    }
  } else {
    if (!memoryStore) throw new Error('内存存储未初始化');
    const newLog = {
      id: nextLogId++,
      site_name: log.site_name,
      crawl_time: log.crawl_time || new Date().toISOString(),
      total_count: log.total_count || 0,
      new_count: log.new_count || 0,
      filtered_count: log.filtered_count || 0,
      error_count: log.error_count || 0,
      status: log.status || 'success',
      duration_ms: log.duration_ms || 0
    };
    memoryStore.crawlLogs.push(newLog);
    logger.debug(`采集日志已记录: ${log.site_name}, 状态=${log.status || 'success'}`);
    return newLog.id;
  }
}

export function getCrawlStats(siteName, days = 7) {
  if (dbType === 'sqlite') {
    if (!db) throw new Error('数据库未初始化');
    try {
      const timeModifier = `-${days} days`;
      if (siteName) {
        const sql = `
          SELECT
            site_name,
            COUNT(*) as crawl_count,
            SUM(total_count) as total_items,
            SUM(new_count) as total_new,
            SUM(error_count) as total_errors,
            AVG(duration_ms) as avg_duration_ms,
            MAX(crawl_time) as last_crawl_time
          FROM crawl_logs
          WHERE site_name = ? AND crawl_time >= datetime('now', ?)
          GROUP BY site_name
        `;
        const stmt = db.prepare(sql);
        return stmt.get(siteName, timeModifier) || null;
      } else {
        const sql = `
          SELECT
            site_name,
            COUNT(*) as crawl_count,
            SUM(total_count) as total_items,
            SUM(new_count) as total_new,
            SUM(error_count) as total_errors,
            AVG(duration_ms) as avg_duration_ms,
            MAX(crawl_time) as last_crawl_time
          FROM crawl_logs
          WHERE crawl_time >= datetime('now', ?)
          GROUP BY site_name
          ORDER BY site_name
        `;
        const stmt = db.prepare(sql);
        return stmt.all(timeModifier);
      }
    } catch (error) {
      logger.error(`获取采集统计失败: ${error.message}`);
      throw error;
    }
  } else {
    if (!memoryStore) throw new Error('内存存储未初始化');
    const sinceTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const logs = memoryStore.crawlLogs.filter(l => l.crawl_time >= sinceTime);

    if (siteName) {
      const siteLogs = logs.filter(l => l.site_name === siteName);
      if (siteLogs.length === 0) return null;
      return {
        site_name: siteName,
        crawl_count: siteLogs.length,
        total_items: siteLogs.reduce((sum, l) => sum + l.total_count, 0),
        total_new: siteLogs.reduce((sum, l) => sum + l.new_count, 0),
        total_errors: siteLogs.reduce((sum, l) => sum + l.error_count, 0),
        avg_duration_ms: siteLogs.reduce((sum, l) => sum + l.duration_ms, 0) / siteLogs.length,
        last_crawl_time: Math.max(...siteLogs.map(l => new Date(l.crawl_time).getTime()))
      };
    } else {
      const grouped = {};
      for (const log of logs) {
        if (!grouped[log.site_name]) {
          grouped[log.site_name] = [];
        }
        grouped[log.site_name].push(log);
      }
      return Object.entries(grouped).map(([name, siteLogs]) => ({
        site_name: name,
        crawl_count: siteLogs.length,
        total_items: siteLogs.reduce((sum, l) => sum + l.total_count, 0),
        total_new: siteLogs.reduce((sum, l) => sum + l.new_count, 0),
        total_errors: siteLogs.reduce((sum, l) => sum + l.error_count, 0),
        avg_duration_ms: siteLogs.reduce((sum, l) => sum + l.duration_ms, 0) / siteLogs.length,
        last_crawl_time: Math.max(...siteLogs.map(l => new Date(l.crawl_time).getTime()))
      })).sort((a, b) => a.site_name.localeCompare(b.site_name));
    }
  }
}

export function getDailyNewCount(days = 30) {
  if (dbType === 'sqlite') {
    if (!db) throw new Error('数据库未初始化');
    try {
      const timeModifier = `-${days} days`;
      const sql = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM auctions
        WHERE created_at >= datetime('now', ?)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
      const stmt = db.prepare(sql);
      return stmt.all(timeModifier);
    } catch (error) {
      logger.error(`获取每日新增统计失败: ${error.message}`);
      throw error;
    }
  } else {
    if (!memoryStore) throw new Error('内存存储未初始化');
    const sinceTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dailyCounts = {};

    for (const auction of memoryStore.auctions) {
      const date = new Date(auction.created_at);
      if (date >= sinceTime) {
        const dateStr = date.toISOString().split('T')[0];
        dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
      }
    }

    return Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
}

export function getHighValueStats(threshold = 100000000) {
  const count = countAuctions({ minAssessPrice: threshold });
  return { threshold, count };
}

export function closeDb() {
  if (dbType === 'sqlite' && db) {
    try {
      db.close();
      db = null;
      logger.info('数据库连接已关闭');
    } catch (error) {
      logger.error(`关闭数据库失败: ${error.message}`);
      throw error;
    }
  } else if (dbType === 'memory' && memoryStore) {
    memoryStore = null;
    logger.info('内存存储已清除');
  }
  dbType = null;
}

export function getDb() {
  return db || memoryStore;
}

export function getDbType() {
  return dbType;
}

export default {
  initDb,
  insertOrUpdateAuction,
  batchInsertOrUpdate,
  getAuctionById,
  getAuctions,
  countAuctions,
  getAuctionChanges,
  getChangedAuctions,
  recordCrawlLog,
  getCrawlStats,
  getDailyNewCount,
  getHighValueStats,
  closeDb,
  getDb,
  getDbType
};
