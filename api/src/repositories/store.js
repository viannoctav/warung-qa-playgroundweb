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

function toOrder(row) {
  return {
    orderNumber: row.order_number,
    status: row.status,
    recipientName: row.recipient_name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    postalCode: row.postal_code,
    notes: row.notes,
    shippingMethod: row.shipping_method,
    shippingCost: row.shipping_cost,
    paymentMethod: row.payment_method,
    voucherCode: row.voucher_code,
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Membuat pesanan dalam satu transaksi: simpan pesanan + item, kurangi stok, kosongkan keranjang.
 * Kalau stok ada yang jadi minus, CHECK constraint di tabel products menggagalkan semuanya (kode 23514).
 */
async function createOrder({ buyerId, ownerId, orderNumber, checkout, summary }) {
  const sql = getSql();
  await sql.transaction([
    sql`
      INSERT INTO orders (
        order_number, user_id, store_owner_id, recipient_name, phone, address, city, postal_code, notes,
        shipping_method, shipping_cost, payment_method, voucher_code, subtotal, discount, total
      ) VALUES (
        ${orderNumber}, ${buyerId}, ${ownerId}, ${checkout.recipientName}, ${checkout.phone}, ${checkout.address},
        ${checkout.city}, ${checkout.postalCode}, ${checkout.notes}, ${checkout.shippingMethod}, ${summary.shippingCost},
        ${checkout.paymentMethod}, ${summary.voucherCode || ''}, ${summary.subtotal}, ${summary.discount}, ${summary.total}
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
      UPDATE products p SET stock = p.stock - c.quantity, updated_at = now()
      FROM cart_items c
      WHERE c.user_id = ${buyerId} AND c.product_id = p.id AND p.owner_id = ${ownerId}
    `,
    sql`DELETE FROM cart_items WHERE user_id = ${buyerId}`,
  ]);
  return getOrder(buyerId, orderNumber);
}

async function listOrders(buyerId) {
  const sql = getSql();
  const rows = await sql`
    SELECT o.*, COALESCE(SUM(i.quantity), 0)::int AS item_count
    FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
    WHERE o.user_id = ${buyerId}
    GROUP BY o.id
    ORDER BY o.created_at DESC, o.id DESC
  `;
  return rows.map((row) => ({ ...toOrder(row), itemCount: row.item_count }));
}

// Pesanan milik akun lain dianggap tidak ada (null)
async function getOrder(buyerId, orderNumber) {
  const sql = getSql();
  const rows = await sql`SELECT * FROM orders WHERE user_id = ${buyerId} AND order_number = ${orderNumber}`;
  if (!rows[0]) return null;
  const items = await sql`
    SELECT product_id, sku, name, price, quantity, subtotal
    FROM order_items WHERE order_id = ${rows[0].id} ORDER BY id
  `;
  return {
    ...toOrder(rows[0]),
    items: items.map((item) => ({
      productId: item.product_id,
      sku: item.sku,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
  };
}

async function clearOrders(buyerId) {
  const sql = getSql();
  await sql`DELETE FROM orders WHERE user_id = ${buyerId}`;
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
  clearOrders,
};
