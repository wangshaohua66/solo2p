const jwt = require('jsonwebtoken');
const { getDb } = require('../models/db');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'blood-center-management-secret-key-2024';

const ROLES = {
  NURSE: 'nurse',
  TECHNICIAN: 'technician',
  PREPARATOR: 'preparator',
  INVENTORY: 'inventory',
  DISPATCHER: 'dispatcher',
  HOSPITAL: 'hospital'
};

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-user-id'];
  if (!authHeader) {
    return res.status(401).json({ error: '未提供认证信息' });
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ error: '无效的认证令牌' });
    }
  } else {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(authHeader);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    req.user = user;
    return next();
  }
}

function authorize(...allowedRoles) {
  return function(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`用户 ${req.user.username} 尝试访问无权限接口，角色: ${req.user.role}, 需要: ${allowedRoles.join(',')}`);
      return res.status(403).json({ error: '无权限访问此接口' });
    }
    next();
  };
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      hospital_id: user.hospital_id
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = {
  authenticate,
  authorize,
  ROLES,
  generateToken
};
