const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const dayjs = require('dayjs');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { logger, audit, OperationTracer } = require('./logger');
const config = require('./config');
const { errorHandler, ERROR_TYPES, InspectionError } = require('./errorHandler');
const { createVehicleService } = require('./vehicleService');

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
  constructor(inspectionLineId) {
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
    this.vehicleService = null;
    this.currentVehicle = null;
    this.currentMethod = null;
  }

  async init() {
    const tracer = new OperationTracer('初始化环保平台连接', {
      inspectionLine: this.inspectionLine.id
    });

    try {
      tracer.logStep('创建Chrome浏览器实例');
      const options = new chrome.Options();
      
      if (process.env.NODE_ENV === 'production') {
        options.addArguments('--headless=new');
      }
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
      options.addArguments('--disable-gpu');
      options.addArguments('--window-size=1920,1080');
      options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      options.addArguments('--disable-popup-blocking');
      options.addArguments('--disable-notifications');

      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

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

    return errorHandler.retryWithStrategy(async (attempt) => {
      tracer.logStep(`第 ${attempt} 次登录尝试`);

      try {
        const loginUrl = this.platformConfig.baseUrl + this.platformConfig.loginUrl;
        tracer.logStep(`访问登录页面: ${loginUrl}`);
        await this.driver.get(loginUrl);

        const selectors = this.platformConfig.selectors;
        const account = this.inspectionLine.envAccount;

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

        audit.login(
          'env_platform',
          account.username,
          this.inspectionLine.id,
          true
        );

        tracer.complete('success');
        return true;
      } catch (error) {
        audit.login(
          'env_platform',
          this.inspectionLine.envAccount.username,
          this.inspectionLine.id,
          false,
          error.message
        );
        throw error;
      }
    }, {
      inspectionLine: this.inspectionLine.id,
      driver: this.driver
    });
  }

  async handleCaptcha(selectors) {
    try {
      const captchaImg = await this.driver.findElement(By.css(selectors.captchaImage));
      if (!captchaImg) return null;

      const isDisplayed = await captchaImg.isDisplayed();
      if (!isDisplayed) return null;

      logger.info('检测到验证码，需要人工识别');
      
      const screenshot = await captchaImg.takeScreenshot();
      const timestamp = dayjs().format('YYYYMMDDHHmmss');
      const captchaPath = path.join(__dirname, '..', 'screenshots', `env-captcha-${timestamp}.png`);
      
      fs.writeFileSync(captchaPath, screenshot, 'base64');
      
      logger.warn(`验证码已保存到: ${captchaPath}`);
      
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

  async close() {
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
  createInspectionRunner,
  DETECTION_METHOD_FIELDS
};
