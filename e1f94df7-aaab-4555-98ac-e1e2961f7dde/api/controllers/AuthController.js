import User from '../models/User.js';
import { sign } from '../config/jwt.js';

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ code: 400, message: '请提供邮箱和密码', data: null });
    }
    const user = await User.findByCredentials(email, password);
    if (!user) {
      return res.status(401).json({ code: 401, message: '邮箱或密码错误', data: null });
    }
    if (user.status === 'disabled') {
      return res.status(403).json({ code: 403, message: '账号已被禁用', data: null });
    }
    const token = sign({ userId: user._id, role: user.role });
    res.json({
      code: 200,
      message: '登录成功',
      data: { token, user: User.toSafe(user) },
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const userRole = ['consignor', 'bidder'].includes(role) ? role : 'bidder';
    const user = await User.create({ name, email, password, phone, role: userRole });
    const token = sign({ userId: user._id, role: user.role });
    res.status(201).json({
      code: 201,
      message: '注册成功',
      data: { token, user: User.toSafe(user) },
    });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

const me = async (req, res) => {
  try {
    const user = User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在', data: null });
    }
    res.json({ code: 200, message: '获取成功', data: User.toSafe(user) });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

const logout = async (req, res) => {
  try {
    res.json({ code: 200, message: '登出成功', data: null });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

export default { login, register, me, logout };
