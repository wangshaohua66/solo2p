const path = require('path');
const dayjs = require('dayjs');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { logger, audit, OperationTracer } = require('./logger');
const config = require('./config');
const { errorHandler, ERROR_TYPES, InspectionError } = require('./errorHandler');
const { createVehicleService } = require('./vehicleService');
const { createDriver, By, until, Key } = require('./webdriver/adapter');

const USE_WEBDRIVERIO = process.env.USE_WEBDRIVERIO !== 'false';

const DETECTION_METHOD_FIELDS = {
  DAS: {
    name: '双怠速法',
    fields: [
      { key: 'idleCO', label: '怠速CO(%)', selector: '#idleCO', required: true },
      { key: 'idleHC', label: '怠速HC(ppm)', selector: '#idleHC', required: true },
      { key: 'highIdleCO', label: '高怠速CO(%)', selector: '#highIdleCO', required: true },
      { key: 'highIdleHC', label: '高怠速HC(ppm)', selector: '#highIdleHC', required: true },
      { key: 'lambda', label: 'λ值', selector: '#lambda', required: false },
      { key: 'engineTemp', label: '发动机温度(℃)', selector: '#engineTemp', required: true },
      { key: 'rpm', label: '转速(r/min)', selector: '#rpm', required: true }
    ]
  },
  ASM: {
    name: '稳态工况法',
    fields: [
      { key: 'asm5025CO', label: 'ASM5025 CO(%)', selector: '#asm5025CO', required: true },
      { key: 'asm5025HC', label: 'ASM5025 HC(ppm)', selector: '#asm5025HC', required: true },
      { key: 'asm5025NO', label: 'ASM5025 NO(ppm)', selector: '#asm5025NO', required: true },
      { key: 'asm2540CO', label: 'ASM2540 CO(%)', selector: '#asm2540CO', required: true },
      { key: 'asm2540HC', label: 'ASM2540 HC(ppm)', selector: '#asm2540HC', required: true },
      { key: 'asm2540NO', label: 'ASM2540 NO(ppm)', selector: '#asm2540NO', required: true },
      { key: 'dilutionRatio', label: '稀释比', selector: '#dilutionRatio', required: false }
    ]
  },
  FAM: {
    name: '自由加速法',
    fields: [
      { key: 'smoke1', label: '第1次烟度值(Rb)', selector: '#smoke1', required: true },
      { key: 'smoke2', label: '第2次烟度值(Rb)', selector: '#smoke2', required: true },
      { key: 'smoke3', label: '第3次烟度值(Rb)', selector: '#smoke3', required: true },
      { key: 'smoke4', label: '第4次烟度值(Rb)', selector: '#smoke4', required: false },
      { key: 'smokeAvg', label: '平均烟度值(Rb)', selector: '#smokeAvg', required: true }
    ]
  },
  LUGDOWN: {
    name: '加载减速法',
    fields: [
      { key: 'maxPower', label: '最大功率(kW)', selector: '#maxPower', required: true },
      { key: 'velMax', label: '最大转速(km/h)', selector: '#velMax', required: true },
      { key: 'smoke100', label: '100%转速烟度(Rb)', selector: '#smoke100', required: true },
      { key: 'smoke90', label: '90%转速烟度(Rb)', selector: '#smoke90', required: true },
      { key: 'smoke80', label: '80%转速烟度(Rb)', selector: '#smoke80', required: true },
      { key: 'nox100', label: '100%转速NOx(ppm)', selector: '#nox100', required: true },
      { key: 'nox90', label: '90%转速NOx(ppm)', selector: '#nox90', required: true },
      { key: 'nox80', label: '80%转速NOx(ppm)', selector: '#nox80', required: true }
    ]
  },
  IDLE: {
    name: '怠速法',
    fields: [
      { key: 'idleCO', label: '怠速CO(%)', selector: '#idleCO', required: true },
      { key: 'idleHC', label: '怠速HC(ppm)', selector: '#idleHC', required: true },
      { key: 'engineTemp', label: '发动机温度(℃)', selector: '#engineTemp', required: true },
      { key: 'rpm', label: '转速(r/min)', selector: '#rpm', required: true }
    ]
  }
};

class InspectionRunner {
  constructor(inspectionLineId, options = {}) {
    this.inspectionLine = config.getInspectionLine(inspectionLineId);
    if (!this.inspectionLine) {
      throw new InspectionError(
        ERROR_TYPES.VALIDATION_FAILED,
        `检测线 ${inspectionLineId} 不存在或未启用`
      );
    }
    this.driver = null;
    this.isLoggedIn = false;
    this.platformConfig = config.getPlatformConfig('environmental');
    this.heartbeatConfig = config.getHeartbeatConfig();
    this.captchaConfig = config.getCaptchaConfig();
    this.rotationConfig = config.getAccountRotationConfig();
    this.vehicleService = null;
    this.currentVehicle = null;
    this.currentMethod = null;
    
    this.heartbeatTimer = null;
    this.heartbeatFailures = 0;
    this.isHeartbeatRunning = false;
    
    this.accountPool = [];
    this.currentAccountIndex = 0;
    this.accountFailureCounts = {};
    this.lastRotationTime = 0;
    
    this.stepCallback = options.stepCallback || null;
    this.statusCallback = options.statusCallback || null;
    
    this.batchStats = {
      startTime: null,
      processed: 0,
      successCount: 0,
      currentInterval: 1000,
      throughputHistory: []
    };
  }

  async init() {
    const tracer = new OperationTracer('初始化环保平台连接', {
      inspectionLine: this.inspectionLine.id
    });

    try {
      tracer.logStep(`创建Chrome浏览器实例 (${USE_WEBDRIVERIO ? 'WebdriverIO' : 'Selenium'})`);
      
      this.driver = createDriver({ platform: this.platform });
      await this.driver.init();

      await this.driver.manage().setTimeouts({
        pageLoad: this.platformConfig.pageTimeout,
        script: this.platformConfig.pageTimeout,
        implicit: 5000
      });

      this.vehicleService = createVehicleService(this.inspectionLine.id);
      await this.vehicleService.init();

      tracer.logStep('浏览器初始化完成');
      tracer.complete('success');
      return true;
    } catch (error) {
      tracer.fail('浏览器初始化失败', { stack: error.stack });
      await errorHandler.handle(error, {
        inspectionLine: this.inspectionLine.id,
        driver: this.driver
      });
      throw error;
    }
  }

  async login() {
    const tracer = new OperationTracer('环保平台登录', {
      inspectionLine: this.inspectionLine.id
    });

    if (this.isLoggedIn) {
      tracer.logStep('已登录，跳过登录流程');
      return true;
    }
    
    if (this.accountPool.length === 0) {
      this.initAccountPool();
    }

    return errorHandler.retryWithStrategy(async (attempt) => {
      tracer.logStep(`第 ${attempt} 次登录尝试 (账号: ${this.inspectionLine.envAccount.username})`);
      this.notifyStep('login_attempt', { attempt, username: this.inspectionLine.envAccount.username });

      try {
        const loginUrl = this.platformConfig.baseUrl + this.platformConfig.loginUrl;
        tracer.logStep(`访问登录页面: ${loginUrl}`);
        this.notifyStep('login_navigate', { url: loginUrl });
        await this.driver.get(loginUrl);

        const selectors = this.platformConfig.selectors;
        const account = this.inspectionLine.envAccount;

        tracer.logStep('输入用户名');
        this.notifyStep('login_username', {});
        await this.driver.wait(until.elementLocated(By.css(selectors.usernameInput)), 10000);
        await this.driver.findElement(By.css(selectors.usernameInput)).clear();
        await this.driver.findElement(By.css(selectors.usernameInput)).sendKeys(account.username);

        tracer.logStep('输入密码');
        this.notifyStep('login_password', {});
        await this.driver.findElement(By.css(selectors.passwordInput)).clear();
        await this.driver.findElement(By.css(selectors.passwordInput)).sendKeys(account.password);

        tracer.logStep('处理验证码');
        this.notifyStep('login_captcha', {});
        const captcha = await this.handleCaptcha(selectors);
        if (captcha) {
          await this.driver.findElement(By.css(selectors.captchaInput)).clear();
          await this.driver.findElement(By.css(selectors.captchaInput)).sendKeys(captcha);
        }

        tracer.logStep('提交登录');
        this.notifyStep('login_submit', {});
        await this.driver.findElement(By.css(selectors.loginButton)).click();

        await this.verifyLogin();
        this.isLoggedIn = true;
        
        this.resetAccountFailure(this.inspectionLine.id);
        this.startHeartbeat();

        audit.login(
          'env_platform',
          account.username,
          this.inspectionLine.id,
          true
        );

        this.notifyStatus('login_success', { username: account.username });
        tracer.complete('success');
        return true;
      } catch (error) {
        this.recordAccountFailure(this.inspectionLine.id);
        
        audit.login(
          'env_platform',
          this.inspectionLine.envAccount.username,
          this.inspectionLine.id,
          false,
          error.message
        );
        
        this.notifyStatus('login_failed', { attempt, error: error.message });
        throw error;
      }
    }, {
      inspectionLine: this.inspectionLine.id,
      driver: this.driver,
      context: 'login'
    });
  }

  async handleCaptcha(selectors) {
    try {
      const captchaImg = await this.driver.findElement(By.css(selectors.captchaImage));
      if (!captchaImg) return null;

      const isDisplayed = await captchaImg.isDisplayed();
      if (!isDisplayed) return null;

      logger.info('检测到验证码，开始识别');
      
      const screenshot = await captchaImg.takeScreenshot();
      const timestamp = dayjs().format('YYYYMMDDHHmmss');
      const captchaPath = path.join(__dirname, '..', 'screenshots', `env-captcha-${timestamp}.png`);
      
      fs.writeFileSync(captchaPath, screenshot, 'base64');
      
      const captchaCode = await this.recognizeCaptcha(captchaImg);
      
      if (captchaCode) {
        logger.info(`验证码识别结果: ${captchaCode}`);
        return captchaCode;
      }
      
      logger.warn('验证码识别失败');
      return null;
    } catch (error) {
      logger.debug('未检测到验证码或验证码处理失败', error.message);
      return null;
    }
  }

  async verifyLogin() {
    try {
      await this.driver.wait(async () => {
        const currentUrl = await this.driver.getCurrentUrl();
        return !currentUrl.includes('login');
      }, 10000);

      const logoutBtn = await this.driver.findElements(By.css(this.platformConfig.selectors.logoutButton));
      if (logoutBtn.length === 0) {
        throw new Error('登录后未找到退出按钮，登录可能失败');
      }

      logger.info('环保平台登录验证成功');
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

  async runInspection(plateNumber, testData = null, options = {}) {
    const startTime = Date.now();
    const tracer = new OperationTracer('排放检测流程', {
      inspectionLine: this.inspectionLine.id,
      vehiclePlate: plateNumber
    });

    try {
      tracer.logStep(`开始检测车辆: ${plateNumber}`);
      await this.ensureLoggedIn();

      tracer.logStep('查询车辆信息');
      const vehicleInfo = await this.vehicleService.queryVehicle(plateNumber, options);
      this.currentVehicle = vehicleInfo;

      const validation = this.vehicleService.validateVehicleInfo(vehicleInfo);
      if (!validation.valid) {
        throw new InspectionError(
          ERROR_TYPES.VALIDATION_FAILED,
          `车辆信息验证失败: ${validation.errors.join(', ')}`
        );
      }

      tracer.logStep('自动选择检测方法');
      const method = this.selectDetectionMethod(vehicleInfo);
      this.currentMethod = method;
      tracer.logStep(`检测方法: ${method.name} (${method.code})`);

      audit.inspectionStart(plateNumber, this.inspectionLine.id, method.code);

      tracer.logStep('进入检测录入页面');
      await this.navigateToInspectionPage();

      tracer.logStep('填充车辆基础信息');
      await this.fillVehicleInfo(vehicleInfo);

      tracer.logStep('选择检测方法');
      await this.selectMethod(method.code);

      tracer.logStep('等待动态表单加载');
      await this.waitForMethodForm(method.code);

      tracer.logStep('录入检测数据');
      const inspectionData = testData || this.generateMockTestData(method.code, vehicleInfo);
      await this.fillTestData(method.code, inspectionData);

      tracer.logStep('数据校验与结果判定');
      const result = this.evaluateResult(method.code, inspectionData, vehicleInfo);
      
      tracer.logStep('提交检测记录');
      await this.submitInspection(result);

      tracer.logStep('检测完成');
      const duration = Date.now() - startTime;
      audit.inspectionComplete(plateNumber, this.inspectionLine.id, result.pass ? '合格' : '不合格', duration);
      tracer.complete(result.pass ? 'success' : 'failed', { result, duration });

      return {
        success: true,
        vehicleInfo,
        method,
        inspectionData,
        result,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      tracer.fail('检测流程失败', { stack: error.stack });
      audit.inspectionComplete(plateNumber, this.inspectionLine.id, '失败', duration);
      
      await errorHandler.handle(error, {
        inspectionLine: this.inspectionLine.id,
        vehiclePlate: plateNumber,
        driver: this.driver
      });
      
      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  selectDetectionMethod(vehicleInfo) {
    const method = config.getDetectionMethod(
      vehicleInfo.fuelTypeCode,
      vehicleInfo.registerYear
    );

    if (!method) {
      throw new InspectionError(
        ERROR_TYPES.VALIDATION_FAILED,
        `无法确定检测方法: 燃料类型=${vehicleInfo.fuelType}, 注册年份=${vehicleInfo.registerYear}`
      );
    }

    return method;
  }

  async navigateToInspectionPage() {
    const inspectionUrl = this.platformConfig.baseUrl + '/inspection/new';
    await this.driver.get(inspectionUrl);
    await this.driver.wait(until.elementLocated(By.css('#inspectionForm')), 10000);
  }

  async fillVehicleInfo(vehicleInfo) {
    const envFields = vehicleInfo.envPlatformFields || {};
    
    for (const [field, value] of Object.entries(envFields)) {
      if (!value) continue;

      try {
        const selector = `#${field}`;
        const element = await this.driver.findElement(By.css(selector));
        
        await element.clear();
        await element.sendKeys(String(value));
        
        audit.dataEntry(
          vehicleInfo.plateNumber,
          this.inspectionLine.id,
          field,
          value
        );
      } catch (error) {
        logger.debug(`字段 ${field} 填充失败，可能字段名不匹配: ${error.message}`);
      }
    }

    const selectors = this.platformConfig.selectors;
    await this.driver.findElement(By.css(selectors.searchButton)).click();
    await this.sleep(1000);
  }

  async selectMethod(methodCode) {
    try {
      const methodSelect = await this.driver.findElement(By.css('#detectionMethod'));
      await methodSelect.click();
      await this.sleep(500);
      
      const option = await this.driver.findElement(By.css(`#detectionMethod option[value="${methodCode}"]`));
      await option.click();
      await this.sleep(500);
      
      logger.info(`已选择检测方法: ${methodCode}`);
    } catch (error) {
      throw new InspectionError(
        ERROR_TYPES.VALIDATION_FAILED,
        `选择检测方法失败: ${error.message}`
      );
    }
  }

  async waitForMethodForm(methodCode) {
    const methodConfig = DETECTION_METHOD_FIELDS[methodCode];
    if (!methodConfig) return;

    const firstField = methodConfig.fields[0];
    if (firstField) {
      await this.driver.wait(
        until.elementLocated(By.css(firstField.selector)),
        10000
      );
    }
  }

  async fillTestData(methodCode, testData) {
    const methodConfig = DETECTION_METHOD_FIELDS[methodCode];
    if (!methodConfig) {
      throw new InspectionError(
        ERROR_TYPES.VALIDATION_FAILED,
        `未知的检测方法: ${methodCode}`
      );
    }

    for (const field of methodConfig.fields) {
      const value = testData[field.key];
      
      if (value === undefined || value === null) {
        if (field.required) {
          throw new InspectionError(
            ERROR_TYPES.VALIDATION_FAILED,
            `缺少必填字段: ${field.label} (${field.key})`
          );
        }
        continue;
      }

      try {
        const element = await this.driver.findElement(By.css(field.selector));
        await element.clear();
        await element.sendKeys(String(value));
        
        audit.dataEntry(
          this.currentVehicle?.plateNumber,
          this.inspectionLine.id,
          field.key,
          value
        );
      } catch (error) {
        if (field.required) {
          throw new InspectionError(
            ERROR_TYPES.VALIDATION_FAILED,
            `字段 ${field.label} 录入失败: ${error.message}`
          );
        }
        logger.debug(`可选字段 ${field.key} 录入失败: ${error.message}`);
      }
    }

    await this.sleep(500);
  }

  evaluateResult(methodCode, testData, vehicleInfo) {
    const standard = config.getCurrentStandard();
    const fuelConfig = standard.fuelTypes[vehicleInfo.fuelTypeCode];
    
    if (!fuelConfig) {
      return { pass: false, reason: '未找到对应的排放标准配置' };
    }

    const limits = fuelConfig.limits;
    const result = {
      pass: true,
      items: [],
      overall: null,
      limits
    };

    const checkLimit = (value, limit, label) => {
      const pass = value <= limit;
      result.items.push({
        label,
        value,
        limit,
        pass
      });
      if (!pass) {
        result.pass = false;
      }
      return pass;
    };

    switch (methodCode) {
      case 'DAS':
        checkLimit(testData.idleCO, limits.co.idle, '怠速CO');
        checkLimit(testData.idleHC, limits.hc.idle, '怠速HC');
        checkLimit(testData.highIdleCO, limits.co.highIdle, '高怠速CO');
        checkLimit(testData.highIdleHC, limits.hc.highIdle, '高怠速HC');
        break;

      case 'ASM':
        checkLimit(testData.asm5025CO, limits.co.idle, 'ASM5025 CO');
        checkLimit(testData.asm5025HC, limits.hc.idle, 'ASM5025 HC');
        checkLimit(testData.asm5025NO, limits.nox.asm, 'ASM5025 NOx');
        checkLimit(testData.asm2540CO, limits.co.idle, 'ASM2540 CO');
        checkLimit(testData.asm2540HC, limits.hc.idle, 'ASM2540 HC');
        checkLimit(testData.asm2540NO, limits.nox.asm, 'ASM2540 NOx');
        break;

      case 'FAM':
        checkLimit(testData.smokeAvg, limits.smoke.freeAccel, '平均烟度');
        break;

      case 'LUGDOWN':
        checkLimit(testData.smoke100, limits.smoke.lugdown, '100%转速烟度');
        checkLimit(testData.smoke90, limits.smoke.lugdown, '90%转速烟度');
        checkLimit(testData.smoke80, limits.smoke.lugdown, '80%转速烟度');
        checkLimit(testData.nox100, limits.nox.lugdown, '100%转速NOx');
        checkLimit(testData.nox90, limits.nox.lugdown, '90%转速NOx');
        checkLimit(testData.nox80, limits.nox.lugdown, '80%转速NOx');
        break;

      case 'IDLE':
        checkLimit(testData.idleCO, limits.co.idle, '怠速CO');
        checkLimit(testData.idleHC, limits.hc.idle, '怠速HC');
        break;
    }

    result.overall = result.pass ? '合格' : '不合格';
    result.standard = standard.name;
    result.methodCode = methodCode;

    return result;
  }

  async submitInspection(result) {
    const selectors = this.platformConfig.selectors;
    
    try {
      const resultElement = await this.driver.findElement(By.css('#inspectionResult'));
      await resultElement.sendKeys(result.pass ? 'PASS' : 'FAIL');

      const commentElement = await this.driver.findElement(By.css('#inspectionComment'));
      if (result.pass) {
        await commentElement.sendKeys('排放检测合格，符合标准要求。');
      } else {
        const failedItems = result.items.filter(i => !i.pass).map(i => i.label).join('、');
        await commentElement.sendKeys(`排放检测不合格，超标项目：${failedItems}。`);
      }

      await this.driver.findElement(By.css(selectors.submitButton)).click();
      
      await this.driver.wait(
        until.elementLocated(By.css(selectors.successMessage)),
        15000
      );

      const successMsg = await this.driver.findElement(By.css(selectors.successMessage)).getText();
      logger.info(`检测提交成功: ${successMsg}`);

      return true;
    } catch (error) {
      const errorMsgs = await this.driver.findElements(By.css(selectors.errorMessage));
      if (errorMsgs.length > 0) {
        const errorText = await errorMsgs[0].getText();
        throw new InspectionError(
          ERROR_TYPES.VALIDATION_FAILED,
          `提交失败: ${errorText}`
        );
      }
      throw new InspectionError(
        ERROR_TYPES.TIMEOUT_ERROR,
        `提交检测结果超时: ${error.message}`
      );
    }
  }

  async batchProcess(csvFilePath, options = {}) {
    const tracer = new OperationTracer('批量检测', {
      inspectionLine: this.inspectionLine.id
    });

    try {
      tracer.logStep(`读取批量数据文件: ${csvFilePath}`);
      
      if (!fs.existsSync(csvFilePath)) {
        throw new InspectionError(
          ERROR_TYPES.VALIDATION_FAILED,
          `文件不存在: ${csvFilePath}`
        );
      }

      const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      const batchId = 'BATCH-' + dayjs().format('YYYYMMDDHHmmss');
      const maxCount = options.maxCount || records.length;
      const totalCount = Math.min(records.length, maxCount);
      const processRecords = records.slice(0, totalCount);
      
      audit.batchProcessStart(batchId, totalCount, this.inspectionLine.id);
      tracer.logStep(`批量任务 ${batchId} 开始，共 ${totalCount} 条记录`);

      const results = [];
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < processRecords.length; i++) {
        const record = processRecords[i];
        const plateNumber = record.plateNumber || record['车牌号'];
        
        tracer.logStep(`处理第 ${i + 1}/${totalCount} 条: ${plateNumber}`);

        try {
          const testData = this.parseCsvTestData(record);
          const result = await this.runInspection(plateNumber, testData, options);
          
          results.push({
            index: i + 1,
            plateNumber,
            ...result
          });

          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;
          results.push({
            index: i + 1,
            plateNumber,
            success: false,
            error: error.message
          });
        }

        if (i < records.length - 1) {
          await this.sleep(options.interval || 2000);
        }
      }

      const duration = Date.now() - tracer.startTime;
      audit.batchProcessComplete(
        batchId,
        successCount,
        failedCount,
        totalCount,
        duration,
        this.inspectionLine.id
      );

      tracer.complete('success', { successCount, failedCount, totalCount });

      return {
        batchId,
        totalCount,
        successCount,
        failedCount,
        duration,
        results
      };
    } catch (error) {
      tracer.fail('批量处理失败', { stack: error.stack });
      throw error;
    }
  }

  parseCsvTestData(record) {
    const testData = {};
    
    for (const [key, value] of Object.entries(record)) {
      if (key === 'plateNumber' || key === '车牌号') continue;
      
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        testData[key] = numValue;
      } else {
        testData[key] = value;
      }
    }

    return testData;
  }

  generateMockTestData(methodCode, vehicleInfo) {
    const standard = config.getCurrentStandard();
    const fuelConfig = standard.fuelTypes[vehicleInfo.fuelTypeCode];
    const limits = fuelConfig?.limits || {};
    
    const passProbability = 0.85;
    const shouldPass = Math.random() < passProbability;

    const randomWithinLimit = (limit, multiplier = 0.8) => {
      if (shouldPass) {
        return +(Math.random() * limit * multiplier).toFixed(3);
      } else {
        return +(limit * (1 + Math.random() * 0.3)).toFixed(3);
      }
    };

    switch (methodCode) {
      case 'DAS':
        return {
          idleCO: randomWithinLimit(limits.co?.idle || 0.5),
          idleHC: Math.round(randomWithinLimit(limits.hc?.idle || 100)),
          highIdleCO: randomWithinLimit(limits.co?.highIdle || 0.3),
          highIdleHC: Math.round(randomWithinLimit(limits.hc?.highIdle || 50)),
          lambda: +(1.0 + Math.random() * 0.03).toFixed(3),
          engineTemp: 85 + Math.floor(Math.random() * 10),
          rpm: 700 + Math.floor(Math.random() * 100)
        };

      case 'ASM':
        return {
          asm5025CO: randomWithinLimit(limits.co?.idle || 0.5),
          asm5025HC: Math.round(randomWithinLimit(limits.hc?.idle || 100)),
          asm5025NO: Math.round(randomWithinLimit(limits.nox?.asm || 2000)),
          asm2540CO: randomWithinLimit(limits.co?.idle || 0.5),
          asm2540HC: Math.round(randomWithinLimit(limits.hc?.idle || 100)),
          asm2540NO: Math.round(randomWithinLimit(limits.nox?.asm || 2000)),
          dilutionRatio: +(14.5 + Math.random() * 1).toFixed(1)
        };

      case 'FAM':
        const smokeLimit = limits.smoke?.freeAccel || 1.2;
        const smoke1 = randomWithinLimit(smokeLimit);
        const smoke2 = randomWithinLimit(smokeLimit);
        const smoke3 = randomWithinLimit(smokeLimit);
        return {
          smoke1,
          smoke2,
          smoke3,
          smokeAvg: +((smoke1 + smoke2 + smoke3) / 3).toFixed(3)
        };

      case 'LUGDOWN':
        const smokeLimitLug = limits.smoke?.lugdown || 0.7;
        const noxLimit = limits.nox?.lugdown || 1800;
        return {
          maxPower: 80 + Math.floor(Math.random() * 40),
          velMax: 80 + Math.floor(Math.random() * 20),
          smoke100: randomWithinLimit(smokeLimitLug),
          smoke90: randomWithinLimit(smokeLimitLug),
          smoke80: randomWithinLimit(smokeLimitLug),
          nox100: Math.round(randomWithinLimit(noxLimit)),
          nox90: Math.round(randomWithinLimit(noxLimit)),
          nox80: Math.round(randomWithinLimit(noxLimit))
        };

      case 'IDLE':
        return {
          idleCO: randomWithinLimit(limits.co?.idle || 4.0),
          idleHC: Math.round(randomWithinLimit(limits.hc?.idle || 1200)),
          engineTemp: 85 + Math.floor(Math.random() * 10),
          rpm: 1000 + Math.floor(Math.random() * 500)
        };

      default:
        return {};
    }
  }

  notifyStep(step, details = {}) {
    if (this.stepCallback) {
      try {
        this.stepCallback({
          timestamp: Date.now(),
          step,
          details,
          inspectionLine: this.inspectionLine.id,
          vehiclePlate: this.currentVehicle?.plateNumber
        });
      } catch (e) {
        logger.warn('步骤回调执行失败', e.message);
      }
    }
  }

  notifyStatus(status, data = {}) {
    if (this.statusCallback) {
      try {
        this.statusCallback({
          timestamp: Date.now(),
          status,
          data,
          inspectionLine: this.inspectionLine.id
        });
      } catch (e) {
        logger.warn('状态回调执行失败', e.message);
      }
    }
  }

  startHeartbeat() {
    if (!this.heartbeatConfig.enabled || this.isHeartbeatRunning) {
      return;
    }

    this.isHeartbeatRunning = true;
    this.heartbeatFailures = 0;
    
    logger.info(`[心跳检测] 已启动，间隔: ${this.heartbeatConfig.intervalMs / 1000}秒`);
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isHeartbeatRunning) return;
      await this.checkHeartbeat();
    }, this.heartbeatConfig.intervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.isHeartbeatRunning = false;
    this.heartbeatFailures = 0;
    logger.info('[心跳检测] 已停止');
  }

  async checkHeartbeat() {
    if (!this.driver || !this.isLoggedIn) {
      return;
    }

    try {
      this.notifyStep('heartbeat_check', { type: 'env_platform' });
      
      const checkSelector = this.heartbeatConfig.checkSelector;
      const element = await this.driver.wait(
        until.elementLocated(By.css(checkSelector)),
        this.heartbeatConfig.timeoutMs
      );
      
      if (element) {
        this.heartbeatFailures = 0;
        logger.debug('[心跳检测] 会话正常');
        return true;
      }
    } catch (error) {
      this.heartbeatFailures++;
      logger.warn(`[心跳检测] 第 ${this.heartbeatFailures} 次失败: ${error.message}`);
      
      if (this.heartbeatFailures >= this.heartbeatConfig.maxConsecutiveFailures) {
        logger.error('[心跳检测] 连续失败，判定会话过期，触发重新登录');
        await this.handleSessionExpired();
      }
      return false;
    }
  }

  async handleSessionExpired() {
    this.isLoggedIn = false;
    this.notifyStatus('session_expired', { platform: 'env_platform' });
    audit.sessionExpired('env_platform', this.inspectionLine.id);
    
    try {
      if (this.rotationConfig.enabled && this.shouldRotateAccount()) {
        await this.rotateAccount();
      }
      
      this.notifyStep('relogin', { reason: 'heartbeat_timeout' });
      await this.performLogin();
      
      this.heartbeatFailures = 0;
      this.notifyStatus('session_restored', { platform: 'env_platform' });
      logger.info('[心跳检测] 会话已恢复');
    } catch (error) {
      logger.error('[心跳检测] 重新登录失败', error.message);
      this.notifyStatus('relogin_failed', { error: error.message });
      await errorHandler.sendDingtalkAlert({
        title: '环保平台会话恢复失败',
        content: `检测线: ${this.inspectionLine.name}\n原因: 心跳检测连续失败后重连失败\n错误: ${error.message}`,
        type: 'error'
      });
    }
  }

  initAccountPool() {
    const allAccounts = config.getAvailableAccounts(this.inspectionLine.id);
    const currentAccount = {
      lineId: this.inspectionLine.id,
      lineName: this.inspectionLine.name,
      envAccount: this.inspectionLine.envAccount,
      trafficAccount: this.inspectionLine.trafficAccount
    };
    
    this.accountPool = [currentAccount, ...allAccounts];
    
    this.accountPool.forEach(acc => {
      this.accountFailureCounts[acc.lineId] = 0;
    });
    
    logger.info(`账号池初始化完成，共 ${this.accountPool.length} 个账号`);
  }

  shouldRotateAccount() {
    const currentAcc = this.accountPool[this.currentAccountIndex];
    if (!currentAcc) return false;
    
    const failureCount = this.accountFailureCounts[currentAcc.lineId] || 0;
    const cooldownPassed = Date.now() - this.lastRotationTime > this.rotationConfig.rotationCooldownMs;
    
    return failureCount >= this.rotationConfig.maxFailuresPerAccount && cooldownPassed;
  }

  async rotateAccount() {
    if (!this.rotationConfig.enabled || this.accountPool.length <= 1) {
      return null;
    }

    const startIndex = this.currentAccountIndex;
    let nextIndex = (startIndex + 1) % this.accountPool.length;
    
    while (nextIndex !== startIndex) {
      const candidate = this.accountPool[nextIndex];
      const failures = this.accountFailureCounts[candidate.lineId] || 0;
      
      if (failures < this.rotationConfig.maxFailuresPerAccount) {
        this.currentAccountIndex = nextIndex;
        this.lastRotationTime = Date.now();
        
        const newAccount = this.accountPool[nextIndex];
        this.inspectionLine.envAccount = newAccount.envAccount;
        this.inspectionLine.trafficAccount = newAccount.trafficAccount;
        
        logger.info(`账号轮换: ${this.accountPool[startIndex]?.lineId} -> ${newAccount.lineId}`);
        audit.accountRotate(
          this.inspectionLine.id,
          startIndex,
          nextIndex,
          'failure_threshold'
        );
        
        this.notifyStatus('account_rotated', {
          from: this.accountPool[startIndex]?.lineId,
          to: newAccount.lineId
        });
        
        return newAccount;
      }
      
      nextIndex = (nextIndex + 1) % this.accountPool.length;
    }
    
    logger.warn('账号轮换失败：所有账号均已达到失败阈值');
    return null;
  }

  recordAccountFailure(lineId) {
    this.accountFailureCounts[lineId] = (this.accountFailureCounts[lineId] || 0) + 1;
    logger.debug(`账号 ${lineId} 失败计数: ${this.accountFailureCounts[lineId]}`);
  }

  resetAccountFailure(lineId) {
    this.accountFailureCounts[lineId] = 0;
  }

  async recognizeCaptcha(captchaElement) {
    const captchaConfig = config.getCaptchaConfig();
    
    try {
      this.notifyStep('captcha_recognition', { method: 'ocr' });
      
      if (captchaConfig.damaPlatform?.enabled) {
        const result = await this.recognizeCaptchaDama(captchaElement);
        if (result) return result;
      }
      
      if (captchaConfig.ocrService) {
        const result = await this.recognizeCaptchaOCR(captchaElement);
        if (result) return result;
      }
      
      if (captchaConfig.manualFallback) {
        return await this.manualCaptchaInput(captchaElement);
      }
      
      throw new Error('无可用的验证码识别方式');
    } catch (error) {
      logger.warn('验证码识别失败', error.message);
      throw error;
    }
  }

  async recognizeCaptchaOCR(captchaElement) {
    try {
      const screenshot = await captchaElement.takeScreenshot();
      
      const captchaConfig = config.getCaptchaConfig();
      const apiUrl = captchaConfig.ocrApiUrl;
      
      if (!apiUrl) {
        logger.debug('未配置OCR API，跳过OCR识别');
        return null;
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${captchaConfig.ocrApiKey}`
        },
        body: JSON.stringify({
          image: screenshot,
          type: 'captcha'
        })
      });
      
      const data = await response.json();
      
      if (data.code === 0 && data.result) {
        logger.info(`OCR验证码识别结果: ${data.result.text}`);
        return data.result.text;
      }
      
      return null;
    } catch (error) {
      logger.warn('OCR验证码识别失败', error.message);
      return null;
    }
  }

  async recognizeCaptchaDama(captchaElement) {
    try {
      const screenshot = await captchaElement.takeScreenshot();
      const damaConfig = config.getCaptchaConfig().damaPlatform;
      
      const response = await fetch(damaConfig.apiUrl + '/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: damaConfig.appId,
          app_key: damaConfig.appKey,
          image: screenshot,
          type: 'char_4'
        })
      });
      
      const data = await response.json();
      
      if (data.code === 0 && data.data?.result) {
        logger.info(`打码平台识别结果: ${data.data.result}`);
        return data.data.result;
      }
      
      return null;
    } catch (error) {
      logger.warn('打码平台识别失败', error.message);
      return null;
    }
  }

  async manualCaptchaInput(captchaElement) {
    const inquirer = require('inquirer');
    const captchaConfig = config.getCaptchaConfig();
    
    this.notifyStatus('captcha_manual_required', { timeout: captchaConfig.manualInputTimeout });
    
    const screenshotPath = path.join(
      __dirname, '..', 'screenshots',
      `captcha-${Date.now()}.png`
    );
    const screenshot = await captchaElement.takeScreenshot();
    require('fs').writeFileSync(screenshotPath, screenshot, 'base64');
    
    logger.warn(`需要手动输入验证码，截图已保存: ${screenshotPath}`);
    console.log(`\n⚠️  验证码截图已保存: ${screenshotPath}`);
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'captcha',
        message: '请输入验证码:',
        validate: (input) => input ? true : '请输入验证码'
      }
    ]);
    
    this.notifyStatus('captcha_manual_input_received', {});
    return answers.captcha;
  }

  initBatchStats() {
    const perfConfig = config.getPerformanceConfig();
    this.batchStats = {
      startTime: Date.now(),
      processed: 0,
      successCount: 0,
      failedCount: 0,
      currentInterval: 1000,
      targetThroughput: perfConfig.batchProcessingRatePerHour,
      throughputHistory: []
    };
  }

  updateBatchStats(success) {
    const stats = this.batchStats;
    stats.processed++;
    if (success) stats.successCount++;
    else stats.failedCount++;
    
    const elapsedHours = (Date.now() - stats.startTime) / 3600000;
    const currentThroughput = elapsedHours > 0 ? stats.processed / elapsedHours : 0;
    
    stats.throughputHistory.push(currentThroughput);
    if (stats.throughputHistory.length > 10) {
      stats.throughputHistory.shift();
    }
    
    const avgThroughput = stats.throughputHistory.reduce((a, b) => a + b, 0) 
      / stats.throughputHistory.length;
    
    stats.adaptiveInterval = this.calculateAdaptiveInterval(avgThroughput);
    
    return {
      processed: stats.processed,
      successCount: stats.successCount,
      throughput: Math.round(avgThroughput),
      interval: stats.adaptiveInterval
    };
  }

  calculateAdaptiveInterval(currentThroughput) {
    const target = this.batchStats.targetThroughput;
    let interval = this.batchStats.currentInterval;
    
    const threshold = target * 0.9;
    const minInterval = 100;
    const maxInterval = 5000;
    
    if (currentThroughput < threshold && interval > minInterval) {
      interval = Math.max(minInterval, interval * 0.8);
      logger.debug(`吞吐量不足 (${Math.round(currentThroughput)}/${target}/h)，缩短间隔至 ${Math.round(interval)}ms`);
    } else if (currentThroughput > target * 1.1 && interval < maxInterval) {
      interval = Math.min(maxInterval, interval * 1.2);
      logger.debug(`吞吐量过剩 (${Math.round(currentThroughput)}/${target}/h)，增加间隔至 ${Math.round(interval)}ms`);
    }
    
    this.batchStats.currentInterval = interval;
    return Math.round(interval);
  }

  getBatchProgress() {
    return {
      ...this.batchStats,
      elapsed: Date.now() - (this.batchStats.startTime || Date.now())
    };
  }

  async close() {
    this.stopHeartbeat();
    
    if (this.driver) {
      try {
        audit.logout(
          'env_platform',
          this.inspectionLine.envAccount.username,
          this.inspectionLine.id
        );
        await this.driver.quit();
      } catch (error) {
        logger.warn('关闭浏览器失败', error.message);
      }
      this.driver = null;
      this.isLoggedIn = false;
    }

    if (this.vehicleService) {
      await this.vehicleService.close();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCurrentStatus() {
    return {
      inspectionLine: this.inspectionLine.id,
      isLoggedIn: this.isLoggedIn,
      currentVehicle: this.currentVehicle?.plateNumber || null,
      currentMethod: this.currentMethod?.code || null
    };
  }
}

class ParallelInspectionManager {
  constructor(options = {}) {
    const perfConfig = config.getPerformanceConfig();
    this.maxConcurrent = options.maxConcurrent || perfConfig.maxConcurrentLines || 2;
    this.runners = [];
    this.taskQueue = [];
    this.results = [];
    this.isRunning = false;
    this.options = options;
    this.progressCallback = options.progressCallback || null;
  }

  async init(lineIds) {
    logger.info(`初始化并行检测管理器，最大并发: ${this.maxConcurrent}，检测线数量: ${lineIds.length}`);
    
    const actualLines = lineIds.slice(0, this.maxConcurrent);
    
    for (const lineId of actualLines) {
      const runner = createInspectionRunner(lineId, {
        ...this.options.stepCallback,
        ...this.options.statusCallback
      });
      await runner.init();
      this.runners.push(runner);
    }
    
    return this.runners.length;
  }

  async batchProcessParallel(csvFile, options = {}) {
    return new Promise((resolve, reject) => {
      const content = fs.readFileSync(csvFile, 'utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      const batchId = 'PARALLEL-BATCH-' + dayjs().format('YYYYMMDDHHmmss');
      const maxCount = options.maxCount || records.length;
      this.taskQueue = records.slice(0, maxCount).map((record, index) => ({
        index,
        record,
        status: 'pending'
      }));
      
      this.results = [];
      this.isRunning = true;
      this.startTime = Date.now();
      
      logger.info(`并行批处理任务 ${batchId} 开始，共 ${this.taskQueue.length} 条记录，${this.runners.length} 条检测线并行`);
      
      audit.batchProcessStart(batchId, this.taskQueue.length, 'parallel');
      
      const workerPromises = this.runners.map((runner, runnerIndex) => {
        return this.runWorker(runner, runnerIndex, batchId, options);
      });
      
      Promise.all(workerPromises).then(() => {
        this.isRunning = false;
        const duration = Date.now() - this.startTime;
        const successCount = this.results.filter(r => r.success).length;
        const failedCount = this.results.filter(r => !r.success).length;
        
        audit.batchProcessComplete(batchId, successCount, failedCount, this.results.length, duration, 'parallel');
        
        resolve({
          batchId,
          totalCount: this.results.length,
          successCount,
          failedCount,
          duration,
          results: this.results
        });
      }).catch(reject);
    });
  }

  async runWorker(runner, runnerIndex, batchId, options) {
    const interval = options.interval || 1000;
    
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (!task) break;
      
      task.status = 'processing';
      task.runnerId = runnerIndex;
      
      try {
        const result = await runner.runInspection(task.record.plateNumber || task.record['车牌号'], {
          testData: task.record,
          methodCode: task.record.methodCode || task.record['检测方法']
        });
        
        const resultEntry = {
          index: task.index,
          plateNumber: task.record.plateNumber || task.record['车牌号'],
          success: result.success,
          runnerIndex: runnerIndex,
          error: result.error || null,
          result: result.success ? result : null
        };
        
        this.results.push(resultEntry);
        
        if (this.progressCallback) {
          this.progressCallback({
            completed: this.results.length,
            total: this.results.length + this.taskQueue.length,
            current: runnerIndex,
            plateNumber: task.record.plateNumber,
            success: result.success
          });
        }
      } catch (error) {
        this.results.push({
          index: task.index,
          plateNumber: task.record.plateNumber,
          success: false,
          runnerIndex: runnerIndex,
          error: error.message
        });
      }
      
      if (this.taskQueue.length > 0) {
        await this.sleep(interval);
      }
    }
  }

  getProgress() {
    const completed = this.results.length;
    const total = completed + this.taskQueue.length;
    const elapsed = Date.now() - (this.startTime || Date.now());
    const throughput = elapsed > 0 ? Math.round(completed / (elapsed / 3600000)) : 0;
    
    return {
      completed,
      total,
      running: this.runners.length,
      throughput,
      elapsed,
      queueRemaining: this.taskQueue.length
    };
  }

  async closeAll() {
    for (const runner of this.runners) {
      try {
        await runner.close();
      } catch (e) {
        logger.warn(`关闭检测执行器失败: ${e.message}`);
      }
    }
    this.runners = [];
    this.isRunning = false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class MockInspectionRunner extends InspectionRunner {
  constructor(inspectionLineId) {
    super(inspectionLineId);
  }

  async init() {
    logger.info('使用模拟检测执行器（测试模式）');
    this.vehicleService = createVehicleService(this.inspectionLine.id, true);
    await this.vehicleService.init();
    return true;
  }

  async login() {
    this.isLoggedIn = true;
    logger.info('模拟登录环保平台成功');
    return true;
  }

  async runInspection(plateNumber, testData = null, options = {}) {
    const startTime = Date.now();
    const tracer = new OperationTracer('模拟排放检测流程', {
      inspectionLine: this.inspectionLine.id,
      vehiclePlate: plateNumber
    });

    try {
      tracer.logStep(`开始模拟检测车辆: ${plateNumber}`);
      
      const vehicleInfo = await this.vehicleService.queryVehicle(plateNumber, options);
      this.currentVehicle = vehicleInfo;

      const method = this.selectDetectionMethod(vehicleInfo);
      this.currentMethod = method;
      
      audit.inspectionStart(plateNumber, this.inspectionLine.id, method.code);

      await this.sleep(1000 + Math.random() * 2000);

      const inspectionData = testData || this.generateMockTestData(method.code, vehicleInfo);
      const result = this.evaluateResult(method.code, inspectionData, vehicleInfo);

      await this.sleep(500 + Math.random() * 1000);

      const duration = Date.now() - startTime;
      audit.inspectionComplete(plateNumber, this.inspectionLine.id, result.pass ? '合格' : '不合格', duration);
      tracer.complete(result.pass ? 'success' : 'failed', { result, duration });

      return {
        success: true,
        vehicleInfo,
        method,
        inspectionData,
        result,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      tracer.fail('模拟检测失败', { stack: error.stack });
      throw error;
    }
  }

  async close() {
    if (this.vehicleService) {
      await this.vehicleService.close();
    }
    this.isLoggedIn = false;
    logger.info('已关闭模拟检测执行器');
  }
}

function createInspectionRunner(inspectionLineId, useMock = process.env.USE_MOCK === 'true') {
  if (useMock) {
    return new MockInspectionRunner(inspectionLineId);
  }
  return new InspectionRunner(inspectionLineId);
}

module.exports = {
  InspectionRunner,
  MockInspectionRunner,
  ParallelInspectionManager,
  createInspectionRunner,
  DETECTION_METHOD_FIELDS
};
