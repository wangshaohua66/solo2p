const { initDatabase, getDb } = require('../src/models/db');
const fs = require('fs');
const path = require('path');

describe('数据库初始化测试', () => {
  beforeAll(() => {
    const dbPath = path.join(__dirname, '../data/blood_center.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    initDatabase();
  });

  test('数据库初始化成功', () => {
    const db = getDb();
    expect(db).toBeDefined();
    expect(db.open).toBe(true);
  });

  test('所有核心表已创建', () => {
    const db = getDb();
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();

    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('hospitals');
    expect(tableNames).toContain('donors');
    expect(tableNames).toContain('blocklist');
    expect(tableNames).toContain('donor_screenings');
    expect(tableNames).toContain('blood_bags');
    expect(tableNames).toContain('test_records');
    expect(tableNames).toContain('component_products');
    expect(tableNames).toContain('inventory_batches');
    expect(tableNames).toContain('blood_requests');
    expect(tableNames).toContain('matching_results');
    expect(tableNames).toContain('delivery_tasks');
    expect(tableNames).toContain('delivery_confirmations');
    expect(tableNames).toContain('safety_stock_thresholds');

    expect(tableNames.length).toBeGreaterThanOrEqual(14);
  });

  test('医院种子数据已插入 - 18家医院', () => {
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as cnt FROM hospitals').get().cnt;
    expect(count).toBe(18);
  });

  test('用户种子数据已插入 - 6个角色用户', () => {
    const db = getDb();
    const users = db.prepare('SELECT role, COUNT(*) as cnt FROM users GROUP BY role').all();
    const roles = users.map(u => u.role);

    expect(roles).toContain('nurse');
    expect(roles).toContain('technician');
    expect(roles).toContain('preparator');
    expect(roles).toContain('inventory');
    expect(roles).toContain('dispatcher');
    expect(roles).toContain('hospital');
  });

  test('安全库存阈值已初始化 - 32条(4ABO x 2Rh x 4成分类型', () => {
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as cnt FROM safety_stock_thresholds').get().cnt;
    expect(count).toBe(32);
  });

  test('外键约束已启用', () => {
    const db = getDb();
    const result = db.prepare('PRAGMA foreign_keys').get();
    expect(result['foreign_keys']).toBe(1);
  });

  test('索引已创建', () => {
    const db = getDb();
    const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`).all();
    expect(indexes.length).toBeGreaterThan(10);
  });

  test('WAL模式已启用', () => {
    const db = getDb();
    const result = db.prepare('PRAGMA journal_mode').get();
    expect(result['journal_mode']).toBe('wal');
  });
});
