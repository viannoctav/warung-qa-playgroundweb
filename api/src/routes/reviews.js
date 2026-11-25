const express = require('express');
const { createAuthService } = require('../services/auth-service');
const authDeps = require('../services/auth-deps');
const { createReviewService, PHOTO_MAX_BYTES } = require('../services/review-service');
const productRepo = require('../repositories/products');
const storeRepo = require('../repositories/store');
const reviewRepo = require('../repositories/reviews');
const notificationRepo = require('../repositories/notifications');
const { sendError, sendResult } = require('../http');
const { MESSAGES } = require('../config');

const router = express.Router();
const auth = createAuthService(authDeps);
const reviews = createReviewService({
  ...reviewRepo,
  getProduct: productRepo.getProduct,
  findDemoStoreOwnerId: storeRepo.findDemoStoreOwnerId,
  notify: notificationRepo.createNotification,
});

async function requireUser(req, res, next) {
  const user = await auth.authenticate(req.get('authorization'));
  if (!user) return sendError(res, 401, 'UNAUTHORIZED', MESSAGES.unauthorized);
  req.user = user;
  return next();
}

router.use(['/store/products/:id/reviews', '/reviews', '/admin/reviews'], requireUser);

router.get('/store/products/:id/reviews', async (req, res) =>
  sendResult(res, await reviews.listForProduct(req.user, req.params.id, req.query)));
router.post('/store/products/:id/reviews', async (req, res) =>
  sendResult(res, await reviews.create(req.user, req.params.id, req.body)));

router.get('/reviews/mine', async (req, res) => sendResult(res, await reviews.listMine(req.user)));
router.patch('/reviews/:id', async (req, res) => sendResult(res, await reviews.update(req.user, req.params.id, req.body)));
router.post('/reviews/:id/helpful', async (req, res) => sendResult(res, await reviews.toggleHelpful(req.user, req.params.id)));

// Foto ulasan: file mentah PNG/JPG maks 1 MB, nama file opsional di header X-File-Name
const rawPhoto = express.raw({ type: () => true, limit: PHOTO_MAX_BYTES });
router.post('/reviews/:id/photos', rawPhoto, async (req, res) => {
  let fileName = '';
  try {
    fileName = decodeURIComponent(req.get('x-file-name') || '');
  } catch {
    fileName = '';
  }
  sendResult(res, await reviews.addPhoto(req.user, req.params.id, {
    buffer: Buffer.isBuffer(req.body) ? req.body : undefined,
    contentType: req.get('content-type'),
    fileName,
  }));
});
router.get('/reviews/:id/photos/:photoId', async (req, res) => {
  const result = await reviews.getPhoto(req.user, req.params.id, req.params.photoId);
  if (!result.image) return sendResult(res, result);
  res.set('Cache-Control', 'private, no-store');
  return res.type(result.image.type).send(result.image.buffer);
});
router.delete('/reviews/:id/photos/:photoId', async (req, res) =>
  sendResult(res, await reviews.deletePhoto(req.user, req.params.id, req.params.photoId)));

router.get('/admin/reviews', async (req, res) => sendResult(res, await reviews.listStore(req.user, req.query)));
router.patch('/admin/reviews/:id', async (req, res) => sendResult(res, await reviews.moderate(req.user, req.params.id, req.body)));

module.exports = router;
