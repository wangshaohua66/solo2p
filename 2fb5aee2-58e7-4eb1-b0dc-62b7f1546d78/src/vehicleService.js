const path = require('path');
const dayjs = require('dayjs');
const { logger, audit, OperationTracer } = require('./logger');
const config = require('./config');
const { errorHandler, ERROR_TYPES, InspectionError } = require('./errorHandler');
const { createDriver, By, until } = require('./webdriver/adapter');

class VehicleService {
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
    this.cache = new Map();
    this.cacheTTL = 3600000;
    this.platformConfig = config.getPlatformConfig('traffic');
  }

  async init() {
    const tracer = new OperationTracer('初始化交管平台连接', {
      inspectionLine: this.inspectionLine.id
    });

    try {
      tracer.logStep('创建Chrome浏览器实例 (WebdriverIO)');
      
      this.driver = createDriver({ platform: 'traffic' });
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
      await errorHandler.handle(error, {
        inspectionLine: this.inspectionLine.id,
        driver: this.driver
      });
      throw error;
    }
  }

  async login() {
    const tracer = new OperationTracer('交管平台登录', {
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
        const account = this.inspectionLine.trafficAccount;

        tracer.logStep('输入用户名');
        await this.driver.wait(until.elementLocated(By.css(selectors.usernameInput)), 10000);
        await this.driver.findElement(By.css(selectors.usernameInput)).sendKeys(account.username);

        tracer.logStep('输入密码');
        await this.driver.findElement(By.css(selectors.passwordInput)).sendKeys(account.password);

        tracer.logStep('处理验证码');
        const captcha = await this.handleCaptcha(selectors);
        if (captcha) {
          await this.driver.findElement(By.css(selectors.captchaInput)).sendKeys(captcha);
        }

        tracer.logStep('提交登录');
        await this.driver.findElement(By.css(selectors.loginButton)).click();

        await this.verifyLogin();
        this.isLoggedIn = true;

        audit.login(
          'traffic_platform',
          account.username,
          this.inspectionLine.id,
          true
        );

        tracer.complete('success');
        return true;
      } catch (error) {
        audit.login(
          'traffic_platform',
          this.inspectionLine.trafficAccount.username,
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

      logger.info('检测到验证码，需要人工识别');
      
      const screenshot = await captchaImg.takeScreenshot();
      const timestamp = dayjs().format('YYYYMMDDHHmmss');
      const captchaPath = path.join(__dirname, '..', 'screenshots', `captcha-${timestamp}.png`);
      
      const fs = require('fs');
      fs.writeFileSync(captchaPath, screenshot, 'base64');
      
      logger.warn(`验证码已保存到: ${captchaPath}，请在30秒内输入验证码`);
      
      return null;
    } catch (error) {
      logger.debug('未检测到验证码或验证码处理失败', error.message);
      return null;
    }
  }

  async verifyLogin() {
    try {
      const currentUrl = await this.driver.getCurrentUrl();
      if (currentUrl.includes('login')) {
        throw new InspectionError(
          ERROR_TYPES.CAPTCHA_FAILED,
          '登录失败，可能需要验证码或账号密码错误'
        );
      }
      logger.info('交管平台登录验证成功');
      return true;
    } catch (error) {
      if (error.type === ERROR_TYPES.CAPTCHA_FAILED) {
        throw error;
      }
      throw new InspectionError(
        ERROR_TYPES.SESSION_EXPIRED,
        '登录验证失败: ' + error.message
      );
    }
  }

  async queryVehicle(plateNumber, options = {}) {
    const tracer = new OperationTracer('车辆信息查询', {
      inspectionLine: this.inspectionLine.id,
      vehiclePlate: plateNumber
    });

    try {
      tracer.logStep(`查询车辆: ${plateNumber}`);

      if (!options.skipCache && this.cache.has(plateNumber)) {
        const cached = this.cache.get(plateNumber);
        if (Date.now() - cached.timestamp < this.cacheTTL) {
          tracer.logStep('使用缓存数据');
          audit.vehicleQuery(plateNumber, this.inspectionLine.id, cached.data, 'cache');
          return cached.data;
        }
      }

      if (!this.isLoggedIn) {
        await this.login();
      }

      const result = await errorHandler.retryWithStrategy(async (attempt) => {
        tracer.logStep(`第 ${attempt} 次查询尝试`);
        return this.doQuery(plateNumber);
      }, {
        inspectionLine: this.inspectionLine.id,
        vehiclePlate: plateNumber,
        driver: this.driver
      });

      if (!result.success) {
        throw result.error;
      }

      const vehicleInfo = this.transformVehicleData(result.result);
      
      this.cache.set(plateNumber, {
        data: vehicleInfo,
        timestamp: Date.now()
      });

      audit.vehicleQuery(plateNumber, this.inspectionLine.id, vehicleInfo, 'traffic_platform');
      tracer.complete('success', { plateNumber });
      
      return vehicleInfo;
    } catch (error) {
      tracer.fail('车辆查询失败', { stack: error.stack });
      await errorHandler.handle(error, {
        inspectionLine: this.inspectionLine.id,
        vehiclePlate: plateNumber,
        driver: this.driver
      });
      throw error;
    }
  }

  async doQuery(plateNumber) {
    const queryUrl = this.platformConfig.baseUrl + this.platformConfig.queryUrl;
    
    logger.debug(`访问查询页面: ${queryUrl}`);
    await this.driver.get(queryUrl);

    await this.driver.wait(until.elementLocated(By.css('#plateNumber')), 10000);
    
    await this.driver.findElement(By.css('#plateNumber')).clear();
    await this.driver.findElement(By.css('#plateNumber')).sendKeys(plateNumber);

    await this.driver.findElement(By.css('#queryBtn')).click();

    await this.driver.wait(until.elementLocated(By.css('.result-table')), 15000);

    const resultData = await this.driver.executeScript(() => {
      const rows = document.querySelectorAll('.result-table tr');
      const data = {};
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const key = cells[0].textContent.trim();
          const value = cells[1].textContent.trim();
          if (key && value) {
            data[key] = value;
          }
        }
      });
      return data;
    });

    if (Object.keys(resultData).length === 0) {
      throw new InspectionError(
        ERROR_TYPES.VALIDATION_FAILED,
        `未查询到车牌号 ${plateNumber} 的车辆信息`
      );
    }

    return resultData;
  }

  transformVehicleData(trafficData) {
    const mapping = config.getFieldMapping();
    const codeMapping = config.getCodeMapping();
    const transformed = {};

    const fieldNameMap = {
      '号牌号码': 'plateNumber',
      '号牌种类': 'plateType',
      '号牌颜色': 'plateColor',
      '车辆类型': 'vehicleType',
      '燃料种类': 'fuelType',
      '使用性质': 'useNature',
      '注册日期': 'registerDate',
      '发证日期': 'issueDate',
      '发动机号码': 'engineNumber',
      '发动机排量': 'engineDisplacement',
      '发动机型号': 'engineModel',
      '车辆识别代号': 'vin',
      '品牌型号': 'brandModel',
      '车辆品牌': 'brand',
      '车辆型号': 'model',
      '所有人': 'owner',
      '身份证明号码': 'idCard',
      '联系电话': 'phone',
      '住址': 'address',
      '检验有效期止': 'inspectionExpiryDate',
      '强制报废期止': 'scrapDate',
      '总质量': 'totalMass',
      '整备质量': 'curbMass',
      '核定载人数': 'passengerCapacity'
    };

    for (const [cnName, value] of Object.entries(trafficData)) {
      const fieldKey = fieldNameMap[cnName];
      if (fieldKey) {
        transformed[fieldKey] = value;
      }
    }

    transformed.fuelTypeCode = config.mapCode('fuelType', transformed.fuelType || '1');
    transformed.plateColorCode = config.mapCode('plateColor', transformed.plateColor || '1');
    transformed.vehicleTypeCode = config.mapCode('vehicleType', transformed.vehicleType || '01');

    if (transformed.engineDisplacement) {
      const displacementMatch = transformed.engineDisplacement.match(/(\d+(\.\d+)?)/);
      if (displacementMatch) {
        transformed.displacementML = parseFloat(displacementMatch[1]);
      }
    }

    if (transformed.registerDate) {
      transformed.registerYear = dayjs(transformed.registerDate).year();
    }

    if (transformed.brandModel && !transformed.brand) {
      const brandParts = transformed.brandModel.split(/[\/\-]/);
      transformed.brand = brandParts[0]?.trim() || '';
      transformed.model = brandParts[1]?.trim() || transformed.brandModel;
    }

    const envFields = {};
    for (const [trafficField, envField] of Object.entries(mapping.trafficToEnv)) {
      if (transformed[trafficField] !== undefined) {
        envFields[envField] = transformed[trafficField];
      }
    }

    transformed.envPlatformFields = envFields;

    const detectionMethod = config.getDetectionMethod(
      transformed.fuelTypeCode,
      transformed.registerYear
    );
    if (detectionMethod) {
      transformed.recommendedMethod = detectionMethod;
    }

    return transformed;
  }

  validateVehicleInfo(vehicleInfo) {
    const errors = [];

    if (!vehicleInfo.plateNumber) {
      errors.push('缺少车牌号');
    } else if (!/^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-Z0-9]{4,5}[A-Z0-9挂学警港澳]$/.test(vehicleInfo.plateNumber)) {
      errors.push('车牌号格式不正确');
    }

    if (!vehicleInfo.fuelTypeCode) {
      errors.push('缺少燃料类型信息');
    }

    if (!vehicleInfo.registerYear) {
      errors.push('缺少注册年份信息');
    }

    if (!vehicleInfo.vin) {
      errors.push('缺少车辆识别代号(VIN)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async getEnvPlatformFields(plateNumber) {
    const vehicleInfo = await this.queryVehicle(plateNumber);
    return vehicleInfo.envPlatformFields;
  }

  async getRecommendedMethod(plateNumber) {
    const vehicleInfo = await this.queryVehicle(plateNumber);
    return vehicleInfo.recommendedMethod;
  }

  async close() {
    if (this.driver) {
      try {
        audit.logout(
          'traffic_platform',
          this.inspectionLine.trafficAccount.username,
          this.inspectionLine.id
        );
        await this.driver.quit();
      } catch (error) {
        logger.warn('关闭浏览器失败', error.message);
      }
      this.driver = null;
      this.isLoggedIn = false;
    }
  }

  clearCache() {
    const count = this.cache.size;
    this.cache.clear();
    logger.info(`已清空车辆信息缓存，共 ${count} 条`);
    return count;
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      ttl: this.cacheTTL,
      keys: Array.from(this.cache.keys())
    };
  }

  async checkSession() {
    if (!this.driver || !this.isLoggedIn) {
      return false;
    }

    try {
      await this.driver.executeScript('return document.readyState');
      return true;
    } catch (error) {
      this.isLoggedIn = false;
      return false;
    }
  }
}

class MockVehicleService extends VehicleService {
  constructor(inspectionLineId) {
    super(inspectionLineId);
    this.mockData = this.generateMockData();
  }

  async init() {
    logger.info('使用模拟车辆服务（测试模式）');
    return true;
  }

  async login() {
    this.isLoggedIn = true;
    logger.info('模拟登录交管平台成功');
    return true;
  }

  async queryVehicle(plateNumber, options = {}) {
    const tracer = new OperationTracer('模拟车辆信息查询', {
      inspectionLine: this.inspectionLine.id,
      vehiclePlate: plateNumber
    });

    try {
      tracer.logStep(`查询车辆: ${plateNumber}`);

      await this.sleep(500 + Math.random() * 1000);

      let vehicleData = this.mockData[plateNumber];
      if (!vehicleData) {
        vehicleData = this.generateRandomVehicleData(plateNumber);
      }

      const result = this.transformVehicleData(vehicleData);
      
      audit.vehicleQuery(plateNumber, this.inspectionLine.id, result, 'mock');
      tracer.complete('success', { plateNumber });

      return result;
    } catch (error) {
      tracer.fail('模拟查询失败', { stack: error.stack });
      throw error;
    }
  }

  generateMockData() {
    return {
      '粤B12345': {
        '号牌号码': '粤B12345',
        '号牌颜色': '蓝色',
        '车辆类型': '小型轿车',
        '燃料种类': '汽油',
        '注册日期': '2020-05-15',
        '发动机号码': 'E1234567',
        '发动机排量': '1998ml',
        '车辆识别代号': 'LVSHFFAL0NC123456',
        '品牌型号': '丰田/丰田牌TV7203G',
        '所有人': '张三',
        '身份证明号码': '440301199001011234',
        '联系电话': '13800138000',
        '住址': '广东省深圳市南山区',
        '检验有效期止': '2026-05-31'
      },
      '粤B67890': {
        '号牌号码': '粤B67890',
        '号牌颜色': '黄色',
        '车辆类型': '中型货车',
        '燃料种类': '柴油',
        '注册日期': '2018-03-20',
        '发动机号码': 'D7654321',
        '发动机排量': '4250ml',
        '车辆识别代号': 'LVBV6P9B8JE654321',
        '品牌型号': '东风/东风牌DFH1160',
        '所有人': '李四',
        '身份证明号码': '440301198505055678',
        '联系电话': '13900139000',
        '住址': '广东省深圳市宝安区',
        '检验有效期止': '2026-03-31'
      }
    };
  }

  generateRandomVehicleData(plateNumber) {
    const fuelTypes = ['汽油', '柴油'];
    const vehicleTypes = ['小型轿车', '中型货车', '小型普通客车'];
    const plateColors = ['蓝色', '黄色', '绿色'];
    const brands = ['丰田', '大众', '本田', '比亚迪', '东风'];

    const fuelType = fuelTypes[Math.floor(Math.random() * fuelTypes.length)];
    const year = 2015 + Math.floor(Math.random() * 10);
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    const brand = brands[Math.floor(Math.random() * brands.length)];

    return {
      '号牌号码': plateNumber,
      '号牌颜色': plateColors[Math.floor(Math.random() * plateColors.length)],
      '车辆类型': vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)],
      '燃料种类': fuelType,
      '注册日期': `${year}-${month}-${day}`,
      '发动机号码': 'E' + Math.floor(Math.random() * 10000000),
      '发动机排量': (1500 + Math.floor(Math.random() * 3000)) + 'ml',
      '车辆识别代号': 'LV' + Math.random().toString(36).substring(2, 18).toUpperCase(),
      '品牌型号': `${brand}/${brand}牌XXX`,
      '所有人': '车主' + Math.floor(Math.random() * 1000),
      '身份证明号码': '440301' + (1980 + Math.floor(Math.random() * 40)) + '0101' + Math.floor(Math.random() * 10000),
      '联系电话': '138' + Math.floor(Math.random() * 100000000),
      '住址': '广东省深圳市XX区XX路XX号',
      '检验有效期止': `${year + 6}-${month}-${day}`
    };
  }

  async close() {
    this.isLoggedIn = false;
    logger.info('已关闭模拟车辆服务');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

function createVehicleService(inspectionLineId, useMock = process.env.USE_MOCK === 'true') {
  if (useMock) {
    return new MockVehicleService(inspectionLineId);
  }
  return new VehicleService(inspectionLineId);
}

module.exports = {
  VehicleService,
  MockVehicleService,
  createVehicleService
};
