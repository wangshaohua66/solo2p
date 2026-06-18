import db from '../config/database.js';
import bcrypt from 'bcryptjs';
import { ROLE_ENUM, USER_STATUS_ENUM } from '../middleware/validate.js';

const SALT_ROUNDS = 10;

class User {
  static validate(data) {
    const errors = [];
    if (!data.name) errors.push('姓名不能为空');
    if (!data.email) errors.push('邮箱不能为空');
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('邮箱格式不正确');
    if (!data.password) errors.push('密码不能为空');
    if (data.role && !ROLE_ENUM.includes(data.role)) errors.push(`角色值无效`);
    if (data.status && !USER_STATUS_ENUM.includes(data.status)) errors.push(`状态值无效`);
    return errors;
  }

  static async create(data) {
    const errors = this.validate(data);
    if (errors.length > 0) throw new Error(errors.join('; '));

    const existing = db.collection('users').findOne({ email: data.email });
    if (existing) throw new Error('该邮箱已被注册');

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    const user = db.collection('users').insertOne({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      phone: data.phone || '',
      role: data.role || 'bidder',
      bidder_number: data.bidder_number || null,
      status: data.status || 'active',
    });
    return user;
  }

  static findByEmail(email) {
    return db.collection('users').findOne({ email });
  }

  static async findByCredentials(email, password) {
    const user = this.findByEmail(email);
    if (!user) return null;
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;
    return user;
  }

  static findById(id) {
    return db.collection('users').findById(id);
  }

  static find(query = {}) {
    return db.collection('users').find(query);
  }

  static updateById(id, data) {
    return db.collection('users').updateById(id, data);
  }

  static toSafe(user) {
    if (!user) return null;
    const { password, ...safe } = user;
    return safe;
  }
}

export default User;
