const { initDatabase, getOppositionDeadlines, getAllClientTrademarks, closeDatabase } = require('./src/store/database');
const { matchTrademarks } = require('./src/matcher/trademarkMatcher');
const { loadConfig } = require('./src/config');

loadConfig();

function generateTestTrademarks(count) {
  const trademarks = [];
  const prefixes = ['科技', '智慧', '创新', '未来', '数字', '智能', '云端', '数据', '互联', '绿色'];
  const suffixes = ['达', '通', '盛', '荣', '华', '康', '顺', '和', '丰', '泰'];
  
  for (let i = 0; i < count; i++) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    trademarks.push({
      id: i + 1,
      trademarkName: `${prefix}${suffix}${i}`,
      classNumber: String(Math.floor(Math.random() * 45) + 1),
      applicant: `测试公司${i}号`,
      applicationNumber: `2024${String(i).padStart(8, '0')}`,
      announcementType: '初审公告'
    });
  }
  return trademarks;
}

async function testPerformance() {
  console.log('\n' + '='.repeat(60));
  console.log('  性能测试报告');
  console.log('='.repeat(60) + '\n');
  
  try {
    initDatabase();
    
    const memStart = process.memoryUsage();
    
    const clientTrademarks = [];
    for (let i = 0; i < 100; i++) {
      clientTrademarks.push({
        id: i + 1,
        client_id: `CLIENT${String(i).padStart(3, '0')}`,
        client_name: `测试客户${i}号`,
        trademark_name: `测试商标${i}`,
        class_number: String((i % 45) + 1)
      });
    }
    
    console.log('  📊 测试数据规模:');
    console.log(`     客户商标数: ${clientTrademarks.length}`);
    console.log();
    
    const testSizes = [100, 500, 1000, 5000];
    
    for (const size of testSizes) {
      const testTrademarks = generateTestTrademarks(size);
      
      const startTime = process.hrtime.bigint();
      const memBefore = process.memoryUsage();
      
      const result = await matchTrademarks(testTrademarks, clientTrademarks);
      
      const endTime = process.hrtime.bigint();
      const memAfter = process.memoryUsage();
      
      const durationMs = Number(endTime - startTime) / 1e6;
      const memDeltaMB = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
      
      console.log(`  🔍 匹配 ${size} 条公告商标:`);
      console.log(`     耗时: ${durationMs.toFixed(2)}ms`);
      console.log(`     匹配结果: ${result.matches.length} 条`);
      console.log(`     内存增量: ${memDeltaMB.toFixed(2)}MB`);
      
      const perRecord = durationMs / size;
      console.log(`     单条平均: ${perRecord.toFixed(3)}ms`);
      console.log();
    }
    
    const deadlineStart = process.hrtime.bigint();
    const deadlines = await getOppositionDeadlines(30);
    const deadlineEnd = process.hrtime.bigint();
    const deadlineMs = Number(deadlineEnd - deadlineStart) / 1e6;
    
    console.log('  ⏰ 异议期限查询:');
    console.log(`     结果数: ${deadlines.length} 条`);
    console.log(`     耗时: ${deadlineMs.toFixed(2)}ms`);
    console.log(`     性能达标: ${deadlineMs < 500 ? '✅ 是 (< 500ms)' : '❌ 否 (>= 500ms)'}`);
    console.log();
    
    const memEnd = process.memoryUsage();
    const totalMemMB = memEnd.heapUsed / 1024 / 1024;
    
    console.log('  💾 内存使用:');
    console.log(`     堆内存: ${totalMemMB.toFixed(2)}MB`);
    console.log(`     内存达标: ${totalMemMB < 200 ? '✅ 是 (< 200MB)' : '⚠️  否 (>= 200MB)'}`);
    console.log();
    
    console.log('='.repeat(60));
    console.log('  测试完成');
    console.log('='.repeat(60) + '\n');
    
    closeDatabase();
    
  } catch (error) {
    console.error('  ❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  testPerformance();
}

module.exports = { testPerformance, generateTestTrademarks };
