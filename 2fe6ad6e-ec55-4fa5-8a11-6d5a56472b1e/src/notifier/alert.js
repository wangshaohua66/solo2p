'use strict';

/**
 * 异常告警与报表推送
 * 职责：
 *  1) 逾期/部分还款实时推送钉钉告警（HMAC-SHA256 加签）
 *  2) 全部银行核对完成后生成月度还款核对报告（Excel：异常明细 + 各银行还款率 + 逾期汇总）
 *  3) 报告通过 SMTP 发送至财务人员邮箱，附件为 Excel 明细表
 *  4) 银行页面变更告警通知运维人员
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');

const logger = require('../utils/logger');
const { getNotifier, envValue } = require('../utils/config');
const db = require('../utils/db');

const log = logger.forBank('NOTIFIER');

// ------------------------------------------------------------ 钉钉
function dingSign(secret, timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
  return encodeURIComponent(hmac);
}

async function pushDingTalk(title, text, isAlert = false) {
  const cfg = getNotifier().dingtalk || {};
  const token = envValue(cfg.access_token_env || 'DINGTALK_ACCESS_TOKEN');
  const secret = envValue(cfg.secret_env || 'DINGTALK_SECRET');
  if (!token) { log.debug('钉钉 access_token 未配置，跳过推送'); return false; }

  let url = `${cfg.webhook}?access_token=${token}`;
  if (secret) {
    const ts = Date.now();
    url += `&timestamp=${ts}&sign=${dingSign(secret, ts)}`;
  }
  const payload = {
    msgtype: 'markdown',
    markdown: {
      title: title,
      text: (isAlert ? '## ⚠️ 告警\n\n' : '## 📋 通知\n\n') + text,
    },
    at: { isAtAll: !!cfg.at_all },
  };
  try {
    const resp = await axios.post(url, payload, { timeout: 10000 });
    if (resp.data && resp.data.errcode === 0) {
      log.success('钉钉推送成功');
      return true;
    }
    log.warn(`钉钉推送失败: ${JSON.stringify(resp.data)}`);
    return false;
  } catch (e) {
    log.warn(`钉钉推送异常: ${e.message}`);
    return false;
  }
}

/**
 * 异常实时告警（逾期/部分还款）
 */
async function alertException(ex) {
  const typeMap = { overdue: '逾期还款', partial: '部分还款', early: '提前还款', rate_change: '利率调整' };
  const cfg = getNotifier().dingtalk || {};
  const realtimeTypes = cfg.realtime_types || ['overdue', 'partial'];
  if (!realtimeTypes.includes(ex.type)) return false;

  const text =
    `**${typeMap[ex.type] || ex.type}**\n\n` +
    `银行：${ex.bank_code}\n\n` +
    `借款人：${ex.borrower_name || '-'}\n\n` +
    `合同号：${ex.contract_no}\n\n` +
    `期次：${ex.period}\n\n` +
    `应还：${ex.due_amount} 元 / 实还：${ex.actual_amount} 元\n\n` +
    `应还日期：${ex.due_date || '-'} / 实还日期：${ex.repay_date || '-'}\n\n` +
    `说明：${ex.detail}`;
  return pushDingTalk(`${typeMap[ex.type] || '异常'}告警`, text, true);
}

// ------------------------------------------------------------ 月度报告
function buildReportWorkbook(runId, summary, month) {
  const wb = XLSX.utils.book_new();

  // Sheet1: 异常明细
  const exRows = (summary.exceptions || []).map((e) => ({
    银行: e.bank_code, 合同号: e.contract_no, 借款人: e.borrower_name,
    期次: e.period, 异常类型: e.type, 应还金额: e.due_amount, 实还金额: e.actual_amount,
    应还日期: e.due_date, 实还日期: e.repay_date, 逾期天数: e.overdue_days, 说明: e.detail,
  }));
  const ws1 = XLSX.utils.json_to_sheet(exRows.length ? exRows : [{ 提示: '本期无异常' }]);
  XLSX.utils.book_append_sheet(wb, ws1, '异常明细');

  // Sheet2: 各银行还款率统计
  const bankRows = Object.entries(summary.byBank || {}).map(([code, s]) => {
    const due = (s.dueTotal || 0);
    const actual = (s.actualTotal || 0);
    const rate = due > 0 ? Math.round((actual / due) * 10000) / 100 : 0;
    return {
      银行: code, 还款笔数: s.total || 0, 匹配笔数: s.matched || 0,
      应还总额_元: round2(due), 实还总额_元: round2(actual),
      还款率_百分比: rate, 异常笔数: s.exceptions || 0,
    };
  });
  const ws2 = XLSX.utils.json_to_sheet(bankRows.length ? bankRows : [{ 提示: '无银行数据' }]);
  XLSX.utils.book_append_sheet(wb, ws2, '各银行还款率');

  // Sheet3: 逾期金额汇总
  const overdueRows = [
    { 指标: '总记录数', 数值: summary.total },
    { 指标: '匹配记录数', 数值: summary.matched },
    { 指标: '逾期笔数', 数值: summary.overdue },
    { 指标: '逾期未还金额_元', 数值: summary.overdueAmount },
    { 指标: '部分还款笔数', 数值: summary.partial },
    { 指标: '部分还款差额_元', 数值: summary.partialAmount },
    { 指标: '提前还款笔数', 数值: summary.early },
    { 指标: '利率调整笔数', 数值: summary.rate_change },
    { 指标: '未匹配笔数', 数值: summary.unmatched },
    { 指标: '统计月份', 数值: month || '-' },
  ];
  const ws3 = XLSX.utils.json_to_sheet(overdueRows);
  XLSX.utils.book_append_sheet(wb, ws3, '逾期汇总');

  return wb;
}

async function sendMonthlyReport(runId, summary, month) {
  const cfg = getNotifier().email || {};
  const user = envValue(cfg.user_env || 'SMTP_USER');
  const pass = envValue(cfg.pass_env || 'SMTP_PASS');
  if (!user || !pass) { log.warn('SMTP 凭据未配置，月度报告邮件跳过发送（已生成本地文件）'); }

  const wb = buildReportWorkbook(runId, summary, month);
  const reportDir = path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const fileName = `还款核对报告_${month || new Date().toISOString().slice(0, 7)}.xlsx`;
  const filePath = path.join(reportDir, fileName);
  XLSX.writeFile(wb, filePath);
  log.success(`月度报告已生成: ${filePath}`);

  if (!user || !pass || !cfg.to || !cfg.to.length) return filePath;

  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host, port: cfg.smtp_port || 465, secure: cfg.secure !== false,
    auth: { user, pass },
  });

  const mailOptions = {
    from: cfg.from || user,
    to: cfg.to.join(','),
    subject: `${cfg.subject_prefix || ''}月度还款核对报告 ${month || ''}`,
    html: renderReportEmail(summary, month),
    attachments: [{ filename: fileName, path: filePath }],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    log.success(`月度报告邮件已发送: ${info.messageId}`);
  } catch (e) {
    log.error(`月度报告邮件发送失败: ${e.message}`);
  }
  return filePath;
}

function renderReportEmail(summary, month) {
  const rows = Object.entries(summary.byBank || {}).map(([code, s]) =>
    `<tr><td>${code}</td><td>${s.total || 0}</td><td>${s.matched || 0}</td><td>${s.exceptions || 0}</td></tr>`
  ).join('');
  return `
    <h2>公积金还款月度核对报告（${month || '-'}）</h2>
    <p>总记录 <b>${summary.total}</b> 条，匹配 <b>${summary.matched}</b> 条，逾期 <b>${summary.overdue}</b> 笔（未还 ${summary.overdueAmount} 元），部分还款 <b>${summary.partial}</b> 笔，提前还款 <b>${summary.early}</b> 笔，利率调整 <b>${summary.rate_change}</b> 笔，未匹配 <b>${summary.unmatched}</b> 笔。</p>
    <table border="1" cellspacing="0" cellpadding="6">
      <tr><th>银行</th><th>笔数</th><th>匹配</th><th>异常</th></tr>
      ${rows}
    </table>
    <p>详见附件 Excel 明细表。</p>`;
}

// ------------------------------------------------------------ 运维告警
async function alertOpsBankChange(bankCode, detail) {
  const cfg = getNotifier().email || {};
  const user = envValue(cfg.user_env || 'SMTP_USER');
  const pass = envValue(cfg.pass_env || 'SMTP_PASS');
  const text = `**页面结构变更告警**\n\n银行：${bankCode}\n\n详情：${detail}\n\n请运维人员尽快更新 banks.yml 定位器配置。`;
  await pushDingTalk(`银行页面变更告警`, text, true);
  if (user && pass && cfg.ops_to && cfg.ops_to.length) {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host, port: cfg.smtp_port || 465, secure: cfg.secure !== false,
      auth: { user, pass },
    });
    try {
      await transporter.sendMail({
        from: cfg.from || user,
        to: cfg.ops_to.join(','),
        subject: `【运维】银行页面结构变更告警 - ${bankCode}`,
        text,
      });
      log.success(`运维告警邮件已发送: ${bankCode}`);
    } catch (e) {
      log.warn(`运维告警邮件失败: ${e.message}`);
    }
  }
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

module.exports = {
  pushDingTalk,
  alertException,
  buildReportWorkbook,
  sendMonthlyReport,
  alertOpsBankChange,
};
