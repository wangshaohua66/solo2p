import Bid from '../models/Bid.js';

function getCurrentPrice(lotId, startingPrice) {
  const highestBid = Bid.findHighest(lotId);
  return highestBid ? highestBid.amount : startingPrice;
}

function getIncrement(incrementRules, currentPrice) {
  for (const rule of incrementRules) {
    if (currentPrice >= rule.min && (rule.max === null || currentPrice < rule.max)) {
      return rule.increment;
    }
  }
  return incrementRules[incrementRules.length - 1]?.increment || 5000;
}

function validateBidAmount(amount, currentPrice, increment) {
  const minBid = currentPrice + increment;
  if (amount < minBid) {
    throw new Error(`出价金额不能低于 ${minBid}，当前价: ${currentPrice}，加价幅度: ${increment}`);
  }
  return true;
}

export { getCurrentPrice, getIncrement, validateBidAmount };
