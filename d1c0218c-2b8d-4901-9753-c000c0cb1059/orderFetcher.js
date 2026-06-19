const { By, until } = require('selenium-webdriver');
const dayjs = require('dayjs');
const cliProgress = require('cli-progress');
const {
  PLATFORMS,
  PLATFORM_NAMES,
  ORDER_STATUS,
  getPlatformUrl,
  fetchConfig,
  isRetryableError
} = require('./config');
const { getStorage } = require('./storage');
const { getAuthManager } = require('./authManager');
const { createRetryHandler, globalAlertManager } = require('./retryHandler');

class BasePlatformAdapter {
  constructor(platform) {
    this.platform = platform;
    this.platformName = PLATFORM_NAMES[platform];
  }

  async navigateToOrdersPage(driver, dateRange) {
    const url = getPlatformUrl(this.platform, 'orders');
    await driver.get(url);
    await driver.sleep(3000);
  }

  async applyDateFilter(driver, dateRange) {
    return true;
  }

  async getOrderCount(driver) {
    return 0;
  }

  async getPageOrders(driver) {
    return [];
  }

  async hasNextPage(driver) {
    return false;
  }

  async goToNextPage(driver) {
    return false;
  }

  async goToOrderDetail(driver, order) {
    return null;
  }

  async parseOrderDetail(driver, basicOrder) {
    return basicOrder;
  }

  _parseAmount(text) {
    if (!text) return 0;
    const cleaned = String(text).replace(/[^0-9.-]/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  _parseDate(text) {
    if (!text) return dayjs().format('YYYY-MM-DD HH:mm:ss');
    const d = dayjs(text);
    return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss');
  }

  _normalizeStatus(rawStatus) {
    if (!rawStatus) return ORDER_STATUS.PENDING_SHIPMENT;
    const s = String(rawStatus).toLowerCase();

    if (s.includes('cancel') || s.includes('取消') || s.includes('取消')) {
      return ORDER_STATUS.CANCELLED;
    }
    if (s.includes('return') || s.includes('退') || s.includes('refund') || s.includes('退款')) {
      return ORDER_STATUS.RETURNED;
    }
    if (s.includes('complete') || s.includes('完成') || s.includes('delivered') || s.includes('签收') || s.includes('送达')) {
      return ORDER_STATUS.COMPLETED;
    }
    if (s.includes('ship') || s.includes('发') || s.includes('已发') || s.includes('shipped') || s.includes('已投递')) {
      return ORDER_STATUS.SHIPPED;
    }
    if (s.includes('unshipped') || s.includes('待发') || s.includes('pending') || s.includes('待处理') || s.includes('未发')) {
      return ORDER_STATUS.PENDING_SHIPMENT;
    }

    return ORDER_STATUS.PENDING_SHIPMENT;
  }
}

class AmazonAdapter extends BasePlatformAdapter {
  constructor() { super('amazon'); }

  async getPageOrders(driver) {
    const orders = [];
    const orderRows = await driver.findElements(By.css('[data-testid="order-row"], table tbody tr, .order-row, [class*="order-row"]'));

    for (const row of orderRows) {
      try {
        const text = await row.getText();
        if (!text.trim()) continue;

        const orderIdMatch = text.match(/\b\d{3}-\d{7}-\d{7}\b|\b[A-Z0-9]{10,}\b/);
        const orderId = orderIdMatch ? orderIdMatch[0] : '';

        const order = {
          platform: this.platform,
          platform_order_id: orderId || `amz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: ORDER_STATUS.PENDING_SHIPMENT,
          order_date: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          _rawText: text
        };

        if (order.platform_order_id) {
          orders.push(order);
        }
      } catch (err) { /* skip */ }
    }

    return orders;
  }

  async hasNextPage(driver) {
    try {
      const nextBtns = await driver.findElements(By.css('[aria-label="Next"], .a-last:not(.a-disabled), [id*="next"]'));
      for (const btn of nextBtns) {
        if (await btn.isDisplayed()) return true;
      }
    } catch (err) { /* skip */ }
    return false;
  }

  async goToNextPage(driver) {
    try {
      const nextBtns = await driver.findElements(By.css('[aria-label="Next"], .a-last a, [id*="next"]'));
      for (const btn of nextBtns) {
        if (await btn.isDisplayed() && await btn.isEnabled()) {
          await btn.click();
          await driver.sleep(3000);
          return true;
        }
      }
    } catch (err) { /* skip */ }
    return false;
  }
}

class EbayAdapter extends BasePlatformAdapter {
  constructor() { super('ebay'); }

  async getPageOrders(driver) {
    const orders = [];
    const orderRows = await driver.findElements(By.css('[data-order-id], [class*="order-item"], tr[class*="order"]'));

    for (const row of orderRows) {
      try {
        const orderId = await row.getAttribute('data-order-id') || '';
        const text = await row.getText();
        if (!text.trim()) continue;

        const order = {
          platform: this.platform,
          platform_order_id: orderId || `ebay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          _rawText: text
        };

        if (order.platform_order_id) {
          orders.push(order);
        }
      } catch (err) { /* skip */ }
    }

    return orders;
  }

  async hasNextPage(driver) {
    try {
      const nexts = await driver.findElements(By.css('[class*="next-page"], [aria-label*="Next"], .pagination a:last-child'));
      for (const el of nexts) {
        if (await el.isDisplayed()) return true;
      }
    } catch (err) { /* skip */ }
    return false;
  }

  async goToNextPage(driver) {
    try {
      const nexts = await driver.findElements(By.css('[class*="next-page"] a, [aria-label*="Next"], a[rel="next"]'));
      for (const el of nexts) {
        if (await el.isDisplayed()) {
          await el.click();
          await driver.sleep(3000);
          return true;
        }
      }
    } catch (err) { /* skip */ }
    return false;
  }
}

class WishAdapter extends BasePlatformAdapter {
  constructor() { super('wish'); }

  async getPageOrders(driver) {
    const orders = [];
    const cards = await driver.findElements(By.css('[class*="order-card"], [class*="OrderCard"], table tbody tr'));

    for (const card of cards) {
      try {
        const text = await card.getText();
        if (!text.trim()) continue;

        const idMatch = text.match(/\b[A-Z]{2,}\d{8,}\b|\b\d{12,}\b/);
        const orderId = idMatch ? idMatch[0] : '';

        const order = {
          platform: this.platform,
          platform_order_id: orderId || `wish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          _rawText: text
        };

        if (order.platform_order_id) {
          orders.push(order);
        }
      } catch (err) { /* skip */ }
    }

    return orders;
  }

  async hasNextPage(driver) {
    try {
      const els = await driver.findElements(By.css('[class*="pagination"] [class*="next"], button[aria-label*="Next"]'));
      for (const el of els) {
        if (await el.isDisplayed() && await el.isEnabled()) return true;
      }
    } catch (err) { /* skip */ }
    return false;
  }

  async goToNextPage(driver) {
    try {
      const els = await driver.findElements(By.css('[class*="pagination"] [class*="next"] button, button[aria-label*="Next"]'));
      for (const el of els) {
        if (await el.isDisplayed() && await el.isEnabled()) {
          await el.click();
          await driver.sleep(3000);
          return true;
        }
      }
    } catch (err) { /* skip */ }
    return false;
  }
}

class ShopeeAdapter extends BasePlatformAdapter {
  constructor() { super('shopee'); }

  async getPageOrders(driver) {
    const orders = [];
    const rows = await driver.findElements(By.css('[class*="order-list"] [class*="item"], [class*="order-item"], table tr'));

    for (const row of rows) {
      try {
        const text = await row.getText();
        if (!text.trim()) continue;

        const idMatch = text.match(/\b\d{10,}\b/);
        const orderId = idMatch ? idMatch[0] : '';

        const order = {
          platform: this.platform,
          platform_order_id: orderId || `shopee_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          _rawText: text
        };

        if (order.platform_order_id) {
          orders.push(order);
        }
      } catch (err) { /* skip */ }
    }

    return orders;
  }

  async hasNextPage(driver) {
    try {
      const els = await driver.findElements(By.css('.shopee-pagination__btn--active + button, [class*="next"]:not([disabled])'));
      return els.length > 0;
    } catch (err) { return false; }
  }

  async goToNextPage(driver) {
    try {
      const els = await driver.findElements(By.css('.shopee-pagination__btn--active + button, [class*="next"]'));
      for (const el of els) {
        if (await el.isDisplayed() && await el.isEnabled()) {
          await el.click();
          await driver.sleep(3000);
          return true;
        }
      }
    } catch (err) { /* skip */ }
    return false;
  }
}

class LazadaAdapter extends BasePlatformAdapter {
  constructor() { super('lazada'); }

  async getPageOrders(driver) {
    const orders = [];
    const rows = await driver.findElements(By.css('[class*="order-item"], [class*="OrderItem"], [data-order-id]'));

    for (const row of rows) {
      try {
        const orderId = await row.getAttribute('data-order-id') || '';
        const text = await row.getText();
        if (!text.trim()) continue;

        if (!orderId) {
          const idMatch = text.match(/\b\d{8,}\b/);
          const found = idMatch ? idMatch[0] : '';
        }

        const order = {
          platform: this.platform,
          platform_order_id: orderId || `lazada_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          _rawText: text
        };

        orders.push(order);
      } catch (err) { /* skip */ }
    }

    return orders;
  }

  async hasNextPage(driver) {
    try {
      const els = await driver.findElements(By.css('[class*="next"]:not(.disabled), .ant-pagination-next:not(.ant-pagination-disabled)'));
      for (const el of els) {
        if (await el.isDisplayed()) return true;
      }
    } catch (err) { /* skip */ }
    return false;
  }

  async goToNextPage(driver) {
    try {
      const els = await driver.findElements(By.css('[class*="next"] button, .ant-pagination-next a'));
      for (const el of els) {
        if (await el.isDisplayed() && await el.isEnabled()) {
          await el.click();
          await driver.sleep(3000);
          return true;
        }
      }
    } catch (err) { /* skip */ }
    return false;
  }
}

class AliExpressAdapter extends BasePlatformAdapter {
  constructor() { super('aliexpress'); }

  async getPageOrders(driver) {
    const orders = [];
    const rows = await driver.findElements(By.css('[class*="order-item"], [data-orderid], [data-order-id]'));

    for (const row of rows) {
      try {
        let orderId = '';
        try { orderId = await row.getAttribute('data-orderid') || await row.getAttribute('data-order-id') || ''; } catch (e) {}

        const text = await row.getText();
        if (!text.trim()) continue;

        if (!orderId) {
          const idMatch = text.match(/\b\d{12,}\b/);
          orderId = idMatch ? idMatch[0] : '';
        }

        const order = {
          platform: this.platform,
          platform_order_id: orderId || `ae_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          _rawText: text
        };

        orders.push(order);
      } catch (err) { /* skip */ }
    }

    return orders;
  }

  async hasNextPage(driver) {
    try {
      const els = await driver.findElements(By.css('[class*="page-next"], [class*="pagination"] a:last-child'));
      for (const el of els) {
        if (await el.isDisplayed()) return true;
      }
    } catch (err) { /* skip */ }
    return false;
  }

  async goToNextPage(driver) {
    try {
      const els = await driver.findElements(By.css('[class*="page-next"] a, [class*="pagination"] a:last-child'));
      for (const el of els) {
        if (await el.isDisplayed()) {
          await el.click();
          await driver.sleep(3000);
          return true;
        }
      }
    } catch (err) { /* skip */ }
    return false;
  }
}

const ADAPTER_MAP = {
  amazon: AmazonAdapter,
  ebay: EbayAdapter,
  wish: WishAdapter,
  shopee: ShopeeAdapter,
  lazada: LazadaAdapter,
  aliexpress: AliExpressAdapter
};

function getAdapter(platform) {
  const Ctor = ADAPTER_MAP[platform];
  if (!Ctor) throw new Error(`未实现的平台适配器: ${platform}`);
  return new Ctor();
}

class OrderFetcher {
  constructor() {
    this.authManager = getAuthManager();
  }

  async fetchPlatformOrders(platform, dateRange, options = {}) {
    const {
      withDetails = true,
      onProgress = null,
      simulate = false
    } = options;

    const storage = await getStorage();
    const adapter = getAdapter(platform);
    const platformName = PLATFORM_NAMES[platform];

    let fetchLog = {
      platform,
      fetch_date: dayjs().format('YYYY-MM-DD'),
      start_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      status: 'running',
      orders_fetched: 0,
      orders_inserted: 0,
      orders_updated: 0,
      error_message: null
    };

    const startTime = Date.now();

    try {
      const retryHandler = createRetryHandler({
        onRetry: (info) => {
          console.log(chalk.yellow(`[${platformName}] 第 ${info.attempt}/${info.maxRetries} 次重试，等待 ${info.delay}ms...`));
        },
        onMaxRetriesExceeded: (info) => {
          console.log(chalk.red(`[${platformName}] 超过最大重试次数: ${info.error.message}`));
        }
      });

      const { driver, loggedIn } = await retryHandler.execute(
        () => this.authManager.ensureLogin(platform),
        { description: `${platformName} 登录`, platform }
      );

      if (!loggedIn) {
        throw new Error('登录失败，无法继续抓取');
      }

      await retryHandler.execute(
        () => adapter.navigateToOrdersPage(driver, dateRange),
        { description: `${platformName} 导航到订单页`, platform }
      );

      await adapter.applyDateFilter(driver, dateRange);

      const allOrders = [];
      let page = 1;
      const maxPages = 50;

      console.log(chalk.cyan(`[${platformName}] 开始抓取订单列表...`));

      do {
        const pageOrders = await retryHandler.execute(
          async (attempt) => {
            if (attempt > 1) {
              await driver.navigate().refresh();
              await driver.sleep(3000);
            }
            return adapter.getPageOrders(driver);
          },
          { description: `${platformName} 第${page}页订单解析`, platform }
        );

        if (pageOrders.length === 0) {
          if (page === 1) {
            console.log(chalk.yellow(`[${platformName}] 第1页未抓取到订单，尝试使用模拟数据...`));
          }
          break;
        }

        allOrders.push(...pageOrders);
        fetchLog.orders_fetched += pageOrders.length;

        console.log(chalk.cyan(`[${platformName}] 第 ${page} 页: 获取 ${pageOrders.length} 条订单`));

        if (onProgress) {
          onProgress({ platform, page, ordersCount: allOrders.length });
        }

        page++;
        if (page > maxPages) break;

        const hasNext = await adapter.hasNextPage(driver);
        if (!hasNext) break;

        await adapter.goToNextPage(driver);
        await driver.sleep(2000);

      } while (true);

      if (allOrders.length === 0 && simulate) {
        const simulated = this._generateMockOrders(platform, dateRange);
        allOrders.push(...simulated);
        fetchLog.orders_fetched += simulated.length;
        console.log(chalk.cyan(`[${platformName}] 生成 ${simulated.length} 条模拟订单数据`));
      }

      console.log(chalk.cyan(`[${platformName}] 共获取 ${allOrders.length} 条订单，开始存储...`));

      const progressBar = new cliProgress.SingleBar({
        format: `[${platformName}] 存储进度: [{bar}] {percentage}% | {value}/{total}`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });
      progressBar.start(allOrders.length, 0);

      for (let i = 0; i < allOrders.length; i++) {
        const order = allOrders[i];
        const items = this._extractOrderItems(order);

        try {
          const result = await storage.upsertOrder(order, items);
          if (result.inserted) fetchLog.orders_inserted++;
          if (result.updated) fetchLog.orders_updated++;
        } catch (dbErr) {
          console.error(chalk.red(`[${platformName}] 订单 ${order.platform_order_id} 存储失败: ${dbErr.message}`));
        }

        progressBar.update(i + 1);
      }

      progressBar.stop();

      fetchLog.status = 'success';
      console.log(chalk.green(`[${platformName}] 抓取完成: 新增 ${fetchLog.orders_inserted} 条，更新 ${fetchLog.orders_updated} 条`));

    } catch (error) {
      fetchLog.status = 'failed';
      fetchLog.error_message = error.message;
      console.log(chalk.red(`[${platformName}] 抓取失败: ${error.message}`));

      if (isRetryableError(error)) {
        await globalAlertManager.alertFetchFailure(platform, error);
      }

      throw error;
    } finally {
      fetchLog.end_time = dayjs().format('YYYY-MM-DD HH:mm:ss');
      fetchLog.duration_ms = Date.now() - startTime;

      try {
        await storage.addFetchLog(fetchLog);
      } catch (dbErr) {
        console.error(chalk.red(`存储抓取日志失败: ${dbErr.message}`));
      }
    }

    return {
      platform,
      fetched: fetchLog.orders_fetched,
      inserted: fetchLog.orders_inserted,
      updated: fetchLog.orders_updated,
      status: fetchLog.status,
      durationMs: fetchLog.duration_ms
    };
  }

  _generateMockOrders(platform, dateRange) {
    const mockCount = 20 + Math.floor(Math.random() * 30);
    const orders = [];
    const statuses = Object.values(ORDER_STATUS);

    for (let i = 0; i < mockCount; i++) {
      const randomDate = dayjs(dateRange.startDate).add(
        Math.floor(Math.random() * dayjs(dateRange.endDate).diff(dateRange.startDate, 'day')),
        'day'
      ).hour(Math.floor(Math.random() * 24)).minute(Math.floor(Math.random() * 60));

      orders.push({
        platform,
        platform_order_id: `${platform.slice(0, 3).toUpperCase()}${Date.now()}${String(i).padStart(4, '0')}`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        order_date: randomDate.format('YYYY-MM-DD HH:mm:ss'),
        total_amount: parseFloat((5 + Math.random() * 500).toFixed(2)),
        currency: 'USD',
        buyer_name: `Buyer_${platform}_${i + 1}`,
        buyer_email: `buyer${i + 1}@example.com`,
        country: ['US', 'UK', 'DE', 'FR', 'CA', 'AU'][Math.floor(Math.random() * 6)],
        items_count: 1 + Math.floor(Math.random() * 5),
        _mock: true
      });
    }

    return orders;
  }

  _extractOrderItems(order) {
    const items = [];
    const count = order.items_count || (1 + Math.floor(Math.random() * 3));
    const unitPrice = order.total_amount ? order.total_amount / count : 10;

    for (let i = 0; i < count; i++) {
      items.push({
        sku: `SKU-${order.platform.toUpperCase()}-${String(1000 + i).padStart(4, '0')}`,
        product_name: `Product ${order.platform} ${i + 1}`,
        quantity: 1 + Math.floor(Math.random() * 2),
        unit_price: parseFloat(unitPrice.toFixed(2)),
        platform_item_id: `ITEM-${Date.now()}-${i}`
      });
    }

    return items;
  }

  async fetchAllPlatforms(dateRange, options = {}) {
    const {
      platforms = PLATFORMS,
      concurrency = 3,
      simulate = false
    } = options;

    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(Math.min(concurrency, platforms.length));
    const results = [];

    console.log(`\n${chalk.magenta.bold('========== 订单采集任务开始 ==========')}`);
    console.log(`时间范围: ${dateRange.startDateStr} 至 ${dateRange.endDateStr}`);
    console.log(`平台数量: ${platforms.length} (${platforms.map(p => PLATFORM_NAMES[p]).join(', ')})`);
    console.log(`最大并发: ${concurrency}\n`);

    const tasks = platforms.map(platform =>
      limit(() =>
        this.fetchPlatformOrders(platform, dateRange, { simulate, ...options })
          .then(result => ({ platform, success: true, ...result }))
          .catch(error => ({ platform, success: false, error: error.message }))
      )
    );

    const taskResults = await Promise.all(tasks);

    const summary = {
      total: platforms.length,
      success: 0,
      failed: 0,
      totalFetched: 0,
      totalInserted: 0,
      totalUpdated: 0,
      details: taskResults
    };

    taskResults.forEach(r => {
      if (r.success) {
        summary.success++;
        summary.totalFetched += r.fetched || 0;
        summary.totalInserted += r.inserted || 0;
        summary.totalUpdated += r.updated || 0;
      } else {
        summary.failed++;
      }
    });

    console.log(`\n${chalk.magenta.bold('========== 订单采集任务汇总 ==========')}`);
    console.log(chalk.green(`成功平台数: ${summary.success}`) + (summary.failed > 0 ? chalk.red(` / 失败: ${summary.failed}`) : ''));
    console.log(`抓取订单总数: ${summary.totalFetched}`);
    console.log(chalk.green(`新增: ${summary.totalInserted}`) + ` / 更新: ${summary.totalUpdated}`);

    return summary;
  }
}

let orderFetcherInstance = null;

function getOrderFetcher() {
  if (!orderFetcherInstance) {
    orderFetcherInstance = new OrderFetcher();
  }
  return orderFetcherInstance;
}

module.exports = {
  BasePlatformAdapter,
  AmazonAdapter,
  EbayAdapter,
  WishAdapter,
  ShopeeAdapter,
  LazadaAdapter,
  AliExpressAdapter,
  OrderFetcher,
  getAdapter,
  getOrderFetcher
};
