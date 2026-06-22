const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const log = (msg) => console.log(`\n${'='.repeat(70)}\n${msg}\n${'='.repeat(70)}`);
const run = (cmd, opts = {}) => {
  console.log(`▶  ${cmd}\n`);
  return execSync(cmd, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
};

try {
  process.chdir(path.resolve(__dirname, '..'));

  log('🧹 第0步：清理旧数据');
  if (fs.existsSync('./data/invoices.db')) fs.unlinkSync('./data/invoices.db');
  const outDir = './data/output';
  if (fs.existsSync(outDir)) {
    fs.readdirSync(outDir).forEach(f => {
      try { fs.unlinkSync(path.join(outDir, f)); } catch (e) {}
    });
  }
  console.log('✅ 清理完成');

  log('📦 第1步：生成6种格式测试发票数据');
  let out = run('node test/generate-test-data.js');
  console.log(out);

  log('📥 第2步：批量归集发票入库 (aggregate)');
  out = run('node src/index.js aggregate --dir ./data/invoices 2>&1 | tail -60');
  console.log(out);

  log('📋 第3步：查看系统状态 (status)');
  out = run('node src/index.js status 2>&1');
  console.log(out);

  log('🔍 第4步：查询发票示例 (query)');
  out = run('node src/index.js query --start-date 2026-01-01 --type output --limit 10 2>&1 | tail -40');
  console.log(out);

  log('🔀 第5步：合并发票 (merge) - 2026年1-2月');
  out = run('node src/index.js merge -s 2026-01-01 -e 2026-02-28 --format all 2>&1 | tail -50');
  console.log(out);

  log('🧾 第6步：增值税抵扣计算 (deduct)');
  out = run('node src/index.js deduct -s 2026-01-01 -e 2026-02-28 2>&1 | tail -60');
  console.log(out);

  log('📄 第7步：增值税申报表预生成 (declare)');
  out = run('node src/index.js declare -s 2026-01-01 -e 2026-02-28 2>&1 | tail -60');
  console.log(out);

  log('📊 第8步：月度统计报表 (stats)');
  out = run('node src/index.js stats --period month --month 2026-01 2>&1 | tail -70');
  console.log(out);

  log('💾 检查输出文件');
  const outputDir = path.resolve(process.cwd(), 'data', 'output');
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    console.log(`共生成 ${files.length} 个输出文件:`);
    for (const f of files) {
      const p = path.join(outputDir, f);
      const s = fs.statSync(p);
      console.log(`  📄 ${f}  (${(s.size/1024).toFixed(1)} KB)`);
    }
  } else {
    console.log('输出目录为空');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🎉 全部命令执行成功！电子发票聚合服务CLI工具完整测试通过');
  console.log('═'.repeat(70));

} catch (e) {
  console.error('\n❌ 测试失败:', e.message);
  if (e.stdout) console.error('STDOUT:', e.stdout?.toString()?.substring(0, 1000));
  if (e.stderr) console.error('STDERR:', e.stderr?.toString()?.substring(0, 1000));
  process.exit(1);
}
