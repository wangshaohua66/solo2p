const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');
const CryptoJS = require('crypto-js');

const config = require('../config/default.json');

const matchTypeLabels = {
  exact_copy: '原文照搬',
  substantial_copy: '大量抄袭',
  partial_rewrite: '改头换面',
  title_copy: '标题复制',
  content_fragment: '拼凑剪辑',
  weak_similarity: '弱相似'
};

const matchTypeColors = {
  exact_copy: '#dc2626',
  substantial_copy: '#ea580c',
  partial_rewrite: '#d97706',
  title_copy: '#ca8a04',
  content_fragment: '#65a30d',
  weak_similarity: '#16a34a'
};

class Reporter {
  constructor(storage, options = {}) {
    this.storage = storage;
    this.options = options;
    this.reportsDir = path.resolve(config.app.reportsDir);
    this.evidenceDir = path.resolve(config.app.evidenceDir);
    this._ensureDirs();
  }

  _ensureDirs() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  _getDateRange(period = 'day') {
    const now = dayjs();
    let start, end;

    switch (period) {
      case 'week':
        start = now.startOf('week');
        end = now.endOf('week');
        break;
      case 'month':
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      case 'day':
      default:
        start = now.startOf('day');
        end = now.endOf('day');
        break;
    }

    return {
      start: start.format('YYYY-MM-DD HH:mm:ss'),
      end: end.format('YYYY-MM-DD HH:mm:ss'),
      label: start.format('YYYYMMDD') + '-' + end.format('YYYYMMDD')
    };
  }

  async generateReport(period = 'day', formats = ['pdf', 'excel']) {
    const range = this._getDateRange(period);
    const timestamp = dayjs().format('YYYYMMDD_HHmmss');

    const stats = await this.storage.getInfringementStats(range.start, range.end);
    const matches = await this.storage.getSuspectedMatches({
      startDate: range.start,
      endDate: range.end
    });
    const dailyStats = await this.storage.getDailyStats(period === 'week' ? 7 : period === 'month' ? 30 : 1);

    const originalCount = await this.storage.getOriginalArticleCount();
    const monitoredSites = await this.storage.getMonitoredSites(false);

    const reportData = {
      reportId: uuidv4(),
      period,
      periodLabel: period === 'day' ? '日' : period === 'week' ? '周' : '月',
      dateRange: range,
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      summary: {
        totalMatches: matches.length,
        suspectedCount: matches.filter((m) => m.is_suspected).length,
        confirmedCount: matches.filter((m) => m.is_confirmed).length,
        sitesInvolved: new Set(matches.map((m) => m.site_id)).size,
        monitoredSites: monitoredSites.length,
        originalArticles: originalCount
      },
      bySite: stats.map((s) => ({
        ...s,
        avg_title_similarity: s.avg_title_similarity
          ? (s.avg_title_similarity * 100).toFixed(1) + '%'
          : '-',
        avg_content_similarity: s.avg_content_similarity
          ? (s.avg_content_similarity * 100).toFixed(1) + '%'
          : '-'
      })),
      matches: matches.slice(0, 500),
      dailyStats
    };

    const generatedFiles = [];

    for (const fmt of formats) {
      try {
        if (fmt === 'pdf') {
          const pdfPath = await this._generatePDF(reportData, timestamp);
          generatedFiles.push({ format: 'pdf', path: pdfPath });
        }
        if (fmt === 'excel' || fmt === 'xlsx') {
          const xlsxPath = await this._generateExcel(reportData, timestamp);
          generatedFiles.push({ format: 'excel', path: xlsxPath });
        }
      } catch (err) {
        console.error(chalk.red(`生成${fmt.toUpperCase()}报告失败: ${err.message}`));
      }
    }

    return { ...reportData, generatedFiles };
  }

  async _generatePDF(data, timestamp) {
    const filename = `侵权报告_${data.periodLabel}报_${timestamp}.pdf`;
    const filepath = path.join(this.reportsDir, filename);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        info: {
          Title: `新闻版权侵权${data.periodLabel}度报告`,
          Author: '新闻版权监控系统',
          Subject: `版权侵权监测 - ${data.dateRange.start} 至 ${data.dateRange.end}`,
          Creator: 'News Copyright Monitor v1.0'
        }
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      try {
        this._renderPDFHeader(doc, data);
        this._renderPDFSummary(doc, data);
        this._renderPDFBySite(doc, data);
        this._renderPDFMatches(doc, data);

        doc.on('pageAdded', () => {
          doc.fontSize(8).fillColor('#999').text(
            `报告编号: ${data.reportId.slice(0, 8)} | 生成时间: ${data.generatedAt}`,
            50,
            doc.page.height - 40,
            { width: doc.page.width - 100, align: 'left' }
          );
          doc.text(
            `第 ${doc.bufferedPageRange().start + doc.bufferedPageRange().count} 页`,
            50,
            doc.page.height - 40,
            { width: doc.page.width - 100, align: 'right' }
          );
        });

        doc.end();

        stream.on('finish', () => resolve(filepath));
        stream.on('error', reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  _renderPDFHeader(doc, data) {
    doc.fillColor('#1e3a8a')
      .fontSize(26)
      .font('Helvetica-Bold')
      .text('新闻版权侵权监测报告', { align: 'center' });

    doc.moveDown(0.5);
    doc.fillColor('#3b82f6')
      .fontSize(14)
      .font('Helvetica')
      .text(`${data.periodLabel}度报告 | ${data.dateRange.start.split(' ')[0]} ~ ${data.dateRange.end.split(' ')[0]}`, { align: 'center' });

    doc.moveDown(1);
    doc.strokeColor('#dbeafe')
      .lineWidth(2)
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke();
    doc.moveDown(1.5);
  }

  _renderPDFSummary(doc, data) {
    const s = data.summary;
    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('一、总体概况');
    doc.moveDown(0.8);

    const items = [
      { label: '监测周期', value: `${data.dateRange.start} ~ ${data.dateRange.end.split(' ')[0]}` },
      { label: '监测站点数', value: `${s.monitoredSites} 个` },
      { label: '原创稿件数', value: `${s.originalArticles.toLocaleString()} 篇` },
      { label: '侵权匹配总数', value: `${s.totalMatches.toLocaleString()} 条` },
      { label: '疑似侵权数', value: `${s.suspectedCount.toLocaleString()} 条` },
      { label: '已确认侵权', value: `${s.confirmedCount.toLocaleString()} 条` },
      { label: '涉及侵权站点', value: `${s.sitesInvolved} 个` }
    ];

    for (const item of items) {
      doc.fontSize(11).font('Helvetica').fillColor('#475569').text(item.label, { continued: true });
      doc.fillColor('#0f172a').text(': ', { continued: true });
      doc.font('Helvetica-Bold').fillColor('#dc2626').text(item.value);
      doc.moveDown(0.3);
    }

    doc.moveDown(0.8);
  }

  _renderPDFBySite(doc, data) {
    doc.addPage();
    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('二、按站点统计');
    doc.moveDown(0.8);

    if (!data.bySite || data.bySite.length === 0) {
      doc.fontSize(10).fillColor('#94a3b8').text('（本期无侵权数据）');
      return;
    }

    const cols = [
      { key: 'site_name', label: '站点名称', width: 130 },
      { key: 'suspected_count', label: '疑似数', width: 60 },
      { key: 'confirmed_count', label: '确认数', width: 60 },
      { key: 'avg_title_similarity', label: '标题相似度', width: 80 },
      { key: 'avg_content_similarity', label: '正文相似度', width: 80 }
    ];

    const tableTop = doc.y;
    let currentY = tableTop;
    const rowHeight = 24;

    doc.fillColor('#1e3a8a').rect(50, currentY, doc.page.width - 100, rowHeight).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    let colX = 55;
    for (const col of cols) {
      doc.text(col.label, colX, currentY + 6, { width: col.width });
      colX += col.width;
    }
    currentY += rowHeight;

    for (let i = 0; i < Math.min(data.bySite.length, 50); i++) {
      const row = data.bySite[i];
      const bgColor = i % 2 === 0 ? '#f8fafc' : '#ffffff';

      if (currentY + rowHeight > doc.page.height - 80) {
        doc.addPage();
        currentY = doc.y;
      }

      doc.fillColor(bgColor).rect(50, currentY, doc.page.width - 100, rowHeight).fill();

      doc.fillColor(row.suspected_count > 0 ? '#dc2626' : '#475569')
        .font('Helvetica').fontSize(9);

      colX = 55;
      for (const col of cols) {
        const val = row[col.key] || (col.key === 'site_name' ? '-' : '0');
        doc.text(String(val), colX, currentY + 6, { width: col.width });
        colX += col.width;
      }
      currentY += rowHeight;
    }

    doc.y = currentY + 10;
  }

  _renderPDFMatches(doc, data) {
    doc.addPage();
    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('三、疑似侵权明细（TOP 50）');
    doc.moveDown(0.8);

    if (!data.matches || data.matches.length === 0) {
      doc.fontSize(10).fillColor('#94a3b8').text('（本期无疑似侵权记录）');
      return;
    }

    let currentY = doc.y;

    for (let i = 0; i < Math.min(data.matches.length, 50); i++) {
      const m = data.matches[i];

      if (currentY > doc.page.height - 120) {
        doc.addPage();
        currentY = doc.y;
      }

      const typeColor = matchTypeColors[m.match_type] || '#64748b';
      const typeLabel = matchTypeLabels[m.match_type] || '未知';

      doc.fillColor('#fef2f2').rect(50, currentY, doc.page.width - 100, 90).fill();
      doc.strokeColor('#fecaca').lineWidth(0.5)
        .rect(50, currentY, doc.page.width - 100, 90).stroke();

      doc.font('Helvetica-Bold').fontSize(10).fillColor(typeColor)
        .text(`#${i + 1} [${typeLabel}]`, 60, currentY + 8);

      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
        .text(m.original_title || '(无标题)', 110, currentY + 8, {
          width: doc.page.width - 180
        });

      doc.fontSize(9).fillColor('#64748b').font('Helvetica')
        .text(`站点: ${m.site_name || m.site_id}`, 60, currentY + 26);

      doc.text(`标题相似度: ${(m.title_similarity * 100).toFixed(1)}%`, 250, currentY + 26);

      doc.text(`正文相似度: ${(m.content_similarity * 100).toFixed(1)}%`, 400, currentY + 26);

      doc.fillColor('#334155')
        .text(`原标题: ${m.original_title || '-'}`.slice(0, 60), 60, currentY + 42, {
          width: doc.page.width - 120
        });
      doc.text(`转摘: ${m.infringing_title || m.infringing_url || '-'} `.slice(0, 60), 60, currentY + 56, {
        width: doc.page.width - 120
      });

      doc.fontSize(8).fillColor('#94a3b8')
        .text(`URL: ${m.infringing_url || '-'}`, 60, currentY + 70, {
          width: doc.page.width - 120
        });

      currentY += 100;
    }
  }

  async _generateExcel(data, timestamp) {
    const filename = `侵权报告_${data.periodLabel}报_${timestamp}.xlsx`;
    const filepath = path.join(this.reportsDir, filename);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '新闻版权监控系统';
    workbook.created = new Date();
    workbook.properties.date1904 = true;

    this._renderExcelSummary(workbook, data);
    this._renderExcelBySite(workbook, data);
    this._renderExcelMatches(workbook, data);
    this._renderExcelDaily(workbook, data);

    await workbook.xlsx.writeFile(filepath);
    return filepath;
  }

  _renderExcelSummary(workbook, data) {
    const ws = workbook.addWorksheet('概览', {
      views: [{ state: 'frozen', ySplit: 2 }]
    });

    ws.columns = [
      { header: '项目', key: 'label', width: 25, style: { font: { bold: true } } },
      { header: '数值', key: 'value', width: 50 }
    ];

    ws.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
    ws.getCell('B1').font = { size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

    const s = data.summary;
    ws.addRow({ label: '报告编号', value: data.reportId });
    ws.addRow({ label: '报告类型', value: `${data.periodLabel}度报告` });
    ws.addRow({ label: '统计开始', value: data.dateRange.start });
    ws.addRow({ label: '统计结束', value: data.dateRange.end });
    ws.addRow({ label: '生成时间', value: data.generatedAt });
    ws.addRow({ label: '----', value: '----' });
    ws.addRow({ label: '监测站点总数', value: s.monitoredSites });
    ws.addRow({ label: '原创稿件库数量', value: s.originalArticles });
    ws.addRow({ label: '侵权匹配总数', value: s.totalMatches });
    ws.addRow({ label: '疑似侵权数量', value: s.suspectedCount });
    ws.addRow({ label: '已确认侵权数量', value: s.confirmedCount });
    ws.addRow({ label: '涉及侵权站点数', value: s.sitesInvolved });

    ws.getColumn('A').eachCell({ includeEmpty: false }, (cell, row) => {
      if (row > 1) {
        cell.font = { color: { argb: 'FF334155' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  }

  _renderExcelBySite(workbook, data) {
    const ws = workbook.addWorksheet('按站点统计');

    ws.columns = [
      { header: '站点ID', key: 'site_id', width: 18 },
      { header: '站点名称', key: 'site_name', width: 25 },
      { header: '匹配总数', key: 'total_matches', width: 12 },
      { header: '疑似侵权', key: 'suspected_count', width: 12 },
      { header: '确认侵权', key: 'confirmed_count', width: 12 },
      { header: '平均标题相似度', key: 'avg_title_similarity', width: 18 },
      { header: '平均正文相似度', key: 'avg_content_similarity', width: 18 }
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    ws.getRow(1).alignment = { horizontal: 'center' };

    for (const row of data.bySite) {
      const r = ws.addRow(row);
      if (row.suspected_count > 10) {
        r.font = { color: { argb: 'FFDC2626' }, bold: true };
      } else if (row.suspected_count > 0) {
        r.font = { color: { argb: 'FFEA580C' } };
      }
    }

    ws.autoFilter = { from: 'A1', to: `G${data.bySite.length + 1}` };
  }

  _renderExcelMatches(workbook, data) {
    const ws = workbook.addWorksheet('疑似侵权明细');

    ws.columns = [
      { header: '序号', key: 'idx', width: 6 },
      { header: '匹配ID', key: 'match_id', width: 30 },
      { header: '站点', key: 'site_name', width: 18 },
      { header: '侵权类型', key: 'match_type_label', width: 12 },
      { header: '原创稿件标题', key: 'original_title', width: 40 },
      { header: '转载标题', key: 'infringing_title', width: 40 },
      { header: '转载URL', key: 'infringing_url', width: 50 },
      { header: '标题相似度(%)', key: 'title_sim_pct', width: 12 },
      { header: '正文相似度(%)', key: 'content_sim_pct', width: 12 },
      { header: '综合分', key: 'overall_score', width: 10 },
      { header: '疑似', key: 'is_suspected_label', width: 6 },
      { header: '确认', key: 'is_confirmed_label', width: 6 },
      { header: '发现时间', key: 'created_at', width: 20 }
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F1D1D' } };
    ws.getRow(1).alignment = { horizontal: 'center', wrapText: true };

    data.matches.forEach((m, idx) => {
      ws.addRow({
        idx: idx + 1,
        match_id: m.match_id,
        site_name: m.site_name || m.site_id,
        match_type_label: matchTypeLabels[m.match_type] || m.match_type,
        original_title: m.original_title || '',
        infringing_title: m.infringing_title || '',
        infringing_url: m.infringing_url || '',
        title_sim_pct: (m.title_similarity * 100).toFixed(1),
        content_sim_pct: (m.content_similarity * 100).toFixed(1),
        overall_score: (m.overall_score * 100).toFixed(1),
        is_suspected_label: m.is_suspected ? '是' : '否',
        is_confirmed_label: m.is_confirmed ? '是' : '否',
        created_at: m.created_at
      });
    });

    ws.autoFilter = { from: 'A1', to: `M${Math.min(data.matches.length + 1, 501)}` };
  }

  _renderExcelDaily(workbook, data) {
    const ws = workbook.addWorksheet('日度趋势');

    ws.columns = [
      { header: '日期', key: 'date', width: 15 },
      { header: '匹配总数', key: 'total_matches', width: 12 },
      { header: '疑似侵权', key: 'suspected_count', width: 12 },
      { header: '确认侵权', key: 'confirmed_count', width: 12 }
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };

    for (const row of data.dailyStats) {
      ws.addRow(row);
    }
  }

  async generateEvidencePackage(matchId) {
    const matches = await this.storage.getSuspectedMatches({});
    const match = matches.find((m) => m.match_id === matchId);

    if (!match) {
      throw new Error(`未找到匹配记录: ${matchId}`);
    }

    const pkgDir = path.join(this.evidenceDir, 'packages', matchId);
    if (!fs.existsSync(pkgDir)) {
      fs.mkdirSync(pkgDir, { recursive: true });
    }

    const manifest = {
      packageId: uuidv4(),
      matchId,
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss ZZ'),
      systemVersion: config.app.version,
      caseInfo: {
        originalTitle: match.original_title,
        originalUrl: match.original_url,
        infringingUrl: match.infringing_url,
        infringingSite: match.site_name,
        titleSimilarity: match.title_similarity,
        contentSimilarity: match.content_similarity,
        matchType: match.match_type,
        matchTypeLabel: matchTypeLabels[match.match_type]
      },
      files: [],
      hashes: {}
    };

    const evidence = {
      match_id: matchId,
      title: match.original_title,
      original_url: match.original_url,
      infringing_url: match.infringing_url,
      screenshot_path: match.screenshot_path,
      timestamp: dayjs().format()
    };

    if (match.screenshot_path && fs.existsSync(match.screenshot_path)) {
      const target = path.join(pkgDir, `screenshot_${matchId}.png`);
      fs.copyFileSync(match.screenshot_path, target);
      const content = fs.readFileSync(target);
      const hash = CryptoJS.SHA256(content.toString('base64')).toString();
      manifest.files.push({ name: path.basename(target), type: 'screenshot' });
      manifest.hashes[path.basename(target)] = hash;
      evidence.screenshot_path = target;
    }

    const manifestPath = path.join(pkgDir, 'MANIFEST.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    const readmePath = path.join(pkgDir, 'README.txt');
    fs.writeFileSync(readmePath, this._generateReadme(manifest), 'utf-8');

    evidence.package_path = pkgDir;
    evidence.hash_value = CryptoJS.SHA256(JSON.stringify(manifest)).toString();
    evidence.evidence_id = await this.storage.addEvidencePackage(evidence);

    return evidence;
  }

  _generateReadme(manifest) {
    const c = manifest.caseInfo;
    return `
新闻版权侵权证据包
==================
生成时间: ${manifest.generatedAt}
证据包ID: ${manifest.packageId}
匹配ID: ${manifest.matchId}

案件信息:
  原创标题: ${c.originalTitle}
  原创链接: ${c.originalUrl || '(无)'}

  转载站点: ${c.infringingSite}
  转载链接: ${c.infringingUrl}

  侵权类型: ${c.matchTypeLabel || c.matchType}
  标题相似度: ${(c.titleSimilarity * 100).toFixed(1)}%
  正文相似度: ${(c.contentSimilarity * 100).toFixed(1)}%

文件清单:
${manifest.files.map((f) => `  - ${f.name} (${f.type})`).join('\n')}

注意: 本证据包由自动化系统生成，所有文件均已通过 SHA-256 哈希校验。
如需司法公证，请联系具备资质的第三方存证机构。
    `.trim();
  }
}

module.exports = Reporter;
