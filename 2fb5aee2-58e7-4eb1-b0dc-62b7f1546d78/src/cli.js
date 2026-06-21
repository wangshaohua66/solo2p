const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

const { logger } = require('./logger');
const config = require('./config');
const { errorHandler, ERROR_TYPES } = require('./errorHandler');
const { createVehicleService } = require('./vehicleService');
const { createInspectionRunner, DETECTION_METHOD_FIELDS } = require('./inspectionRunner');
const { createReportGenerator } = require('./reportGenerator');
const { createStatsExporter } = require('./statsExporter');

const program = new Command();

const MENU_OPTIONS = [
  { key: '1', name: '车辆信息查询', description: '输入车牌号查询车辆基础信息' },
  { key: '2', name: '检测录入', description: '录入车辆检测数据并提交' },
  { key: '3', name: '批量检测', description: '批量处理CSV文件中的多台车辆' },
  { key: '4', name: '报告生成', description: '生成并上传检测报告' },
  { key: '5', name: '统计报表导出', description: '导出月度/季度统计报表' },
  { key: '6', name: '定时任务管理', description: '管理报表导出定时任务' },
  { key: '7', name: '系统配置', description: '查看和修改系统配置' },
  { key: '8', name: '退出系统', description: '退出自动化系统' }
];

class CLIManager {
  constructor() {
    this.currentRunner = null;
    this.currentLineId = null;
    this.statsExporter = null;
    this.spinner = null;
    this.setupProgram();
  }

  setupProgram() {
    program
      .name('vehicle-inspection')
      .description('机动车排放检验自动化系统')
      .version('1.0.0');

    program
      .option('--batch <file>', '批量处理CSV文件')
      .option('--schedule <cron>', '设置报表导出定时任务')
      .option('--line <lineId>', '指定检测线编号')
      .option('--mock', '使用模拟模式（无需真实浏览器）')
      .option('--debug', '启用调试模式');

    program.parse(process.argv);
    this.options = program.opts();

    if (this.options.mock) {
      process.env.USE_MOCK = 'true';
      logger.info('已启用模拟模式');
    }

    if (this.options.debug) {
      process.env.LOG_LEVEL = 'debug';
      logger.info('已启用调试模式');
    }
  }

  async start() {
    this.printWelcome();

    const validation = config.validateConfig();
    if (!validation.valid) {
      console.log(chalk.yellow('\n⚠️  配置警告:'));
      validation.errors.forEach(err => console.log(chalk.yellow(`   - ${err}`)));
    }

    if (this.options.batch) {
      await this.runBatchMode(this.options.batch, this.options.line);
      return;
    }

    if (this.options.schedule) {
      await this.setupSchedule(this.options.schedule);
      return;
    }

    await this.showMainMenu();
  }

  printWelcome() {
    console.log('\n');
    console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║                                                              ║'));
    console.log(chalk.cyan('║           机动车排放检验自动化系统 V1.0                      ║'));
    console.log(chalk.cyan('║                                                              ║'));
    console.log(chalk.cyan('║   支持：车辆信息查询 · 检测数据录入 · 报告生成上传 · 报表导出   ║'));
    console.log(chalk.cyan('║                                                              ║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('\n');
    
    const org = config.getOrganizationInfo();
    console.log(chalk.gray(`机构名称: ${org.name}`));
    console.log(chalk.gray(`机构代码: ${org.code}`));
    console.log(chalk.gray(`检测线数量: ${config.getActiveInspectionLines().length} 条`));
    console.log(chalk.gray(`当前标准: ${config.getCurrentStandard().name}`));
    console.log(chalk.gray(`当前时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`));
    console.log('\n');
  }

  async showMainMenu() {
    while (true) {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: '请选择操作:',
          choices: MENU_OPTIONS.map(opt => ({
            name: `${chalk.green(opt.key)}. ${opt.name} - ${chalk.gray(opt.description)}`,
            value: opt.key
          })),
          pageSize: 10
        }
      ]);

      switch (answers.choice) {
        case '1':
          await this.vehicleQueryMenu();
          break;
        case '2':
          await this.inspectionMenu();
          break;
        case '3':
          await this.batchMenu();
          break;
        case '4':
          await this.reportMenu();
          break;
        case '5':
          await this.statsMenu();
          break;
        case '6':
          await this.scheduleMenu();
          break;
        case '7':
          await this.configMenu();
          break;
        case '8':
          await this.exitSystem();
          return;
        default:
          console.log(chalk.red('无效选项，请重试'));
      }
    }
  }

  async vehicleQueryMenu() {
    console.log(chalk.cyan('\n=== 车辆信息查询 ===\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'plateNumber',
        message: '请输入车牌号:',
        validate: (input) => {
          if (!input) return '请输入车牌号';
          return true;
        }
      },
      {
        type: 'list',
        name: 'lineId',
        message: '请选择检测线:',
        choices: config.getActiveInspectionLines().map(line => ({
          name: `${line.id} - ${line.name}`,
          value: line.id
        }))
      }
    ]);

    this.spinner = ora('正在查询车辆信息...').start();

    try {
      const vehicleService = createVehicleService(answers.lineId);
      await vehicleService.init();
      
      const vehicleInfo = await vehicleService.queryVehicle(answers.plateNumber);
      
      this.spinner.succeed('查询成功');
      
      this.displayVehicleInfo(vehicleInfo);
      
      await vehicleService.close();
    } catch (error) {
      this.spinner.fail('查询失败');
      this.displayError(error);
    }

    await this.pressEnterToContinue();
  }

  displayVehicleInfo(vehicleInfo) {
    console.log('\n');
    const table = new Table({
      head: [chalk.cyan('字段'), chalk.cyan('值')],
      colWidths: [20, 50]
    });

    const displayFields = [
      ['车牌号', vehicleInfo.plateNumber],
      ['号牌颜色', vehicleInfo.plateColor],
      ['车辆类型', vehicleInfo.vehicleType],
      ['燃料种类', vehicleInfo.fuelType],
      ['注册日期', vehicleInfo.registerDate],
      ['注册年份', vehicleInfo.registerYear],
      ['发动机排量', vehicleInfo.engineDisplacement],
      ['发动机号码', vehicleInfo.engineNumber],
      ['车辆识别代号', vehicleInfo.vin],
      ['品牌型号', vehicleInfo.brandModel],
      ['所有人', vehicleInfo.owner],
      ['联系电话', vehicleInfo.phone],
      ['检验有效期止', vehicleInfo.inspectionExpiryDate],
      ['---', '---'],
      ['推荐检测方法', vehicleInfo.recommendedMethod ? 
        `${vehicleInfo.recommendedMethod.name} (${vehicleInfo.recommendedMethod.code})` : '未知']
    ];

    displayFields.forEach(([key, value]) => {
      table.push([key, value || '']);
    });

    console.log(table.toString());
    console.log('\n');
  }

  async inspectionMenu() {
    console.log(chalk.cyan('\n=== 检测录入 ===\n'));

    const activeLines = config.getActiveInspectionLines();
    const lineChoices = activeLines.map(line => ({
      name: `${line.id} - ${line.name} (${line.type})`,
      value: line.id
    }));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'lineId',
        message: '请选择检测线:',
        choices: lineChoices
      },
      {
        type: 'input',
        name: 'plateNumber',
        message: '请输入车牌号:',
        validate: (input) => {
          if (!input) return '请输入车牌号';
          return true;
        }
      }
    ]);

    this.currentLineId = answers.lineId;
    this.currentStep = '初始化';
    this.spinner = ora('正在初始化检测流程...').start();
    
    const stepCallback = (stepInfo) => {
      const stepNames = {
        'login_attempt': '登录尝试',
        'login_navigate': '访问登录页面',
        'login_username': '输入用户名',
        'login_password': '输入密码',
        'login_captcha': '处理验证码',
        'login_submit': '提交登录',
        'vehicle_query': '查询车辆信息',
        'vehicle_query_complete': '车辆信息查询完成',
        'navigate_inspection': '进入检测页面',
        'fill_vehicle_info': '填充车辆信息',
        'select_method': '选择检测方法',
        'fill_test_data': '录入检测数据',
        'submit_inspection': '提交检测',
        'evaluate_result': '判定检测结果',
        'heartbeat_check': '心跳检测',
        'captcha_recognition': '验证码识别',
        'relogin': '重新登录'
      };
      
      const stepName = stepNames[stepInfo.step] || stepInfo.step;
      this.currentStep = stepName;
      
      let statusText = `[${answers.plateNumber}] ${stepName}`;
      if (stepInfo.details?.attempt) {
        statusText += ` (第${stepInfo.details.attempt}次)`;
      }
      
      this.spinner.text = statusText;
    };

    try {
      if (!this.currentRunner || this.currentRunner.inspectionLine.id !== answers.lineId) {
        await this.cleanupRunner();
        this.currentRunner = createInspectionRunner(answers.lineId, {
          stepCallback: stepCallback.bind(this)
        });
        await this.currentRunner.init();
      }

      this.spinner.text = `[${answers.plateNumber}] 正在执行检测流程...`;
      const result = await this.currentRunner.runInspection(answers.plateNumber);

      if (result.success) {
        this.spinner.succeed(`检测完成 - ${result.result.overall}`);
        this.displayInspectionResult(result);

        const generateReport = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'generate',
            message: '是否生成并上传检测报告？',
            default: true
          }
        ]);

        if (generateReport.generate) {
          await this.generateAndUploadReport(result);
        }
      } else {
        this.spinner.fail(`检测失败: ${result.error}`);
      }
    } catch (error) {
      this.spinner.fail('检测流程异常');
      this.displayError(error);
    }

    await this.pressEnterToContinue();
  }

  displayInspectionResult(result) {
    console.log('\n');
    console.log(chalk.cyan('=== 检测结果 ===\n'));
    
    const headerTable = new Table({
      head: [chalk.cyan('项目'), chalk.cyan('值')],
      colWidths: [20, 50]
    });

    headerTable.push(
      ['车牌号', result.vehicleInfo.plateNumber],
      ['检测线', `${this.currentLineId} - ${this.currentRunner.inspectionLine.name}`],
      ['检测方法', `${result.method.name} (${result.method.code})`],
      ['检测耗时', `${(result.duration / 1000).toFixed(2)} 秒`],
      ['检测结论', result.result.pass ? chalk.green('合格') : chalk.red('不合格')],
      ['执行标准', result.result.standard]
    );
    console.log(headerTable.toString());

    console.log('\n' + chalk.cyan('检测数据明细:'));
    const dataTable = new Table({
      head: [chalk.cyan('检测项目'), chalk.cyan('检测值'), chalk.cyan('标准限值'), chalk.cyan('结果')],
      colWidths: [20, 15, 15, 10]
    });

    result.result.items.forEach(item => {
      dataTable.push([
        item.label,
        item.value,
        item.limit,
        item.pass ? chalk.green('合格') : chalk.red('不合格')
      ]);
    });
    console.log(dataTable.toString());
    console.log('\n');
  }

  async generateAndUploadReport(inspectionResult) {
    this.spinner = ora('正在生成检测报告...').start();

    try {
      const reportGenerator = createReportGenerator(this.currentLineId);
      const reportResult = await reportGenerator.generateAndUpload(
        inspectionResult,
        this.currentRunner.driver
      );

      if (reportResult.success) {
        this.spinner.succeed(`报告生成上传成功: ${reportResult.reportNo}`);
        console.log(chalk.gray(`报告路径: ${reportResult.reportPath}`));
        
        if (reportResult.upload?.success) {
          console.log(chalk.green('✓ 报告已成功上传至环保平台'));
        } else if (reportResult.upload) {
          console.log(chalk.yellow(`⚠ 报告上传失败: ${reportResult.upload.error}`));
        }
      } else {
        this.spinner.fail(`报告生成失败: ${reportResult.error}`);
      }
    } catch (error) {
      this.spinner.fail('报告生成上传异常');
      this.displayError(error);
    }
  }

  async batchMenu() {
    console.log(chalk.cyan('\n=== 批量检测 ===\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'lineId',
        message: '请选择检测线:',
        choices: config.getActiveInspectionLines().map(line => ({
          name: `${line.id} - ${line.name}`,
          value: line.id
        }))
      },
      {
        type: 'input',
        name: 'csvFile',
        message: '请输入CSV文件路径:',
        default: path.join(__dirname, '..', 'data', 'batch_example.csv'),
        validate: (input) => {
          if (!fs.existsSync(input)) {
            return `文件不存在: ${input}`;
          }
          if (!input.endsWith('.csv')) {
            return '请选择CSV文件';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'interval',
        message: '每台车处理间隔(毫秒):',
        default: 2000,
        validate: (input) => {
          const num = parseInt(input);
          if (isNaN(num) || num < 0) return '请输入有效数字';
          return true;
        }
      }
    ]);

    await this.runBatchMode(answers.csvFile, answers.lineId, parseInt(answers.interval));
    await this.pressEnterToContinue();
  }

  async runBatchMode(csvFile, lineId, interval = 2000) {
    console.log(chalk.cyan(`\n=== 批量处理模式 ===\n`));
    console.log(chalk.gray(`CSV文件: ${csvFile}`));
    console.log(chalk.gray(`检测线: ${lineId || '自动选择'}`));
    console.log(chalk.gray(`处理间隔: ${interval}ms`));
    console.log('');

    const targetLineId = lineId || config.getActiveInspectionLines()[0]?.id;
    
    if (!targetLineId) {
      console.log(chalk.red('没有可用的检测线'));
      return;
    }

    this.spinner = ora('正在初始化批量处理...').start();

    try {
      const runner = createInspectionRunner(targetLineId);
      await runner.init();

      this.spinner.succeed('初始化完成，开始批量处理');
      console.log('');

      const result = await runner.batchProcess(csvFile, { interval });

      console.log('\n' + chalk.cyan('=== 批量处理完成 ===\n'));
      
      const summaryTable = new Table({
        head: [chalk.cyan('项目'), chalk.cyan('数值')],
        colWidths: [20, 30]
      });

      summaryTable.push(
        ['批次ID', result.batchId],
        ['总数量', result.totalCount],
        ['成功数量', chalk.green(result.successCount)],
        ['失败数量', chalk.red(result.failedCount)],
        ['总耗时', `${(result.duration / 1000).toFixed(2)} 秒`],
        ['平均耗时', result.totalCount > 0 ? 
          `${(result.duration / result.totalCount / 1000).toFixed(2)} 秒/台` : 'N/A']
      );
      console.log(summaryTable.toString());

      if (result.failedCount > 0) {
        console.log('\n' + chalk.red('失败记录:'));
        result.results
          .filter(r => !r.success)
          .forEach(r => {
            console.log(chalk.red(`  ${r.index}. ${r.plateNumber}: ${r.error}`));
          });
      }

      await runner.close();
    } catch (error) {
      this.spinner?.fail('批量处理异常');
      this.displayError(error);
    }
  }

  async reportMenu() {
    console.log(chalk.cyan('\n=== 报告管理 ===\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作:',
        choices: [
          { name: '查看报告列表', value: 'list' },
          { name: '清理过期报告', value: 'cleanup' },
          { name: '返回主菜单', value: 'back' }
        ]
      }
    ]);

    if (answers.action === 'list') {
      await this.listReports();
    } else if (answers.action === 'cleanup') {
      await this.cleanupReports();
    }

    if (answers.action !== 'back') {
      await this.pressEnterToContinue();
    }
  }

  async listReports() {
    const lineId = this.currentLineId || config.getActiveInspectionLines()[0]?.id;
    if (!lineId) {
      console.log(chalk.red('没有可用的检测线'));
      return;
    }

    const reportGenerator = createReportGenerator(lineId);
    const reports = reportGenerator.getReportList();

    if (reports.length === 0) {
      console.log(chalk.yellow('暂无报告文件'));
      return;
    }

    console.log(chalk.cyan(`\n报告列表 (共 ${reports.length} 份):\n`));
    
    const table = new Table({
      head: [chalk.cyan('#'), chalk.cyan('文件名'), chalk.cyan('大小(KB)'), chalk.cyan('创建时间')],
      colWidths: [5, 50, 12, 25]
    });

    reports.slice(0, 20).forEach((report, index) => {
      table.push([
        index + 1,
        report.filename,
        (report.size / 1024).toFixed(2),
        dayjs(report.created).format('YYYY-MM-DD HH:mm:ss')
      ]);
    });

    console.log(table.toString());
    if (reports.length > 20) {
      console.log(chalk.gray(`\n... 还有 ${reports.length - 20} 份报告未显示`));
    }
  }

  async cleanupReports() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'days',
        message: '清理多少天前的报告:',
        default: 90,
        validate: (input) => {
          const num = parseInt(input);
          if (isNaN(num) || num < 1) return '请输入有效天数';
          return true;
        }
      }
    ]);

    const lineId = this.currentLineId || config.getActiveInspectionLines()[0]?.id;
    const reportGenerator = createReportGenerator(lineId);
    const deleted = reportGenerator.cleanupOldReports(parseInt(answers.days));
    
    console.log(chalk.green(`\n✓ 已清理 ${deleted} 份过期报告`));
  }

  async statsMenu() {
    console.log(chalk.cyan('\n=== 统计报表导出 ===\n'));

    const now = dayjs();
    const lastMonth = now.subtract(1, 'month');

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'reportType',
        message: '请选择报表类型:',
        choices: [
          { name: '月度检测汇总表', value: 'monthly' },
          { name: '车型分布统计表', value: 'vehicleType' },
          { name: '燃料类型统计表', value: 'fuelType' },
          { name: '全部报表', value: 'all' },
          { name: '返回主菜单', value: 'back' }
        ]
      },
      {
        type: 'input',
        name: 'year',
        message: '请输入年份:',
        default: lastMonth.year(),
        validate: (input) => {
          const num = parseInt(input);
          if (isNaN(num) || num < 2000 || num > 2100) return '请输入有效年份';
          return true;
        },
        when: (a) => a.reportType !== 'back'
      },
      {
        type: 'input',
        name: 'month',
        message: '请输入月份:',
        default: lastMonth.month() + 1,
        validate: (input) => {
          const num = parseInt(input);
          if (isNaN(num) || num < 1 || num > 12) return '请输入1-12之间的月份';
          return true;
        },
        when: (a) => a.reportType !== 'back'
      }
    ]);

    if (answers.reportType === 'back') return;

    this.spinner = ora('正在导出统计报表...').start();

    try {
      if (!this.statsExporter) {
        this.statsExporter = createStatsExporter();
        await this.statsExporter.init();
      }

      let result;
      switch (answers.reportType) {
        case 'monthly':
          result = await this.statsExporter.exportMonthlyStats(
            parseInt(answers.year),
            parseInt(answers.month)
          );
          break;
        case 'vehicleType':
          result = await this.statsExporter.exportVehicleTypeStats(
            parseInt(answers.year),
            parseInt(answers.month)
          );
          break;
        case 'fuelType':
          result = await this.statsExporter.exportFuelTypeStats(
            parseInt(answers.year),
            parseInt(answers.month)
          );
          break;
        case 'all':
          result = await this.statsExporter.exportAllReports(
            parseInt(answers.year),
            parseInt(answers.month)
          );
          break;
      }

      this.spinner.succeed('报表导出成功');
      this.displayStatsResult(result);
    } catch (error) {
      this.spinner.fail('报表导出失败');
      this.displayError(error);
    }

    await this.pressEnterToContinue();
  }

  displayStatsResult(result) {
    console.log('\n');
    
    if (result.monthly) {
      console.log(chalk.cyan('月度汇总数据:'));
      const monthlyTable = new Table({
        head: [chalk.cyan('指标'), chalk.cyan('数值')],
        colWidths: [20, 30]
      });
      
      monthlyTable.push(
        ['周期', result.monthly.data.period],
        ['总检测量', result.monthly.data.calculated.总检测量],
        ['合格数', chalk.green(result.monthly.data.calculated.合格数)],
        ['不合格数', chalk.red(result.monthly.data.calculated.不合格数)],
        ['合格率', chalk.yellow(result.monthly.data.calculated.合格率 + '%')]
      );
      console.log(monthlyTable.toString());
      console.log(chalk.gray(`文件路径: ${result.monthly.excelPath}`));
    } else if (result.data) {
      console.log(chalk.cyan('统计数据:'));
      const table = new Table({
        head: [chalk.cyan('指标'), chalk.cyan('数值')],
        colWidths: [20, 30]
      });
      
      table.push(
        ['周期', result.data.period || result.data.calculated?.统计日期 || 'N/A'],
        ['总检测量', result.data.calculated?.总检测量 || result.data.overall?.total || 'N/A'],
        ['合格率', (result.data.calculated?.合格率 || result.data.overall?.passRate || 0) + '%']
      );
      console.log(table.toString());
      console.log(chalk.gray(`文件路径: ${result.excelPath}`));
    }
    console.log('\n');
  }

  async scheduleMenu() {
    console.log(chalk.cyan('\n=== 定时任务管理 ===\n'));

    if (!this.statsExporter) {
      this.statsExporter = createStatsExporter();
      await this.statsExporter.init();
    }

    const tasks = this.statsExporter.getScheduledTasks();

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作:',
        choices: [
          { name: `查看定时任务 (${tasks.length})`, value: 'list' },
          { name: '添加月度导出任务', value: 'add' },
          { name: '停止定时任务', value: 'stop' },
          { name: '停止全部任务', value: 'stopAll' },
          { name: '返回主菜单', value: 'back' }
        ]
      }
    ]);

    switch (answers.action) {
      case 'list':
        this.displayScheduledTasks(tasks);
        break;
      case 'add':
        await this.addScheduleTask();
        break;
      case 'stop':
        await this.stopScheduleTask(tasks);
        break;
      case 'stopAll':
        this.statsExporter.stopAllScheduledTasks();
        console.log(chalk.green('✓ 已停止全部定时任务'));
        break;
      case 'back':
        return;
    }

    await this.pressEnterToContinue();
  }

  displayScheduledTasks(tasks) {
    if (tasks.length === 0) {
      console.log(chalk.yellow('暂无定时任务'));
      return;
    }

    const table = new Table({
      head: [chalk.cyan('任务ID'), chalk.cyan('类型'), chalk.cyan('Cron表达式')],
      colWidths: [30, 20, 25]
    });

    tasks.forEach(task => {
      table.push([task.id, task.type, task.expression]);
    });

    console.log(table.toString());
  }

  async addScheduleTask() {
    console.log(chalk.gray('\nCron表达式格式: 秒 分 时 日 月 周'));
    console.log(chalk.gray('示例: 0 0 8 1 * *  表示每月1日早上8点执行\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'cron',
        message: '请输入Cron表达式:',
        default: '0 0 8 1 * *',
        validate: (input) => {
          const parts = input.trim().split(/\s+/);
          if (parts.length !== 6) return 'Cron表达式需要6个字段';
          return true;
        }
      }
    ]);

    const taskId = this.statsExporter.scheduleMonthlyExport(answers.cron);
    console.log(chalk.green(`\n✓ 定时任务已添加: ${taskId}`));
  }

  async stopScheduleTask(tasks) {
    if (tasks.length === 0) {
      console.log(chalk.yellow('没有可停止的定时任务'));
      return;
    }

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'taskId',
        message: '请选择要停止的任务:',
        choices: tasks.map(t => ({ name: `${t.type} - ${t.expression}`, value: t.id }))
      }
    ]);

    if (this.statsExporter.stopScheduledTask(answers.taskId)) {
      console.log(chalk.green('✓ 定时任务已停止'));
    } else {
      console.log(chalk.red('停止失败，任务不存在'));
    }
  }

  async setupSchedule(cronExpression) {
    console.log(chalk.cyan(`\n=== 设置定时任务 ===\n`));
    console.log(chalk.gray(`Cron表达式: ${cronExpression}`));

    this.statsExporter = createStatsExporter();
    await this.statsExporter.init();

    const taskId = this.statsExporter.scheduleMonthlyExport(cronExpression);
    console.log(chalk.green(`✓ 定时任务已启动: ${taskId}`));
    console.log(chalk.gray('按 Ctrl+C 退出...\n'));

    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n正在关闭定时任务...'));
      await this.statsExporter.close();
      process.exit(0);
    });
  }

  async configMenu() {
    console.log(chalk.cyan('\n=== 系统配置 ===\n'));

    const standards = config.getAvailableStandards();
    const currentStandard = config.getCurrentStandard();

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作:',
        choices: [
          { name: '查看系统配置', value: 'view' },
          { name: '切换检测标准', value: 'standard' },
          { name: '查看检测线列表', value: 'lines' },
          { name: '查看性能配置', value: 'performance' },
          { name: '返回主菜单', value: 'back' }
        ]
      }
    ]);

    switch (answers.action) {
      case 'view':
        this.displayConfig();
        break;
      case 'standard':
        await this.changeStandard(standards, currentStandard);
        break;
      case 'lines':
        this.displayInspectionLines();
        break;
      case 'performance':
        this.displayPerformanceConfig();
        break;
      case 'back':
        return;
    }

    await this.pressEnterToContinue();
  }

  displayConfig() {
    const org = config.getOrganizationInfo();
    const platform = config.getPlatformConfig('environmental');
    const alertConfig = config.getAlertConfig();

    console.log(chalk.cyan('\n=== 系统配置 ===\n'));

    const table = new Table({
      head: [chalk.cyan('配置项'), chalk.cyan('值')],
      colWidths: [25, 55]
    });

    table.push(
      ['机构名称', org.name],
      ['机构代码', org.code],
      ['机构地址', org.address],
      ['联系电话', org.contact],
      ['法人代表', org.legalPerson],
      ['---', '---'],
      ['环保平台URL', platform.baseUrl],
      ['页面超时', `${platform.pageTimeout / 1000}秒`],
      ['最大重试次数', `${platform.maxRetries}次`],
      ['重试间隔', `${platform.retryInterval / 1000}秒`],
      ['---', '---'],
      ['钉钉告警', alertConfig.dingtalk.enabled ? chalk.green('已启用') : chalk.red('已禁用')],
      ['邮件告警', alertConfig.email.enabled ? chalk.green('已启用') : chalk.red('已禁用')],
      ['当前标准', currentStandard.name]
    );

    console.log(table.toString());
  }

  async changeStandard(standards, currentStandard) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'standard',
        message: '请选择检测标准:',
        default: standards.findIndex(s => s.code === currentStandard.name.split(' ')[0]),
        choices: standards.map(s => ({
          name: `${s.code} - ${s.name} (生效日期: ${s.effectiveDate})`,
          value: s.code
        }))
      }
    ]);

    if (config.setCurrentStandard(answers.standard)) {
      console.log(chalk.green(`\n✓ 已切换到标准: ${answers.standard}`));
    } else {
      console.log(chalk.red('\n✗ 标准切换失败'));
    }
  }

  displayInspectionLines() {
    const lines = config.getActiveInspectionLines();

    console.log(chalk.cyan(`\n检测线列表 (共 ${lines.length} 条):\n`));

    const table = new Table({
      head: [chalk.cyan('编号'), chalk.cyan('名称'), chalk.cyan('类型'), chalk.cyan('环保账号'), chalk.cyan('状态')],
      colWidths: [12, 15, 15, 20, 10]
    });

    lines.forEach(line => {
      table.push([
        line.id,
        line.name,
        line.type,
        line.envAccount.username,
        line.active ? chalk.green('启用') : chalk.red('禁用')
      ]);
    });

    console.log(table.toString());
  }

  displayPerformanceConfig() {
    const perf = config.getPerformanceConfig();

    console.log(chalk.cyan('\n=== 性能配置 ===\n'));

    const table = new Table({
      head: [chalk.cyan('配置项'), chalk.cyan('值')],
      colWidths: [30, 30]
    });

    table.push(
      ['单台车最大处理时间', `${perf.maxProcessingTimePerVehicle / 1000}秒`],
      ['批量处理速率', `${perf.batchProcessingRatePerHour}台/小时`],
      ['页面操作超时', `${perf.pageTimeout / 1000}秒`],
      ['异常重试间隔', `${perf.retryInterval / 1000}秒`],
      ['最大内存占用', `${perf.maxMemoryMB}MB`],
      ['最大并行检测线', `${perf.maxConcurrentLines}条`],
      ['单日最大日志', `${perf.maxLogSizePerDayMB}MB`]
    );

    console.log(table.toString());
  }

  displayError(error) {
    const errorType = error.type || errorHandler.classifyError(error);
    const errorId = error.errorId || 'N/A';
    const severity = this.getErrorSeverity(errorType);
    
    console.log('\n');
    
    const borderColor = severity === 'critical' ? chalk.bgRed.white.bold :
                        severity === 'high' ? chalk.bgRedBright.white :
                        severity === 'medium' ? chalk.bgYellow.black :
                        chalk.bgWhite.black;
    
    const titleBar = borderColor(' 错误  ');
    const typeLabel = severity === 'critical' ? chalk.red.bold :
                      severity === 'high' ? chalk.red :
                      severity === 'medium' ? chalk.yellow :
                      chalk.gray;
    
    console.log(chalk.red('╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.red('║ ') + titleBar + chalk.red('                                         ║'));
    console.log(chalk.red('╠══════════════════════════════════════════════════════════╣'));
    
    console.log(chalk.red('║ ') + typeLabel(`错误类型: ${errorType}`) + ' '.repeat(50 - errorType.length - 8) + chalk.red('║'));
    console.log(chalk.red('║ ') + `错误ID: ${errorId}` + ' '.repeat(50 - errorId.length - 9) + chalk.red('║'));
    
    const messageLines = this.wrapText(error.message, 48);
    messageLines.forEach((line, idx) => {
      const prefix = idx === 0 ? '错误信息: ' : '          ';
      console.log(chalk.red('║ ') + chalk.bold(prefix) + line + ' '.repeat(Math.max(0, 48 - line.length - prefix.length)) + chalk.red('║'));
    });
    
    console.log(chalk.red('╠══════════════════════════════════════════════════════════╣'));
    
    const suggestions = this.getErrorSuggestions(errorType, error);
    if (suggestions.length > 0) {
      console.log(chalk.red('║ ') + chalk.cyan.bold('💡 建议操作:') + ' '.repeat(36) + chalk.red('║'));
      
      suggestions.forEach((s, i) => {
        const line = `${i + 1}. ${s}`;
        const wrapped = this.wrapText(line, 48);
        wrapped.forEach((wline, wi) => {
          const pad = ' '.repeat(Math.max(0, 48 - wline.length));
          console.log(chalk.red('║ ') + chalk.yellow(wline) + pad + chalk.red('║'));
        });
      });
    }
    
    console.log(chalk.red('╚══════════════════════════════════════════════════════════╝'));
    console.log('\n');
    
    if (error.stack && process.env.LOG_LEVEL === 'debug') {
      console.log(chalk.gray('堆栈信息:'));
      console.log(chalk.gray(error.stack));
      console.log('\n');
    }
  }

  getErrorSeverity(errorType) {
    const severityMap = {
      [ERROR_TYPES.NETWORK_INTERRUPTION]: 'high',
      [ERROR_TYPES.PLATFORM_MAINTENANCE]: 'medium',
      [ERROR_TYPES.CAPTCHA_FAILED]: 'low',
      [ERROR_TYPES.SESSION_EXPIRED]: 'medium',
      [ERROR_TYPES.VALIDATION_FAILED]: 'high',
      [ERROR_TYPES.TIMEOUT_ERROR]: 'medium',
      [ERROR_TYPES.UNKNOWN_ERROR]: 'critical'
    };
    return severityMap[errorType] || 'medium';
  }

  wrapText(text, maxWidth) {
    const lines = [];
    let current = '';
    
    const chars = Array.from(text);
    for (const char of chars) {
      if (current.length >= maxWidth) {
        lines.push(current);
        current = char;
      } else {
        current += char;
      }
    }
    if (current) lines.push(current);
    
    return lines.length ? lines : [''];
  }

  getErrorSuggestions(errorType, error = {}) {
    const suggestions = {
      [ERROR_TYPES.NETWORK_INTERRUPTION]: [
        '检查网络连接是否正常',
        '确认平台服务是否可访问',
        '等待网络恢复后重试',
        '查看网络代理或防火墙设置'
      ],
      [ERROR_TYPES.PLATFORM_MAINTENANCE]: [
        '平台正在维护中，请稍后再试',
        '查看平台通知公告',
        '任务已加入队列，将自动重试'
      ],
      [ERROR_TYPES.CAPTCHA_FAILED]: [
        '验证码识别失败',
        '请手动输入验证码',
        '刷新页面获取新验证码'
      ],
      [ERROR_TYPES.SESSION_EXPIRED]: [
        '登录会话已过期',
        '系统将自动重新登录',
        '请检查账号密码是否正确'
      ],
      [ERROR_TYPES.VALIDATION_FAILED]: [
        '检查输入数据格式是否正确',
        '确认必填字段是否已填写',
        '查看平台数据校验规则'
      ],
      [ERROR_TYPES.TIMEOUT_ERROR]: [
        '平台响应超时，请稍后重试',
        '检查网络连接速度',
        '确认平台服务状态'
      ],
      [ERROR_TYPES.UNKNOWN_ERROR]: [
        '请查看详细日志了解错误原因',
        '联系技术支持人员',
        '截图保存错误现场'
      ]
    };
    
    const baseSuggestions = suggestions[errorType] || suggestions[ERROR_TYPES.UNKNOWN_ERROR];
    const dynamicSuggestions = [];
    
    if (error?.context === 'login') {
      dynamicSuggestions.push('💡 登录失败：可尝试切换其他检测线账号');
    }
    
    if (error?.screenshotPath) {
      dynamicSuggestions.push(`📸 错误截图已保存: ${error.screenshotPath}`);
    }
    
    if (error?.retryCount !== undefined) {
      dynamicSuggestions.push(`🔄 已重试 ${error.retryCount} 次`);
    }
    
    return [...dynamicSuggestions, ...baseSuggestions];
  }

  async cleanupRunner() {
    if (this.currentRunner) {
      try {
        await this.currentRunner.close();
      } catch (e) {
        logger.warn('关闭检测执行器失败', e);
      }
      this.currentRunner = null;
    }
  }

  async cleanup() {
    await this.cleanupRunner();
    
    if (this.statsExporter) {
      try {
        await this.statsExporter.close();
      } catch (e) {
        logger.warn('关闭统计导出服务失败', e);
      }
      this.statsExporter = null;
    }
  }

  async exitSystem() {
    console.log(chalk.cyan('\n正在退出系统...'));
    await this.cleanup();
    console.log(chalk.green('✓ 系统已正常退出'));
    console.log(chalk.gray('感谢使用机动车排放检验自动化系统\n'));
  }

  async pressEnterToContinue() {
    console.log('');
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '按回车键返回主菜单...',
        filter: () => true
      }
    ]);
    console.clear();
    this.printWelcome();
  }
}

async function main() {
  const cli = new CLIManager();

  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n收到中断信号，正在退出...'));
    await cli.cleanup();
    process.exit(0);
  });

  process.on('uncaughtException', async (error) => {
    logger.error('未捕获的异常', error);
    console.log(chalk.red('\n发生未捕获的异常，请查看日志'));
    await cli.cleanup();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('未处理的Promise拒绝', { reason, promise });
  });

  try {
    await cli.start();
  } catch (error) {
    logger.error('系统启动失败', error);
    console.log(chalk.red('系统启动失败:', error.message));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { CLIManager };
