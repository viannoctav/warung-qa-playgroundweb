const express = require('express');
const { createAuthService } = require('../services/auth-service');
const authDeps = require('../services/auth-deps');
const { createStoreService, newOrderNumber } = require('../services/store-service');
const productRepo = require('../repositories/products');
const storeRepo = require('../repositories/store');
const { sendError, sendResult } = require('../http');
const { MESSAGES } = require('../config');

const router = express.Router();
const auth = createAuthService(authDeps);
const store = createStoreService({
  ensureCatalog: productRepo.ensureCatalog,
  listProducts: productRepo.listProducts,
  getProduct: productRepo.getProduct,
  ...storeRepo,
  newOrderNumber: () => newOrderNumber(),
});

async function requireUser(req, res, next) {
  const user = await auth.authenticate(req.get('authorization'));
  if (!user) return sendError(res, 401, 'UNAUTHORIZED', MESSAGES.unauthorized);
  req.user = user;
  return next();
}

router.use(['/store', '/cart', '/checkout', '/orders'], requireUser);

// Katalog toko (hanya produk aktif)
router.get('/store/products', async (req, res) => sendResult(res, await store.listProducts(req.user, req.query)));
router.get('/store/products/:id', async (req, res) => sendResult(res, await store.getProduct(req.user, req.params.id)));

// Keranjang
router.get('/cart', async (req, res) => sendResult(res, await store.getCart(req.user)));
router.delete('/cart', async (req, res) => sendResult(res, await store.clearCart(req.user)));
router.post('/cart/items', async (req, res) => sendResult(res, await store.addItem(req.user, req.body)));
router.patch('/cart/items/:productId', async (req, res) =>
  sendResult(res, await store.updateItem(req.user, req.params.productId, req.body)));
router.delete('/cart/items/:productId', async (req, res) =>
  sendResult(res, await store.removeItem(req.user, req.params.productId)));

// Checkout & pesanan
router.post('/checkout/preview', async (req, res) => sendResult(res, await store.preview(req.user, req.body)));
router.post('/orders', async (req, res) => sendResult(res, await store.createOrder(req.user, req.body)));
router.get('/orders', async (req, res) => sendResult(res, await store.listOrders(req.user)));
router.get('/orders/:orderNumber', async (req, res) => sendResult(res, await store.getOrder(req.user, req.params.orderNumber)));

module.exports = router;
