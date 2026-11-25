const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const users = require('../repositories/users');
const { resetCatalog } = require('../repositories/products');
const store = require('../repositories/store');
const reviewRepo = require('../repositories/reviews');
const notificationRepo = require('../repositories/notifications');

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
  resetCatalog,
  resetShopping: async (userId) => {
    await store.clearCart(userId);
    await store.clearOrders(userId);
    await reviewRepo.clearUserReviews(userId);
    await notificationRepo.clearNotifications(userId);
  },
  comparePassword: (password, hash) => bcrypt.compare(password, hash),
  hashPassword: (password) => bcrypt.hash(password, 10),
  signToken: (payload, expiresInSeconds) => jwt.sign(payload, getSecret(), { expiresIn: expiresInSeconds }),
  verifyToken: (token) => jwt.verify(token, getSecret()),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
