import { normalizeTimestamp } from '../utils/dateNormalizer.js';

const CHANNELS = ['wechat', 'alipay', 'unionpay'];
const TYPES = ['payment', 'refund', 'reversal', 'split'];
const STATUSES = ['success', 'failed', 'pending'];
const SOURCES = ['order', 'channel'];

const FIELD_MAPS = {
  wechat: {
    transactionId: ['transaction_id', 'transactionId', '微信订单号', 'transaction_id_t'],
    orderId: ['out_trade_no', 'outTradeNo', '商户订单号', 'order_id'],
    merchantId: ['mch_id', 'mchId', '商户号', 'merchant_id'],
    amount: ['total_fee', 'totalFee', '订单金额', 'amount'],
    type: ['trade_type', 'tradeType', '业务类型', 'type'],
    status: ['trade_state', 'tradeState', '交易状态', 'status'],
    timestamp: ['time_end', 'timeEnd', '支付完成时间', 'transaction_time', 'success_time'],
  },
  alipay: {
    transactionId: ['trade_no', 'tradeNo', '支付宝交易号', 'transaction_id'],
    orderId: ['out_trade_no', 'outTradeNo', '商户订单号', 'order_id'],
    merchantId: ['partner', 'partnerId', '商户PID', 'merchant_id'],
    amount: ['total_amount', 'totalAmount', '订单金额', 'amount'],
    type: ['trade_type', 'tradeType', '业务类型', 'type'],
    status: ['trade_status', 'tradeStatus', '交易状态', 'status'],
    timestamp: ['gmt_payment', 'gmtPayment', '支付时间', 'send_pay_date', 'timestamp'],
  },
  unionpay: {
    transactionId: ['queryId', 'query_id', '银联流水号', 'transaction_id'],
    orderId: ['orderId', 'order_id', '商户订单号', 'out_trade_no'],
    merchantId: ['merId', 'mer_id', '商户号', 'merchant_id'],
    amount: ['txnAmt', 'txn_amt', '交易金额', 'amount'],
    type: ['txnType', 'txn_type', 'bizType', 'biz_type', '业务类型', 'trade_type', 'type'],
    status: ['respCode', 'resp_code', '交易状态', 'status'],
    timestamp: ['txnTime', 'txn_time', '交易时间', 'timestamp'],
  },
  order: {
    transactionId: ['transactionId', 'transaction_id', 'txId'],
    orderId: ['orderId', 'order_id', 'out_trade_no', 'outTradeNo'],
    merchantId: ['merchantId', 'merchant_id', 'mch_id'],
    amount: ['amount', 'total_fee', 'total_amount'],
    type: ['type', 'trade_type', 'tradeType'],
    status: ['status', 'trade_state', 'trade_state_desc', 'tradeStatus'],
    timestamp: ['timestamp', 'time_end', 'gmt_payment', 'txnTime', 'createdAt'],
  },
};

function pickField(raw, candidates) {
  if (!raw || typeof raw !== 'object') return undefined;
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== '' && raw[key] !== null && raw[key] !== undefined) {
      return raw[key];
    }
    const lower = key.toLowerCase();
    for (const rk of Object.keys(raw)) {
      if (rk.toLowerCase() === lower && raw[rk] !== '' && raw[rk] !== null && raw[rk] !== undefined) {
        return raw[rk];
      }
    }
  }
  return undefined;
}

const CHANNEL_UNITS = { wechat: 'fen', alipay: 'yuan', unionpay: 'fen', order: 'fen' };

function normalizeAmount(value, unit = 'fen') {
  if (value === null || value === undefined || value === '') return 0;
  const str = String(value).replace(/[,，¥$元\s]/g, '');
  const num = Number(str);
  if (Number.isNaN(num)) return 0;
  if (unit === 'yuan') return Math.round(num * 100);
  if (str.includes('.')) return Math.round(num * 100);
  return Math.round(num);
}

const TYPE_KEYWORDS = {
  refund: ['refund', '退款', '退货', 'REFUND', '20', '22', '0420'],
  reversal: ['reversal', '冲正', '撤销', 'REVERSAL', 'VOID', '04', '24', '25'],
  split: ['split', '分账', '分润', 'SPLIT', 'profit', '31', '94'],
};

const STATUS_KEYWORDS = {
  success: ['success', 'SUCCESS', '成功', 'trade_status_success', 'TRADE_SUCCESS', '00', '0'],
  failed: ['fail', 'FAIL', '失败', 'closed', 'CLOSED', 'error', 'ERROR'],
  pending: ['pending', 'PENDING', '处理中', 'wait', 'WAIT', 'inprogress'],
};

function mapType(value, fallback = 'payment') {
  if (value === undefined || value === null || value === '') return fallback;
  const str = String(value).toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((k) => str.includes(k.toLowerCase()))) return type;
  }
  return fallback;
}

function mapStatus(value, fallback = 'pending') {
  if (value === undefined || value === null || value === '') return fallback;
  const str = String(value);
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    if (keywords.some((k) => str.toLowerCase().includes(k.toLowerCase()))) return status;
  }
  return fallback;
}

function fromRaw(raw, channel, source = 'channel', options = {}) {
  const map = FIELD_MAPS[channel] || FIELD_MAPS.order;
  const rawTimestamp = pickField(raw, map.timestamp) ?? pickField(raw, ['timestamp', 'time', 'createdAt', 'created_at']);
  const timestamp = normalizeTimestamp(rawTimestamp, { channel });
  const orderId = pickField(raw, map.orderId) ?? pickField(raw, ['orderId', 'order_id', 'outTradeNo', 'out_trade_no']);
  const unit = options.unit || CHANNEL_UNITS[channel] || 'fen';
  const amount = normalizeAmount(pickField(raw, map.amount), unit);
  const rawChannel = pickField(raw, ['channel', 'channelId']);
  const resolvedChannel =
    options.preserveChannel && rawChannel && [...CHANNELS].includes(rawChannel) ? rawChannel : channel;

  return {
    id: `${resolvedChannel}:${pickField(raw, map.transactionId) || orderId}:${amount}`,
    transactionId: String(pickField(raw, map.transactionId) ?? ''),
    orderId: String(orderId ?? ''),
    merchantId: String(pickField(raw, map.merchantId) ?? options.defaultMerchantId ?? ''),
    channel: resolvedChannel,
    amount,
    type: mapType(pickField(raw, map.type)),
    status: mapStatus(pickField(raw, map.status)),
    timestamp: timestamp ? timestamp.toDate() : null,
    rawTimestamp: rawTimestamp !== undefined ? String(rawTimestamp) : '',
    source,
    raw,
  };
}

function createOrder(order) {
  return {
    id: `order:${order.orderId}`,
    transactionId: '',
    orderId: String(order.orderId ?? ''),
    merchantId: String(order.merchantId ?? ''),
    channel: order.channel || 'unknown',
    amount: normalizeAmount(order.amount, order.unit || 'fen'),
    type: mapType(order.type, 'payment'),
    status: mapStatus(order.status, 'pending'),
    timestamp: order.timestamp ? new Date(order.timestamp) : null,
    rawTimestamp: order.rawTimestamp ?? '',
    source: 'order',
    raw: order.raw || order,
  };
}

function isComplete(rec) {
  return Boolean(rec && rec.orderId && rec.merchantId && rec.amount != null);
}

function validate(rec) {
  const errors = [];
  if (!rec) return ['记录为空'];
  if (!rec.orderId) errors.push('订单号缺失');
  if (!rec.merchantId) errors.push('商户ID缺失');
  if (rec.amount == null || rec.amount === '' || Number.isNaN(Number(rec.amount))) errors.push('金额格式无效');
  if (!rec.channel || ![...CHANNELS, 'order'].includes(rec.channel)) errors.push(`支付通道无效: ${rec.channel}`);
  if (rec.timestamp && !(rec.timestamp instanceof Date) && isNaN(new Date(rec.timestamp).getTime())) errors.push('时间戳格式无效');
  return errors;
}

export {
  CHANNELS,
  TYPES,
  STATUSES,
  SOURCES,
  FIELD_MAPS,
  CHANNEL_UNITS,
  fromRaw,
  createOrder,
  normalizeAmount,
  mapType,
  mapStatus,
  isComplete,
  validate,
};
export default { fromRaw, createOrder, validate, CHANNELS };
