const XLSX = require('xlsx');
const cheerio = require('cheerio');
const path = require('path');
const dayjs = require('dayjs');
const fs = require('fs');
const cron = require('node-cron');
const { logger, audit, OperationTracer } = require('./logger');
const config = require('./config');
const { errorHandler, ERROR_TYPES, InspectionError } = require('./errorHandler');
const { createDriver, By, until } = require('./webdriver/adapter');

const REPORT_TYPES = {
  MONTHLY_SUMMARY: {
    name: '月度检测汇总表',
    url: '/stats/monthly',
    description: '按月统计检测数量、合格数、合格率'
  },
  VEHICLE_TYPE_STATS: {
    name: '车型分布统计表',
    url: '/stats/vehicle-type',
    description: '按车型统计检测数量和超标率'
  },
  FUEL_TYPE_STATS: {
    name: '燃料类型统计表',
    url: '/stats/fuel-type',
    description: '按燃料类型统计检测数量和超标率'
  },
  METHOD_STATS: {
    name: '检测方法统计表',
    url: '/stats/method',
    description: '按检测方法统计检测数量和合格率'
  },
  FAILURE_DETAIL: {
    name: '不合格车辆明细表',
    url: '/stats/failure-detail',
    description: '不合格车辆详细信息列表'
  }
};

class StatsExporter {
  constructor(inspectionLineId = null) {
    this.inspectionLine = inspectionLineId ? config.getInspectionLine(inspectionLineId) : null;
    this.driver = null;
    this.isLoggedIn = false;
    this.platformConfig = config.getPlatformConfig('environmental');
    this.dataDir = path.join(__dirname, '..', 'data');
    this.scheduledTasks = new Map();
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async init() {
    const tracer = new OperationTracer('初始化统计导出服务', {});

    try {
      tracer.logStep('创建Chrome浏览器实例 (WebdriverIO)');
      
      this.driver = createDriver({ platform: 'environmental' });
      await this.driver.init();

      await this.driver.manage().setTimeouts({
        pageLoad: this.platformConfig.pageTimeout,
        script: this.platformConfig.pageTimeout,
        implicit: 5000
      });

      tracer.logStep('浏览器初始化完成');
      tracer.complete('success');
      return true;
    } catch (error) {
      tracer.fail('浏览器初始化失败', { stack: error.stack });
      await errorHandler.handle(error, {});
      throw error;
    }
  }

  async login() {
    const tracer = new OperationTracer('环保平台登录（统计导出）', {});

    if (this.isLoggedIn) {
      tracer.logStep('已登录，跳过登录流程');
      return true;
    }

    const account = this.inspectionLine?.envAccount || {
      username: process.env.ENV_ADMIN_USER || 'admin',
      password: process.env.ENV_ADMIN_PASS || '******'
    };

    return errorHandler.retryWithStrategy(async (attempt) => {
      tracer.logStep(`第 ${attempt} 次登录尝试`);

      try {
        const loginUrl = this.platformConfig.baseUrl + this.platformConfig.loginUrl;
        tracer.logStep(`访问登录页面: ${loginUrl}`);
        await this.driver.get(loginUrl);

        const selectors = this.platformConfig.selectors;

        tracer.logStep('输入用户名');
        await this.driver.wait(until.elementLocated(By.css(selectors.usernameInput)), 10000);
        await this.driver.findElement(By.css(selectors.usernameInput)).clear();
        await this.driver.findElement(By.css(selectors.usernameInput)).sendKeys(account.username);

        tracer.logStep('输入密码');
        await this.driver.findElement(By.css(selectors.passwordInput)).clear();
        await this.driver.findElement(By.css(selectors.passwordInput)).sendKeys(account.password);

        tracer.logStep('处理验证码');
        const captcha = await this.handleCaptcha(selectors);
        if (captcha) {
          await this.driver.findElement(By.css(selectors.captchaInput)).clear();
          await this.driver.findElement(By.css(selectors.captchaInput)).sendKeys(captcha);
        }

        tracer.logStep('提交登录');
        await this.driver.findElement(By.css(selectors.loginButton)).click();

        await this.verifyLogin();
        this.isLoggedIn = true;

        audit.login('env_platform', account.username, 'stats_exporter', true);
        tracer.complete('success');
        return true;
      } catch (error) {
        audit.login('env_platform', account.username, 'stats_exporter', false, error.message);
        throw error;
      }
    }, { driver: this.driver });
  }

  async handleCaptcha(selectors) {
    try {
      const captchaImg = await this.driver.findElement(By.css(selectors.captchaImage));
      const isDisplayed = await captchaImg.isDisplayed();
      if (!isDisplayed) return null;
      return null;
    } catch (error) {
      return null;
    }
  }

  async verifyLogin() {
    try {
      await this.driver.wait(async () => {
        const currentUrl = await this.driver.getCurrentUrl();
        return !currentUrl.includes('login');
      }, 10000);
      logger.info('环保平台登录验证成功（统计导出）');
      return true;
    } catch (error) {
      throw new InspectionError(
        ERROR_TYPES.SESSION_EXPIRED,
        '登录验证失败: ' + error.message
      );
    }
  }

  async ensureLoggedIn() {
    if (!this.isLoggedIn) {
      await this.login();
    }

    try {
      await this.driver.executeScript('return document.readyState');
    } catch (error) {
      logger.warn('会话可能已过期，尝试重新登录');
      this.isLoggedIn = false;
      await this.login();
    }
  }

  async exportMonthlyStats(year, month) {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const tracer = new OperationTracer(`导出月度统计报表: ${period}`, {});

    return errorHandler.retryWithStrategy(async (attempt) => {
      tracer.logStep(`第 ${attempt} 次导出尝试`);
      await this.ensureLoggedIn();

      try {
        tracer.logStep(`访问统计页面，查询 ${period} 数据`);
        const reportConfig = REPORT_TYPES.MONTHLY_SUMMARY;
        const url = `${this.platformConfig.baseUrl}${reportConfig.url}?year=${year}&month=${month}`;
        await this.driver.get(url);

        await this.driver.wait(until.elementLocated(By.css('.stats-table')), 20000);
        await this.sleep(2000);

        tracer.logStep('提取HTML表格数据');
        const htmlContent = await this.driver.getPageSource();
        const tables = this.parseHtmlTables(htmlContent);

        if (tables.length === 0) {
          throw new InspectionError(
            ERROR_TYPES.VALIDATION_FAILED,
            '未找到统计报表数据'
          );
        }

        tracer.logStep('补充计算分析数据');
        const processedData = this.processMonthlyData(tables, year, month);

        tracer.logStep('生成Excel文件');
        const excelPath = this.generateExcel(processedData, '月度检测汇总表', period);

        audit.exportReport(period, 'MONTHLY_SUMMARY', excelPath, true);
        tracer.complete('success', { period, excelPath });

        return {
          success: true,
          period,
          excelPath,
          data: processedData
        };
      } catch (error) {
        audit.exportReport(period, 'MONTHLY_SUMMARY', null, false, error.message);
        throw error;
      }
    }, { driver: this.driver });
  }

  async exportVehicleTypeStats(year, month) {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const tracer = new OperationTracer(`导出车型分布统计: ${period}`, {});

    return errorHandler.retryWithStrategy(async (attempt) => {
      tracer.logStep(`第 ${attempt} 次导出尝试`);
      await this.ensureLoggedIn();

      try {
        const reportConfig = REPORT_TYPES.VEHICLE_TYPE_STATS;
        const url = `${this.platformConfig.baseUrl}${reportConfig.url}?year=${year}&month=${month}`;
        await this.driver.get(url);

        await this.driver.wait(until.elementLocated(By.css('.stats-table')), 20000);
        await this.sleep(2000);

        const htmlContent = await this.driver.getPageSource();
        const tables = this.parseHtmlTables(htmlContent);

        const processedData = this.processVehicleTypeData(tables);
        const excelPath = this.generateExcel(processedData, '车型分布统计表', period);

        audit.exportReport(period, 'VEHICLE_TYPE_STATS', excelPath, true);
        tracer.complete('success', { period, excelPath });

        return {
          success: true,
          period,
          excelPath,
          data: processedData
        };
      } catch (error) {
        audit.exportReport(period, 'VEHICLE_TYPE_STATS', null, false, error.message);
        throw error;
      }
    }, { driver: this.driver });
  }

  async exportFuelTypeStats(year, month) {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const tracer = new OperationTracer(`导出燃料类型统计: ${period}`, {});

    return errorHandler.retryWithStrategy(async (attempt) => {
      tracer.logStep(`第 ${attempt} 次导出尝试`);
      await this.ensureLoggedIn();

      try {
        const reportConfig = REPORT_TYPES.FUEL_TYPE_STATS;
        const url = `${this.platformConfig.baseUrl}${reportConfig.url}?year=${year}&month=${month}`;
        await this.driver.get(url);

        await this.driver.wait(until.elementLocated(By.css('.stats-table')), 20000);
        await this.sleep(2000);

        const htmlContent = await this.driver.getPageSource();
        const tables = this.parseHtmlTables(htmlContent);

        const processedData = this.processFuelTypeData(tables);
        const excelPath = this.generateExcel(processedData, '燃料类型统计表', period);

        audit.exportReport(period, 'FUEL_TYPE_STATS', excelPath, true);
        tracer.complete('success', { period, excelPath });

        return {
          success: true,
          period,
          excelPath,
          data: processedData
        };
      } catch (error) {
        audit.exportReport(period, 'FUEL_TYPE_STATS', null, false, error.message);
        throw error;
      }
    }, { driver: this.driver });
  }

  async exportAllReports(year, month) {
    const tracer = new OperationTracer(`导出全部统计报表: ${year}-${month}`, {});

    try {
      tracer.logStep('开始导出全部报表');
      
      const results = {};
      
      tracer.logStep('导出月度汇总表');
      results.monthly = await this.exportMonthlyStats(year, month);
      
      tracer.logStep('导出车型分布表');
      results.vehicleType = await this.exportVehicleTypeStats(year, month);
      
      tracer.logStep('导出燃料类型表');
      results.fuelType = await this.exportFuelTypeStats(year, month);
      
      tracer.complete('success');
      return results;
    } catch (error) {
      tracer.fail('导出全部报表失败', { stack: error.stack });
      throw error;
    }
  }

  parseHtmlTables(html) {
    const $ = cheerio.load(html);
    const tables = [];

    $('table').each((tableIndex, table) => {
      const tableData = {
        headers: [],
        rows: [],
        title: $(table).attr('data-title') || $(table).find('caption').text().trim() || `表格${tableIndex + 1}`
      };

      const headerRows = $(table).find('thead tr');
      if (headerRows.length > 0) {
        $(headerRows[0]).find('th').each((i, th) => {
          tableData.headers.push($(th).text().trim());
        });
      }

      $(table).find('tbody tr').each((rowIndex, row) => {
        const rowData = {};
        $(row).find('td').each((cellIndex, cell) => {
          const header = tableData.headers[cellIndex] || `col${cellIndex}`;
          rowData[header] = $(cell).text().trim();
        });
        if (Object.keys(rowData).length > 0) {
          tableData.rows.push(rowData);
        }
      });

      if (tableData.rows.length === 0 && headerRows.length === 0) {
        $(table).find('tr').each((rowIndex, row) => {
          if (rowIndex === 0) {
            $(row).find('td, th').each((i, cell) => {
              tableData.headers.push($(cell).text().trim());
            });
          } else {
            const rowData = {};
            $(row).find('td').each((cellIndex, cell) => {
              const header = tableData.headers[cellIndex] || `col${cellIndex}`;
              rowData[header] = $(cell).text().trim();
            });
            if (Object.keys(rowData).length > 0) {
              tableData.rows.push(rowData);
            }
          }
        });
      }

      tables.push(tableData);
    });

    logger.debug(`解析到 ${tables.length} 个HTML表格`);
    return tables;
  }

  processMonthlyData(tables, year, month) {
    const result = {
      period: `${year}-${String(month).padStart(2, '0')}`,
      summary: {},
      dailyStats: [],
      calculated: {}
    };

    if (tables.length > 0) {
      const summaryTable = tables[0];
      summaryTable.rows.forEach(row => {
        Object.entries(row).forEach(([key, value]) => {
          const numValue = this.parseNumber(value);
          result.summary[key] = numValue !== null ? numValue : value;
        });
      });
    }

    if (tables.length > 1) {
      result.dailyStats = tables[1].rows.map(row => {
        const processed = {};
        Object.entries(row).forEach(([key, value]) => {
          const numValue = this.parseNumber(value);
          processed[key] = numValue !== null ? numValue : value;
        });
        return processed;
      });
    }

    const totalInspected = result.summary['检测总数'] || result.summary['检测数量'] || 0;
    const totalPassed = result.summary['合格数'] || result.summary['合格数量'] || 0;
    const totalFailed = result.summary['不合格数'] || result.summary['不合格数量'] || 0;

    result.calculated = {
      合格率: totalInspected > 0 ? +((totalPassed / totalInspected) * 100).toFixed(2) : 0,
      不合格率: totalInspected > 0 ? +((totalFailed / totalInspected) * 100).toFixed(2) : 0,
      总检测量: totalInspected,
      合格数: totalPassed,
      不合格数: totalFailed,
      统计日期: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };

    return result;
  }

  processVehicleTypeData(tables) {
    const result = {
      byVehicleType: [],
      overall: {
        total: 0,
        passed: 0,
        failed: 0,
        passRate: 0
      },
      excessiveDistribution: []
    };

    if (tables.length > 0) {
      result.byVehicleType = tables[0].rows.map(row => {
        const processed = {};
        Object.entries(row).forEach(([key, value]) => {
          const numValue = this.parseNumber(value);
          processed[key] = numValue !== null ? numValue : value;
        });

        const total = processed['检测数量'] || processed['总数'] || 0;
        const passed = processed['合格数'] || processed['合格数量'] || 0;
        const failed = processed['不合格数'] || processed['不合格数量'] || 0;

        processed.合格率 = total > 0 ? +((passed / total) * 100).toFixed(2) : 0;
        processed.不合格率 = total > 0 ? +((failed / total) * 100).toFixed(2) : 0;
        processed.超标占比 = result.overall.total > 0 ? +((failed / result.overall.total) * 100).toFixed(2) : 0;

        result.overall.total += total;
        result.overall.passed += passed;
        result.overall.failed += failed;

        return processed;
      });

      result.overall.passRate = result.overall.total > 0 
        ? +((result.overall.passed / result.overall.total) * 100).toFixed(2) 
        : 0;

      result.excessiveDistribution = result.byVehicleType
        .filter(item => item['不合格数'] > 0)
        .sort((a, b) => (b['不合格数'] || 0) - (a['不合格数'] || 0))
        .slice(0, 10)
        .map(item => ({
          车型: item['车辆类型'] || item['车型'] || '未知',
          超标数量: item['不合格数'] || 0,
          超标占比: item.超标占比 || 0
        }));
    }

    return result;
  }

  processFuelTypeData(tables) {
    const result = {
      byFuelType: [],
      overall: {
        total: 0,
        passed: 0,
        failed: 0,
        passRate: 0
      }
    };

    if (tables.length > 0) {
      result.byFuelType = tables[0].rows.map(row => {
        const processed = {};
        Object.entries(row).forEach(([key, value]) => {
          const numValue = this.parseNumber(value);
          processed[key] = numValue !== null ? numValue : value;
        });

        const total = processed['检测数量'] || processed['总数'] || 0;
        const passed = processed['合格数'] || processed['合格数量'] || 0;
        const failed = processed['不合格数'] || processed['不合格数量'] || 0;

        processed.合格率 = total > 0 ? +((passed / total) * 100).toFixed(2) : 0;
        processed.不合格率 = total > 0 ? +((failed / total) * 100).toFixed(2) : 0;

        result.overall.total += total;
        result.overall.passed += passed;
        result.overall.failed += failed;

        return processed;
      });

      result.overall.passRate = result.overall.total > 0 
        ? +((result.overall.passed / result.overall.total) * 100).toFixed(2) 
        : 0;
    }

    return result;
  }

  parseNumber(value) {
    if (typeof value !== 'string') return value;
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (cleaned === '' || cleaned === '.' || cleaned === '-') return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  generateExcel(data, reportName, period) {
    const wb = XLSX.utils.book_new();
    const timestamp = dayjs().format('YYYYMMDDHHmmss');

    if (data.summary || data.calculated) {
      const summaryData = [
        ['项目', '数值'],
        ['统计周期', period],
        ...Object.entries(data.summary || {}).map(([k, v]) => [k, v]),
        ['---', '---'],
        ['计算指标', ''],
        ...Object.entries(data.calculated || {}).map(([k, v]) => [k, v])
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws1, '汇总');
    }

    if (data.dailyStats && data.dailyStats.length > 0) {
      const dailyHeaders = Object.keys(data.dailyStats[0]);
      const dailyData = [
        dailyHeaders,
        ...data.dailyStats.map(row => dailyHeaders.map(h => row[h]))
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(dailyData);
      XLSX.utils.book_append_sheet(wb, ws2, '每日统计');
    }

    if (data.byVehicleType && data.byVehicleType.length > 0) {
      const vtHeaders = Object.keys(data.byVehicleType[0]);
      const vtData = [
        vtHeaders,
        ...data.byVehicleType.map(row => vtHeaders.map(h => row[h]))
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(vtData);
      XLSX.utils.book_append_sheet(wb, ws3, '车型统计');
    }

    if (data.excessiveDistribution && data.excessiveDistribution.length > 0) {
      const edHeaders = Object.keys(data.excessiveDistribution[0]);
      const edData = [
        edHeaders,
        ...data.excessiveDistribution.map(row => edHeaders.map(h => row[h]))
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(edData);
      XLSX.utils.book_append_sheet(wb, ws4, '超标分布');
    }

    if (data.byFuelType && data.byFuelType.length > 0) {
      const ftHeaders = Object.keys(data.byFuelType[0]);
      const ftData = [
        ftHeaders,
        ...data.byFuelType.map(row => ftHeaders.map(h => row[h]))
      ];
      const ws5 = XLSX.utils.aoa_to_sheet(ftData);
      XLSX.utils.book_append_sheet(wb, ws5, '燃料类型');
    }

    const filename = `${reportName}_${period}_${timestamp}.xlsx`;
    const filepath = path.join(this.dataDir, filename);
    XLSX.writeFile(wb, filepath);

    logger.info(`Excel报表已生成: ${filepath}`);
    return filepath;
  }

  scheduleMonthlyExport(cronExpression = '0 0 8 1 * *') {
    const taskId = `monthly_export_${Date.now()}`;
    
    logger.info(`已注册定时任务，Cron表达式: ${cronExpression}`);
    
    const task = cron.schedule(cronExpression, async () => {
      const now = dayjs();
      const lastMonth = now.subtract(1, 'month');
      const year = lastMonth.year();
      const month = lastMonth.month() + 1;

      logger.info(`定时任务触发：导出 ${year}-${month} 统计报表`);

      try {
        await this.exportAllReports(year, month);
        logger.info(`定时任务完成：${year}-${month} 报表导出成功`);
      } catch (error) {
        logger.error(`定时任务失败：${year}-${month} 报表导出失败`, error);
        await errorHandler.handle(error, { task: 'scheduled_export', period: `${year}-${month}` });
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    this.scheduledTasks.set(taskId, {
      id: taskId,
      expression: cronExpression,
      type: 'monthly_export',
      task
    });

    return taskId;
  }

  scheduleCustomExport(cronExpression, exportFn, taskName = 'custom') {
    const taskId = `${taskName}_${Date.now()}`;
    
    logger.info(`已注册自定义定时任务 ${taskName}，Cron表达式: ${cronExpression}`);
    
    const task = cron.schedule(cronExpression, async () => {
      logger.info(`自定义定时任务触发：${taskName}`);
      try {
        await exportFn();
        logger.info(`自定义定时任务完成：${taskName}`);
      } catch (error) {
        logger.error(`自定义定时任务失败：${taskName}`, error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    this.scheduledTasks.set(taskId, {
      id: taskId,
      expression: cronExpression,
      type: taskName,
      task
    });

    return taskId;
  }

  stopScheduledTask(taskId) {
    const taskInfo = this.scheduledTasks.get(taskId);
    if (taskInfo) {
      taskInfo.task.stop();
      this.scheduledTasks.delete(taskId);
      logger.info(`定时任务已停止: ${taskId}`);
      return true;
    }
    return false;
  }

  stopAllScheduledTasks() {
    this.scheduledTasks.forEach((taskInfo, taskId) => {
      taskInfo.task.stop();
      logger.info(`定时任务已停止: ${taskId}`);
    });
    this.scheduledTasks.clear();
  }

  getScheduledTasks() {
    return Array.from(this.scheduledTasks.entries()).map(([id, info]) => ({
      id,
      type: info.type,
      expression: info.expression
    }));
  }

  generateMockStats(year, month) {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
    
    const dailyStats = [];
    let totalInspected = 0;
    let totalPassed = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dailyTotal = 350 + Math.floor(Math.random() * 100);
      const dailyPassed = Math.floor(dailyTotal * (0.85 + Math.random() * 0.1));
      
      dailyStats.push({
        日期: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        检测数量: dailyTotal,
        合格数: dailyPassed,
        不合格数: dailyTotal - dailyPassed,
        合格率: +((dailyPassed / dailyTotal) * 100).toFixed(2)
      });

      totalInspected += dailyTotal;
      totalPassed += dailyPassed;
    }

    const vehicleTypes = [
      { type: '小型轿车', count: Math.floor(totalInspected * 0.4) },
      { type: '小型普通客车', count: Math.floor(totalInspected * 0.2) },
      { type: '中型货车', count: Math.floor(totalInspected * 0.15) },
      { type: '大型货车', count: Math.floor(totalInspected * 0.1) },
      { type: '摩托车', count: Math.floor(totalInspected * 0.1) },
      { type: '其他', count: Math.floor(totalInspected * 0.05) }
    ];

    const byVehicleType = vehicleTypes.map(vt => {
      const passed = Math.floor(vt.count * (0.8 + Math.random() * 0.15));
      return {
        车辆类型: vt.type,
        检测数量: vt.count,
        合格数: passed,
        不合格数: vt.count - passed,
        合格率: +((passed / vt.count) * 100).toFixed(2),
        不合格率: +(((vt.count - passed) / vt.count) * 100).toFixed(2)
      };
    });

    const fuelTypes = [
      { type: '汽油', count: Math.floor(totalInspected * 0.55) },
      { type: '柴油', count: Math.floor(totalInspected * 0.35) },
      { type: '天然气', count: Math.floor(totalInspected * 0.08) },
      { type: '其他', count: Math.floor(totalInspected * 0.02) }
    ];

    const byFuelType = fuelTypes.map(ft => {
      const passed = Math.floor(ft.count * (0.82 + Math.random() * 0.13));
      return {
        燃料类型: ft.type,
        检测数量: ft.count,
        合格数: passed,
        不合格数: ft.count - passed,
        合格率: +((passed / ft.count) * 100).toFixed(2),
        不合格率: +(((ft.count - passed) / ft.count) * 100).toFixed(2)
      };
    });

    const totalFailed = totalInspected - totalPassed;
    
    return {
      period,
      summary: {
        检测总数: totalInspected,
        合格数: totalPassed,
        不合格数: totalFailed
      },
      dailyStats,
      byVehicleType,
      excessiveDistribution: byVehicleType
        .filter(v => v.不合格数 > 0)
        .sort((a, b) => b.不合格数 - a.不合格数)
        .slice(0, 10)
        .map(v => ({
          车型: v.车辆类型,
          超标数量: v.不合格数,
          超标占比: +((v.不合格数 / totalFailed) * 100).toFixed(2)
        })),
      byFuelType,
      calculated: {
        合格率: +((totalPassed / totalInspected) * 100).toFixed(2),
        不合格率: +((totalFailed / totalInspected) * 100).toFixed(2),
        总检测量: totalInspected,
        合格数: totalPassed,
        不合格数: totalFailed,
        统计日期: dayjs().format('YYYY-MM-DD HH:mm:ss')
      },
      overall: {
        total: totalInspected,
        passed: totalPassed,
        failed: totalFailed,
        passRate: +((totalPassed / totalInspected) * 100).toFixed(2)
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    this.stopAllScheduledTasks();
    
    if (this.driver) {
      try {
        await this.driver.quit();
      } catch (error) {
        logger.warn('关闭浏览器失败', error.message);
      }
      this.driver = null;
      this.isLoggedIn = false;
    }
  }
}

class MockStatsExporter extends StatsExporter {
  constructor(inspectionLineId) {
    super(inspectionLineId);
  }

  async init() {
    logger.info('使用模拟统计导出服务（测试模式）');
    return true;
  }

  async login() {
    this.isLoggedIn = true;
    logger.info('模拟登录环保平台成功（统计导出）');
    return true;
  }

  async exportMonthlyStats(year, month) {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const tracer = new OperationTracer(`模拟导出月度统计报表: ${period}`, {});

    try {
      tracer.logStep(`生成模拟数据: ${period}`);
      const mockData = this.generateMockStats(year, month);
      
      tracer.logStep('生成Excel文件');
      const excelPath = this.generateExcel(mockData, '月度检测汇总表', period);

      audit.exportReport(period, 'MONTHLY_SUMMARY', excelPath, true);
      tracer.complete('success', { period, excelPath });

      return {
        success: true,
        period,
        excelPath,
        data: mockData
      };
    } catch (error) {
      tracer.fail('模拟导出失败', { stack: error.stack });
      throw error;
    }
  }

  async exportVehicleTypeStats(year, month) {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const tracer = new OperationTracer(`模拟导出车型分布统计: ${period}`, {});

    try {
      tracer.logStep(`生成模拟数据: ${period}`);
      const mockData = this.generateMockStats(year, month);
      
      tracer.logStep('生成Excel文件');
      const excelPath = this.generateExcel(mockData, '车型分布统计表', period);

      audit.exportReport(period, 'VEHICLE_TYPE_STATS', excelPath, true);
      tracer.complete('success', { period, excelPath });

      return {
        success: true,
        period,
        excelPath,
        data: mockData
      };
    } catch (error) {
      tracer.fail('模拟导出失败', { stack: error.stack });
      throw error;
    }
  }

  async exportFuelTypeStats(year, month) {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const tracer = new OperationTracer(`模拟导出燃料类型统计: ${period}`, {});

    try {
      tracer.logStep(`生成模拟数据: ${period}`);
      const mockData = this.generateMockStats(year, month);
      
      tracer.logStep('生成Excel文件');
      const excelPath = this.generateExcel(mockData, '燃料类型统计表', period);

      audit.exportReport(period, 'FUEL_TYPE_STATS', excelPath, true);
      tracer.complete('success', { period, excelPath });

      return {
        success: true,
        period,
        excelPath,
        data: mockData
      };
    } catch (error) {
      tracer.fail('模拟导出失败', { stack: error.stack });
      throw error;
    }
  }
}

function createStatsExporter(inspectionLineId = null, useMock = process.env.USE_MOCK === 'true') {
  if (useMock) {
    return new MockStatsExporter(inspectionLineId);
  }
  return new StatsExporter(inspectionLineId);
}

module.exports = {
  StatsExporter,
  MockStatsExporter,
  createStatsExporter,
  REPORT_TYPES
};
