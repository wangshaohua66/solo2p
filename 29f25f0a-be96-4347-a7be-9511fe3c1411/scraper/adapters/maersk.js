const BaseAdapter = require('./base');

class MaerskAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
  }

  async _verifyLogin() {
    try {
      const userMenu = await this.page.$('.user-menu, .profile-dropdown, [data-testid="user-menu"]');
      return !!userMenu;
    } catch (e) {
      return false;
    }
  }

  async fetchRates(route) {
    const rates = await super.fetchRates(route);
    
    rates.forEach(rate => {
      if (rate.base_rate) {
        rate.base_rate = this._normalizeMaerskRate(rate.base_rate);
        rate.total_rate = rate.base_rate + (rate.surcharges_total || 0);
      }
    });

    return rates;
  }

  _normalizeMaerskRate(rate) {
    if (!rate) return 0;
    return Math.round(rate * 100) / 100;
  }
}

module.exports = MaerskAdapter;
