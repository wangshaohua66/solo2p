import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import fontkit from 'fontkit';
import logger from '../utils/logger.js';

const TYPE_LABELS = {
  amount: '金额差异',
  time: '时间差异',
  status: '状态差异',
  missing_channel: '通道缺失',
  extra_channel: '多余流水',
  missing_order: '订单缺失',
  refund_unmatched: '退款未匹配',
  none: '一致',
};

const SUGGESTIONS = {
  amount: '核对订单与通道侧金额单位（元/分）是否一致；检查是否含手续费、优惠券抵扣导致金额偏差。',
  time: '确认通道入账时延是否在 T+N 窗口内；排查系统时间与通道时间是否同步。',
  status: '比对订单状态与通道交易状态机映射；确认是否存在异步回调延迟或状态翻转。',
  missing_channel: '订单侧有记录但通道无流水：确认通道文件是否完整、是否漏导、是否交易未上送通道。',
  extra_channel: '通道有流水但订单侧无记录：确认是否订单系统丢失数据、是否跨商户归属错误。',
  missing_order: '通道侧存在订单侧缺失：排查订单系统写入失败或数据同步异常。',
  refund_unmatched: '退款/冲正/分账无原交易对应：核对原订单号是否变更、是否跨周期、是否分账链路断裂。',
  none: '该笔交易一致，无需处理。',
};

const CJK_FONT_PATHS = [
  '/System/Library/Fonts/PingFang.ttc',
  '/System/Library/Fonts/STHeiti Light.ttc',
  '/System/Library/Fonts/Hiragino Sans GB.ttc',
  '/Library/Fonts/Arial Unicode.ttf',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  '/usr/share/fonts/truetype/arphic/uming.ttc',
];

function findCjkFont() {
  for (const p of CJK_FONT_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function resolveFontName(fontPath) {
  if (!fontPath) return null;
  try {
    const opened = fontkit.openSync(fontPath);
    if (opened && opened.fonts && opened.fonts.length) {
      return opened.fonts[0].postscriptName;
    }
    if (opened && opened.postscriptName) {
      return opened.postscriptName;
    }
  } catch (e) {
    logger.debug(`fontkit 解析字体失败 ${fontPath}: ${e.message}`);
  }
  return null;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function buildSummaryRows(result) {
  const s = result.summary || {};
  const rows = [
    ['对账汇总', ''],
    ['订单总数', s.orderCount ?? '-'],
    ['通道流水总数', s.channelCount ?? '-'],
    ['退款/冲正/分账数', s.refundCount ?? '-'],
    ['成功匹配数', s.matched ?? '-'],
    ['匹配率', s.matchRate != null ? `${(s.matchRate * 100).toFixed(2)}%` : '-'],
    ['未匹配订单数', s.unmatchedOrders ?? '-'],
    ['未匹配流水数', s.unmatchedTransactions ?? '-'],
    ['退款匹配数', s.refundMatched ?? '-'],
    ['跨月交易数', s.crossMonth ?? '-'],
    ['差异笔数', result.differences ? result.differences.length : '-'],
    ['金额差异合计(分)', s.totalAmountDiff ?? '-'],
  ];
  return rows;
}

function buildDiffRows(diffs) {
  const header = ['订单号', '商户ID', '通道', '差异类型', '订单金额', '通道金额', '金额差', '时间差', '订单状态', '通道状态', '是否跨月'];
  const rows = [header];
  for (const d of diffs) {
    rows.push([
      d.orderId,
      d.merchantId,
      d.channel,
      TYPE_LABELS[d.primaryType] || d.primaryType,
      d.orderAmount,
      d.channelAmount,
      d.amountDiff,
      d.timeDiffHuman,
      d.orderStatus,
      d.channelStatus,
      d.crossMonth ? '是' : '否',
    ]);
  }
  return rows;
}

function buildSuggestionRows(diffs) {
  const byType = {};
  for (const d of diffs) {
    byType[d.primaryType] = (byType[d.primaryType] || 0) + 1;
  }
  const rows = [['差异类型', '笔数', '追溯建议']];
  for (const [type, count] of Object.entries(byType)) {
    rows.push([TYPE_LABELS[type] || type, count, SUGGESTIONS[type] || '请人工核查。']);
  }
  if (rows.length === 1) rows.push(['无', 0, '本期无差异，对账一致。']);
  return rows;
}

function generateExcel(result, options) {
  const wb = XLSX.utils.book_new();
  const template = options.template || 'default';
  const sections = options.sections || ['summary', 'differences', 'suggestions'];

  if (sections.includes('summary')) {
    const ws = XLSX.utils.aoa_to_sheet(buildSummaryRows(result));
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, '对账汇总');
  }
  if (sections.includes('differences')) {
    const diffs = options.groupByMerchant ? result.differences : result.differences;
    if (options.merchantFilter) {
      const ws = XLSX.utils.aoa_to_sheet(buildDiffRows(diffs.filter((d) => d.merchantId === options.merchantFilter)));
      XLSX.utils.book_append_sheet(wb, ws, '差异明细');
    } else if (options.groupByMerchant && result.byMerchant) {
      for (const [mid, groupResult] of Object.entries(result.byMerchant)) {
        const ws = XLSX.utils.aoa_to_sheet(buildDiffRows(groupResult.differences));
        XLSX.utils.book_append_sheet(wb, ws, `差异-${String(mid).slice(0, 28)}`);
      }
    } else {
      const ws = XLSX.utils.aoa_to_sheet(buildDiffRows(diffs));
      XLSX.utils.book_append_sheet(wb, ws, '差异明细');
    }
  }
  if (sections.includes('suggestions')) {
    const ws = XLSX.utils.aoa_to_sheet(buildSuggestionRows(result.differences || []));
    ws['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws, '追溯建议');
  }

  ensureDir(options.outputDir);
  const file = path.join(options.outputDir, `${options.name || 'reconcile-report'}.xlsx`);
  XLSX.writeFile(wb, file);
  return file;
}

function generatePdf(result, options) {
  const fontPath = findCjkFont();
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  ensureDir(options.outputDir);
  const file = path.join(options.outputDir, `${options.name || 'reconcile-report'}.pdf`);
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);

  let useCjk = false;
  if (fontPath) {
    try {
      const psName = resolveFontName(fontPath);
      doc.registerFont('CJK', fontPath, psName || undefined);
      doc.font('CJK');
      useCjk = true;
    } catch (e) {
      logger.debug(`字体注册失败，PDF 将使用拉丁字体: ${e.message}`);
    }
  }
  if (!useCjk) {
    logger.warn(fontPath ? '中文字体注册失败，PDF 中文可能显示异常，建议使用 Excel 报告' : '未找到中文字体，PDF 中文字符可能无法显示，建议使用 Excel 报告');
  }

  const title = useCjk ? '第三方支付对账报告' : 'Payment Reconciliation Report';
  doc.fontSize(20).text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('gray').text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'center' });
  doc.moveDown(2);

  const sections = options.sections || ['summary', 'differences', 'suggestions'];

  if (sections.includes('summary')) {
    doc.fillColor('black').fontSize(14).text(useCjk ? '一、对账汇总' : '1. Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    for (const [k, v] of buildSummaryRows(result).slice(1)) {
      doc.text(`${k}: ${v}`);
    }
    doc.moveDown();
  }

  if (sections.includes('differences')) {
    doc.addPage().fontSize(14).text(useCjk ? '二、差异明细' : '2. Differences', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(8);
    const diffs = (result.differences || []).slice(0, 200);
    const colW = [80, 60, 50, 70, 50, 50, 50, 60, 50, 50];
    const header = ['订单号', '商户', '通道', '差异类型', '订单额', '通道额', '金额差', '时间差', '订单状态', '通道状态'];
    doc.text(header.join('  '));
    doc.moveDown(0.2);
    for (const d of diffs) {
      const line = [d.orderId, d.merchantId, d.channel, TYPE_LABELS[d.primaryType] || d.primaryType, d.orderAmount, d.channelAmount, d.amountDiff, d.timeDiffHuman, d.orderStatus, d.channelStatus].join('  ');
      doc.text(line, { width: 500 });
    }
    if ((result.differences || []).length > 200) {
      doc.moveDown().fillColor('gray').text(`... 共 ${result.differences.length} 条差异，仅展示前 200 条，完整数据见 Excel 报告`);
    }
    doc.moveDown();
  }

  if (sections.includes('suggestions')) {
    doc.addPage().fillColor('black').fontSize(14).text(useCjk ? '三、追溯建议' : '3. Suggestions', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);
    for (const row of buildSuggestionRows(result.differences || []).slice(1)) {
      doc.fillColor('black').fontSize(10).text(`${row[0]} (${row[1]} 笔)`);
      doc.fillColor('gray').fontSize(8).text(row[2]);
      doc.moveDown(0.5);
    }
  }

  doc.end();
  return new Promise((resolve) => stream.on('finish', () => resolve(file)));
}

async function generateReport(result, options = {}) {
  const formats = options.format ? [options.format] : ['xlsx', 'pdf'];
  const outputs = [];
  if (formats.includes('xlsx')) {
    outputs.push(generateExcel(result, options));
    logger.success(`Excel 报告已生成: ${outputs[outputs.length - 1]}`);
  }
  if (formats.includes('pdf')) {
    const pdfFile = await generatePdf(result, options);
    outputs.push(pdfFile);
    logger.success(`PDF 报告已生成: ${pdfFile}`);
  }
  return outputs;
}

export { generateExcel, generatePdf, generateReport, TYPE_LABELS, SUGGESTIONS };
export default { generateReport };
