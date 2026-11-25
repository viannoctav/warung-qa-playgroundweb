// Unit test ulasan produk & notifikasi (tanpa database).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReviewService, REVIEW_TEXT: T } = require('../src/services/review-service');
const { createNotificationService } = require('../src/services/notification-service');

const ADMIN = { id: 10, username: 'admin_user', role: 'admin' };
const BUYER = { id: 20, username: 'standard_user', role: 'user' };
const OTHER = { id: 30, username: 'rina_qa', role: 'user' };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);

function setup() {
  const reviews = new Map();
  const photos = new Map();
  const notified = [];
  let nextId = 0;
  const bought = new Set([`${BUYER.id}:1`, `${OTHER.id}:1`]);
  const view = (r, viewerId) => ({ ...r, photos: [...(photos.get(r.id) || [])].map((id) => ({ id })), mine: r.userId === viewerId });
  const deps = {
    findDemoStoreOwnerId: async () => ADMIN.id,
    getProduct: async (ownerId, id) => (ownerId === ADMIN.id && id <= 2 ? { id, name: `Produk ${id}`, isActive: true } : null),
    hasCompletedPurchase: async (userId, productId) => bought.has(`${userId}:${productId}`),
    findUserReview: async (userId, productId) => {
      const r = [...reviews.values()].find((x) => x.userId === userId && x.productId === productId);
      return r ? view(r, userId) : null;
    },
    createReview: async ({ productId, userId, rating, body }) => {
      nextId += 1;
      const author = userId === BUYER.id ? BUYER.username : OTHER.username;
      const r = { id: nextId, productId, productName: `Produk ${productId}`, ownerId: ADMIN.id, userId, author, rating, body, status: 'menunggu', rejectReason: null, helpfulCount: 0 };
      reviews.set(r.id, r);
      return view(r, userId);
    },
    getReview: async (id, viewerId) => (reviews.has(id) ? view(reviews.get(id), viewerId) : null),
    updateReview: async (id, { rating, body }) => Object.assign(reviews.get(id), { rating, body, status: 'menunggu', rejectReason: null }),
    listProductReviews: async () => ({ total: 0, stats: { count: 0, average: null, distribution: {} }, items: [] }),
    listUserReviews: async (userId) => [...reviews.values()].filter((r) => r.userId === userId),
    listStoreReviews: async () => ({ total: 0, counts: {}, items: [] }),
    moderateReview: async (id, ownerId, { status, reason }) => {
      const r = reviews.get(id);
      if (r.status !== 'menunggu') return false;
      Object.assign(r, { status, rejectReason: reason || null });
      return true;
    },
    countPhotos: async (id) => (photos.get(id) || new Set()).size,
    addPhoto: async (id) => {
      const set = photos.get(id) || new Set();
      set.add(set.size + 1);
      photos.set(id, set);
    },
    deletePhoto: async (id, photoId) => (photos.get(id) || new Set()).delete(photoId),
    getPhoto: async () => ({ buffer: PNG, type: 'image/png' }),
    toggleHelpful: async () => ({ helpful: true, helpfulCount: 1 }),
    notify: async (userId, payload) => notified.push({ userId, ...payload }),
  };
  return { svc: createReviewService(deps), reviews, notified, bought };
}

const GOOD = { rating: 5, body: 'Kopinya wangi dan segar.' };

test('ulasan: validasi rating & isi', async () => {
  const { svc } = setup();
  let r = await svc.create(BUYER, '1', { rating: 0, body: '' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.fields.rating, T.ratingInvalid);
  assert.equal(r.body.error.fields.body, T.bodyRequired);
  r = await svc.create(BUYER, '1', { rating: 4, body: 'pendek' });
  assert.equal(r.body.error.fields.body, T.bodyMin);
  r = await svc.create(BUYER, '1', { rating: 4, body: 'x'.repeat(501) });
  assert.equal(r.body.error.fields.body, T.bodyMax);
  r = await svc.create(BUYER, '1', { rating: '5', body: 'Isinya sudah cukup panjang' });
  assert.equal(r.body.error.fields.rating, T.ratingInvalid);
});

test('ulasan: hanya pembeli dengan pesanan Selesai, satu kali per produk', async () => {
  const { svc, notified } = setup();
  assert.equal((await svc.create(BUYER, '2', GOOD)).status, 403);
  assert.equal((await svc.create(BUYER, '99', GOOD)).status, 404);
  const created = await svc.create(BUYER, '1', GOOD);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, 'menunggu');
  assert.equal(created.body.data.userId, undefined, 'id user tidak dibocorkan');
  assert.deepEqual(notified.map((n) => [n.userId, n.type]), [[ADMIN.id, 'review_new']]);
  const again = await svc.create(BUYER, '1', GOOD);
  assert.equal(again.status, 409);
  assert.equal(again.body.error.message, T.alreadyReviewed);
});

test('ulasan: edit hanya milik sendiri; yang disetujui terkunci; yang ditolak kembali Menunggu', async () => {
  const { svc, reviews } = setup();
  const id = (await svc.create(BUYER, '1', GOOD)).body.data.id;
  assert.equal((await svc.update(OTHER, String(id), GOOD)).status, 404);
  reviews.get(id).status = 'ditolak';
  const edited = await svc.update(BUYER, String(id), { rating: 3, body: 'Diubah setelah ditolak admin' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.status, 'menunggu');
  reviews.get(id).status = 'disetujui';
  const locked = await svc.update(BUYER, String(id), GOOD);
  assert.equal(locked.status, 409);
  assert.equal(locked.body.error.message, T.locked);
});

test('ulasan: foto PNG/JPG, cek isi file, maksimal 3', async () => {
  const { svc } = setup();
  const id = String((await svc.create(BUYER, '1', GOOD)).body.data.id);
  assert.equal((await svc.addPhoto(BUYER, id, { buffer: Buffer.from('hai'), contentType: 'text/plain' })).status, 415);
  const fake = await svc.addPhoto(BUYER, id, { buffer: Buffer.from('bukan png'), contentType: 'image/png' });
  assert.equal(fake.body.error.message, T.photoMismatch);
  for (let i = 0; i < 3; i += 1) assert.equal((await svc.addPhoto(BUYER, id, { buffer: PNG, contentType: 'image/png' })).status, 201);
  const fourth = await svc.addPhoto(BUYER, id, { buffer: PNG, contentType: 'image/png' });
  assert.equal(fourth.status, 422);
  assert.equal(fourth.body.error.message, T.photoCount);
  assert.equal((await svc.addPhoto(OTHER, id, { buffer: PNG, contentType: 'image/png' })).status, 404);
});

test('ulasan: foto belum disetujui hanya untuk penulis & admin toko', async () => {
  const { svc, reviews } = setup();
  const id = String((await svc.create(BUYER, '1', GOOD)).body.data.id);
  await svc.addPhoto(BUYER, id, { buffer: PNG, contentType: 'image/png' });
  assert.equal((await svc.getPhoto(OTHER, id, '1')).status, 404);
  assert.equal((await svc.getPhoto(BUYER, id, '1')).status, 200);
  assert.equal((await svc.getPhoto(ADMIN, id, '1')).status, 200);
  reviews.get(id * 1).status = 'disetujui';
  assert.equal((await svc.getPhoto(OTHER, id, '1')).status, 200);
});

test('ulasan: Membantu tidak untuk ulasan sendiri / belum disetujui', async () => {
  const { svc, reviews } = setup();
  const id = (await svc.create(BUYER, '1', GOOD)).body.data.id;
  assert.equal((await svc.toggleHelpful(OTHER, String(id))).status, 404);
  reviews.get(id).status = 'disetujui';
  assert.equal((await svc.toggleHelpful(BUYER, String(id))).status, 403);
  assert.equal((await svc.toggleHelpful(OTHER, String(id))).status, 200);
});

test('moderasi: hanya admin, alasan wajib saat menolak, sekali saja, pembeli dinotifikasi', async () => {
  const { svc, notified } = setup();
  const id = String((await svc.create(BUYER, '1', GOOD)).body.data.id);
  assert.equal((await svc.moderate(BUYER, id, { status: 'disetujui' })).status, 403);
  let r = await svc.moderate(ADMIN, id, { status: 'hapus' });
  assert.equal(r.body.error.message, T.statusInvalid);
  r = await svc.moderate(ADMIN, id, { status: 'ditolak', reason: ' ' });
  assert.equal(r.body.error.fields.reason, T.reasonRequired);
  r = await svc.moderate(ADMIN, id, { status: 'ditolak', reason: 'Isi ulasan tidak sesuai produk' });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.rejectReason, 'Isi ulasan tidak sesuai produk');
  r = await svc.moderate(ADMIN, id, { status: 'disetujui' });
  assert.equal(r.status, 409);
  assert.equal(notified.at(-1).type, 'review_rejected');
  assert.equal(notified.at(-1).userId, BUYER.id);
});

test('ulasan publik: validasi query', async () => {
  const { svc } = setup();
  assert.equal((await svc.listForProduct(BUYER, '1', { rating: '6' })).status, 400);
  assert.equal((await svc.listForProduct(BUYER, '1', { sort: 'acak' })).status, 400);
  assert.equal((await svc.listForProduct(BUYER, '1', { limit: '7' })).status, 400);
  const ok = await svc.listForProduct(BUYER, '1', { rating: '5', sort: 'highest', limit: '10' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.meta.canReview, true);
});

test('notifikasi: daftar, tandai dibaca, validasi', async () => {
  const store = [
    { id: 1, userId: BUYER.id, isRead: false },
    { id: 2, userId: BUYER.id, isRead: false },
    { id: 3, userId: OTHER.id, isRead: false },
  ];
  const svc = createNotificationService({
    listNotifications: async (userId, { unreadOnly, page, limit }) => {
      const mine = store.filter((n) => n.userId === userId);
      const items = mine.filter((n) => !unreadOnly || !n.isRead);
      return { total: items.length, unread: mine.filter((n) => !n.isRead).length, items: items.slice((page - 1) * limit, page * limit) };
    },
    markRead: async (userId, id) => {
      const n = store.find((x) => x.userId === userId && x.id === id);
      if (!n) return null;
      n.isRead = true;
      return n;
    },
    markAllRead: async (userId) => store.filter((n) => n.userId === userId && !n.isRead && (n.isRead = true)).length,
  });
  assert.equal((await svc.list(BUYER, { limit: '7' })).status, 400);
  assert.equal((await svc.list(BUYER, { unread: 'ya' })).status, 400);
  let r = await svc.list(BUYER, {});
  assert.equal(r.body.meta.unread, 2);
  assert.equal((await svc.markRead(BUYER, '3')).status, 404, 'notifikasi akun lain');
  assert.equal((await svc.markRead(BUYER, 'abc')).status, 404);
  assert.equal((await svc.markRead(BUYER, '1')).status, 200);
  r = await svc.markAllRead(BUYER);
  assert.equal(r.body.data.updated, 1);
  r = await svc.list(BUYER, { unread: 'true' });
  assert.equal(r.body.meta.total, 0);
});
