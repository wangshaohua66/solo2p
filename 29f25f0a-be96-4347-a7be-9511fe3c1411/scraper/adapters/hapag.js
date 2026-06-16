const BaseAdapter = require('./base');

class HapagLloydAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
  }

  async _verifyLogin() {
    try {
      const logoutElement = await this.page.$('.logout, [href*="logout"], .user-menu');
      return !!logoutElement;
    } catch (e) {
      return false;
    }
  }

  async fetchSpaceAvailability(route) {
    const spaces = await super.fetchSpaceAvailability(route);
    
    spaces.forEach(space => {
      if (!space.status) {
        space.status = this._parseSpaceStatus(space.status_text, space.available_count);
      }
    });

    return spaces;
  }

  _parseSpaceStatus(statusText, availableCount) {
    if (!statusText) return 'unknown';
    
    const lower = statusText.toLowerCase();
    
    if (lower.includes('fully booked') || lower.includes('sold out') || lower.includes('no space')) {
      return 'full';
    }
    if (lower.includes('limited') || lower.includes('restricted') || lower.includes('booking')) {
      return 'limited';
    }
    if (lower.includes('open') || lower.includes('available') || lower.includes('space')) {
      return 'available';
    }
    
    if (availableCount !== null) {
      if (availableCount === 0) return 'full';
      if (availableCount < 30) return 'limited';
      return 'available';
    }
    
    return 'unknown';
  }
}

module.exports = HapagLloydAdapter;
