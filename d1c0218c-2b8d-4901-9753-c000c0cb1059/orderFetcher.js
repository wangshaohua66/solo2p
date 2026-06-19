const dayjs = require('dayjs');
const cliProgress = require('cli-progress');
const chalk = require('chalk');

const {
  PLATFORMS,
  PLATFORM_NAMES,
  ORDER_STATUS,
  LOGISTICS_STATUS,
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

  async navigateToOrdersPage(browser, dateRange) {
    const url = getPlatformUrl(this.platform, 'orders');
    await browser.url(url);
    await browser.pause(3000);
  }

  async applyDateFilter(browser, dateRange) {
    return true;
  }

  async getOrderCount(browser) {
    return 0;
  }

  async getPageOrders(browser) {
    return [];
  }

  async hasNextPage(browser) {
    return false;
  }

  async goToNextPage(browser) {
    return false;
  }

  async goToOrderDetail(browser, order) {
    const mainHandle = await browser.getWindowHandle();
    const handlesBefore = await browser.getWindowHandles();

    try {
      const linkSelectors = [
        'a[href*="order"]',
        'a[href*="OrderDetail"]',
        'a[href*="orderdetail"]',
        'a[href*="id="]',
        '[data-order-id] a',
        'tr[data-order-id]',
        '.order-row a',
        '[class*="order-id"] a'
      ];

      let clicked = false;
      for (const sel of linkSelectors) {
        try {
          const elements = await browser.$$(sel);
          for (const el of elements) {
            try {
              const txt = await el.getText();
              const href = await el.getAttribute('href');
              if ((order.platform_order_id && (txt?.includes(order.platform_order_id) || href?.includes(order.platform_order_id)))
                  || txt?.match(/\d{6,}/)) {
                await el.click();
                await browser.pause(3000);
                clicked = true;
                break;
              }
            } catch (e) { /* continue */ }
          }
          if (clicked) break;
        } catch (err) { /* continue */ }
      }

      if (!clicked) {
        const orderId = order.platform_order_id;
        await browser.execute((id) => {
          const links = Array.from(document.querySelectorAll('a'));
          const target = links.find(l => l.href?.includes(id) || l.textContent?.includes(id));
          if (target) target.click();
        }, orderId);
        await browser.pause(3000);
      }

      const handlesAfter = await browser.getWindowHandles();
      const newHandle = handlesAfter.find(h => !handlesBefore.includes(h));

      let detailHandle = mainHandle;
      if (newHandle) {
        await browser.switchToWindow(newHandle);
        detailHandle = newHandle;
      }

      await browser.waitUntil(
        async () => (await browser.getUrl()).length > 0,
        { timeout: fetchConfig.pageLoadTimeout, timeoutMsg: '订单详情页加载超时' }
      );
      await browser.pause(2000);

      return { detailHandle, mainHandle, openedNewWindow: !!newHandle };
    } catch (err) {
      console.log(chalk.yellow(`[${this.platformName}] 进入订单详情失败: ${err.message}`));
      return { detailHandle: mainHandle, mainHandle, openedNewWindow: false };
    }
  }

  async parseOrderDetail(browser, basicOrder) {
    const detail = { ...basicOrder };

    try {
      const pageHtml = await browser.getPageSource();
      const pageText = await browser.$('body').getText().catch(() => '');

      detail.buyer_name = detail.buyer_name || this._extractField(pageText, [
        /买家[：:\s]*([^\n<]+)/i,
        /Buyer[：:\s]*([^\n<]+)/i,
        /收件人[：:\s]*([^\n<]+)/i,
        /收货人[：:\s]*([^\n<]+)/i,
        /Recipient[：:\s]*([^\n<]+)/i,
        /Name[：:\s]*([^\n<]+)/i
      ]);

      detail.buyer_email = detail.buyer_email || this._extractField(pageText, [
        /[\w.+-]+@[\w-]+\.[\w.-]+/g
      ], true);

      detail.buyer_phone = detail.buyer_phone || this._extractField(pageText, [
        /电[话话][：:\s]*([+\d\s-]{8,20})/i,
        /Phone[：:\s]*([+\d\s-]{8,20})/i,
        /手机[：:\s]*([+\d\s-]{8,20})/i,
        /Mobile[：:\s]*([+\d\s-]{8,20})/i,
        /Tel[：:\s]*([+\d\s-]{8,20})/i
      ]);

      detail.shipping_address = detail.shipping_address || this._extractField(pageText, [
        /收货地址[：:\s]*([^\n]{10,200})/i,
        /Shipping Address[：:\s]*([^\n]{10,200})/i,
        /地址[：:\s]*([^\n]{10,200})/i,
        /Address[：:\s]*([^\n]{10,200})/i
      ]);

      detail.country = detail.country || this._extractField(pageText, [
        /国家[：:\s]*([A-Za-z\u4e00-\u9fa5]{2,30})/,
        /Country[：:\s]*([A-Za-z ]{2,30})/i
      ]);

      detail.tracking_no = detail.tracking_no || this._extractField(pageText, [
        /\b1Z[A-Z0-9]{16}\b/i,
        /\bTBA\d{12,}\b/i,
        /\b[A-Z]{2}\d{9}[A-Z]{2}\b/i,
        /\b\d{10,14}\b/,
        /运单号[：:\s]*([A-Za-z0-9]{8,30})/i,
        /Tracking #?[：:\s]*([A-Za-z0-9]{8,30})/i,
        /物流单号[：:\s]*([A-Za-z0-9]{8,30})/i
      ]);

      detail.carrier = detail.carrier || this._extractField(pageText, [
        /承运商[：:\s]*([^\n<]+)/i,
        /Carrier[：:\s]*([^\n<]+)/i,
        /物流公司[：:\s]*([^\n<]+)/i,
        /物流方式[：:\s]*([^\n<]+)/i
      ]);

      detail.logistics_status_text = this._extractField(pageText, [
        /物流状态[：:\s]*([^\n<]{2,50})/i,
        /Shipping Status[：:\s]*([^\n<]{2,50})/i,
        /跟踪状态[：:\s]*([^\n<]{2,50})/i
      ]);

      if (!detail.items || detail.items.length === 0) {
        detail.items = this._extractItemsFromDetail(pageText, pageHtml);
        detail.items_count = detail.items.length;
      }

      detail.detail_raw = {
        source: 'detail_page',
        url: await browser.getUrl().catch(() => ''),
        capturedAt: dayjs().toISOString()
      };
    } catch (err) {
      console.log(chalk.yellow(`[${this.platformName}] 解析订单详情异常: ${err.message}`));
    }

    return detail;
  }

  _extractItemsFromDetail(pageText, pageHtml) {
    const items = [];
    try {
      const skuRegex = /SKU[：:\s]*([A-Za-z0-9-_]{4,30})/gi;
      const qtyRegex = /数量[：:\s]*(\d+)/gi;
      const priceRegex = /单价[：:\s]*\$?([\d.]+)/gi;

      const skus = [...pageText.matchAll(skuRegex)].map(m => m[1]);
      const qtys = [...pageText.matchAll(qtyRegex)].map(m => parseInt(m[1]));
      const prices = [...pageText.matchAll(priceRegex)].map(m => parseFloat(m[1]));

      if (skus.length > 0) {
        for (let i = 0; i < skus.length; i++) {
          items.push({
            sku: skus[i],
            product_name: `Product ${skus[i]}`,
            quantity: qtys[i] || 1,
            unit_price: prices[i] || 0,
            platform_item_id: null
          });
        }
      }
    } catch (err) { /* skip */ }
    return items;
  }

  _extractField(text, patterns, allMatches = false) {
    if (!text) return null;
    for (const p of patterns) {
      try {
        if (allMatches) {
          const matches = text.match(p);
          if (matches && matches.length > 0) {
            return matches[0];
          }
        } else {
          const m = text.match(p);
          if (m && m[1]) {
            return m[1].trim();
          }
        }
      } catch (err) { /* continue */ }
    }
    return null;
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
    if (s.includes('cancel') || s.includes('取消')) return ORDER_STATUS.CANCELLED;
    if (s.includes('return') || s.includes('退') || s.includes('refund') || s.includes('退款')) return ORDER_STATUS.RETURNED;
    if (s.includes('complete') || s.includes('完成') || s.includes('delivered') || s.includes('签收') || s.includes('送达')) return ORDER_STATUS.COMPLETED;
    if (s.includes('ship') || s.includes('发') || s.includes('shipped') || s.includes('投递')) return ORDER_STATUS.SHIPPED;
    if (s.includes('unshipped') || s.includes('待发') || s.includes('pending') || s.includes('待处理') || s.includes('未发')) return ORDER_STATUS.PENDING_SHIPMENT;
    return ORDER_STATUS.PENDING_SHIPMENT;
  }

  _extractBuyerInfo(rowText) {
    const info = {
      buyer_name: null,
      buyer_email: null,
      buyer_phone: null,
      shipping_address: null,
      country: null
    };
    if (!rowText) return info;

    const emailMatch = rowText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (emailMatch) info.buyer_email = emailMatch[0];

    const phoneMatch = rowText.match(/[+\d][\d\s-]{8,20}/);
    if (phoneMatch) info.buyer_phone = phoneMatch[0].trim();

    const nameMatch = rowText.match(/(买家|Buyer|收件人|收货人)[：:\s]+([^\n<]{2,50})/i);
    if (nameMatch) info.buyer_name = nameMatch[2].trim();

    const countryMatch = rowText.match(/\b(USA|US|United States|UK|United Kingdom|Germany|France|Canada|Australia|中国|美国|英国|德国|法国|加拿大|澳大利亚)\b/i);
    if (countryMatch) info.country = countryMatch[1];

    return info;
  }
}

class AmazonAdapter extends BasePlatformAdapter {
  constructor() { super('amazon'); }

  async getPageOrders(browser) {
    const orders = [];
    const rowSelectors = [
      '[data-testid="order-row"]',
      'table tbody tr',
      '.order-row',
      '[class*="order-row"]'
    ];

    let rows = [];
    for (const sel of rowSelectors) {
      rows = await browser.$$(sel);
      if (rows.length > 0) break;
    }

    for (const row of rows) {
      try {
        const text = await row.getText();
        if (!text.trim()) continue;

        const orderIdMatch = text.match(/\b\d{3}-\d{7}-\d{7}\b|\b[A-Z0-9]{10,}\b/);
        const platformOrderId = orderIdMatch ? orderIdMatch[0] : '';
        if (!platformOrderId) continue;

        const buyerInfo = this._extractBuyerInfo(text);

        const order = {
          platform: this.platform,
          platform_order_id: platformOrderId,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          ...buyerInfo,
          _rawText: text
        };

        orders.push(order);
      } catch (err) { /* skip */ }
    }

    return orders;
  }

  async hasNextPage(browser) {
    const selectors = [
      '[aria-label="Next"]',
      '.a-last:not(.a-disabled)',
      '[id*="next"]'
    ];
    for (const sel of selectors) {
      try {
        const els = await browser.$$(sel);
        for (const el of els) {
          if (await el.isDisplayed()) return true;
        }
      } catch (err) { /* continue */ }
    }
    return false;
  }

  async goToNextPage(browser) {
    const selectors = [
      '[aria-label="Next"]',
      '.a-last a',
      '[id*="next"]'
    ];
    for (const sel of selectors) {
      try {
        const els = await browser.$$(sel);
        for (const el of els) {
          if (await el.isDisplayed() && await el.isClickable()) {
            await el.click();
            await browser.pause(3000);
            return true;
          }
        }
      } catch (err) { /* continue */ }
    }
    return false;
  }
}

class EbayAdapter extends BasePlatformAdapter {
  constructor() { super('ebay'); }

  async getPageOrders(browser) {
    const orders = [];
    const rowSelectors = [
      '[data-order-id]',
      '[class*="order-item"]',
      'tr[class*="order"]'
    ];

    let rows = [];
    for (const sel of rowSelectors) {
      rows = await browser.$$(sel);
      if (rows.length > 0) break;
    }

    for (const row of rows) {
      try {
        const text = await row.getText();
        const orderId = await row.getAttribute('data-order-id').catch(() => '');
        if (!text.trim()) continue;

        const buyerInfo = this._extractBuyerInfo(text);

        orders.push({
          platform: this.platform,
          platform_order_id: orderId || `ebay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          ...buyerInfo,
          _rawText: text
        });
      } catch (err) { /* skip */ }
    }

    return orders;
  }

  async hasNextPage(browser) {
    const sels = ['[class*="next-page"]', '[aria-label*="Next"]', '.pagination a:last-child'];
    for (const sel of sels) {
      try {
        const els = await browser.$$(sel);
        for (const el of els) if (await el.isDisplayed()) return true;
      } catch (e) { /* continue */ }
    }
    return false;
  }

  async goToNextPage(browser) {
    const sels = ['[class*="next-page"] a', '[aria-label*="Next"]', 'a[rel="next"]'];
    for (const sel of sels) {
      try {
        const els = await browser.$$(sel);
        for (const el of els) {
          if (await el.isDisplayed()) { await el.click(); await browser.pause(3000); return true; }
        }
      } catch (e) { /* continue */ }
    }
    return false;
  }
}

class WishAdapter extends BasePlatformAdapter {
  constructor() { super('wish'); }

  async getPageOrders(browser) {
    const orders = [];
    const sels = ['[class*="order-card"]', '[class*="OrderCard"]', 'table tbody tr'];
    let rows = [];
    for (const sel of sels) { rows = await browser.$$(sel); if (rows.length > 0) break; }

    for (const row of rows) {
      try {
        const text = await row.getText();
        if (!text.trim()) continue;
        const idMatch = text.match(/\b[A-Z]{2,}\d{8,}\b|\b\d{12,}\b/);
        const buyerInfo = this._extractBuyerInfo(text);

        orders.push({
          platform: this.platform,
          platform_order_id: idMatch?.[1] || idMatch?.[0] || `wish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          ...buyerInfo,
          _rawText: text
        });
      } catch (e) { /* skip */ }
    }
    return orders;
  }

  async hasNextPage(browser) {
    try {
      const els = await browser.$$('[class*="pagination"] [class*="next"], button[aria-label*="Next"]');
      for (const el of els) if (await el.isDisplayed() && await el.isEnabled()) return true;
    } catch (e) { /* skip */ }
    return false;
  }

  async goToNextPage(browser) {
    try {
      const els = await browser.$$('[class*="pagination"] [class*="next"] button, button[aria-label*="Next"]');
      for (const el of els) {
        if (await el.isDisplayed() && await el.isEnabled()) { await el.click(); await browser.pause(3000); return true; }
      }
    } catch (e) { /* skip */ }
    return false;
  }
}

class ShopeeAdapter extends BasePlatformAdapter {
  constructor() { super('shopee'); }

  async getPageOrders(browser) {
    const orders = [];
    const sels = ['[class*="order-list"] [class*="item"]', '[class*="order-item"]', 'table tr'];
    let rows = [];
    for (const sel of sels) { rows = await browser.$$(sel); if (rows.length > 0) break; }

    for (const row of rows) {
      try {
        const text = await row.getText();
        if (!text.trim()) continue;
        const idMatch = text.match(/\b\d{10,}\b/);
        const buyerInfo = this._extractBuyerInfo(text);

        orders.push({
          platform: this.platform,
          platform_order_id: idMatch?.[0] || `shopee_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          ...buyerInfo,
          _rawText: text
        });
      } catch (e) { /* skip */ }
    }
    return orders;
  }

  async hasNextPage(browser) {
    try {
      const els = await browser.$$('.shopee-pagination__btn--active + button, [class*="next"]:not([disabled])');
      return els.length > 0;
    } catch (e) { return false; }
  }

  async goToNextPage(browser) {
    try {
      const els = await browser.$$('.shopee-pagination__btn--active + button, [class*="next"]');
      for (const el of els) {
        if (await el.isDisplayed() && await el.isEnabled()) { await el.click(); await browser.pause(3000); return true; }
      }
    } catch (e) { /* skip */ }
    return false;
  }
}

class LazadaAdapter extends BasePlatformAdapter {
  constructor() { super('lazada'); }

  async getPageOrders(browser) {
    const orders = [];
    const sels = ['[class*="order-item"]', '[class*="OrderItem"]', '[data-order-id]'];
    let rows = [];
    for (const sel of sels) { rows = await browser.$$(sel); if (rows.length > 0) break; }

    for (const row of rows) {
      try {
        const orderId = await row.getAttribute('data-order-id').catch(() => '');
        const text = await row.getText();
        if (!text.trim()) continue;
        const buyerInfo = this._extractBuyerInfo(text);

        orders.push({
          platform: this.platform,
          platform_order_id: orderId || `lazada_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          ...buyerInfo,
          _rawText: text
        });
      } catch (e) { /* skip */ }
    }
    return orders;
  }

  async hasNextPage(browser) {
    try {
      const els = await browser.$$('[class*="next"]:not(.disabled), .ant-pagination-next:not(.ant-pagination-disabled)');
      for (const el of els) if (await el.isDisplayed()) return true;
    } catch (e) { /* skip */ }
    return false;
  }

  async goToNextPage(browser) {
    try {
      const els = await browser.$$('[class*="next"] button, .ant-pagination-next a');
      for (const el of els) {
        if (await el.isDisplayed() && await el.isEnabled()) { await el.click(); await browser.pause(3000); return true; }
      }
    } catch (e) { /* skip */ }
    return false;
  }
}

class AliExpressAdapter extends BasePlatformAdapter {
  constructor() { super('aliexpress'); }

  async getPageOrders(browser) {
    const orders = [];
    const sels = ['[class*="order-item"]', '[data-orderid]', '[data-order-id]'];
    let rows = [];
    for (const sel of sels) { rows = await browser.$$(sel); if (rows.length > 0) break; }

    for (const row of rows) {
      try {
        let orderId = '';
        try { orderId = await row.getAttribute('data-orderid') || await row.getAttribute('data-order-id') || ''; } catch (e) {}
        const text = await row.getText();
        if (!text.trim()) continue;

        if (!orderId) {
          const m = text.match(/\b\d{12,}\b/);
          orderId = m ? m[0] : '';
        }
        const buyerInfo = this._extractBuyerInfo(text);

        orders.push({
          platform: this.platform,
          platform_order_id: orderId || `ae_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: this._normalizeStatus(text),
          order_date: this._parseDate(text),
          total_amount: this._parseAmount(text),
          currency: 'USD',
          ...buyerInfo,
          _rawText: text
        });
      } catch (e) { /* skip */ }
    }
    return orders;
  }

  async hasNextPage(browser) {
    try {
      const els = await browser.$$('[class*="page-next"], [class*="pagination"] a:last-child');
      for (const el of els) if (await el.isDisplayed()) return true;
    } catch (e) { /* skip */ }
    return false;
  }

  async goToNextPage(browser) {
    try {
      const els = await browser.$$('[class*="page-next"] a, [class*="pagination"] a:last-child');
      for (const el of els) {
        if (await el.isDisplayed()) { await el.click(); await browser.pause(3000); return true; }
      }
    } catch (e) { /* skip */ }
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
    const { withDetails = true, onProgress = null, simulate = false, detailConcurrency = 2 } = options;

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
        }
      });

      const authResult = await retryHandler.execute(
        () => this.authManager.ensureLogin(platform),
        { description: `${platformName} 登录`, platform }
      );
      const browser = authResult.browser;
      if (!authResult.loggedIn) throw new Error('登录失败，无法继续抓取');

      await retryHandler.execute(
        () => adapter.navigateToOrdersPage(browser, dateRange),
        { description: `${platformName} 导航到订单页`, platform }
      );
      await adapter.applyDateFilter(browser, dateRange);

      const allOrders = [];
      let page = 1;
      const maxPages = 50;

      console.log(chalk.cyan(`[${platformName}] 开始抓取订单列表...`));

      do {
        const pageOrders = await retryHandler.execute(
          async (attempt) => {
            if (attempt > 1) {
              await browser.refresh();
              await browser.pause(3000);
            }
            return adapter.getPageOrders(browser);
          },
          { description: `${platformName} 第${page}页订单解析`, platform }
        );

        if (pageOrders.length === 0) {
          if (page === 1) console.log(chalk.yellow(`[${platformName}] 第1页未抓取到订单`));
          break;
        }

        allOrders.push(...pageOrders);
        fetchLog.orders_fetched += pageOrders.length;
        console.log(chalk.cyan(`[${platformName}] 第 ${page} 页: ${pageOrders.length} 条 (买家信息填充: ${pageOrders.filter(o => o.buyer_name || o.buyer_email).length})`));

        if (onProgress) onProgress({ platform, page, ordersCount: allOrders.length });

        page++;
        if (page > maxPages) break;
        if (!(await adapter.hasNextPage(browser))) break;
        await adapter.goToNextPage(browser);
        await browser.pause(2000);
      } while (true);

      if (allOrders.length === 0 && simulate) {
        const simulated = this._generateMockOrders(platform, dateRange);
        allOrders.push(...simulated);
        fetchLog.orders_fetched += simulated.length;
        console.log(chalk.cyan(`[${platformName}] 生成 ${simulated.length} 条模拟订单`));
      }

      if (withDetails && allOrders.length > 0) {
        console.log(chalk.cyan(`[${platformName}] 开始解析订单详情 (共 ${allOrders.length} 条)...`));
        const pLimit = (await import('p-limit')).default;
        const limit = pLimit(detailConcurrency);

        const detailProgress = new cliProgress.SingleBar({
          format: `[${platformName}] 详情解析: [{bar}] {percentage}% | {value}/{total}`,
          barCompleteChar: '\u2588', barIncompleteChar: '\u2591', hideCursor: true
        });
        detailProgress.start(allOrders.length, 0);

        const detailTasks = allOrders.map((order, idx) =>
          limit(async () => {
            try {
              const nav = await adapter.goToOrderDetail(browser, order);
              const enhanced = await adapter.parseOrderDetail(browser, order);
              if (nav.openedNewWindow) {
                try {
                  await browser.closeWindow();
                  await browser.switchToWindow(nav.mainHandle);
                } catch (e) { await browser.switchToWindow(nav.mainHandle); }
              } else {
                try { await browser.back(); } catch (e) {}
              }
              await browser.pause(500);
              detailProgress.increment();
              return enhanced;
            } catch (detailErr) {
              detailProgress.increment();
              return order;
            }
          })
        );

        const enhancedOrders = await Promise.all(detailTasks);
        detailProgress.stop();

        for (let i = 0; i < allOrders.length; i++) {
          if (enhancedOrders[i]) allOrders[i] = enhancedOrders[i];
        }
      }

      console.log(chalk.cyan(`[${platformName}] 共获取 ${allOrders.length} 条订单，开始存储...`));

      const storeProgress = new cliProgress.SingleBar({
        format: `[${platformName}] 存储进度: [{bar}] {percentage}% | {value}/{total}`,
        barCompleteChar: '\u2588', barIncompleteChar: '\u2591', hideCursor: true
      });
      storeProgress.start(allOrders.length, 0);

      for (let i = 0; i < allOrders.length; i++) {
        const order = allOrders[i];
        const items = order.items || this._extractOrderItems(order);

        try {
          const result = await storage.upsertOrder(order, items);
          if (result.inserted) fetchLog.orders_inserted++;
          if (result.updated) fetchLog.orders_updated++;

          if (order.tracking_no) {
            await storage.upsertLogistics(result.id, {
              tracking_no: order.tracking_no,
              carrier: order.carrier || null,
              status: order.logistics_status_text ? adapter._normalizeStatus(order.logistics_status_text) : LOGISTICS_STATUS.PENDING
            });
          }
        } catch (dbErr) {
          console.error(chalk.red(`[${platformName}] 订单 ${order.platform_order_id} 存储失败: ${dbErr.message}`));
        }
        storeProgress.update(i + 1);
      }
      storeProgress.stop();

      fetchLog.status = 'success';
      console.log(chalk.green(`[${platformName}] 抓取完成: 新增 ${fetchLog.orders_inserted}，更新 ${fetchLog.orders_updated}`));

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
      try { await (await getStorage()).addFetchLog(fetchLog); } catch (dbErr) {}
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
    const countries = ['US', 'UK', 'DE', 'FR', 'CA', 'AU'];
    const firstNames = ['John', 'Jane', 'Mike', 'Emily', 'David', 'Sarah', 'Tom', 'Anna'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'];

    for (let i = 0; i < mockCount; i++) {
      const randomDate = dayjs(dateRange.startDate).add(
        Math.floor(Math.random() * dayjs(dateRange.endDate).diff(dateRange.startDate, 'day')),
        'day'
      ).hour(Math.floor(Math.random() * 24)).minute(Math.floor(Math.random() * 60));

      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${firstName} ${lastName}`;

      orders.push({
        platform,
        platform_order_id: `${platform.slice(0, 3).toUpperCase()}${Date.now()}${String(i).padStart(4, '0')}`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        order_date: randomDate.format('YYYY-MM-DD HH:mm:ss'),
        total_amount: parseFloat((5 + Math.random() * 500).toFixed(2)),
        currency: 'USD',
        buyer_name: fullName,
        buyer_email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
        buyer_phone: `+1${Math.floor(1000000000 + Math.random() * 8999999999)}`,
        shipping_address: `${100 + i} Main Street, City ${i}, State`,
        country: countries[Math.floor(Math.random() * countries.length)],
        items_count: 1 + Math.floor(Math.random() * 5),
        _mock: true
      });
    }
    return orders;
  }

  _extractOrderItems(order) {
    const items = [];
    if (order.items && Array.isArray(order.items) && order.items.length > 0) return order.items;

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
    const { platforms = PLATFORMS, concurrency = 3, simulate = false } = options;
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(Math.min(concurrency, platforms.length));

    console.log(`\n${chalk.magenta.bold('========== 订单采集任务开始 ==========')}`);
    console.log(`时间范围: ${dateRange.startDateStr} ~ ${dateRange.endDateStr}`);
    console.log(`平台: ${platforms.map(p => PLATFORM_NAMES[p]).join(', ')}`);
    console.log(`最大并发: ${concurrency}\n`);

    const taskResults = await Promise.all(
      platforms.map(platform =>
        limit(() =>
          this.fetchPlatformOrders(platform, dateRange, { simulate, ...options })
            .then(result => ({ platform, success: true, ...result }))
            .catch(error => ({ platform, success: false, error: error.message }))
        )
      )
    );

    const summary = {
      total: platforms.length, success: 0, failed: 0,
      totalFetched: 0, totalInserted: 0, totalUpdated: 0,
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

    console.log(`\n${chalk.magenta.bold('========== 订单采集汇总 ==========')}`);
    console.log(chalk.green(`成功: ${summary.success}`) + (summary.failed > 0 ? chalk.red(` / 失败: ${summary.failed}`) : ''));
    console.log(`抓取: ${summary.totalFetched} / 新增: ${chalk.green(summary.totalInserted)} / 更新: ${summary.totalUpdated}`);
    return summary;
  }
}

let orderFetcherInstance = null;
function getOrderFetcher() {
  if (!orderFetcherInstance) orderFetcherInstance = new OrderFetcher();
  return orderFetcherInstance;
}

module.exports = {
  BasePlatformAdapter,
  AmazonAdapter, EbayAdapter, WishAdapter, ShopeeAdapter, LazadaAdapter, AliExpressAdapter,
  OrderFetcher,
  getAdapter, getOrderFetcher
};
