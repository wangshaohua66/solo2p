import db from '../config/database.js';
import { DEPOSIT_STATUS_ENUM } from '../middleware/validate.js';

class Deposit {
  static validate(data) {
    const errors = [];
    if (!data.bidder_id) errors.push('竞买人ID不能为空');
    if (!data.auction_id) errors.push('拍卖会ID不能为空');
    if (!data.amount || data.amount <= 0) errors.push('保证金金额必须大于0');
    if (data.status && !DEPOSIT_STATUS_ENUM.includes(data.status)) errors.push('保证金状态值无效');
    return errors;
  }

  static create(data) {
    const errors = this.validate(data);
    if (errors.length > 0) throw new Error(errors.join('; '));

    return db.collection('deposits').insertOne({
      bidder_id: data.bidder_id,
      auction_id: data.auction_id,
      amount: data.amount,
      status: data.status || 'paid',
      paid_at: data.paid_at || new Date().toISOString(),
      refunded_at: data.refunded_at || null,
    });
  }

  static findById(id) {
    return db.collection('deposits').findById(id);
  }

  static find(query = {}) {
    return db.collection('deposits').find(query);
  }

  static updateById(id, data) {
    return db.collection('deposits').updateById(id, data);
  }

  static findByBidderAuction(bidderId, auctionId) {
    return db.collection('deposits').findOne({
      bidder_id: bidderId,
      auction_id: auctionId,
      status: 'paid',
    });
  }
}

export default Deposit;
