// Ulasan produk: tulis (pembeli dengan pesanan Selesai), foto, "Membantu", dan moderasi admin.
const { messages } = require('../notifications/messages');
const { safeNotify } = require('./notification-service');

const STATUSES = ['menunggu', 'disetujui', 'ditolak'];
const SORTS = ['newest', 'highest', 'lowest'];
const PUBLIC_LIMITS = [5, 10, 20];
const ADMIN_LIMITS = [5, 10, 20, 50];
const PHOTO_TYPES = ['image/png', 'image/jpeg'];
const PHOTO_MAX_BYTES = 1024 * 1024;
const PHOTO_MAX_COUNT = 3;
const BODY_MIN = 10;
const BODY_MAX = 500;
const REASON_MIN = 5;
const REASON_MAX = 200;

const TEXT = {
  productNotFound: 'Produk tidak ditemukan',
  reviewNotFound: 'Ulasan tidak ditemukan',
  photoNotFound: 'Foto tidak ditemukan',
  notEligible: 'Ulasan hanya bisa diberikan untuk produk dari pesanan yang sudah Selesai',
  alreadyReviewed: 'Kamu sudah memberi ulasan untuk produk ini',
  ratingInvalid: 'Pilih rating 1–5 bintang',
  bodyRequired: 'Ulasan wajib diisi',
  bodyMin: `Ulasan minimal ${BODY_MIN} karakter`,
  bodyMax: `Ulasan maksimal ${BODY_MAX} karakter`,
  locked: 'Ulasan yang sudah disetujui tidak bisa diubah',
  photoLocked: 'Foto hanya bisa diubah selama ulasan Menunggu moderasi',
  photoType: 'Foto harus PNG atau JPG, maksimal 1 MB',
  photoRequired: 'Pilih file foto',
  photoMismatch: 'Isi file tidak sesuai dengan jenisnya (PNG/JPG)',
  photoCount: `Maksimal ${PHOTO_MAX_COUNT} foto per ulasan`,
  ownHelpful: 'Tidak bisa menandai ulasan sendiri',
  forbidden: 'Hanya akun admin yang bisa memoderasi ulasan.',
  statusInvalid: 'Status harus disetujui atau ditolak',
  reasonRequired: 'Alasan penolakan wajib diisi',
  reasonMin: `Alasan minimal ${REASON_MIN} karakter`,
  reasonMax: `Alasan maksimal ${REASON_MAX} karakter`,
  alreadyModerated: 'Ulasan ini sudah dimoderasi',
  ratingFilter: 'Rating harus 1–5',
  sortInvalid: 'Sort harus newest, highest, atau lowest',
  page: 'Halaman harus angka 1 atau lebih',
  limitPublic: 'Limit harus 5, 10, atau 20',
  limitAdmin: 'Limit harus 5, 10, 20, atau 50',
  statusFilter: 'Status harus menunggu, disetujui, atau ditolak',
};

function fail(status, code, message, fields) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return { status, body: { error } };
}

function parseId(raw) {
  const text = String(raw);
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function matchesSignature(buffer, type) {
  if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return false;
}

function validateReviewInput(body) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.rating = TEXT.ratingInvalid;
  const text = typeof input.body === 'string' ? input.body.trim() : '';
  if (!text) errors.body = TEXT.bodyRequired;
  else if (text.length < BODY_MIN) errors.body = TEXT.bodyMin;
  else if (text.length > BODY_MAX) errors.body = TEXT.bodyMax;
  return { errors, value: { rating: input.rating, body: text } };
}

function readPaging(query, limits, defaultLimit, limitMessage) {
  const errors = {};
  const pageRaw = query.page === undefined ? '1' : String(query.page);
  const limitRaw = query.limit === undefined ? String(defaultLimit) : String(query.limit);
  if (!/^\d+$/.test(pageRaw) || Number(pageRaw) < 1) errors.page = TEXT.page;
  if (!/^\d+$/.test(limitRaw) || !limits.includes(Number(limitRaw))) errors.limit = limitMessage;
  return { errors, page: Number(pageRaw), limit: Number(limitRaw) };
}

// Bentuk ulasan untuk publik: tanpa id pemilik toko / user
function publicReview(review) {
  const { ownerId, userId, ...rest } = review;
  return rest;
}

function createReviewService(deps) {
  async function storeProduct(user, rawId) {
    const id = parseId(rawId);
    if (!id) return null;
    const ownerId = user.role === 'admin' ? user.id : await deps.findDemoStoreOwnerId();
    if (!ownerId) return null;
    return deps.getProduct(ownerId, id);
  }

  // ---------- Publik (semua akun yang login) ----------

  async function listForProduct(user, rawProductId, query = {}) {
    const product = await storeProduct(user, rawProductId);
    if (!product) return fail(404, 'NOT_FOUND', TEXT.productNotFound);

    const { errors, page, limit } = readPaging(query, PUBLIC_LIMITS, 5, TEXT.limitPublic);
    const sort = query.sort === undefined ? 'newest' : String(query.sort);
    if (!SORTS.includes(sort)) errors.sort = TEXT.sortInvalid;
    let rating = null;
    if (query.rating !== undefined && query.rating !== '') {
      rating = Number(query.rating);
      if (!/^[1-5]$/.test(String(query.rating))) errors.rating = TEXT.ratingFilter;
    }
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', Object.values(errors)[0], errors);

    const { total, stats, items } = await deps.listProductReviews(product.id, { rating, sort, page, limit, viewerId: user.id });
    const mine = await deps.findUserReview(user.id, product.id);
    const canReview = !mine && (await deps.hasCompletedPurchase(user.id, product.id));
    return {
      status: 200,
      body: {
        data: items.map(publicReview),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          ...stats,
          mine: mine ? publicReview(mine) : null,
          canReview,
        },
      },
    };
  }

  async function listMine(user) {
    const items = await deps.listUserReviews(user.id);
    return { status: 200, body: { data: items.map(publicReview) } };
  }

  async function create(user, rawProductId, body) {
    const product = await storeProduct(user, rawProductId);
    if (!product) return fail(404, 'NOT_FOUND', TEXT.productNotFound);
    const { errors, value } = validateReviewInput(body);
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', Object.values(errors)[0], errors);
    if (await deps.findUserReview(user.id, product.id)) return fail(409, 'ALREADY_REVIEWED', TEXT.alreadyReviewed);
    if (!(await deps.hasCompletedPurchase(user.id, product.id))) return fail(403, 'NOT_ELIGIBLE', TEXT.notEligible);

    let review;
    try {
      review = await deps.createReview({ productId: product.id, userId: user.id, ...value });
    } catch (err) {
      if (err && err.code === '23505') return fail(409, 'ALREADY_REVIEWED', TEXT.alreadyReviewed);
      throw err;
    }
    await safeNotify(deps, review.ownerId, messages.reviewNew(review));
    return { status: 201, body: { data: publicReview(review) } };
  }

  async function ownReview(user, rawId) {
    const id = parseId(rawId);
    const review = id ? await deps.getReview(id, user.id) : null;
    return review && review.userId === user.id ? review : null;
  }

  async function update(user, rawId, body) {
    const review = await ownReview(user, rawId);
    if (!review) return fail(404, 'NOT_FOUND', TEXT.reviewNotFound);
    if (review.status === 'disetujui') return fail(409, 'REVIEW_LOCKED', TEXT.locked);
    const { errors, value } = validateReviewInput(body);
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', Object.values(errors)[0], errors);
    await deps.updateReview(review.id, value);
    const updated = await deps.getReview(review.id, user.id);
    if (review.status === 'ditolak') await safeNotify(deps, updated.ownerId, messages.reviewNew(updated));
    return { status: 200, body: { data: publicReview(updated) } };
  }

  async function addPhoto(user, rawId, upload) {
    const review = await ownReview(user, rawId);
    if (!review) return fail(404, 'NOT_FOUND', TEXT.reviewNotFound);
    if (review.status !== 'menunggu') return fail(409, 'REVIEW_LOCKED', TEXT.photoLocked);

    const type = String(upload.contentType || '').split(';')[0].trim().toLowerCase();
    if (!PHOTO_TYPES.includes(type)) return fail(415, 'UNSUPPORTED_MEDIA_TYPE', TEXT.photoType);
    const buffer = upload.buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return fail(400, 'VALIDATION_ERROR', TEXT.photoRequired);
    if (buffer.length > PHOTO_MAX_BYTES) return fail(413, 'PAYLOAD_TOO_LARGE', TEXT.photoType);
    if (!matchesSignature(buffer, type)) return fail(400, 'VALIDATION_ERROR', TEXT.photoMismatch);
    if ((await deps.countPhotos(review.id)) >= PHOTO_MAX_COUNT) return fail(422, 'PHOTO_LIMIT', TEXT.photoCount);

    const rawName = typeof upload.fileName === 'string' ? upload.fileName.trim() : '';
    const name = rawName.replace(/[^\w.\- ]/g, '').slice(0, 80) || `foto.${type === 'image/png' ? 'png' : 'jpg'}`;
    await deps.addPhoto(review.id, { data: buffer.toString('base64'), type, size: buffer.length, name });
    return { status: 201, body: { data: publicReview(await deps.getReview(review.id, user.id)) } };
  }

  async function deletePhoto(user, rawId, rawPhotoId) {
    const review = await ownReview(user, rawId);
    if (!review) return fail(404, 'NOT_FOUND', TEXT.reviewNotFound);
    if (review.status !== 'menunggu') return fail(409, 'REVIEW_LOCKED', TEXT.photoLocked);
    const photoId = parseId(rawPhotoId);
    if (!photoId || !(await deps.deletePhoto(review.id, photoId))) return fail(404, 'NOT_FOUND', TEXT.photoNotFound);
    return { status: 200, body: { data: publicReview(await deps.getReview(review.id, user.id)) } };
  }

  // Foto ulasan yang disetujui bisa dilihat semua akun; selain itu hanya penulis dan admin pemilik toko
  async function getPhoto(user, rawId, rawPhotoId) {
    const id = parseId(rawId);
    const photoId = parseId(rawPhotoId);
    const review = id ? await deps.getReview(id, user.id) : null;
    const visible =
      review && (review.status === 'disetujui' || review.userId === user.id || (user.role === 'admin' && review.ownerId === user.id));
    if (!visible || !photoId) return fail(404, 'NOT_FOUND', TEXT.photoNotFound);
    const image = await deps.getPhoto(review.id, photoId);
    if (!image) return fail(404, 'NOT_FOUND', TEXT.photoNotFound);
    return { status: 200, image };
  }

  async function toggleHelpful(user, rawId) {
    const id = parseId(rawId);
    const review = id ? await deps.getReview(id, user.id) : null;
    if (!review || review.status !== 'disetujui') return fail(404, 'NOT_FOUND', TEXT.reviewNotFound);
    if (review.userId === user.id) return fail(403, 'OWN_REVIEW', TEXT.ownHelpful);
    return { status: 200, body: { data: await deps.toggleHelpful(review.id, user.id) } };
  }

  // ---------- Admin ----------

  async function listStore(user, query = {}) {
    if (user.role !== 'admin') return fail(403, 'FORBIDDEN', TEXT.forbidden);
    const { errors, page, limit } = readPaging(query, ADMIN_LIMITS, 10, TEXT.limitAdmin);
    const status = query.status === undefined ? '' : String(query.status);
    if (status && !STATUSES.includes(status)) errors.status = TEXT.statusFilter;
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', Object.values(errors)[0], errors);
    const { total, counts, items } = await deps.listStoreReviews(user.id, { status, page, limit });
    return {
      status: 200,
      body: { data: items.map(publicReview), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), counts } },
    };
  }

  async function moderate(user, rawId, body) {
    if (user.role !== 'admin') return fail(403, 'FORBIDDEN', TEXT.forbidden);
    const id = parseId(rawId);
    const review = id ? await deps.getReview(id, user.id) : null;
    if (!review || review.ownerId !== user.id) return fail(404, 'NOT_FOUND', TEXT.reviewNotFound);

    const input = body && typeof body === 'object' ? body : {};
    if (!['disetujui', 'ditolak'].includes(input.status)) {
      return fail(400, 'VALIDATION_ERROR', TEXT.statusInvalid, { status: TEXT.statusInvalid });
    }
    let reason = '';
    if (input.status === 'ditolak') {
      reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      let error = null;
      if (!reason) error = TEXT.reasonRequired;
      else if (reason.length < REASON_MIN) error = TEXT.reasonMin;
      else if (reason.length > REASON_MAX) error = TEXT.reasonMax;
      if (error) return fail(400, 'VALIDATION_ERROR', error, { reason: error });
    }
    if (review.status !== 'menunggu') return fail(409, 'ALREADY_MODERATED', TEXT.alreadyModerated);
    const changed = await deps.moderateReview(review.id, user.id, { status: input.status, reason });
    if (!changed) return fail(409, 'ALREADY_MODERATED', TEXT.alreadyModerated);

    const updated = await deps.getReview(review.id, user.id);
    await safeNotify(
      deps,
      updated.userId,
      input.status === 'disetujui' ? messages.reviewApproved(updated) : messages.reviewRejected(updated),
    );
    return { status: 200, body: { data: publicReview(updated) } };
  }

  return { listForProduct, listMine, create, update, addPhoto, deletePhoto, getPhoto, toggleHelpful, listStore, moderate };
}

module.exports = { createReviewService, REVIEW_TEXT: TEXT, PHOTO_MAX_BYTES, PHOTO_MAX_COUNT, publicReview };
