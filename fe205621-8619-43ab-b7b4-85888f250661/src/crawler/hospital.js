const CrawlerBase = require('./base');
const { getCaptchaService } = require('../service/captcha');
const { createLogger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const logger = createLogger('HospitalCrawler');

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

  async bookAppointment(appointmentId, patientInfo) {
    logger.info(`[${this.hospitalName}] 尝试预约: ${appointmentId}`);

    if (!this.isLoggedIn) {
      await this.login();
    }

    try {
      const bookBtnSel = this.selectors.bookButton || this.selectors.reserveBtn ||
                          this.selectors.regBtn || this.selectors.apptButton || '.book-btn';

      const apptSlot = await this.$(`[data-appt-id="${appointmentId}"], .appt-slot[data-id="${appointmentId}"]`);
      if (apptSlot) {
        await apptSlot.click();
        await this.sleep(1000);
      }

      const bookBtn = await this.waitForClickable(bookBtnSel, 5000);
      if (!bookBtn) {
        return { success: false, message: '未找到预约按钮' };
      }

      await bookBtn.click();
      await this.sleep(2000);

      const confirmBtn = await this.$('.confirm-btn, .sure-btn, .btn-confirm, .btn-primary');
      if (confirmBtn && await confirmBtn.isDisplayed()) {
        await this.fillPatientInfo(patientInfo);
        await confirmBtn.click();
        await this.sleep(3000);
      }

      const successText = await this.getText('.success, .alert-success, .toast-success');
      const hasError = await this.hasElement('.error, .alert-error, .toast-error');

      if (hasError) {
        const errorText = await this.getText('.error, .alert-error, .toast-error');
        return { success: false, message: errorText };
      }

      const bookingId = uuidv4();
      return {
        success: true,
        bookingId: bookingId,
        message: successText || '预约成功',
        appointmentId: appointmentId
      };
    } catch (err) {
      logger.error(`[${this.hospitalName}] 预约失败: ${err.message}`);
      return { success: false, error: err.message };
    }
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

  async close() {
    await super.close();
  }
}

module.exports = HospitalCrawler;
