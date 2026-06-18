import db from '../config/database.js';
import { AUCTION_TYPE_ENUM, AUCTION_STATUS_ENUM } from '../middleware/validate.js';

class Auction {
  static validate(data) {
    const errors = [];
    if (!data.name) errors.push('拍卖会名称不能为空');
    if (data.type && !AUCTION_TYPE_ENUM.includes(data.type)) errors.push('拍卖会类型值无效');
    if (data.status && !AUCTION_STATUS_ENUM.includes(data.status)) errors.push('拍卖会状态值无效');
    return errors;
  }

  static create(data) {
    const errors = this.validate(data);
    if (errors.length > 0) throw new Error(errors.join('; '));

    return db.collection('auctions').insertOne({
      name: data.name,
      type: data.type || 'spring',
      status: data.status || 'draft',
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      venue: data.venue || '',
      lots: data.lots || [],
      increment_rules: data.increment_rules || [
        { min: 0, max: 100000, increment: 5000 },
        { min: 100000, max: 500000, increment: 10000 },
        { min: 500000, max: 1000000, increment: 25000 },
        { min: 1000000, max: 5000000, increment: 50000 },
        { min: 5000000, max: 10000000, increment: 100000 },
        { min: 10000000, max: null, increment: 200000 },
      ],
      current_lot_index: data.current_lot_index || 0,
    });
  }

  static findById(id) {
    return db.collection('auctions').findById(id);
  }

  static find(query = {}) {
    return db.collection('auctions').find(query);
  }

  static updateById(id, data) {
    return db.collection('auctions').updateById(id, data);
  }

  static count(query = {}) {
    return db.collection('auctions').count(query);
  }
}

export default Auction;
