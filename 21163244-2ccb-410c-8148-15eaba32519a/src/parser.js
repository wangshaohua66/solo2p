const dayjs = require('dayjs');

const NGINX_COMBINED_REGEX = /^(\S+)\s+-\s+(\S+)\s+\[(.+?)\]\s+"(\S+)\s+(\S+)\s+(\S+)"\s+(\d{3})\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)".*$/;
const NGINX_ACCESS_FIELDS = ['ip', 'user', 'timestamp', 'method', 'uri', 'protocol', 'status', 'bytes', 'referer', 'user_agent'];

const NGINX_ERROR_REGEX = /^(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})\s+\[(\w+)\]\s+(\d+)#(\d+):\s+\*(\d+)\s+(.+)$/;
const NGINX_ERROR_FIELDS = ['timestamp', 'level', 'pid', 'tid', 'connection_id', 'message'];

const COMMON_LOG_REGEX = /^(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+\[(\w+)\]\s+(.+)$/;
const COMMON_LOG_FIELDS = ['timestamp', 'level', 'message'];

function parseNginxAccess(line) {
  const match = line.match(NGINX_COMBINED_REGEX);
  if (!match) return null;

  const parsed = {};
  NGINX_ACCESS_FIELDS.forEach((field, i) => {
    let value = match[i + 1];
    if (field === 'timestamp') {
      value = parseNginxTimestamp(value);
    } else if (field === 'status') {
      value = parseInt(value, 10);
    } else if (field === 'bytes') {
      value = value === '-' ? 0 : parseInt(value, 10);
    }
    parsed[field] = value;
  });

  parsed._format = 'nginx-access';
  return parsed;
}

function parseNginxError(line) {
  const match = line.match(NGINX_ERROR_REGEX);
  if (!match) return null;

  const parsed = {};
  NGINX_ERROR_FIELDS.forEach((field, i) => {
    parsed[field] = match[i + 1];
  });

  parsed._format = 'nginx-error';
  return parsed;
}

function parseNginxTimestamp(ts) {
  const m = dayjs(ts, 'DD/MMM/YYYY:HH:mm:ss ZZ');
  return m.isValid() ? m.toISOString() : ts;
}

function parseJsonLine(line) {
  try {
    const obj = JSON.parse(line);
    if (typeof obj === 'object' && obj !== null) {
      obj._format = 'json';
      if (obj.timestamp || obj.time || obj.ts || obj['@timestamp']) {
        obj._timestamp = obj.timestamp || obj.time || obj.ts || obj['@timestamp'];
      }
      if (obj.level || obj.severity || obj.loglevel) {
        obj._level = (obj.level || obj.severity || obj.loglevel).toUpperCase();
      }
      return obj;
    }
  } catch {}
  return null;
}

function parseCsvLine(line, options = {}) {
  const delimiter = options.delimiter || ',';
  const fields = options.fields || [];
  const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));

  if (fields.length === 0) {
    const obj = { _format: 'csv', _values: values };
    return obj;
  }

  const obj = { _format: 'csv' };
  fields.forEach((field, i) => {
    obj[field] = values[i] !== undefined ? values[i] : null;
  });

  return obj;
}

function parseRegexLine(line, regexStr) {
  try {
    const re = new RegExp(regexStr);
    const match = line.match(re);
    if (!match) return null;

    const obj = { _format: 'regex', _match: match[0] };
    if (match.groups) {
      Object.assign(obj, match.groups);
    } else {
      match.slice(1).forEach((v, i) => {
        obj[`group${i + 1}`] = v;
      });
    }

    return obj;
  } catch {
    return null;
  }
}

function parseCommonLog(line) {
  const match = line.match(COMMON_LOG_REGEX);
  if (!match) return null;

  const parsed = {};
  COMMON_LOG_FIELDS.forEach((field, i) => {
    parsed[field] = match[i + 1];
  });

  parsed._format = 'common';
  parsed._timestamp = parsed.timestamp;
  parsed._level = parsed.level;
  return parsed;
}

function autoDetectParser(line) {
  if (line.trim().startsWith('{')) {
    const jsonResult = parseJsonLine(line);
    if (jsonResult) return jsonResult;
  }

  const nginxAccess = parseNginxAccess(line);
  if (nginxAccess) return nginxAccess;

  const nginxError = parseNginxError(line);
  if (nginxError) return nginxError;

  const commonLog = parseCommonLog(line);
  if (commonLog) return commonLog;

  return { _format: 'raw', _raw: line, message: line };
}

function createParser(source) {
  const parserType = source.parser || 'auto';
  const regexStr = source.regex;
  const csvOptions = source.csv_options || {};
  const timestampField = source.timestamp_field;
  const timestampFormat = source.timestamp_format;

  return function parse(line) {
    let result = null;

    switch (parserType) {
      case 'nginx':
        result = parseNginxAccess(line) || parseNginxError(line);
        break;
      case 'json':
        result = parseJsonLine(line);
        break;
      case 'csv':
        result = parseCsvLine(line, csvOptions);
        break;
      case 'regex':
        result = parseRegexLine(line, regexStr);
        break;
      case 'auto':
      default:
        result = autoDetectParser(line);
        break;
    }

    if (result) {
      result._source = source.name;
      if (!result._raw) {
        result._raw = line;
      }

      if (timestampField && result[timestampField]) {
        result._timestamp = normalizeTimestamp(result[timestampField], timestampFormat);
      }

      if (!result._timestamp) {
        result._timestamp = extractTimestamp(line);
      }
    }

    return result;
  };
}

function normalizeTimestamp(value, format) {
  if (!value) return null;
  if (format) {
    const m = dayjs(value, format);
    return m.isValid() ? m.toISOString() : value;
  }
  const m = dayjs(value);
  return m.isValid() ? m.toISOString() : value;
}

function extractTimestamp(line) {
  const tsPatterns = [
    /\[(\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4})\]/,
    /(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/,
    /(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/
  ];

  for (const pattern of tsPatterns) {
    const match = line.match(pattern);
    if (match) {
      const m = dayjs(match[1]);
      if (m.isValid()) return m.toISOString();
    }
  }

  return null;
}

function parseLine(line, source) {
  const parser = createParser(source);
  return parser(line);
}

module.exports = {
  parseLine,
  createParser,
  parseNginxAccess,
  parseNginxError,
  parseJsonLine,
  parseCsvLine,
  parseRegexLine,
  parseCommonLog,
  autoDetectParser,
  extractTimestamp,
  normalizeTimestamp
};
