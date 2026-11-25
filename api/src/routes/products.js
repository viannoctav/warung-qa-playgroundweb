const express = require('express');
const { createAuthService } = require('../services/auth-service');
const authDeps = require('../services/auth-deps');
const { createProductService } = require('../services/product-service');
const productDeps = require('../repositories/products');
const { sendError, sendResult } = require('../http');
const { MESSAGES } = require('../config');
const { IMAGE_TYPES, IMAGE_MAX_BYTES } = require('../services/product-service');

const router = express.Router();
const auth = createAuthService(authDeps);
const products = createProductService(productDeps);

// Semua endpoint produk butuh login (401 tanpa token yang valid)
async function requireUser(req, res, next) {
  const user = await auth.authenticate(req.get('authorization'));
  if (!user) return sendError(res, 401, 'UNAUTHORIZED', MESSAGES.unauthorized);
  req.user = user;
  return next();
}

// Gambar produk publik (tanpa token) supaya bisa langsung dipakai di <img src>.
// Didaftarkan sebelum requireUser.
router.get('/products/:id/image', async (req, res) => {
  const result = await products.getImage(req.params.id);
  if (!result.image) return sendResult(res, result);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  return res.type(result.image.type).send(result.image.buffer);
});

router.use(['/categories', '/products', '/stock-movements'], requireUser);

// Upload gambar: body berupa file mentah (bukan JSON), Content-Type image/jpeg|png|webp
const rawImage = express.raw({ type: IMAGE_TYPES, limit: IMAGE_MAX_BYTES });

router.put('/products/:id/image', rawImage, async (req, res) => {
  sendResult(res, await products.setImage(req.user, req.params.id, {
    buffer: req.body,
    contentType: req.get('content-type'),
  }));
});

router.delete('/products/:id/image', async (req, res) => {
  sendResult(res, await products.deleteImage(req.user, req.params.id));
});

router.get('/categories', async (req, res) => {
  sendResult(res, await products.categories());
});

router.get('/products', async (req, res) => {
  sendResult(res, await products.list(req.user, req.query));
});

// Produk unggulan & riwayat stok (didaftarkan sebelum /products/:id)
router.get('/products/featured', async (req, res) => sendResult(res, await products.featured(req.user)));
router.put('/products/featured', async (req, res) => sendResult(res, await products.setFeatured(req.user, req.body)));
router.get('/stock-movements', async (req, res) => sendResult(res, await products.stockMovements(req.user, req.query)));

// Didaftarkan sebelum /products/:id supaya "bulk-delete" tidak dianggap id
router.post('/products/bulk-delete', async (req, res) => {
  sendResult(res, await products.bulkDelete(req.user, req.body));
});

router.post('/products', async (req, res) => {
  sendResult(res, await products.create(req.user, req.body));
});

router.get('/products/:id', async (req, res) => {
  sendResult(res, await products.get(req.user, req.params.id));
});

router.put('/products/:id', async (req, res) => {
  sendResult(res, await products.replace(req.user, req.params.id, req.body));
});

router.patch('/products/:id', async (req, res) => {
  sendResult(res, await products.patch(req.user, req.params.id, req.body));
});

router.delete('/products/:id', async (req, res) => {
  sendResult(res, await products.remove(req.user, req.params.id));
});

module.exports = router;
