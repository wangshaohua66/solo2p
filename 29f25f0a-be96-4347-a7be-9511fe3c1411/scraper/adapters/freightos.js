const BaseAdapter = require('./base');

class FreightosAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
  }

  async _verifyLogin() {
    try {
      const searchElement = await this.page.$('.search-container, .user-dropdown, [data-testid="user-menu"]');
      return !!searchElement;
    } catch (e) {
      return false;
    }
  }

  async fetchRates(route) {
    const rates = await super.fetchRates(route);
    
    rates.forEach(rate => {
      rate.currency = rate.currency || 'USD';
      rate.total_rate = rate.base_rate + (rate.surcharges_total || 0);
      rate.source = 'freightos_marketplace';
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

module.exports = FreightosAdapter;
