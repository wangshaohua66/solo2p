import db from '../config/database.js';
import { LOT_STATUS_ENUM, CATEGORY_ENUM } from '../middleware/validate.js';

class Lot {
  static validate(data) {
    const errors = [];
    if (!data.name) errors.push('拍品名称不能为空');
    if (data.category && !CATEGORY_ENUM.includes(data.category)) errors.push('分类值无效');
    if (data.status && !LOT_STATUS_ENUM.includes(data.status)) errors.push('状态值无效');
    return errors;
  }

  static create(data) {
    const errors = this.validate(data);
    if (errors.length > 0) throw new Error(errors.join('; '));

    return db.collection('lots').insertOne({
      lot_number: data.lot_number || '',
      name: data.name,
      category: data.category || 'other',
      description: data.description || '',
      images: data.images || [],
      status: data.status || 'submitted',
      consignor_id: data.consignor_id || null,
      auction_id: data.auction_id || null,
      reference_price: data.reference_price || 0,
      starting_price: data.starting_price || 0,
      estimate_low: data.estimate_low || 0,
      estimate_high: data.estimate_high || 0,
      appraisals: data.appraisals || [],
      status_history: data.status_history || [
        { status: 'submitted', changed_at: new Date().toISOString(), changed_by: null },
      ],
      dimensions: data.dimensions || null,
      artist: data.artist || null,
      weight: data.weight || null,
      period: data.period || null,
    });
  }

  static findById(id) {
    return db.collection('lots').findById(id);
  }

  static find(query = {}) {
    return db.collection('lots').find(query);
  }

  static updateById(id, data) {
    return db.collection('lots').updateById(id, data);
  }

  static count(query = {}) {
    return db.collection('lots').count(query);
  }
}

export default Lot;
export { LOT_STATUS_ENUM, CATEGORY_ENUM };
