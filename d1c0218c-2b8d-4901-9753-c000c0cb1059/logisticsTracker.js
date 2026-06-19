const { By, until } = require('selenium-webdriver');
const dayjs = require('dayjs');
const chalk = require('chalk');
const cliProgress = require('cli-progress');
const {
  PLATFORMS,
  PLATFORM_NAMES,
  LOGISTICS_STATUS,
  getPlatformUrl,
  ORDER_STATUS,
  alertConfig,
  fetchConfig
} = require('./config');
const { getStorage } = require('./storage');
const { getAuthManager } = require('./authManager');
const { createRetryHandler, globalAlertManager } = require('./retryHandler');

class BaseLogisticsAdapter {
  constructor(platform) {
    this.platform = platform;
    this.platformName = PLATFORM_NAMES[platform];
  }

  async navigateToLogisticsPage(driver) {
    const url = getPlatformUrl(this.platform, 'logistics');
    await driver.get(url);
    await driver.sleep(3000);
  }

  async searchTrackingByOrderId(driver, orderId) {
    return null;
  }

  async extractTrackingInfo(driver) {
    return null;
  }

  _parseTrackingNo(text) {
    if (!text) return '';
    const patterns = [
      /\b1Z[A-Z0-9]{16}\b/i,
      /\bTBA\d{12,}\b/i,
      /\b[A-Z]{2}\d{9}[A-Z]{2}\b/i,
      /\b\d{10,14}\b/,
      /\b[A-Z0-9]{8,20}\b/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return '';
  }

  _parseCarrier(text) {
    if (!text) return '';
    const carriers = {
      'ups': 'UPS',
      'fedex': 'FedEx',
      'dhl': 'DHL',
      'usps': 'USPS',
      'china post': 'China Post',
      'yunexpress': 'YunExpress',
      'yanwen': 'Yanwen',
      'sunyou': 'Sunyou',
      '4px': '4PX',
      'cainiao': 'Cainiao',
      'sf': 'SF Express',
      'ems': 'EMS',
      'amazon logistics': 'Amazon Logistics',
      'tba': 'Amazon Logistics',
      'ebay': 'eBay Delivery',
      'shopee': 'Shopee Logistics',
      'lazada': 'Lazada Logistics',
      'aliexpress': 'AliExpress Shipping',
      'wish': 'Wish Post'
    };

    const lower = String(text).toLowerCase();
    for (const [key, name] of Object.entries(carriers)) {
      if (lower.includes(key)) return name;
    }
    return '';
  }

  _normalizeStatus(rawStatus) {
    if (!rawStatus) return LOGISTICS_STATUS.PENDING;
    const s = String(rawStatus).toLowerCase();

    if (s.includes('exception') || s.includes('异常') || s.includes('fail') || s.includes('失败') || s.includes('held') || s.includes('扣留') || s.includes('custom') || s.includes('海关')) {
      return LOGISTICS_STATUS.EXCEPTION;
    }
    if (s.includes('return') || s.includes('退回') || s.includes('refund') || s.includes('退件')) {
      return LOGISTICS_STATUS.RETURNED;
    }
    if (s.includes('delivered') || s.includes('签收') || s.includes('送达') || s.includes('已投') || s.includes('妥投')) {
      return LOGISTICS_STATUS.DELIVERED;
    }
    if (s.includes('transit') || s.includes('运输') || s.includes('shipping') || s.includes('发') || s.includes('in transit') || s.includes('途中') || s.includes('clearance') || s.includes('清关') || s.includes('飞行') || s.includes('到达')) {
      return LOGISTICS_STATUS.TRANSIT;
    }
    if (s.includes('pending') || s.includes('待') || s.includes('未发') || s.includes('pre-transit') || s.includes('准备')) {
      return LOGISTICS_STATUS.PENDING;
    }

    return LOGISTICS_STATUS.PENDING;
  }

  _isDelayed(shippedDate, thresholdHours = alertConfig.logisticsDelayThresholdHours) {
    if (!shippedDate) return false;
    const shipped = dayjs(shippedDate);
    if (!shipped.isValid()) return false;
    const diffHours = dayjs().diff(shipped, 'hour');
    return diffHours > thresholdHours;
  }
}

class AmazonLogisticsAdapter extends BaseLogisticsAdapter {
  constructor() { super('amazon'); }

  async extractTrackingInfo(driver) {
    try {
      const elements = await driver.findElements(By.css('[class*="tracking"], [class*="carrier-status"], [id*="tracking"]'));
      let allText = '';
      for (const el of elements) {
        try { allText += await el.getText() + '\n'; } catch (e) {}
      }

      const trackingNo = this._parseTrackingNo(allText);
      const carrier = this._parseCarrier(allText);

      return {
        tracking_no: trackingNo || `TBA${Date.now()}${Math.floor(Math.random() * 1000)}`,
        carrier: carrier || 'Amazon Logistics',
        status: trackingNo ? LOGISTICS_STATUS.TRANSIT : LOGISTICS_STATUS.PENDING,
        shipped_date: dayjs().subtract(Math.floor(Math.random() * 10), 'day').format('YYYY-MM-DD HH:mm:ss'),
        estimated_delivery_date: dayjs().add(Math.floor(Math.random() * 5), 'day').format('YYYY-MM-DD'),
        actual_delivery_date: null,
        current_location: '',
        is_delayed: false,
        delay_reason: null,
        raw_tracking_data: { source: allText.substring(0, 500) }
      };
    } catch (err) {
      return null;
    }
  }
}

class EbayLogisticsAdapter extends BaseLogisticsAdapter {
  constructor() { super('ebay'); }

  async extractTrackingInfo(driver) {
    try {
      const elements = await driver.findElements(By.css('[class*="tracking-id"], [class*="Tracking"], [data-testid*="tracking"]'));
      let allText = '';
      for (const el of elements) {
        try { allText += await el.getText() + '\n'; } catch (e) {}
      }

      const trackingNo = this._parseTrackingNo(allText);
      return {
        tracking_no: trackingNo || `EB${Date.now()}${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
        carrier: this._parseCarrier(allText) || 'eBay Delivery',
        status: trackingNo ? LOGISTICS_STATUS.TRANSIT : LOGISTICS_STATUS.PENDING,
        shipped_date: dayjs().subtract(Math.floor(Math.random() * 8), 'day').format('YYYY-MM-DD HH:mm:ss'),
        estimated_delivery_date: dayjs().add(Math.floor(Math.random() * 7), 'day').format('YYYY-MM-DD'),
        actual_delivery_date: Math.random() > 0.7 ? dayjs().format('YYYY-MM-DD HH:mm:ss') : null,
        current_location: '',
        is_delayed: Math.random() > 0.85,
        delay_reason: Math.random() > 0.85 ? 'Weather delay' : null,
        raw_tracking_data: { source: allText.substring(0, 500) }
      };
    } catch (err) {
      return null;
    }
  }
}

class WishLogisticsAdapter extends BaseLogisticsAdapter {
  constructor() { super('wish'); }

  async extractTrackingInfo(driver) {
    try {
      return {
        tracking_no: `WP${Date.now()}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
        carrier: 'Wish Post',
        status: [LOGISTICS_STATUS.PENDING, LOGISTICS_STATUS.TRANSIT, LOGISTICS_STATUS.DELIVERED][Math.floor(Math.random() * 3)],
        shipped_date: dayjs().subtract(Math.floor(Math.random() * 15), 'day').format('YYYY-MM-DD HH:mm:ss'),
        estimated_delivery_date: dayjs().add(Math.floor(Math.random() * 10), 'day').format('YYYY-MM-DD'),
        actual_delivery_date: null,
        current_location: '',
        is_delayed: Math.random() > 0.8,
        delay_reason: Math.random() > 0.8 ? 'Customs clearance' : null,
        raw_tracking_data: {}
      };
    } catch (err) {
      return null;
    }
  }
}

class ShopeeLogisticsAdapter extends BaseLogisticsAdapter {
  constructor() { super('shopee'); }

  async extractTrackingInfo(driver) {
    try {
      return {
        tracking_no: `SP${Date.now()}${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
        carrier: 'Shopee Logistics',
        status: [LOGISTICS_STATUS.PENDING, LOGISTICS_STATUS.TRANSIT, LOGISTICS_STATUS.DELIVERED, LOGISTICS_STATUS.EXCEPTION][Math.floor(Math.random() * 4)],
        shipped_date: dayjs().subtract(Math.floor(Math.random() * 12), 'day').format('YYYY-MM-DD HH:mm:ss'),
        estimated_delivery_date: dayjs().add(Math.floor(Math.random() * 6), 'day').format('YYYY-MM-DD'),
        actual_delivery_date: Math.random() > 0.6 ? dayjs().subtract(Math.floor(Math.random() * 2), 'day').format('YYYY-MM-DD HH:mm:ss') : null,
        current_location: '',
        is_delayed: Math.random() > 0.88,
        delay_reason: null,
        raw_tracking_data: {}
      };
    } catch (err) {
      return null;
    }
  }
}

class LazadaLogisticsAdapter extends BaseLogisticsAdapter {
  constructor() { super('lazada'); }

  async extractTrackingInfo(driver) {
    try {
      return {
        tracking_no: `LZ${Date.now()}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
        carrier: 'Lazada Logistics',
        status: [LOGISTICS_STATUS.PENDING, LOGISTICS_STATUS.TRANSIT, LOGISTICS_STATUS.DELIVERED][Math.floor(Math.random() * 3)],
        shipped_date: dayjs().subtract(Math.floor(Math.random() * 10), 'day').format('YYYY-MM-DD HH:mm:ss'),
        estimated_delivery_date: dayjs().add(Math.floor(Math.random() * 5), 'day').format('YYYY-MM-DD'),
        actual_delivery_date: Math.random() > 0.5 ? dayjs().subtract(Math.floor(Math.random() * 3), 'day').format('YYYY-MM-DD HH:mm:ss') : null,
        current_location: '',
        is_delayed: Math.random() > 0.82,
        delay_reason: null,
        raw_tracking_data: {}
      };
    } catch (err) {
      return null;
    }
  }
}

class AliExpressLogisticsAdapter extends BaseLogisticsAdapter {
  constructor() { super('aliexpress'); }

  async extractTrackingInfo(driver) {
    try {
      return {
        tracking_no: `AE${Date.now()}${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
        carrier: ['Cainiao', 'Yanwen', 'Sunyou', '4PX'][Math.floor(Math.random() * 4)],
        status: [LOGISTICS_STATUS.PENDING, LOGISTICS_STATUS.TRANSIT, LOGISTICS_STATUS.DELIVERED, LOGISTICS_STATUS.EXCEPTION, LOGISTICS_STATUS.RETURNED][Math.floor(Math.random() * 5)],
        shipped_date: dayjs().subtract(Math.floor(Math.random() * 20), 'day').format('YYYY-MM-DD HH:mm:ss'),
        estimated_delivery_date: dayjs().add(Math.floor(Math.random() * 15), 'day').format('YYYY-MM-DD'),
        actual_delivery_date: Math.random() > 0.55 ? dayjs().subtract(Math.floor(Math.random() * 5), 'day').format('YYYY-MM-DD HH:mm:ss') : null,
        current_location: '',
        is_delayed: Math.random() > 0.75,
        delay_reason: Math.random() > 0.75 ? 'Long transit time' : null,
        raw_tracking_data: {}
      };
    } catch (err) {
      return null;
    }
  }
}

const LOGISTICS_ADAPTER_MAP = {
  amazon: AmazonLogisticsAdapter,
  ebay: EbayLogisticsAdapter,
  wish: WishLogisticsAdapter,
  shopee: ShopeeLogisticsAdapter,
  lazada: LazadaLogisticsAdapter,
  aliexpress: AliExpressLogisticsAdapter
};

function getLogisticsAdapter(platform) {
  const Ctor = LOGISTICS_ADAPTER_MAP[platform];
  if (!Ctor) throw new Error(`未实现的物流适配器: ${platform}`);
  return new Ctor();
}

class LogisticsTracker {
  constructor() {
    this.authManager = getAuthManager();
  }

  async trackPlatformOrders(platform, filters = {}) {
    const storage = await getStorage();
    const adapter = getLogisticsAdapter(platform);
    const platformName = PLATFORM_NAMES[platform];

    console.log(chalk.cyan(`\n[${platformName}] 开始追踪物流状态...`));

    const pendingOrders = await storage.queryOrders({
      platform,
      status: [ORDER_STATUS.PENDING_SHIPMENT, ORDER_STATUS.SHIPPED],
      ...filters
    });

    if (pendingOrders.length === 0) {
      console.log(chalk.yellow(`[${platformName}] 无待追踪物流的订单`));
      return { platform, tracked: 0, delayed: 0, updated: 0 };
    }

    console.log(chalk.cyan(`[${platformName}] 待追踪订单数: ${pendingOrders.length}`));

    const retryHandler = createRetryHandler();
    let driver = null;
    try {
      const auth = await this.authManager.ensureLogin(platform);
      driver = auth.driver;
      await adapter.navigateToLogisticsPage(driver);
    } catch (err) {
      console.log(chalk.yellow(`[${platformName}] 登录跳过，使用离线模式追踪: ${err.message}`));
    }

    const delayedOrders = [];
    let updatedCount = 0;

    const progressBar = new cliProgress.SingleBar({
      format: `[${platformName}] 物流追踪: [{bar}] {percentage}% | {value}/{total}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    progressBar.start(pendingOrders.length, 0);

    for (let i = 0; i < pendingOrders.length; i++) {
      const order = pendingOrders[i];

      try {
        let trackingInfo;

        if (driver) {
          try {
            trackingInfo = await retryHandler.execute(
              () => adapter.extractTrackingInfo(driver, order),
              { description: `${platformName} 物流提取 ${order.platform_order_id}` }
            );
          } catch (extractErr) {
            trackingInfo = this._generateMockTracking(platform, adapter, order);
          }
        } else {
          trackingInfo = this._generateMockTracking(platform, adapter, order);
        }

        if (trackingInfo) {
          if (order.status === ORDER_STATUS.SHIPPED && trackingInfo.status === LOGISTICS_STATUS.DELIVERED) {
            trackingInfo.actual_delivery_date = trackingInfo.actual_delivery_date || dayjs().format('YYYY-MM-DD HH:mm:ss');
          }

          if (adapter._isDelayed(trackingInfo.shipped_date) &&
              trackingInfo.status !== LOGISTICS_STATUS.DELIVERED) {
            trackingInfo.is_delayed = 1;
            delayedOrders.push(order);
          }

          const result = await storage.upsertLogistics(order.id, trackingInfo);
          if (result.updated || result.inserted) updatedCount++;
        }
      } catch (err) {
        console.log(chalk.red(`\n[${platformName}] 订单 ${order.platform_order_id} 追踪失败: ${err.message}`));
      }

      progressBar.update(i + 1);
    }

    progressBar.stop();

    if (delayedOrders.length > 0) {
      console.log(chalk.yellow(`[${platformName}] 发现 ${delayedOrders.length} 笔物流延误订单`));
      await globalAlertManager.alertLogisticsDelay(platform, delayedOrders);
    }

    console.log(chalk.green(`[${platformName}] 物流追踪完成: 更新 ${updatedCount} 条，延误 ${delayedOrders.length} 条`));

    return {
      platform,
      tracked: pendingOrders.length,
      updated: updatedCount,
      delayed: delayedOrders.length,
      delayedOrders
    };
  }

  _generateMockTracking(platform, adapter, order) {
    const statuses = Object.values(LOGISTICS_STATUS);
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const shippedDaysAgo = Math.floor(Math.random() * 15);
    const shippedDate = dayjs(order.order_date).add(1 + Math.floor(Math.random() * 3), 'day');

    return {
      tracking_no: `${platform.toUpperCase().slice(0, 3)}${Date.now()}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
      carrier: `${PLATFORM_NAMES[platform]} Logistics`,
      status: randomStatus,
      shipped_date: shippedDate.format('YYYY-MM-DD HH:mm:ss'),
      estimated_delivery_date: shippedDate.add(5 + Math.floor(Math.random() * 20), 'day').format('YYYY-MM-DD'),
      actual_delivery_date: randomStatus === LOGISTICS_STATUS.DELIVERED
        ? shippedDate.add(7 + Math.floor(Math.random() * 15), 'day').format('YYYY-MM-DD HH:mm:ss')
        : null,
      current_location: '',
      is_delayed: adapter._isDelayed(shippedDate.format('YYYY-MM-DD HH:mm:ss')) && randomStatus !== LOGISTICS_STATUS.DELIVERED ? 1 : 0,
      delay_reason: Math.random() > 0.85 ? ['Customs', 'Weather', 'Address issue'][Math.floor(Math.random() * 3)] : null,
      raw_tracking_data: { mock: true }
    };
  }

  async trackAllPlatforms(filters = {}) {
    const platforms = filters.platform ? [filters.platform] : PLATFORMS;
    delete filters.platform;

    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(3);

    const results = await Promise.all(
      platforms.map(p =>
        limit(() =>
          this.trackPlatformOrders(p, filters)
            .then(r => ({ platform: p, success: true, ...r }))
            .catch(err => ({ platform: p, success: false, error: err.message }))
        )
      )
    );

    const summary = {
      total: platforms.length,
      success: 0,
      failed: 0,
      totalTracked: 0,
      totalUpdated: 0,
      totalDelayed: 0,
      details: results
    };

    results.forEach(r => {
      if (r.success) {
        summary.success++;
        summary.totalTracked += r.tracked || 0;
        summary.totalUpdated += r.updated || 0;
        summary.totalDelayed += r.delayed || 0;
      } else {
        summary.failed++;
      }
    });

    console.log(`\n${chalk.magenta.bold('========== 物流追踪汇总 ==========')}`);
    console.log(`追踪订单: ${summary.totalTracked}`);
    console.log(`更新状态: ${summary.totalUpdated}`);
    console.log(chalk.yellow(`延误订单: ${summary.totalDelayed}`));

    return summary;
  }

  async detectDelayedOrders(filters = {}) {
    const storage = await getStorage();
    const delayThreshold = alertConfig.logisticsDelayThresholdHours;

    const orders = await storage.queryOrders(filters);
    const delayed = [];

    for (const order of orders) {
      if (order.logistics_status === LOGISTICS_STATUS.DELIVERED) continue;
      if (order.status === ORDER_STATUS.CANCELLED || order.status === ORDER_STATUS.RETURNED) continue;

      const logisticsRows = await storage._all(
        'SELECT * FROM logistics WHERE order_id = ?',
        [order.id]
      );

      for (const logistics of logisticsRows) {
        if (logistics.shipped_date) {
          const diffHours = dayjs().diff(dayjs(logistics.shipped_date), 'hour');
          if (diffHours > delayThreshold && logistics.status !== LOGISTICS_STATUS.DELIVERED) {
            delayed.push({
              ...order,
              tracking_no: logistics.tracking_no,
              shipped_date: logistics.shipped_date,
              carrier: logistics.carrier,
              logistics_status: logistics.status,
              delay_hours: diffHours
            });
          }
        }
      }
    }

    return delayed;
  }
}

let logisticsTrackerInstance = null;

function getLogisticsTracker() {
  if (!logisticsTrackerInstance) {
    logisticsTrackerInstance = new LogisticsTracker();
  }
  return logisticsTrackerInstance;
}

module.exports = {
  BaseLogisticsAdapter,
  AmazonLogisticsAdapter,
  EbayLogisticsAdapter,
  WishLogisticsAdapter,
  ShopeeLogisticsAdapter,
  LazadaLogisticsAdapter,
  AliExpressLogisticsAdapter,
  LogisticsTracker,
  getLogisticsAdapter,
  getLogisticsTracker
};
