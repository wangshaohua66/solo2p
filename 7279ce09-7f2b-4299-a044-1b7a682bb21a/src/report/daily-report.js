import dayjs from 'dayjs';
import nodemailer from 'nodemailer';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('DailyReport');

function formatPrice(price) {
  if (price === null || price === undefined || isNaN(price)) {
    return '—';
  }
  const num = Number(price);
  if (num >= 100000000) {
    return (num / 100000000).toFixed(2) + '亿';
  } else if (num >= 10000) {
    return (num / 10000).toFixed(2) + '万';
  }
  return num.toLocaleString('zh-CN') + '元';
}

function calculateDiscountRate(auction) {
  if (!auction) return null;
  const startPrice = Number(auction.start_price || auction.startPrice || 0);
  const assessPrice = Number(auction.assess_price || auction.assessPrice || 0);
  if (assessPrice <= 0) return null;
  return Number(((startPrice / assessPrice) * 100).toFixed(2));
}

function calculatePriceDiff(auction) {
  const discountRate = calculateDiscountRate(auction);
  if (discountRate === null) return null;
  return Number((100 - discountRate).toFixed(2));
}

function generateStars(stars) {
  const s = Math.max(1, Math.min(5, Number(stars) || 1));
  const full = '★'.repeat(s);
  const empty = '☆'.repeat(5 - s);
  return full + empty;
}

function calculateStarRating(auction) {
  const discountRate = calculateDiscountRate(auction);
  if (discountRate === null) {
    return { score: 0, stars: 1, starDisplay: '★☆☆☆☆', isHighValue: false };
  }

  let score = 0;
  const discountScore = Math.max(0, (100 - discountRate) * 0.6);
  score += discountScore;

  const round = auction.round || '';
  let roundWeight = 1.0;
  if (round.includes('二拍')) roundWeight = 1.2;
  else if (round.includes('变卖')) roundWeight = 1.3;
  const roundScore = Math.min(100, (roundWeight - 1) * 500) * 0.2;
  score += roundScore;

  score = Math.max(0, Math.min(100, score));

  let stars = 1;
  if (score >= 90) stars = 5;
  else if (score >= 75) stars = 4;
  else if (score >= 60) stars = 3;
  else if (score >= 40) stars = 2;

  return {
    score: Number(score.toFixed(2)),
    stars,
    starDisplay: generateStars(stars),
    isHighValue: stars >= 3
  };
}

function generateCountdown(auctionDate) {
  if (!auctionDate) return { text: '待定', days: 0, hours: 0, isExpired: false };

  const target = dayjs(auctionDate);
  const now = dayjs();
  const diffMs = target.valueOf() - now.valueOf();

  if (diffMs <= 0) {
    return { text: '已开拍', days: 0, hours: 0, isExpired: true };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  let text = '';
  if (days > 0) {
    text = `${days}天${hours}小时`;
  } else if (hours > 0) {
    text = `${hours}小时${minutes}分`;
  } else {
    text = `${minutes}分钟`;
  }

  return { text, days, hours, minutes, isExpired: false };
}

function getDiscountColorClass(discountRate) {
  if (discountRate === null) return 'discount-unknown';
  if (discountRate <= 50) return 'discount-danger';
  if (discountRate <= 70) return 'discount-warning';
  if (discountRate <= 85) return 'discount-info';
  return 'discount-normal';
}

function getDiscountBgColor(discountRate) {
  if (discountRate === null) return '#9ca3af';
  if (discountRate <= 50) return '#dc2626';
  if (discountRate <= 70) return '#f59e0b';
  if (discountRate <= 85) return '#3b82f6';
  return '#10b981';
}

function generatePriceBarChart(assessPrice, startPrice) {
  const assess = Number(assessPrice) || 0;
  const start = Number(startPrice) || 0;

  if (assess <= 0 && start <= 0) {
    return `<div class="price-chart-empty">暂无价格数据</div>`;
  }

  const maxPrice = Math.max(assess, start);
  const assessWidth = maxPrice > 0 ? (assess / maxPrice) * 100 : 0;
  const startWidth = maxPrice > 0 ? (start / maxPrice) * 100 : 0;

  const discountRate = assess > 0 ? (start / assess) * 100 : null;
  const diffPercent = discountRate !== null ? (100 - discountRate).toFixed(1) : null;

  return `
    <div class="price-chart">
      <div class="price-bar-row">
        <div class="price-bar-label">评估价</div>
        <div class="price-bar-track">
          <div class="price-bar assess-bar" style="width: ${assessWidth}%">
            <span class="price-bar-value">${formatPrice(assess)}</span>
          </div>
        </div>
      </div>
      <div class="price-bar-row">
        <div class="price-bar-label">起拍价</div>
        <div class="price-bar-track">
          <div class="price-bar start-bar" style="width: ${startWidth}%">
            <span class="price-bar-value">${formatPrice(start)}</span>
          </div>
        </div>
      </div>
      ${diffPercent !== null ? `
      <div class="price-diff-info">
        <span class="price-diff-label">价差</span>
        <span class="price-diff-value" style="color: ${getDiscountBgColor(discountRate)}">-${diffPercent}%</span>
      </div>
      ` : ''}
    </div>
  `;
}

function generateAuctionRow(auction) {
  const discountRate = calculateDiscountRate(auction);
  const priceDiff = calculatePriceDiff(auction);
  const rating = calculateStarRating(auction);
  const countdown = generateCountdown(auction.auction_date || auction.auctionDate);
  const colorClass = getDiscountColorClass(discountRate);

  const address = auction.address || auction.title || '未知地址';
  const area = auction.area ? `${auction.area}㎡` : '—';
  const round = auction.round || '—';
  const court = auction.court_name || auction.court || '—';

  return `
    <tr class="auction-row">
      <td class="col-title">
        <div class="auction-title">${address}</div>
        <div class="auction-subtitle">
          <span class="round-tag">${round}</span>
          <span class="court-name">${court}</span>
        </div>
      </td>
      <td class="col-price">
        <div class="price-assess">评估: ${formatPrice(auction.assess_price || auction.assessPrice)}</div>
        <div class="price-start">起拍: <strong>${formatPrice(auction.start_price || auction.startPrice)}</strong></div>
      </td>
      <td class="col-discount">
        <span class="discount-tag ${colorClass}">
          ${discountRate !== null ? discountRate + '%' : '—'}
        </span>
        ${priceDiff !== null ? `<div class="diff-text">省${priceDiff}%</div>` : ''}
      </td>
      <td class="col-area">${area}</td>
      <td class="col-stars">
        <span class="star-rating">${rating.starDisplay}</span>
        <div class="score-text">${rating.score}分</div>
      </td>
      <td class="col-countdown">
        <span class="countdown-text ${countdown.isExpired ? 'expired' : ''}">${countdown.text}</span>
      </td>
    </tr>
  `;
}

function generateHighValueCard(auction) {
  const discountRate = calculateDiscountRate(auction);
  const priceDiff = calculatePriceDiff(auction);
  const rating = calculateStarRating(auction);
  const countdown = generateCountdown(auction.auction_date || auction.auctionDate);
  const colorClass = getDiscountColorClass(discountRate);
  const barChart = generatePriceBarChart(
    auction.assess_price || auction.assessPrice,
    auction.start_price || auction.startPrice
  );

  const title = auction.title || auction.address || '未知标的';
  const address = auction.address || '暂无详细地址';
  const area = auction.area ? `${auction.area}㎡` : '—';
  const round = auction.round || '—';
  const court = auction.court_name || auction.court || '—';
  const bidCount = auction.bid_count || auction.bidCount || 0;

  return `
    <div class="high-value-card">
      <div class="card-header">
        <div class="card-title">
          <h3>${title}</h3>
          <span class="high-value-badge">高价值标的</span>
        </div>
        <div class="star-rating-large">
          <span class="stars">${rating.starDisplay}</span>
          <span class="score">${rating.score}分</span>
        </div>
      </div>

      <div class="card-body">
        <div class="info-row">
          <span class="info-label">📍 地址</span>
          <span class="info-value">${address}</span>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">面积</span>
            <span class="info-value">${area}</span>
          </div>
          <div class="info-item">
            <span class="info-label">轮次</span>
            <span class="info-value">${round}</span>
          </div>
          <div class="info-item">
            <span class="info-label">法院</span>
            <span class="info-value text-truncate">${court}</span>
          </div>
          <div class="info-item">
            <span class="info-label">报名</span>
            <span class="info-value">${bidCount}人</span>
          </div>
        </div>

        <div class="chart-section">
          <div class="chart-title">价格对比</div>
          ${barChart}
        </div>

        <div class="card-footer-info">
          <div class="discount-badge-large ${colorClass}">
            <span class="discount-label">折价率</span>
            <span class="discount-value">${discountRate !== null ? discountRate + '%' : '—'}</span>
          </div>
          <div class="countdown-badge">
            <span class="countdown-icon">⏰</span>
            <span class="countdown-label">距开拍</span>
            <span class="countdown-value ${countdown.isExpired ? 'expired' : ''}">${countdown.text}</span>
          </div>
        </div>
      </div>

      ${auction.notice_url || auction.noticeUrl ? `
      <div class="card-footer">
        <a href="${auction.notice_url || auction.noticeUrl}" target="_blank" class="view-detail-btn">查看详情 →</a>
      </div>
      ` : ''}
    </div>
  `;
}

function generateStatCard(label, value, subtext, color = 'blue') {
  const colorMap = {
    blue: '#3b82f6',
    green: '#10b981',
    orange: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
    gray: '#6b7280'
  };
  const bgColor = colorMap[color] || colorMap.blue;

  return `
    <div class="stat-card">
      <div class="stat-value" style="color: ${bgColor}">${value}</div>
      <div class="stat-label">${label}</div>
      ${subtext ? `<div class="stat-subtext">${subtext}</div>` : ''}
    </div>
  `;
}

function generateSiteStatsTable(siteStats) {
  if (!siteStats || siteStats.length === 0) {
    return '<div class="empty-state">暂无采集数据</div>';
  }

  let rows = '';
  for (const site of siteStats) {
    rows += `
      <tr>
        <td>${site.site_name}</td>
        <td>${site.crawl_count || 0}</td>
        <td>${site.total_items || 0}</td>
        <td>${site.total_new || 0}</td>
        <td>${site.total_errors || 0}</td>
        <td>${site.last_crawl_time ? dayjs(site.last_crawl_time).format('MM-DD HH:mm') : '—'}</td>
      </tr>
    `;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>站点名称</th>
          <th>采集次数</th>
          <th>总采集数</th>
          <th>新增数</th>
          <th>异常数</th>
          <th>最后采集</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function generateChangesList(changes) {
  if (!changes || changes.length === 0) {
    return '<div class="empty-state">今日无变更记录</div>';
  }

  let items = '';
  for (const change of changes) {
    const changedFields = change.changed_fields ? change.changed_fields.split(',') : [];
    const fieldLabels = changedFields.map(f => {
      const labelMap = {
        'start_price': '起拍价',
        'assess_price': '评估价',
        'current_price': '当前价',
        'round': '轮次',
        'status': '状态',
        'auction_date': '拍卖日期',
        'title': '标题',
        'address': '地址',
        'area': '面积',
        'bid_count': '报名人数'
      };
      return labelMap[f] || f;
    }).join('、');

    const title = change.title || change.address || '未知标的';

    items += `
      <div class="change-item">
        <div class="change-title">${title}</div>
        <div class="change-fields">
          <span class="change-icon">🔄</span>
          <span>变更: ${fieldLabels}</span>
        </div>
        <div class="change-time">${dayjs(change.updated_at).format('MM-DD HH:mm')}</div>
      </div>
    `;
  }

  return `<div class="changes-list">${items}</div>`;
}

function generateDailyReport(data, options = {}) {
  const reportDate = options.date || dayjs().format('YYYY年MM月DD日');
  const title = options.title || '法拍房监控日报';

  const stats = data.stats || {};
  const newAuctions = data.newAuctions || [];
  const highValueAuctions = data.highValueAuctions || [];
  const changedAuctions = data.changedAuctions || [];
  const siteStats = data.siteStats || [];

  const statCards = `
    <div class="stats-grid">
      ${generateStatCard('总采集数', stats.totalCount || 0, '累计标的总数', 'blue')}
      ${generateStatCard('今日新增', stats.newCount || 0, '新增标的数量', 'green')}
      ${generateStatCard('高价值标的', stats.highValueCount || 0, '三星及以上标的', 'orange')}
      ${generateStatCard('变更记录', stats.changedCount || 0, '今日价格/状态变更', 'purple')}
    </div>
  `;

  let highValueSection = '';
  if (highValueAuctions.length > 0) {
    const cards = highValueAuctions.map(a => generateHighValueCard(a)).join('');
    highValueSection = `
      <section class="report-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="section-icon">⭐</span>
            高价值标的
            <span class="section-count">${highValueAuctions.length}个</span>
          </h2>
        </div>
        <div class="high-value-grid">
          ${cards}
        </div>
      </section>
    `;
  }

  let newAuctionsSection = '';
  if (newAuctions.length > 0) {
    const rows = newAuctions.map(a => generateAuctionRow(a)).join('');
    newAuctionsSection = `
      <section class="report-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="section-icon">🆕</span>
            新增标的
            <span class="section-count">${newAuctions.length}个</span>
          </h2>
        </div>
        <div class="table-wrapper">
          <table class="auction-table">
            <thead>
              <tr>
                <th class="col-title">标的信息</th>
                <th class="col-price">价格</th>
                <th class="col-discount">折价率</th>
                <th class="col-area">面积</th>
                <th class="col-stars">评分</th>
                <th class="col-countdown">倒计时</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  const changesSection = `
    <section class="report-section">
      <div class="section-header">
        <h2 class="section-title">
          <span class="section-icon">📋</span>
          变更追踪
          <span class="section-count">${changedAuctions.length}条</span>
        </h2>
      </div>
      ${generateChangesList(changedAuctions)}
    </section>
  `;

  const siteStatsSection = `
    <section class="report-section">
      <div class="section-header">
        <h2 class="section-title">
          <span class="section-icon">📊</span>
          各站点采集情况
        </h2>
      </div>
      ${generateSiteStatsTable(siteStats)}
    </section>
  `;

  const cssStyles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
        background: #f0f2f5;
        color: #1f2937;
        line-height: 1.6;
        padding: 20px;
      }
      .report-container {
        max-width: 1200px;
        margin: 0 auto;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .report-header {
        background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
        color: #fff;
        padding: 32px 40px;
      }
      .report-header h1 {
        font-size: 28px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .report-header .report-date {
        font-size: 14px;
        opacity: 0.85;
      }
      .report-header .report-subtitle {
        font-size: 13px;
        opacity: 0.7;
        margin-top: 4px;
      }
      .report-body {
        padding: 32px 40px;
      }
      .report-section {
        margin-bottom: 36px;
      }
      .section-header {
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 2px solid #e5e7eb;
      }
      .section-title {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .section-icon {
        font-size: 20px;
      }
      .section-count {
        font-size: 13px;
        font-weight: 400;
        color: #6b7280;
        background: #f3f4f6;
        padding: 2px 10px;
        border-radius: 20px;
        margin-left: 8px;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 36px;
      }
      .stat-card {
        background: #f9fafb;
        border-radius: 10px;
        padding: 20px;
        text-align: center;
        border: 1px solid #e5e7eb;
      }
      .stat-value {
        font-size: 32px;
        font-weight: 700;
        line-height: 1.2;
        margin-bottom: 4px;
      }
      .stat-label {
        font-size: 13px;
        color: #6b7280;
        margin-bottom: 4px;
      }
      .stat-subtext {
        font-size: 11px;
        color: #9ca3af;
      }
      .high-value-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
      }
      .high-value-card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        transition: box-shadow 0.2s;
      }
      .high-value-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      .card-header {
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .card-title {
        flex: 1;
      }
      .card-title h3 {
        font-size: 16px;
        font-weight: 600;
        color: #92400e;
        margin-bottom: 6px;
        line-height: 1.4;
      }
      .high-value-badge {
        display: inline-block;
        background: #f59e0b;
        color: #fff;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 500;
      }
      .star-rating-large {
        text-align: right;
      }
      .star-rating-large .stars {
        font-size: 18px;
        color: #f59e0b;
        letter-spacing: 1px;
      }
      .star-rating-large .score {
        display: block;
        font-size: 12px;
        color: #92400e;
        margin-top: 2px;
      }
      .card-body {
        padding: 20px;
      }
      .info-row {
        margin-bottom: 14px;
      }
      .info-label {
        font-size: 12px;
        color: #6b7280;
        display: block;
        margin-bottom: 2px;
      }
      .info-value {
        font-size: 14px;
        color: #374151;
      }
      .info-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }
      .info-item {
        text-align: left;
      }
      .info-item .info-label {
        font-size: 11px;
        color: #9ca3af;
      }
      .info-item .info-value {
        font-size: 13px;
        font-weight: 500;
      }
      .text-truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
      }
      .chart-section {
        margin: 16px 0;
        padding: 16px;
        background: #f9fafb;
        border-radius: 8px;
      }
      .chart-title {
        font-size: 13px;
        font-weight: 500;
        color: #374151;
        margin-bottom: 12px;
      }
      .price-chart {
        width: 100%;
      }
      .price-bar-row {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      .price-bar-label {
        width: 50px;
        font-size: 12px;
        color: #6b7280;
        flex-shrink: 0;
      }
      .price-bar-track {
        flex: 1;
        height: 24px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        position: relative;
      }
      .price-bar {
        height: 100%;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 8px;
        min-width: 60px;
        transition: width 0.5s ease;
      }
      .price-bar.assess-bar {
        background: linear-gradient(90deg, #60a5fa, #3b82f6);
      }
      .price-bar.start-bar {
        background: linear-gradient(90deg, #34d399, #10b981);
      }
      .price-bar-value {
        font-size: 11px;
        color: #fff;
        font-weight: 500;
        white-space: nowrap;
      }
      .price-diff-info {
        text-align: right;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #d1d5db;
      }
      .price-diff-label {
        font-size: 12px;
        color: #6b7280;
        margin-right: 6px;
      }
      .price-diff-value {
        font-size: 16px;
        font-weight: 700;
      }
      .card-footer-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
      }
      .discount-badge-large {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 16px;
        border-radius: 8px;
        min-width: 90px;
      }
      .discount-badge-large.discount-danger {
        background: #fef2f2;
        border: 1px solid #fecaca;
      }
      .discount-badge-large.discount-warning {
        background: #fffbeb;
        border: 1px solid #fde68a;
      }
      .discount-badge-large.discount-info {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
      }
      .discount-badge-large.discount-normal {
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
      }
      .discount-badge-large.discount-unknown {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
      }
      .discount-badge-large .discount-label {
        font-size: 11px;
        color: #6b7280;
        margin-bottom: 2px;
      }
      .discount-badge-large .discount-value {
        font-size: 20px;
        font-weight: 700;
      }
      .discount-badge-large.discount-danger .discount-value { color: #dc2626; }
      .discount-badge-large.discount-warning .discount-value { color: #d97706; }
      .discount-badge-large.discount-info .discount-value { color: #2563eb; }
      .discount-badge-large.discount-normal .discount-value { color: #059669; }
      .discount-badge-large.discount-unknown .discount-value { color: #6b7280; }
      .countdown-badge {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .countdown-icon {
        font-size: 14px;
      }
      .countdown-label {
        font-size: 11px;
        color: #6b7280;
      }
      .countdown-value {
        font-size: 14px;
        font-weight: 600;
        color: #059669;
      }
      .countdown-value.expired {
        color: #6b7280;
      }
      .card-footer {
        padding: 12px 20px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        text-align: right;
      }
      .view-detail-btn {
        color: #2563eb;
        font-size: 13px;
        text-decoration: none;
        font-weight: 500;
      }
      .view-detail-btn:hover {
        text-decoration: underline;
      }
      .table-wrapper {
        overflow-x: auto;
      }
      .auction-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .auction-table th {
        background: #f9fafb;
        padding: 12px 16px;
        text-align: left;
        font-weight: 600;
        color: #374151;
        border-bottom: 2px solid #e5e7eb;
        white-space: nowrap;
      }
      .auction-table td {
        padding: 14px 16px;
        border-bottom: 1px solid #f3f4f6;
        vertical-align: middle;
      }
      .auction-row:hover td {
        background: #f9fafb;
      }
      .auction-title {
        font-weight: 500;
        color: #1f2937;
        margin-bottom: 4px;
        line-height: 1.4;
      }
      .auction-subtitle {
        font-size: 11px;
        color: #9ca3af;
      }
      .round-tag {
        display: inline-block;
        background: #e0e7ff;
        color: #4338ca;
        padding: 1px 6px;
        border-radius: 3px;
        margin-right: 6px;
        font-size: 11px;
      }
      .court-name {
        font-size: 11px;
      }
      .price-assess {
        font-size: 11px;
        color: #9ca3af;
        margin-bottom: 2px;
      }
      .price-start {
        font-size: 13px;
        color: #1f2937;
      }
      .price-start strong {
        color: #059669;
      }
      .discount-tag {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 13px;
      }
      .discount-tag.discount-danger {
        background: #fef2f2;
        color: #dc2626;
      }
      .discount-tag.discount-warning {
        background: #fffbeb;
        color: #d97706;
      }
      .discount-tag.discount-info {
        background: #eff6ff;
        color: #2563eb;
      }
      .discount-tag.discount-normal {
        background: #ecfdf5;
        color: #059669;
      }
      .discount-tag.discount-unknown {
        background: #f3f4f6;
        color: #6b7280;
      }
      .diff-text {
        font-size: 11px;
        color: #059669;
        margin-top: 2px;
      }
      .star-rating {
        color: #f59e0b;
        font-size: 14px;
        letter-spacing: 1px;
      }
      .score-text {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 2px;
      }
      .countdown-text {
        font-size: 13px;
        font-weight: 500;
        color: #059669;
      }
      .countdown-text.expired {
        color: #6b7280;
      }
      .changes-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .change-item {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 14px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .change-title {
        font-weight: 500;
        color: #1f2937;
        margin-bottom: 4px;
      }
      .change-fields {
        font-size: 12px;
        color: #6b7280;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .change-icon {
        font-size: 14px;
      }
      .change-time {
        font-size: 12px;
        color: #9ca3af;
        flex-shrink: 0;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .data-table th {
        background: #f9fafb;
        padding: 12px 16px;
        text-align: left;
        font-weight: 600;
        color: #374151;
        border-bottom: 2px solid #e5e7eb;
      }
      .data-table td {
        padding: 12px 16px;
        border-bottom: 1px solid #f3f4f6;
      }
      .data-table tbody tr:hover td {
        background: #f9fafb;
      }
      .empty-state {
        text-align: center;
        padding: 40px;
        color: #9ca3af;
        font-size: 14px;
      }
      .report-footer {
        padding: 20px 40px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        font-size: 12px;
        color: #9ca3af;
      }
      @media (max-width: 768px) {
        body { padding: 10px; }
        .report-header { padding: 24px 20px; }
        .report-header h1 { font-size: 22px; }
        .report-body { padding: 20px 16px; }
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .stat-value { font-size: 24px; }
        .high-value-grid {
          grid-template-columns: 1fr;
          gap: 16px;
        }
        .info-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        .table-wrapper {
          overflow-x: auto;
        }
        .auction-table {
          min-width: 600px;
        }
        .change-item {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        .report-footer { padding: 16px 20px; }
      }
      @media (max-width: 480px) {
        .stats-grid {
          grid-template-columns: 1fr;
        }
        .card-header {
          flex-direction: column;
          gap: 12px;
        }
        .star-rating-large {
          text-align: left;
        }
        .card-footer-info {
          flex-direction: column;
          gap: 12px;
          align-items: flex-start;
        }
        .countdown-badge {
          align-items: flex-start;
        }
      }
    </style>
  `;

  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - ${reportDate}</title>
      ${cssStyles}
    </head>
    <body>
      <div class="report-container">
        <header class="report-header">
          <h1>${title}</h1>
          <div class="report-date">📅 ${reportDate}</div>
          <div class="report-subtitle">法拍房投资监控系统 · 每日自动生成</div>
        </header>

        <div class="report-body">
          ${statCards}
          ${highValueSection}
          ${newAuctionsSection}
          ${changesSection}
          ${siteStatsSection}
        </div>

        <footer class="report-footer">
          <p>本报告由法拍房监控系统自动生成 | 数据仅供参考，投资有风险，入市需谨慎</p>
        </footer>
      </div>
    </body>
    </html>
  `;

  logger.info(`日报生成完成: ${newAuctions.length}个新标的, ${highValueAuctions.length}个高价值标的`);
  return html;
}

function saveReport(html, outputPath) {
  try {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, html, 'utf-8');
    logger.info(`日报已保存: ${outputPath}`);
    return true;
  } catch (error) {
    logger.error(`保存日报失败: ${error.message}`);
    throw error;
  }
}

async function exportCSV(auctions, outputPath) {
  try {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const records = auctions.map(auction => {
      const discountRate = calculateDiscountRate(auction);
      const rating = calculateStarRating(auction);

      return {
        id: auction.id || '',
        court: auction.court || '',
        case_no: auction.case_no || '',
        title: auction.title || '',
        address: auction.address || '',
        area: auction.area || '',
        assess_price: auction.assess_price || auction.assessPrice || '',
        start_price: auction.start_price || auction.startPrice || '',
        current_price: auction.current_price || auction.currentPrice || '',
        discount_rate: discountRate !== null ? discountRate : '',
        auction_date: auction.auction_date || auction.auctionDate || '',
        round: auction.round || '',
        court_name: auction.court_name || '',
        notice_url: auction.notice_url || auction.noticeUrl || '',
        status: auction.status || '',
        bid_count: auction.bid_count || auction.bidCount || 0,
        score: rating.score || 0,
        stars: rating.stars || 1,
        is_high_value: rating.isHighValue ? '是' : '否'
      };
    });

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'court', title: '法院' },
        { id: 'case_no', title: '案号' },
        { id: 'title', title: '标题' },
        { id: 'address', title: '地址' },
        { id: 'area', title: '面积(㎡)' },
        { id: 'assess_price', title: '评估价(元)' },
        { id: 'start_price', title: '起拍价(元)' },
        { id: 'current_price', title: '当前价(元)' },
        { id: 'discount_rate', title: '折价率(%)' },
        { id: 'auction_date', title: '拍卖日期' },
        { id: 'round', title: '轮次' },
        { id: 'court_name', title: '法院名称' },
        { id: 'notice_url', title: '公告链接' },
        { id: 'status', title: '状态' },
        { id: 'bid_count', title: '报名人数' },
        { id: 'score', title: '评分' },
        { id: 'stars', title: '星级' },
        { id: 'is_high_value', title: '高价值标的' }
      ]
    });

    await csvWriter.writeRecords(records);
    logger.info(`CSV 导出完成: ${outputPath}, 共 ${records.length} 条记录`);
    return true;
  } catch (error) {
    logger.error(`CSV 导出失败: ${error.message}`);
    throw error;
  }
}

async function sendEmailReport(html, options = {}) {
  const {
    smtpHost,
    smtpPort,
    smtpTls,
    from,
    password,
    to,
    subject,
    attachments = []
  } = options;

  if (!to || to.length === 0) {
    logger.warn('邮件收件人为空，跳过发送');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpTls,
      auth: {
        user: from,
        pass: password
      }
    });

    const mailOptions = {
      from,
      to: Array.isArray(to) ? to.join(',') : to,
      subject: subject || '法拍房监控日报',
      html,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`邮件发送成功: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`邮件发送失败: ${error.message}`);
    throw error;
  }
}

async function buildReportData(repository, options = {}) {
  const days = options.days || 1;
  const highValueStars = options.highValueStars || 3;

  logger.info(`开始构建日报数据，统计最近 ${days} 天`);

  try {
    const now = dayjs();
    const sinceTime = now.subtract(days, 'day').toISOString();

    const totalCount = repository.countAuctions ? await repository.countAuctions() : 0;

    const allAuctionsResult = repository.getAuctions
      ? await repository.getAuctions({}, { pageSize: 10000, sortBy: 'created_at', sortOrder: 'desc' })
      : { list: [] };
    const allAuctions = allAuctionsResult.list || [];

    const newAuctions = allAuctions.filter(a => {
      if (!a.created_at) return false;
      return dayjs(a.created_at).isAfter(sinceTime);
    });

    const allWithRating = allAuctions.map(a => {
      const rating = calculateStarRating(a);
      return { ...a, ...rating };
    });

    const highValueAuctions = allWithRating
      .filter(a => a.stars >= highValueStars)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const changedAuctions = repository.getChangedAuctions
      ? await repository.getChangedAuctions(sinceTime)
      : [];

    const siteStats = repository.getCrawlStats
      ? await repository.getCrawlStats(null, days)
      : [];

    const newCount = newAuctions.length;
    const highValueCount = allWithRating.filter(a => a.isHighValue).length;
    const changedCount = changedAuctions.length;

    const stats = {
      reportDate: now.format('YYYY-MM-DD'),
      totalCount,
      newCount,
      highValueCount,
      changedCount,
      days
    };

    const result = {
      stats,
      newAuctions: newAuctions.slice(0, 50),
      highValueAuctions,
      changedAuctions,
      siteStats,
      allNewAuctions: newAuctions
    };

    logger.info(`日报数据构建完成: 总数=${totalCount}, 新增=${newCount}, 高价值=${highValueCount}, 变更=${changedCount}`);
    return result;
  } catch (error) {
    logger.error(`构建日报数据失败: ${error.message}`);
    throw error;
  }
}

export {
  formatPrice,
  calculateDiscountRate,
  calculatePriceDiff,
  generateStars,
  calculateStarRating,
  generateCountdown,
  generatePriceBarChart,
  generateAuctionRow,
  generateHighValueCard,
  generateDailyReport,
  saveReport,
  exportCSV,
  sendEmailReport,
  buildReportData
};

export default {
  formatPrice,
  calculateDiscountRate,
  calculatePriceDiff,
  generateStars,
  calculateStarRating,
  generateCountdown,
  generatePriceBarChart,
  generateAuctionRow,
  generateHighValueCard,
  generateDailyReport,
  saveReport,
  exportCSV,
  sendEmailReport,
  buildReportData
};
