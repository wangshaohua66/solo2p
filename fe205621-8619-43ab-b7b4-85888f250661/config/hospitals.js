const path = require('path');

const HOSPITALS = [
  {
    id: 'h001',
    name: '北京协和医院',
    shortName: '协和医院',
    baseUrl: 'https://www.pumch.cn/guahao',
    loginUrl: 'https://www.pumch.cn/login',
    appointmentUrl: 'https://www.pumch.cn/appointment',
    captchaType: 'image',
    refreshInterval: 120,
    priority: 1,
    maxRetries: 3,
    rateLimit: 10,
    departments: {
      cardiology: { name: '心内科', code: 'XN001', hot: true },
      neurology: { name: '神经内科', code: 'SJ001', hot: true },
      orthopedics: { name: '骨科', code: 'GK001', hot: true },
      oncology: { name: '肿瘤科', code: 'ZL001', hot: false },
      pediatrics: { name: '儿科', code: 'EK001', hot: false },
      dermatology: { name: '皮肤科', code: 'PF001', hot: false }
    },
    selectors: {
      usernameInput: '#username',
      passwordInput: '#password',
      captchaInput: '#captcha',
      captchaImage: '#captcha-img',
      loginButton: '#login-btn',
      departmentList: '.dept-list',
      doctorCard: '.doctor-card',
      appointmentSlot: '.appt-slot',
      bookButton: '.book-btn'
    },
    releaseSchedule: {
      time: '08:00',
      daysAhead: 7
    },
    account: {
      username: process.env.PUMCH_USERNAME || 'demo_user',
      password: process.env.PUMCH_PASSWORD || 'demo_pass'
    }
  },
  {
    id: 'h002',
    name: '北京301医院',
    shortName: '301医院',
    baseUrl: 'https://www.301hospital.com.cn/register',
    loginUrl: 'https://www.301hospital.com.cn/login',
    appointmentUrl: 'https://www.301hospital.com.cn/appt',
    captchaType: 'slider',
    refreshInterval: 150,
    priority: 1,
    maxRetries: 3,
    rateLimit: 8,
    departments: {
      cardiology: { name: '心血管内科', code: 'CARD01', hot: true },
      neurology: { name: '神经内科', code: 'NEUR01', hot: true },
      orthopedics: { name: '骨科', code: 'ORTH01', hot: true },
      ophthalmology: { name: '眼科', code: 'OPHT01', hot: false },
      ent: { name: '耳鼻喉科', code: 'ENT01', hot: false },
      gastroenterology: { name: '消化内科', code: 'GAST01', hot: true }
    },
    selectors: {
      usernameInput: 'input[name="username"]',
      passwordInput: 'input[name="password"]',
      sliderContainer: '.slider-container',
      sliderButton: '.slider-btn',
      loginButton: '.login-submit',
      departmentList: '.department-wrapper',
      doctorItem: '.doctor-item',
      timeSlot: '.time-slot',
      reserveBtn: '.reserve-btn'
    },
    releaseSchedule: {
      time: '09:00',
      daysAhead: 7
    },
    account: {
      username: process.env.H301_USERNAME || 'demo_user',
      password: process.env.H301_PASSWORD || 'demo_pass'
    }
  },
  {
    id: 'h003',
    name: '上海瑞金医院',
    shortName: '瑞金医院',
    baseUrl: 'https://www.rjh.com.cn/guahao',
    loginUrl: 'https://www.rjh.com.cn/user/login',
    appointmentUrl: 'https://www.rjh.com.cn/appointment/list',
    captchaType: 'none',
    refreshInterval: 180,
    priority: 2,
    maxRetries: 3,
    rateLimit: 12,
    departments: {
      cardiology: { name: '心内科', code: 'CARDIO-01', hot: true },
      neurology: { name: '神经内科', code: 'NEURO-01', hot: true },
      orthopedics: { name: '骨科', code: 'ORTHO-01', hot: true },
      endocrinology: { name: '内分泌科', code: 'ENDO-01', hot: true },
      hematology: { name: '血液科', code: 'HEMA-01', hot: false },
      nephrology: { name: '肾内科', code: 'NEPH-01', hot: false }
    },
    selectors: {
      phoneInput: '#phone',
      smsCodeInput: '#sms-code',
      sendSmsBtn: '.send-sms-btn',
      loginButton: '#login-btn',
      deptNav: '.dept-nav',
      doctorList: '.doctor-list',
      scheduleItem: '.schedule-item',
      bookBtn: '.book-now-btn'
    },
    releaseSchedule: {
      time: '07:30',
      daysAhead: 14
    },
    account: {
      phone: process.env.RJH_PHONE || '13800138000'
    }
  },
  {
    id: 'h004',
    name: '复旦大学附属中山医院',
    shortName: '中山医院',
    baseUrl: 'https://www.zs-hospital.sh.cn/register',
    loginUrl: 'https://www.zs-hospital.sh.cn/login',
    appointmentUrl: 'https://www.zs-hospital.sh.cn/appointments',
    captchaType: 'image',
    refreshInterval: 150,
    priority: 2,
    maxRetries: 3,
    rateLimit: 10,
    departments: {
      cardiology: { name: '心内科', code: 'XNK01', hot: true },
      neurology: { name: '神经内科', code: 'SJNK01', hot: true },
      orthopedics: { name: '骨科', code: 'GK01', hot: true },
      pulmonology: { name: '呼吸科', code: 'HXK01', hot: true },
      hepatology: { name: '肝肿瘤科', code: 'GZL01', hot: true },
      urology: { name: '泌尿外科', code: 'MNWK01', hot: false }
    },
    selectors: {
      usernameInput: '#userAccount',
      passwordInput: '#userPassword',
      captchaInput: '#verifyCode',
      captchaImage: '#verifyImg',
      loginButton: '.login-btn',
      deptTree: '.dept-tree',
      doctorCard: '.doctor-card',
      regInfo: '.reg-info',
      regBtn: '.reg-btn'
    },
    releaseSchedule: {
      time: '08:30',
      daysAhead: 7
    },
    account: {
      username: process.env.ZS_USERNAME || 'demo_user',
      password: process.env.ZS_PASSWORD || 'demo_pass'
    }
  },
  {
    id: 'h005',
    name: '广州中山一院',
    shortName: '中山一院',
    baseUrl: 'https://www.zsyy.com/guahao',
    loginUrl: 'https://www.zsyy.com/user/login',
    appointmentUrl: 'https://www.zsyy.com/appt',
    captchaType: 'slider',
    refreshInterval: 180,
    priority: 2,
    maxRetries: 3,
    rateLimit: 8,
    departments: {
      cardiology: { name: '心内科', code: 'XNK001', hot: true },
      neurology: { name: '神经内科', code: 'SJNK001', hot: true },
      orthopedics: { name: '骨科', code: 'GK001', hot: true },
      gastroenterology: { name: '消化内科', code: 'XHNK001', hot: false },
      endocrinology: { name: '内分泌科', code: 'NFMK001', hot: false },
      rheumatology: { name: '风湿科', code: 'FSK001', hot: false }
    },
    selectors: {
      usernameInput: 'input#username',
      passwordInput: 'input#password',
      captchaSlider: '.captcha-slider',
      sliderTrack: '.slider-track',
      sliderThumb: '.slider-thumb',
      loginButton: '#submit-login',
      departmentTabs: '.dept-tabs',
      doctorProfile: '.doctor-profile',
      appointmentTimes: '.appointment-times',
      bookButton: '.book-appointment'
    },
    releaseSchedule: {
      time: '08:00',
      daysAhead: 7
    },
    account: {
      username: process.env.ZSYY_USERNAME || 'demo_user',
      password: process.env.ZSYY_PASSWORD || 'demo_pass'
    }
  },
  {
    id: 'h006',
    name: '武汉同济医院',
    shortName: '同济医院',
    baseUrl: 'https://www.tjh.com/registration',
    loginUrl: 'https://www.tjh.com/login',
    appointmentUrl: 'https://www.tjh.com/appointments',
    captchaType: 'image',
    refreshInterval: 200,
    priority: 3,
    maxRetries: 3,
    rateLimit: 10,
    departments: {
      cardiology: { name: '心血管内科', code: 'XXGNK01', hot: true },
      neurology: { name: '神经内科', code: 'SJNK01', hot: true },
      orthopedics: { name: '骨科', code: 'GK01', hot: true },
      obstetrics: { name: '妇产科', code: 'FCK01', hot: false },
      pediatrics: { name: '儿科', code: 'EK01', hot: false },
      generalSurgery: { name: '普外科', code: 'PWK01', hot: false }
    },
    selectors: {
      usernameInput: '#loginName',
      passwordInput: '#loginPwd',
      captchaInput: '#captchaCode',
      captchaImg: '#captchaPic',
      loginButton: '.login-button',
      deptList: '.department-list',
      doctorInfo: '.doctor-info',
      scheduleTable: '.schedule-table',
      apptButton: '.appointment-btn'
    },
    releaseSchedule: {
      time: '07:00',
      daysAhead: 7
    },
    account: {
      username: process.env.TJH_USERNAME || 'demo_user',
      password: process.env.TJH_PASSWORD || 'demo_pass'
    }
  },
  {
    id: 'h007',
    name: '成都华西医院',
    shortName: '华西医院',
    baseUrl: 'https://www.wchscu.cn/guahao',
    loginUrl: 'https://www.wchscu.cn/user/login',
    appointmentUrl: 'https://www.wchscu.cn/appointment',
    captchaType: 'slider',
    refreshInterval: 180,
    priority: 3,
    maxRetries: 3,
    rateLimit: 8,
    departments: {
      cardiology: { name: '心脏内科', code: 'XZN01', hot: true },
      neurology: { name: '神经内科', code: 'SJ01', hot: true },
      orthopedics: { name: '骨科', code: 'GK01', hot: true },
      oncology: { name: '肿瘤科', code: 'ZL01', hot: true },
      thoracicSurgery: { name: '胸外科', code: 'XWK01', hot: false },
      neurosurgery: { name: '神经外科', code: 'SJWK01', hot: false }
    },
    selectors: {
      usernameInput: '.login-username',
      passwordInput: '.login-password',
      sliderWrapper: '.slide-wrapper',
      sliderBtn: '.slide-btn',
      loginButton: '.login-submit-btn',
      deptContainer: '.department-container',
      doctorCard: '.doctor-card-item',
      timeSlotList: '.timeslot-list',
      reserveButton: '.reserve-button'
    },
    releaseSchedule: {
      time: '08:00',
      daysAhead: 14
    },
    account: {
      username: process.env.HX_USERNAME || 'demo_user',
      password: process.env.HX_PASSWORD || 'demo_pass'
    }
  },
  {
    id: 'h008',
    name: '南京鼓楼医院',
    shortName: '鼓楼医院',
    baseUrl: 'https://www.njglyy.com/guahao',
    loginUrl: 'https://www.njglyy.com/login',
    appointmentUrl: 'https://www.njglyy.com/appt/list',
    captchaType: 'none',
    refreshInterval: 200,
    priority: 3,
    maxRetries: 3,
    rateLimit: 12,
    departments: {
      cardiology: { name: '心内科', code: 'CARD001', hot: true },
      neurology: { name: '神经内科', code: 'NEURO001', hot: true },
      orthopedics: { name: '骨科', code: 'ORTHO001', hot: true },
      rheumatology: { name: '风湿免疫科', code: 'RHEUM001', hot: false },
      dermatology: { name: '皮肤科', code: 'DERM001', hot: false },
      endocrinology: { name: '内分泌科', code: 'ENDO001', hot: false }
    },
    selectors: {
      phoneInput: '#mobile',
      verifyCodeInput: '#verifyCode',
      getCodeBtn: '.get-code-btn',
      loginButton: '#loginBtn',
      deptMenu: '.dept-menu',
      doctorItem: '.doctor-item',
      scheduleList: '.schedule-list',
      bookBtn: '.book-btn'
    },
    releaseSchedule: {
      time: '07:30',
      daysAhead: 7
    },
    account: {
      phone: process.env.GLYY_PHONE || '13800138000'
    }
  },
  {
    id: 'h009',
    name: '西安西京医院',
    shortName: '西京医院',
    baseUrl: 'https://www.xjyy.com/register',
    loginUrl: 'https://www.xjyy.com/user/login',
    appointmentUrl: 'https://www.xjyy.com/appointments',
    captchaType: 'image',
    refreshInterval: 220,
    priority: 3,
    maxRetries: 3,
    rateLimit: 10,
    departments: {
      cardiology: { name: '心血管内科', code: 'XXG01', hot: true },
      neurology: { name: '神经内科', code: 'SJ01', hot: true },
      orthopedics: { name: '骨科', code: 'GK01', hot: true },
      digestive: { name: '消化内科', code: 'XH01', hot: false },
      respiratory: { name: '呼吸内科', code: 'HX01', hot: false },
      nephrology: { name: '肾病内科', code: 'SB01', hot: false }
    },
    selectors: {
      usernameInput: '#userName',
      passwordInput: '#passWord',
      captchaInput: '#captchaCode',
      captchaImage: '.captcha-image',
      loginButton: '.login-btn-submit',
      deptNav: '.department-nav',
      doctorList: '.doctor-list-container',
      timeSlots: '.time-slots',
      applyBtn: '.apply-btn'
    },
    releaseSchedule: {
      time: '08:00',
      daysAhead: 7
    },
    account: {
      username: process.env.XJYY_USERNAME || 'demo_user',
      password: process.env.XJYY_PASSWORD || 'demo_pass'
    }
  },
  {
    id: 'h010',
    name: '浙江大学医学院附属第一医院',
    shortName: '浙大一院',
    baseUrl: 'https://www.zy91.com/guahao',
    loginUrl: 'https://www.zy91.com/login',
    appointmentUrl: 'https://www.zy91.com/appointment',
    captchaType: 'slider',
    refreshInterval: 180,
    priority: 2,
    maxRetries: 3,
    rateLimit: 8,
    departments: {
      cardiology: { name: '心血管内科', code: 'XXNK01', hot: true },
      neurology: { name: '神经内科', code: 'SJNK01', hot: true },
      orthopedics: { name: '骨科', code: 'GK01', hot: true },
      hepatobiliary: { name: '肝胆胰外科', code: 'GD01', hot: true },
      hematology: { name: '血液科', code: 'XY01', hot: false },
      infectious: { name: '感染病科', code: 'GR01', hot: false }
    },
    selectors: {
      usernameInput: '#username',
      passwordInput: '#password',
      slideCaptcha: '.slide-captcha',
      slideBtn: '.slide-btn',
      loginButton: '#loginBtn',
      departmentList: '.dept-list-box',
      doctorDetail: '.doctor-detail',
      scheduleGrid: '.schedule-grid',
      orderBtn: '.order-btn'
    },
    releaseSchedule: {
      time: '07:30',
      daysAhead: 7
    },
    account: {
      username: process.env.ZDY_USERNAME || 'demo_user',
      password: process.env.ZDY_PASSWORD || 'demo_pass'
    }
  },
  {
    id: 'h011',
    name: '天津医科大学总医院',
    shortName: '天津总医院',
    baseUrl: 'https://www.tjmugh.com.cn/guahao',
    loginUrl: 'https://www.tjmugh.com.cn/user/login',
    appointmentUrl: 'https://www.tjmugh.com.cn/appt',
    captchaType: 'image',
    refreshInterval: 200,
    priority: 3,
    maxRetries: 3,
    rateLimit: 10,
    departments: {
      cardiology: { name: '心血管内科', code: 'XXGNK-01', hot: true },
      neurology: { name: '神经内科', code: 'SJNK-01', hot: true },
      orthopedics: { name: '骨科', code: 'GK-01', hot: true },
      endocrinology: { name: '内分泌科', code: 'NFMK-01', hot: false },
      gastroenterology: { name: '消化科', code: 'XHK-01', hot: false },
      pulmonology: { name: '呼吸科', code: 'HXK-01', hot: false }
    },
    selectors: {
      usernameInput: '.login-input-username',
      passwordInput: '.login-input-password',
      captchaInput: '.captcha-input',
      captchaImg: '.captcha-img',
      loginButton: '.login-submit',
      deptSidebar: '.dept-sidebar',
      doctorCard: '.doctor-card-box',
      appointmentSlots: '.appointment-slots',
      confirmBtn: '.confirm-btn'
    },
    releaseSchedule: {
      time: '08:00',
      daysAhead: 7
    },
    account: {
      username: process.env.TJZY_USERNAME || 'demo_user',
      password: process.env.TJZY_PASSWORD || 'demo_pass'
    }
  },
  {
    id: 'h012',
    name: '中南大学湘雅医院',
    shortName: '湘雅医院',
    baseUrl: 'https://www.xiangya.com.cn/registration',
    loginUrl: 'https://www.xiangya.com.cn/login',
    appointmentUrl: 'https://www.xiangya.com.cn/appointments',
    captchaType: 'none',
    refreshInterval: 220,
    priority: 3,
    maxRetries: 3,
    rateLimit: 12,
    departments: {
      cardiology: { name: '心内科', code: 'XNK01', hot: true },
      neurology: { name: '神经内科', code: 'SJNK01', hot: true },
      orthopedics: { name: '骨科', code: 'GK01', hot: true },
      oncology: { name: '肿瘤科', code: 'ZLK01', hot: false },
      pediatrics: { name: '儿科', code: 'EK01', hot: false },
      dermatology: { name: '皮肤科', code: 'PFK01', hot: false }
    },
    selectors: {
      phoneInput: '#telephone',
      smsInput: '#smsCode',
      sendSms: '.send-sms',
      loginButton: '.login-btn',
      deptTree: '.dept-tree',
      doctorItem: '.doctor-item-box',
      schedulePanel: '.schedule-panel',
      apptBtn: '.appointment-button'
    },
    releaseSchedule: {
      time: '07:00',
      daysAhead: 14
    },
    account: {
      phone: process.env.XYY_PHONE || '13800138000'
    }
  }
];

const EXPERT_LEVELS = {
  1: { name: '主任医师', weight: 5 },
  2: { name: '副主任医师', weight: 4 },
  3: { name: '主治医师', weight: 3 },
  4: { name: '住院医师', weight: 2 },
  5: { name: '专家门诊', weight: 5 },
  6: { name: '特需门诊', weight: 6 }
};

const NOTIFICATION_CHANNELS = {
  email: { enabled: true, name: '邮件通知' },
  sms: { enabled: true, name: '短信通知' },
  wechat: { enabled: true, name: '企业微信' }
};

const SYSTEM_CONFIG = {
  maxBrowsers: 3,
  headless: false,
  pageTimeout: 30000,
  scriptTimeout: 10000,
  implicitWait: 5000,
  maxRetries: 3,
  retryDelay: 5000,
  dataRetentionDays: 30,
  databasePath: path.join(__dirname, '..', 'data', 'appointments.db'),
  logDir: path.join(__dirname, '..', 'logs'),
  screenshotDir: path.join(__dirname, '..', 'data', 'screenshots')
};

function getHospitalById(id) {
  return HOSPITALS.find(h => h.id === id);
}

function getHospitalsByDept(deptKey) {
  return HOSPITALS.filter(h => h.departments[deptKey]);
}

function updateHospitalConfig(hospitalId, updates) {
  const hospital = HOSPITALS.find(h => h.id === hospitalId);
  if (!hospital) {
    throw new Error(`未找到医院: ${hospitalId}`);
  }

  const validFields = [
    'name', 'shortName', 'baseUrl', 'loginUrl', 'appointmentUrl',
    'captchaType', 'refreshInterval', 'priority', 'maxRetries', 'rateLimit',
    'departments', 'selectors', 'releaseSchedule', 'account'
  ];

  for (const key of Object.keys(updates)) {
    if (validFields.includes(key)) {
      if (key === 'departments') {
        hospital.departments = { ...hospital.departments, ...updates.departments };
      } else if (key === 'selectors') {
        hospital.selectors = { ...hospital.selectors, ...updates.selectors };
      } else if (key === 'releaseSchedule') {
        hospital.releaseSchedule = { ...hospital.releaseSchedule, ...updates.releaseSchedule };
      } else if (key === 'account') {
        hospital.account = { ...hospital.account, ...updates.account };
      } else {
        hospital[key] = updates[key];
      }
    }
  }

  return hospital;
}

function updateHospitalDepartment(hospitalId, deptKey, deptUpdates) {
  const hospital = getHospitalById(hospitalId);
  if (!hospital) {
    throw new Error(`未找到医院: ${hospitalId}`);
  }

  if (!hospital.departments[deptKey]) {
    throw new Error(`医院${hospital.name}没有科室: ${deptKey}`);
  }

  hospital.departments[deptKey] = {
    ...hospital.departments[deptKey],
    ...deptUpdates
  };

  return hospital.departments[deptKey];
}

function removeHospitalDepartment(hospitalId, deptKey) {
  const hospital = getHospitalById(hospitalId);
  if (!hospital) {
    throw new Error(`未找到医院: ${hospitalId}`);
  }

  if (!hospital.departments[deptKey]) {
    throw new Error(`医院${hospital.name}没有科室: ${deptKey}`);
  }

  delete hospital.departments[deptKey];
  return true;
}

function addHospitalDepartment(hospitalId, deptKey, deptConfig) {
  const hospital = getHospitalById(hospitalId);
  if (!hospital) {
    throw new Error(`未找到医院: ${hospitalId}`);
  }

  if (hospital.departments[deptKey]) {
    throw new Error(`科室已存在: ${deptKey}`);
  }

  if (!deptConfig.name || !deptConfig.code) {
    throw new Error('科室配置缺少必填字段: name, code');
  }

  hospital.departments[deptKey] = {
    name: deptConfig.name,
    code: deptConfig.code,
    hot: deptConfig.hot || false
  };

  return hospital.departments[deptKey];
}

function updateSystemConfig(updates) {
  const validFields = [
    'maxBrowsers', 'headless', 'pageTimeout', 'scriptTimeout',
    'implicitWait', 'maxRetries', 'retryDelay', 'dataRetentionDays'
  ];

  for (const key of Object.keys(updates)) {
    if (validFields.includes(key)) {
      SYSTEM_CONFIG[key] = updates[key];
    }
  }

  return SYSTEM_CONFIG;
}

module.exports = {
  HOSPITALS,
  EXPERT_LEVELS,
  NOTIFICATION_CHANNELS,
  SYSTEM_CONFIG,
  getHospitalById,
  getHospitalsByDept,
  updateHospitalConfig,
  updateHospitalDepartment,
  removeHospitalDepartment,
  addHospitalDepartment,
  updateSystemConfig
};
