'use strict';

const axios = require('axios');
const { retry, getHttpStatus } = require('./util');

class Notifier {
  constructor(config) {
    this.config = config || {};
    this.dingtalk = this.config.dingtalk || '';
    this.wechat = this.config.wechat || '';
    this.timeout = this.config.timeout || 8000;
  }

  async _post(url, payload) {
    return retry(async () => {
      const res = await axios.post(url, payload, {
        timeout: this.timeout,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true
      });
      if (res.status >= 500 || res.status === 429) {
        const err = new Error(`webhook returned status ${res.status}`);
        err.response = res;
        err.code = res.status === 429 ? 429 : `EHTTP_${res.status}`;
        throw err;
      }
      const body = res.data;
      if (body && body.errcode && body.errcode !== 0) {
        const err = new Error(`webhook error: ${body.errmsg || body.errcode}`);
        err.response = res;
        throw err;
      }
      return { ok: true, status: res.status, body };
    }, { retries: 3, baseDelay: 600 });
  }

  async sendDingTalk(title, markdownText) {
    if (!this.dingtalk) return { ok: false, reason: 'no-dingtalk-webhook' };
    const payload = {
      msgtype: 'markdown',
      markdown: { title, text: markdownText }
    };
    try {
      return await this._post(this.dingtalk, payload);
    } catch (err) {
      return { ok: false, error: err.message, status: getHttpStatus(err) };
    }
  }

  async sendWeChat(title, markdownText) {
    if (!this.wechat) return { ok: false, reason: 'no-wechat-webhook' };
    const payload = {
      msgtype: 'markdown',
      markdown: { content: markdownText }
    };
    try {
      return await this._post(this.wechat, payload);
    } catch (err) {
      return { ok: false, error: err.message, status: getHttpStatus(err) };
    }
  }

  async notifyAll(title, markdownText) {
    const results = {};
    if (this.dingtalk) results.dingtalk = await this.sendDingTalk(title, markdownText);
    if (this.wechat) results.wechat = await this.sendWeChat(title, markdownText);
    return results;
  }

  formatCertAlert(items, profileName) {
    const lines = [];
    lines.push(`### 证书过期预警 (${profileName})`);
    lines.push(`> 共 ${items.length} 张证书需要关注\n`);
    for (const it of items) {
      const emoji = it.tier === 'expired' ? '🔴' : it.tier === 'critical' ? '🔴' : it.tier === 'high' ? '🟠' : it.tier === 'medium' ? '🟡' : '🟢';
      lines.push(`${emoji} **${it.cn || it.fingerprint.slice(0, 16)}**  剩余 ${it.daysRemaining} 天  \`${it.tier}\``);
      if (it.sans && it.sans.length) lines.push(`   SAN: ${it.sans.map((s) => s.value).join(', ')}`);
      lines.push(`   到期: ${it.notAfter}`);
    }
    return { title: `证书过期预警 (${profileName})`, markdown: lines.join('\n') };
  }

  formatRotateAlert(results, profileName) {
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    const lines = [];
    lines.push(`### 密钥轮换报告 (${profileName})`);
    lines.push(`> 成功 ${ok} / 失败 ${failed.length} / 共 ${results.length}\n`);
    if (failed.length) {
      lines.push('**失败项:**');
      for (const f of failed) lines.push(`- ${f.path || f.name} : ${f.error || '未知错误'}`);
    }
    return { title: `密钥轮换报告 (${profileName})`, markdown: lines.join('\n') };
  }
}

module.exports = { Notifier };
