const CrawlerBase = require('./base');
const { getCaptchaService } = require('../service/captcha');
const { createLogger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const url = require('url');
const querystring = require('querystring');

const logger = createLogger('HospitalCrawler');

const BOOKING_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PENDING_SMS: 'pending_sms',
  PENDING_CAPTCHA: 'pending_captcha',
  DUPLICATE: 'duplicate',
  NO_AVAILABLE: 'no_available',
  SESSION_EXPIRED: 'session_expired',
  VERIFICATION_FAILED: 'verification_failed'
};

class BookingResult {
  constructor(options = {}) {
    this.status = options.status || BOOKING_STATUS.PENDING;
    this.bookingId = options.bookingId || null;
    this.orderNo = options.orderNo || null;
    this.message = options.message || '';
    this.hospitalId = options.hospitalId || null;
    this.hospitalName = options.hospitalName || null;
    this.department = options.department || null;
    this.departmentName = options.departmentName || null;
    this.doctorName = options.doctorName || null;
    this.doctorTitle = options.doctorTitle || null;
    this.appointmentDate = options.appointmentDate || null;
    this.timeSlot = options.timeSlot || null;
    this.visitTime = options.visitTime || null;
    this.patientName = options.patientName || null;
    this.patientId = options.patientId || null;
    this.fee = options.fee || null;
    this.location = options.location || null;
    this.confirmationRequired = options.confirmationRequired || false;
    this.verificationSteps = options.verificationSteps || [];
    this.errorCode = options.errorCode || null;
    this.errorDetails = options.errorDetails || null;
    this.rawResponse = options.rawResponse || null;
    this.timestamp = options.timestamp || new Date().toISOString();
  }

  isSuccess() {
    return this.status === BOOKING_STATUS.SUCCESS || this.status === BOOKING_STATUS.CONFIRMED;
  }

  needsAction() {
    return this.status === BOOKING_STATUS.PENDING_SMS ||
           this.status === BOOKING_STATUS.PENDING_CAPTCHA ||
           this.status === BOOKING_STATUS.PENDING;
  }

  toJSON() {
    return {
      status: this.status,
      bookingId: this.bookingId,
      orderNo: this.orderNo,
      message: this.message,
      hospital: {
        id: this.hospitalId,
        name: this.hospitalName
      },
      department: {
        key: this.department,
        name: this.departmentName
      },
      doctor: {
        name: this.doctorName,
        title: this.doctorTitle
      },
      appointment: {
        date: this.appointmentDate,
        timeSlot: this.timeSlot,
        visitTime: this.visitTime
      },
      patient: {
        name: this.patientName,
        id: this.patientId
      },
      fee: this.fee,
      location: this.location,
      confirmationRequired: this.confirmationRequired,
      verificationSteps: this.verificationSteps,
      error: this.errorCode ? {
        code: this.errorCode,
        details: this.errorDetails
      } : null,
      timestamp: this.timestamp
    };
  }
}

class HospitalCrawler extends CrawlerBase {
  constructor(hospitalConfig, options = {}) {
    super(options);
    this.hospitalConfig = hospitalConfig;
    this.hospitalId = hospitalConfig.id;
    this.hospitalName = hospitalConfig.name;
    this.selectors = hospitalConfig.selectors;
    this.captchaType = hospitalConfig.captchaType;
    this.maxRetries = hospitalConfig.maxRetries || 3;
  }

  async initialize() {
    await this.launch();
    this.captchaService = await getCaptchaService();
  }

  async login() {
    logger.info(`[${this.hospitalName}] 开始登录...`);

    let attempts = 0;
    while (attempts < this.maxRetries) {
      attempts++;
      try {
        await this.navigateTo(this.hospitalConfig.loginUrl);
        await this.waitForPageLoad();

        const result = await this._performLogin();

        if (result.success) {
          this.isLoggedIn = true;
          logger.info(`[${this.hospitalName}] 登录成功`);
          return { success: true, attempts };
        }

        if (attempts < this.maxRetries) {
          logger.warn(`[${this.hospitalName}] 登录失败，第 ${attempts} 次重试...`);
          await this.clearCookies();
          await this.sleep(2000);
        }
      } catch (err) {
        logger.error(`[${this.hospitalName}] 登录异常: ${err.message}`);
        if (attempts >= this.maxRetries) {
          throw err;
        }
        await this.sleep(2000);
      }
    }

    logger.error(`[${this.hospitalName}] 登录失败，已达最大重试次数`);
    return { success: false, attempts };
  }

  async _performLogin() {
    const account = this.hospitalConfig.account;
    const sel = this.selectors;

    if (account.username) {
      const usernameInput = sel.usernameInput || '#username';
      await this.type(usernameInput, account.username);
    }

    if (account.phone) {
      const phoneInput = sel.phoneInput || '#phone';
      await this.type(phoneInput, account.phone);
    }

    if (account.password) {
      const passwordInput = sel.passwordInput || '#password';
      await this.type(passwordInput, account.password);
    }

    if (this.captchaType === 'image') {
      const captchaResult = await this._handleImageCaptcha();
      if (!captchaResult.success) {
        logger.warn(`[${this.hospitalName}] 图形验证码识别失败`);
        return { success: false, reason: 'captcha_failed' };
      }
    } else if (this.captchaType === 'slider') {
      const sliderResult = await this._handleSliderCaptcha();
      if (!sliderResult.success) {
        logger.warn(`[${this.hospitalName}] 滑块验证失败`);
        return { success: false, reason: 'slider_failed' };
      }
    }

    const loginBtn = sel.loginButton || '#login-btn';
    await this.click(loginBtn);
    await this.sleep(3000);

    const isLoggedIn = await this._checkLoginStatus();
    return { success: isLoggedIn };
  }

  async _handleImageCaptcha() {
    const sel = this.selectors;
    const captchaImg = sel.captchaImage || '#captcha-img';
    const captchaInput = sel.captchaInput || '#captcha';

    const imgElement = await this.waitForVisible(captchaImg, 5000);
    if (!imgElement) {
      return { success: false, reason: 'captcha_not_found' };
    }

    await this.sleep(500);

    const screenshotPath = await this.takeScreenshot(
      `captcha-${this.hospitalId}-${Date.now()}.png`
    );

    if (screenshotPath) {
      const result = await this.captchaService.recognizeImage(screenshotPath);
      if (result.success && result.text) {
        await this.type(captchaInput, result.text);
        return { success: true, text: result.text };
      }
    }

    return { success: false };
  }

  async _handleSliderCaptcha() {
    const sel = this.selectors;
    const sliderContainer = sel.sliderContainer || sel.captchaSlider || '.slider-container';

    const sliderEl = await this.waitForVisible(sliderContainer, 5000);
    if (!sliderEl) {
      return { success: false, reason: 'slider_not_found' };
    }

    const result = await this.captchaService.solveSlider(this, {
      sliderSelector: sliderContainer,
      trackSelector: sel.sliderTrack || '.slider-track',
      buttonSelector: sel.sliderButton || sel.sliderBtn || '.slider-btn'
    });

    return result;
  }

  async _checkLoginStatus() {
    try {
      const currentUrl = await this.getCurrentUrl();
      if (currentUrl && !currentUrl.includes('login')) {
        return true;
      }

      const userEl = await this.$('.user-info, .avatar, .username');
      if (userEl && await userEl.isExisting()) {
        return true;
      }

      return false;
    } catch (err) {
      return false;
    }
  }

  async fetchAppointments(departmentKey) {
    logger.info(`[${this.hospitalName}] 抓取科室: ${departmentKey}`);

    if (!this.isLoggedIn) {
      const loginResult = await this.login();
      if (!loginResult.success) {
        throw new Error('登录失败，无法抓取号源');
      }
    }

    const startTime = Date.now();
    let appointments = [];

    try {
      await this._navigateToDepartment(departmentKey);
      await this.sleep(2000);

      appointments = await this._parseAppointments(departmentKey);

      const duration = Date.now() - startTime;
      logger.info(`[${this.hospitalName}] ${departmentKey} 抓取完成，共 ${appointments.length} 条号源 (${duration}ms)`);

      return {
        success: true,
        appointments,
        duration,
        hospitalId: this.hospitalId,
        hospitalName: this.hospitalName,
        department: departmentKey
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error(`[${this.hospitalName}] 抓取号源失败: ${err.message}`);
      await this.takeScreenshot(`error-${this.hospitalId}-${Date.now()}.png`);

      if (err.message.includes('登录') || err.message.includes('session')) {
        this.isLoggedIn = false;
      }

      return {
        success: false,
        appointments: [],
        duration,
        error: err.message,
        hospitalId: this.hospitalId,
        hospitalName: this.hospitalName,
        department: departmentKey
      };
    }
  }

  async _navigateToDepartment(departmentKey) {
    const sel = this.selectors;
    const deptConfig = this.hospitalConfig.departments[departmentKey];

    if (!deptConfig) {
      throw new Error(`未找到科室配置: ${departmentKey}`);
    }

    const apptUrl = this.hospitalConfig.appointmentUrl
      + `?deptCode=${deptConfig.code}&deptName=${encodeURIComponent(deptConfig.name)}`;

    await this.navigateTo(apptUrl);
    await this.waitForPageLoad();

    const deptListSel = sel.departmentList || sel.deptNav || sel.deptTree || '.dept-list';
    if (await this.hasElement(deptListSel)) {
      const deptItems = await this.$$(deptListSel + ' li, ' + deptListSel + ' a');
      for (const item of deptItems) {
        try {
          const text = await item.getText();
          if (text && text.includes(deptConfig.name)) {
            await item.click();
            await this.sleep(1500);
            break;
          }
        } catch (e) {}
      }
    }
  }

  async _parseAppointments(departmentKey) {
    const appointments = [];
    const sel = this.selectors;
    const deptConfig = this.hospitalConfig.departments[departmentKey];

    const doctorCardSel = sel.doctorCard || sel.doctorItem || sel.doctorDetail || '.doctor-card';
    const doctorCards = await this.$$(doctorCardSel);

    if (doctorCards.length === 0) {
      logger.debug(`[${this.hospitalName}] 未找到医生卡片，尝试其他选择器`);
      return this._parseAppointmentsFallback(departmentKey, deptConfig);
    }

    for (const card of doctorCards) {
      try {
        const doctorAppts = await this._parseDoctorCard(card, departmentKey, deptConfig);
        appointments.push(...doctorAppts);
      } catch (err) {
        logger.debug(`解析医生卡片失败: ${err.message}`);
      }
    }

    return appointments;
  }

  async _parseDoctorCard(card, departmentKey, deptConfig) {
    const appointments = [];
    const sel = this.selectors;

    let doctorName = '';
    let expertLevel = null;
    let doctorId = null;

    try {
      doctorName = await card.$eval('.doctor-name, .name, h3, h4', el => el.textContent.trim());
    } catch (e) {}

    try {
      expertLevel = await card.$eval('.expert-level, .level, .title', el => {
        const text = el.textContent.trim();
        if (text.includes('主任医师') || text.includes('专家')) return 5;
        if (text.includes('副主任医师')) return 4;
        if (text.includes('主治医师')) return 3;
        if (text.includes('住院医师')) return 2;
        return null;
      });
    } catch (e) {}

    const slotSel = sel.appointmentSlot || sel.timeSlot || sel.scheduleItem || '.appt-slot';
    const slots = await card.$$(slotSel);

    for (const slot of slots) {
      try {
        let date = '';
        let timeSlot = '';
        let available = 0;
        let total = 0;
        let fee = null;

        try {
          date = await slot.$eval('.date, .appt-date, .day', el => el.textContent.trim());
        } catch (e) {}

        try {
          timeSlot = await slot.$eval('.time, .time-slot, .period', el => el.textContent.trim());
        } catch (e) {}

        try {
          available = await slot.$eval('.available, .remain, .count', el => {
            const text = el.textContent.trim();
            const num = parseInt(text.replace(/[^0-9]/g, ''));
            return isNaN(num) ? 0 : num;
          });
        } catch (e) {}

        try {
          const canBook = await slot.isDisplayed();
          if (canBook && available === 0) {
            const hasButton = await slot.$('.book-btn, .reserve-btn, .appt-btn');
            if (hasButton) {
              available = 1;
            }
          }
        } catch (e) {}

        try {
          fee = await slot.$eval('.fee, .price', el => {
            const text = el.textContent.replace(/[^0-9.]/g, '');
            const num = parseFloat(text);
            return isNaN(num) ? null : num;
          });
        } catch (e) {}

        let formattedDate = date;
        if (date && !date.match(/\d{4}-\d{2}-\d{2}/)) {
          const today = dayjs();
          const dateMatch = date.match(/(\d{1,2})月(\d{1,2})日/);
          if (dateMatch) {
            const month = parseInt(dateMatch[1]);
            const day = parseInt(dateMatch[2]);
            let year = today.year();
            if (month < today.month() + 1) {
              year++;
            }
            formattedDate = dayjs(`${year}-${month}-${day}`).format('YYYY-MM-DD');
          }
        }

        const apptId = `${this.hospitalId}-${departmentKey}-${doctorName || 'unknown'}-${formattedDate}-${timeSlot || 'full'}`;

        appointments.push({
          id: apptId,
          hospitalId: this.hospitalId,
          hospitalName: this.hospitalName,
          department: departmentKey,
          departmentName: deptConfig.name,
          doctorId: doctorId,
          doctorName: doctorName,
          expertLevel: expertLevel,
          appointmentDate: formattedDate,
          timeSlot: timeSlot || '全天',
          availableCount: available,
          totalCount: total,
          fee: fee,
          sourceUrl: await this.getCurrentUrl(),
          crawlTime: new Date().toISOString()
        });
      } catch (err) {
        logger.debug(`解析号源槽失败: ${err.message}`);
      }
    }

    return appointments;
  }

  async _parseAppointmentsFallback(departmentKey, deptConfig) {
    const appointments = [];
    const sel = this.selectors;

    const scheduleSel = sel.scheduleTable || sel.scheduleList || sel.schedulePanel || '.schedule-table';
    const rows = await this.$$(scheduleSel + ' tr, ' + scheduleSel + ' .row');

    for (const row of rows) {
      try {
        let doctorName = '';
        let date = '';
        let timeSlot = '';
        let available = 0;

        const cells = await row.$$('td, .cell');
        if (cells.length >= 3) {
          doctorName = await cells[0].getText();
          date = await cells[1].getText();
          timeSlot = await cells[2].getText();

          if (cells.length > 3) {
            const text = await cells[3].getText();
            const num = parseInt(text.replace(/[^0-9]/g, ''));
            available = isNaN(num) ? 0 : num;
          }
        }

        if (doctorName) {
          appointments.push({
            id: `${this.hospitalId}-${departmentKey}-${doctorName}-${date}-${timeSlot}`,
            hospitalId: this.hospitalId,
            hospitalName: this.hospitalName,
            department: departmentKey,
            departmentName: deptConfig.name,
            doctorId: null,
            doctorName: doctorName.trim(),
            expertLevel: null,
            appointmentDate: date,
            timeSlot: timeSlot,
            availableCount: available,
            totalCount: 0,
            fee: null,
            sourceUrl: await this.getCurrentUrl(),
            crawlTime: new Date().toISOString()
          });
        }
      } catch (e) {}
    }

    return appointments;
  }

  async bookAppointment(appointmentId, patientInfo, options = {}) {
    logger.info(`[${this.hospitalName}] 尝试预约: ${appointmentId}`);

    const resultBase = {
      hospitalId: this.hospitalId,
      hospitalName: this.hospitalName,
      patientName: patientInfo?.name,
      patientId: patientInfo?.id,
      verificationSteps: options.verificationSteps ? [...options.verificationSteps] : []
    };

    if (!this.isLoggedIn) {
      const loginResult = await this.login();
      resultBase.verificationSteps.push({
        step: 'login',
        success: loginResult.success,
        timestamp: Date.now()
      });

      if (!loginResult.success) {
        return new BookingResult({
          ...resultBase,
          status: BOOKING_STATUS.SESSION_EXPIRED,
          message: '登录失败，无法继续预约',
          errorCode: 'LOGIN_FAILED'
        });
      }
    }

    try {
      const sel = this.selectors;
      const bookBtnSel = sel.bookButton || sel.reserveBtn || sel.regBtn || sel.apptButton || '.book-btn';
      const confirmBtnSel = sel.confirmButton || '.confirm-btn, .sure-btn, .btn-confirm, .btn-primary';
      const patientFormSel = sel.patientForm || '.patient-form, #patient-info, [id*="patient"]';

      const apptSlot = await this.$(`[data-appt-id="${appointmentId}"], .appt-slot[data-id="${appointmentId}"]`);
      if (apptSlot) {
        try {
          await apptSlot.click();
          await this.sleep(1500);
          resultBase.verificationSteps.push({ step: 'select_slot', success: true, timestamp: Date.now() });
        } catch (clickErr) {
          logger.debug(`点击号源槽失败，尝试其他方式: ${clickErr.message}`);
        }
      }

      const bookBtn = await this.waitForClickable(bookBtnSel, 8000);
      if (!bookBtn) {
        const noAvailable = await this.hasElement('.no-available, .no-slot, .full, .no-number');
        if (noAvailable) {
          return new BookingResult({
            ...resultBase,
            status: BOOKING_STATUS.NO_AVAILABLE,
            message: '该号源已被预约或暂无号源',
            errorCode: 'NO_AVAILABLE'
          });
        }
        return new BookingResult({
          ...resultBase,
          status: BOOKING_STATUS.FAILED,
          message: '未找到预约按钮或页面加载超时',
          errorCode: 'NO_BOOK_BUTTON'
        });
      }

      try {
        await bookBtn.click();
        await this.sleep(2000);
        resultBase.verificationSteps.push({ step: 'click_book', success: true, timestamp: Date.now() });
      } catch (clickErr) {
        return new BookingResult({
          ...resultBase,
          status: BOOKING_STATUS.FAILED,
          message: '点击预约按钮失败',
          errorCode: 'CLICK_FAILED',
          errorDetails: clickErr.message
        });
      }

      const verifyResult = await this._checkAndHandleSecondaryVerifications({
        existingSteps: resultBase.verificationSteps,
        smsCode: options.smsCode
      });

      resultBase.verificationSteps = verifyResult.verificationSteps;

      if (!verifyResult.allPassed) {
        if (verifyResult.bookingStatus === BOOKING_STATUS.PENDING_SMS) {
          return new BookingResult({
            ...resultBase,
            status: BOOKING_STATUS.PENDING_SMS,
            message: '需要短信验证码确认，请提供验证码后重试',
            confirmationRequired: true,
            errorCode: 'SMS_REQUIRED',
            errorDetails: {
              inputSelector: verifyResult.result.inputSelector,
              sendBtnSelector: verifyResult.result.sendBtnSelector
            }
          });
        }

        if (verifyResult.bookingStatus === BOOKING_STATUS.PENDING_CAPTCHA) {
          return new BookingResult({
            ...resultBase,
            status: BOOKING_STATUS.PENDING_CAPTCHA,
            message: '需要图形验证码确认',
            confirmationRequired: true,
            errorCode: 'CAPTCHA_REQUIRED'
          });
        }

        return new BookingResult({
          ...resultBase,
          status: verifyResult.bookingStatus || BOOKING_STATUS.VERIFICATION_FAILED,
          message: `验证失败: ${verifyResult.result?.reason || verifyResult.result?.error || '未知原因'}`,
          errorCode: 'VERIFICATION_FAILED',
          errorDetails: verifyResult.result
        });
      }

      const hasPatientForm = await this.hasElement(patientFormSel);
      const confirmBtn = await this.$(confirmBtnSel);

      if (hasPatientForm && patientInfo) {
        await this.fillPatientInfo(patientInfo);
        resultBase.verificationSteps.push({ step: 'fill_patient', success: true, timestamp: Date.now() });
      }

      if (confirmBtn && await confirmBtn.isDisplayed()) {
        const verifyBeforeConfirm = await this._checkAndHandleSecondaryVerifications({
          existingSteps: resultBase.verificationSteps,
          smsCode: options.smsCode
        });

        resultBase.verificationSteps = verifyBeforeConfirm.verificationSteps;

        if (!verifyBeforeConfirm.allPassed) {
          if (verifyBeforeConfirm.bookingStatus === BOOKING_STATUS.PENDING_SMS) {
            return new BookingResult({
              ...resultBase,
              status: BOOKING_STATUS.PENDING_SMS,
              message: '需要短信验证码确认，请提供验证码后重试',
              confirmationRequired: true,
              errorCode: 'SMS_REQUIRED'
            });
          }
          return new BookingResult({
            ...resultBase,
            status: verifyBeforeConfirm.bookingStatus || BOOKING_STATUS.VERIFICATION_FAILED,
            message: '确认前验证失败',
            errorCode: 'VERIFICATION_FAILED'
          });
        }

        try {
          await confirmBtn.click();
          await this.sleep(3000);
          resultBase.verificationSteps.push({ step: 'click_confirm', success: true, timestamp: Date.now() });
        } catch (confirmErr) {
          return new BookingResult({
            ...resultBase,
            status: BOOKING_STATUS.FAILED,
            message: '点击确认按钮失败',
            errorCode: 'CONFIRM_FAILED',
            errorDetails: confirmErr.message
          });
        }
      }

      const postConfirmVerify = await this._checkAndHandleSecondaryVerifications({
        existingSteps: resultBase.verificationSteps,
        smsCode: options.smsCode
      });

      resultBase.verificationSteps = postConfirmVerify.verificationSteps;

      if (!postConfirmVerify.allPassed) {
        if (postConfirmVerify.bookingStatus === BOOKING_STATUS.PENDING_SMS) {
          return new BookingResult({
            ...resultBase,
            status: BOOKING_STATUS.PENDING_SMS,
            message: '需要短信验证码最终确认',
            confirmationRequired: true,
            errorCode: 'SMS_REQUIRED_FINAL'
          });
        }
        if (postConfirmVerify.bookingStatus !== BOOKING_STATUS.VERIFICATION_FAILED) {
          return new BookingResult({
            ...resultBase,
            status: postConfirmVerify.bookingStatus,
            message: '需要额外验证步骤',
            confirmationRequired: true,
            errorCode: 'EXTRA_VERIFICATION_REQUIRED'
          });
        }
      }

      return await this._extractBookingResult(appointmentId, patientInfo, resultBase, options);

    } catch (err) {
      logger.error(`[${this.hospitalName}] 预约失败: ${err.message}`);

      if (err.message.includes('登录') || err.message.includes('session') || err.message.includes('过期')) {
        this.isLoggedIn = false;
        return new BookingResult({
          ...resultBase,
          status: BOOKING_STATUS.SESSION_EXPIRED,
          message: '会话已过期，请重新登录',
          errorCode: 'SESSION_EXPIRED',
          errorDetails: err.message
        });
      }

      return new BookingResult({
        ...resultBase,
        status: BOOKING_STATUS.FAILED,
        message: `预约失败: ${err.message}`,
        errorCode: 'EXCEPTION',
        errorDetails: err.message
      });
    }
  }

  async _extractBookingResult(appointmentId, patientInfo, resultBase, options) {
    const sel = this.selectors;

    const successSelectors = [
      '.success, .alert-success, .toast-success',
      '[class*="success"][class*="alert"]',
      '.order-success, .booking-success, .appointment-success',
      '#success, .booking-result.success'
    ];

    const errorSelectors = [
      '.error, .alert-error, .toast-error, .alert-danger',
      '[class*="error"][class*="alert"]',
      '.booking-failed, .order-failed'
    ];

    const duplicateTexts = ['已预约', '重复', '已挂号', '已存在', 'duplicate', 'already'];

    let successText = null;
    for (const s of successSelectors) {
      const el = await this.$(s);
      if (el && await el.isDisplayed()) {
        successText = await el.getText();
        break;
      }
    }

    let errorText = null;
    for (const s of errorSelectors) {
      const el = await this.$(s);
      if (el && await el.isDisplayed()) {
        errorText = await el.getText();
        break;
      }
    }

    if (errorText) {
      const isDuplicate = duplicateTexts.some(t =>
        errorText.toLowerCase().includes(t.toLowerCase())
      );

      if (isDuplicate) {
        return new BookingResult({
          ...resultBase,
          status: BOOKING_STATUS.DUPLICATE,
          message: errorText || '您已预约过该号源，请勿重复预约',
          errorCode: 'DUPLICATE_BOOKING',
          appointmentId
        });
      }

      return new BookingResult({
        ...resultBase,
        status: BOOKING_STATUS.FAILED,
        message: errorText,
        errorCode: 'FAILED_MESSAGE',
        errorDetails: errorText,
        appointmentId
      });
    }

    let orderNo = null;
    let visitTime = null;
    let location = null;
    let doctorName = null;
    let departmentName = null;
    let appointmentDate = null;
    let timeSlot = null;
    let fee = null;

    try {
      const pageText = await this.getText('body');

      const orderNoMatch = pageText?.match(/(订单号|预约号|挂号单号|流水号)[:：\s]*([A-Za-z0-9_-]{8,})/i);
      if (orderNoMatch) {
        orderNo = orderNoMatch[2];
      }

      const visitTimeMatch = pageText?.match(/(就诊时间|时间)[:：\s]*([^\n\r]+?)(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}[^\n\r]*)/);
      if (visitTimeMatch) {
        visitTime = visitTimeMatch[3].trim();
      }

      const locationMatch = pageText?.match(/(就诊地点|地点|诊室)[:：\s]*([^\n\r]+)/);
      if (locationMatch) {
        location = locationMatch[2].trim();
      }

      const feeMatch = pageText?.match(/(费用|金额|挂号费)[:：\s]*[￥¥]?(\d+\.?\d*)/);
      if (feeMatch) {
        fee = parseFloat(feeMatch[2]);
      }

      if (options.parsedLink) {
        doctorName = doctorName || options.parsedLink.doctorName;
        departmentName = departmentName ||
          (options.parsedLink.department &&
            this.hospitalConfig.departments[options.parsedLink.department]?.name);
        appointmentDate = appointmentDate || options.parsedLink.appointmentDate;
        timeSlot = timeSlot || options.parsedLink.timeSlot;
      }

      const currentUrl = await this.getCurrentUrl();
      if (currentUrl?.includes('success') || currentUrl?.includes('result')) {
        successText = successText || '预约成功';
      }

    } catch (extractErr) {
      logger.debug(`提取预约结果信息失败: ${extractErr.message}`);
    }

    const finalStatus = successText ? BOOKING_STATUS.SUCCESS : BOOKING_STATUS.PENDING;
    const bookingId = uuidv4();

    return new BookingResult({
      ...resultBase,
      status: finalStatus,
      bookingId: bookingId,
      orderNo: orderNo,
      message: successText || (finalStatus === BOOKING_STATUS.PENDING
        ? '预约请求已提交，请确认是否成功'
        : '预约成功'),
      department: options.parsedLink?.department,
      departmentName: departmentName,
      doctorName: doctorName,
      appointmentDate: appointmentDate,
      timeSlot: timeSlot,
      visitTime: visitTime,
      fee: fee,
      location: location,
      appointmentId: appointmentId,
      confirmationRequired: finalStatus === BOOKING_STATUS.PENDING,
      rawResponse: { successText, errorText, orderNo, visitTime, location }
    });
  }

  async fillPatientInfo(patientInfo) {
    const fields = {
      'input[name="patientName"], #patientName, .patient-name': patientInfo.name,
      'input[name="patientIdCard"], #idCard, .id-card': patientInfo.idCard,
      'input[name="patientPhone"], #phone, .patient-phone': patientInfo.phone
    };

    for (const [selector, value] of Object.entries(fields)) {
      if (value) {
        try {
          const el = await this.$(selector);
          if (el && await el.isDisplayed()) {
            await el.clearValue();
            await el.setValue(value);
          }
        } catch (e) {}
      }
    }
  }

  async refreshSession() {
    logger.info(`[${this.hospitalName}] 刷新会话...`);
    this.isLoggedIn = false;
    await this.clearCookies();
    await this.sleep(1000);
    return await this.login();
  }

  parseBookingLink(bookingLink) {
    logger.info(`[${this.hospitalName}] 解析预约链接: ${bookingLink}`);

    const result = {
      valid: false,
      hospitalId: null,
      department: null,
      appointmentId: null,
      doctorName: null,
      appointmentDate: null,
      timeSlot: null,
      params: {},
      rawLink: bookingLink
    };

    try {
      const parsed = url.parse(bookingLink);
      const params = querystring.parse(parsed.query || '');
      result.params = params;

      if (params.hospitalId && params.hospitalId !== this.hospitalId) {
        logger.warn(`链接医院ID ${params.hospitalId} 与当前爬虫 ${this.hospitalId} 不匹配`);
        result.hospitalId = params.hospitalId;
        result.valid = false;
        return result;
      }

      result.hospitalId = params.hospitalId || this.hospitalId;
      result.department = params.deptCode || params.department || params.dept;
      result.appointmentId = params.apptId || params.appointmentId || params.scheduleId || params.id;
      result.doctorName = params.doctor || params.doctorName;
      result.appointmentDate = params.date || params.apptDate;
      result.timeSlot = params.time || params.timeSlot;

      if (!result.appointmentId && parsed.hash) {
        const hashParams = querystring.parse(parsed.hash.replace('#', ''));
        result.appointmentId = hashParams.apptId || hashParams.id || null;
      }

      const pathMatch = parsed.pathname?.match(/\/(appointment|booking|register)\/([a-zA-Z0-9_-]+)/);
      if (pathMatch && !result.appointmentId) {
        result.appointmentId = pathMatch[2];
      }

      result.valid = !!(result.hospitalId && result.appointmentId);

      logger.info(`[${this.hospitalName}] 链接解析结果: valid=${result.valid}, ` +
        `dept=${result.department}, apptId=${result.appointmentId}`);

      return result;
    } catch (err) {
      logger.error(`[${this.hospitalName}] 预约链接解析失败: ${err.message}`);
      result.error = err.message;
      return result;
    }
  }

  async triggerBookingFromNotification(notificationData, patientInfo) {
    logger.info(`[${this.hospitalName}] 从通知触发自动预约`);

    const verificationSteps = [];

    try {
      const bookingLink = notificationData.bookingLink || notificationData.sourceUrl || notificationData.url;

      if (!bookingLink) {
        return new BookingResult({
          status: BOOKING_STATUS.FAILED,
          message: '通知中未找到预约链接',
          errorCode: 'NO_BOOKING_LINK',
          hospitalId: this.hospitalId,
          hospitalName: this.hospitalName,
          patientName: patientInfo?.name,
          patientId: patientInfo?.id,
          verificationSteps
        });
      }

      const parsed = this.parseBookingLink(bookingLink);

      if (!parsed.valid) {
        return new BookingResult({
          status: BOOKING_STATUS.FAILED,
          message: '预约链接无效',
          errorCode: 'INVALID_LINK',
          errorDetails: parsed,
          hospitalId: this.hospitalId,
          hospitalName: this.hospitalName,
          patientName: patientInfo?.name,
          patientId: patientInfo?.id,
          verificationSteps
        });
      }

      if (!this.isLoggedIn) {
        const loginResult = await this.login();
        verificationSteps.push({ step: 'login', success: loginResult.success, timestamp: Date.now() });

        if (!loginResult.success) {
          return new BookingResult({
            status: BOOKING_STATUS.SESSION_EXPIRED,
            message: '登录失败，无法继续预约',
            errorCode: 'LOGIN_FAILED',
            hospitalId: this.hospitalId,
            hospitalName: this.hospitalName,
            department: parsed.department,
            patientName: patientInfo?.name,
            patientId: patientInfo?.id,
            verificationSteps
          });
        }
      }

      try {
        await this.navigateTo(bookingLink);
        await this.waitForPageLoad();
        await this.sleep(2000);
      } catch (navErr) {
        if (parsed.department) {
          logger.warn(`直接跳转失败，尝试通过科室页面导航: ${navErr.message}`);
          await this._navigateToDepartment(parsed.department);
          await this.sleep(2000);
        } else {
          throw navErr;
        }
      }

      const appointmentId = parsed.appointmentId;
      logger.info(`[${this.hospitalName}] 开始预约: ${appointmentId}`);

      return await this.bookAppointment(appointmentId, patientInfo, {
        parsedLink: parsed,
        fromNotification: true,
        verificationSteps
      });

    } catch (err) {
      logger.error(`[${this.hospitalName}] 通知触发预约失败: ${err.message}`);
      return new BookingResult({
        status: BOOKING_STATUS.FAILED,
        message: `预约失败: ${err.message}`,
        errorCode: 'TRIGGER_FAILED',
        errorDetails: err.message,
        hospitalId: this.hospitalId,
        hospitalName: this.hospitalName,
        patientName: patientInfo?.name,
        patientId: patientInfo?.id,
        verificationSteps
      });
    }
  }

  async _handleSecondaryImageCaptcha() {
    logger.info(`[${this.hospitalName}] 检测到二次图形验证码`);

    const sel = this.selectors;
    const captchaImg = sel.secondaryCaptchaImage || sel.captchaImage || '#booking-captcha-img, .captcha-image';
    const captchaInput = sel.secondaryCaptchaInput || sel.captchaInput || '#booking-captcha, .captcha-input';

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const imgElement = await this.waitForVisible(captchaImg, 3000);
        if (!imgElement) {
          logger.debug(`[${this.hospitalName}] 未找到图形验证码元素，可能无需验证`);
          return { success: true, skipped: true, attempts };
        }

        await this.sleep(500);
        const screenshotPath = await this.takeScreenshot(
          `secondary-captcha-${this.hospitalId}-${Date.now()}.png`
        );

        if (!screenshotPath) {
          return { success: false, reason: 'screenshot_failed', attempts };
        }

        const result = await this.captchaService.recognizeImage(screenshotPath);

        if (result.success && result.text) {
          const inputEl = await this.waitForVisible(captchaInput, 2000);
          if (inputEl) {
            await inputEl.clearValue();
            await inputEl.setValue(result.text);
            logger.info(`[${this.hospitalName}] 二次图形验证码已输入: ${result.text}`);
            return { success: true, text: result.text, attempts };
          }
        }

        if (attempts < maxAttempts) {
          const refreshBtn = await this.$('.captcha-refresh, .refresh-captcha, #refresh-captcha');
          if (refreshBtn && await refreshBtn.isDisplayed()) {
            await refreshBtn.click();
            await this.sleep(1000);
          }
        }
      } catch (err) {
        logger.debug(`[${this.hospitalName}] 二次图形验证码处理失败 (尝试${attempts}): ${err.message}`);
        if (attempts >= maxAttempts) {
          return { success: false, error: err.message, attempts };
        }
        await this.sleep(1000);
      }
    }

    return { success: false, reason: 'max_attempts_exceeded', attempts };
  }

  async _handleSmsVerification(options = {}) {
    logger.info(`[${this.hospitalName}] 处理短信验证码`);

    const sel = this.selectors;
    const sendSmsBtn = sel.sendSmsButton || '#send-sms-btn, .send-sms-btn, .btn-send-code';
    const smsInput = sel.smsInput || '#sms-code, .sms-input, .code-input';
    const maxWaitTime = options.maxWaitTime || 120000;
    const checkInterval = 2000;

    const verificationSteps = [];

    try {
      const smsBtn = await this.waitForClickable(sendSmsBtn, 3000);
      if (smsBtn) {
        const btnText = await smsBtn.getText();
        logger.info(`[${this.hospitalName}] 找到发送验证码按钮: ${btnText || '未命名'}`);

        const isDisabled = await smsBtn.isEnabled().then(e => !e).catch(() => true);
        if (!isDisabled) {
          await smsBtn.click();
          verificationSteps.push({ step: 'send_sms_clicked', success: true, timestamp: Date.now() });
          logger.info(`[${this.hospitalName}] 已点击发送验证码按钮`);
        } else {
          logger.info(`[${this.hospitalName}] 验证码按钮已禁用，可能已发送过`);
        }
      } else {
        const inputEl = await this.$(smsInput);
        if (!inputEl || !await inputEl.isDisplayed()) {
          logger.debug(`[${this.hospitalName}] 未找到短信验证码相关元素，可能无需验证`);
          return { success: true, skipped: true, verificationSteps };
        }
      }

      if (options.smsCode) {
        const codeInput = await this.waitForVisible(smsInput, 5000);
        if (codeInput) {
          await codeInput.clearValue();
          await codeInput.setValue(options.smsCode);
          logger.info(`[${this.hospitalName}] 短信验证码已填入: ${options.smsCode}`);
          return { success: true, code: options.smsCode, verificationSteps };
        }
      }

      return {
        success: false,
        pending: true,
        status: BOOKING_STATUS.PENDING_SMS,
        message: '等待用户输入短信验证码',
        verificationSteps,
        inputSelector: smsInput,
        sendBtnSelector: sendSmsBtn
      };

    } catch (err) {
      logger.error(`[${this.hospitalName}] 短信验证码处理失败: ${err.message}`);
      return { success: false, error: err.message, verificationSteps };
    }
  }

  async _checkAndHandleSecondaryVerifications(options = {}) {
    const verificationSteps = options.existingSteps || [];

    try {
      const hasImageCaptcha = await this.hasElement(
        this.selectors.secondaryCaptchaImage || this.selectors.captchaImage ||
        '#booking-captcha-img, .captcha-image, [id*="captcha"][id*="img"]'
      );

      if (hasImageCaptcha) {
        const captchaResult = await this._handleSecondaryImageCaptcha();
        verificationSteps.push({
          step: 'secondary_captcha',
          success: captchaResult.success,
          skipped: captchaResult.skipped || false,
          attempts: captchaResult.attempts,
          timestamp: Date.now()
        });

        if (!captchaResult.success && !captchaResult.skipped) {
          return {
            allPassed: false,
            failedStep: 'captcha',
            result: captchaResult,
            verificationSteps,
            bookingStatus: BOOKING_STATUS.VERIFICATION_FAILED
          };
        }
      }

      const hasSmsInput = await this.hasElement(
        this.selectors.smsInput || '#sms-code, .sms-input, .code-input, [id*="sms"], [id*="code"]'
      );

      if (hasSmsInput) {
        const smsResult = await this._handleSmsVerification(options);
        verificationSteps.push({
          step: 'sms_verification',
          success: smsResult.success,
          skipped: smsResult.skipped || false,
          pending: smsResult.pending || false,
          timestamp: Date.now()
        });

        if (smsResult.pending) {
          return {
            allPassed: false,
            failedStep: 'sms',
            result: smsResult,
            verificationSteps,
            bookingStatus: BOOKING_STATUS.PENDING_SMS
          };
        }

        if (!smsResult.success && !smsResult.skipped) {
          return {
            allPassed: false,
            failedStep: 'sms',
            result: smsResult,
            verificationSteps,
            bookingStatus: BOOKING_STATUS.VERIFICATION_FAILED
          };
        }
      }

      return { allPassed: true, verificationSteps };

    } catch (err) {
      logger.error(`[${this.hospitalName}] 二次验证处理异常: ${err.message}`);
      return {
        allPassed: false,
        failedStep: 'exception',
        result: { error: err.message },
        verificationSteps,
        bookingStatus: BOOKING_STATUS.FAILED
      };
    }
  }

  async close() {
    await super.close();
  }
}

module.exports = {
  HospitalCrawler,
  BookingResult,
  BOOKING_STATUS,
  default: HospitalCrawler
};
