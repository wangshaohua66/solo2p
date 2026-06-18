import db from '../config/database.js';
import { SETTLEMENT_STATUS_ENUM } from '../middleware/validate.js';

class Settlement {
  static validate(data) {
    const errors = [];
    if (!data.lot_id) errors.push('拍品ID不能为空');
    if (!data.auction_id) errors.push('拍卖会ID不能为空');
    if (!data.buyer_id) errors.push('买方ID不能为空');
    if (data.status && !SETTLEMENT_STATUS_ENUM.includes(data.status)) errors.push('结算状态值无效');
    return errors;
  }

  static create(data) {
    const errors = this.validate(data);
    if (errors.length > 0) throw new Error(errors.join('; '));

    return db.collection('settlements').insertOne({
      lot_id: data.lot_id,
      auction_id: data.auction_id,
      buyer_id: data.buyer_id,
      seller_id: data.seller_id || null,
      hammer_price: data.hammer_price || 0,
      buyer_premium_rate: data.buyer_premium_rate || 0.15,
      seller_commission_rate: data.seller_commission_rate || 0.10,
      buyer_premium: data.buyer_premium || 0,
      seller_commission: data.seller_commission || 0,
      total_buyer_amount: data.total_buyer_amount || 0,
      net_seller_amount: data.net_seller_amount || 0,
      deposit_amount: data.deposit_amount || 0,
      status: data.status || 'pending_payment',
    });
  }

  static findById(id) {
    return db.collection('settlements').findById(id);
  }

  static find(query = {}) {
    return db.collection('settlements').find(query);
  }

  static updateById(id, data) {
    return db.collection('settlements').updateById(id, data);
  }

  static count(query = {}) {
    return db.collection('settlements').count(query);
  }
}

export default Settlement;
