import Lot from '../models/Lot.js';
import db from '../config/database.js';
import { generateLotNumber, validateStatusTransition, recordStatusHistory } from '../services/LotService.js';

const index = async (req, res) => {
  try {
    const { category, status, auction_id, search, page = 1, per_page = 20 } = req.query;
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (auction_id) query.auction_id = auction_id;

    let lots = db.collection('lots').find(query);

    if (search) {
      const regex = new RegExp(search, 'i');
      lots = lots.filter((l) => regex.test(l.name) || regex.test(l.lot_number));
    }

    const total = lots.length;
    const lastPage = Math.ceil(total / per_page) || 1;
    const start = (page - 1) * per_page;
    const items = lots.slice(start, start + Number(per_page));

    res.json({
      code: 200,
      message: '获取成功',
      data: { items, total, page: Number(page), per_page: Number(per_page), last_page: lastPage },
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

const store = async (req, res) => {
  try {
    const lotNumber = generateLotNumber();
    const lot = Lot.create({
      ...req.body,
      lot_number: lotNumber,
    });
    res.status(201).json({ code: 201, message: '创建成功', data: lot });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

const show = async (req, res) => {
  try {
    const lot = Lot.findById(req.params.id);
    if (!lot) {
      return res.status(404).json({ code: 404, message: '拍品不存在', data: null });
    }
    res.json({ code: 200, message: '获取成功', data: lot });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ code: 400, message: '请提供新状态', data: null });
    }
    const lot = Lot.findById(req.params.id);
    if (!lot) {
      return res.status(404).json({ code: 404, message: '拍品不存在', data: null });
    }
    validateStatusTransition(lot.status, status);
    const statusHistory = recordStatusHistory(lot, status, req.user.userId);
    const updated = Lot.updateById(lot._id, { status, status_history: statusHistory });
    res.json({ code: 200, message: '状态更新成功', data: updated });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

const addAppraisal = async (req, res) => {
  try {
    const lot = Lot.findById(req.params.id);
    if (!lot) {
      return res.status(404).json({ code: 404, message: '拍品不存在', data: null });
    }
    const appraisal = {
      appraiser_id: req.user.userId,
      estimated_price: req.body.estimated_price,
      description: req.body.description || '',
      appraised_at: new Date().toISOString(),
    };
    const appraisals = [...(lot.appraisals || []), appraisal];
    const updated = Lot.updateById(lot._id, { appraisals });
    res.json({ code: 200, message: '鉴定添加成功', data: updated });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

const getConsensus = async (req, res) => {
  try {
    const lot = Lot.findById(req.params.id);
    if (!lot) {
      return res.status(404).json({ code: 404, message: '拍品不存在', data: null });
    }
    const appraisals = lot.appraisals || [];
    if (appraisals.length === 0) {
      return res.json({ code: 200, message: '暂无鉴定数据', data: { reference_price: 0, appraisal_count: 0 } });
    }
    const prices = appraisals.map((a) => a.estimated_price).sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const median = prices.length % 2 !== 0 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
    const updated = Lot.updateById(lot._id, { reference_price: median });
    res.json({
      code: 200,
      message: '参考价计算成功',
      data: { reference_price: median, appraisal_count: appraisals.length, estimate_low: prices[0], estimate_high: prices[prices.length - 1] },
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

export default { index, store, show, updateStatus, addAppraisal, getConsensus };
