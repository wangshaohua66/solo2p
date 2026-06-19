const dayjs = require('dayjs');
const chalk = require('chalk');
const axios = require('axios');

const {
  PLATFORMS,
  PLATFORM_NAMES,
  LOGISTICS_STATUS,
  LOGISTICS_STATUS_NAMES,
  ORDER_STATUS,
  logisticsApiConfig,
  retryConfig
} = require('./config');
const { getStorage } = require('./storage');
const { RetryManager, globalAlertManager } = require('./retryHandler');

const LOGISTICS_DELAY_DAYS = 15;

const CARRIER_MAP = {
  'fedex': 'FedEx', 'FEDEX': 'FedEx', 'Fedex': 'FedEx',
  'ups': 'UPS', 'UPS': 'UPS',
  'usps': 'USPS', 'USPS': 'USPS', 'Usps': 'USPS',
  'dhl': 'DHL', 'DHL': 'DHL',
  '17track': '17Track', '17TRACK': '17Track',
  '4px': '4PX', 'cainiao': 'Cainiao',
  'yanwen': 'Yanwen', 'sunyou': 'Sunyou',
  'china post': 'China Post', 'chinapost': 'China Post',
  'china ems': 'China EMS', 'ems': 'EMS', 'EMS': 'EMS',
  'aliexpress': 'AliExpress Shipping',
  'shopee': 'Shopee Logistics',
  'lazada': 'Lazada Logistics',
  'amazon': 'Amazon Logistics', 'tba': 'Amazon Logistics',
  'ebay': 'eBay Global Shipping',
  'wish': 'Wish Logistics',
  'yunexpress': 'YunExpress'
};

function normalizeCarrier(name) {
  if (!name) return name;
  const lower = name.toLowerCase().trim();

  for (const [key, display] of Object.entries(CARRIER_MAP)) {
    if (lower.includes(key.toLowerCase())) return display;
  }
  return name;
}

function detectCarrier(trackingNo) {
  if (!trackingNo) return null;
  const t = trackingNo.trim();

  if (/^1Z[a-zA-Z0-9]{16}$/.test(t)) return 'UPS';
  if (/^TBA\d{10,}$/i.test(t)) return 'Amazon Logistics';
  if (/^\d{12}$/.test(t) && t.startsWith('9')) return 'FedEx';
  if (/^\d{22}$/.test(t)) return 'USPS';
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(t)) return 'China Post / EMS';
  if (/^[A-Za-z]{1,2}\d{10,}$/i.test(t)) return 'Yanwen / Sunyou';
  if (/^YT\d{13}$/.test(t)) return 'YunExpress';
  if (/^LP\d{10,}$/.test(t)) return 'AliExpress / Cainiao';

  return null;
}

function normalizeStatus(rawStatus, description) {
  if (!rawStatus && !description) return LOGISTICS_STATUS.PENDING;

  const text = `${rawStatus || ''} ${description || ''}`.toLowerCase();

  if (/delivered|签收|妥投|已送达|派送成功/.test(text)) return LOGISTICS_STATUS.DELIVERED;
  if (/in transit|运输中|途中|已发出|departed|outbound|left/.test(text)) return LOGISTICS_STATUS.TRANSIT;
  if (/out for delivery|派送中|投递中|派件|attempted/.test(text)) return LOGISTICS_STATUS.OUT_FOR_DELIVERY;
  if (/customs|清关|海关|import|export/.test(text)) return LOGISTICS_STATUS.CUSTOMS;
  if (/exception|失败|异常|delay|延误|lost|丢失|damaged|损坏|refused|拒收|returned|退回/.test(text)) return LOGISTICS_STATUS.EXCEPTION;
  if (/picked up|pickup|已揽收|揽件|collected|received|已发货|shipped/.test(text)) return LOGISTICS_STATUS.SHIPPED;
  if (/arrived|到达|sorted|分拣|processing|处理中/.test(text)) return LOGISTICS_STATUS.TRANSIT;
  if (/pending|待处理|待揽收|not found|no info|查询不到/.test(text)) return LOGISTICS_STATUS.PENDING;

  return LOGISTICS_STATUS.TRANSIT;
}

function normalizeTime(rawTime, fallbackNow = true) {
  if (!rawTime) return fallbackNow ? dayjs().format('YYYY-MM-DD HH:mm:ss') : null;

  let d;
  if (typeof rawTime === 'number') {
    d = rawTime > 1e12 ? dayjs(rawTime) : dayjs(rawTime * 1000);
  } else if (typeof rawTime === 'string') {
    d = dayjs(rawTime);
    if (!d.isValid()) {
      d = dayjs(rawTime.replace('T', ' ').replace(/[Z+-]\d{2}:?\d{2}$/, ''));
    }
  } else {
    d = dayjs(rawTime);
  }

  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : (fallbackNow ? dayjs().format('YYYY-MM-DD HH:mm:ss') : null);
}

function extractTrackingInfo(rawTrackingData, carrier = null) {
  const events = [];

  if (!rawTrackingData) return { events, status: LOGISTICS_STATUS.PENDING };

  if (Array.isArray(rawTrackingData)) {
    for (const item of rawTrackingData) {
      const evt = _extractSingleEvent(item);
      if (evt) events.push(evt);
    }
  } else if (rawTrackingData.traces || rawTrackingData.events || rawTrackingData.data) {
    const list = rawTrackingData.traces || rawTrackingData.events || rawTrackingData.data;
    if (Array.isArray(list)) {
      for (const item of list) {
        const evt = _extractSingleEvent(item);
        if (evt) events.push(evt);
      }
    }
  } else if (rawTrackingData.result) {
    if (Array.isArray(rawTrackingData.result)) {
      for (const item of rawTrackingData.result) {
        const evt = _extractSingleEvent(item);
        if (evt) events.push(evt);
      }
    } else if (rawTrackingData.result.traces || rawTrackingData.result.events) {
      const list = rawTrackingData.result.traces || rawTrackingData.result.events;
      if (Array.isArray(list)) {
        for (const item of list) {
          const evt = _extractSingleEvent(item);
          if (evt) events.push(evt);
        }
      }
    }
  } else {
    const evt = _extractSingleEvent(rawTrackingData);
    if (evt) events.push(evt);
  }

  const sortedEvents = events
    .filter(e => e && e.tracking_time)
    .sort((a, b) => dayjs(b.tracking_time).valueOf() - dayjs(a.tracking_time).valueOf());

  const latestEvent = sortedEvents[0] || null;
  const finalStatus = latestEvent ? latestEvent.status : (rawTrackingData.status || LOGISTICS_STATUS.PENDING);

  return {
    events: sortedEvents,
    status: normalizeStatus(finalStatus, latestEvent?.description),
    latest: latestEvent,
    carrier: carrier || (rawTrackingData.carrier ? normalizeCarrier(rawTrackingData.carrier) : null),
    isDelivered: sortedEvents.some(e => e.status === LOGISTICS_STATUS.DELIVERED),
    hasException: sortedEvents.some(e => e.status === LOGISTICS_STATUS.EXCEPTION)
  };
}

function _extractSingleEvent(item) {
  if (!item) return null;

  const time = normalizeTime(
    item.tracking_time || item.time || item.date || item.occurred_at || item.timestamp || item.created_at || item.createdAt,
    false
  );
  if (!time) return null;

  const location = item.location || item.city || item.address || item.country || item.site ||
    (typeof item.checkpoint_destination === 'string' ? item.checkpoint_destination : null);

  const rawStatus = item.status || item.state || item.status_text || item.event || item.code;
  const description = item.description || item.desc || item.message || item.info || item.substatus || item.details;

  const status = normalizeStatus(rawStatus, description);

  return {
    tracking_time: time,
    location: location ? String(location).trim() : null,
    status,
    description: description ? String(description).trim() : (rawStatus ? String(rawStatus).trim() : null),
    raw_data: item
  };
}

async function searchTrackingByOrderId(orderId) {
  const storage = await getStorage();
  const order = await storage._get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) {
    return { success: false, error: `订单不存在: ${orderId}` };
  }

  const logisticsRow = await storage._get('SELECT * FROM logistics WHERE order_id = ?', [orderId]);
  const trackingNo = logisticsRow?.tracking_no || order.tracking_no;

  if (!trackingNo) {
    return { success: false, error: `订单 ${order.platform_order_id} 暂无物流单号` };
  }

  const carrier = logisticsRow?.carrier || detectCarrier(trackingNo) || order.platform;
  const carrierNormalized = normalizeCarrier(carrier);

  let apiResult = null;
  let useApi = null;

  if (logisticsApiConfig.aftershipApiKey) {
    try {
      apiResult = await _queryAfterShip(trackingNo, carrierNormalized);
      useApi = 'aftership';
    } catch (err) {
      if (logisticsApiConfig.track17ApiKey) {
        try {
          apiResult = await _queryTrack17(trackingNo, carrierNormalized);
          useApi = '17track';
        } catch (err2) {
          apiResult = null;
        }
      }
    }
  } else if (logisticsApiConfig.track17ApiKey) {
    try {
      apiResult = await _queryTrack17(trackingNo, carrierNormalized);
      useApi = '17track';
    } catch (err) {
      apiResult = null;
    }
  }

  if (!apiResult && logisticsApiConfig.useMockIfApiFail) {
    apiResult = _mockTrackingResponse(trackingNo, carrierNormalized, order);
    useApi = 'mock';
  }

  if (!apiResult) {
    return {
      success: false,
      error: '物流查询失败: 无可用 API 且未启用 Mock',
      order_id: orderId,
      tracking_no: trackingNo
    };
  }

  const parsed = extractTrackingInfo(apiResult, carrierNormalized);
  parsed.sourceApi = useApi;

  if (parsed.events.length === 0 && logisticsRow?.raw_tracking_data) {
    try {
      const oldParsed = extractTrackingInfo(
        typeof logisticsRow.raw_tracking_data === 'string'
          ? JSON.parse(logisticsRow.raw_tracking_data)
          : logisticsRow.raw_tracking_data,
        carrierNormalized
      );
      if (oldParsed.events.length > parsed.events.length) {
        parsed.events = oldParsed.events;
        parsed.latest = oldParsed.latest;
        parsed.status = oldParsed.status;
      }
    } catch (_) { /* ignore parse error */ }
  }

  let logisticsId = logisticsRow?.id;
  if (logisticsId) {
    await storage.upsertLogistics(logisticsId, {
      tracking_no: trackingNo,
      carrier: carrierNormalized,
      status: parsed.status,
      current_location: parsed.latest?.location || null,
      actual_delivery_date: parsed.events.find(e => e.status === LOGISTICS_STATUS.DELIVERED)?.tracking_time || null,
      is_delayed: _detectDelayed(parsed, order, logisticsRow),
      raw_tracking_data: apiResult
    });
    await storage.upsertLogisticsTraces(logisticsId, parsed.events);
  } else {
    const upsertResult = await storage.upsertLogistics(orderId, {
      tracking_no: trackingNo,
      carrier: carrierNormalized,
      status: parsed.status,
      shipped_date: parsed.events.find(e =>
        [LOGISTICS_STATUS.SHIPPED, LOGISTICS_STATUS.TRANSIT].includes(e.status)
      )?.tracking_time || order.order_date,
      current_location: parsed.latest?.location || null,
      actual_delivery_date: parsed.events.find(e => e.status === LOGISTICS_STATUS.DELIVERED)?.tracking_time || null,
      is_delayed: _detectDelayed(parsed, order, null),
      raw_tracking_data: apiResult
    });
    logisticsId = upsertResult.id;
    if (logisticsId) await storage.upsertLogisticsTraces(logisticsId, parsed.events);
  }

  if (parsed.hasException) {
    await globalAlertManager.alertSystemError(
      new Error(`物流异常: ${trackingNo} (订单 ${order.platform_order_id})`),
      {
        type: 'logistics_exception',
        order_id: orderId,
        tracking_no: trackingNo,
        carrier: carrierNormalized,
        events: parsed.events.slice(0, 5)
      }
    );
  }

  return {
    success: true,
    order_id: orderId,
    platform_order_id: order.platform_order_id,
    tracking_no: trackingNo,
    carrier: carrierNormalized,
    status: parsed.status,
    status_name: LOGISTICS_STATUS_NAMES[parsed.status],
    source_api: useApi,
    latest: parsed.latest,
    events_count: parsed.events.length,
    events: parsed.events,
    is_delivered: parsed.isDelivered,
    has_exception: parsed.hasException
  };
}

async function _queryAfterShip(trackingNo, carrier) {
  const slug = _carrierToAfterShipSlug(carrier);

  let url = `${logisticsApiConfig.aftershipUrl}/${slug}/${encodeURIComponent(trackingNo)}`;
  if (!slug) {
    url = `${logisticsApiConfig.aftershipUrl}/:${encodeURIComponent(trackingNo)}`;
  }

  const resp = await axios.get(url, {
    headers: {
      'as-api-key': logisticsApiConfig.aftershipApiKey,
      'Content-Type': 'application/json'
    },
    timeout: logisticsApiConfig.requestTimeoutMs
  });

  if (!resp.data || !resp.data.data || !resp.data.data.tracking) {
    throw new Error('AfterShip 返回空数据');
  }

  const t = resp.data.data.tracking;
  return {
    carrier: t.slug || t.carrier || carrier,
    status: t.tag || t.status,
    events: (t.checkpoints || []).map(cp => ({
      tracking_time: cp.checkpoint_time || cp.created_at || cp.time,
      location: cp.city || cp.location || cp.country_name,
      status: cp.tag || cp.status,
      description: cp.message || cp.description,
      raw_data: cp
    }))
  };
}

async function _queryTrack17(trackingNo, carrier) {
  const carrierCode = _carrierToTrack17Code(carrier);

  const body = [
    {
      number: trackingNo,
      carrier: carrierCode || '',
      auto_detection: !carrierCode
    }
  ];

  const resp = await axios.post(logisticsApiConfig.track17Url, body, {
    headers: {
      '17token': logisticsApiConfig.track17ApiKey,
      'Content-Type': 'application/json'
    },
    timeout: logisticsApiConfig.requestTimeoutMs
  });

  const accepted = resp.data?.accepted || [];
  const rejected = resp.data?.rejected || [];
  if (accepted.length === 0 && rejected.length > 0) {
    throw new Error(`17Track 拒绝: ${JSON.stringify(rejected[0])}`);
  }

  const item = accepted[0] || resp.data?.data?.track?.[0];
  if (!item) {
    throw new Error('17Track 返回空结果');
  }

  return {
    carrier: item.carrier || carrier,
    status: item.status || item.final_status,
    events: (item.traces || item.events || []).map(ev => ({
      tracking_time: ev.event_time || ev.occurred_at || ev.date,
      location: ev.event_location || ev.location || ev.site,
      status: ev.event_code || ev.status,
      description: ev.event_desc || ev.description || ev.message,
      raw_data: ev
    }))
  };
}

function _carrierToAfterShipSlug(carrier) {
  const map = {
    'UPS': 'ups',
    'FedEx': 'fedex',
    'USPS': 'usps',
    'DHL': 'dhl',
    'China Post / EMS': 'china-post',
    'EMS': 'ems',
    'Amazon Logistics': 'amazon',
    'Yanwen / Sunyou': 'yanwen',
    'YunExpress': 'yunexpress',
    'AliExpress / Cainiao': 'cainiao'
  };
  return map[carrier] || map[normalizeCarrier(carrier)] || null;
}

function _carrierToTrack17Code(carrier) {
  const map = {
    'UPS': 'ups',
    'FedEx': 'fedex',
    'USPS': 'usps',
    'DHL': 'dhl',
    'China Post / EMS': 'chinapost',
    'EMS': 'ems',
    'Yanwen / Sunyou': 'yanwen',
    'YunExpress': 'yunexpress',
    'AliExpress / Cainiao': 'cainiao'
  };
  return map[carrier] || map[normalizeCarrier(carrier)] || null;
}

function _mockTrackingResponse(trackingNo, carrier, order) {
  const events = [];
  const now = dayjs();
  const orderDate = order?.order_date ? dayjs(order.order_date) : now.subtract(7, 'day');

  events.push({
    tracking_time: orderDate.format('YYYY-MM-DD HH:mm:ss'),
    location: 'Origin Warehouse',
    status: LOGISTICS_STATUS.SHIPPED,
    description: 'Parcel picked up by carrier'
  });

  const transit1 = orderDate.add(1, 'day');
  events.push({
    tracking_time: transit1.format('YYYY-MM-DD HH:mm:ss'),
    location: 'Departure Hub',
    status: LOGISTICS_STATUS.TRANSIT,
    description: 'Parcel in transit to destination country'
  });

  const daysDiff = Math.min(10, Math.max(1, now.diff(orderDate, 'day')));
  for (let i = 2; i < daysDiff; i++) {
    const t = orderDate.add(i, 'day');
    if (t.isAfter(now)) break;
    events.push({
      tracking_time: t.format('YYYY-MM-DD HH:mm:ss'),
      location: i >= 5 ? 'Destination Country' : 'Transit Hub',
      status: LOGISTICS_STATUS.TRANSIT,
      description: 'Parcel arrived at sorting facility'
    });
  }

  if (daysDiff >= 7) {
    events.push({
      tracking_time: orderDate.add(daysDiff, 'day').format('YYYY-MM-DD HH:mm:ss'),
      location: 'Local Delivery Center',
      status: LOGISTICS_STATUS.OUT_FOR_DELIVERY,
      description: 'Out for delivery'
    });

    if (daysDiff >= 10) {
      events.push({
        tracking_time: orderDate.add(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
        location: 'Destination',
        status: LOGISTICS_STATUS.DELIVERED,
        description: 'Delivered to recipient'
      });
    }
  }

  return {
    carrier,
    tracking_no: trackingNo,
    _mock: true,
    events
  };
}

function _detectDelayed(parsed, order, logisticsRow) {
  if (parsed.isDelivered) return false;

  const latestEventTime = parsed.latest?.tracking_time ? dayjs(parsed.latest.tracking_time) : null;
  const shippedTime = logisticsRow?.shipped_date ? dayjs(logisticsRow.shipped_date) : (order.order_date ? dayjs(order.order_date) : null);

  if (!shippedTime) return false;

  const daysSinceShipped = dayjs().diff(shippedTime, 'day');
  if (daysSinceShipped > LOGISTICS_DELAY_DAYS) return true;

  if (latestEventTime) {
    const daysSinceLatest = dayjs().diff(latestEventTime, 'day');
    if (daysSinceLatest >= 5 && daysSinceShipped >= 5) return true;
  }

  return false;
}

class LogisticsTracker {
  constructor() {
    this.retryManager = new RetryManager();
  }

  async trackOrder(orderId, options = {}) {
    const { forceRefresh = false, useBrowserFallback = false } = options;

    return this.retryManager.retry(
      () => searchTrackingByOrderId(orderId),
      { operation: `logistics_track_order_${orderId}` }
    );
  }

  async trackOrdersBatch(orderIds, { concurrency = 2 } = {}) {
    const pLimit = require('p-limit');
    const limit = pLimit(concurrency);
    const results = [];

    const tasks = orderIds.map(id =>
      limit(() =>
        this.trackOrder(id)
          .then(r => ({ order_id: id, ...r }))
          .catch(err => ({ order_id: id, success: false, error: err.message }))
      )
    );

    return Promise.all(tasks);
  }

  async trackPendingShipments(filters = {}) {
    const storage = await getStorage();
    const conditions = [
      '(o.status = ? OR o.status = ?)',
      '(l.status IS NULL OR l.status = ? OR l.status = ? OR l.status = ? OR l.is_delayed = 1)'
    ];
    const params = [
      ORDER_STATUS.SHIPPED, ORDER_STATUS.PENDING_SHIPMENT,
      LOGISTICS_STATUS.PENDING, LOGISTICS_STATUS.SHIPPED, LOGISTICS_STATUS.TRANSIT
    ];

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

    const pendingOrders = await storage._all(`
      SELECT DISTINCT o.id, o.platform, o.platform_order_id, o.order_date
      FROM orders o
      LEFT JOIN logistics l ON l.order_id = o.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY o.order_date DESC
      LIMIT 1000
    `, params);

    console.log(chalk.cyan(`[物流追踪] 待追踪订单数: ${pendingOrders.length}`));

    return this.trackOrdersBatch(pendingOrders.map(o => o.id));
  }

  async getOrderTrackingReport(orderId) {
    const storage = await getStorage();

    const logistics = await storage._get('SELECT * FROM logistics WHERE order_id = ?', [orderId]);
    const traces = logistics
      ? await storage.getLogisticsTraces(logistics.id)
      : [];
    const order = await storage._get('SELECT * FROM orders WHERE id = ?', [orderId]);

    return {
      order: order ? {
        id: order.id,
        platform: order.platform,
        platform_order_id: order.platform_order_id,
        order_date: order.order_date,
        status: order.status
      } : null,
      tracking: logistics ? {
        tracking_no: logistics.tracking_no,
        carrier: logistics.carrier,
        status: logistics.status,
        status_name: LOGISTICS_STATUS_NAMES[logistics.status],
        shipped_date: logistics.shipped_date,
        estimated_delivery_date: logistics.estimated_delivery_date,
        actual_delivery_date: logistics.actual_delivery_date,
        current_location: logistics.current_location,
        is_delayed: !!logistics.is_delayed,
        delay_reason: logistics.delay_reason
      } : null,
      traces: traces.map(t => ({
        tracking_time: t.tracking_time,
        location: t.location,
        status: t.status,
        status_name: LOGISTICS_STATUS_NAMES[t.status] || t.status,
        description: t.description
      }))
    };
  }

  async trackAllPlatforms(options = {}) {
    const {
      platform: singlePlatform = null,
      platforms: platformList = null,
      concurrency = 2,
      checkDelay = false
    } = options;

    const platformsToTrack = singlePlatform
      ? [singlePlatform]
      : (platformList || PLATFORMS);

    const validPlatforms = platformsToTrack.filter(p => PLATFORMS.includes(p));
    if (validPlatforms.length === 0) {
      console.log(chalk.yellow('[物流追踪] 没有有效的平台需要追踪'));
      return { total: 0, success: 0, failed: 0, details: [] };
    }

    console.log(chalk.cyan(`[物流追踪] 开始追踪 ${validPlatforms.length} 个平台: ${validPlatforms.map(p => PLATFORM_NAMES[p]).join(', ')}`));

    const details = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const platform of validPlatforms) {
      try {
        console.log(chalk.gray(`  → 追踪 ${PLATFORM_NAMES[platform]}...`));
        const result = await this.trackPendingShipments({
          platform,
          startDate: options.startDate,
          endDate: options.endDate
        });

        const success = Array.isArray(result) ? result.filter(r => r.success).length : 0;
        const failed = Array.isArray(result) ? result.length - success : 0;

        totalSuccess += success;
        totalFailed += failed;

        details.push({
          platform,
          success: true,
          ordersTracked: Array.isArray(result) ? result.length : 0,
          successCount: success,
          failedCount: failed,
          result
        });

        console.log(chalk.green(`  ✓ ${PLATFORM_NAMES[platform]}: 追踪 ${success} 成功, ${failed} 失败`));
      } catch (err) {
        totalFailed++;
        details.push({
          platform,
          success: false,
          error: err.message
        });
        console.log(chalk.red(`  ✗ ${PLATFORM_NAMES[platform]}: ${err.message}`));
      }
    }

    const summary = {
      total: validPlatforms.length,
      success: validPlatforms.length - details.filter(d => !d.success).length,
      failed: details.filter(d => !d.success).length,
      ordersTracked: details.reduce((s, d) => s + (d.ordersTracked || 0), 0),
      ordersSuccess: totalSuccess,
      ordersFailed: totalFailed,
      details
    };

    console.log(chalk.green(`[物流追踪] 完成: ${summary.success}/${summary.total} 平台成功, ${summary.ordersSuccess}/${summary.ordersTracked + summary.ordersFailed} 订单成功`));

    return summary;
  }

  async detectDelayedOrders(options = {}) {
    const {
      platform = null,
      startDate = null,
      delayThresholdHours = 72
    } = options;

    const storage = await getStorage();
    const conditions = [
      'l.is_delayed = 1 OR (l.status = ? AND julianday(\'now\') - julianday(l.shipped_date) > ?)',
      'o.status IN (?, ?)'
    ];
    const params = [
      LOGISTICS_STATUS.TRANSIT,
      delayThresholdHours / 24,
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.PENDING_SHIPMENT
    ];

    if (platform) {
      conditions.push('o.platform = ?');
      params.push(platform);
    }
    if (startDate) {
      conditions.push('o.order_date >= ?');
      params.push(startDate);
    }

    const rows = await storage._all(`
      SELECT
        o.id, o.platform, o.platform_order_id, o.order_date, o.status,
        l.tracking_no, l.carrier, l.status AS logistics_status, l.shipped_date,
        l.current_location, l.is_delayed, l.delay_reason,
        (julianday('now') - julianday(COALESCE(l.shipped_date, o.order_date))) * 24 AS delay_hours
      FROM orders o
      JOIN logistics l ON l.order_id = o.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY delay_hours DESC
      LIMIT 1000
    `, params);

    console.log(chalk.cyan(`[物流追踪] 发现 ${rows.length} 笔延误订单`));

    return rows;
  }
}

let trackerInstance = null;

function getLogisticsTracker() {
  if (!trackerInstance) {
    trackerInstance = new LogisticsTracker();
  }
  return trackerInstance;
}

module.exports = {
  LogisticsTracker,
  searchTrackingByOrderId,
  extractTrackingInfo,
  normalizeCarrier,
  detectCarrier,
  normalizeStatus,
  normalizeTime,
  getLogisticsTracker
};
