const BaseAdapter = require('./base');

class CmaAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
  }

  async _verifyLogin() {
    try {
      const dashboardElement = await this.page.$('.dashboard, .user-profile, .ebusiness-header');
      return !!dashboardElement;
    } catch (e) {
      return false;
    }
  }

  async fetchRates(route) {
    const rates = await super.fetchRates(route);
    
    rates.forEach(rate => {
      rate.currency = rate.currency || 'EUR';
      rate.surcharges_total = rate.surcharges_total || 0;
      rate.total_rate = rate.base_rate + rate.surcharges_total;
    });

    return rates;
  }

  async fetchSurcharges() {
    const surcharges = await super.fetchSurcharges();
    
    const bafTypes = ['BAF', 'CAF', 'PSS', 'GRI', 'THC', 'DOC'];
    surcharges.forEach(s => {
      if (!bafTypes.includes(s.surcharge_code)) {
        s.surcharge_code = this._classifySurcharge(s.surcharge_name);
      }
    });

    return surcharges;
  }

  _classifySurcharge(name) {
    if (!name) return 'OTHER';
    const upper = name.toUpperCase();
    if (upper.includes('BAF')) return 'BAF';
    if (upper.includes('CAF')) return 'CAF';
    if (upper.includes('PEAK')) return 'PSS';
    if (upper.includes('GENERAL')) return 'GRI';
    if (upper.includes('TERMINAL')) return 'THC';
    if (upper.includes('DOCUMENT')) return 'DOC';
    return 'OTHER';
  }
}

module.exports = CmaAdapter;
