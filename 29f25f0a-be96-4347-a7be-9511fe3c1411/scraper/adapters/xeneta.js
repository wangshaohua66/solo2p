const BaseAdapter = require('./base');

class XenetaAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
  }

  async _verifyLogin() {
    try {
      const dashboardElement = await this.page.$('.dashboard, .platform-header, .main-nav');
      return !!dashboardElement;
    } catch (e) {
      return false;
    }
  }

  async fetchRates(route) {
    const rates = await super.fetchRates(route);
    
    rates.forEach(rate => {
      rate.currency = rate.currency || 'USD';
      rate.data_source = 'xeneta_benchmark';
      rate.is_benchmark = true;
    });

    return rates;
  }

  async fetchSpaceAvailability() {
    return [];
  }

  async fetchSchedules() {
    return [];
  }

  async fetchSurcharges() {
    return [];
  }
}

module.exports = XenetaAdapter;
