import Auction from '../models/Auction.js';
import Lot from '../models/Lot.js';
import Bid from '../models/Bid.js';
import Deposit from '../models/Deposit.js';
import db from '../config/database.js';
import { getCurrentPrice, getIncrement, validateBidAmount } from '../services/AuctionService.js';
import { generateSettlement, batchRefundDeposits } from '../services/SettlementService.js';
import { recordStatusHistory } from '../services/LotService.js';

const index = async (req, res) => {
  try {
    const { type, status } = req.query;
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    const auctions = Auction.find(query);
    res.json({ code: 200, message: '获取成功', data: auctions });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

const store = async (req, res) => {
  try {
    const auction = Auction.create(req.body);
    res.status(201).json({ code: 201, message: '创建成功', data: auction });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

const show = async (req, res) => {
  try {
    const auction = Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ code: 404, message: '拍卖会不存在', data: null });
    }
    const lots = (auction.lots || []).map((lotId) => Lot.findById(lotId)).filter(Boolean);
    res.json({ code: 200, message: '获取成功', data: { ...auction, lots_detail: lots } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

const getLots = async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;
    const auction = Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ code: 404, message: '拍卖会不存在', data: null });
    }
    const lotIds = auction.lots || [];
    const allLots = lotIds.map((id) => Lot.findById(id)).filter(Boolean);
    const total = allLots.length;
    const lastPage = Math.ceil(total / per_page) || 1;
    const start = (page - 1) * per_page;
    const items = allLots.slice(start, start + Number(per_page));
    res.json({
      code: 200,
      message: '获取成功',
      data: { items, total, page: Number(page), per_page: Number(per_page), last_page: lastPage },
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

const placeBid = async (req, res) => {
  try {
    const { id } = req.params;
    const { lot_id, amount, source = 'online' } = req.body;

    const auction = Auction.findById(id);
    if (!auction) {
      return res.status(404).json({ code: 404, message: '拍卖会不存在', data: null });
    }
    if (auction.status !== 'live') {
      return res.status(400).json({ code: 400, message: '拍卖会未开始或已结束', data: null });
    }

    const lot = Lot.findById(lot_id);
    if (!lot) {
      return res.status(404).json({ code: 404, message: '拍品不存在', data: null });
    }
    if (lot.status !== 'bidding') {
      return res.status(400).json({ code: 400, message: '该拍品不在竞拍中', data: null });
    }

    const deposit = Deposit.findByBidderAuction(req.user.userId, id);
    if (!deposit) {
      return res.status(400).json({ code: 400, message: '请先缴纳保证金', data: null });
    }

    const currentPrice = getCurrentPrice(lot_id, lot.starting_price);
    const increment = getIncrement(auction.increment_rules, currentPrice);
    validateBidAmount(amount, currentPrice, increment);

    const user = db.collection('users').findById(req.user.userId);
    const bid = Bid.create({
      auction_id: id,
      lot_id,
      bidder_id: req.user.userId,
      bidder_number: user?.bidder_number || '',
      amount,
      source,
    });

    res.status(201).json({ code: 201, message: '出价成功', data: bid });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

const hammer = async (req, res) => {
  try {
    const { id } = req.params;
    const { lot_id, result } = req.body;

    if (!['sold', 'passed'].includes(result)) {
      return res.status(400).json({ code: 400, message: '落槌结果必须为 sold 或 passed', data: null });
    }

    const auction = Auction.findById(id);
    if (!auction) {
      return res.status(404).json({ code: 404, message: '拍卖会不存在', data: null });
    }

    const lot = Lot.findById(lot_id);
    if (!lot) {
      return res.status(404).json({ code: 404, message: '拍品不存在', data: null });
    }

    const statusHistory = recordStatusHistory(lot, result, req.user.userId);
    Lot.updateById(lot_id, { status: result, status_history: statusHistory });

    let settlement = null;
    if (result === 'sold') {
      const highestBid = Bid.findHighest(lot_id);
      if (!highestBid) {
        return res.status(400).json({ code: 400, message: '无出价记录，无法成交', data: null });
      }
      const deposit = Deposit.findByBidderAuction(highestBid.bidder_id, id);
      const depositAmount = deposit ? deposit.amount : 0;
      settlement = generateSettlement(lot, auction, highestBid.amount, highestBid.bidder_id, depositAmount);
      if (deposit) {
        Deposit.updateById(deposit._id, { status: 'applied' });
      }
      batchRefundDeposits(id, highestBid.bidder_id);
    } else {
      const bids = Bid.find({ lot_id });
      const bidderIds = [...new Set(bids.map((b) => b.bidder_id))];
      for (const bidderId of bidderIds) {
        const dep = Deposit.findByBidderAuction(bidderId, id);
        if (dep) {
          Deposit.updateById(dep._id, { status: 'refunded', refunded_at: new Date().toISOString() });
        }
      }
    }

    res.json({
      code: 200,
      message: result === 'sold' ? '落槌成交' : '流拍',
      data: { lot_id, result, settlement },
    });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

export default { index, store, show, getLots, placeBid, hammer };
