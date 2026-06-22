const fs = require('fs');
const path = require('path');
const { parseFile, scanDirectory } = require('../src/lib/parser');

async function main() {
  const dir = path.resolve(process.cwd(), 'data', 'invoices');
  const files = scanDirectory(dir);
  console.log(`扫描到 ${files.length} 个文件:\n`);

  for (const file of files) {
    console.log('═══════════════════════════════════════════');
    console.log('文件:', path.basename(file));
    try {
      const result = await parseFile(file);
      console.log(`平台识别: ${result.platform} | 总记录: ${result.totalRecords} | 有效: ${result.validCount} | 无效: ${result.invalidCount}`);

      const byType = { input: 0, output: 0, unknown: 0 };
      const types = new Set();
      result.records.forEach(r => {
        byType[r.invoiceType] = (byType[r.invoiceType] || 0) + 1;
        if (r.invoiceNumber) types.add(r.invoiceNumber.substring(0, 4));
      });
      console.log(`类型分布: ${JSON.stringify(byType)}`);
      console.log(`发票号前缀样例: ${[...types].slice(0, 5).join(', ')}`);

      if (result.records.length > 0) {
        const sample = result.records[0];
        console.log('样例记录:');
        console.log('  发票代码:', sample.invoiceCode);
        console.log('  发票号码:', sample.invoiceNumber);
        console.log('  开票日期:', sample.invoiceDate);
        console.log('  购买方:', sample.buyerName);
        console.log('  销售方:', sample.sellerName);
        console.log('  金额/税额/合计:', sample.amount, sample.tax, sample.total);
        console.log('  税率:', sample.taxRate);
        console.log('  类型:', sample.invoiceType);
        console.log('  isValid:', sample.isValid, sample.validationErrors);
      } else {
        console.log(' ❌ 没有解析到任何记录!');
        console.log('   文件内容前500字符:', fs.readFileSync(file, 'utf8').substring(0, 500));
      }
    } catch (e) {
      console.log(' ❌ 解析异常:', e.message);
    }
    console.log('');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
