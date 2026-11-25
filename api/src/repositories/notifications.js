const { getSql } = require('../db');

const iso = (value) => (value ? new Date(value).toISOString() : null);

function toNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    isRead: row.is_read,
    createdAt: iso(row.created_at),
  };
}

async function createNotification(userId, { type, title, body, link }) {
  const sql = getSql();
  await sql`
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (${userId}, ${type}, ${title}, ${body}, ${link || ''})
  `;
}

async function listNotifications(userId, { unreadOnly, page, limit }) {
  const sql = getSql();
  const filter = unreadOnly ? 'AND NOT is_read' : '';
  const counts = await sql.query(
    `SELECT COUNT(*) FILTER (WHERE TRUE ${filter})::int AS total, COUNT(*) FILTER (WHERE NOT is_read)::int AS unread
     FROM notifications WHERE user_id = $1`,
    [userId],
  );
  const rows = await sql.query(
    `SELECT id, type, title, body, link, is_read, created_at FROM notifications
     WHERE user_id = $1 ${filter} ORDER BY id DESC LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit],
  );
  return { total: counts[0].total, unread: counts[0].unread, items: rows.map(toNotification) };
}

async function markRead(userId, id) {
  const sql = getSql();
  const rows = await sql`
    UPDATE notifications SET is_read = true WHERE user_id = ${userId} AND id = ${id}
    RETURNING id, type, title, body, link, is_read, created_at
  `;
  return rows[0] ? toNotification(rows[0]) : null;
}

async function markAllRead(userId) {
  const sql = getSql();
  const rows = await sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId} AND NOT is_read RETURNING id`;
  return rows.length;
}

async function clearNotifications(userId) {
  const sql = getSql();
  await sql`DELETE FROM notifications WHERE user_id = ${userId}`;
}

// Produk yang stoknya tinggal sedikit (untuk notifikasi admin)
async function findLowStock(ownerId, productIds, threshold) {
  if (productIds.length === 0) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, stock FROM products
    WHERE owner_id = ${ownerId} AND stock <= ${threshold}
      AND id IN (SELECT jsonb_array_elements_text(${JSON.stringify(productIds)}::jsonb)::int)
    ORDER BY id
  `;
  return rows.map((row) => ({ id: row.id, name: row.name, stock: row.stock }));
}

module.exports = { createNotification, listNotifications, markRead, markAllRead, clearNotifications, findLowStock };
