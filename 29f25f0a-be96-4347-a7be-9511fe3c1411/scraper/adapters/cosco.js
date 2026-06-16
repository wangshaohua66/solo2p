const BaseAdapter = require('./base');

class CoscoAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
  }

  async _verifyLogin() {
    try {
      const welcomeElement = await this.page.$('.welcome, .user-info, #userInfo');
      return !!welcomeElement;
    } catch (e) {
      return false;
    }
  }

  async login() {
    if (!this.config.credentials.username) {
      return false;
    }

    logger.info(`[${this.config.name}] 开始登录（中远海运）`);
    
    try {
      await this.page.goto(this.config.loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      const { usernameInput, passwordInput, submitButton } = this.config.selectors;

      await this.page.waitForSelector(usernameInput, { timeout: 10000 });
      await this.page.type(usernameInput, this.config.credentials.username, { delay: 80 });
      await this.page.type(passwordInput, this.config.credentials.password, { delay: 80 });
      
      await this.page.click(submitButton);
      await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});

      const loggedIn = await this._verifyLogin();
      if (loggedIn) {
        this.isLoggedIn = true;
        await this._saveSession();
        logger.info(`[${this.config.name}] 登录成功`);
      }
      
      return loggedIn;
    } catch (error) {
      logger.error(`[${this.config.name}] 登录失败: ${error.message}`);
      sessions.invalidate(this.config.id);
      return false;
    }
  }

  async fetchRates(route) {
    const rates = await super.fetchRates(route);
    
    rates.forEach(rate => {
      rate.currency = rate.currency || 'USD';
      if (rate.port_from && rate.port_from.includes('上海')) {
        rate.port_from = 'Shanghai';
      }
      if (rate.port_to && rate.port_to.includes('洛杉矶')) {
        rate.port_to = 'Los Angeles';
      }
    });

    return rates;
  }

  async fetchSchedules(route) {
    const schedules = await super.fetchSchedules(route);
    
    schedules.forEach(s => {
      if (s.transit_days === null && s.departure_date && s.arrival_date) {
        s.transit_days = this._parseTransitDays(s.departure_date, s.arrival_date);
      }
    });

    return schedules;
  }

  _parseTransitDays(dep, arr) {
    try {
      const depDate = new Date(dep);
      const arrDate = new Date(arr);
      if (!isNaN(depDate.getTime()) && !isNaN(arrDate.getTime())) {
        return Math.ceil((arrDate - depDate) / (1000 * 60 * 60 * 24));
      }
    } catch (e) {}
    return null;
  }
}

const logger = require('../../utils/logger');
const { sessions } = require('../../store/db');

module.exports = CoscoAdapter;
