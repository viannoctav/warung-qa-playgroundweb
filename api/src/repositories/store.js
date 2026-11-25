const { getSql } = require('../db');
const { toProduct } = require('./products');

const PRODUCT_COLUMNS = [
  'p.id',
  'p.sku',
  'p.name',
  'p.category',
  'p.price',
  'p.stock',
  'p.is_active',
  'p.description',
  'p.created_at',
  'p.updated_at',
  '(p.image_data IS NOT NULL) AS has_image',
  'p.image_updated_at',
].join(', ');

let adminUserId = null;

// Toko untuk role user (standard_user, dll.) adalah toko milik admin_user
async function findDemoStoreOwnerId() {
  if (adminUserId) return adminUserId;
  const sql = getSql();
  const rows = await sql`SELECT id FROM users WHERE username = 'admin_user'`;
  adminUserId = rows[0] ? rows[0].id : null;
  return adminUserId;
}

// ---------- Keranjang ----------

async function getCartItems(buyerId, ownerId) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${PRODUCT_COLUMNS}, c.quantity
     FROM cart_items c JOIN products p ON p.id = c.product_id
     WHERE c.user_id = $1 AND p.owner_id = $2
     ORDER BY c.added_at, p.id`,
    [buyerId, ownerId],
  );
  return rows.map((row) => ({ product: toProduct(row), quantity: row.quantity }));
}

async function getCartQuantity(buyerId, productId) {
  const sql = getSql();
  const rows = await sql`SELECT quantity FROM cart_items WHERE user_id = ${buyerId} AND product_id = ${productId}`;
  return rows[0] ? rows[0].quantity : 0;
}

async function setCartQuantity(buyerId, productId, quantity) {
  const sql = getSql();
  await sql`
    INSERT INTO cart_items (user_id, product_id, quantity)
    VALUES (${buyerId}, ${productId}, ${quantity})
    ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
  `;
}

async function removeCartItem(buyerId, productId) {
  const sql = getSql();
  const rows = await sql`DELETE FROM cart_items WHERE user_id = ${buyerId} AND product_id = ${productId} RETURNING product_id`;
  return rows.length > 0;
}

async function clearCart(buyerId) {
  const sql = getSql();
  await sql`DELETE FROM cart_items WHERE user_id = ${buyerId}`;
}

// ---------- Pesanan ----------

// Kolom DATE bisa datang sebagai string atau Date (tergantung driver): ambil YYYY-MM-DD
function dateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const iso = (value) => (value ? new Date(value).toISOString() : null);

function toOrder(row) {
  return {
    orderNumber: row.order_number,
    status: row.status,
    buyer: row.buyer_username || undefined,
    recipientName: row.recipient_name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    postalCode: row.postal_code,
    notes: row.notes,
    shipDate: dateOnly(row.ship_date),
    shippingMethod: row.shipping_method,
    shippingCost: row.shipping_cost,
    courier: row.courier || null,
    trackingNumber: row.tracking_number || null,
    paymentMethod: row.payment_method,
    paymentRef: row.payment_ref || null,
    voucherCode: row.voucher_code,
    giftCardCode: row.gift_card_code || null,
    giftCardDiscount: row.gift_card_discount || 0,
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    cancelReason: row.cancel_reason || null,
    cancelNote: row.cancel_note || null,
    paymentProof: row.proof_uploaded_at
      ? { name: row.proof_name, type: row.proof_type, size: row.proof_size, uploadedAt: iso(row.proof_uploaded_at) }
      : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const ORDER_COLUMNS = `o.id, o.order_number, o.user_id, o.store_owner_id, o.status, o.recipient_name, o.phone, o.address,
  o.city, o.postal_code, o.notes, o.ship_date, o.shipping_method, o.shipping_cost, o.courier, o.tracking_number,
  o.payment_method, o.payment_ref, o.voucher_code, o.gift_card_code, o.gift_card_discount, o.subtotal, o.discount,
  o.total, o.cancel_reason, o.cancel_note, o.proof_name, o.proof_type, o.proof_size, o.proof_uploaded_at,
  o.created_at, o.updated_at, u.username AS buyer_username`;

/**
 * Membuat pesanan dalam satu transaksi: simpan pesanan + item + riwayat status, catat riwayat stok,
 * kurangi stok, tandai pembayaran WarungPay terpakai, kosongkan keranjang.
 * Kalau stok ada yang jadi minus, CHECK constraint di tabel products menggagalkan semuanya (kode 23514).
 */
async function createOrder({ buyerId, buyerUsername, ownerId, orderNumber, checkout, summary }) {
  const sql = getSql();
  await sql.transaction([
    sql`
      INSERT INTO orders (
        order_number, user_id, store_owner_id, recipient_name, phone, address, city, postal_code, notes,
        shipping_method, shipping_cost, payment_method, voucher_code, subtotal, discount, total,
        ship_date, gift_card_code, gift_card_discount, payment_ref
      ) VALUES (
        ${orderNumber}, ${buyerId}, ${ownerId}, ${checkout.recipientName}, ${checkout.phone}, ${checkout.address},
        ${checkout.city}, ${checkout.postalCode}, ${checkout.notes}, ${checkout.shippingMethod}, ${summary.shippingCost},
        ${checkout.paymentMethod}, ${summary.voucherCode || ''}, ${summary.subtotal}, ${summary.discount}, ${summary.total},
        ${checkout.shipDate}::date, NULLIF(${summary.giftCardCode || ''}, ''), ${summary.giftCardDiscount || 0},
        NULLIF(${checkout.paymentRef || ''}, '')
      )
    `,
    sql`
      INSERT INTO order_items (order_id, product_id, sku, name, price, quantity, subtotal)
      SELECT (SELECT id FROM orders WHERE order_number = ${orderNumber}), p.id, p.sku, p.name, p.price, c.quantity, p.price * c.quantity
      FROM cart_items c JOIN products p ON p.id = c.product_id
      WHERE c.user_id = ${buyerId} AND p.owner_id = ${ownerId}
      ORDER BY c.added_at, p.id
    `,
    sql`
      INSERT INTO order_status_history (order_id, status, actor, note)
      SELECT id, 'diproses', ${buyerUsername}, 'Pesanan dibuat' FROM orders WHERE order_number = ${orderNumber}
    `,
    sql`
      INSERT INTO stock_movements (owner_id, product_id, product_name, change, reason, ref, stock_after)
      SELECT ${ownerId}, p.id, p.name, -c.quantity, 'order', ${orderNumber}, p.stock - c.quantity
      FROM cart_items c JOIN products p ON p.id = c.product_id
      WHERE c.user_id = ${buyerId} AND p.owner_id = ${ownerId}
    `,
    sql`
      UPDATE products p SET stock = p.stock - c.quantity, updated_at = now()
      FROM cart_items c
      WHERE c.user_id = ${buyerId} AND c.product_id = p.id AND p.owner_id = ${ownerId}
    `,
    sql`UPDATE payments SET order_number = ${orderNumber} WHERE ref = ${checkout.paymentRef || ''} AND user_id = ${buyerId}`,
    sql`DELETE FROM cart_items WHERE user_id = ${buyerId}`,
  ]);
  return getOrder(buyerId, orderNumber);
}

async function listOrders(buyerId, { from, to } = {}) {
  const sql = getSql();
  const params = [buyerId];
  const where = ['o.user_id = $1'];
  // Rentang tanggal dalam WIB, inklusif
  if (from) {
    params.push(from);
    where.push(`(o.created_at AT TIME ZONE 'Asia/Jakarta')::date >= $${params.length}::date`);
  }
  if (to) {
    params.push(to);
    where.push(`(o.created_at AT TIME ZONE 'Asia/Jakarta')::date <= $${params.length}::date`);
  }
  const rows = await sql.query(
    `SELECT ${ORDER_COLUMNS}, COALESCE((SELECT SUM(i.quantity) FROM order_items i WHERE i.order_id = o.id), 0)::int AS item_count
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY o.created_at DESC, o.id DESC`,
    params,
  );
  return rows.map((row) => ({ ...toOrder(row), itemCount: row.item_count }));
}

async function orderExtras(orderId) {
  const sql = getSql();
  const items = await sql`
    SELECT product_id, sku, name, price, quantity, subtotal
    FROM order_items WHERE order_id = ${orderId} ORDER BY id
  `;
  const history = await sql`
    SELECT status, actor, note, created_at FROM order_status_history WHERE order_id = ${orderId} ORDER BY id
  `;
  return {
    items: items.map((item) => ({
      productId: item.product_id,
      sku: item.sku,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    history: history.map((h) => ({ status: h.status, actor: h.actor, note: h.note, createdAt: iso(h.created_at) })),
  };
}

// Pesanan milik akun lain dianggap tidak ada (null)
async function getOrder(buyerId, orderNumber) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${ORDER_COLUMNS} FROM orders o JOIN users u ON u.id = o.user_id WHERE o.user_id = $1 AND o.order_number = $2`,
    [buyerId, orderNumber],
  );
  if (!rows[0]) return null;
  return { ...toOrder(rows[0]), id: rows[0].id, storeOwnerId: rows[0].store_owner_id, ...(await orderExtras(rows[0].id)) };
}

// ---------- Pesanan toko (admin) ----------

const ADMIN_SORTS = { createdAt: 'o.created_at', total: 'o.total' };

async function listStoreOrders(ownerId, { status, search, sort, order, page, limit }) {
  const sql = getSql();
  const params = [ownerId];
  const base = ['o.store_owner_id = $1'];
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    base.push(`(o.order_number ILIKE $${params.length} OR u.username ILIKE $${params.length})`);
  }
  const counts = await sql.query(
    `SELECT o.status, COUNT(*)::int AS n FROM orders o JOIN users u ON u.id = o.user_id WHERE ${base.join(' AND ')} GROUP BY o.status`,
    params,
  );
  const where = [...base];
  const listParams = [...params];
  if (status) {
    listParams.push(status);
    where.push(`o.status = $${listParams.length}`);
  }
  const totalRows = await sql.query(
    `SELECT COUNT(*)::int AS total FROM orders o JOIN users u ON u.id = o.user_id WHERE ${where.join(' AND ')}`,
    listParams,
  );
  const orderSql = `${ADMIN_SORTS[sort] || 'o.created_at'} ${order === 'asc' ? 'ASC' : 'DESC'}, o.id ${order === 'asc' ? 'ASC' : 'DESC'}`;
  listParams.push(limit, (page - 1) * limit);
  const rows = await sql.query(
    `SELECT ${ORDER_COLUMNS}, COALESCE((SELECT SUM(i.quantity) FROM order_items i WHERE i.order_id = o.id), 0)::int AS item_count
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderSql}
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const byStatus = { diproses: 0, dikirim: 0, selesai: 0, dibatalkan: 0 };
  for (const row of counts) byStatus[row.status] = row.n;
  return {
    total: totalRows[0].total,
    counts: { all: Object.values(byStatus).reduce((a, b) => a + b, 0), ...byStatus },
    items: rows.map((row) => ({ ...toOrder(row), itemCount: row.item_count })),
  };
}

async function getStoreOrder(ownerId, orderNumber) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${ORDER_COLUMNS} FROM orders o JOIN users u ON u.id = o.user_id WHERE o.store_owner_id = $1 AND o.order_number = $2`,
    [ownerId, orderNumber],
  );
  if (!rows[0]) return null;
  return { ...toOrder(rows[0]), id: rows[0].id, userId: rows[0].user_id, ...(await orderExtras(rows[0].id)) };
}

/**
 * Ubah status dengan penjagaan: hanya berhasil kalau status di database masih `from`
 * (dua admin menekan tombol bersamaan → satu berhasil, satu ditolak).
 * Pembatalan mengembalikan stok dan mencatat riwayat stok dalam transaksi yang sama.
 * Mengembalikan true kalau status berubah.
 */
async function changeOrderStatus({ orderId, ownerId, from, to, actor, note, courier, trackingNumber, cancelReason, cancelNote }) {
  const sql = getSql();
  const stamp = new Date().toISOString();
  const statements = [
    sql`
      UPDATE orders SET status = ${to}, updated_at = ${stamp}::timestamptz,
        courier = COALESCE(NULLIF(${courier || ''}, ''), courier),
        tracking_number = COALESCE(NULLIF(${trackingNumber || ''}, ''), tracking_number),
        cancel_reason = COALESCE(NULLIF(${cancelReason || ''}, ''), cancel_reason),
        cancel_note = COALESCE(NULLIF(${cancelNote || ''}, ''), cancel_note)
      WHERE id = ${orderId} AND status = ${from}
    `,
    sql`
      INSERT INTO order_status_history (order_id, status, actor, note)
      SELECT id, ${to}, ${actor}, ${note || ''} FROM orders WHERE id = ${orderId} AND status = ${to} AND updated_at = ${stamp}::timestamptz
    `,
  ];
  if (to === 'dibatalkan') {
    statements.push(
      sql`
        UPDATE products p SET stock = p.stock + i.quantity, updated_at = now()
        FROM order_items i
        WHERE i.order_id = ${orderId} AND p.id = i.product_id AND p.owner_id = ${ownerId}
          AND EXISTS (SELECT 1 FROM orders WHERE id = ${orderId} AND status = ${to} AND updated_at = ${stamp}::timestamptz)
      `,
      sql`
        INSERT INTO stock_movements (owner_id, product_id, product_name, change, reason, ref, stock_after)
        SELECT ${ownerId}, p.id, p.name, i.quantity, 'cancel', o.order_number, p.stock
        FROM order_items i JOIN products p ON p.id = i.product_id JOIN orders o ON o.id = i.order_id
        WHERE i.order_id = ${orderId} AND p.owner_id = ${ownerId}
          AND EXISTS (SELECT 1 FROM orders WHERE id = ${orderId} AND status = ${to} AND updated_at = ${stamp}::timestamptz)
      `,
    );
  }
  await sql.transaction(statements);
  const rows = await sql`SELECT 1 FROM orders WHERE id = ${orderId} AND status = ${to} AND updated_at = ${stamp}::timestamptz`;
  return rows.length > 0;
}

// ---------- Bukti transfer ----------

async function setPaymentProof(orderId, { data, type, size, name }) {
  const sql = getSql();
  await sql`
    UPDATE orders SET proof_data = ${data}, proof_type = ${type}, proof_size = ${size}, proof_name = ${name},
      proof_uploaded_at = now(), updated_at = now()
    WHERE id = ${orderId}
  `;
}

async function deletePaymentProof(orderId) {
  const sql = getSql();
  await sql`
    UPDATE orders SET proof_data = NULL, proof_type = NULL, proof_size = NULL, proof_name = NULL,
      proof_uploaded_at = NULL, updated_at = now()
    WHERE id = ${orderId}
  `;
}

async function getPaymentProof(orderId) {
  const sql = getSql();
  const rows = await sql`SELECT proof_data, proof_type FROM orders WHERE id = ${orderId} AND proof_data IS NOT NULL`;
  return rows[0] ? { data: rows[0].proof_data, type: rows[0].proof_type } : null;
}

// ---------- WarungPay (pembayaran e-wallet latihan) ----------

async function createPayment({ ref, userId, phone, amount }) {
  const sql = getSql();
  await sql`INSERT INTO payments (ref, user_id, phone, amount) VALUES (${ref}, ${userId}, ${phone}, ${amount})`;
}

async function findPayment(ref, userId) {
  const sql = getSql();
  const rows = await sql`SELECT ref, amount, order_number FROM payments WHERE ref = ${ref} AND user_id = ${userId}`;
  return rows[0] ? { ref: rows[0].ref, amount: rows[0].amount, used: Boolean(rows[0].order_number) } : null;
}

async function clearOrders(buyerId) {
  const sql = getSql();
  await sql`DELETE FROM orders WHERE user_id = ${buyerId}`;
  await sql`DELETE FROM payments WHERE user_id = ${buyerId}`;
}

module.exports = {
  findDemoStoreOwnerId,
  getCartItems,
  getCartQuantity,
  setCartQuantity,
  removeCartItem,
  clearCart,
  createOrder,
  listOrders,
  getOrder,
  listStoreOrders,
  getStoreOrder,
  changeOrderStatus,
  setPaymentProof,
  deletePaymentProof,
  getPaymentProof,
  createPayment,
  findPayment,
  clearOrders,
};
