const express = require('express');
const { createAuthService } = require('../services/auth-service');
const authDeps = require('../services/auth-deps');
const { createStoreService, newOrderNumber } = require('../services/store-service');
const { createOrderService, newPaymentRef, PROOF_MAX_BYTES } = require('../services/order-service');
const productRepo = require('../repositories/products');
const storeRepo = require('../repositories/store');
const notificationRepo = require('../repositories/notifications');
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
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  notify: notificationRepo.createNotification,
  findLowStock: notificationRepo.findLowStock,
});
const orders = createOrderService({
  ...storeRepo,
  newPaymentRef: () => newPaymentRef(),
  notify: notificationRepo.createNotification,
});

function sendImage(res, result) {
  if (!result.image) return sendResult(res, result);
  res.set('Cache-Control', 'private, no-store');
  return res.type(result.image.type).send(result.image.buffer);
}

async function requireUser(req, res, next) {
  const user = await auth.authenticate(req.get('authorization'));
  if (!user) return sendError(res, 401, 'UNAUTHORIZED', MESSAGES.unauthorized);
  req.user = user;
  return next();
}

router.use(['/store', '/cart', '/checkout', '/orders', '/payments', '/admin/orders'], requireUser);

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
router.get('/orders', async (req, res) => {
  const { errors, value } = orders.validateDateRange(req.query);
  if (Object.keys(errors).length > 0) return sendError(res, 400, 'VALIDATION_ERROR', Object.values(errors)[0], errors);
  return sendResult(res, await store.listOrders(req.user, value));
});
router.get('/orders/:orderNumber', async (req, res) => sendResult(res, await store.getOrder(req.user, req.params.orderNumber)));
router.post('/orders/:orderNumber/cancel', async (req, res) =>
  sendResult(res, await orders.cancel(req.user, req.params.orderNumber, req.body)));
router.get('/orders/:orderNumber/tracking', async (req, res) =>
  sendResult(res, await orders.tracking(req.user, req.params.orderNumber)));

// Bukti transfer: file mentah PNG/JPG maks 1 MB, nama file opsional di header X-File-Name
// Semua jenis file dibaca mentah; service yang memutuskan boleh atau tidak
const rawProof = express.raw({ type: () => true, limit: PROOF_MAX_BYTES });
router.put('/orders/:orderNumber/payment-proof', rawProof, async (req, res) => {
  let fileName = '';
  try {
    fileName = decodeURIComponent(req.get('x-file-name') || '');
  } catch {
    fileName = '';
  }
  // Di Vercel, body text/plain atau JSON bisa sudah diurai jadi string/objek: kembalikan ke Buffer
  let buffer = req.body;
  if (typeof buffer === 'string') buffer = Buffer.from(buffer, 'utf8');
  else if (buffer && !Buffer.isBuffer(buffer) && typeof buffer === 'object' && Object.keys(buffer).length > 0) buffer = Buffer.from(JSON.stringify(buffer), 'utf8');
  sendResult(res, await orders.uploadProof(req.user, req.params.orderNumber, {
    buffer,
    contentType: req.get('content-type'),
    fileName,
  }));
});
router.get('/orders/:orderNumber/payment-proof', async (req, res) => sendImage(res, await orders.ownProof(req.user, req.params.orderNumber)));
router.delete('/orders/:orderNumber/payment-proof', async (req, res) =>
  sendResult(res, await orders.deleteProof(req.user, req.params.orderNumber)));

// WarungPay (pembayaran e-wallet latihan, dipakai di iframe checkout)
router.post('/payments/warungpay', async (req, res) => sendResult(res, await orders.pay(req.user, req.body)));

// Pesanan toko (admin)
router.get('/admin/orders', async (req, res) => sendResult(res, await orders.listStore(req.user, req.query)));
router.get('/admin/orders/:orderNumber', async (req, res) => sendResult(res, await orders.getStore(req.user, req.params.orderNumber)));
router.patch('/admin/orders/:orderNumber/status', async (req, res) =>
  sendResult(res, await orders.changeStatus(req.user, req.params.orderNumber, req.body)));
router.get('/admin/orders/:orderNumber/payment-proof', async (req, res) =>
  sendImage(res, await orders.storeProof(req.user, req.params.orderNumber)));

module.exports = router;
