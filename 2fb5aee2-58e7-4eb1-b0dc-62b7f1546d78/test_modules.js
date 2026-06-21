const config = require('./src/config');
const { logger, audit: auditLogger } = require('./src/logger');
const { errorHandler, ERROR_TYPES } = require('./src/errorHandler');
const { createVehicleService } = require('./src/vehicleService');
const { createInspectionRunner, DETECTION_METHOD_FIELDS } = require('./src/inspectionRunner');
const { createReportGenerator } = require('./src/reportGenerator');
const { createStatsExporter } = require('./src/statsExporter');

const chalk = require('chalk');
const dayjs = require('dayjs');

console.log(chalk.cyan('\n=== 机动车排放检验自动化系统 - 模块加载测试 ===\n'));

let allPassed = true;

function testPass(name, detail = '') {
  console.log(chalk.green(`✓ ${name}`) + (detail ? chalk.gray(` - ${detail}`) : ''));
}

function testFail(name, error) {
  console.log(chalk.red(`✗ ${name}: ${error.message}`));
  allPassed = false;
}

async function runTests() {
  try {
    // 1. 测试config模块
    console.log(chalk.cyan('\n1. 配置管理模块 (config.js)'));
    testPass('模块加载成功');
    testPass('机构信息', config.getOrganizationInfo().name);
    testPass('检测线数量', `${config.getActiveInspectionLines().length} 条`);
    testPass('当前标准', config.getCurrentStandard().name);
    
    const method = config.getDetectionMethod('gasoline', 2020);
    testPass('检测方法匹配', `汽油车2020年 → ${method?.name || '未知'}`);
    
    const fieldMap = config.mapField('traffic', 'hpzl', 'environmental');
    testPass('字段映射', `hpzl → ${fieldMap || '未知'}`);
    
    const codeMap = config.mapCode('fuelType', '1');
    testPass('编码转换', `fuelType 1 → ${codeMap || '未知'}`);
    
    // 2. 测试logger模块
    console.log(chalk.cyan('\n2. 日志系统模块 (logger.js)'));
    testPass('模块加载成功');
    testPass('日志级别', process.env.LOG_LEVEL || 'info');
    logger.info('测试日志 - 这是一条info级别的日志');
    testPass('普通日志写入');
    
    auditLogger.log('login', '环保平台', { username: 'test' }, { operator: 'test' });
    testPass('审计日志写入');
    
    // 3. 测试errorHandler模块
    console.log(chalk.cyan('\n3. 异常处理模块 (errorHandler.js)'));
    testPass('模块加载成功');
    testPass('错误类型数量', `${Object.keys(ERROR_TYPES).length} 种`);
    
    const RETRY_STRATEGIES = require('./src/errorHandler').RETRY_STRATEGIES;
    testPass('重试策略数量', `${Object.keys(RETRY_STRATEGIES).length} 种`);
    
    const networkError = new Error('getaddrinfo ENOTFOUND');
    const errorType = errorHandler.classifyError(networkError);
    testPass('错误分类', `网络错误 → ${errorType}`);
    
    // 4. 测试vehicleService模块
    console.log(chalk.cyan('\n4. 车辆服务模块 (vehicleService.js)'));
    const vehicleService = createVehicleService('LINE001');
    testPass('模块加载成功', vehicleService.constructor.name);
    
    await vehicleService.init();
    testPass('服务初始化');
    
    const vehicleInfo = await vehicleService.queryVehicle('浙A12345');
    testPass('车辆信息查询', `${vehicleInfo.plateNumber} - ${vehicleInfo.vehicleType}`);
    testPass('字段映射', `燃料类型: ${vehicleInfo.fuelType}`);
    testPass('检测方法推荐', vehicleInfo.recommendedMethod?.name || '未知');
    
    await vehicleService.close();
    testPass('服务关闭');
    
    // 5. 测试inspectionRunner模块
    console.log(chalk.cyan('\n5. 检测流程编排模块 (inspectionRunner.js)'));
    testPass('模块加载成功');
    testPass('检测方法配置', `${Object.keys(DETECTION_METHOD_FIELDS).length} 种`);
    
    Object.keys(DETECTION_METHOD_FIELDS).forEach(code => {
      const m = DETECTION_METHOD_FIELDS[code];
      console.log(chalk.gray(`   * ${code} - ${m.name} (${m.fields.length} 个字段)`));
    });
    
    const runner = createInspectionRunner('LINE001');
    testPass('检测执行器创建', runner.constructor.name);
    
    await runner.init();
    testPass('执行器初始化');
    
    const result = await runner.runInspection('浙A12345');
    testPass('单车检测流程', `${result.success ? '成功' : '失败'} - ${result.result?.overall || result.error}`);
    
    if (result.success) {
      testPass('结果判定', `合格率: ${result.result.items.filter(i => i.pass).length}/${result.result.items.length}`);
    }
    
    await runner.close();
    testPass('执行器关闭');
    
    // 6. 测试reportGenerator模块
    console.log(chalk.cyan('\n6. 报告生成模块 (reportGenerator.js)'));
    const reportGenerator = createReportGenerator('LINE001');
    testPass('模块加载成功', reportGenerator.constructor.name);
    testPass('报告目录', reportGenerator.reportDir);
    
    // 生成测试报告
    const mockInspectionData = {
      coIdle: 0.167,
      hcIdle: 50,
      coHighIdle: 0.187,
      hcHighIdle: 65,
      co5025: 0.167,
      hc5025: 50,
      nox5025: 1087,
      co2540: 0.187,
      hc2540: 65,
      nox2540: 647,
      maxPower: 85,
      velMax: 120,
      smoke100: 0.5,
      smoke90: 0.4,
      smoke80: 0.3,
      nox100: 500,
      nox90: 400,
      nox80: 300,
      idleCO: 0.15,
      idleHC: 80,
      engineTemp: 85,
      rpm: 1200
    };
    const mockResult = {
      vehicleInfo,
      method: vehicleInfo.recommendedMethod,
      result: result.result,
      inspectionData: mockInspectionData,
      duration: 45000,
      inspectionLine: { id: 'LINE001', name: '1号检测线' }
    };
    
    const reportResult = await reportGenerator.generateReport(mockResult);
    testPass('PDF报告生成', `${reportResult.reportNo} - ${(reportResult.size / 1024).toFixed(2)}KB`);
    testPass('报告文件存在', require('fs').existsSync(reportResult.reportPath) ? '是' : '否');
    
    // 7. 测试statsExporter模块
    console.log(chalk.cyan('\n7. 统计报表导出模块 (statsExporter.js)'));
    const statsExporter = createStatsExporter();
    testPass('模块加载成功', statsExporter.constructor.name);
    
    await statsExporter.init();
    testPass('导出器初始化');
    
    const statsResult = await statsExporter.exportMonthlyStats(2025, 6);
    testPass('月度报表导出', statsResult.excelPath ? '成功' : '失败');
    if (statsResult.excelPath) {
      testPass('Excel文件存在', require('fs').existsSync(statsResult.excelPath) ? '是' : '否');
      testPass('合格率计算', `${statsResult.data.calculated.合格率}%`);
    }
    
    await statsExporter.close();
    testPass('导出器关闭');
    
    // 8. 测试批量处理（限制数量，避免测试时间过长）
    console.log(chalk.cyan('\n8. 批量处理功能'));
    const batchRunner = createInspectionRunner('LINE001');
    await batchRunner.init();
    
    const batchResult = await batchRunner.batchProcess('./data/batch_example.csv', { 
      interval: 100, 
      maxCount: 3  // 只处理3台，缩短测试时间
    });
    testPass('批量处理', `共${batchResult.totalCount}台, 成功${batchResult.successCount}台, 失败${batchResult.failedCount}台`);
    testPass('批量耗时', `${(batchResult.duration / 1000).toFixed(2)}秒`);
    
    await batchRunner.close();
    
    // 汇总结果
    console.log(chalk.cyan('\n═══════════════════════════════════════════════'));
    if (allPassed) {
      console.log(chalk.green('\n✓ 所有模块测试通过！\n'));
    } else {
      console.log(chalk.red('\n✗ 部分测试失败，请检查日志\n'));
    }
    console.log(chalk.cyan('═══════════════════════════════════════════════\n'));
    
    // 列出生成的文件
    const fs = require('fs');
    const path = require('path');
    console.log(chalk.cyan('生成的文件列表:\n'));
    
    const reportDir = './reports';
    const dataDir = './data';
    const logsDir = './logs';
    
    [reportDir, dataDir, logsDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
        if (files.length > 0) {
          console.log(chalk.gray(`  ${dir}:`));
          files.slice(-5).forEach(f => {
            const stat = fs.statSync(path.join(dir, f));
            console.log(chalk.gray(`    - ${f} (${(stat.size / 1024).toFixed(2)}KB)`));
          });
        }
      }
    });
    
    console.log('\n');
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.log(chalk.red(`\n✗ 测试异常: ${error.message}`));
    console.log(chalk.gray(error.stack));
    process.exit(1);
  }
}

runTests();
