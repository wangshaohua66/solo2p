const os = require('os');
const crypto = require('crypto');
const moment = require('moment');
const cliProgress = require('cli-progress');
const chalk = require('chalk');

const { loadConfig } = require('./src/config');
const { initDatabase, getAllClientTrademarks, closeDatabase } = require('./src/store/database');
const { matchTrademarks } = require('./src/matcher/trademarkMatcher');
const { createAlertHandler } = require('./src/notifier/alertHandler');
const { exportToCsv, getMatchResultExportColumns, getClientExportColumns } = require('./src/parser/csvExporter');
const { getCheckpointManager } = require('./src/scraper/incrementalManager');

loadConfig();

function generateAnnouncementTrademarks(count, seed = Date.now()) {
  const prefixes = ['科技', '智慧', '创新', '未来', '数字', '智能', '云端', '数据', '互联', '绿色',
                   '健康', '美丽', '安心', '快乐', '幸福', '财富', '成功', '卓越', '领航', '盛世'];
  const suffixes = ['达', '通', '盛', '荣', '华', '康', '顺', '和', '丰', '泰',
                   '德', '诚', '信', '正', '源', '兴', '隆', '旺', '宏', '伟'];
  const applicants = ['北京科技有限公司', '上海创新集团', '深圳智能科技股份有限公司',
                      '广州互联网公司', '杭州数字技术有限公司', '成都软件公司',
                      '武汉数据科技有限公司', '南京网络科技有限公司', '西安云计算公司',
                      '重庆人工智能公司'];
  const classes = ['9', '35', '42', '25', '30', '29', '32', '43', '11', '21', '3', '5', '7', '10', '14', '16', '18', '20', '24', '28'];
  const types = ['初审公告', '注册公告', '转让公告', '续展公告', '变更公告'];
  
  const rng = (n) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * n);
  };
  
  const trademarks = [];
  
  for (let i = 0; i < count; i++) {
    const prefix = prefixes[rng(prefixes.length)];
    const suffix = suffixes[rng(suffixes.length)];
    const addNum = i % 20;
    const name = `${prefix}${suffix}${addNum > 0 ? addNum : ''}`;
    
    trademarks.push({
      id: i + 1,
      trademarkName: name,
      trademark_name: name,
      applicant: applicants[rng(applicants.length)],
      applicationNumber: `2024${String(rng(900000) + 100000)}${String(i).padStart(4, '0')}`,
      registrationNumber: `R${String(rng(9000000) + 1000000)}`,
      classNumber: classes[rng(classes.length)],
      class_number: classes[rng(classes.length)],
      announcementType: types[rng(types.length)],
      announcement_type: types[rng(types.length)],
      announcementDate: moment().subtract(rng(30), 'days').format('YYYY-MM-DD'),
      announcement_date: moment().subtract(rng(30), 'days').format('YYYY-MM-DD'),
      announcement_id: rng(50) + 1,
      pdf_page: rng(50) + 1
    });
  }
  
  return trademarks;
}

function generateClientTrademarks(count, seed = Date.now()) {
  const rng = (n) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * n);
  };
  
  const names = ['科技创新', '智慧未来', '美味鲜', '香飘飘', '绿健', '金典', '蓝月亮',
                 '白象', '双汇', '伊利', '蒙牛', '王老吉', '加多宝', '农夫山泉', '康师傅',
                 '统一', '今麦郎', '华为', '小米', 'OPPO', 'vivo', '荣耀', '魅族', '一加',
                 '大疆', '比亚迪', '蔚来', '小鹏', '理想', '宁德时代'];
  const classes = ['9', '35', '42', '25', '30', '29', '32', '43', '11', '3', '5', '25', '12', '38', '41'];
  
  const trademarks = [];
  for (let i = 0; i < count; i++) {
    trademarks.push({
      id: i + 1,
      client_id: `CLIENT${String(i % 100).padStart(3, '0')}`,
      client_name: `客户${String(i % 100).padStart(3, '0')}有限公司`,
      trademark_name: names[i % names.length] + (i >= names.length ? String(Math.floor(i / names.length)) : ''),
      class_number: classes[rng(classes.length)],
      application_number: `2023${String(rng(900000) + 100000)}`,
      contact_email: `client${i}@example.com`,
      contact_name: `联系人${i}`,
      risk_threshold: ['low', 'medium', 'high'][rng(3)],
      instant_alert: rng(10) > 2 ? 1 : 0,
      weekly_summary: 1
    });
  }
  return trademarks;
}

function measureMemory() {
  const usage = process.memoryUsage();
  return {
    heapUsedMB: (usage.heapUsed / 1024 / 1024).toFixed(2),
    heapTotalMB: (usage.heapTotal / 1024 / 1024).toFixed(2),
    rssMB: (usage.rss / 1024 / 1024).toFixed(2),
    externalMB: (usage.external / 1024 / 1024).toFixed(2)
  };
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
}

async function testScenario_TrademarkMatching() {
  console.log(chalk.cyan('\n' + '='.repeat(70)));
  console.log(chalk.cyan('  场景测试 1: 商标匹配性能测试'));
  console.log(chalk.cyan('='.repeat(70)));
  console.log();
  
  const results = [];
  const clientTrademarks = generateClientTrademarks(1000, 12345);
  const testConfigs = [
    { size: 100, label: '100 条', maxTime: 1000 },
    { size: 500, label: '500 条', maxTime: 5000 },
    { size: 1000, label: '1,000 条', maxTime: 20000 },
    { size: 5000, label: '5,000 条', maxTime: 300000 }
  ];
  
  for (const config of testConfigs) {
    const testData = generateAnnouncementTrademarks(config.size, config.size * 7);
    const memBefore = measureMemory();
    const startTime = process.hrtime.bigint();
    
    const matchResult = await matchTrademarks(testData, clientTrademarks);
    
    const endTime = process.hrtime.bigint();
    const memAfter = measureMemory();
    const durationMs = Number(endTime - startTime) / 1e6;
    const perRecord = durationMs / config.size;
    
    const timePass = durationMs <= config.maxTime;
    const memDelta = parseFloat(memAfter.heapUsedMB) - parseFloat(memBefore.heapUsedMB);
    const memPass = memDelta < 100;
    
    results.push({
      scenario: `商标匹配 ${config.label}`,
      inputSize: config.size,
      clientCount: clientTrademarks.length,
      durationMs: durationMs,
      matchesFound: matchResult.matches.length,
      perRecordMs: perRecord,
      memoryDeltaMB: memDelta,
      timePass,
      memPass,
      pass: timePass && memPass
    });
    
    console.log(`  ${config.label.padEnd(14)} | ${formatDuration(durationMs).padEnd(10)} | 匹配: ${String(matchResult.matches.length).padEnd(6)} | 内存Δ: ${(memDelta > 0 ? '+' : '') + memDelta.toFixed(2)}MB | ${timePass ? chalk.green('✓ 时间') : chalk.red('✗ 超时')} ${memPass ? chalk.green('内存') : chalk.red('内存')}`);
  }
  
  console.log();
  return results;
}

async function testScenario_ConcurrentMatching() {
  console.log(chalk.cyan('\n' + '='.repeat(70)));
  console.log(chalk.cyan('  场景测试 2: 并发匹配性能测试 (模拟多线程爬虫)'));
  console.log(chalk.cyan('='.repeat(70)));
  console.log();
  
  const concurrencyLevels = [5, 10, 20];
  const batchSize = 500;
  const clientTrademarks = generateClientTrademarks(2000, 99999);
  const results = [];
  
  for (const concurrency of concurrencyLevels) {
    console.log(`  并发数: ${chalk.yellow(concurrency)}, 每批: ${batchSize} 条公告商标`);
    
    const batches = Array(concurrency).fill(null).map((_, i) => 
      generateAnnouncementTrademarks(batchSize, i * 131 + 77)
    );
    
    const memBefore = measureMemory();
    const startTime = process.hrtime.bigint();
    
    const matchPromises = batches.map(batch => matchTrademarks(batch, clientTrademarks));
    const matchResults = await Promise.all(matchPromises);
    
    const endTime = process.hrtime.bigint();
    const memAfter = measureMemory();
    const durationMs = Number(endTime - startTime) / 1e6;
    const memDelta = parseFloat(memAfter.heapUsedMB) - parseFloat(memBefore.heapUsedMB);
    
    const totalMatches = matchResults.reduce((sum, r) => sum + r.matches.length, 0);
    const totalRecords = concurrency * batchSize;
    const throughput = totalRecords / (durationMs / 1000);
    
    const memPass = memDelta < 200;
    const memUsed = parseFloat(memAfter.rssMB);
    const rssPass = memUsed < 512;
    
    const throughputStr = `${Math.round(throughput)}条/s`;
    
    results.push({
      concurrency,
      batchSize,
      totalRecords,
      durationMs,
      totalMatches,
      throughputPerSec: Math.round(throughput),
      memoryDeltaMB: memDelta,
      rssMB: memUsed,
      memPass,
      rssPass,
      pass: memPass && rssPass
    });
    
    console.log(`    耗时: ${formatDuration(durationMs).padEnd(10)} | 总匹配: ${String(totalMatches).padEnd(6)} | 吞吐量: ${throughputStr} | RSS: ${memUsed}MB | ${memPass ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`    内存Δ: ${(memDelta > 0 ? '+' : '') + memDelta.toFixed(2)}MB | 每并发耗时: ${formatDuration(durationMs / concurrency).padEnd(8)}`);
  }
  
  console.log();
  return results;
}

async function testScenario_CsvExport() {
  console.log(chalk.cyan('\n' + '='.repeat(70)));
  console.log(chalk.cyan('  场景测试 3: CSV 导出性能测试'));
  console.log(chalk.cyan('='.repeat(70)));
  console.log();
  
  const sizes = [1000, 5000, 10000, 50000];
  const data = generateClientTrademarks(1000, 54321);
  const columns = getClientExportColumns();
  const results = [];
  
  for (const size of sizes) {
    const testData = size <= data.length ? data.slice(0, size) : Array(size).fill(null).map((_, i) => data[i % data.length]);
    const memBefore = measureMemory();
    const startTime = process.hrtime.bigint();
    
    const result = await exportToCsv(testData, {
      filename: `perf_test_${size}.csv`,
      columns
    });
    
    const endTime = process.hrtime.bigint();
    const memAfter = measureMemory();
    const durationMs = Number(endTime - startTime) / 1e6;
    const memDelta = parseFloat(memAfter.heapUsedMB) - parseFloat(memBefore.heapUsedMB);
    const sizeKB = result.sizeBytes / 1024;
    
    const timePass = size < 50000 ? durationMs < 30000 : durationMs < 300000;
    
    results.push({
      records: size,
      fileSizeKB: sizeKB.toFixed(2),
      durationMs,
      memoryDeltaMB: memDelta,
      timePass,
      pass: timePass
    });
    
    console.log(`  ${String(size).padStart(6)} 条 | 文件: ${sizeKB.toFixed(1)}KB | 耗时: ${formatDuration(durationMs).padEnd(10)} | 内存Δ: ${(memDelta > 0 ? '+' : '') + memDelta.toFixed(2)}MB | ${timePass ? chalk.green('✓') : chalk.red('✗')}`);
  }
  
  console.log();
  return results;
}

async function testScenario_OppositionQuery() {
  console.log(chalk.cyan('\n' + '='.repeat(70)));
  console.log(chalk.cyan('  场景测试 4: 异议期限查询性能测试 (要求 <500ms)'));
  console.log(chalk.cyan('='.repeat(70)));
  console.log();
  
  initDatabase();
  const { createScheduler } = require('./src/scraper/scheduler');
  const scheduler = createScheduler();
  const results = [];
  
  for (let round = 1; round <= 5; round++) {
    const memBefore = measureMemory();
    const startTime = process.hrtime.bigint();
    
    const deadlines = await scheduler.checkOppositionDeadlines();
    
    const endTime = process.hrtime.bigint();
    const memAfter = measureMemory();
    const durationMs = Number(endTime - startTime) / 1e6;
    const memDelta = parseFloat(memAfter.heapUsedMB) - parseFloat(memBefore.heapUsedMB);
    
    const timePass = durationMs < 500;
    const memPass = memDelta < 50;
    
    results.push({
      round,
      recordsFound: deadlines.length,
      durationMs,
      memoryDeltaMB: memDelta,
      timePass,
      memPass,
      pass: timePass && memPass
    });
    
    console.log(`  第 ${round} 轮 | 记录: ${String(deadlines.length).padEnd(4)} | 耗时: ${formatDuration(durationMs).padEnd(10)} | ${timePass ? chalk.green('✓ <500ms') : chalk.red(`✗ ${durationMs.toFixed(0)}ms`)} | 内存Δ: ${(memDelta > 0 ? '+' : '') + memDelta.toFixed(2)}MB`);
  }
  
  closeDatabase();
  console.log();
  return results;
}

async function testScenario_IncrementalDeduplication() {
  console.log(chalk.cyan('\n' + '='.repeat(70)));
  console.log(chalk.cyan('  场景测试 5: 增量抓取与去重机制测试'));
  console.log(chalk.cyan('='.repeat(70)));
  console.log();
  
  const manager = getCheckpointManager();
  manager.load();
  manager.reset();
  
  const batchSize = 1000;
  const duplicateRate = 0.3;
  const rounds = 5;
  const results = [];
  
  console.log(`  每轮 ${batchSize} 条, 重复率 ${duplicateRate * 100}%, ${rounds} 轮连续处理`);
  console.log();
  
  for (let round = 1; round <= rounds; round++) {
    const trademarks = generateAnnouncementTrademarks(batchSize, round * 42 + 7);
    const toDuplicate = trademarks.slice(0, Math.floor(batchSize * duplicateRate));
    const batch = [...toDuplicate, ...trademarks.slice(Math.floor(batchSize * duplicateRate))];
    
    const startTime = process.hrtime.bigint();
    const memBefore = measureMemory();
    
    const dedupResult = manager.deduplicateTrademarks(batch);
    batch.forEach((tm, i) => {
      manager.markTrademarkProcessed(tm, round, 0);
    });
    manager.markAnnouncementProcessed(`AN${round.toString().padStart(6, '0')}`, { page: round });
    manager.save(true);
    
    const endTime = process.hrtime.bigint();
    const memAfter = measureMemory();
    const durationMs = Number(endTime - startTime) / 1e6;
    const memDelta = parseFloat(memAfter.heapUsedMB) - parseFloat(memBefore.heapUsedMB);
    
    const dedupRate = (dedupResult.duplicates.length / batch.length * 100).toFixed(1);
    const timePass = durationMs < 3000;
    
    results.push({
      round,
      inputSize: batch.length,
      uniqueCount: dedupResult.unique.length,
      duplicatesFound: dedupResult.duplicates.length,
      dedupRatePercent: dedupRate,
      durationMs,
      memoryDeltaMB: memDelta,
      timePass,
      pass: timePass
    });
    
    console.log(`  第 ${round} 轮 | 输入: ${batch.length} | 唯一: ${dedupResult.unique.length} | 去重: ${dedupResult.duplicates.length}(${dedupRate}%) | 耗时: ${formatDuration(durationMs).padEnd(10)} | ${timePass ? chalk.green('✓') : chalk.red('✗')}`);
  }
  
  const stats = manager.getStatistics();
  console.log();
  console.log(chalk.gray('  去重统计:'));
  console.log(`    已跟踪公告: ${stats.processedAnnouncements} | 已跟踪商标: ${stats.trackedTrademarks} | 累计去重: ${stats.deduplicated}`);
  console.log();
  
  manager.reset();
  return results;
}

async function testScenario_NotificationCache() {
  console.log(chalk.cyan('\n' + '='.repeat(70)));
  console.log(chalk.cyan('  场景测试 6: 通知缓存机制测试'));
  console.log(chalk.cyan('='.repeat(70)));
  console.log();
  
  const alertHandler = createAlertHandler();
  const matchResult = {
    id: 'test_match_001',
    match_type: 'exact',
    risk_level: 'high',
    clientTrademarkId: 1,
    trademarkId: 100
  };
  const clientTrademark = {
    client_id: 'CLIENT001',
    trademark_name: '测试商标',
    client_name: '测试客户'
  };
  const announcementTrademark = {
    trademarkName: '测试商标',
    applicant: '测试公司',
    classNumber: '42'
  };
  const results = [];
  
  console.log('  阶段1: 首次发送 (缓存未命中)');
  const memBefore = measureMemory();
  const t1 = process.hrtime.bigint();
  
  const firstSend = await alertHandler.sendInstantAlert(matchResult, clientTrademark, announcementTrademark);
  
  const t2 = process.hrtime.bigint();
  const memAfter1 = measureMemory();
  const duration1 = Number(t2 - t1) / 1e6;
  const memDelta1 = parseFloat(memAfter1.heapUsedMB) - parseFloat(memBefore.heapUsedMB);
  console.log(`    首次发送: ${formatDuration(duration1).padEnd(10)} | 结果: ${firstSend.success ? chalk.green('成功') : chalk.yellow(firstSend.reason)} | 缓存: ${firstSend.cached ? chalk.green('命中') : chalk.gray('写入')}`);
  
  console.log('\n  阶段2: 重复发送 (24小时内, 应被去重)');
  const t3 = process.hrtime.bigint();
  
  const duplicateSend = await alertHandler.sendInstantAlert(matchResult, clientTrademark, announcementTrademark);
  
  const t4 = process.hrtime.bigint();
  const memAfter2 = measureMemory();
  const duration2 = Number(t4 - t3) / 1e6;
  const memDelta2 = parseFloat(memAfter2.heapUsedMB) - parseFloat(memAfter1.heapUsedMB);
  console.log(`    重复发送: ${formatDuration(duration2).padEnd(10)} | 结果: ${duplicateSend.success ? chalk.green('成功') : chalk.yellow(duplicateSend.reason)} | 缓存: ${duplicateSend.reason === 'duplicate_skipped' ? chalk.green('✓ 去重成功') : chalk.red('✗ 未去重')}`);
  
  console.log('\n  阶段3: 缓存统计');
  const cacheStats = alertHandler.getCacheStatistics();
  console.log(`    缓存命中率: ${cacheStats.performance.cacheHitRate} | 命中: ${cacheStats.performance.cacheHits} 次 | 未命中: ${cacheStats.performance.cacheMisses} 次`);
  console.log(`    缓存大小: 即时通知=${cacheStats.sizes.instantAlerts}, 周报=${cacheStats.sizes.weeklySummaries}, 去重索引=${cacheStats.sizes.deduplicationIndex}`);
  console.log(`    待重试: ${cacheStats.pendingRetries} | 已清理: ${cacheStats.statistics.evicted}`);
  
  console.log('\n  阶段4: 缓存失效测试');
  const invalidated = alertHandler.invalidateCache('all');
  const postStats = alertHandler.getCacheStatistics();
  console.log(`    已清理: ${invalidated} 项 | 清理后大小: ${postStats.sizes.deduplicationIndex}`);
  
  console.log();
  results.push({
    firstSendMs: duration1,
    duplicateSendMs: duration2,
    cacheHitRate: cacheStats.performance.cacheHitRate,
    deduplicationWorking: duplicateSend.reason === 'duplicate_skipped',
    invalidatedItems: invalidated,
    pass: duplicateSend.reason === 'duplicate_skipped'
  });
  return results;
}

async function runFullPerformanceTest() {
  console.log('\n' + chalk.bgCyan.black('='.repeat(70)));
  console.log(chalk.bgCyan.black('  商标公告监控系统 - 完整性能测试套件'));
  console.log(chalk.bgCyan.black('='.repeat(70)));
  console.log();
  console.log(`  系统信息:`);
  console.log(`    CPU: ${os.cpus()[0].model}`);
  console.log(`    核心数: ${os.cpus().length} | 内存: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`);
  console.log(`    Node.js: ${process.version} | 平台: ${process.platform} ${process.arch}`);
  console.log(`    测试时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
  
  const allResults = {};
  
  try {
    allResults.matching = await testScenario_TrademarkMatching();
    allResults.concurrent = await testScenario_ConcurrentMatching();
    allResults.csvExport = await testScenario_CsvExport();
    
    try {
      allResults.opposition = await testScenario_OppositionQuery();
    } catch (e) {
      console.log(chalk.yellow('  ⚠ 异议查询测试跳过:', e.message));
    }
    
    allResults.dedup = await testScenario_IncrementalDeduplication();
    allResults.cache = await testScenario_NotificationCache();
    
    console.log('\n' + chalk.bgGreen.black('='.repeat(70)));
    console.log(chalk.bgGreen.black('  测试总结报告'));
    console.log(chalk.bgGreen.black('='.repeat(70)));
    console.log();
    
    const allTests = [
      ...(allResults.matching || []),
      ...(allResults.concurrent || []),
      ...(allResults.csvExport || []),
      ...(allResults.opposition || []),
      ...(allResults.dedup || [])
    ];
    
    const passed = allTests.filter(t => t.pass).length;
    const total = allTests.length;
    const passRate = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';
    
    console.log(chalk.yellow(`  通过率: ${passed}/${total} (${passRate}%)`));
    console.log();
    console.log(chalk.yellow('  关键指标验证:'));
    
    if (allResults.concurrent && allResults.concurrent.length > 0) {
      const conc = allResults.concurrent.find(c => c.concurrency === 20);
      if (conc) {
        console.log(`    [20并发] RSS内存: ${conc.rssMB}MB ${conc.rssPass ? chalk.green('✓ <512MB') : chalk.red('✗ ≥512MB')}`);
      }
    }
    
    if (allResults.opposition && allResults.opposition.length > 0) {
      const avgOpTime = allResults.opposition.reduce((s, r) => s + r.durationMs, 0) / allResults.opposition.length;
      console.log(`    [异议查询] 平均耗时: ${avgOpTime.toFixed(1)}ms ${avgOpTime < 500 ? chalk.green('✓ <500ms') : chalk.red('✗ ≥500ms')}`);
    }
    
    if (allResults.matching && allResults.matching.length > 0) {
      const s5k = allResults.matching.find(r => r.inputSize === 5000);
      if (s5k) {
        console.log(`    [5000条匹配] 耗时: ${formatDuration(s5k.durationMs)} ${s5k.timePass ? chalk.green('✓ <10min') : chalk.red('✗ ≥10min')}`);
      }
    }
    
    if (allResults.dedup && allResults.dedup.length > 0) {
      const totalDedup = allResults.dedup.reduce((s, r) => s + r.duplicatesFound, 0);
      const totalInput = allResults.dedup.reduce((s, r) => s + r.inputSize, 0);
      console.log(`    [去重准确率] 累计: ${totalInput}输入/${totalDedup}去重 = ${(totalDedup/totalInput*100).toFixed(1)}%`);
    }
    
    console.log();
    console.log(chalk.green(passed === total ? '✓ 所有性能测试通过!' : `⚠ 部分测试未通过，请检查`));
    console.log();
    
  } catch (error) {
    console.error(chalk.red('\n✗ 测试执行失败:'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runFullPerformanceTest().catch(err => {
    console.error(chalk.red('性能测试崩溃:'), err);
    process.exit(1);
  });
}

module.exports = {
  runFullPerformanceTest,
  generateAnnouncementTrademarks,
  generateClientTrademarks,
  measureMemory,
  formatDuration
};
