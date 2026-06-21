const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const iconv = require('iconv-lite');
const xml2js = require('xml2js');
const { logger, verbose } = require('../utils/logger');
const { detectFormatByExtension, getFileExtension, flattenObject, generateId } = require('../utils/common');
const { performanceConfig } = require('../../config/schedule');

class MultiFormatParser {
  constructor(options = {}) {
    this.options = {
      encoding: 'auto',
      maxExcelRows: performanceConfig.maxExcelRowsPerSheet,
      ...options
    };
  }

  async parse(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    const filename = options.filename || path.basename(filePath);
    const format = options.format || detectFormatByExtension(filename);
    if (!format) {
      throw new Error(`无法识别文件格式: ${filename}`);
    }
    const startTime = Date.now();
    verbose(`解析文件 ${filename}, 格式=${format}`);
    let records = [];
    let metadata = {};
    switch (format) {
      case 'excel':
        records = await this._parseExcel(filePath, options);
        metadata = { sheetCount: records._sheetCount || 1 };
        break;
      case 'csv':
        records = await this._parseCsv(filePath, options);
        break;
      case 'json':
        records = await this._parseJson(filePath, options);
        break;
      case 'xml':
        records = await this._parseXml(filePath, options);
        break;
      default:
        throw new Error(`不支持的文件格式: ${format}`);
    }
    return {
      success: true,
      format,
      filePath,
      filename,
      recordCount: records.length,
      records,
      metadata,
      parseDurationMs: Date.now() - startTime,
      parsedAt: new Date().toISOString()
    };
  }

  async _parseExcel(filePath, options = {}) {
    const workbook = xlsx.readFile(filePath, {
      cellDates: true,
      cellNF: false,
      cellHTML: false
    });
    const allRecords = [];
    const sheetNames = workbook.SheetNames;
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, {
        defval: null,
        raw: false,
        header: options.header || 1,
        range: options.range || undefined
      });
      const maxRows = this.options.maxExcelRows;
      if (jsonData.length > maxRows) {
        logger.warn(`Excel Sheet ${sheetName} 数据量${jsonData.length}行，超过${maxRows}行上限，将截断`);
        jsonData.length = maxRows;
      }
      for (const row of jsonData) {
        if (row && typeof row === 'object') {
          allRecords.push({
            ...row,
            _sheetName: sheetName,
            _rowId: generateId()
          });
        }
      }
    }
    allRecords._sheetCount = sheetNames.length;
    return allRecords;
  }

  _detectEncoding(buffer) {
    const hasUtf8Bom = buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
    if (hasUtf8Bom) return 'utf-8';
    let gbkScore = 0;
    let utf8Score = 0;
    const sample = buffer.slice(0, Math.min(buffer.length, 8192));
    let i = 0;
    while (i < sample.length) {
      const b = sample[i];
      if (b <= 0x7F) {
        gbkScore++;
        utf8Score++;
        i++;
      } else if ((b & 0xE0) === 0xC0) {
        if (i + 1 < sample.length && (sample[i + 1] & 0xC0) === 0x80) {
          utf8Score += 2;
        }
        i += 2;
      } else if ((b & 0xF0) === 0xE0) {
        if (i + 2 < sample.length && (sample[i + 1] & 0xC0) === 0x80 && (sample[i + 2] & 0xC0) === 0x80) {
          utf8Score += 3;
        }
        if (b >= 0x81 && b <= 0xFE && i + 1 < sample.length) {
          const b2 = sample[i + 1];
          if ((b2 >= 0x40 && b2 <= 0x7E) || (b2 >= 0x80 && b2 <= 0xFE)) {
            gbkScore += 2;
          }
        }
        i += 3;
      } else if (b >= 0x81 && b <= 0xFE) {
        if (i + 1 < sample.length) {
          const b2 = sample[i + 1];
          if ((b2 >= 0x40 && b2 <= 0x7E) || (b2 >= 0x80 && b2 <= 0xFE)) {
            gbkScore += 2;
          }
        }
        i += 2;
      } else {
        i++;
      }
    }
    return gbkScore > utf8Score ? 'gbk' : 'utf-8';
  }

  async _parseCsv(filePath, options = {}) {
    const buffer = fs.readFileSync(filePath);
    let encoding = options.encoding || this.options.encoding;
    if (encoding === 'auto' || !encoding) {
      encoding = this._detectEncoding(buffer);
      verbose(`CSV编码检测结果: ${encoding}`);
    }
    let content;
    if (encoding.toLowerCase() === 'gbk' || encoding.toLowerCase() === 'gb2312') {
      content = iconv.decode(buffer, 'gbk');
    } else {
      content = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    }
    const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) return [];
    const delimiter = options.delimiter || this._detectDelimiter(lines[0]);
    const headers = this._parseCsvLine(lines[0], delimiter).map((h) => h.trim());
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCsvLine(lines[i], delimiter);
      const record = { _rowId: generateId() };
      headers.forEach((header, idx) => {
        if (header) {
          let val = values[idx];
          if (val !== undefined && val !== null) {
            val = val.trim();
            if (val === '') val = null;
            else if (!isNaN(Number(val)) && val !== '') val = Number(val);
          }
          record[header] = val;
        }
      });
      records.push(record);
    }
    return records;
  }

  _detectDelimiter(firstLine) {
    const delimiters = [',', ';', '\t', '|'];
    let best = ',';
    let maxCount = -1;
    for (const d of delimiters) {
      const count = firstLine.split(d).length;
      if (count > maxCount) {
        maxCount = count;
        best = d;
      }
    }
    return best;
  }

  _parseCsvLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  async _parseJson(filePath, options = {}) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let data;
    try {
      data = JSON.parse(content);
    } catch (err) {
      throw new Error(`JSON解析失败: ${err.message}`);
    }
    let records = [];
    if (Array.isArray(data)) {
      records = data;
    } else if (data && typeof data === 'object') {
      let found = null;
      const candidateKeys = ['data', 'records', 'list', 'items', 'result', 'rows', 'payload'];
      for (const key of candidateKeys) {
        if (Array.isArray(data[key])) {
          found = data[key];
          break;
        }
      }
      if (found) {
        records = found;
      } else {
        records = [data];
      }
    }
    return records.map((r, idx) => ({
      ...r,
      _rowId: generateId(),
      _rowIndex: idx
    }));
  }

  async _parseXml(filePath, options = {}) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      explicitCharkey: false,
      charkey: '_value',
      normalize: true,
      normalizeTags: false,
      trim: true
    });
    return new Promise((resolve, reject) => {
      parser.parseString(content, (err, result) => {
        if (err) {
          return reject(new Error(`XML解析失败: ${err.message}`));
        }
        const records = [];
        const flat = this._extractXmlRecords(result);
        flat.forEach((r, idx) => {
          records.push({
            ...flattenObject(r),
            _rowId: generateId(),
            _rowIndex: idx
          });
        });
        resolve(records);
      });
    });
  }

  _extractXmlRecords(obj, path = '') {
    const records = [];
    if (!obj || typeof obj !== 'object') return records;
    const arrayKeys = ['records', 'record', 'list', 'item', 'items', 'row', 'rows', 'data', 'result'];
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          records.push(...value);
        }
      } else if (typeof value === 'object' && value !== null) {
        const nested = this._extractXmlRecords(value, path ? `${path}.${key}` : key);
        if (nested.length > 0) {
          records.push(...nested);
        }
      }
    }
    if (records.length === 0) {
      const keys = Object.keys(obj);
      if (keys.some((k) => arrayKeys.includes(k.toLowerCase()))) {
        return records;
      }
      if (keys.length > 0) {
        return [obj];
      }
    }
    return records;
  }
}

module.exports = {
  MultiFormatParser
};
