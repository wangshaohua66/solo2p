const inquirer = require('inquirer');
const colors = require('colors');
const cliProgress = require('cli-progress');

const ScrapeOrchestrator = require('../scraper/orchestrator');
const AlertEngine = require('../alert/engine');
const ReportGenerator = require('../utils/report');
const { getCarrierList } = require('../config/carriers');
const { rateSnapshots, spaceStatus, schedules, taskLogs, alerts: alertsDb } = require('../store/db');
const logger = require('../utils/logger');

class CliInterface {
  constructor() {
    this.orchestrator = new ScrapeOrchestrator();
    this.alertEngine = new AlertEngine();
    this.reportGenerator = new ReportGenerator();
    this.isScraping = false;
  }

  async start() {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════╗'.cyan.bold);
    console.log('║                                                  ║'.cyan.bold);
    console.log('║       🚢 国际货运运价采集监控系统 v1.0           ║'.cyan.bold);
    console.log('║                                                  ║'.cyan.bold);
    console.log('╚══════════════════════════════════════════════════╝'.cyan.bold);
    console.log('\n');
    
    await this.showMainMenu();
  }

  async showMainMenu() {
    const carrierStatuses = this._getCarrierStatuses();
    
    console.log('\n');
    console.log('━━━ 各船公司采集状态 ━━━'.yellow.bold);
    console.log('');
    
    for (const status of carrierStatuses) {
      const indicator = this._getStatusIndicator(status.status);
      console.log(`  ${indicator}  ${status.name.padEnd(15)} ${status.statusText}`);
    }
    
    console.log('');
    
    const activeAlerts = alertsDb.getActive(100);
    const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
    const warningCount = activeAlerts.filter(a => a.severity === 'warning').length;
    
    if (activeAlerts.length > 0) {
      console.log(`  ⚠️  当前活动预警: ${String(activeAlerts.length).yellow.bold} 条 (严重: ${String(criticalCount).red.bold}, 警告: ${String(warningCount).yellow.bold})`);
      console.log('');
    }

    const choices = [
      { name: '  🔄 立即执行全量采集', value: 'scrape_all' },
      { name: '  💰 查看实时运价排行', value: 'view_rates' },
      { name: '  ⚠️  查看预警列表', value: 'view_alerts' },
      { name: '  📦 查看舱位可用性', value: 'view_space' },
      { name: '  📅 查看船期信息', value: 'view_schedules' },
      { name: '  📊 导出比价报表', value: 'export_report' },
      { name: '  📝 查看采集日志', value: 'view_logs' },
      { name: '  ⚙️  系统状态与统计', value: 'system_status' },
      new inquirer.Separator(),
      { name: '  ❌ 退出系统', value: 'exit' }
    ];

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作:'.cyan,
        choices,
        pageSize: 15
      }
    ]);

    await this._handleAction(answer.action);
  }

  _getStatusIndicator(status) {
    switch (status) {
      case 'success': return '●'.green;
      case 'warning': return '●'.yellow;
      case 'error': return '●'.red;
      default: return '○'.grey;
    }
  }

  _getCarrierStatuses() {
    const carriers = getCarrierList();
    const stats = taskLogs.getStatsByCarrier();
    const activeAlerts = alertsDb.getActive(100);
    const alertCarriers = new Set(activeAlerts.map(a => a.carrier_id));
    
    return carriers.map(carrier => {
      const stat = stats.find(s => s.carrier_id === carrier.id);
      let status = 'idle';
      let statusText = '待采集'.grey;
      
      if (stat) {
        if (stat.failed_count > 0) {
          status = 'error';
          statusText = `${stat.success_count}成功 / ${stat.failed_count}失败`.red;
        } else if (alertCarriers.has(carrier.id)) {
          status = 'warning';
          statusText = `${stat.success_count}成功 (有预警)`.yellow;
        } else if (stat.success_count > 0) {
          status = 'success';
          statusText = `${stat.success_count}成功`.green;
        }
      }
      
      return {
        id: carrier.id,
        name: carrier.name,
        status,
        statusText
      };
    });
  }

  async _handleAction(action) {
    switch (action) {
      case 'scrape_all':
        await this._handleScrapeAll();
        break;
      case 'view_rates':
        await this._handleViewRates();
        break;
      case 'view_alerts':
        await this._handleViewAlerts();
        break;
      case 'view_space':
        await this._handleViewSpace();
        break;
      case 'view_schedules':
        await this._handleViewSchedules();
        break;
      case 'export_report':
        await this._handleExportReport();
        break;
      case 'view_logs':
        await this._handleViewLogs();
        break;
      case 'system_status':
        await this._handleSystemStatus();
        break;
      case 'exit':
        console.log('\n感谢使用运价采集监控系统，再见！\n'.cyan);
        process.exit(0);
        return;
    }

    await this._pauseAndContinue();
    await this.showMainMenu();
  }

  async _handleScrapeAll() {
    if (this.isScraping) {
      console.log('\n采集任务正在运行中...'.yellow);
      return;
    }

    const answer = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'taskTypes',
        message: '选择采集类型:'.cyan,
        choices: [
          { name: '运价数据', value: 'rates', checked: true },
          { name: '舱位状态', value: 'space', checked: true },
          { name: '船期表', value: 'schedules', checked: false },
          { name: '附加费公告', value: 'surcharges', checked: false }
        ],
        pageSize: 10
      }
    ]);

    if (answer.taskTypes.length === 0) {
      console.log('\n未选择任何采集类型'.red);
      return;
    }

    console.log('\n开始全量采集...'.yellow);
    this.isScraping = true;

    const progressBar = new cliProgress.SingleBar({
      format: '采集进度 |' + '{bar}'.cyan + '| {percentage}% | {value}/{total} 任务 | {status}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });

    progressBar.start(0, 0, { status: '准备中...' });

    this.orchestrator.on('queueBuilt', (data) => {
      progressBar.setTotal(data.count);
      progressBar.update(0, { status: '队列构建完成' });
    });

    this.orchestrator.on('taskSuccess', (task) => {
      const progress = this.orchestrator.getProgress();
      progressBar.update(progress.completed, { status: `${task.carrierName} ${task.taskType} ✓` });
    });

    this.orchestrator.on('taskFailed', (task) => {
      const progress = this.orchestrator.getProgress();
      progressBar.update(progress.completed, { status: `${task.carrierName} ${task.taskType} ✗` });
    });

    try {
      const result = await this.orchestrator.runAll(answer.taskTypes);
      progressBar.stop();
      
      console.log('\n');
      console.log('━━━ 采集结果汇总 ━━━'.yellow.bold);
      console.log(`  总任务数: ${result.total}`);
      console.log(`  成功: ${String(result.success).green}`);
      console.log(`  失败: ${String(result.failed).red}`);
      
      if (result.failed > 0) {
        console.log('\n  失败任务:');
        result.tasks.filter(t => t.status === 'failed').forEach(t => {
          console.log(`    - ${t.id}: ${t.error}`.red);
        });
      }

      const alertResult = this.alertEngine.runAllChecks();
      if (alertResult.totalAlerts > 0) {
        console.log(`\n  ⚠️  本次检测到 ${alertResult.totalAlerts} 条新预警`.yellow);
      }
      
    } catch (error) {
      progressBar.stop();
      console.log(`\n采集异常: ${error.message}`.red);
    } finally {
      this.isScraping = false;
    }
  }

  async _handleViewRates() {
    const allRates = rateSnapshots.getAllLatest(200);
    
    if (allRates.length === 0) {
      console.log('\n暂无运价数据，请先执行采集'.yellow);
      return;
    }

    const routes = [...new Set(allRates.map(r => `${r.port_from} → ${r.port_to} (${r.container_type})`))];
    
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'route',
        message: '选择航线:'.cyan,
        choices: routes
      }
    ]);

    const [portFrom, rest] = answer.route.split(' → ');
    const [portTo, containerType] = rest.split(' (');
    const ct = containerType.replace(')', '');

    const routeRates = allRates.filter(
      r => r.port_from === portFrom && r.port_to === portTo && r.container_type === ct
    );

    routeRates.sort((a, b) => a.total_rate - b.total_rate);

    console.log('\n');
    console.log(`━━━ ${portFrom} → ${portTo} (${ct}) 运价排行 ━━━`.yellow.bold);
    console.log('');

    const col1 = 15;
    const col2 = 12;
    const col3 = 12;
    const col4 = 20;
    
    console.log('  ' + '排名'.padEnd(6) + '船公司'.padEnd(col1) + '运价(USD)'.padEnd(col2) + '附加费'.padEnd(col2) + '有效期'.padEnd(col4));
    console.log('  ' + '─'.repeat(65));

    routeRates.forEach((rate, index) => {
      const rank = index === 0 ? '🥇'.yellow : (index === 1 ? '🥈'.grey : (index === 2 ? '🥉'.red : `${index + 1}.`));
      const validText = rate.valid_from ? `${rate.valid_from} ~ ${rate.valid_to || '?'}` : '未知';
      
      console.log(
        '  ' + String(rank).padEnd(6) + 
        String(rate.carrier_name).padEnd(col1) + 
        String(rate.total_rate?.toFixed(2) || 'N/A').padEnd(col2).green +
        String(rate.surcharges_total?.toFixed(2) || '0').padEnd(col2) +
        validText
      );
    });

    if (routeRates.length > 0) {
      const avg = routeRates.reduce((sum, r) => sum + r.total_rate, 0) / routeRates.length;
      console.log('\n');
      console.log(`  平均运价: $${avg.toFixed(2)}`.cyan);
      console.log(`  最低运价: $${routeRates[0].total_rate.toFixed(2)} (${routeRates[0].carrier_name})`.green);
      console.log(`  最高运价: $${routeRates[routeRates.length - 1].total_rate.toFixed(2)} (${routeRates[routeRates.length - 1].carrier_name})`.red);
    }
  }

  async _handleViewAlerts() {
    const activeAlerts = alertsDb.getActive(100);
    
    if (activeAlerts.length === 0) {
      console.log('\n当前无活动预警'.green);
      return;
    }

    console.log('\n');
    console.log('━━━ 活动预警列表 ━━━'.yellow.bold);
    console.log('');

    activeAlerts.forEach((alert, index) => {
      const severityIcon = alert.severity === 'critical' ? '🔴'.red : 
                           alert.severity === 'warning' ? '🟡'.yellow : '🔵'.cyan;
      const severityText = alert.severity === 'critical' ? '严重'.red.bold :
                           alert.severity === 'warning' ? '警告'.yellow.bold : '信息'.cyan.bold;
      
      console.log(`  ${severityIcon} [${severityText}] ${alert.title}`);
      console.log(`     ${alert.message}`.grey);
      console.log(`     时间: ${alert.created_at}`.grey);
      console.log('');
    });
  }

  async _handleViewSpace() {
    const allRates = rateSnapshots.getAllLatest(100);
    const routes = [...new Set(allRates.map(r => `${r.port_from} → ${r.port_to}`))];
    
    if (routes.length === 0) {
      console.log('\n暂无舱位数据，请先执行采集'.yellow);
      return;
    }

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'route',
        message: '选择航线:'.cyan,
        choices: routes
      }
    ]);

    const [portFrom, portTo] = answer.route.split(' → ');
    const spaces = spaceStatus.getByRoute(portFrom, portTo);

    console.log('\n');
    console.log(`━━━ ${portFrom} → ${portTo} 舱位可用性 ━━━`.yellow.bold);
    console.log('');

    if (spaces.length === 0) {
      console.log('  暂无舱位数据'.yellow);
      return;
    }

    spaces.forEach(space => {
      const statusIcon = space.status === 'available' ? '🟢' :
                         space.status === 'limited' ? '🟡' :
                         space.status === 'full' ? '🔴' : '⚪';
      const statusText = space.status === 'available' ? '充足'.green :
                         space.status === 'limited' ? '紧张'.yellow :
                         space.status === 'full' ? '爆舱'.red : '未知'.grey;
      
      console.log(`  ${statusIcon} ${space.carrier_name.padEnd(15)} ${statusText.padEnd(8)} 可用: ${space.available_count !== null ? space.available_count + ' TEU' : '未知'}`);
      
      if (space.vessel_name || space.departure_date) {
        console.log(`     船名: ${space.vessel_name || '未知'} | 离港: ${space.departure_date || '未知'}`.grey);
      }
    });
  }

  async _handleViewSchedules() {
    const allRates = rateSnapshots.getAllLatest(100);
    const routes = [...new Set(allRates.map(r => `${r.port_from} → ${r.port_to}`))];
    
    if (routes.length === 0) {
      console.log('\n暂无船期数据，请先执行采集'.yellow);
      return;
    }

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'route',
        message: '选择航线:'.cyan,
        choices: routes
      }
    ]);

    const [portFrom, portTo] = answer.route.split(' → ');
    const scheds = schedules.getByRoute(portFrom, portTo, 20);

    console.log('\n');
    console.log(`━━━ ${portFrom} → ${portTo} 船期表 ━━━`.yellow.bold);
    console.log('');

    if (scheds.length === 0) {
      console.log('  暂无船期数据'.yellow);
      return;
    }

    scheds.forEach(s => {
      console.log(`  🚢 ${s.carrier_name.padEnd(12)} ${s.vessel_name || '未知船名'}`);
      console.log(`     航次: ${s.voyage_number || '未知'} | 离港: ${s.departure_date || '未知'} | 到港: ${s.arrival_date || '未知'}`.grey);
      if (s.transit_days) {
        console.log(`     航程: ${s.transit_days} 天`.grey);
      }
      console.log('');
    });
  }

  async _handleExportReport() {
    const allRates = rateSnapshots.getAllLatest(100);
    const routes = [...new Set(allRates.map(r => `${r.port_from} → ${r.port_to} (${r.container_type})`))];
    
    if (routes.length === 0) {
      console.log('\n暂无数据可导出，请先执行采集'.yellow);
      return;
    }

    const typeAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'reportType',
        message: '选择报表类型:'.cyan,
        choices: [
          { name: '比价报表（最新各船公司对比）', value: 'comparison' },
          { name: '运价趋势报表（30日走势）', value: 'trend' },
          { name: '船期报表', value: 'schedules' }
        ]
      }
    ]);

    const routeAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'route',
        message: '选择航线:'.cyan,
        choices: routes
      }
    ]);

    const [portFrom, rest] = routeAnswer.route.split(' → ');
    const [portTo, containerType] = rest.split(' (');
    const ct = containerType.replace(')', '');

    let result;
    
    switch (typeAnswer.reportType) {
      case 'comparison':
        result = this.reportGenerator.exportComparisonReport(portFrom, portTo, ct, 7);
        break;
      case 'trend':
        result = this.reportGenerator.exportPriceTrendReport(portFrom, portTo, ct, 30);
        break;
      case 'schedules':
        result = this.reportGenerator.exportSchedulesReport(portFrom, portTo, 20);
        break;
    }

    if (result) {
      console.log('\n✅ 报表导出成功!'.green.bold);
      console.log(`  文件路径: ${result.filePath}`.cyan);
      console.log(`  记录条数: ${result.recordCount}`);
    } else {
      console.log('\n❌ 报表导出失败'.red);
    }
  }

  async _handleViewLogs() {
    const carriers = getCarrierList();
    
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'carrier',
        message: '选择船公司:'.cyan,
        choices: [
          { name: '全部', value: 'all' },
          ...carriers.map(c => ({ name: c.name, value: c.id }))
        ]
      }
    ]);

    let logs;
    if (answer.carrier === 'all') {
      logs = taskLogs.getRecent(50);
    } else {
      logs = taskLogs.getByCarrier(answer.carrier, 50);
    }

    console.log('\n');
    console.log('━━━ 最近采集日志 ━━━'.yellow.bold);
    console.log('');

    if (logs.length === 0) {
      console.log('  暂无日志记录'.yellow);
      return;
    }

    logs.slice(0, 20).forEach(log => {
      const statusIcon = log.status === 'success' ? '✅' : log.status === 'failed' ? '❌' : '⏳';
      const statusColor = log.status === 'success' ? 'green' : log.status === 'failed' ? 'red' : 'yellow';
      
      console.log(
        `  ${statusIcon} ${log.start_time.split('T')[1].split('.')[0]} ` +
        `${log.carrier_name.padEnd(12)} ` +
        `${log.task_type.padEnd(12)} ` +
        `${String(log.duration_ms + 'ms').padEnd(10)}[statusColor]`.replace('[statusColor]', '')
      );
      
      if (log.status === 'failed' && log.error_message) {
        console.log(`     ${log.error_message}`.red);
      }
    });

    console.log(`\n  共 ${logs.length} 条记录`.grey);
  }

  async _handleSystemStatus() {
    const stats = taskLogs.getStatsByCarrier();
    const activeAlerts = alertsDb.getActive(100);
    const allRates = rateSnapshots.getAllLatest(500);
    const orchStats = this.orchestrator.getStats();
    const memory = orchStats.memory;
    
    console.log('\n');
    console.log('━━━ 系统状态 ━━━'.yellow.bold);
    console.log('');
    
    console.log('  💾 内存使用:');
    const memColor = memory.overLimit ? 'red' : 'green';
    const memStatus = memory.overLimit ? '超限'.red : '正常'.green;
    console.log(`    Heap使用: ${String(memory.heapUsedMB + 'MB')[memColor]} / ${memory.limitMB}MB (${memStatus})`);
    console.log(`    Heap总计: ${memory.heapTotalMB}MB`);
    console.log(`    RSS: ${memory.rssMB}MB`);
    console.log(`    活跃浏览器: ${orchStats.activeBrowsers} 个`);
    
    console.log('\n  📊 采集统计 (最近24小时):');
    stats.forEach(s => {
      const status = s.failed_count > 0 ? '异常'.red : '正常'.green;
      console.log(`    ${s.carrier_name.padEnd(12)} 成功: ${String(s.success_count).green} 失败: ${String(s.failed_count).red} 状态: ${status}`);
    });
    
    console.log('\n  ⚠️  活动预警:');
    console.log(`    总计: ${activeAlerts.length}`.yellow);
    console.log(`    严重: ${activeAlerts.filter(a => a.severity === 'critical').length}`.red);
    console.log(`    警告: ${activeAlerts.filter(a => a.severity === 'warning').length}`.yellow);
    
    console.log('\n  💰 运价数据:');
    console.log(`    最新快照: ${allRates.length} 条`.cyan);
    
    console.log('\n  📁 报表目录:');
    console.log(`    ${this.reportGenerator.getOutputDir()}`.grey);
  }

  async _pauseAndContinue() {
    console.log('');
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '按回车键返回主菜单...'.grey,
      }
    ]);
  }
}

module.exports = CliInterface;
