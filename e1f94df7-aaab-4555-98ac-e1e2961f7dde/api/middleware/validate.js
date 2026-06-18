const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^1[3-9]\d{9}$/;

const ROLE_ENUM = ['admin', 'operator', 'appraiser', 'editor', 'auctioneer', 'consignor', 'bidder'];
const USER_STATUS_ENUM = ['active', 'disabled'];
const LOT_STATUS_ENUM = ['submitted', 'appraising', 'photographed', 'cataloging', 'previewing', 'bidding', 'sold', 'passed', 'settled', 'delivered'];
const CATEGORY_ENUM = ['ceramics', 'painting', 'jewelry', 'antique_book', 'other'];
const AUCTION_TYPE_ENUM = ['spring', 'autumn', 'monthly_online'];
const AUCTION_STATUS_ENUM = ['draft', 'preview', 'live', 'ended'];
const BID_SOURCE_ENUM = ['live', 'online'];
const SETTLEMENT_STATUS_ENUM = ['pending_payment', 'paid', 'seller_settled', 'completed', 'refunded'];
const DEPOSIT_STATUS_ENUM = ['paid', 'refunded', 'applied'];

const validateRequired = (fields) => {
  return (req, res, next) => {
    const missing = [];
    for (const field of fields) {
      const value = req.body[field];
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      return res.status(400).json({
        code: 400,
        message: `缺少必填字段: ${missing.join(', ')}`,
        data: null,
      });
    }
    next();
  };
};

const validateEmail = (field = 'email') => {
  return (req, res, next) => {
    const value = req.body[field];
    if (value && !EMAIL_REGEX.test(value)) {
      return res.status(400).json({
        code: 400,
        message: '邮箱格式不正确',
        data: null,
      });
    }
    next();
  };
};

const validatePhone = (field = 'phone') => {
  return (req, res, next) => {
    const value = req.body[field];
    if (value && !PHONE_REGEX.test(value)) {
      return res.status(400).json({
        code: 400,
        message: '手机号格式不正确',
        data: null,
      });
    }
    next();
  };
};

const validateEnum = (field, enumValues, label) => {
  return (req, res, next) => {
    const value = req.body[field];
    if (value && !enumValues.includes(value)) {
      return res.status(400).json({
        code: 400,
        message: `${label || field} 的值无效，允许值: ${enumValues.join(', ')}`,
        data: null,
      });
    }
    next();
  };
};

export {
  validateRequired,
  validateEmail,
  validatePhone,
  validateEnum,
  ROLE_ENUM,
  USER_STATUS_ENUM,
  LOT_STATUS_ENUM,
  CATEGORY_ENUM,
  AUCTION_TYPE_ENUM,
  AUCTION_STATUS_ENUM,
  BID_SOURCE_ENUM,
  SETTLEMENT_STATUS_ENUM,
  DEPOSIT_STATUS_ENUM,
};
