import { verify } from '../config/jwt.js';

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌', data: null });
  }
  const token = header.split(' ')[1];
  const decoded = verify(token);
  if (!decoded) {
    return res.status(401).json({ code: 401, message: '令牌无效或已过期', data: null });
  }
  req.user = { userId: decoded.userId, role: decoded.role };
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未认证', data: null });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '无权限访问', data: null });
    }
    next();
  };
};

export { auth, authorize };
