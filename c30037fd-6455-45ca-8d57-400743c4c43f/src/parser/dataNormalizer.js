'use strict';

const { format, parse, isValid, differenceInDays } = require('date-fns');
const { zhCN } = require('date-fns/locale');
const { logger } = require('../utils/logger');

const EVENT_TYPES = {
  RECALL: 'recall',
  LICENSE_EXPIRY: 'license_expiry',
  GSP_INSPECTION: 'gsp_inspection',
  BID_RESULT: 'bid_result',
  ADR_REPORT: 'adr_report',
  SAMPLING_RESULT: 'sampling_result',
  LICENSE_CHANGE: 'license_change',
  APPROVAL_CHANGE: 'approval_change',
  GSP_CERT: 'gsp_cert',
};

const URGENCY_MAP = {
  '一级召回': 'CRITICAL', '一级': 'CRITICAL', '立即召回': 'CRITICAL',
  '停止使用': 'CRITICAL', '紧急': 'CRITICAL', 'A级': 'CRITICAL',
  '二级召回': 'HIGH', '二级': 'HIGH', '暂停销售': 'HIGH',
  '暂停使用': 'HIGH', '重要': 'HIGH', 'B级': 'HIGH',
  '三级召回': 'MEDIUM', '三级': 'MEDIUM', '一般缺陷': 'MEDIUM',
  '限期整改': 'MEDIUM', 'C级': 'MEDIUM', '一般': 'MEDIUM',
  '补充通知': 'LOW', '公示': 'LOW', 'D级': 'LOW', '关注': 'LOW',
};

const DATE_PATTERNS = [
  'yyyy-MM-dd', 'yyyy/MM/dd', 'yyyy年MM月dd日',
  'yyyy.MM.dd', 'yyyyMMdd', 'MM/dd/yyyy',
  'yyyy-MM-dd HH:mm:ss', 'yyyy/MM/dd HH:mm',
];

class DataNormalizer {
  constructor(urgencyConfig) {
    this.urgencyConfig = urgencyConfig || {};
  }

  normalize(platform, rawRecord, dataType) {
    try {
      const base = {
        source_platform: platform?.code || platform?.name || 'UNKNOWN',
        source_platform_name: platform?.name || '',
        event_type: this._resolveEventType(dataType, rawRecord),
        collected_at: new Date(),
      };
      const normalized = { ...base };

      normalized.drug_name = this._cleanText(
        rawRecord.drug_name || rawRecord.drug || rawRecord.title || rawRecord.name || ''
      );
      normalized.approval_no = this._normalizeApprovalNo(
        rawRecord.approval_no || rawRecord.approvalNumber || rawRecord.批文 || rawRecord.approval || ''
      );
      normalized.notice_no = this._cleanText(
        rawRecord.notice_no || rawRecord.noticeNo || rawRecord.notice_number || rawRecord.announcement_no || ''
      );
      normalized.title = this._cleanText(
        rawRecord.title || rawRecord.notice_title || rawRecord.subject || normalized.drug_name
      );
      normalized.publish_date = this._normalizeDate(
        rawRecord.publish_date || rawRecord.publishDate || rawRecord.date || rawRecord.created || ''
      );
      normalized.urgency = this._resolveUrgency(rawRecord, normalized.event_type);
      normalized.detail_url = rawRecord.detail_url || rawRecord.url || rawRecord.link || '';

      switch (normalized.event_type) {
        case EVENT_TYPES.RECALL:
          normalized.recall_level = rawRecord.recall_level || '';
          normalized.recall_reason = rawRecord.reason || rawRecord.content || '';
          normalized.manufacturer = this._cleanText(rawRecord.manufacturer || rawRecord.producer || '');
          normalized.batch_no = this._cleanText(rawRecord.batch_no || rawRecord.batchNumber || '');
          break;
        case EVENT_TYPES.LICENSE_EXPIRY:
          normalized.license_no = this._cleanText(rawRecord.license_no || rawRecord.cert_no || '');
          normalized.license_owner = this._cleanText(rawRecord.license_owner || rawRecord.cert_holder || rawRecord.holder || '');
          normalized.license_type = rawRecord.license_type || rawRecord.cert_type || '';
          normalized.expiry_date = this._normalizeDate(rawRecord.expiry_date || rawRecord.valid_to || rawRecord.expireDate || '');
          normalized.valid_from = this._normalizeDate(rawRecord.valid_from || '');
          if (normalized.expiry_date) {
            normalized.days_until_expiry = Math.max(0, differenceInDays(new Date(normalized.expiry_date), new Date()));
          }
          break;
        case EVENT_TYPES.GSP_INSPECTION:
          normalized.gsp_result = this._cleanText(rawRecord.gsp_result || rawRecord.inspection_result || rawRecord.result || '');
          normalized.gsp_defects = rawRecord.defects || rawRecord.defect_list || [];
          normalized.inspection_date = this._normalizeDate(rawRecord.inspection_date || rawRecord.check_date || '');
          normalized.inspector = rawRecord.inspector || '';
          break;
        case EVENT_TYPES.BID_RESULT:
          normalized.bid_winner = this._cleanText(rawRecord.winner || rawRecord.bid_winner || rawRecord.manufacturer || '');
          normalized.bid_price = rawRecord.price || rawRecord.bid_price || 0;
          normalized.bid_quantity = rawRecord.quantity || 0;
          normalized.manufacturer = this._cleanText(rawRecord.manufacturer || '');
          break;
        case EVENT_TYPES.ADR_REPORT:
          normalized.adr_type = this._cleanText(rawRecord.adr_type || rawRecord.type || '');
          normalized.adr_severity = this._cleanText(rawRecord.severity || '');
          normalized.report_count = Number(rawRecord.report_count || rawRecord.count || 0);
          normalized.affected_patients = Number(rawRecord.affected || 0);
          break;
        case EVENT_TYPES.SAMPLING_RESULT:
          normalized.sample_result = this._cleanText(rawRecord.sample_result || rawRecord.result || '');
          normalized.sample_batch = this._cleanText(rawRecord.batch_no || rawRecord.batch || '');
          normalized.manufacturer = this._cleanText(rawRecord.manufacturer || '');
          normalized.test_items = rawRecord.test_items || [];
          break;
        default:
          break;
      }

      normalized.raw_payload = this._sanitizeRaw(rawRecord);
      normalized.is_valid = this._validate(normalized);
      return normalized;
    } catch (err) {
      logger.error('数据规范化失败', { error: err.message, platform: platform?.code, dataType });
      return null;
    }
  }

  normalizeBatch(platform, rawRecords, dataType) {
    if (!Array.isArray(rawRecords)) return [];
    return rawRecords
      .map((r) => this.normalize(platform, r, dataType))
      .filter((r) => r && r.is_valid);
  }

  _resolveEventType(dataType, raw) {
    if (dataType && Object.values(EVENT_TYPES).includes(dataType)) return dataType;
    const hint = JSON.stringify(raw).toLowerCase();
    if (/召回|recall/.test(hint)) return EVENT_TYPES.RECALL;
    if (/许可.*到期|证件.*到期|expir/.test(hint)) return EVENT_TYPES.LICENSE_EXPIRY;
    if (/gsp|飞行检查|认证检查/.test(hint)) return EVENT_TYPES.GSP_INSPECTION;
    if (/中标|集采|招标|bid|winner/.test(hint)) return EVENT_TYPES.BID_RESULT;
    if (/不良反应|adr/.test(hint)) return EVENT_TYPES.ADR_REPORT;
    if (/抽检|抽样|检验|不合格|sampling/.test(hint)) return EVENT_TYPES.SAMPLING_RESULT;
    return dataType || 'generic';
  }

  _resolveUrgency(raw, eventType) {
    const text = [raw.urgency, raw.level, raw.severity, raw.gsp_result, raw.sample_result, raw.adr_type, raw.title, raw.reason]
      .filter(Boolean).join(' ');
    for (const [kw, lvl] of Object.entries(URGENCY_MAP)) {
      if (text.includes(kw)) return lvl;
    }
    if (this.urgencyConfig) {
      for (const [name, cfg] of Object.entries(this.urgencyConfig)) {
        if (Array.isArray(cfg.keywords)) {
          for (const kw of cfg.keywords) {
            if (text.includes(kw)) return name;
          }
        }
      }
    }
    if (eventType === EVENT_TYPES.ADR_REPORT && /严重|死亡/.test(text)) return 'CRITICAL';
    if (eventType === EVENT_TYPES.LICENSE_EXPIRY) return 'MEDIUM';
    return 'LOW';
  }

  _normalizeApprovalNo(value) {
    if (!value) return '';
    let s = String(value).trim();
    s = s.replace(/[（(【\[]\s*国药准字\s*[)）\]】]/g, '国药准字');
    s = s.replace(/\s+/g, '');
    const m = s.match(/国药准字[A-Z]\d{8}/);
    if (m) return m[0];
    const m2 = s.match(/[A-Z]\d{7,}/);
    if (m2) return '国药准字' + m2[0];
    return s;
  }

  _normalizeDate(value) {
    if (!value) return null;
    if (value instanceof Date && isValid(value)) return format(value, 'yyyy-MM-dd');
    const str = String(value).trim();
    if (!str) return null;
    for (const pat of DATE_PATTERNS) {
      try {
        const d = parse(str, pat, new Date(), { locale: zhCN });
        if (isValid(d)) return format(d, 'yyyy-MM-dd');
      } catch (_) {}
    }
    const generic = str.match(/(\d{4})[-/.年]?(\d{1,2})[-/.月]?(\d{1,2})/);
    if (generic) {
      const [, y, m, d] = generic;
      const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      const parsed = parse(iso, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) return iso;
    }
    return str;
  }

  _cleanText(value) {
    if (value == null) return '';
    return String(value)
      .replace(/\s+/g, ' ')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim();
  }

  _sanitizeRaw(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const copy = JSON.parse(JSON.stringify(raw));
    for (const key of Object.keys(copy)) {
      if (/(password|token|cookie|secret|pwd|pass)/i.test(key)) {
        delete copy[key];
      }
    }
    return copy;
  }

  _validate(n) {
    if (!n.drug_name && !n.approval_no && !n.notice_no) return false;
    if (!n.event_type) return false;
    return true;
  }
}

module.exports = DataNormalizer;
module.exports.EVENT_TYPES = EVENT_TYPES;
module.exports.URGENCY_LEVELS = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
