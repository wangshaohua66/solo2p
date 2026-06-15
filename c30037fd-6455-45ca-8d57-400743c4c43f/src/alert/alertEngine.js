'use strict';

const EventEmitter = require('events');
const { differenceInDays, parse } = require('date-fns');
const { logger, alertLogger } = require('../utils/logger');
const repository = require('../storage/repository');

class AlertEngine extends EventEmitter {
  constructor(rules, urgencyLevels) {
    super();
    this.rules = rules || {};
    this.urgencyLevels = urgencyLevels || {};
    this.firedCache = new Set();
    this.ruleHits = new Map();
  }

  reload(rules, urgencyLevels) {
    this.rules = rules || {};
    this.urgencyLevels = urgencyLevels || {};
    logger.info(`告警引擎规则重载完成: 启用规则 ${Object.keys(this.rules).filter((k) => this.rules[k].enabled !== false).length} 条`);
  }

  async evaluateEvent(event) {
    if (!event) return [];
    const matched = [];
    for (const [ruleKey, rule] of Object.entries(this.rules)) {
      if (rule.enabled === false) continue;
      try {
        const match = this._matchRule(rule, event);
        if (match) {
          const fired = await this._executeAction(rule, event, ruleKey);
          if (fired) matched.push({ ruleKey, rule, alert: fired });
        }
      } catch (err) {
        logger.error('告警规则执行失败', { rule: ruleKey, error: err.message });
      }
    }
    return matched;
  }

  async evaluateBatch(events) {
    const all = [];
    for (const ev of events || []) {
      const r = await this.evaluateEvent(ev);
      all.push(...r);
    }
    return all;
  }

  _matchRule(rule, event) {
    const cond = rule.conditions || {};
    const allConditions = [];

    if (cond.event_type && cond.event_type.length) {
      allConditions.push(cond.event_type.includes(event.event_type));
    }
    if (cond.urgency_keywords_match) {
      const field = cond.urgency_keywords_match.field || 'urgency,title';
      const kws = cond.urgency_keywords_match.any || [];
      const text = field.split(',').map((f) => String(event[f.trim()] || '')).join(' ');
      allConditions.push(kws.some((kw) => text.includes(kw)));
    }
    if (cond.field_keywords) {
      const field = cond.field_keywords.field || 'title';
      const kws = cond.field_keywords.any || [];
      const text = field.split(',').map((f) => String(event[f.trim()] || '')).join(' ');
      allConditions.push(kws.some((kw) => text.includes(kw)));
    }
    if (cond.drug_keywords_match) {
      const field = cond.drug_keywords_match.field || 'drug_name';
      const kws = cond.drug_keywords_match.any || [];
      const text = String(event[field] || '');
      allConditions.push(kws.some((kw) => text.includes(kw)));
    }
    if (cond.approval_prefix) {
      const prefixes = cond.approval_prefix.any || cond.approval_prefix;
      const val = String(event.approval_no || '');
      allConditions.push(prefixes.some((p) => val.startsWith(p)));
    }
    if (cond.winner_keywords) {
      const field = cond.winner_keywords.field || 'bid_winner';
      const kws = cond.winner_keywords.any || [];
      const text = field.split(',').map((f) => String(event[f.trim()] || '')).join(' ');
      allConditions.push(kws.some((kw) => text.includes(kw)));
    }
    if (cond.date_range) {
      const field = cond.date_range.field || 'expiry_date';
      const [minDays, maxDays] = cond.date_range.within_days || [0, 30];
      try {
        const dateVal = event[field];
        if (dateVal) {
          const parsed = parse(String(dateVal), 'yyyy-MM-dd', new Date());
          const diff = differenceInDays(parsed, new Date());
          event.days_left = diff;
          allConditions.push(diff >= minDays && diff <= maxDays);
        } else {
          allConditions.push(false);
        }
      } catch (_) {
        allConditions.push(false);
      }
    }
    return allConditions.length > 0 && allConditions.every(Boolean);
  }

  async _executeAction(rule, event, ruleKey) {
    const dedupKey = `${rule.id || ruleKey}:${event._id || event.notice_no || event.approval_no + event.drug_name}`;
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    const lastFire = this.ruleHits.get(dedupKey);
    if (lastFire && now - lastFire < cooldown) return null;
    this.ruleHits.set(dedupKey, now);

    const action = rule.action || {};
    const urgency = this._deriveUrgency(action.type, event);
    const message = this._renderTemplate(action.template, event);

    const alert = {
      ruleId: rule.id || ruleKey,
      ruleName: rule.name,
      ruleDescription: rule.description,
      type: action.type || 'INFO_NOTIFY',
      urgency,
      eventType: event.event_type,
      eventId: event._id || null,
      eventNoticeNo: event.notice_no,
      drugName: event.drug_name,
      approvalNo: event.approval_no,
      sourcePlatform: event.source_platform,
      publishDate: event.publish_date,
      message,
      channels: action.channels || ['console', 'log'],
      grouping: !!action.grouping,
      context: {
        title: event.title,
        urgency: event.urgency,
        expiryDate: event.expiry_date,
        daysLeft: event.days_left,
        gspResult: event.gsp_result,
        sampleResult: event.sample_result,
        bidWinner: event.bid_winner,
      },
    };

    if (alert.channels.includes('console') || alert.channels.includes('log')) {
      this._logAlert(alert);
    }
    const saved = await repository.saveAlert(alert);
    this.emit('alert:fired', saved);
    return saved;
  }

  _deriveUrgency(actionType, event) {
    switch (actionType) {
      case 'IMMEDIATE_ALERT': return 'CRITICAL';
      case 'PRIORITY_ALERT': return event.urgency === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
      case 'DAILY_SUMMARY': return event.days_left != null && event.days_left <= 7 ? 'CRITICAL' : 'MEDIUM';
      case 'WEEKLY_SUMMARY': return 'MEDIUM';
      default: return event.urgency || 'LOW';
    }
  }

  _renderTemplate(tpl, event) {
    if (!tpl) return '';
    return tpl.replace(/\{(\w+)\}/g, (_, key) => {
      if (event[key] != null) return String(event[key]);
      const ctx = event.context || {};
      return String(ctx[key] || '');
    });
  }

  _logAlert(alert) {
    const level = this._toLogLevel(alert.urgency);
    alertLogger.log(level, alert.message, {
      urgency: alert.urgency,
      rule: alert.ruleId,
      platform: alert.sourcePlatform,
      eventType: alert.eventType,
      drug: alert.drugName,
    });
    this.emit('log', { level, alert });
  }

  _toLogLevel(urgency) {
    if (urgency === 'CRITICAL') return 'alert';
    if (urgency === 'HIGH') return 'error';
    if (urgency === 'MEDIUM') return 'warn';
    return 'info';
  }
}

module.exports = AlertEngine;
