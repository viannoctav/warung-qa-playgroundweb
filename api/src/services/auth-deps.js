const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const users = require('../repositories/users');

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET belum diatur (cek file api/.env atau Environment Variables di Vercel)');
  }
  return secret;
}

// Implementasi asli yang dipakai saat aplikasi berjalan
module.exports = {
  ...users,
  comparePassword: (password, hash) => bcrypt.compare(password, hash),
  hashPassword: (password) => bcrypt.hash(password, 10),
  signToken: (payload, expiresInSeconds) => jwt.sign(payload, getSecret(), { expiresIn: expiresInSeconds }),
  verifyToken: (token) => jwt.verify(token, getSecret()),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
