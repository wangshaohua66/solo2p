/**
 * Migration: create_users_table
 * Version: 20260617181949
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
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.query(`CREATE INDEX idx_users_email ON users(email)`);
}

/**
 * Rollback the migration
 * @param {import('../core/database')} db - Database manager instance
 */
async function down(db) {
  await db.query('DROP INDEX IF EXISTS idx_users_email');
  await db.query('DROP TABLE IF EXISTS users');
}

module.exports = { up, down };
