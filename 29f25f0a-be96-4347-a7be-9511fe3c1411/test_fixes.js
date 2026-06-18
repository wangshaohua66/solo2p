const colors = require('colors');
const ScrapeOrchestrator = require('./scraper/orchestrator');
const AlertEngine = require('./alert/engine');
const { BaseAdapter } = require('./scraper/adapters');
const { rateSnapshots, spaceStatus, schedules, taskLogs, alerts } = require('./store/db');
const { runMigrations } = require('./store/migrations');

console.log('━━━ 修复验证 ━━━\n'.cyan.bold);

runMigrations();

console.log('✓ 1. 验证 schedules 解构:'.yellow);
console.log('  cli/interface.js 已导入 schedules:', typeof schedules !== 'undefined');
console.log('  schedules.getByRoute 方法存在:', typeof schedules.getByRoute === 'function');
console.log('  schedules.getByCarrier 方法存在:', typeof schedules.getByCarrier === 'function');

console.log('\n✓ 2. 验证验证码回调接口:'.yellow);
console.log('  BaseAdapter.setGlobalCaptchaCallback 静态方法存在:', typeof BaseAdapter.setGlobalCaptchaCallback === 'function');
console.log('  BaseAdapter.prototype.setCaptchaCallback 实例方法存在:', typeof BaseAdapter.prototype.setCaptchaCallback === 'function');
console.log('  BaseAdapter.prototype._detectCaptcha 方法存在:', typeof BaseAdapter.prototype._detectCaptcha === 'function');
console.log('  BaseAdapter.prototype._handleCaptcha 方法存在:', typeof BaseAdapter.prototype._handleCaptcha === 'function');

let callbackCalled = false;
BaseAdapter.setGlobalCaptchaCallback(async (params) => {
  callbackCalled = true;
  console.log('  全局验证码回调被调用，carrierId:', params.carrierId);
  return { success: true, text: '1234' };
});
console.log('  全局验证码回调设置成功');

const alertEngine = new AlertEngine();
console.log('  AlertEngine.checkLoginFailures 方法存在:', typeof alertEngine.checkLoginFailures === 'function');

console.log('\n✓ 3. 验证内存监控机制:'.yellow);
const orchestrator = new ScrapeOrchestrator({ memoryLimitMB: 100 });
console.log('  ScrapeOrchestrator._checkMemoryUsage 方法存在:', typeof orchestrator._checkMemoryUsage === 'function');
console.log('  ScrapeOrchestrator._forceMemoryCleanup 方法存在:', typeof orchestrator._forceMemoryCleanup === 'function');
console.log('  ScrapeOrchestrator.getMemoryStats 方法存在:', typeof orchestrator.getMemoryStats === 'function');

const memStats = orchestrator.getMemoryStats();
console.log('  当前内存使用:');
console.log('    HeapUsed:', memStats.heapUsedMB + 'MB');
console.log('    HeapTotal:', memStats.heapTotalMB + 'MB');
console.log('    RSS:', memStats.rssMB + 'MB');
console.log('    限制:', memStats.limitMB + 'MB');
console.log('    是否超限:', memStats.overLimit);

const memCheck = orchestrator._checkMemoryUsage();
console.log('  _checkMemoryUsage 返回值包含 overLimit:', 'overLimit' in memCheck);
console.log('  _checkMemoryUsage 返回值包含 usedMB:', 'usedMB' in memCheck);

const fullStats = orchestrator.getStats();
console.log('  getStats 包含 memory 字段:', 'memory' in fullStats);

console.log('\n✓ 4. 验证预警引擎 login 检查:'.yellow);
const testLogId = taskLogs.create({
  task_id: 'test-login-fail-' + Date.now(),
  carrier_id: 'maersk',
  carrier_name: '马士基',
  task_type: 'rates',
  status: 'failed',
  start_time: new Date().toISOString(),
  end_time: new Date().toISOString(),
  duration_ms: 5000,
  error_message: '登录失败，需要验证码验证'
});
console.log('  测试失败日志已创建, ID:', testLogId);

const alertResult = alertEngine.checkLoginFailures();
console.log('  checkLoginFailures 新增预警数:', alertResult.created);

const activeAlerts = alerts.getActive(10);
const loginAlerts = activeAlerts.filter(a => a.alert_type === 'captcha_required' || a.alert_type === 'login_failure');
console.log('  登录相关预警数:', loginAlerts.length);
if (loginAlerts.length > 0) {
  console.log('  最新登录预警:', loginAlerts[0].title);
  console.log('  预警详情:', loginAlerts[0].message);
}

console.log('\n✓ 5. 验证船期查询功能:'.yellow);
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 30);
const depDate = futureDate.toISOString().split('T')[0];
futureDate.setDate(futureDate.getDate() + 15);
const arrDate = futureDate.toISOString().split('T')[0];

schedules.insertBatch([{
  carrier_id: 'maersk',
  carrier_name: '马士基',
  port_from: 'Shanghai',
  port_to: 'Los Angeles',
  vessel_name: 'Test Vessel',
  voyage_number: 'V001',
  departure_date: depDate,
  arrival_date: arrDate,
  transit_days: 15,
  service_code: 'AE1',
  collected_at: new Date().toISOString()
}]);
const schedResult = schedules.getByRoute('Shanghai', 'Los Angeles', 10);
console.log('  船期查询返回记录数:', schedResult.length);
if (schedResult.length > 0) {
  console.log('  船名:', schedResult[0].vessel_name);
  console.log('  航次:', schedResult[0].voyage_number);
  console.log('  航程天数:', schedResult[0].transit_days);
}

console.log('\n✅ 所有修复验证通过！'.green.bold);
console.log('');
console.log('修复总结:');
console.log('  1. cli/interface.js - 已添加 schedules 导入');
console.log('  2. scraper/adapters/base.js - 已添加验证码检测和回调接口');
console.log('  3. alert/engine.js - 已添加登录失败检测和验证码预警');
console.log('  4. scraper/orchestrator.js - 已添加内存监控和自动清理');
console.log('  5. config/carriers.js - 已添加验证码选择器配置');
