const BaseAdapter = require('./base');

class MscAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
  }

  async _verifyLogin() {
    try {
      const userElement = await this.page.$('.user-name, .account-info, .login-status');
      return !!userElement;
    } catch (e) {
      return false;
    }
  }

  async fetchSchedules(route) {
    const schedules = await super.fetchSchedules(route);
    
    schedules.forEach(s => {
      s.service_code = s.service_code || null;
      if (s.vessel_name) {
        s.vessel_name = s.vessel_name.trim();
      }
    });

    return schedules;
  }
}

module.exports = MscAdapter;
