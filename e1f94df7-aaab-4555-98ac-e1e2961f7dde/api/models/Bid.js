import db from '../config/database.js';
import { BID_SOURCE_ENUM } from '../middleware/validate.js';

class Bid {
  static validate(data) {
    const errors = [];
    if (!data.auction_id) errors.push('拍卖会ID不能为空');
    if (!data.lot_id) errors.push('拍品ID不能为空');
    if (!data.bidder_id) errors.push('竞买人ID不能为空');
    if (!data.amount || data.amount <= 0) errors.push('出价金额必须大于0');
    if (data.source && !BID_SOURCE_ENUM.includes(data.source)) errors.push('出价来源值无效');
    return errors;
  }

  static create(data) {
    const errors = this.validate(data);
    if (errors.length > 0) throw new Error(errors.join('; '));

    return db.collection('bids').insertOne({
      auction_id: data.auction_id,
      lot_id: data.lot_id,
      bidder_id: data.bidder_id,
      bidder_number: data.bidder_number || '',
      amount: data.amount,
      source: data.source || 'online',
    });
  }

  static findById(id) {
    return db.collection('bids').findById(id);
  }

  static find(query = {}) {
    return db.collection('bids').find(query);
  }

  static findHighest(lotId) {
    const bids = this.find({ lot_id: lotId });
    if (bids.length === 0) return null;
    return bids.reduce((max, bid) => (bid.amount > max.amount ? bid : max), bids[0]);
  }

  static count(query = {}) {
    return db.collection('bids').count(query);
  }
}

export default Bid;
