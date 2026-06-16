const fs = require('fs');
const path = require('path');
const { rateSnapshots, spaceStatus, schedules } = require('../store/db');
const logger = require('../utils/logger');

class ReportGenerator {
  constructor(outputDir = null) {
    this.outputDir = outputDir || path.join(process.cwd(), 'reports');
    this._ensureOutputDir();
  }

  _ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  exportComparisonReport(portFrom, portTo, containerType, days = 7) {
    logger.info(`生成比价报表: ${portFrom} -> ${portTo} (${containerType})`);

    const rates = rateSnapshots.getByRouteAndPeriod(portFrom, portTo, containerType, days);
    
    if (rates.length === 0) {
      logger.warn('未找到运价数据');
      return null;
    }

    const latestRates = this._getLatestByCarrier(rates);

    const headers = [
      '船公司',
      '起运港',
      '目的港',
      '箱型',
      '基准运价(USD)',
      '附加费合计(USD)',
      '总运价(USD)',
      '货币',
      '有效期起',
      '有效期至',
      '舱位状态',
      '可用舱位',
      '采集时间'
    ];

    const rows = latestRates.map(rate => {
      const space = spaceStatus.getLatest(rate.carrier_id, portFrom, portTo, containerType);
      return [
        rate.carrier_name,
        rate.port_from,
        rate.port_to,
        rate.container_type,
        rate.base_rate || 0,
        rate.surcharges_total || 0,
        rate.total_rate || 0,
        rate.currency || 'USD',
        rate.valid_from || '',
        rate.valid_to || '',
        space?.status || '未知',
        space?.available_count !== null ? space.available_count : '未知',
        rate.collected_at
      ];
    });

    rows.sort((a, b) => a[6] - b[6]);

    const csvContent = this._buildCsv(headers, rows);
    
    const fileName = `comparison_${portFrom}_${portTo}_${containerType}_${this._formatDate()}.csv`;
    const filePath = path.join(this.outputDir, fileName);
    
    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf-8');
    
    logger.info(`比价报表已导出: ${filePath}`);
    return { filePath, recordCount: rows.length };
  }

  exportPriceTrendReport(portFrom, portTo, containerType, days = 30) {
    logger.info(`生成运价趋势报表: ${portFrom} -> ${portTo} (${containerType})`);

    const rates = rateSnapshots.getByRouteAndPeriod(portFrom, portTo, containerType, days);
    
    if (rates.length === 0) {
      logger.warn('未找到运价数据');
      return null;
    }

    const headers = [
      '采集日期',
      '船公司',
      '起运港',
      '目的港',
      '箱型',
      '总运价(USD)',
      '环比变化(USD)',
      '环比变化率(%)'
    ];

    const byCarrier = {};
    for (const rate of rates) {
      if (!byCarrier[rate.carrier_id]) {
        byCarrier[rate.carrier_id] = [];
      }
      byCarrier[rate.carrier_id].push(rate);
    }

    const rows = [];
    for (const carrierId of Object.keys(byCarrier)) {
      const carrierRates = byCarrier[carrierId]
        .sort((a, b) => new Date(a.collected_at) - new Date(b.collected_at));
      
      let prevRate = null;
      for (const rate of carrierRates) {
        const change = prevRate ? rate.total_rate - prevRate.total_rate : 0;
        const changePct = prevRate ? ((change / prevRate.total_rate) * 100).toFixed(2) : '';
        
        rows.push([
          rate.collected_at.split('T')[0],
          rate.carrier_name,
          rate.port_from,
          rate.port_to,
          rate.container_type,
          rate.total_rate,
          prevRate ? change.toFixed(2) : '',
          changePct
        ]);
        
        prevRate = rate;
      }
    }

    const csvContent = this._buildCsv(headers, rows);
    
    const fileName = `trend_${portFrom}_${portTo}_${containerType}_${this._formatDate()}.csv`;
    const filePath = path.join(this.outputDir, fileName);
    
    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf-8');
    
    logger.info(`运价趋势报表已导出: ${filePath}`);
    return { filePath, recordCount: rows.length };
  }

  exportSchedulesReport(portFrom, portTo, limit = 20) {
    logger.info(`生成船期报表: ${portFrom} -> ${portTo}`);

    const scheds = schedules.getByRoute(portFrom, portTo, limit);
    
    if (scheds.length === 0) {
      logger.warn('未找到船期数据');
      return null;
    }

    const headers = [
      '船公司',
      '船名',
      '航次',
      '起运港',
      '目的港',
      '离港日期',
      '到港日期',
      '航程天数',
      '航线代码',
      '采集时间'
    ];

    const rows = scheds.map(s => [
      s.carrier_name,
      s.vessel_name || '',
      s.voyage_number || '',
      s.port_from,
      s.port_to,
      s.departure_date || '',
      s.arrival_date || '',
      s.transit_days || '',
      s.service_code || '',
      s.collected_at
    ]);

    rows.sort((a, b) => new Date(a[5]) - new Date(b[5]));

    const csvContent = this._buildCsv(headers, rows);
    
    const fileName = `schedules_${portFrom}_${portTo}_${this._formatDate()}.csv`;
    const filePath = path.join(this.outputDir, fileName);
    
    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf-8');
    
    logger.info(`船期报表已导出: ${filePath}`);
    return { filePath, recordCount: rows.length };
  }

  _getLatestByCarrier(rates) {
    const latest = {};
    for (const rate of rates) {
      const key = rate.carrier_id;
      if (!latest[key] || new Date(rate.collected_at) > new Date(latest[key].collected_at)) {
        latest[key] = rate;
      }
    }
    return Object.values(latest);
  }

  _buildCsv(headers, rows) {
    const escapeCell = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const headerLine = headers.map(escapeCell).join(',');
    const bodyLines = rows.map(row => row.map(escapeCell).join(','));
    
    return [headerLine, ...bodyLines].join('\n');
  }

  _formatDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  getOutputDir() {
    return this.outputDir;
  }
}

module.exports = ReportGenerator;
