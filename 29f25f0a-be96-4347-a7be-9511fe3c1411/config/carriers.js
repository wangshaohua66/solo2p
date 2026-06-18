const path = require('path');

const carriers = {
  maersk: {
    id: 'maersk',
    name: '马士基',
    fullName: 'Maersk Line',
    baseUrl: 'https://www.maersk.com',
    loginUrl: 'https://www.maersk.com/login',
    rateUrl: 'https://www.maersk.com/freight-rates',
    scheduleUrl: 'https://www.maersk.com/schedules',
    spaceUrl: 'https://www.maersk.com/space-availability',
    surchargeUrl: 'https://www.maersk.com/surcharges',
    selectors: {
      loginForm: '#loginForm',
      usernameInput: '#username',
      passwordInput: '#password',
      submitButton: 'button[type="submit"]',
      captchaImage: '#captcha-image',
      captchaInput: '#captcha-input',
      captchaError: '.captcha-error, .error-message:contains("验证码")',
      rateTable: '.rate-table tbody tr',
      rateRow: '.rate-row',
      priceCell: '.price-cell',
      portFrom: '.port-from',
      portTo: '.port-to',
      containerType: '.container-type',
      validFrom: '.valid-from',
      validTo: '.valid-to',
      spaceStatus: '.space-status',
      spaceAvailable: '.space-available',
      scheduleRow: '.schedule-row',
      departureDate: '.departure-date',
      arrivalDate: '.arrival-date',
      vesselName: '.vessel-name',
      voyageNumber: '.voyage-number',
      surchargeItem: '.surcharge-item',
      surchargeName: '.surcharge-name',
      surchargeAmount: '.surcharge-amount',
      surchargeEffectiveDate: '.effective-date'
    },
    waitStrategy: {
      login: 'networkidle2',
      rates: 'waitForSelector',
      schedules: 'waitForSelector',
      space: 'waitForSelector'
    },
    credentials: {
      username: process.env.MAERSK_USERNAME || '',
      password: process.env.MAERSK_PASSWORD || ''
    },
    priority: 1,
    frequency: '0 */4 * * *',
    maxConcurrent: 2,
    timeout: 30000,
    retry: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    },
    routes: [
      { from: 'Shanghai', to: 'Los Angeles', type: '20GP' },
      { from: 'Shanghai', to: 'Los Angeles', type: '40GP' },
      { from: 'Shanghai', to: 'Rotterdam', type: '20GP' },
      { from: 'Shenzhen', to: 'Hamburg', type: '40HQ' },
      { from: 'Ningbo', to: 'New York', type: '20GP' }
    ]
  },

  cosco: {
    id: 'cosco',
    name: '中远海运',
    fullName: 'COSCO Shipping Lines',
    baseUrl: 'https://www.coscoshipping.com',
    loginUrl: 'https://www.coscoshipping.com/ebusiness/login',
    rateUrl: 'https://www.coscoshipping.com/ebusiness/rates',
    scheduleUrl: 'https://www.coscoshipping.com/ebusiness/schedules',
    spaceUrl: 'https://www.coscoshipping.com/ebusiness/space',
    surchargeUrl: 'https://www.coscoshipping.com/ebusiness/surcharges',
    selectors: {
      loginForm: '#login_form',
      usernameInput: '#userName',
      passwordInput: '#password',
      submitButton: '#loginBtn',
      rateTable: '.rate-list .rate-item',
      rateRow: '.rate-item',
      priceCell: '.price',
      portFrom: '.pol',
      portTo: '.pod',
      containerType: '.container-size',
      validFrom: '.start-date',
      validTo: '.end-date',
      spaceStatus: '.space-info',
      spaceAvailable: '.space-count',
      scheduleRow: '.schedule-item',
      departureDate: '.etd',
      arrivalDate: '.eta',
      vesselName: '.vessel',
      voyageNumber: '.voyage',
      surchargeItem: '.surcharge-list li',
      surchargeName: '.fee-name',
      surchargeAmount: '.fee-amount',
      surchargeEffectiveDate: '.effect-date'
    },
    waitStrategy: {
      login: 'networkidle0',
      rates: 'waitForSelector',
      schedules: 'waitForSelector',
      space: 'waitForSelector'
    },
    credentials: {
      username: process.env.COSCO_USERNAME || '',
      password: process.env.COSCO_PASSWORD || ''
    },
    priority: 1,
    frequency: '0 */4 * * *',
    maxConcurrent: 2,
    timeout: 30000,
    retry: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    },
    routes: [
      { from: 'Shanghai', to: 'Los Angeles', type: '20GP' },
      { from: 'Shanghai', to: 'Rotterdam', type: '40GP' },
      { from: 'Qingdao', to: 'Hamburg', type: '20GP' },
      { from: 'Shenzhen', to: 'Long Beach', type: '40HQ' }
    ]
  },

  cma: {
    id: 'cma',
    name: '达飞',
    fullName: 'CMA CGM',
    baseUrl: 'https://www.cma-cgm.com',
    loginUrl: 'https://www.cma-cgm.com/login',
    rateUrl: 'https://www.cma-cgm.com/eBusiness/rates',
    scheduleUrl: 'https://www.cma-cgm.com/eBusiness/schedules',
    spaceUrl: 'https://www.cma-cgm.com/eBusiness/space',
    surchargeUrl: 'https://www.cma-cgm.com/eBusiness/surcharges',
    selectors: {
      loginForm: '.login-form',
      usernameInput: '#email',
      passwordInput: '#password',
      submitButton: '#login-submit',
      rateTable: '.tariff-table tr',
      rateRow: '.tariff-row',
      priceCell: '.amount',
      portFrom: '.origin',
      portTo: '.destination',
      containerType: '.equipment',
      validFrom: '.effective-from',
      validTo: '.effective-to',
      spaceStatus: '.availability',
      spaceAvailable: '.spots',
      scheduleRow: '.schedules-row',
      departureDate: '.departure',
      arrivalDate: '.arrival',
      vesselName: '.vessel-name',
      voyageNumber: '.voyage-ref',
      surchargeItem: '.surcharge-row',
      surchargeName: '.surcharge-label',
      surchargeAmount: '.surcharge-value',
      surchargeEffectiveDate: '.surcharge-date'
    },
    waitStrategy: {
      login: 'networkidle2',
      rates: 'waitForSelector',
      schedules: 'waitForSelector',
      space: 'waitForSelector'
    },
    credentials: {
      username: process.env.CMA_USERNAME || '',
      password: process.env.CMA_PASSWORD || ''
    },
    priority: 2,
    frequency: '0 */6 * * *',
    maxConcurrent: 2,
    timeout: 30000,
    retry: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    },
    routes: [
      { from: 'Shanghai', to: 'Le Havre', type: '20GP' },
      { from: 'Shanghai', to: 'Marseille', type: '40GP' },
      { from: 'Shenzhen', to: 'Rotterdam', type: '40HQ' }
    ]
  },

  hapag: {
    id: 'hapag',
    name: '赫伯罗特',
    fullName: 'Hapag-Lloyd',
    baseUrl: 'https://www.hapag-lloyd.com',
    loginUrl: 'https://www.hapag-lloyd.com/en/login.html',
    rateUrl: 'https://www.hapag-lloyd.com/en/online-business/rates.html',
    scheduleUrl: 'https://www.hapag-lloyd.com/en/online-business/schedules.html',
    spaceUrl: 'https://www.hapag-lloyd.com/en/online-business/space.html',
    surchargeUrl: 'https://www.hapag-lloyd.com/en/online-business/surcharges.html',
    selectors: {
      loginForm: '#loginForm',
      usernameInput: '#userid',
      passwordInput: '#password',
      submitButton: '#loginBtn',
      rateTable: '.rateoverview tbody tr',
      rateRow: '.rate-row',
      priceCell: '.freight-rate',
      portFrom: '.place-of-receipt',
      portTo: '.place-of-delivery',
      containerType: '.equipment-size',
      validFrom: '.valid-from-date',
      validTo: '.valid-to-date',
      spaceStatus: '.cargo-space-status',
      spaceAvailable: '.available-space',
      scheduleRow: '.schedule-detail tr',
      departureDate: '.departure-date',
      arrivalDate: '.arrival-date',
      vesselName: '.vessel',
      voyageNumber: '.voyage-no',
      surchargeItem: '.surcharge-item',
      surchargeName: '.surcharge-type',
      surchargeAmount: '.surcharge-rate',
      surchargeEffectiveDate: '.effective-from'
    },
    waitStrategy: {
      login: 'networkidle0',
      rates: 'waitForSelector',
      schedules: 'waitForSelector',
      space: 'waitForSelector'
    },
    credentials: {
      username: process.env.HAPAG_USERNAME || '',
      password: process.env.HAPAG_PASSWORD || ''
    },
    priority: 2,
    frequency: '0 */6 * * *',
    maxConcurrent: 2,
    timeout: 30000,
    retry: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    },
    routes: [
      { from: 'Shanghai', to: 'Hamburg', type: '20GP' },
      { from: 'Ningbo', to: 'Rotterdam', type: '40GP' }
    ]
  },

  msc: {
    id: 'msc',
    name: '地中海航运',
    fullName: 'Mediterranean Shipping Company',
    baseUrl: 'https://www.msc.com',
    loginUrl: 'https://www.msc.com/login',
    rateUrl: 'https://www.msc.com/rates',
    scheduleUrl: 'https://www.msc.com/schedules',
    spaceUrl: 'https://www.msc.com/space',
    surchargeUrl: 'https://www.msc.com/surcharges',
    selectors: {
      loginForm: '.signin-form',
      usernameInput: '#username',
      passwordInput: '#password',
      submitButton: '#signInBtn',
      rateTable: '.rates-table tbody tr',
      rateRow: '.rate-row',
      priceCell: '.rate-amount',
      portFrom: '.origin-port',
      portTo: '.destination-port',
      containerType: '.container-type',
      validFrom: '.validity-start',
      validTo: '.validity-end',
      spaceStatus: '.space-indicator',
      spaceAvailable: '.space-quantity',
      scheduleRow: '.schedule-table tr',
      departureDate: '.etd-date',
      arrivalDate: '.eta-date',
      vesselName: '.vessel',
      voyageNumber: '.voyage',
      surchargeItem: '.surcharge-list .item',
      surchargeName: '.fee-name',
      surchargeAmount: '.fee-value',
      surchargeEffectiveDate: '.date-effective'
    },
    waitStrategy: {
      login: 'networkidle2',
      rates: 'waitForSelector',
      schedules: 'waitForSelector',
      space: 'waitForSelector'
    },
    credentials: {
      username: process.env.MSC_USERNAME || '',
      password: process.env.MSC_PASSWORD || ''
    },
    priority: 2,
    frequency: '0 */6 * * *',
    maxConcurrent: 2,
    timeout: 30000,
    retry: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    },
    routes: [
      { from: 'Shanghai', to: 'Genoa', type: '20GP' },
      { from: 'Shenzhen', to: 'Barcelona', type: '40GP' }
    ]
  },

  freightos: {
    id: 'freightos',
    name: 'Freightos',
    fullName: 'Freightos Marketplace',
    baseUrl: 'https://www.freightos.com',
    loginUrl: 'https://www.freightos.com/login',
    rateUrl: 'https://www.freightos.com/search',
    scheduleUrl: null,
    spaceUrl: null,
    surchargeUrl: null,
    selectors: {
      loginForm: '.login-form',
      usernameInput: '#email',
      passwordInput: '#password',
      submitButton: '.login-button',
      rateTable: '.search-results .result-card',
      rateRow: '.result-card',
      priceCell: '.price-value',
      portFrom: '.origin-location',
      portTo: '.destination-location',
      containerType: '.container-option',
      validFrom: null,
      validTo: null,
      spaceStatus: null,
      spaceAvailable: null,
      scheduleRow: null,
      departureDate: null,
      arrivalDate: null,
      vesselName: null,
      voyageNumber: null,
      surchargeItem: null,
      surchargeName: null,
      surchargeAmount: null,
      surchargeEffectiveDate: null
    },
    waitStrategy: {
      login: 'networkidle0',
      rates: 'waitForSelector',
      schedules: null,
      space: null
    },
    credentials: {
      username: process.env.FREIGHTOS_USERNAME || '',
      password: process.env.FREIGHTOS_PASSWORD || ''
    },
    priority: 3,
    frequency: '0 */8 * * *',
    maxConcurrent: 1,
    timeout: 30000,
    retry: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    },
    routes: [
      { from: 'Shanghai', to: 'Los Angeles', type: '20GP' },
      { from: 'Shanghai', to: 'Rotterdam', type: '40GP' }
    ]
  },

  xeneta: {
    id: 'xeneta',
    name: 'Xeneta',
    fullName: 'Xeneta Rate Benchmarking',
    baseUrl: 'https://www.xeneta.com',
    loginUrl: 'https://platform.xeneta.com/login',
    rateUrl: 'https://platform.xeneta.com/rates',
    scheduleUrl: null,
    spaceUrl: null,
    surchargeUrl: null,
    selectors: {
      loginForm: '.auth-form',
      usernameInput: '#email',
      passwordInput: '#password',
      submitButton: '.btn-primary',
      rateTable: '.rate-table .rate-row',
      rateRow: '.rate-row',
      priceCell: '.rate-value',
      portFrom: '.origin',
      portTo: '.destination',
      containerType: '.container-size',
      validFrom: '.period-start',
      validTo: '.period-end',
      spaceStatus: null,
      spaceAvailable: null,
      scheduleRow: null,
      departureDate: null,
      arrivalDate: null,
      vesselName: null,
      voyageNumber: null,
      surchargeItem: null,
      surchargeName: null,
      surchargeAmount: null,
      surchargeEffectiveDate: null
    },
    waitStrategy: {
      login: 'networkidle0',
      rates: 'waitForSelector',
      schedules: null,
      space: null
    },
    credentials: {
      username: process.env.XENETA_USERNAME || '',
      password: process.env.XENETA_PASSWORD || ''
    },
    priority: 3,
    frequency: '0 */12 * * *',
    maxConcurrent: 1,
    timeout: 30000,
    retry: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    },
    routes: [
      { from: 'Shanghai', to: 'Los Angeles', type: '20GP' },
      { from: 'Shanghai', to: 'Hamburg', type: '40GP' }
    ]
  }
};

const alertConfig = {
  priceIncreaseThreshold: 0.10,
  spaceAvailabilityThreshold: 50,
  surgePriceMultiplier: 1.5,
  checkPeriodDays: 30,
  defaultThresholds: {
    '20GP': { priceIncrease: 0.10, spaceMin: 50 },
    '40GP': { priceIncrease: 0.10, spaceMin: 30 },
    '40HQ': { priceIncrease: 0.10, spaceMin: 30 }
  }
};

const dbConfig = {
  path: path.join(__dirname, '..', 'data', 'freight.db'),
  logRetentionDays: 90,
  batchSize: 500,
  maxWriteLatencyMs: 200
};

const schedulerConfig = {
  maxPuppeteerInstances: 3,
  maxConcurrentPerSite: 2,
  defaultTimeout: 30000,
  memoryLimitMB: 512,
  expectedDurationMinutes: 8
};

module.exports = {
  carriers,
  alertConfig,
  dbConfig,
  schedulerConfig,
  getCarrierList: () => Object.values(carriers),
  getCarrierById: (id) => carriers[id] || null,
  getEnabledCarriers: () => Object.values(carriers).filter(c => c.credentials.username)
};
