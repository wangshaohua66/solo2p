const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const MERCHANTS = [
  '北京华联商贸有限公司',
  '上海恒源科技有限公司',
  '广州盛世物流有限公司',
  '深圳创新数码科技有限公司',
  '杭州盛世餐饮管理有限公司',
  '成都锦绣百货有限公司',
  '武汉长江建筑工程有限公司',
  '南京金陵物业服务有限公司',
  '西安唐韵文化传播有限公司',
  '重庆山城食品有限公司',
  '苏州园林工程有限公司',
  '青岛海产贸易有限公司',
  '天津港物流有限公司',
  '长沙湘雅医药有限公司'
];

const TAX_RATES = [0.13, 0.09, 0.06, 0.03, 0];
const DATES = ['2026-01-05', '2026-01-12', '2026-01-18', '2026-01-25', '2026-02-03', '2026-02-10', '2026-02-20', '2026-02-28'];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomAmount() { return +(Math.random() * 50000 + 500).toFixed(2); }
function pad(n, len) { return String(n).padStart(len, '0'); }

let _seq = 100000;
function nextUniqueInvoice(base, offset) {
  _seq++;
  const n = 10000000 + (_seq * 17 + offset * 31) % 99999999;
  return pad(n, 8);
}

function nextUniqueCode(platformCodeIdx) {
  _seq++;
  const regionPart = '011' + String(10 + platformCodeIdx * 3);
  const seqPart = pad(_seq % 1000000, 6);
  return regionPart.substring(0, 6) + seqPart.substring(0, 6);
}

function generateInvoiceRecords(count, type, platformIdx, platformCode) {
  const records = [];
  for (let i = 0; i < count; i++) {
    const amount = randomAmount();
    const rate = randomItem(TAX_RATES);
    const tax = +(amount * rate).toFixed(2);
    const total = +(amount + tax).toFixed(2);
    records.push({
      id: platformIdx * 10000 + i,
      code: nextUniqueCode(platformIdx),
      number: nextUniqueInvoice(platformIdx, i),
      date: DATES[i % DATES.length],
      buyer: type === 'output' ? randomItem(MERCHANTS) : '本公司（自开）',
      buyerTax: '91110' + pad(10000000 + (platformIdx * 1000 + i), 8),
      seller: type === 'output' ? '本公司（自开）' : randomItem(MERCHANTS),
      sellerTax: '91110' + pad(90000000 + (platformIdx * 1000 + i), 8),
      amount, tax, total, rate,
      type, platform: platformCode
    });
  }
  return records;
}

const PLATFORMS_DEF = [
  { name: 'hangxin', code: 'HX', file: '航信开票系统_2026Q1.xml' },
  { name: 'baiwang', code: 'BW', file: '百望云_2026Q1.json' },
  { name: 'tencent', code: 'TX', file: '腾讯电子发票_2026Q1.csv' },
  { name: 'alipay', code: 'ALI', file: '支付宝发票管家_2026Q1.xlsx' },
  { name: 'jd', code: 'JD', file: '京东商家后台_2026Q1.json' },
  { name: 'tmall', code: 'TM', file: '天猫商家中心_2026Q1.txt' }
];

async function generateHangxinXML(records, filepath) {
  const invoices = records.map(r => `
    <FP>
      <FPDM>${r.code}</FPDM>
      <FPHM>${r.number}</FPHM>
      <KPRQ>${r.date}</KPRQ>
      <GMFMC>${r.buyer}</GMFMC>
      <GMFNSRSBH>${r.buyerTax}</GMFNSRSBH>
      <XSFMC>${r.seller}</XSFMC>
      <XSFNSRSBH>${r.sellerTax}</XSFNSRSBH>
      <WSHJJE>${r.amount.toFixed(2)}</WSHJJE>
      <HJSE>${r.tax.toFixed(2)}</HJSE>
      <JSHJ>${r.total.toFixed(2)}</JSHJ>
      <SL>${(r.rate * 100).toFixed(0)}</SL>
      <FPLX>${r.type === 'input' ? '进项' : '销项'}</FPLX>
    </FP>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ZZSFP xmlns="http://www.chinatax.gov.cn/zzsfp">
  <FPXX count="${records.length}">${invoices}
  </FPXX>
</ZZSFP>`;
  fs.writeFileSync(filepath, xml, 'utf8');
}

async function generateBaiwangJSON(records, filepath) {
  const data = {
    code: 0,
    message: 'success',
    platform: '百望云',
    exportTime: '2026-03-01 10:00:00',
    data: {
      totalCount: records.length,
      list: records.map(r => ({
        invoiceCode: r.code,
        invoiceNumber: r.number,
        invoiceDate: r.date,
        buyerName: r.buyer,
        buyerTaxId: r.buyerTax,
        sellerName: r.seller,
        sellerTaxId: r.sellerTax,
        amount: r.amount,
        tax: r.tax,
        total: r.total,
        taxRate: (r.rate * 100).toFixed(0) + '%',
        invoiceType: r.type === 'input' ? '进项' : '销项'
      }))
    }
  };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

async function generateTencentCSV(records, filepath) {
  const header = ['发票代码', '发票号码', '开票日期', '购买方名称', '购买方税号', '销售方名称', '销售方税号', '金额', '税额', '价税合计', '税率', '发票类型'];
  const rows = [header];
  for (const r of records) {
    rows.push([r.code, r.number, r.date, r.buyer, r.buyerTax, r.seller, r.sellerTax,
      r.amount.toFixed(2), r.tax.toFixed(2), r.total.toFixed(2),
      (r.rate * 100).toFixed(0) + '%', r.type === 'input' ? '进项' : '销项']);
  }
  const csv = '\uFEFF' + rows.map(row => row.map(c => `"${c}"`).join(',')).join('\r\n');
  fs.writeFileSync(filepath, csv, 'utf8');
}

async function generateAlipayExcel(records, filepath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('发票明细');
  ws.getCell('A1').value = '支付宝发票管家 - 发票导出清单';
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
  ws.mergeCells('A1:J1');

  ws.getCell('A3').value = '商户名称：本公司（自开）';
  ws.getCell('A4').value = '导出时间：2026-03-01 10:30:00';
  ws.getCell('A5').value = `合计记录数：${records.length}`;

  const headerRow = 7;
  const headers = ['发票代码', '发票号码', '开票日期', '购买方', '销售方', '不含税金额', '税额', '价税合计', '税率(%)', '类型'];
  headers.forEach((h, i) => {
    const cell = ws.getRow(headerRow).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  records.forEach((r, idx) => {
    const rowNum = headerRow + 1 + idx;
    const row = ws.getRow(rowNum);
    row.getCell(1).value = r.code;
    row.getCell(2).value = r.number;
    row.getCell(3).value = r.date;
    row.getCell(4).value = r.buyer.substring(0, 12);
    row.getCell(5).value = r.seller.substring(0, 12);
    row.getCell(6).value = r.amount;
    row.getCell(7).value = r.tax;
    row.getCell(8).value = r.total;
    row.getCell(9).value = (r.rate * 100).toFixed(0);
    row.getCell(10).value = r.type === 'input' ? '进项' : '销项';
  });
  ws.columns.forEach((col, i) => {
    col.width = [14, 14, 14, 18, 18, 14, 12, 14, 10, 8][i] || 12;
  });
  await wb.xlsx.writeFile(filepath);
}

async function generateJDJSON(records, filepath) {
  const result = {
    channel: 'JD.COM',
    merchant: '京东POP商家',
    responseTime: '2026-03-01T09:15:00+08:00',
    result: {
      success: true,
      total: records.length,
      orderList: records.map(r => ({
        orderId: 'JD' + 20260000 + r.id,
        invoiceCode: r.code,
        invoiceNumber: r.number,
        billingDate: r.date,
        purchaserName: r.buyer,
        purchaserTaxId: r.buyerTax,
        vendorName: r.seller,
        vendorTaxId: r.sellerTax,
        exclusiveAmount: r.amount.toFixed(2),
        taxAmount: r.tax.toFixed(2),
        amountWithTax: r.total.toFixed(2),
        taxRatio: r.rate,
        inputOutput: r.type === 'input' ? 1 : 2
      }))
    }
  };
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf8');
}

async function generateTmallTxt(records, filepath) {
  let content = '天猫商家中心 - 发票汇总清单\n';
  content += '导出时间：2026-03-01 09:00:00\n';
  content += `记录总数：${records.length}\n`;
  content += '=========================================\n\n';
  content += ['序号', '发票代码', '发票号码', '开票日期', '买家名称', '卖家名称', '金额', '税额', '合计', '税率', '类型'].join('\t') + '\n';

  records.forEach((r, i) => {
    content += [
      i + 1, r.code, r.number, r.date, r.buyer.substring(0, 14), r.seller.substring(0, 14),
      r.amount.toFixed(2), r.tax.toFixed(2), r.total.toFixed(2),
      (r.rate * 100).toFixed(0) + '%', r.type === 'input' ? '进项' : '销项'
    ].join('\t') + '\n';
  });
  fs.writeFileSync(filepath, content, 'utf8');
}

async function main() {
  const baseDir = path.resolve(process.cwd(), 'data', 'invoices');
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  fs.readdirSync(baseDir).forEach(f => fs.unlinkSync(path.join(baseDir, f)));

  console.log('🎯 开始生成6种格式的测试发票数据...\n');

  const generators = [generateHangxinXML, generateBaiwangJSON, generateTencentCSV, generateAlipayExcel, generateJDJSON, generateTmallTxt];
  let total = 0;
  const stats = [];

  for (let i = 0; i < PLATFORMS_DEF.length; i++) {
    const p = PLATFORMS_DEF[i];
    const out = generateInvoiceRecords(12, 'output', i, p.code)
      .concat(generateInvoiceRecords(8, 'input', i, p.code));
    await generators[i](out, path.join(baseDir, p.file));
    const o = out.filter(x => x.type === 'output').length;
    const inp = out.filter(x => x.type === 'input').length;
    stats.push(`✅ ${p.file.replace(/\.[^.]+$/, '')}: ${out.length} 张 (销项${o}, 进项${inp})`);
    console.log(stats[stats.length - 1]);
    total += out.length;
  }

  const allNumbers = new Set();
  const codes = new Set();
  fs.readdirSync(baseDir).forEach(f => {
    const content = fs.readFileSync(path.join(baseDir, f), 'utf8');
    const matches = content.match(/\d{8}/g) || [];
    matches.forEach(m => { if (m.length === 8) allNumbers.add(m); });
    const codem = content.match(/\d{11,13}/g) || [];
    codem.forEach(m => { if (m.length === 11 || m.length === 12) codes.add(m); });
  });

  console.log(`\n🎉 共生成 ${total} 张测试发票记录`);
  console.log(`📋 唯一发票号码数: ${allNumbers.size}, 唯一代码数: ${codes.size}`);
  if (allNumbers.size < total) console.log('⚠ 注意：有发票号码重复！');
  else console.log('✅ 所有发票号码唯一无重复');
  console.log(`💾 已保存到: ${baseDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
