const inquirer = require('inquirer');
const chalk = require('chalk');
const figlet = require('figlet');
const boxen = require('boxen');
const ora = require('ora');
const cliProgress = require('cli-progress');
const dayjs = require('dayjs');
const { HOSPITALS, getHospitalById, getHospitalsByDept,
  updateHospitalConfig, updateHospitalDepartment,
  addHospitalDepartment, removeHospitalDepartment,
  updateSystemConfig } = require('../config/hospitals');
const { getScheduler } = require('./crawler/scheduler');
const { getPatientService } = require('./model/patient');
const { getAppointmentService } = require('./model/appointment');
const { getNotifierService } = require('./service/notifier');
const { getCaptchaService } = require('./service/captcha');
const { getStorage } = require('./utils/storage');
const { createLogger } = require('./utils/logger');

const logger = createLogger('CLI');

class CLIManager {
  constructor() {
    this.scheduler = null;
    this.patientService = null;
    this.appointmentService = null;
    this.notifierService = null;
    this.captchaService = null;
    this.storage = null;
    this.running = false;
  }

  async init() {
    const spinner = ora('初始化系统...').start();

    try {
      this.storage = await getStorage();
      this.patientService = await getPatientService();
      this.appointmentService = await getAppointmentService();
      this.notifierService = await getNotifierService();
      this.captchaService = await getCaptchaService();
      this.scheduler = await getScheduler();

      spinner.succeed('系统初始化完成');
      return true;
    } catch (err) {
      spinner.fail(`初始化失败: ${err.message}`);
      logger.error(`CLI初始化失败: ${err.message}`);
      throw err;
    }
  }

  async start() {
    console.clear();
    this._showBanner();

    if (!this.scheduler) {
      await this.init();
    }

    await this._showMainMenu();
  }

  _showBanner() {
    const banner = figlet.textSync('医疗号源监控', {
      font: 'Slant',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    });

    console.log(chalk.cyan(banner));
    console.log(chalk.gray('=' .repeat(60)));
    console.log(chalk.yellow('  区域医疗资源调度中心 - 专家号源动态监控系统 v1.0'));
    console.log(chalk.gray('=' .repeat(60)));
    console.log();
  }

  async _showMainMenu() {
    const stats = this.scheduler?.getStats() || {};
    const isRunning = this.scheduler?.running || false;

    const statusBox = boxen(
      [
        `${chalk.cyan('监控状态')}: ${isRunning ? chalk.green('● 运行中') : chalk.gray('○ 已停止')}`,
        `${chalk.cyan('活跃任务')}: ${chalk.yellow(stats.activeTasks || 0)} 个`,
        `${chalk.cyan('今日通知')}: ${chalk.magenta(stats.todayNotifications || 0)} 条`,
        `${chalk.cyan('活跃浏览器')}: ${chalk.blue(stats.activeBrowsers || 0)} 个`,
        `${chalk.cyan('爬取成功率')}: ${chalk.green(stats.successRate || 'N/A')}`,
      ].join('\n'),
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    );

    console.log(statusBox);

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作：',
        choices: [
          { name: `${isRunning ? '⏹  停止监控' : '▶  开始监控'}`, value: 'toggle_monitor' },
          { name: '🏥  查看医院列表', value: 'list_hospitals' },
          new inquirer.Separator(),
          { name: '👤  患者管理', value: 'patient_menu' },
          { name: '📅  查看可用号源', value: 'view_appointments' },
          { name: '📊  查看统计信息', value: 'view_stats' },
          new inquirer.Separator(),
          { name: '🔍  手动触发爬取', value: 'manual_crawl' },
          { name: '🔔  发送测试通知', value: 'test_notify' },
          new inquirer.Separator(),
          { name: '❌  退出系统', value: 'exit' }
        ],
        pageSize: 15
      }
    ]);

    await this._handleMenuAction(answers.action);
  }

  async _handleMenuAction(action) {
    switch (action) {
      case 'toggle_monitor':
        await this._toggleMonitor();
        break;
      case 'list_hospitals':
        await this._listHospitals();
        break;
      case 'patient_menu':
        await this._patientMenu();
        break;
      case 'view_appointments':
        await this._viewAppointments();
        break;
      case 'view_stats':
        await this._viewStats();
        break;
      case 'manual_crawl':
        await this._manualCrawl();
        break;
      case 'test_notify':
        await this._testNotify();
        break;
      case 'exit':
        await this._exit();
        return;
    }

    await this._showMainMenu();
  }

  async _toggleMonitor() {
    if (this.scheduler.running) {
      this.scheduler.stop();
      console.log(chalk.yellow('\n⏹  监控已停止\n'));
    } else {
      this.scheduler.start();
      console.log(chalk.green('\n▶  监控已启动\n'));
    }
    await this._pressEnter();
  }

  async _listHospitals() {
    console.log('\n' + chalk.cyan.bold('🏥  医院列表（共' + HOSPITALS.length + '家）') + '\n');

    HOSPITALS.forEach((hospital, index) => {
      const deptCount = Object.keys(hospital.departments).length;
      const hotCount = Object.values(hospital.departments).filter(d => d.hot).length;
      const captchaType = {
        'image': '图形验证码',
        'slider': '滑块验证',
        'none': '无验证'
      }[hospital.captchaType];

      const priorityStar = '★'.repeat(hospital.priority) + '☆'.repeat(3 - hospital.priority);

      console.log(`${chalk.yellow((index + 1).toString().padStart(2) + '.')} ` +
        `${chalk.white.bold(hospital.name)} ` +
        `${chalk.gray('(' + hospital.shortName + ')')}`);
      console.log(`     ${chalk.cyan('优先级:')} ${priorityStar}  ` +
        `${chalk.green('科室:')} ${deptCount}个 (热门${hotCount}个)  ` +
        `${chalk.magenta('验证:')} ${captchaType}  ` +
        `${chalk.blue('刷新:')} ${hospital.refreshInterval}秒`);
      console.log(`     ${chalk.gray('放号时间: ' + hospital.releaseSchedule.time + ' 提前' + hospital.releaseSchedule.daysAhead + '天')}`);
      console.log();
    });

    await this._pressEnter();
  }

  async _patientMenu() {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '患者管理与监控配置：',
        choices: [
          { name: '📋  查看患者列表', value: 'list' },
          { name: '➕  添加患者', value: 'add' },
          { name: '✏️   修改患者信息', value: 'edit' },
          { name: '🗑  停用患者', value: 'delete' },
          new inquirer.Separator('── 监控配置 ──'),
          { name: '⚙️   修改医院监控配置', value: 'monitor_config' },
          { name: '🏥  管理医院监控科室', value: 'dept_config' },
          { name: '🔐  修改医院账号信息', value: 'account_config' },
          { name: '�   系统全局配置', value: 'system_config' },
          new inquirer.Separator(),
          { name: '�  返回主菜单', value: 'back' }
        ]
      }
    ]);

    switch (answers.action) {
      case 'list':
        await this._listPatients();
        break;
      case 'add':
        await this._addPatient();
        break;
      case 'edit':
        await this._editPatient();
        break;
      case 'delete':
        await this._deletePatient();
        break;
      case 'monitor_config':
        await this._editHospitalMonitorConfig();
        break;
      case 'dept_config':
        await this._editHospitalDeptConfig();
        break;
      case 'account_config':
        await this._editHospitalAccountConfig();
        break;
      case 'system_config':
        await this._editSystemConfig();
        break;
      case 'back':
        return;
    }

    await this._patientMenu();
  }

  async _listPatients() {
    const spinner = ora('加载患者列表...').start();
    const patients = await this.patientService.listPatients();
    spinner.stop();

    if (patients.length === 0) {
      console.log(chalk.gray('\n暂无患者数据\n'));
    } else {
      console.log('\n' + chalk.cyan.bold('👤 患者列表（共' + patients.length + '人）') + '\n');

      patients.forEach((p, idx) => {
        const deptNames = p.departments?.map(d => {
          const hospital = HOSPITALS[0];
          return hospital?.departments[d]?.name || d;
        }).join('、') || '未设置';

        const priorityStr = '★'.repeat(p.priority) + '☆'.repeat(10 - p.priority);

        console.log(`${chalk.yellow((idx + 1) + '.')} ${chalk.bold(p.name)} ` +
          `${chalk.gray('(' + p.id.slice(0, 8) + '...)')}`);
        console.log(`   优先级: ${chalk.magenta(priorityStr)} ` +
          `关注科室: ${chalk.green(deptNames)}`);
        console.log(`   手机: ${chalk.blue(p.phone || '未设置')} ` +
          `邮箱: ${chalk.blue(p.email || '未设置')}`);
        console.log();
      });
    }

    await this._pressEnter();
  }

  async _addPatient() {
    const deptChoices = [];
    const allDepts = new Map();

    HOSPITALS.forEach(h => {
      Object.entries(h.departments).forEach(([key, dept]) => {
        if (!allDepts.has(key)) {
          allDepts.set(key, dept.name);
          deptChoices.push({ name: `${dept.name}${dept.hot ? ' 🔥' : ''}`, value: key, short: dept.name });
        }
      });
    });

    const answers = await inquirer.prompt([
      { type: 'input', name: 'name', message: '患者姓名：', validate: v => v.length > 0 || '请输入姓名' },
      { type: 'input', name: 'phone', message: '手机号码：', default: '' },
      { type: 'input', name: 'email', message: '邮箱地址：', default: '' },
      { type: 'input', name: 'idCard', message: '身份证号：', default: '' },
      {
        type: 'checkbox',
        name: 'departments',
        message: '关注科室（可多选）：',
        choices: deptChoices,
        validate: v => v.length > 0 || '请至少选择一个科室'
      },
      {
        type: 'list',
        name: 'expertLevel',
        message: '专家级别要求：',
        choices: [
          { name: '不限', value: 1 },
          { name: '主治医师及以上', value: 3 },
          { name: '副主任医师及以上', value: 4 },
          { name: '主任医师/专家', value: 5 },
          { name: '特需门诊', value: 6 }
        ],
        default: 3
      },
      {
        type: 'input',
        name: 'priority',
        message: '优先级（1-10，越高越优先）：',
        default: '5',
        validate: v => {
          const n = parseInt(v);
          return (!isNaN(n) && n >= 1 && n <= 10) || '请输入1-10之间的数字';
        }
      }
    ]);

    const spinner = ora('添加患者...').start();
    try {
      const patient = await this.patientService.addPatient({
        name: answers.name,
        phone: answers.phone || null,
        email: answers.email || null,
        idCard: answers.idCard || null,
        departments: answers.departments,
        expertLevel: answers.expertLevel,
        priority: parseInt(answers.priority)
      });
      spinner.succeed(`患者添加成功: ${patient.name} (${patient.id})`);
    } catch (err) {
      spinner.fail(`添加失败: ${err.message}`);
    }

    await this._pressEnter();
  }

  async _editPatient() {
    const patients = await this.patientService.listPatients();
    if (patients.length === 0) {
      console.log(chalk.gray('\n暂无患者数据\n'));
      await this._pressEnter();
      return;
    }

    const choices = patients.map(p => ({
      name: `${p.name} - ${p.departments?.join('、') || '未设置科室'}`,
      value: p.id
    }));

    const { patientId } = await inquirer.prompt([
      { type: 'list', name: 'patientId', message: '选择要修改的患者：', choices }
    ]);

    const patient = await this.patientService.getPatient(patientId);

    const { field } = await inquirer.prompt([
      {
        type: 'list',
        name: 'field',
        message: '选择要修改的字段：',
        choices: [
          { name: '姓名', value: 'name' },
          { name: '手机号码', value: 'phone' },
          { name: '邮箱', value: 'email' },
          { name: '关注科室', value: 'departments' },
          { name: '专家级别', value: 'expertLevel' },
          { name: '优先级', value: 'priority' }
        ]
      }
    ]);

    let newValue;

    if (field === 'departments') {
      const allDepts = new Map();
      HOSPITALS.forEach(h => {
        Object.entries(h.departments).forEach(([key, dept]) => {
          if (!allDepts.has(key)) {
            allDepts.set(key, dept.name);
          }
        });
      });
      const deptChoices = Array.from(allDepts.entries()).map(([key, name]) => ({
        name, value: key
      }));

      const result = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'departments',
          message: '关注科室：',
          choices: deptChoices,
          default: patient.departments
        }
      ]);
      newValue = result.departments;
    } else if (field === 'expertLevel') {
      const result = await inquirer.prompt([
        {
          type: 'list',
          name: 'expertLevel',
          message: '专家级别要求：',
          choices: [
            { name: '不限', value: 1 },
            { name: '主治医师及以上', value: 3 },
            { name: '副主任医师及以上', value: 4 },
            { name: '主任医师/专家', value: 5 }
          ]
        }
      ]);
      newValue = result.expertLevel;
    } else {
      const result = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: `新的${field}：`,
          default: patient[field] || ''
        }
      ]);
      newValue = field === 'priority' ? parseInt(result.value) : result.value;
    }

    const spinner = ora('更新患者信息...').start();
    try {
      await this.patientService.updatePatient(patientId, { [field]: newValue });
      spinner.succeed('更新成功');
    } catch (err) {
      spinner.fail(`更新失败: ${err.message}`);
    }

    await this._pressEnter();
  }

  async _deletePatient() {
    const patients = await this.patientService.listPatients();
    if (patients.length === 0) {
      console.log(chalk.gray('\n暂无患者数据\n'));
      await this._pressEnter();
      return;
    }

    const choices = patients.map(p => ({
      name: `${p.name} - ${p.departments?.join('、') || '未设置科室'}`,
      value: p.id
    }));

    const { patientId } = await inquirer.prompt([
      { type: 'list', name: 'patientId', message: '选择要停用的患者：', choices }
    ]);

    const { confirm } = await inquirer.prompt([
      { type: 'confirm', name: 'confirm', message: '确认要停用该患者吗？', default: false }
    ]);

    if (confirm) {
      const spinner = ora('停用患者...').start();
      try {
        await this.patientService.deletePatient(patientId);
        spinner.succeed('患者已停用');
      } catch (err) {
        spinner.fail(`操作失败: ${err.message}`);
      }
    }

    await this._pressEnter();
  }

  async _editHospitalMonitorConfig() {
    const choices = HOSPITALS.map(h => ({
      name: `${h.name} (刷新:${h.refreshInterval}s 优先级:${'★'.repeat(h.priority)})`,
      value: h.id
    }));

    const { hospitalId } = await inquirer.prompt([
      { type: 'list', name: 'hospitalId', message: '选择要修改配置的医院：', choices }
    ]);

    const hospital = getHospitalById(hospitalId);

    const captchaLabels = { image: '图形验证码', slider: '滑块验证', none: '无验证' };

    console.log('\n' + chalk.cyan.bold('当前配置：'));
    console.log(`  刷新间隔: ${chalk.yellow(hospital.refreshInterval + '秒')}`);
    console.log(`  优先级: ${chalk.magenta('★'.repeat(hospital.priority) + '☆'.repeat(3 - hospital.priority))}`);
    console.log(`  验证码类型: ${chalk.green(captchaLabels[hospital.captchaType])}`);
    console.log(`  最大重试: ${chalk.blue(hospital.maxRetries + '次')}`);
    console.log(`  限流频率: ${chalk.gray(hospital.rateLimit + '次/分钟')}`);
    console.log(`  放号时间: ${chalk.cyan(hospital.releaseSchedule.time)} (提前${hospital.releaseSchedule.daysAhead}天)`);
    console.log();

    const { field } = await inquirer.prompt([
      {
        type: 'list',
        name: 'field',
        message: '选择要修改的配置项：',
        choices: [
          { name: '刷新间隔（秒）', value: 'refreshInterval' },
          { name: '优先级（1-3）', value: 'priority' },
          { name: '验证码类型', value: 'captchaType' },
          { name: '最大重试次数', value: 'maxRetries' },
          { name: '限流频率（次/分钟）', value: 'rateLimit' },
          { name: '放号时间', value: 'releaseTime' },
          { name: '提前放号天数', value: 'daysAhead' },
          { name: '取消', value: 'cancel' }
        ]
      }
    ]);

    if (field === 'cancel') {
      return;
    }

    let newValue;

    if (field === 'captchaType') {
      const result = await inquirer.prompt([
        {
          type: 'list',
          name: 'captchaType',
          message: '验证码类型：',
          choices: [
            { name: '图形验证码', value: 'image' },
            { name: '滑块验证', value: 'slider' },
            { name: '无验证', value: 'none' }
          ],
          default: hospital.captchaType
        }
      ]);
      newValue = result.captchaType;
    } else if (field === 'releaseTime') {
      const result = await inquirer.prompt([
        {
          type: 'input',
          name: 'time',
          message: '放号时间（格式 HH:mm，如 08:00）：',
          default: hospital.releaseSchedule.time,
          validate: v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v) || '请输入正确的时间格式 HH:mm'
        }
      ]);
      updateHospitalConfig(hospitalId, { releaseSchedule: { time: result.time } });
      console.log(chalk.green('\n✓ 放号时间已更新为: ' + result.time));
      await this._pressEnter();
      return;
    } else if (field === 'daysAhead') {
      const result = await inquirer.prompt([
        {
          type: 'input',
          name: 'daysAhead',
          message: '提前放号天数：',
          default: String(hospital.releaseSchedule.daysAhead),
          validate: v => {
            const n = parseInt(v);
            return (!isNaN(n) && n >= 1 && n <= 30) || '请输入1-30之间的数字';
          }
        }
      ]);
      updateHospitalConfig(hospitalId, { releaseSchedule: { daysAhead: parseInt(result.daysAhead) } });
      console.log(chalk.green('\n✓ 提前放号天数已更新为: ' + result.daysAhead));
      await this._pressEnter();
      return;
    } else if (field === 'priority') {
      const result = await inquirer.prompt([
        {
          type: 'input',
          name: 'priority',
          message: '优先级（1-3，数字越大越优先）：',
          default: String(hospital.priority),
          validate: v => {
            const n = parseInt(v);
            return (!isNaN(n) && n >= 1 && n <= 3) || '请输入1-3之间的数字';
          }
        }
      ]);
      newValue = parseInt(result.priority);
    } else {
      const labels = {
        refreshInterval: '刷新间隔（秒）',
        maxRetries: '最大重试次数',
        rateLimit: '限流频率（次/分钟）'
      };
      const defaults = {
        refreshInterval: String(hospital.refreshInterval),
        maxRetries: String(hospital.maxRetries),
        rateLimit: String(hospital.rateLimit)
      };
      const result = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: labels[field] + '：',
          default: defaults[field],
          validate: v => {
            const n = parseInt(v);
            return (!isNaN(n) && n > 0) || '请输入大于0的数字';
          }
        }
      ]);
      newValue = parseInt(result.value);
    }

    updateHospitalConfig(hospitalId, { [field]: newValue });
    console.log(chalk.green('\n✓ 配置更新成功！'));

    await this._pressEnter();
  }

  async _editHospitalDeptConfig() {
    const hospitalChoices = HOSPITALS.map(h => ({
      name: `${h.name} (${Object.keys(h.departments).length}个科室)`,
      value: h.id
    }));

    const { hospitalId } = await inquirer.prompt([
      { type: 'list', name: 'hospitalId', message: '选择医院：', choices: hospitalChoices }
    ]);

    const hospital = getHospitalById(hospitalId);

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `${hospital.name}科室管理：`,
        choices: [
          { name: '📋  查看科室列表', value: 'list' },
          { name: '✏️   修改科室配置（热门标记、名称、代码）', value: 'edit' },
          { name: '➕  添加监控科室', value: 'add' },
          { name: '🗑  移除监控科室', value: 'remove' },
          { name: '🔙  返回', value: 'back' }
        ]
      }
    ]);

    if (action === 'back') return;

    if (action === 'list') {
      console.log('\n' + chalk.cyan.bold(`${hospital.name}科室列表：`) + '\n');
      Object.entries(hospital.departments).forEach(([key, dept], idx) => {
        console.log(`${chalk.yellow((idx + 1) + '.')} ${chalk.bold(dept.name)} ` +
          `[${key}]  代码: ${chalk.gray(dept.code)}  ` +
          `${dept.hot ? chalk.red('🔥 热门') : chalk.gray('普通')}`);
      });
      console.log();
      await this._pressEnter();
      return;
    }

    if (action === 'add') {
      const answers = await inquirer.prompt([
        { type: 'input', name: 'key', message: '科室英文标识（如 cardiology）：', validate: v => v.length > 0 || '必填' },
        { type: 'input', name: 'name', message: '科室中文名称：', validate: v => v.length > 0 || '必填' },
        { type: 'input', name: 'code', message: '科室代码：', validate: v => v.length > 0 || '必填' },
        { type: 'confirm', name: 'hot', message: '是否标记为热门科室？', default: false }
      ]);

      try {
        addHospitalDepartment(hospitalId, answers.key, {
          name: answers.name,
          code: answers.code,
          hot: answers.hot
        });
        console.log(chalk.green('\n✓ 科室添加成功: ' + answers.name));
      } catch (err) {
        console.log(chalk.red('\n✗ 添加失败: ' + err.message));
      }
      await this._pressEnter();
      return;
    }

    const deptChoices = Object.entries(hospital.departments).map(([key, dept]) => ({
      name: `${dept.name} ${dept.hot ? '🔥' : ''}`,
      value: key
    }));

    if (action === 'remove') {
      const { deptKey } = await inquirer.prompt([
        { type: 'list', name: 'deptKey', message: '选择要移除的科室：', choices: deptChoices }
      ]);

      const { confirm } = await inquirer.prompt([
        { type: 'confirm', name: 'confirm', message: `确认移除科室 ${hospital.departments[deptKey].name}？`, default: false }
      ]);

      if (confirm) {
        try {
          removeHospitalDepartment(hospitalId, deptKey);
          console.log(chalk.green('\n✓ 科室已移除'));
        } catch (err) {
          console.log(chalk.red('\n✗ 移除失败: ' + err.message));
        }
      }
      await this._pressEnter();
      return;
    }

    if (action === 'edit') {
      const { deptKey } = await inquirer.prompt([
        { type: 'list', name: 'deptKey', message: '选择要修改的科室：', choices: deptChoices }
      ]);

      const dept = hospital.departments[deptKey];

      const { field } = await inquirer.prompt([
        {
          type: 'list',
          name: 'field',
          message: '选择要修改的字段：',
          choices: [
            { name: '科室名称', value: 'name' },
            { name: '科室代码', value: 'code' },
            { name: '热门标记', value: 'hot' },
            { name: '取消', value: 'cancel' }
          ]
        }
      ]);

      if (field === 'cancel') return;

      if (field === 'hot') {
        const { hot } = await inquirer.prompt([
          { type: 'confirm', name: 'hot', message: '是否标记为热门科室？', default: dept.hot }
        ]);
        updateHospitalDepartment(hospitalId, deptKey, { hot });
      } else {
        const labels = { name: '科室名称', code: '科室代码' };
        const { value } = await inquirer.prompt([
          { type: 'input', name: 'value', message: labels[field] + '：', default: dept[field], validate: v => v.length > 0 || '必填' }
        ]);
        updateHospitalDepartment(hospitalId, deptKey, { [field]: value });
      }

      console.log(chalk.green('\n✓ 科室配置更新成功'));
      await this._pressEnter();
      return;
    }
  }

  async _editHospitalAccountConfig() {
    const choices = HOSPITALS.map(h => {
      const accountType = h.account.username ? '用户名/密码' : '手机号/SMS';
      return {
        name: `${h.name} (${accountType})`,
        value: h.id
      };
    });

    const { hospitalId } = await inquirer.prompt([
      { type: 'list', name: 'hospitalId', message: '选择医院：', choices }
    ]);

    const hospital = getHospitalById(hospitalId);
    const account = hospital.account;

    console.log('\n' + chalk.cyan.bold(`${hospital.name} 当前账号配置：`));
    if (account.username) {
      console.log(`  登录方式: ${chalk.yellow('用户名/密码')}`);
      console.log(`  用户名: ${chalk.green(account.username)}`);
      console.log(`  密码: ${chalk.gray('*'.repeat(account.password?.length || 0))}`);
    }
    if (account.phone) {
      console.log(`  登录方式: ${chalk.yellow('手机号/SMS')}`);
      console.log(`  手机号: ${chalk.green(account.phone)}`);
    }
    console.log();

    if (account.username) {
      const answers = await inquirer.prompt([
        { type: 'input', name: 'username', message: '用户名：', default: account.username },
        { type: 'input', name: 'password', message: '密码：', default: account.password }
      ]);
      updateHospitalConfig(hospitalId, { account: answers });
    } else {
      const answers = await inquirer.prompt([
        { type: 'input', name: 'phone', message: '手机号：', default: account.phone }
      ]);
      updateHospitalConfig(hospitalId, { account: answers });
    }

    console.log(chalk.green('\n✓ 账号配置更新成功'));

    const { reset } = await inquirer.prompt([
      { type: 'confirm', name: 'reset', message: '是否需要重置当前浏览器会话？配置更改后需要重新登录。', default: true }
    ]);

    if (reset && this.scheduler) {
      const crawler = this.scheduler.crawlers.get(hospitalId);
      if (crawler) {
        try {
          await crawler.close();
          this.scheduler.crawlers.delete(hospitalId);
          console.log(chalk.green('浏览器会话已重置，下次爬取将使用新账号登录'));
        } catch (e) {}
      }
    }

    await this._pressEnter();
  }

  async _editSystemConfig() {
    const { SYSTEM_CONFIG } = require('../config/hospitals');

    console.log('\n' + chalk.cyan.bold('当前系统全局配置：'));
    console.log(`  最大浏览器实例: ${chalk.yellow(SYSTEM_CONFIG.maxBrowsers + '个')}`);
    console.log(`  无头模式: ${SYSTEM_CONFIG.headless ? chalk.green('开启') : chalk.gray('关闭')}`);
    console.log(`  页面超时: ${chalk.blue(SYSTEM_CONFIG.pageTimeout + 'ms')}`);
    console.log(`  最大重试次数: ${chalk.magenta(SYSTEM_CONFIG.maxRetries + '次')}`);
    console.log(`  数据保留天数: ${chalk.gray(SYSTEM_CONFIG.dataRetentionDays + '天')}`);
    console.log();

    const { field } = await inquirer.prompt([
      {
        type: 'list',
        name: 'field',
        message: '选择要修改的全局配置：',
        choices: [
          { name: '最大浏览器实例数', value: 'maxBrowsers' },
          { name: '无头模式（headless）', value: 'headless' },
          { name: '页面加载超时时间（毫秒）', value: 'pageTimeout' },
          { name: '最大重试次数', value: 'maxRetries' },
          { name: '数据保留天数', value: 'dataRetentionDays' },
          { name: '取消', value: 'cancel' }
        ]
      }
    ]);

    if (field === 'cancel') return;

    if (field === 'headless') {
      const { value } = await inquirer.prompt([
        { type: 'confirm', name: 'value', message: '是否启用无头模式？（不显示浏览器窗口）', default: SYSTEM_CONFIG.headless }
      ]);
      updateSystemConfig({ headless: value });
    } else {
      const labels = {
        maxBrowsers: '最大浏览器实例数（1-10）',
        pageTimeout: '页面超时时间（毫秒，如30000）',
        maxRetries: '最大重试次数（1-10）',
        dataRetentionDays: '数据保留天数（1-365）'
      };
      const ranges = {
        maxBrowsers: [1, 10],
        pageTimeout: [5000, 120000],
        maxRetries: [1, 10],
        dataRetentionDays: [1, 365]
      };
      const { value } = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: labels[field] + '：',
          default: String(SYSTEM_CONFIG[field]),
          validate: v => {
            const n = parseInt(v);
            const [min, max] = ranges[field];
            return (!isNaN(n) && n >= min && n <= max) || `请输入${min}-${max}之间的数字`;
          }
        }
      ]);
      updateSystemConfig({ [field]: parseInt(value) });
    }

    console.log(chalk.green('\n✓ 系统配置更新成功！（新建的浏览器实例会使用新配置）'));
    await this._pressEnter();
  }

  async _viewAppointments() {
    const hospitalChoices = [
      { name: '全部医院', value: 'all' },
      ...HOSPITALS.map(h => ({ name: h.name, value: h.id }))
    ];

    const { hospitalId } = await inquirer.prompt([
      { type: 'list', name: 'hospitalId', message: '选择医院：', choices: hospitalChoices }
    ]);

    const filters = {};
    if (hospitalId !== 'all') {
      filters.hospitalId = hospitalId;
    }

    const spinner = ora('查询号源数据...').start();
    const appointments = await this.appointmentService.getAvailableAppointments(filters);
    spinner.stop();

    if (appointments.length === 0) {
      console.log(chalk.gray('\n暂无可用号源\n'));
    } else {
      console.log('\n' + chalk.cyan.bold('📅 可用号源列表（共' + appointments.length + '条') + '\n'));

      const progressBar = new cliProgress.SingleBar({
        format: '号源处理进度 |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} 条',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });

      progressBar.start(appointments.length, 0);

      appointments.forEach((appt, idx) => {
        if (idx < 20) {
          console.log(`${chalk.yellow((idx + 1) + '.')} ${chalk.bold(appt.hospitalName)} - ${appt.departmentName}`);
          console.log(`   ${chalk.green(appt.doctorName || '待分配')} ` +
            `${chalk.magenta(appt.appointmentDate)} ` +
            `${chalk.blue(appt.timeSlot || '全天')} ` +
            `${chalk.red('余' + appt.availableCount + '号')}`);
        }
        progressBar.update(idx + 1);
      });

      progressBar.stop();

      if (appointments.length > 20) {
        console.log(chalk.gray(`\n... 还有 ${appointments.length - 20} 条记录未显示`));
      }
      console.log();
    }

    await this._pressEnter();
  }

  async _viewStats() {
    const stats = this.scheduler?.getStats() || {};
    const captchaStats = this.captchaService?.getStats() || {};
    const notifierStats = this.notifierService?.getStats() || {};

    console.log('\n' + chalk.cyan.bold('📊 系统统计信息') + '\n');

    const uptimeStr = stats.uptime ? this._formatUptime(stats.uptime) : '未运行';

    const statsBox = boxen(
      [
        chalk.white.bold('【运行状态】'),
        `  运行时长: ${chalk.green(uptimeStr)}`,
        `  活跃任务: ${chalk.yellow(stats.activeTasks || 0)} 个`,
        `  活跃浏览器: ${chalk.blue(stats.activeBrowsers || 0)} 个`,
        `  等待队列: ${chalk.magenta(stats.queueSize || 0)} 个`,
        `  任务数量: ${chalk.cyan(stats.activeJobs || 0)} 个`,
        '',
        chalk.white.bold('【爬取统计】'),
        `  总爬取次数: ${chalk.yellow(stats.totalCrawls || 0)}`,
        `  成功次数: ${chalk.green(stats.successCrawls || 0)}`,
        `  失败次数: ${chalk.red(stats.failedCrawls || 0)}`,
        `  成功率: ${chalk.cyan(stats.successRate || 'N/A')}`,
        '',
        chalk.white.bold('【通知统计】'),
        `  今日通知: ${chalk.magenta(stats.todayNotifications || 0)} 条`,
        `  总通知: ${notifierStats.total || 0} 条`,
        `  成功率: ${notifierStats.successRate || 'N/A'}`,
        '',
        chalk.white.bold('【验证码统计】'),
        `  图形识别: ${captchaStats.image?.successRate || 'N/A'} 成功率`,
        `  滑块验证: ${captchaStats.slider?.successRate || 'N/A'} 成功率`,
        `  平均耗时: ${captchaStats.image?.avgTime?.toFixed?.(0) || 'N/A'}ms`,
      ].join('\n'),
      {
        padding: 1,
        borderStyle: 'double',
        borderColor: 'cyan',
        backgroundColor: '#000022'
      }
    );

    console.log(statsBox);

    await this._pressEnter();
  }

  async _manualCrawl() {
    const choices = HOSPITALS.map(h => ({ name: h.name, value: h.id }));
    choices.unshift({ name: '全部医院所有科室', value: 'all' });

    const { hospitalId } = await inquirer.prompt([
      { type: 'list', name: 'hospitalId', message: '选择医院：', choices }
    ]);

    if (hospitalId === 'all') {
      const { confirm } = await inquirer.prompt([
        { type: 'confirm', name: 'confirm', message: '确认爬取全部医院所有科室？这可能需要较长时间。', default: false }
      ]);

      if (!confirm) return;

      const spinner = ora('正在爬取全部医院号源...').start();
      try {
        const results = await this.scheduler.crawlAll();
        const successCount = results.filter(r => r.success).length;
        spinner.succeed(`爬取完成，成功 ${successCount}/${results.length}`);
      } catch (err) {
        spinner.fail(`爬取失败: ${err.message}`);
      }
    } else {
      const hospital = getHospitalById(hospitalId);
      const deptChoices = Object.entries(hospital.departments).map(([key, dept]) => ({
        name: `${dept.name}${dept.hot ? ' 🔥' : ''}`,
        value: key
      }));

      const { department } = await inquirer.prompt([
        { type: 'list', name: 'department', message: '选择科室：', choices: deptChoices }
      ]);

      const spinner = ora(`正在爬取 ${hospital.name} - ${hospital.departments[department].name}...`).start();
      try {
        const result = await this.scheduler.manualCrawl(hospitalId, department);
        if (result.success) {
          spinner.succeed(`爬取完成，发现 ${result.appointments.length} 条号源`);
        } else {
          spinner.fail(`爬取失败: ${result.error}`);
        }
      } catch (err) {
        spinner.fail(`爬取失败: ${err.message}`);
      }
    }

    await this._pressEnter();
  }

  async _testNotify() {
    const patients = await this.patientService.listPatients();

    if (patients.length === 0) {
      console.log(chalk.gray('\n暂无患者数据，请先添加患者\n'));
      await this._pressEnter();
      return;
    }

    const choices = patients.map(p => ({ name: p.name, value: p.id }));

    const { patientId } = await inquirer.prompt([
      { type: 'list', name: 'patientId', message: '选择接收测试通知的患者：', choices }
    ]);

    const patient = await this.patientService.getPatient(patientId);

    const testAppt = {
      id: 'test-' + Date.now(),
      hospitalId: 'h001',
      hospitalName: '北京协和医院',
      department: 'cardiology',
      departmentName: '心内科',
      doctorName: '张教授',
      expertLevel: 5,
      appointmentDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
      timeSlot: '上午 09:00-10:00',
      availableCount: 2,
      fee: 300,
      sourceUrl: 'https://www.pumch.cn/guahao'
    };

    const spinner = ora('发送测试通知...').start();
    try {
      const result = await this.notifierService.notify(patient, testAppt);
      const successChannels = result.channels.filter(c => c.success).length;
      spinner.succeed(`通知发送完成，成功 ${successChannels}/${result.totalChannels} 个渠道`);

      result.channels.forEach(ch => {
        const status = ch.success ? chalk.green('✓ 成功') : chalk.red('✗ 失败');
        const sim = ch.simulated ? chalk.gray(' (模拟)') : '';
        console.log(`  ${chalk.cyan(ch.channel)}: ${status}${sim}`);
      });
    } catch (err) {
      spinner.fail(`通知发送失败: ${err.message}`);
    }

    await this._pressEnter();
  }

  async _exit() {
    console.log('\n');
    const spinner = ora('正在关闭系统...').start();

    if (this.scheduler) {
      await this.scheduler.close();
    }
    if (this.captchaService) {
      await this.captchaService.close();
    }
    if (this.storage) {
      await this.storage.close();
    }

    spinner.succeed('系统已安全关闭');
    console.log(chalk.cyan('\n感谢使用医疗号源监控系统，再见！\n'));

    process.exit(0);
  }

  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}天${hours % 24}小时${minutes % 60}分`;
    } else if (hours > 0) {
      return `${hours}小时${minutes % 60}分${seconds % 60}秒`;
    } else if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  async _pressEnter() {
    await inquirer.prompt([
      { type: 'input', name: '_', message: chalk.gray('按回车键继续...'), default: '' }
    ]);
    console.clear();
    this._showBanner();
  }
}

let cliInstance = null;

async function getCLI() {
  if (!cliInstance) {
    cliInstance = new CLIManager();
  }
  return cliInstance;
}

module.exports = {
  CLIManager,
  getCLI,
  default: CLIManager
};
