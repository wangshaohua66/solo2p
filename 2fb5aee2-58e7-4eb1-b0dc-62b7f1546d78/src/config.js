const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const STANDARD_VERSIONS = {
  'HJ1237-2021': {
    name: '机动车排放检验技术规范 HJ1237-2021',
    effectiveDate: '2021-07-01',
    fuelTypes: {
      gasoline: {
        name: '汽油车',
        methods: [
          { code: 'DAS', name: '双怠速法', minYear: 2000, maxYear: 2004 },
          { code: 'ASM', name: '稳态工况法', minYear: 2005, maxYear: 9999 }
        ],
        limits: {
          co: { idle: 0.5, highIdle: 0.3 },
          hc: { idle: 100, highIdle: 50 },
          nox: { asm: 2000 }
        }
      },
      diesel: {
        name: '柴油车',
        methods: [
          { code: 'FAM', name: '自由加速法', minYear: 2000, maxYear: 2008 },
          { code: 'LUGDOWN', name: '加载减速法', minYear: 2009, maxYear: 9999 }
        ],
        limits: {
          smoke: { freeAccel: 1.2, lugdown: 0.7 },
          nox: { lugdown: 1800 }
        }
      },
      motorcycle: {
        name: '摩托车',
        methods: [
          { code: 'IDLE', name: '怠速法', minYear: 2000, maxYear: 9999 }
        ],
        limits: {
          co: { idle: 4.0 },
          hc: { idle: 1200 }
        }
      }
    }
  },
  'HJ1237-2018': {
    name: '机动车排放检验技术规范 HJ1237-2018',
    effectiveDate: '2018-11-01',
    deprecated: true,
    fuelTypes: {
      gasoline: {
        name: '汽油车',
        methods: [
          { code: 'DAS', name: '双怠速法', minYear: 2000, maxYear: 9999 }
        ],
        limits: {
          co: { idle: 0.8, highIdle: 0.5 },
          hc: { idle: 150, highIdle: 80 }
        }
      }
    }
  }
};

const PLATFORM_CONFIG = {
  environmental: {
    name: '省级机动车环保检验平台',
    baseUrl: process.env.ENV_PLATFORM_URL || 'https://env.example.gov.cn',
    loginUrl: process.env.ENV_PLATFORM_LOGIN_URL || '/login',
    loginTimeout: 15000,
    pageTimeout: 15000,
    retryInterval: 5000,
    maxRetries: 3,
    selectors: {
      usernameInput: '#username',
      passwordInput: '#password',
      captchaInput: '#captcha',
      captchaImage: '#captchaImg',
      loginButton: '#loginBtn',
      logoutButton: '#logoutBtn',
      vehiclePlateInput: '#vehiclePlate',
      searchButton: '#searchBtn',
      submitButton: '#submitBtn',
      uploadButton: '#uploadBtn',
      successMessage: '.success-msg',
      errorMessage: '.error-msg'
    }
  },
  traffic: {
    name: '公安交管平台',
    baseUrl: process.env.TRAFFIC_PLATFORM_URL || 'https://traffic.example.gov.cn',
    loginUrl: process.env.TRAFFIC_PLATFORM_LOGIN_URL || '/login',
    queryUrl: process.env.TRAFFIC_PLATFORM_QUERY_URL || '/api/vehicle/query',
    loginTimeout: 15000,
    pageTimeout: 15000,
    retryInterval: 5000,
    maxRetries: 3,
    selectors: {
      usernameInput: '#user',
      passwordInput: '#pwd',
      captchaInput: '#verifyCode',
      captchaImage: '#verifyImg',
      loginButton: 'button[type="submit"]'
    }
  }
};

const INSPECTION_LINES = [
  {
    id: 'LINE001',
    name: '1号检测线',
    type: 'comprehensive',
    active: true,
    maxConcurrent: 1,
    envAccount: {
      username: process.env.ENV_LINE001_USER || 'env_line001',
      password: process.env.ENV_LINE001_PASS || '******',
      role: 'inspector'
    },
    trafficAccount: {
      username: process.env.TRAFFIC_LINE001_USER || 'traffic_line001',
      password: process.env.TRAFFIC_LINE001_PASS || '******'
    }
  },
  {
    id: 'LINE002',
    name: '2号检测线',
    type: 'comprehensive',
    active: true,
    maxConcurrent: 1,
    envAccount: {
      username: process.env.ENV_LINE002_USER || 'env_line002',
      password: process.env.ENV_LINE002_PASS || '******',
      role: 'inspector'
    },
    trafficAccount: {
      username: process.env.TRAFFIC_LINE002_USER || 'traffic_line002',
      password: process.env.TRAFFIC_LINE002_PASS || '******'
    }
  },
  {
    id: 'LINE003',
    name: '3号检测线',
    type: 'gasoline',
    active: true,
    maxConcurrent: 1,
    envAccount: {
      username: process.env.ENV_LINE003_USER || 'env_line003',
      password: process.env.ENV_LINE003_PASS || '******',
      role: 'inspector'
    },
    trafficAccount: {
      username: process.env.TRAFFIC_LINE003_USER || 'traffic_line003',
      password: process.env.TRAFFIC_LINE003_PASS || '******'
    }
  },
  {
    id: 'LINE004',
    name: '4号检测线',
    type: 'gasoline',
    active: true,
    maxConcurrent: 1,
    envAccount: {
      username: process.env.ENV_LINE004_USER || 'env_line004',
      password: process.env.ENV_LINE004_PASS || '******',
      role: 'inspector'
    },
    trafficAccount: {
      username: process.env.TRAFFIC_LINE004_USER || 'traffic_line004',
      password: process.env.TRAFFIC_LINE004_PASS || '******'
    }
  },
  {
    id: 'LINE005',
    name: '5号检测线',
    type: 'diesel',
    active: true,
    maxConcurrent: 1,
    envAccount: {
      username: process.env.ENV_LINE005_USER || 'env_line005',
      password: process.env.ENV_LINE005_PASS || '******',
      role: 'inspector'
    },
    trafficAccount: {
      username: process.env.TRAFFIC_LINE005_USER || 'traffic_line005',
      password: process.env.TRAFFIC_LINE005_PASS || '******'
    }
  },
  {
    id: 'LINE006',
    name: '6号检测线',
    type: 'diesel',
    active: true,
    maxConcurrent: 1,
    envAccount: {
      username: process.env.ENV_LINE006_USER || 'env_line006',
      password: process.env.ENV_LINE006_PASS || '******',
      role: 'inspector'
    },
    trafficAccount: {
      username: process.env.TRAFFIC_LINE006_USER || 'traffic_line006',
      password: process.env.TRAFFIC_LINE006_PASS || '******'
    }
  },
  {
    id: 'LINE007',
    name: '7号检测线',
    type: 'motorcycle',
    active: true,
    maxConcurrent: 1,
    envAccount: {
      username: process.env.ENV_LINE007_USER || 'env_line007',
      password: process.env.ENV_LINE007_PASS || '******',
      role: 'inspector'
    },
    trafficAccount: {
      username: process.env.TRAFFIC_LINE007_USER || 'traffic_line007',
      password: process.env.TRAFFIC_LINE007_PASS || '******'
    }
  },
  {
    id: 'LINE008',
    name: '8号检测线',
    type: 'motorcycle',
    active: true,
    maxConcurrent: 1,
    envAccount: {
      username: process.env.ENV_LINE008_USER || 'env_line008',
      password: process.env.ENV_LINE008_PASS || '******',
      role: 'inspector'
    },
    trafficAccount: {
      username: process.env.TRAFFIC_LINE008_USER || 'traffic_line008',
      password: process.env.TRAFFIC_LINE008_PASS || '******'
    }
  }
];

const FIELD_MAPPING = {
  trafficToEnv: {
    'plateNumber': 'vehiclePlate',
    'plateColor': 'plateColorCode',
    'vehicleType': 'vehicleTypeCode',
    'fuelType': 'fuelTypeCode',
    'registerDate': 'registerDate',
    'engineDisplacement': 'displacement',
    'engineNumber': 'engineNo',
    'vin': 'vinCode',
    'brand': 'vehicleBrand',
    'model': 'vehicleModel',
    'owner': 'ownerName',
    'idCard': 'ownerIdCard',
    'phone': 'contactPhone',
    'address': 'ownerAddress'
  }
};

const CODE_MAPPING = {
  fuelType: {
    'A': 'gasoline',
    'B': 'diesel',
    'C': 'natural_gas',
    'D': 'electric',
    '1': 'gasoline',
    '2': 'diesel',
    '汽油': 'gasoline',
    '柴油': 'diesel',
    '天然气': 'natural_gas',
    '电动': 'electric',
    '混合动力': 'hybrid',
    'gasoline': 'gasoline',
    'diesel': 'diesel'
  },
  plateColor: {
    '0': 'yellow',
    '1': 'blue',
    '2': 'black',
    '3': 'white',
    '4': 'green',
    '黄色': 'yellow',
    '蓝色': 'blue',
    '黑色': 'black',
    '白色': 'white',
    '绿色': 'green',
    'yellow': 'yellow',
    'blue': 'blue',
    'green': 'green'
  },
  vehicleType: {
    '01': 'car',
    '02': 'suv',
    '03': 'truck',
    '04': 'bus',
    '05': 'motorcycle',
    '小型普通客车': 'car',
    '小型轿车': 'car',
    '微型轿车': 'car',
    '中型普通客车': 'suv',
    '大型普通客车': 'bus',
    '中型货车': 'truck',
    '重型货车': 'truck',
    '轻型货车': 'truck',
    '普通摩托车': 'motorcycle',
    '轻便摩托车': 'motorcycle',
    'car': 'car',
    'suv': 'suv',
    'truck': 'truck',
    'bus': 'bus',
    'motorcycle': 'motorcycle'
  }
};

const ALERT_CONFIG = {
  dingtalk: {
    webhook: process.env.DINGTALK_WEBHOOK || '',
    secret: process.env.DINGTALK_SECRET || '',
    atMobiles: process.env.DINGTALK_AT_MOBILES?.split(',') || [],
    enabled: true
  },
  email: {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: process.env.SMTP_PORT || 587,
    username: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASS || '',
    recipients: process.env.ALERT_RECIPIENTS?.split(',') || [],
    enabled: false
  }
};

const PERFORMANCE_CONFIG = {
  maxProcessingTimePerVehicle: 90000,
  batchProcessingRatePerHour: 40,
  pageTimeout: 15000,
  retryInterval: 5000,
  maxMemoryMB: 512,
  maxConcurrentLines: 2,
  maxLogSizePerDayMB: 50
};

const ORGANIZATION_INFO = {
  name: 'XX市机动车排放检验中心',
  code: 'XX-2024-001',
  address: 'XX市XX区XX路XX号',
  contact: '0755-XXXXXXX',
  legalPerson: 'XXX'
};

class ConfigManager {
  constructor() {
    this.currentStandardVersion = 'HJ1237-2021';
    this.configPath = path.join(__dirname, '..', 'config', 'custom-config.json');
    this.loadCustomConfig();
  }

  loadCustomConfig() {
    if (fs.existsSync(this.configPath)) {
      try {
        const customConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        if (customConfig.standardVersion) {
          this.currentStandardVersion = customConfig.standardVersion;
        }
      } catch (e) {
        console.warn('加载自定义配置失败:', e.message);
      }
    }
  }

  saveCustomConfig(config) {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    this.loadCustomConfig();
  }

  getPlatformConfig(platform) {
    return PLATFORM_CONFIG[platform];
  }

  getInspectionLine(lineId) {
    return INSPECTION_LINES.find(line => line.id === lineId && line.active);
  }

  getActiveInspectionLines() {
    return INSPECTION_LINES.filter(line => line.active);
  }

  getInspectionLinesByType(type) {
    return INSPECTION_LINES.filter(line => line.active && (line.type === type || line.type === 'comprehensive'));
  }

  getStandard(version) {
    return STANDARD_VERSIONS[version || this.currentStandardVersion];
  }

  getCurrentStandard() {
    return STANDARD_VERSIONS[this.currentStandardVersion];
  }

  setCurrentStandard(version) {
    if (STANDARD_VERSIONS[version] && !STANDARD_VERSIONS[version].deprecated) {
      this.currentStandardVersion = version;
      this.saveCustomConfig({ standardVersion: version });
      return true;
    }
    return false;
  }

  getAvailableStandards() {
    return Object.entries(STANDARD_VERSIONS)
      .filter(([_, v]) => !v.deprecated)
      .map(([code, standard]) => ({
        code,
        name: standard.name,
        effectiveDate: standard.effectiveDate
      }));
  }

  getDetectionMethod(fuelType, registerYear, version) {
    const standard = this.getStandard(version);
    const fuelConfig = standard.fuelTypes[fuelType];
    if (!fuelConfig) return null;

    return fuelConfig.methods.find(m => registerYear >= m.minYear && registerYear <= m.maxYear);
  }

  getFieldMapping() {
    return FIELD_MAPPING;
  }

  getCodeMapping() {
    return CODE_MAPPING;
  }

  mapField(trafficField) {
    return FIELD_MAPPING.trafficToEnv[trafficField] || trafficField;
  }

  mapCode(codeType, trafficCode) {
    const mapping = CODE_MAPPING[codeType];
    return mapping ? mapping[trafficCode] || trafficCode : trafficCode;
  }

  getAlertConfig() {
    return ALERT_CONFIG;
  }

  getPerformanceConfig() {
    return PERFORMANCE_CONFIG;
  }

  getOrganizationInfo() {
    return ORGANIZATION_INFO;
  }

  validateConfig() {
    const errors = [];
    
    if (!process.env.ENV_PLATFORM_URL) {
      errors.push('缺少环保平台URL配置 (ENV_PLATFORM_URL)');
    }
    if (!process.env.TRAFFIC_PLATFORM_URL) {
      errors.push('缺少交管平台URL配置 (TRAFFIC_PLATFORM_URL)');
    }
    
    const activeLines = this.getActiveInspectionLines();
    if (activeLines.length === 0) {
      errors.push('没有可用的检测线配置');
    }

    return { valid: errors.length === 0, errors };
  }
}

module.exports = new ConfigManager();
module.exports.PLATFORM_CONFIG = PLATFORM_CONFIG;
module.exports.INSPECTION_LINES = INSPECTION_LINES;
module.exports.STANDARD_VERSIONS = STANDARD_VERSIONS;
module.exports.FIELD_MAPPING = FIELD_MAPPING;
module.exports.CODE_MAPPING = CODE_MAPPING;
module.exports.ALERT_CONFIG = ALERT_CONFIG;
module.exports.PERFORMANCE_CONFIG = PERFORMANCE_CONFIG;
module.exports.ORGANIZATION_INFO = ORGANIZATION_INFO;
