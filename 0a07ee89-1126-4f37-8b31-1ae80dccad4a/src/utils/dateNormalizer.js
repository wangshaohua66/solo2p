import moment from 'moment';

const CHANNEL_TIMEZONES = {
  wechat: 'Asia/Shanghai',
  alipay: 'Asia/Shanghai',
  unionpay: 'Asia/Shanghai',
  default: 'Asia/Shanghai',
};

const KNOWN_FORMATS = [
  moment.ISO_8601,
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm:ss.SSS',
  'YYYY/MM/DD HH:mm:ss',
  'YYYY/MM/DD HH:mm:ss.SSS',
  'YYYY-MM-DDTHH:mm:ssZ',
  'YYYY-MM-DDTHH:mm:ss',
  'YYYY-MM-DDTHH:mm:ss.SSSZ',
  'YYYYMMDDHHmmss',
  'YYYYMMDDHHmmssSSS',
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'YYYYMMDD',
  'DD/MM/YYYY HH:mm:ss',
];

function isNumeric(value) {
  if (value === null || value === undefined || value === '') return false;
  return !isNaN(Number(value));
}

function fromUnix(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  let m;
  if (num > 1e16 && num < 1e19) m = moment(num / 1000000);
  else if (num > 1e14 && num < 1e17) m = moment(num);
  else if (num > 1e11 && num < 1e14) m = moment(num);
  else if (num > 1e8 && num < 1e11) m = moment.unix(num);
  else return null;
  const year = m.year();
  if (year < 2000 || year > 2100) return null;
  return m.isValid() ? m : null;
}

function normalize(value, options = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    const m = moment(value);
    return m.isValid() ? m : null;
  }
  if (moment.isMoment(value)) return value.isValid() ? value : null;

  const raw = String(value).trim();
  if (raw === '') return null;

  for (const fmt of KNOWN_FORMATS) {
    const m = moment(raw, fmt, options.strict !== false);
    if (m.isValid()) return m;
  }

  if (isNumeric(raw) && /^\d+$/.test(raw)) {
    const unix = fromUnix(raw);
    if (unix) return unix;
  }

  const m = moment(raw);
  if (m.isValid()) return m;

  return null;
}

function normalizeTimestamp(value, options = {}) {
  const channel = options.channel || 'default';
  const tz = options.timezone || CHANNEL_TIMEZONES[channel] || CHANNEL_TIMEZONES.default;
  const m = normalize(value, options);
  if (!m) return null;
  return m.utcOffset(moment().utcOffset());
}

function toISO(value) {
  const m = normalize(value);
  return m ? m.toISOString() : null;
}

function toStandard(value) {
  const m = normalize(value);
  return m ? m.format('YYYY-MM-DD HH:mm:ss') : null;
}

function toUnixSeconds(value) {
  const m = normalize(value);
  return m ? m.unix() : null;
}

function differenceMs(a, b) {
  const ma = normalize(a);
  const mb = normalize(b);
  if (!ma || !mb) return null;
  return ma.diff(mb);
}

function withinWindow(a, b, windowMs) {
  const diff = differenceMs(a, b);
  if (diff === null) return false;
  return Math.abs(diff) <= windowMs;
}

function daysBetween(a, b) {
  const diff = differenceMs(a, b);
  if (diff === null) return null;
  return diff / 86400000;
}

function startOfDay(value) {
  const m = normalize(value);
  return m ? m.startOf('day') : null;
}

function endOfDay(value) {
  const m = normalize(value);
  return m ? m.endOf('day') : null;
}

function isCrossMonth(a, b) {
  const ma = normalize(a);
  const mb = normalize(b);
  if (!ma || !mb) return false;
  return ma.month() !== mb.month() || ma.year() !== mb.year();
}

export {
  normalize,
  normalizeTimestamp,
  toISO,
  toStandard,
  toUnixSeconds,
  differenceMs,
  withinWindow,
  daysBetween,
  startOfDay,
  endOfDay,
  isCrossMonth,
  KNOWN_FORMATS,
  CHANNEL_TIMEZONES,
};
export default { normalize, normalizeTimestamp, toISO, toStandard, withinWindow, isCrossMonth };
