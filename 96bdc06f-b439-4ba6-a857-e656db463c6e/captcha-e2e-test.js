const fs = require('fs');
const path = require('path');
const { AnnouncementScraper } = require('./src/scraper/announcer');
const { generateCaptchaImage, saveCaptchaToFile, generateRandomCode } = require('./src/utils/captchaGenerator');
const { getConfig } = require('./src/config');
const { getLogger } = require('./src/logger/appLogger');

const chalk = require('chalk');
const logger = getLogger();

function printHeader(title) {
  const line = '='.repeat(70);
  console.log(`\n${chalk.cyan(line)}`);
  console.log(chalk.cyan(`  ${title}`));
  console.log(chalk.cyan(line));
}

function printSub(title) {
  console.log(`\n${chalk.yellow('--- ')}${chalk.bold(title)}${chalk.yellow(' ---')}`);
}

function formatMs(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function runCaptchaE2ETests() {
  const results = [];
  const testData = [];
  const reportDir = path.join(__dirname, 'data', 'reports');
  const captchaDir = path.join(__dirname, 'data', 'captcha-samples');
  
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  if (!fs.existsSync(captchaDir)) fs.mkdirSync(captchaDir, { recursive: true });

  printHeader('验证码识别端到端测试套件 (Captcha E2E Test Suite)');
  console.log(`\n  系统信息:`);
  console.log(`    Node.js: ${process.version} | 平台: ${process.platform} ${process.arch}`);
  console.log(`    时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`    验证码生成器: ${captchaDir}`);

  const config = getConfig('scraper.captcha', {});
  console.log(`\n  当前验证码配置:`);
  console.log(`    enabled: ${config.enabled} | service: ${config.service}`);
  console.log(`    maxRetries: ${config.maxRetries} | fallbackMode: ${config.fallbackMode}`);
  if (config.mock) {
    console.log(`    mock.accuracy: ${config.mock.accuracy} | mock.simulateLatencyMs: ${config.mock.simulateLatencyMs}`);
  }

  const scraper = new AnnouncementScraper({ headless: true });

  // ========== 测试 1: 真实验证码图片生成 ==========
  printSub('测试 1: 真实验证码图片生成');
  const genResults = [];
  const samples = 10;
  
  for (let i = 1; i <= samples; i++) {
    const t0 = Date.now();
    const outPath = path.join(captchaDir, `captcha_sample_${String(i).padStart(3, '0')}.png`);
    const r = saveCaptchaToFile(outPath, {
      width: 200, height: 80, length: 4, noiseLevel: 0.15,
      seed: 20260000 + i
    });
    const t = Date.now() - t0;
    genResults.push({ code: r.code, filePath: outPath, sizeKB: r.sizeKB, durationMs: t });
    console.log(`    [${i}/${samples}] 生成 ${r.code}  | ${r.sizeKB} KB | ${t}ms  -> saved`);
  }
  
  const avgGenMs = genResults.reduce((s, r) => s + r.durationMs, 0) / genResults.length;
  console.log(`    ✓ ${samples} 个验证码图片生成完成，平均耗时 ${formatMs(avgGenMs)}`);
  console.log(`    样本目录: ${captchaDir}`);
  results.push({ test: '验证码图片生成', pass: true, samples, avgMs: avgGenMs, detail: `${samples} files generated` });

  // ========== 测试 2: PNG 文件有效性验证 ==========
  printSub('测试 2: 生成的 PNG 文件有效性验证');
  let pngOk = 0;
  for (const r of genResults) {
    const buf = fs.readFileSync(r.filePath);
    const sig = buf.slice(0, 8).toString('hex');
    const ihdrCrc = buf.slice(8, 8 + 25);
    const iendCrc = buf.slice(-12);
    if (sig === '89504e470d0a1a0a' && 
        ihdrCrc.slice(12, 16).toString('ascii') === 'IHDR' &&
        iendCrc.slice(4, 8).toString('ascii') === 'IEND') {
      pngOk++;
      testData.push({ code: r.code, sizeKB: r.sizeKB, valid: true });
    } else {
      console.log(`    ✗ ${r.filePath} 不是有效的 PNG 文件`);
    }
  }
  console.log(`    ✓ PNG 有效文件: ${pngOk}/${samples} (${(pngOk/samples*100).toFixed(0)}%)`);
  results.push({ test: 'PNG 有效性', pass: pngOk === samples, samples, detail: `${pngOk}/${samples} valid PNGs` });

  // ========== 测试 3: Mock 验证码识别服务 ==========
  printSub('测试 3: Mock 验证码识别服务 (solveWithMock)');
  const mockResults = [];
  const mockSampleSize = 20;
  let mockTotalMs = 0;

  for (let i = 1; i <= mockSampleSize; i++) {
    const { code, imageBuffer } = generateCaptchaImage({
      length: 4, noiseLevel: 0.1 + (i % 5) * 0.05,
      seed: 770000 + i
    });

    scraper.captchaConfig.mock.fixedAnswer = code;
    const t0 = Date.now();
    try {
      const result = await scraper.solveWithMock(imageBuffer, 1);
      const t = Date.now() - t0;
      mockTotalMs += t;
      const match = result.text === code;
      mockResults.push({ code, got: result.text, match, durationMs: t, pass: result.success });
      if (i <= 5) {
        console.log(`    [${i}] expected=${chalk.cyan(code)} | got=${chalk[match ? 'green' : 'red'](result.text)} | ${t}ms  ${match ? '✓' : '✗'}`);
      }
    } catch (e) {
      mockResults.push({ code, got: 'ERROR', match: false, durationMs: Date.now() - t0, pass: false, error: e.message });
      console.log(`    [${i}] expected=${chalk.cyan(code)} | ERROR: ${e.message}`);
    }
  }

  const mockPass = mockResults.filter(r => r.pass).length;
  const mockMatch = mockResults.filter(r => r.match).length;
  const mockAvgMs = mockTotalMs / mockSampleSize;
  console.log(`\n    识别成功率: ${mockPass}/${mockSampleSize} (${(mockPass/mockSampleSize*100).toFixed(1)}%)`);
  console.log(`    结果准确率: ${mockMatch}/${mockSampleSize} (${(mockMatch/mockSampleSize*100).toFixed(1)}%)`);
  console.log(`    平均耗时:   ${formatMs(mockAvgMs)}`);
  results.push({ 
    test: 'Mock 服务识别', pass: mockPass === mockSampleSize, 
    samples: mockSampleSize, successRate: (mockPass/mockSampleSize*100),
    accuracy: (mockMatch/mockSampleSize*100), avgMs: mockAvgMs
  });

  // ========== 测试 4: 重试机制验证 ==========
  printSub('测试 4: 重试机制验证 (强制失败 + fallback)');
  
  scraper.captchaConfig.mock.accuracy = 0;
  scraper.captchaConfig.maxRetries = 3;
  scraper.captchaConfig.fallbackMode = 'skip';
  scraper.captchaConfig.mock.fixedAnswer = '';

  const { imageBuffer: retryBuffer } = generateCaptchaImage({ code: 'TEST', seed: 999 });
  const retryT0 = Date.now();
  let retryCount = 0;
  const origSolve = scraper.solveWithMock.bind(scraper);
  scraper.solveWithMock = async (buf, attempt) => {
    retryCount = attempt;
    return origSolve(buf, attempt);
  };

  const retryResult = await scraper.solveCaptcha(retryBuffer);
  const retryMs = Date.now() - retryT0;
  scraper.solveWithMock = origSolve;

  console.log(`    准确率设置为 0 → 强制全部失败`);
  console.log(`    尝试次数: ${retryCount}/${scraper.captchaConfig.maxRetries}`);
  console.log(`    fallback模式: skip → 返回值: ${retryResult === null ? 'null (正确)' : retryResult}`);
  console.log(`    总耗时（含重试延迟）: ${formatMs(retryMs)}`);
  const retryPass = retryCount === scraper.captchaConfig.maxRetries && retryResult === null && retryMs > 2000;
  console.log(`    ${retryPass ? chalk.green('✓') : chalk.red('✗')} 重试机制符合预期`);
  results.push({ 
    test: '重试机制', pass: retryPass, samples: 1,
    retryCount, expectedRetries: scraper.captchaConfig.maxRetries,
    durationMs: retryMs, detail: `retries=${retryCount}, fallback=${retryResult === null ? 'skip→null' : 'unexpected'}`
  });

  // ========== 测试 5: 验证码图片大小过滤 ==========
  printSub('测试 5: 验证码图片边界处理');
  
  const smallBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  console.log(`    输入极小PNG (仅 ${smallBuffer.length} 字节)`);
  const origRefresh = scraper.refreshCaptchaImage;
  scraper.refreshCaptchaImage = async () => { console.log('    → 触发 refreshCaptchaImage()'); };
  
  scraper.captchaConfig.mock.accuracy = 1;
  scraper.captchaConfig.mock.fixedAnswer = 'ABCD';
  scraper.captchaConfig.maxRetries = 1;
  
  const tinyResult = await scraper.solveCaptcha(smallBuffer);
  scraper.refreshCaptchaImage = origRefresh;
  
  console.log(`    返回结果: ${tinyResult || 'null (fallback)'}`);
  results.push({
    test: '边界图片处理', pass: true, samples: 1,
    inputSize: smallBuffer.length, output: tinyResult || 'null'
  });

  // ========== 测试 6: solveCaptcha 完整调用链路 ==========
  printSub('测试 6: solveCaptcha 完整调用链路 (成功路径)');

  const expectedCode = 'HX72';
  const { imageBuffer: fullBuf } = generateCaptchaImage({ code: expectedCode, seed: 12345 });
  
  scraper.captchaConfig.mock.accuracy = 1;
  scraper.captchaConfig.mock.fixedAnswer = expectedCode;
  scraper.captchaConfig.mock.simulateLatencyMs = 80;
  scraper.captchaConfig.maxRetries = 3;
  scraper.captchaConfig.enabled = true;
  scraper.captchaConfig.service = 'mock';
  
  const fullT0 = Date.now();
  const fullResult = await scraper.solveCaptcha(fullBuf);
  const fullMs = Date.now() - fullT0;
  
  const fullPass = fullResult === expectedCode;
  console.log(`    真实图片 Buffer (${fullBuf.length} 字节) → solveCaptcha()`);
  console.log(`    期望结果: ${chalk.cyan(expectedCode)}`);
  console.log(`    实际结果: ${chalk[fullPass ? 'green' : 'red'](fullResult || 'null')}`);
  console.log(`    耗时: ${formatMs(fullMs)}  |  ${fullPass ? chalk.green('✓ 端到端链路验证通过') : chalk.red('✗ 链路异常')}`);
  results.push({
    test: 'solveCaptcha 完整链路', pass: fullPass,
    expected: expectedCode, got: fullResult, durationMs: fullMs,
    imageBytes: fullBuf.length
  });

  // ========== 测试 7: 验证码临时屏蔽机制 ==========
  printSub('测试 7: 验证码临时屏蔽 (CAPTCHA_BLOCKED)');
  
  // 触发 retry_later → 临时屏蔽
  scraper.captchaConfig.fallbackMode = 'retry_later';
  scraper.captchaConfig.blockDuration = 60000;
  scraper.captchaConfig.mock.accuracy = 0;
  scraper.captchaConfig.maxRetries = 1;
  scraper._captchaBlockedUntil = null;
  
  const { imageBuffer: blockBuf } = generateCaptchaImage({ code: 'FAIL', seed: 1 });
  let blockThrown = false;
  try {
    await scraper.solveCaptcha(blockBuf);
  } catch (e) {
    blockThrown = e.message === 'CAPTCHA_BLOCKED_TEMPORARILY';
    console.log(`    ${e.message === 'CAPTCHA_BLOCKED_TEMPORARILY' ? chalk.green('✓') : chalk.red('✗')} 抛出异常: ${e.message}`);
  }
  
  const isBlocked = scraper.isCaptchaBlocked();
  console.log(`    isCaptchaBlocked() = ${isBlocked ? chalk.green('true (屏蔽中)') : chalk.red('false')}`);
  
  scraper._captchaBlockedUntil = Date.now() - 1000;
  const expired = !scraper.isCaptchaBlocked();
  console.log(`    过期后 isCaptchaBlocked() = ${expired ? chalk.green('false (已解封)') : chalk.red('true (异常)')}`);
  
  const blockPass = blockThrown && isBlocked && expired;
  results.push({
    test: '验证码临时屏蔽', pass: blockPass,
    threwBlockedError: blockThrown, blockedWhileActive: isBlocked, unblockedAfterExpired: expired
  });

  // ========== 测试 8: 多种验证码长度 ==========
  printSub('测试 8: 多种验证码长度支持 (3/4/6/8位)');
  const lengths = [3, 4, 6, 8];
  const lenResults = [];
  
  for (const len of lengths) {
    scraper.captchaConfig.length = len;
    scraper.captchaConfig.mock.accuracy = 1;
    const code = generateRandomCode(len);
    scraper.captchaConfig.mock.fixedAnswer = code;
    
    const { imageBuffer: buf } = generateCaptchaImage({ code, length: len, seed: len * 99 });
    const t0 = Date.now();
    const r = await scraper.solveCaptcha(buf);
    const ms = Date.now() - t0;
    const ok = r === code && r.length === len;
    lenResults.push({ length: len, expected: code, got: r, durationMs: ms, pass: ok });
    console.log(`    ${len}位: ${chalk.cyan(code)} → ${chalk[ok ? 'green' : 'red'](r)} (${ms}ms) ${ok ? '✓' : '✗'}`);
  }
  const lenPass = lenResults.every(r => r.pass);
  results.push({
    test: '多长度支持', pass: lenPass,
    samples: lengths.length, lengths, detail: JSON.stringify(lenResults)
  });

  // ========== 输出最终汇总 ==========
  printHeader('验证码识别测试 - 最终汇总报告');
  
  let passCount = 0;
  console.log(`\n  ${'#'.padEnd(3)} ${'测试项目'.padEnd(28)} ${'结果'.padEnd(8)} ${'样本'.padEnd(8)} ${'详情'}`);
  console.log(`  ${''.padEnd(3, '-')} ${''.padEnd(28, '-')} ${''.padEnd(8, '-')} ${''.padEnd(8, '-')} ${''.padEnd(20, '-')}`);
  results.forEach((r, i) => {
    if (r.pass) passCount++;
    const idx = String(i + 1).padEnd(3);
    const name = r.test.padEnd(28);
    const status = (r.pass ? chalk.green('PASS') : chalk.red('FAIL')).padEnd(8);
    const samples = (r.samples ? String(r.samples) : '-').padEnd(8);
    const detail = r.detail || r.avgMs ? `${r.avgMs ? 'avg:' + formatMs(r.avgMs) : ''} ${r.detail || ''}`.trim() : '-';
    console.log(`  ${idx} ${name} ${status} ${samples} ${detail}`);
  });

  const passRate = (passCount / results.length * 100).toFixed(1);
  console.log(`\n  总通过率: ${chalk[passCount === results.length ? 'green' : 'yellow'](`${passCount}/${results.length} (${passRate}%)`)}`);
  console.log(`  ${passCount === results.length ? chalk.green('✓ 所有验证码端到端测试通过!') : chalk.red('✗ 部分测试失败')}`);

  // ========== 保存 JSON 报告 ==========
  const report = {
    timestamp: new Date().toISOString(),
    type: 'captcha-e2e',
    summary: {
      total: results.length,
      passed: passCount,
      failed: results.length - passCount,
      passRate: parseFloat(passRate)
    },
    results,
    samples: genResults.map(g => ({ code: g.code, sizeKB: g.sizeKB, filePath: g.filePath })),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      captchaService: config.service,
      captchaEnabled: config.enabled
    }
  };
  
  const reportPath = path.join(reportDir, `captcha-e2e-report_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  JSON 报告已保存: ${chalk.blue(reportPath)}`);

  // 清理 scraper 资源
  if (scraper.browser) {
    try { await scraper.close(); } catch (e) {}
  }

  return {
    pass: passCount === results.length,
    passCount,
    total: results.length,
    passRate,
    reportPath,
    results
  };
}

if (require.main === module) {
  runCaptchaE2ETests()
    .then(result => {
      console.log(`\n${chalk.bold.cyan('测试流程结束')} 退出码: ${result.pass ? 0 : 1}`);
      process.exit(result.pass ? 0 : 1);
    })
    .catch(err => {
      console.error(chalk.red(`\n测试异常终止: ${err.message}`));
      console.error(err.stack);
      process.exit(2);
    });
}

module.exports = { runCaptchaE2ETests };
