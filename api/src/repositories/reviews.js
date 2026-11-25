const { getSql } = require('../db');

const iso = (value) => (value ? new Date(value).toISOString() : null);

const REVIEW_COLUMNS = `r.id, r.product_id, r.user_id, r.rating, r.body, r.status, r.reject_reason, r.helpful_count,
  r.created_at, r.updated_at, u.username AS author, p.name AS product_name, p.owner_id,
  COALESCE((SELECT json_agg(ph.id ORDER BY ph.id) FROM review_photos ph WHERE ph.review_id = r.id), '[]'::json) AS photo_ids`;

const REVIEW_FROM = 'reviews r JOIN users u ON u.id = r.user_id JOIN products p ON p.id = r.product_id';

function toReview(row, viewerId) {
  const photoIds = typeof row.photo_ids === 'string' ? JSON.parse(row.photo_ids) : row.photo_ids || [];
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    ownerId: row.owner_id,
    userId: row.user_id,
    author: row.author,
    rating: row.rating,
    body: row.body,
    status: row.status,
    rejectReason: row.reject_reason || null,
    helpfulCount: row.helpful_count,
    helpfulByMe: Boolean(row.helpful_by_me),
    mine: viewerId !== undefined ? row.user_id === viewerId : undefined,
    photos: photoIds.map((id) => ({ id, url: `/api/v1/reviews/${row.id}/photos/${id}` })),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

// Pembeli boleh mengulas kalau punya pesanan Selesai yang berisi produk ini
async function hasCompletedPurchase(userId, productId) {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE o.user_id = ${userId} AND o.status = 'selesai' AND i.product_id = ${productId}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function getReview(id, viewerId) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${REVIEW_COLUMNS},
       EXISTS (SELECT 1 FROM review_helpful h WHERE h.review_id = r.id AND h.user_id = $2) AS helpful_by_me
     FROM ${REVIEW_FROM} WHERE r.id = $1`,
    [id, viewerId || 0],
  );
  return rows[0] ? toReview(rows[0], viewerId) : null;
}

async function findUserReview(userId, productId) {
  const sql = getSql();
  const rows = await sql`SELECT id FROM reviews WHERE user_id = ${userId} AND product_id = ${productId}`;
  return rows[0] ? getReview(rows[0].id, userId) : null;
}

async function createReview({ productId, userId, rating, body }) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO reviews (product_id, user_id, rating, body)
    VALUES (${productId}, ${userId}, ${rating}, ${body})
    RETURNING id
  `;
  return getReview(rows[0].id, userId);
}

// Ubah isi ulasan; ulasan yang ditolak kembali Menunggu moderasi
async function updateReview(id, { rating, body }) {
  const sql = getSql();
  await sql`
    UPDATE reviews SET rating = ${rating}, body = ${body}, status = 'menunggu', reject_reason = NULL, updated_at = now()
    WHERE id = ${id}
  `;
}

const PUBLIC_SORTS = {
  newest: 'r.created_at DESC, r.id DESC',
  highest: 'r.rating DESC, r.created_at DESC, r.id DESC',
  lowest: 'r.rating ASC, r.created_at DESC, r.id DESC',
};

async function listProductReviews(productId, { rating, sort, page, limit, viewerId }) {
  const sql = getSql();
  const stats = await sql`
    SELECT COUNT(*)::int AS count, ROUND(AVG(rating)::numeric, 1) AS average,
      COUNT(*) FILTER (WHERE rating = 5)::int AS r5, COUNT(*) FILTER (WHERE rating = 4)::int AS r4,
      COUNT(*) FILTER (WHERE rating = 3)::int AS r3, COUNT(*) FILTER (WHERE rating = 2)::int AS r2,
      COUNT(*) FILTER (WHERE rating = 1)::int AS r1
    FROM reviews WHERE product_id = ${productId} AND status = 'disetujui'
  `;
  const params = [productId, viewerId || 0];
  let where = `r.product_id = $1 AND r.status = 'disetujui'`;
  if (rating) {
    params.push(rating);
    where += ` AND r.rating = $${params.length}`;
  }
  const totalRows = await sql.query(
    `SELECT COUNT(*)::int AS total FROM reviews r WHERE r.product_id = $1 AND r.status = 'disetujui' ${rating ? 'AND r.rating = $2' : ''}`,
    rating ? [productId, rating] : [productId],
  );
  const rows = await sql.query(
    `SELECT ${REVIEW_COLUMNS},
       EXISTS (SELECT 1 FROM review_helpful h WHERE h.review_id = r.id AND h.user_id = $2) AS helpful_by_me
     FROM ${REVIEW_FROM} WHERE ${where}
     ORDER BY ${PUBLIC_SORTS[sort] || PUBLIC_SORTS.newest}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit],
  );
  const s = stats[0];
  return {
    total: totalRows[0].total,
    stats: {
      count: s.count,
      average: s.average === null ? null : Number(s.average),
      distribution: { 5: s.r5, 4: s.r4, 3: s.r3, 2: s.r2, 1: s.r1 },
    },
    items: rows.map((row) => toReview(row, viewerId)),
  };
}

async function listUserReviews(userId) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${REVIEW_COLUMNS}, false AS helpful_by_me FROM ${REVIEW_FROM} WHERE r.user_id = $1 ORDER BY r.id DESC`,
    [userId],
  );
  return rows.map((row) => toReview(row, userId));
}

async function listStoreReviews(ownerId, { status, page, limit }) {
  const sql = getSql();
  const params = [ownerId];
  let where = 'p.owner_id = $1';
  if (status) {
    params.push(status);
    where += ` AND r.status = $${params.length}`;
  }
  const counts = await sql.query(
    `SELECT r.status, COUNT(*)::int AS n FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.owner_id = $1 GROUP BY r.status`,
    [ownerId],
  );
  const totalRows = await sql.query(`SELECT COUNT(*)::int AS total FROM ${REVIEW_FROM} WHERE ${where}`, params);
  const rows = await sql.query(
    `SELECT ${REVIEW_COLUMNS}, false AS helpful_by_me FROM ${REVIEW_FROM} WHERE ${where}
     ORDER BY (r.status = 'menunggu') DESC, r.updated_at DESC, r.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit],
  );
  const byStatus = { menunggu: 0, disetujui: 0, ditolak: 0 };
  for (const row of counts) byStatus[row.status] = row.n;
  return {
    total: totalRows[0].total,
    counts: { all: byStatus.menunggu + byStatus.disetujui + byStatus.ditolak, ...byStatus },
    items: rows.map((row) => toReview(row)),
  };
}

// Moderasi hanya berhasil kalau ulasan masih Menunggu (dua admin bersamaan → satu ditolak)
async function moderateReview(id, ownerId, { status, reason }) {
  const sql = getSql();
  const rows = await sql`
    UPDATE reviews r SET status = ${status}, reject_reason = NULLIF(${reason || ''}, ''), updated_at = now()
    FROM products p
    WHERE r.id = ${id} AND p.id = r.product_id AND p.owner_id = ${ownerId} AND r.status = 'menunggu'
    RETURNING r.id
  `;
  return rows.length > 0;
}

async function countPhotos(reviewId) {
  const sql = getSql();
  const rows = await sql`SELECT COUNT(*)::int AS n FROM review_photos WHERE review_id = ${reviewId}`;
  return rows[0].n;
}

async function addPhoto(reviewId, { data, type, size, name }) {
  const sql = getSql();
  await sql`
    INSERT INTO review_photos (review_id, data, type, size, name)
    VALUES (${reviewId}, ${data}, ${type}, ${size}, ${name})
  `;
}

async function deletePhoto(reviewId, photoId) {
  const sql = getSql();
  const rows = await sql`DELETE FROM review_photos WHERE review_id = ${reviewId} AND id = ${photoId} RETURNING id`;
  return rows.length > 0;
}

async function getPhoto(reviewId, photoId) {
  const sql = getSql();
  const rows = await sql`SELECT data, type FROM review_photos WHERE review_id = ${reviewId} AND id = ${photoId}`;
  return rows[0] ? { buffer: Buffer.from(rows[0].data, 'base64'), type: rows[0].type } : null;
}

// Tandai / batal tandai "Membantu" (satu kali per akun)
async function toggleHelpful(reviewId, userId) {
  const sql = getSql();
  const inserted = await sql`
    INSERT INTO review_helpful (review_id, user_id) VALUES (${reviewId}, ${userId})
    ON CONFLICT DO NOTHING RETURNING review_id
  `;
  if (inserted.length > 0) {
    await sql`UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ${reviewId}`;
  } else {
    await sql`DELETE FROM review_helpful WHERE review_id = ${reviewId} AND user_id = ${userId}`;
    await sql`UPDATE reviews SET helpful_count = GREATEST(helpful_count - 1, 0) WHERE id = ${reviewId}`;
  }
  const rows = await sql`SELECT helpful_count FROM reviews WHERE id = ${reviewId}`;
  return { helpful: inserted.length > 0, helpfulCount: rows[0] ? rows[0].helpful_count : 0 };
}

async function clearUserReviews(userId) {
  const sql = getSql();
  await sql`DELETE FROM reviews WHERE user_id = ${userId}`;
}

module.exports = {
  hasCompletedPurchase,
  getReview,
  findUserReview,
  createReview,
  updateReview,
  listProductReviews,
  listUserReviews,
  listStoreReviews,
  moderateReview,
  countPhotos,
  addPhoto,
  deletePhoto,
  getPhoto,
  toggleHelpful,
  clearUserReviews,
};
