import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'auction-house-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verify(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export { JWT_SECRET, JWT_EXPIRES_IN, sign, verify };
