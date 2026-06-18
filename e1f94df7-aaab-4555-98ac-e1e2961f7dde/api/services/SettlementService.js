import Settlement from '../models/Settlement.js';
import Deposit from '../models/Deposit.js';
import Lot from '../models/Lot.js';
import db from '../config/database.js';

const BUYER_PREMIUM_RATE = 0.15;
const SELLER_COMMISSION_RATE = 0.10;

function calculateBuyerPremium(hammerPrice) {
  return Math.round(hammerPrice * BUYER_PREMIUM_RATE);
}

function calculateSellerCommission(hammerPrice) {
  return Math.round(hammerPrice * SELLER_COMMISSION_RATE);
}

function generateSettlement(lot, auction, hammerPrice, buyerId, depositAmount = 0) {
  const buyerPremium = calculateBuyerPremium(hammerPrice);
  const sellerCommission = calculateSellerCommission(hammerPrice);
  const totalBuyerAmount = hammerPrice + buyerPremium;
  const netSellerAmount = hammerPrice - sellerCommission;

  return Settlement.create({
    lot_id: lot._id,
    auction_id: auction._id,
    buyer_id: buyerId,
    seller_id: lot.consignor_id,
    hammer_price: hammerPrice,
    buyer_premium_rate: BUYER_PREMIUM_RATE,
    seller_commission_rate: SELLER_COMMISSION_RATE,
    buyer_premium: buyerPremium,
    seller_commission: sellerCommission,
    total_buyer_amount: totalBuyerAmount,
    net_seller_amount: netSellerAmount,
    deposit_amount: depositAmount,
    status: 'pending_payment',
  });
}

function batchRefundDeposits(auctionId, winningBidderId) {
  const deposits = Deposit.find({ auction_id: auctionId, status: 'paid' });
  const refundResults = [];
  for (const deposit of deposits) {
    if (deposit.bidder_id !== winningBidderId) {
      Deposit.updateById(deposit._id, {
        status: 'refunded',
        refunded_at: new Date().toISOString(),
      });
      refundResults.push(deposit._id);
    }
  }
  return refundResults;
}

export { calculateBuyerPremium, calculateSellerCommission, generateSettlement, batchRefundDeposits, BUYER_PREMIUM_RATE, SELLER_COMMISSION_RATE };
