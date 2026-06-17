/**
 * Migration: add_orders_table
 * Version: 20260617182152
 * Description: Add your description here
 * Dependencies: 
 */

'use strict';

/**
 * Apply the migration
 * @param {import('../core/database')} db - Database manager instance
 */
async function up(db) {
  await db.query(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  await db.query('CREATE INDEX idx_orders_user_id ON orders(user_id)');
}

/**
 * Rollback the migration
 * @param {import('../core/database')} db - Database manager instance
 */
async function down(db) {
  await db.query('DROP TABLE IF EXISTS orders');
}

module.exports = { up, down };
