const { generateCaptchaImage, generateRandomCode, saveCaptchaToFile } = require('./src/utils/captchaGenerator');
const { AnnouncementScraper } = require('./src/scraper/announcer');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const reportDir = path.join(__dirname, 'data', 'reports');
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

console.log(chalk.cyan('======================================================================'));
console.log(chalk.cyan('  验证码链路快速验证报告 (Quick Captcha E2E Validation)'));
console.log(chalk.cyan('======================================================================\n'));

const s = new AnnouncementScraper({ headless: true });
s.captchaConfig = {
  enabled: true,
  service: 'mock',
  maxRetries: 3,
  retryDelay: 100,
  fallbackMode: 'skip',
  refreshOnRetry: false,
  caseSensitive: false,
  length: 4,
  mock: { accuracy: 1, fixedAnswer: '', simulateLatencyMs: 20 }
};

const results = [];

(async () => {
  // Test 1: 验证码图片生成
  console.log(chalk.yellow('--- [1] 验证码图片生成 ---'));
  const sampleDir = path.join(__dirname, 'data', 'captcha-samples');
  if (!fs.existsSync(sampleDir)) fs.mkdirSync(sampleDir, { recursive: true });
  
  const genResult = [];
  for (let i = 0; i < 5; i++) {
    const code = generateRandomCode(4);
    const t0 = Date.now();
    const saved = saveCaptchaToFile(path.join(sampleDir, `sample_${i+1}.png`), {
      code, width: 200, height: 80, noiseLevel: 0.15, seed: 1000 + i
    });
    const ms = Date.now() - t0;
    const buf = fs.readFileSync(saved.filePath);
    const isPng = buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
    genResult.push({ code, sizeKB: saved.sizeKB, durationMs: ms, validPng: isPng, path: saved.filePath });
    console.log(`  [${i+1}] code=${chalk.cyan(code)}  size=${saved.sizeKB}KB  genTime=${ms}ms  PNG=${isPng ? chalk.green('✓') : chalk.red('✗')}`);
  }
  results.push({
    test: '验证码图片生成+PNG有效',
    pass: genResult.every(g => g.validPng),
    samples: 5,
    detail: genResult
  });

  // Test 2: Mock 服务识别
  console.log(chalk.yellow('\n--- [2] Mock 验证码识别 ---'));
  s.captchaConfig.mock.accuracy = 1;
  s.captchaConfig.mock.simulateLatencyMs = 15;
  const idents = [];
  for (let i = 0; i < 5; i++) {
    const code = generateRandomCode(4);
    s.captchaConfig.mock.fixedAnswer = code;
    const { imageBuffer } = generateCaptchaImage({ code, seed: 2000 + i });
    const t0 = Date.now();
    const got = await s.solveCaptcha(imageBuffer);
    const ms = Date.now() - t0;
    const ok = got === code;
    idents.push({ code, got, durationMs: ms, pass: ok });
    console.log(`  [${i+1}] expected=${chalk.cyan(code)}  got=${chalk[ok ? 'green' : 'red'](got || 'null')}  time=${ms}ms  ${ok ? chalk.green('✓') : chalk.red('✗')}`);
  }
  results.push({
    test: 'Mock 验证码识别准确率',
    pass: idents.every(i => i.pass),
    samples: 5,
    detail: idents,
    accuracy: (idents.filter(i => i.pass).length / idents.length * 100).toFixed(1) + '%'
  });

  // Test 3: solveWithMock 直接调用
  console.log(chalk.yellow('\n--- [3] solveWithMock 直接调用 ---'));
  s.captchaConfig.mock.accuracy = 1;
  s.captchaConfig.mock.simulateLatencyMs = 30;
  s.captchaConfig.mock.fixedAnswer = 'HX72';
  const { imageBuffer: buf1 } = generateCaptchaImage({ code: 'HX72', seed: 3001 });
  const t0 = Date.now();
  const r1 = await s.solveWithMock(buf1, 1);
  const ms1 = Date.now() - t0;
  const ok1 = r1.success && r1.text === 'HX72';
  console.log(`  solveWithMock → text=${chalk[ok1 ? 'green' : 'red'](r1.text)} success=${r1.success} time=${ms1}ms requestId=${r1.requestId}  ${ok1 ? chalk.green('✓') : chalk.red('✗')}`);
  results.push({
    test: 'solveWithMock 直接调用',
    pass: ok1,
    samples: 1,
    detail: { text: r1.text, success: r1.success, cost: r1.cost, durationMs: ms1, requestId: r1.requestId }
  });

  // Test 4: 重试机制
  console.log(chalk.yellow('\n--- [4] 重试机制(accuracy=0, maxRetries=2) ---'));
  s.captchaConfig.mock.accuracy = 0;
  s.captchaConfig.maxRetries = 2;
  s.captchaConfig.retryDelay = 30;
  s.captchaConfig.fallbackMode = 'skip';
  let callCount = 0;
  const origMock = s.solveWithMock.bind(s);
  s.solveWithMock = async (buf, attempt) => {
    callCount = attempt;
    return origMock(buf, attempt);
  };
  const { imageBuffer: buf2 } = generateCaptchaImage({ code: 'FAIL', seed: 4001 });
  const t4 = Date.now();
  const r4 = await s.solveCaptcha(buf2);
  const ms4 = Date.now() - t4;
  s.solveWithMock = origMock;
  const ok4 = callCount === 2 && r4 === null && ms4 > 40;
  console.log(`  call attempts=${callCount} (expect=2)  fallback=${r4 === null ? chalk.green('null') : chalk.red(r4)}  totalTime=${ms4}ms  ${ok4 ? chalk.green('✓') : chalk.red('✗')}`);
  results.push({
    test: '重试机制 + fallback=skip',
    pass: ok4,
    samples: 1,
    detail: { attempts: callCount, expectedAttempts: 2, fallbackResult: r4, durationMs: ms4 }
  });

  // Test 5: 临时屏蔽机制
  console.log(chalk.yellow('\n--- [5] 验证码临时屏蔽 (CAPTCHA_BLOCKED_TEMPORARILY) ---'));
  s.captchaConfig.fallbackMode = 'retry_later';
  s.captchaConfig.blockDuration = 60000;
  s.captchaConfig.maxRetries = 1;
  s.captchaConfig.mock.accuracy = 0;
  s._captchaBlockedUntil = null;
  let blockedThrew = false;
  try {
    const { imageBuffer: buf5 } = generateCaptchaImage({ code: 'X', seed: 5001 });
    await s.solveCaptcha(buf5);
  } catch (e) {
    blockedThrew = e.message === 'CAPTCHA_BLOCKED_TEMPORARILY';
    console.log(`  异常抛出: ${e.message}  ${blockedThrew ? chalk.green('✓') : chalk.red('✗')}`);
  }
  const blockedNow = s.isCaptchaBlocked();
  console.log(`  isCaptchaBlocked() = ${blockedNow ? chalk.green('true') : chalk.red('false')}  ${blockedNow ? chalk.green('✓') : chalk.red('✗')}`);
  s._captchaBlockedUntil = Date.now() - 100;
  const blockedExpired = !s.isCaptchaBlocked();
  console.log(`  过期后 isCaptchaBlocked() = ${!blockedExpired ? chalk.red('true') : chalk.green('false')}  ${blockedExpired ? chalk.green('✓') : chalk.red('✗')}`);
  results.push({
    test: '验证码临时屏蔽(retry_later)',
    pass: blockedThrew && blockedNow && blockedExpired,
    samples: 1,
    detail: { threwBlockedError: blockedThrew, blockedActive: blockedNow, unblockAfterExpire: blockedExpired }
  });

  // Test 6: save_for_later fallback
  console.log(chalk.yellow('\n--- [6] save_for_later 降级策略 ---'));
  s.captchaConfig.fallbackMode = 'save_for_later';
  s.captchaConfig.maxRetries = 1;
  s.captchaConfig.mock.accuracy = 0;
  const before = fs.existsSync('./data/cache/captchas') ? fs.readdirSync('./data/cache/captchas').length : 0;
  const { imageBuffer: buf6 } = generateCaptchaImage({ code: 'SAVE', seed: 6001 });
  const r6 = await s.solveCaptcha(buf6);
  const after = fs.existsSync('./data/cache/captchas') ? fs.readdirSync('./data/cache/captchas').length : 0;
  const saved = after > before;
  console.log(`  识别失败后 fallback=save_for_later  → 结果=${r6 === null ? chalk.green('null') : chalk.red(r6)}  写入文件数=${after - before}  ${saved ? chalk.green('✓') : chalk.red('✗')}`);
  results.push({
    test: 'save_for_later 降级',
    pass: saved && r6 === null,
    samples: 1,
    detail: { filesBefore: before, filesAfter: after, fallbackResult: r6 }
  });

  // Test 7: 多长度支持 (3/4/6/8)
  console.log(chalk.yellow('\n--- [7] 多长度支持 (3/4/6/8位) ---'));
  s.captchaConfig.mock.accuracy = 1;
  s.captchaConfig.fallbackMode = 'skip';
  s.captchaConfig.maxRetries = 1;
  const lens = [3, 4, 6, 8];
  const lenRes = [];
  for (const len of lens) {
    s.captchaConfig.length = len;
    const code = generateRandomCode(len);
    s.captchaConfig.mock.fixedAnswer = code;
    const { imageBuffer: buf } = generateCaptchaImage({ code, length: len, seed: len * 100 });
    const r = await s.solveCaptcha(buf);
    const ok = r && r.length === len && r === code;
    lenRes.push({ length: len, code, got: r, pass: ok });
    console.log(`  ${len}位: expected=${chalk.cyan(code)}  got=${chalk[ok ? 'green' : 'red'](r || 'null')}  ${ok ? chalk.green('✓') : chalk.red('✗')}`);
  }
  results.push({
    test: '多长度支持(3/4/6/8)',
    pass: lenRes.every(r => r.pass),
    samples: 4,
    detail: lenRes
  });

  // Summary
  console.log(chalk.cyan('\n======================================================================'));
  console.log(chalk.cyan('  最终汇总'));
  console.log(chalk.cyan('======================================================================'));

  const totalPass = results.filter(r => r.pass).length;
  const total = results.length;
  const passRate = (totalPass / total * 100).toFixed(1);

  console.log(`\n  ${'#'.padEnd(3)} ${'测试项'.padEnd(32)} ${'结果'.padEnd(8)} ${'样'.padEnd(4)} ${'通过率'}`);
  console.log(`  ${''.padEnd(3, '-')} ${''.padEnd(32, '-')} ${''.padEnd(8, '-')} ${''.padEnd(4, '-')} ${''.padEnd(8, '-')}`);
  results.forEach((r, i) => {
    const idx = String(i + 1).padEnd(3);
    const name = r.test.padEnd(32);
    const res = (r.pass ? chalk.green('PASS') : chalk.red('FAIL')).padEnd(8);
    const smp = String(r.samples).padEnd(4);
    const acc = r.accuracy || (r.pass ? '100.0%' : '0.0%');
    console.log(`  ${idx} ${name} ${res} ${smp} ${acc}`);
  });

  console.log(`\n  ${chalk.bold('总通过率')}: ${chalk[totalPass === total ? 'green' : 'yellow'](totalPass + '/' + total + ' (' + passRate + '%)')}`);
  console.log(`  ${totalPass === total ? chalk.green.bold('✓ 所有验证码链路验证通过!') : chalk.red.bold('✗ 部分测试失败')}`);

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    type: 'captcha-quick-validation',
    summary: { total: results.length, passed: totalPass, failed: total - totalPass, passRate: parseFloat(passRate) },
    results,
    environment: { nodeVersion: process.version, platform: process.platform, captchaService: 'mock' }
  };
  const rp = path.join(reportDir, `captcha-quick-report_${Date.now()}.json`);
  fs.writeFileSync(rp, JSON.stringify(report, null, 2));
  console.log(`\n  JSON 报告: ${chalk.blue(rp)}`);
  console.log(`  验证码样本: ${chalk.blue(sampleDir)}`);

  process.exit(totalPass === total ? 0 : 1);
})().catch(e => {
  console.error(chalk.red('测试异常终止: ' + e.message));
  console.error(e.stack);
  process.exit(2);
});
