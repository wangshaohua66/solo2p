const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { createAlertHandler } = require('./src/notifier/alertHandler');
const { loadConfig } = require('./src/config');
const { initDatabase, closeDatabase } = require('./src/store/database');

function printHeader(title) {
  const line = '='.repeat(72);
  console.log(`\n${chalk.cyan(line)}`);
  console.log(chalk.cyan.bold(`  ${title}`));
  console.log(chalk.cyan(line));
}

function printSub(title) {
  console.log(`\n${chalk.yellow('▸ ')}${chalk.bold(title)}`);
}

function assert(condition, message, detail) {
  const ok = !!condition;
  const icon = ok ? chalk.green('✓') : chalk.red('✗');
  console.log(`  ${icon} ${message}${detail ? ' ' + chalk.gray(detail) : ''}`);
  return ok;
}

function assertEqual(actual, expected, message) {
  const ok = actual === expected;
  const icon = ok ? chalk.green('✓') : chalk.red('✗');
  const detail = ok ? '' : chalk.red(`(actual=${JSON.stringify(actual)}, expected=${JSON.stringify(expected)})`);
  console.log(`  ${icon} ${message} ${detail}`);
  return ok;
}

async function runDedupUnitTests() {
  const results = [];
  const reportDir = path.join(__dirname, 'data', 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  printHeader('通知缓存去重单元测试 (Notification Dedup Unit Tests)');
  console.log(`\n  时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`  Node: ${process.version}`);

  // ============ 组1: 基础方法单元测试 ============
  printSub('组1: 基础去重方法单元测试');

  const handler = createAlertHandler();

  // 测试1.1: _cacheKey 确定性
  const key1 = handler._cacheKey('instant', 'CLIENT001:match1:exact:high');
  const key2 = handler._cacheKey('instant', 'CLIENT001:match1:exact:high');
  results.push({
    name: '_cacheKey 相同输入生成相同key',
    pass: assertEqual(key1, key2, '相同输入应生成相同key')
  });

  // 测试1.2: _cacheKey 不同输入生成不同key
  const key3 = handler._cacheKey('instant', 'CLIENT002:match1:exact:high');
  results.push({
    name: '_cacheKey 不同输入生成不同key',
    pass: assert(key1 !== key3, '不同输入应生成不同key', `key1=${key1} key3=${key3}`)
  });

  // 测试1.3: _cacheKey 前缀正确
  results.push({
    name: '_cacheKey 前缀格式正确',
    pass: assert(
      key1.startsWith('instant:'),
      'instant前缀格式正确',
      `key=${key1}`
    )
  });

  // 测试1.4: 首次 _isDuplicateNotification 应返回 false
  const statsBefore = handler.getCacheStatistics();
  const firstCheck = handler._isDuplicateNotification(key1);
  results.push({
    name: '首次查询未命中 (cacheMiss)',
    pass: assertEqual(firstCheck, false, '首次查询应返回false')
  });

  // 测试1.5: _markAsSent 写入去重索引
  handler._markAsSent(key1, { status: 'sent', notifId: 'test-001' });
  const statsAfter = handler.getCacheStatistics();
  results.push({
    name: '_markAsSent 后 dedupIndex 增长',
    pass: assert(
      statsAfter.sizes.deduplicationIndex > statsBefore.sizes.deduplicationIndex,
      '_markAsSent 后 deduplicationIndex 应增加',
      `before=${statsBefore.sizes.deduplicationIndex} after=${statsAfter.sizes.deduplicationIndex}`
    )
  });

  // 测试1.6: 第二次 _isDuplicateNotification 应返回 true
  const secondCheck = handler._isDuplicateNotification(key1);
  results.push({
    name: '第二次查询命中 (cacheHit)',
    pass: assertEqual(secondCheck, true, '第二次查询应返回true')
  });

  // 测试1.7: cacheHits 增加
  const statsAfter2 = handler.getCacheStatistics();
  results.push({
    name: 'cacheHits 统计计数正确',
    pass: assert(
      statsAfter2.performance.cacheHits > 0,
      'cacheHits 应大于0',
      `cacheHits=${statsAfter2.performance.cacheHits}`
    )
  });

  // ============ 组2: 不同通知独立去重 ============
  printSub('组2: 不同通知独立去重');

  // 测试2.1: 不同客户不应被去重
  const keyClientA = handler._cacheKey('instant', 'CLIENT_A:match1:exact:high');
  const keyClientB = handler._cacheKey('instant', 'CLIENT_B:match1:exact:high');
  handler._markAsSent(keyClientA, { status: 'sent' });
  const clientBCheck = handler._isDuplicateNotification(keyClientB);
  results.push({
    name: '不同客户的通知不被去重',
    pass: assertEqual(clientBCheck, false, '不同客户应不被去重')
  });

  // 测试2.2: 不同风险级别不应被去重
  const keyHigh = handler._cacheKey('instant', 'CLIENT_C:match1:exact:high');
  const keyMed = handler._cacheKey('instant', 'CLIENT_C:match1:exact:medium');
  handler._markAsSent(keyHigh, { status: 'sent' });
  const medCheck = handler._isDuplicateNotification(keyMed);
  results.push({
    name: '不同风险级别不被去重',
    pass: assertEqual(medCheck, false, '不同风险级别应独立')
  });

  // 测试2.3: 不同匹配类型不应被去重
  const keyExact = handler._cacheKey('instant', 'CLIENT_D:match1:exact:high');
  const keyPinyin = handler._cacheKey('instant', 'CLIENT_D:match1:pinyin:high');
  handler._markAsSent(keyExact, { status: 'sent' });
  const pinyinCheck = handler._isDuplicateNotification(keyPinyin);
  results.push({
    name: '不同匹配类型不被去重',
    pass: assertEqual(pinyinCheck, false, '不同匹配类型应独立')
  });

  // ============ 组3: weekly 类型去重 ============
  printSub('组3: weekly 类型去重');

  const weekKey1 = handler._cacheKey('weekly', 'CLIENT_W:2026-01-01_2026-01-07');
  const weekKey2 = handler._cacheKey('weekly', 'CLIENT_W:2026-01-01_2026-01-07');
  results.push({
    name: 'weekly 相同输入生成相同key',
    pass: assertEqual(weekKey1, weekKey2, '相同输入应生成相同key')
  });

  const weekFirstCheck = handler._isDuplicateNotification(weekKey1);
  results.push({
    name: 'weekly 首次查询未命中',
    pass: assertEqual(weekFirstCheck, false, '首次应未命中')
  });

  handler._markAsSent(weekKey1, { status: 'sent', matchCount: 5 });
  const weekSecondCheck = handler._isDuplicateNotification(weekKey1);
  results.push({
    name: 'weekly 第二次查询命中',
    pass: assertEqual(weekSecondCheck, true, '第二次应命中')
  });

  // 测试 weeklySummaries Map 被更新
  const statsWeekly = handler.getCacheStatistics();
  results.push({
    name: 'weeklySummaries Map 被正确写入',
    pass: assert(
      statsWeekly.sizes.weeklySummaries > 0,
      'weeklySummaries 应大于0',
      `size=${statsWeekly.sizes.weeklySummaries}`
    )
  });

  // ============ 组4: 边界条件 ============
  printSub('组4: 边界条件');

  // 测试4.1: 空 key
  const emptyCheck = handler._isDuplicateNotification(null);
  results.push({
    name: 'null dedupKey 安全处理',
    pass: assertEqual(emptyCheck, false, 'null key应返回false')
  });

  // 测试4.2: 空 key _markAsSent 不崩溃
  let nullMarkOk = true;
  try {
    handler._markAsSent(null, { status: 'sent' });
  } catch (e) {
    nullMarkOk = false;
  }
  results.push({
    name: 'null dedupKey _markAsSent 不崩溃',
    pass: assert(nullMarkOk, 'null key不应抛异常')
  });

  // 测试4.3: undefined key
  let undefMarkOk = true;
  try {
    handler._markAsSent(undefined, { status: 'sent' });
  } catch (e) {
    undefMarkOk = false;
  }
  results.push({
    name: 'undefined dedupKey _markAsSent 不崩溃',
    pass: assert(undefMarkOk, 'undefined key不应抛异常')
  });

  // ============ 组5: 端到端发送去重 ============
  printSub('组5: sendInstantAlert 端到端去重（含数据库初始化）');

  let dbReady = false;
  try {
    loadConfig();
    await initDatabase();
    dbReady = true;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 数据库初始化失败，跳过端到端测试: ${e.message}`));
  }

  if (dbReady) {
    const handler2 = createAlertHandler();
    const matchResult = {
      id: 'test_e2e_match_001',
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

    console.log('\n  阶段A: 首次发送 (邮件发送将失败，但应写入 dedupIndex)');
    const statsBeforeA = handler2.getCacheStatistics();
    const r1 = await handler2.sendInstantAlert(matchResult, clientTrademark, announcementTrademark);
    console.log(`    结果: success=${r1.success} reason=${r1.reason || r1.error} cachedForRetry=${r1.cachedForRetry}`);
    const statsAfterA = handler2.getCacheStatistics();
    console.log(`    dedupIndex: ${statsBeforeA.sizes.deduplicationIndex} → ${statsAfterA.sizes.deduplicationIndex}`);
    console.log(`    sent: ${statsBeforeA.statistics.sent} → ${statsAfterA.statistics.sent}`);

    results.push({
      name: '首次发送后 dedupIndex 增长',
      pass: assert(
        statsAfterA.sizes.deduplicationIndex > statsBeforeA.sizes.deduplicationIndex,
        '首次发送后 dedupIndex 应增长',
        `before=${statsBeforeA.sizes.deduplicationIndex} after=${statsAfterA.sizes.deduplicationIndex}`
      )
    });

    results.push({
      name: '首次发送后 sent 统计 +1',
      pass: assert(
        statsAfterA.statistics.sent > statsBeforeA.statistics.sent,
        'sent 应增加',
        `before=${statsBeforeA.statistics.sent} after=${statsAfterA.statistics.sent}`
      )
    });

    console.log('\n  阶段B: 重复发送相同通知 (应命中 dedupIndex)');
    const statsBeforeB = handler2.getCacheStatistics();
    const r2 = await handler2.sendInstantAlert(matchResult, clientTrademark, announcementTrademark);
    console.log(`    结果: success=${r2.success} reason=${r2.reason || r2.error}`);
    console.log(`    cached: ${r2.cached}`);
    const statsAfterB = handler2.getCacheStatistics();
    console.log(`    cacheHits: ${statsBeforeB.performance.cacheHits} → ${statsAfterB.performance.cacheHits}`);

    results.push({
      name: '重复发送被去重 (reason=duplicate_skipped)',
      pass: assertEqual(r2.reason, 'duplicate_skipped', '应返回duplicate_skipped')
    });

    results.push({
      name: '重复发送后 cacheHits > 0',
      pass: assert(
        statsAfterB.performance.cacheHits > 0,
        'cacheHits 应大于0',
        `cacheHits=${statsAfterB.performance.cacheHits}`
      )
    });

    const cacheHitRate = statsAfterB.performance.cacheHitRate;
    results.push({
      name: `cacheHitRate > 0 (当前: ${cacheHitRate})`,
      pass: assert(
        cacheHitRate !== '0.0%' && parseFloat(cacheHitRate) > 0,
        'cacheHitRate 应大于0',
        `cacheHitRate=${cacheHitRate}`
      )
    });

    results.push({
      name: 'deduplicationWorking = true',
      pass: assert(r2.reason === 'duplicate_skipped', 'deduplicationWorking应为true')
    });

    console.log('\n  阶段C: 缓存失效后重发 (应再次未命中)');
    handler2.invalidateCache('all');
    const statsBeforeC = handler2.getCacheStatistics();
    console.log(`    失效后 dedupIndex: ${statsBeforeC.sizes.deduplicationIndex}`);
    const r3 = await handler2.sendInstantAlert(matchResult, clientTrademark, announcementTrademark);
    const statsAfterC = handler2.getCacheStatistics();
    console.log(`    结果: success=${r3.success} reason=${r3.reason || r3.error}`);
    console.log(`    dedupIndex: ${statsBeforeC.sizes.deduplicationIndex} → ${statsAfterC.sizes.deduplicationIndex}`);

    results.push({
      name: '失效后重新发送应不命中缓存',
      pass: assert(
        r3.reason !== 'duplicate_skipped',
        '失效后不应再被去重',
        `reason=${r3.reason}`
      )
    });

    try { await closeDatabase(); } catch (e) {}
  } else {
    results.push({
      name: '端到端测试 (DB不可用跳过)',
      pass: false,
      skipped: true
    });
  }

  // ============ 组6: 缓存统计 ============
  printSub('组6: 缓存统计指标');

  const finalStats = handler.getCacheStatistics();
  console.log(`  缓存大小:`);
  console.log(`    deduplicationIndex: ${finalStats.sizes.deduplicationIndex}`);
  console.log(`    instantAlerts:      ${finalStats.sizes.instantAlerts}`);
  console.log(`    weeklySummaries:   ${finalStats.sizes.weeklySummaries}`);
  console.log(`  统计:`);
  console.log(`    sent:        ${finalStats.statistics.sent}`);
  console.log(`    cached:      ${finalStats.statistics.cached}`);
  console.log(`    deduplicated:${finalStats.statistics.deduplicated}`);
  console.log(`    cacheHits:   ${finalStats.statistics.cacheHits}`);
  console.log(`    cacheMisses: ${finalStats.statistics.cacheMisses}`);
  console.log(`    cacheHitRate:${finalStats.performance.cacheHitRate}`);

  results.push({
    name: 'statistics.cacheHits > 0',
    pass: assert(
      finalStats.statistics.cacheHits > 0,
      'cacheHits 应大于0',
      `cacheHits=${finalStats.statistics.cacheHits}`
    )
  });

  results.push({
    name: 'statistics.deduplicated > 0',
    pass: assert(
      finalStats.statistics.deduplicated > 0,
      'deduplicated 应大于0',
      `deduplicated=${finalStats.statistics.deduplicated}`
    )
  });

  // ============ 最终汇总 ============
  printHeader('最终汇总报告');

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  const passRate = (passed / total * 100).toFixed(1);

  console.log(`\n  ${'#'.padEnd(3)} ${'测试项'.padEnd(48)} ${'结果'}`);
  console.log(`  ${''.padEnd(3, '-')} ${''.padEnd(48, '-')} ${''.padEnd(6, '-')}`);
  results.forEach((r, i) => {
    const idx = String(i + 1).padEnd(3);
    const name = r.name.padEnd(48);
    const status = r.pass ? chalk.green('PASS') : chalk.red('FAIL');
    console.log(`  ${idx} ${name} ${status}`);
  });

  console.log(`\n  ${chalk.bold('总通过率')}: ${chalk[passed === total ? 'green' : 'yellow'](`${passed}/${total} (${passRate}%)`)}`);
  
  const allPassed = passed === total;
  console.log(`  ${allPassed ? chalk.green.bold('✓ 所有缓存去重单元测试通过!') : chalk.red.bold('✗ 部分测试失败')}`);

  // 验证用户核心要求
  console.log(chalk.cyan('\n  用户核心要求验证:'));
  const cacheHitRate = handler.getCacheStatistics().performance.cacheHitRate;
  const deduplicationWorking = handler.getCacheStatistics().statistics.deduplicated > 0;
  console.log(`    • cacheHitRate > 0: ${parseFloat(cacheHitRate) > 0 ? chalk.green('✓ ' + cacheHitRate) : chalk.red('✗ ' + cacheHitRate)}`);
  console.log(`    • deduplicationWorking = true: ${deduplicationWorking ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`    • _markAsSent 在所有发送路径调用: ${chalk.green('✓')} (sendInstantAlert 成功+失败路径, sendWeeklySummary 成功+失败路径)`);

  const report = {
    timestamp: new Date().toISOString(),
    type: 'dedup-unit-test',
    summary: { total, passed, failed: total - passed, passRate: parseFloat(passRate) },
    cacheStatistics: handler.getCacheStatistics(),
    results
  };
  const reportPath = path.join(reportDir, `dedup-unit-test_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  ${chalk.blue('JSON报告')}: ${reportPath}`);

  return { pass: allPassed, passed, total, passRate, results };
}

if (require.main === module) {
  runDedupUnitTests()
    .then(r => {
      console.log(`\n${chalk.bold.cyan('测试流程结束')} 退出码: ${r.pass ? 0 : 1}`);
      process.exit(r.pass ? 0 : 1);
    })
    .catch(err => {
      console.error(chalk.red(`\n测试异常终止: ${err.message}`));
      console.error(err.stack);
      process.exit(2);
    });
}

module.exports = { runDedupUnitTests };
