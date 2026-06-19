const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const chalk = require('chalk');
const lockfile = require('proper-lockfile');
const axios = require('axios');

const {
  PLATFORMS,
  PLATFORM_NAMES,
  ORDER_STATUS,
  inventoryConfig,
  logisticsApiConfig,
  LOGISTICS_STATUS
} = require('./config');
const { getStorage } = require('./storage');
const { globalAlertManager } = require('./retryHandler');

const INVENTORY_OPERATIONS = {
  DEDUCT: 'deduct',
  ROLLBACK: 'rollback',
  RESTOCK: 'restock',
  ADJUST: 'adjust',
  SYNC: 'sync'
};

class DistributedLock {
  constructor(lockDir = inventoryConfig.lockDir) {
    this.lockDir = lockDir;
    this._heldLocks = new Map();
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.lockDir)) {
      fs.mkdirSync(this.lockDir, { recursive: true });
    }
  }

  _lockFilePath(resourceKey) {
    const safeName = resourceKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.lockDir, `${safeName}.lock`);
  }

  async acquire(resourceKey, timeoutMs = inventoryConfig.lockTimeoutMs) {
    if (this._heldLocks.has(resourceKey)) {
      return this._heldLocks.get(resourceKey);
    }

    const lockPath = this._lockFilePath(resourceKey);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const release = await lockfile.lock(lockPath, {
          stale: inventoryConfig.lockStaleMs,
          update: inventoryConfig.lockStaleMs / 2,
          retries: {
            retries: Math.floor(timeoutMs / 200),
            factor: 1,
            minTimeout: 100,
            maxTimeout: 500
          }
        });

        const lockHolder = {
          key: resourceKey,
          acquiredAt: Date.now(),
          release
        };

        this._heldLocks.set(resourceKey, lockHolder);
        return lockHolder;
      } catch (err) {
        if (Date.now() - startTime >= timeoutMs) {
          throw new Error(`获取锁超时: ${resourceKey}`);
        }
        await new Promise(r => setTimeout(r, 100));
      }
    }

    throw new Error(`获取锁失败: ${resourceKey}`);
  }

  async release(resourceKey) {
    const holder = this._heldLocks.get(resourceKey);
    if (!holder) return false;

    try {
      await holder.release();
    } catch (err) { /* ignore release errors */ }

    this._heldLocks.delete(resourceKey);
    return true;
  }

  async withLock(resourceKey, fn, timeoutMs) {
    const lock = await this.acquire(resourceKey, timeoutMs);
    try {
      return await fn(lock);
    } finally {
      await this.release(resourceKey);
    }
  }

  isHeld(resourceKey) {
    return this._heldLocks.has(resourceKey);
  }

  async releaseAll() {
    const keys = Array.from(this._heldLocks.keys());
    for (const key of keys) {
      await this.release(key);
    }
  }
}

class InventoryManager {
  constructor() {
    this.lockManager = new DistributedLock();
  }

  _buildSkuLockKey(sku) {
    return `inventory:sku:${sku}`;
  }

  _buildPlatformLockKey(platform, sku) {
    return `inventory:platform:${platform}:${sku}`;
  }

  async getInventory(sku, platform = null) {
    const storage = await getStorage();

    if (platform) {
      return storage._get(
        'SELECT * FROM inventory WHERE sku = ? AND platform = ?',
        [sku, platform]
      );
    }

    return storage._all(
      'SELECT * FROM inventory WHERE sku = ? ORDER BY platform',
      [sku]
    );
  }

  async getAllInventory(filters = {}) {
    const storage = await getStorage();
    const conditions = [];
    const params = [];

    if (filters.platform) {
      conditions.push('platform = ?');
      params.push(filters.platform);
    }
    if (filters.sku) {
      conditions.push('sku LIKE ?');
      params.push(`%${filters.sku}%`);
    }
    if (filters.onlyLowStock) {
      conditions.push(`available_quantity <= ${inventoryConfig.lowStockThreshold}`);
    }
    if (filters.onlyOutOfStock) {
      conditions.push(`available_quantity <= ${inventoryConfig.outOfStockThreshold}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return storage._all(`
      SELECT * FROM inventory
      ${where}
      ORDER BY updated_at DESC
      ${filters.limit ? `LIMIT ${parseInt(filters.limit)}` : ''}
    `, params);
  }

  async deductInventory(sku, quantity, context = {}) {
    const {
      platform = 'global',
      order_id = null,
      platform_order_id = null,
      reason = 'order_deduction',
      safeBuffer = inventoryConfig.safeInventoryBuffer
    } = context;

    if (!sku || quantity <= 0) {
      throw new Error('库存扣减参数无效: sku和quantity必须为正');
    }

    const lockKey = this._buildSkuLockKey(sku);

    return this.lockManager.withLock(lockKey, async () => {
      const storage = await getStorage();
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

      let record = await storage._get(
        'SELECT * FROM inventory WHERE sku = ? AND platform = ?',
        [sku, platform]
      );

      if (!record) {
        record = {
          sku,
          platform,
          available_quantity: 0,
          reserved_quantity: 0,
          total_quantity: 0
        };
      }

      const available = record.available_quantity || 0;
      const required = quantity + safeBuffer;

      if (available < required) {
        await this._logOperation({
          sku, platform, quantity, operation: INVENTORY_OPERATIONS.DEDUCT,
          status: 'failed',
          before_available: available,
          after_available: available,
          reason,
          order_id,
          platform_order_id,
          error: `库存不足: 需要${required}，可用${available}`
        });

        if (available <= inventoryConfig.outOfStockThreshold) {
          await globalAlertManager.alertSystemError(
            new Error(`缺货预警: SKU ${sku} (平台: ${PLATFORM_NAMES[platform] || platform}) 库存为 ${available}`),
            { type: 'out_of_stock', sku, platform, available }
          );
        }

        throw new Error(`库存不足: SKU ${sku}, 需要 ${required}, 可用 ${available}`);
      }

      const newAvailable = available - quantity;
      const newReserved = (record.reserved_quantity || 0) + quantity;

      if (record.id) {
        await storage._run(`
          UPDATE inventory
          SET available_quantity = ?, reserved_quantity = ?, updated_at = ?, last_sync_at = ?
          WHERE id = ?
        `, [newAvailable, newReserved, now, now, record.id]);
      } else {
        await storage._run(`
          INSERT INTO inventory (sku, platform, available_quantity, reserved_quantity, total_quantity, created_at, updated_at, last_sync_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [sku, platform, newAvailable, newReserved, newAvailable + newReserved, now, now, now]);
      }

      await this._logOperation({
        sku, platform, quantity, operation: INVENTORY_OPERATIONS.DEDUCT,
        status: 'success',
        before_available: available,
        after_available: newAvailable,
        reason,
        order_id,
        platform_order_id
      });

      if (newAvailable <= inventoryConfig.lowStockThreshold) {
        console.log(chalk.yellow(`[库存预警] SKU ${sku} (${PLATFORM_NAMES[platform] || platform}) 可用库存降至 ${newAvailable}`));
      }

      return {
        sku,
        platform,
        before: available,
        after: newAvailable,
        deducted: quantity,
        success: true
      };
    });
  }

  async rollbackInventory(sku, quantity, context = {}) {
    const {
      platform = 'global',
      order_id = null,
      platform_order_id = null,
      reason = 'order_cancelled'
    } = context;

    if (!sku || quantity <= 0) {
      throw new Error('库存回滚参数无效');
    }

    const lockKey = this._buildSkuLockKey(sku);

    return this.lockManager.withLock(lockKey, async () => {
      const storage = await getStorage();
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

      let record = await storage._get(
        'SELECT * FROM inventory WHERE sku = ? AND platform = ?',
        [sku, platform]
      );

      if (!record) {
        await storage._run(`
          INSERT INTO inventory (sku, platform, available_quantity, reserved_quantity, total_quantity, created_at, updated_at, last_sync_at)
          VALUES (?, ?, ?, 0, ?, ?, ?, ?)
        `, [sku, platform, quantity, quantity, now, now, now]);

        await this._logOperation({
          sku, platform, quantity, operation: INVENTORY_OPERATIONS.ROLLBACK,
          status: 'success',
          before_available: 0,
          after_available: quantity,
          reason, order_id, platform_order_id
        });

        return { sku, platform, before: 0, after: quantity, rolledBack: quantity, success: true };
      }

      const beforeAvailable = record.available_quantity || 0;
      const beforeReserved = record.reserved_quantity || 0;
      const rollbackQty = Math.min(quantity, beforeReserved);
      const newAvailable = beforeAvailable + rollbackQty;
      const newReserved = beforeReserved - rollbackQty;

      await storage._run(`
        UPDATE inventory SET available_quantity = ?, reserved_quantity = ?, updated_at = ?, last_sync_at = ?
        WHERE id = ?
      `, [newAvailable, newReserved, now, now, record.id]);

      await this._logOperation({
        sku, platform, quantity: rollbackQty, operation: INVENTORY_OPERATIONS.ROLLBACK,
        status: 'success',
        before_available: beforeAvailable,
        after_available: newAvailable,
        reason, order_id, platform_order_id
      });

      return {
        sku, platform,
        before: beforeAvailable, after: newAvailable,
        rolledBack: rollbackQty, success: true
      };
    });
  }

  async restockInventory(sku, quantity, context = {}) {
    const {
      platform = 'global',
      reason = 'manual_restock',
      supplier = null,
      purchase_order_id = null
    } = context;

    if (!sku || quantity <= 0) throw new Error('补货参数无效');

    const lockKey = this._buildSkuLockKey(sku);

    return this.lockManager.withLock(lockKey, async () => {
      const storage = await getStorage();
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

      let record = await storage._get(
        'SELECT * FROM inventory WHERE sku = ? AND platform = ?',
        [sku, platform]
      );

      let beforeAvailable, afterAvailable, afterTotal;

      if (record) {
        beforeAvailable = record.available_quantity || 0;
        afterAvailable = beforeAvailable + quantity;
        afterTotal = (record.total_quantity || 0) + quantity;

        await storage._run(`
          UPDATE inventory SET available_quantity = ?, total_quantity = ?, updated_at = ?, last_sync_at = ?
          WHERE id = ?
        `, [afterAvailable, afterTotal, now, now, record.id]);
      } else {
        beforeAvailable = 0;
        afterAvailable = quantity;
        afterTotal = quantity;

        await storage._run(`
          INSERT INTO inventory (sku, platform, available_quantity, reserved_quantity, total_quantity, created_at, updated_at, last_sync_at)
          VALUES (?, ?, ?, 0, ?, ?, ?, ?)
        `, [sku, platform, afterAvailable, afterTotal, now, now, now]);
      }

      await this._logOperation({
        sku, platform, quantity, operation: INVENTORY_OPERATIONS.RESTOCK,
        status: 'success',
        before_available: beforeAvailable,
        after_available: afterAvailable,
        reason, supplier, purchase_order_id
      });

      return {
        sku, platform,
        before: beforeAvailable, after: afterAvailable,
        restocked: quantity, success: true
      };
    });
  }

  async adjustInventory(sku, newQuantity, context = {}) {
    const {
      platform = 'global',
      reason = 'manual_adjust',
      note = null
    } = context;

    if (!sku || newQuantity < 0) throw new Error('调整参数无效');

    const lockKey = this._buildSkuLockKey(sku);

    return this.lockManager.withLock(lockKey, async () => {
      const storage = await getStorage();
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

      let record = await storage._get(
        'SELECT * FROM inventory WHERE sku = ? AND platform = ?',
        [sku, platform]
      );

      const before = record ? (record.available_quantity || 0) : 0;
      const delta = newQuantity - before;

      if (record) {
        await storage._run(`
          UPDATE inventory SET available_quantity = ?, total_quantity = ?, updated_at = ?, last_sync_at = ?
          WHERE id = ?
        `, [newQuantity, Math.max(0, newQuantity + (record.reserved_quantity || 0)), now, now, record.id]);
      } else {
        await storage._run(`
          INSERT INTO inventory (sku, platform, available_quantity, reserved_quantity, total_quantity, created_at, updated_at, last_sync_at)
          VALUES (?, ?, ?, 0, ?, ?, ?, ?)
        `, [sku, platform, newQuantity, newQuantity, now, now, now]);
      }

      await this._logOperation({
        sku, platform, quantity: Math.abs(delta), operation: INVENTORY_OPERATIONS.ADJUST,
        status: 'success',
        before_available: before,
        after_available: newQuantity,
        reason, note
      });

      return {
        sku, platform, before, after: newQuantity, delta, success: true
      };
    });
  }

  async deductInventoryForOrder(orderId) {
    if (!inventoryConfig.autoDeductOnShipment) {
      return { skipped: true, reason: 'auto_deduct_disabled' };
    }

    const storage = await getStorage();
    const order = await storage._get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) throw new Error(`订单不存在: ${orderId}`);

    if (order.status !== ORDER_STATUS.SHIPPED && order.status !== ORDER_STATUS.PENDING_SHIPMENT) {
      return { skipped: true, reason: `order_status_${order.status}` };
    }

    const items = await storage._all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    const results = [];

    for (const item of items) {
      if (!item.sku) continue;
      try {
        const result = await this.deductInventory(item.sku, item.quantity || 1, {
          platform: order.platform,
          order_id: orderId,
          platform_order_id: order.platform_order_id,
          reason: 'order_shipment'
        });
        results.push(result);
      } catch (err) {
        results.push({ sku: item.sku, success: false, error: err.message });
      }
    }

    return { orderId, results, successCount: results.filter(r => r.success).length };
  }

  async rollbackInventoryForOrder(orderId) {
    if (!inventoryConfig.autoRollbackOnCancellation) {
      return { skipped: true, reason: 'auto_rollback_disabled' };
    }

    const storage = await getStorage();
    const order = await storage._get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) throw new Error(`订单不存在: ${orderId}`);

    if (order.status !== ORDER_STATUS.CANCELLED && order.status !== ORDER_STATUS.RETURNED) {
      return { skipped: true, reason: `order_status_${order.status}` };
    }

    const items = await storage._all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    const results = [];

    for (const item of items) {
      if (!item.sku) continue;
      try {
        const result = await this.rollbackInventory(item.sku, item.quantity || 1, {
          platform: order.platform,
          order_id: orderId,
          platform_order_id: order.platform_order_id,
          reason: order.status === ORDER_STATUS.RETURNED ? 'order_returned' : 'order_cancelled'
        });
        results.push(result);
      } catch (err) {
        results.push({ sku: item.sku, success: false, error: err.message });
      }
    }

    return { orderId, results, successCount: results.filter(r => r.success).length };
  }

  async syncPlatformInventory(platform) {
    if (!PLATFORMS.includes(platform)) throw new Error(`未知平台: ${platform}`);
    if (!inventoryConfig.platforms[platform]?.enabled) {
      return { skipped: true, reason: `platform_${platform}_disabled` };
    }

    console.log(chalk.cyan(`[库存同步] 开始同步 ${PLATFORM_NAMES[platform]} 平台库存...`));

    const storage = await getStorage();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const syncedSkus = [];
    const failedSkus = [];

    const existingInventory = await storage._all(
      'SELECT * FROM inventory WHERE platform = ?', [platform]
    );

    for (const inv of existingInventory) {
      const lockKey = this._buildPlatformLockKey(platform, inv.sku);

      try {
        await this.lockManager.withLock(lockKey, async () => {
          const remoteQty = await this._fetchRemoteInventory(platform, inv.sku);

          if (remoteQty !== null && remoteQty !== inv.available_quantity) {
            await storage._run(
              'UPDATE inventory SET available_quantity = ?, last_sync_at = ?, remote_quantity = ?, sync_status = ? WHERE id = ?',
              [remoteQty, now, remoteQty, 'synced', inv.id]
            );
            syncedSkus.push({ sku: inv.sku, before: inv.available_quantity, after: remoteQty });
          } else {
            await storage._run(
              'UPDATE inventory SET last_sync_at = ?, sync_status = ? WHERE id = ?',
              [now, 'up_to_date', inv.id]
            );
          }
        });
      } catch (err) {
        failedSkus.push({ sku: inv.sku, error: err.message });
        await storage._run(
          'UPDATE inventory SET sync_status = ?, sync_error = ?, last_sync_at = ? WHERE id = ?',
          ['failed', err.message.substring(0, 500), now, inv.id]
        );
      }
    }

    await this._logOperation({
      sku: '*', platform,
      quantity: syncedSkus.length,
      operation: INVENTORY_OPERATIONS.SYNC,
      status: failedSkus.length === 0 ? 'success' : 'partial',
      before_available: 0, after_available: 0,
      reason: 'platform_sync',
      error: failedSkus.length > 0 ? `${failedSkus.length} SKU(s) failed` : null
    });

    const summary = {
      platform,
      total: existingInventory.length,
      synced: syncedSkus.length,
      upToDate: existingInventory.length - syncedSkus.length - failedSkus.length,
      failed: failedSkus.length,
      syncedSkus,
      failedSkus
    };

    console.log(chalk.green(`[库存同步] ${PLATFORM_NAMES[platform]} 完成: 同步 ${summary.synced}, 最新 ${summary.upToDate}, 失败 ${summary.failed}`));

    return summary;
  }

  async syncAllPlatforms() {
    const results = {};

    for (const platform of PLATFORMS) {
      try {
        results[platform] = await this.syncPlatformInventory(platform);
      } catch (err) {
        results[platform] = { success: false, error: err.message };
      }
    }

    return results;
  }

  async _fetchRemoteInventory(platform, sku) {
    try {
      const apiConfig = {
        amazon: { endpoint: `https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/${sku}`, key: process.env.AMAZON_SP_API_KEY },
        ebay: { endpoint: `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, key: process.env.EBAY_API_TOKEN },
        shopee: { endpoint: `https://partner.shopeemobile.com/api/v2/product/get_item_base_info?item_id=${sku}`, key: process.env.SHOPEE_PARTNER_KEY },
        lazada: { endpoint: `https://api.lazada.com/rest/products/get?sku_seller_list=${sku}`, key: process.env.LAZADA_API_KEY },
        wish: { endpoint: `https://merchant.wish.com/api/v2/product/multi-get?sku=${sku}`, key: process.env.WISH_API_KEY },
        aliexpress: { endpoint: `https://openapi.aliexpress.com/api/v1/product/list?sku=${sku}`, key: process.env.ALIEXPRESS_API_KEY }
      };

      const cfg = apiConfig[platform];
      if (!cfg?.key) {
        return null;
      }

      const resp = await axios.get(cfg.endpoint, {
        headers: {
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const qty = this._extractInventoryFromApiResponse(platform, resp.data, sku);
      return qty;
    } catch (err) {
      return null;
    }
  }

  _extractInventoryFromApiResponse(platform, data, sku) {
    try {
      switch (platform) {
        case 'amazon':
          return data?.summaries?.[0]?.inventory?.[0]?.quantity || null;
        case 'ebay':
          return data?.availability?.shipToLocationAvailability?.quantity || null;
        case 'shopee':
          return data?.response?.item_list?.[0]?.stock || null;
        case 'lazada':
          return data?.data?.products?.[0]?.skus?.[0]?.quantity || null;
        case 'wish':
          return data?.data?.[0]?.inventory || null;
        case 'aliexpress':
          return data?.aliexpress_affiliate_product_query_response?.products?.product?.[0]?.quantity || null;
        default:
          return null;
      }
    } catch (err) {
      return null;
    }
  }

  async _logOperation(logData) {
    const storage = await getStorage();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    return storage._run(`
      INSERT INTO inventory_logs (
        sku, platform, operation, quantity, status,
        before_available, after_available,
        order_id, platform_order_id,
        reason, note, supplier, purchase_order_id,
        error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      logData.sku,
      logData.platform,
      logData.operation,
      logData.quantity || 0,
      logData.status,
      logData.before_available ?? null,
      logData.after_available ?? null,
      logData.order_id || null,
      logData.platform_order_id || null,
      logData.reason || null,
      logData.note || null,
      logData.supplier || null,
      logData.purchase_order_id || null,
      logData.error || null,
      now
    ]);
  }

  async getInventoryLogs(filters = {}, limit = 100) {
    const storage = await getStorage();
    const conditions = [];
    const params = [];

    if (filters.sku) { conditions.push('sku = ?'); params.push(filters.sku); }
    if (filters.platform) { conditions.push('platform = ?'); params.push(filters.platform); }
    if (filters.operation) { conditions.push('operation = ?'); params.push(filters.operation); }
    if (filters.startDate) { conditions.push('created_at >= ?'); params.push(filters.startDate); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return storage._all(`
      SELECT * FROM inventory_logs
      ${where}
      ORDER BY id DESC
      LIMIT ${parseInt(limit)}
    `, params);
  }

  async getLowStockItems(platform = null, threshold = inventoryConfig.lowStockThreshold) {
    const storage = await getStorage();
    const conditions = ['available_quantity <= ?'];
    const params = [threshold];

    if (platform) {
      conditions.push('platform = ?');
      params.push(platform);
    }

    return storage._all(`
      SELECT * FROM inventory
      WHERE ${conditions.join(' AND ')}
      ORDER BY available_quantity ASC
    `, params);
  }

  async cleanupStaleLocks() {
    try {
      const files = fs.readdirSync(this.lockManager.lockDir);
      let cleaned = 0;

      for (const file of files) {
        if (!file.endsWith('.lock')) continue;
        const filePath = path.join(this.lockManager.lockDir, file);
        try {
          const stat = fs.statSync(filePath);
          const ageMs = Date.now() - stat.mtimeMs;
          if (ageMs > inventoryConfig.lockStaleMs * 2) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch (err) { /* skip */ }
      }

      return cleaned;
    } catch (err) {
      return 0;
    }
  }
}

let inventoryManagerInstance = null;

function getInventoryManager() {
  if (!inventoryManagerInstance) {
    inventoryManagerInstance = new InventoryManager();
  }
  return inventoryManagerInstance;
}

module.exports = {
  DistributedLock,
  InventoryManager,
  INVENTORY_OPERATIONS,
  getInventoryManager
};
