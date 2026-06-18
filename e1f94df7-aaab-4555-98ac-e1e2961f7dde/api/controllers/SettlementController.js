import Settlement from '../models/Settlement.js';
import Deposit from '../models/Deposit.js';
import Lot from '../models/Lot.js';
import Auction from '../models/Auction.js';
import db from '../config/database.js';

const index = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    const settlements = Settlement.find(query);
    const enriched = settlements.map((s) => {
      const lot = Lot.findById(s.lot_id);
      const auction = Auction.findById(s.auction_id);
      return { ...s, lot_name: lot?.name || '', auction_name: auction?.name || '' };
    });
    res.json({ code: 200, message: '获取成功', data: enriched });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

const show = async (req, res) => {
  try {
    const settlement = Settlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({ code: 404, message: '结算记录不存在', data: null });
    }
    const lot = Lot.findById(settlement.lot_id);
    const auction = Auction.findById(settlement.auction_id);
    const buyer = db.collection('users').findById(settlement.buyer_id);
    const seller = db.collection('users').findById(settlement.seller_id);
    res.json({
      code: 200,
      message: '获取成功',
      data: {
        ...settlement,
        lot,
        auction,
        buyer: buyer ? { _id: buyer._id, name: buyer.name } : null,
        seller: seller ? { _id: seller._id, name: seller.name } : null,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

const payDeposit = async (req, res) => {
  try {
    const { bidder_id, auction_id, amount } = req.body;
    if (!bidder_id || !auction_id || !amount) {
      return res.status(400).json({ code: 400, message: '缺少必填字段', data: null });
    }
    const existing = Deposit.findByBidderAuction(bidder_id, auction_id);
    if (existing) {
      return res.status(400).json({ code: 400, message: '该竞买人已缴纳保证金', data: null });
    }
    const deposit = Deposit.create({ bidder_id, auction_id, amount, status: 'paid' });
    res.status(201).json({ code: 201, message: '保证金缴纳成功', data: deposit });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

const refundDeposit = async (req, res) => {
  try {
    const deposit = Deposit.findById(req.params.id);
    if (!deposit) {
      return res.status(404).json({ code: 404, message: '保证金记录不存在', data: null });
    }
    if (deposit.status !== 'paid') {
      return res.status(400).json({ code: 400, message: '保证金状态不允许退款', data: null });
    }
    const updated = Deposit.updateById(deposit._id, {
      status: 'refunded',
      refunded_at: new Date().toISOString(),
    });
    res.json({ code: 200, message: '保证金退款成功', data: updated });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

const buyerPay = async (req, res) => {
  try {
    const settlement = Settlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({ code: 404, message: '结算记录不存在', data: null });
    }
    if (settlement.status !== 'pending_payment') {
      return res.status(400).json({ code: 400, message: '结算状态不正确', data: null });
    }
    const updated = Settlement.updateById(settlement._id, { status: 'paid' });
    res.json({ code: 200, message: '买方付款确认成功', data: updated });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

const sellerSettle = async (req, res) => {
  try {
    const settlement = Settlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({ code: 404, message: '结算记录不存在', data: null });
    }
    if (settlement.status !== 'paid') {
      return res.status(400).json({ code: 400, message: '需先确认买方付款', data: null });
    }
    const updated = Settlement.updateById(settlement._id, { status: 'seller_settled' });

    const lot = Lot.findById(settlement.lot_id);
    if (lot) {
      const statusHistory = lot.status_history || [];
      statusHistory.push({ status: 'settled', changed_at: new Date().toISOString(), changed_by: req.user.userId });
      Lot.updateById(lot._id, { status: 'settled', status_history: statusHistory });
    }

    res.json({ code: 200, message: '卖方结算成功', data: updated });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

export default { index, show, payDeposit, refundDeposit, buyerPay, sellerSettle };
