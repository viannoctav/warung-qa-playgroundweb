const { getSql } = require('../db');
const { SEED_PRODUCTS } = require('../products/catalog');

const COLUMNS =
  'id, sku, name, category, price, stock, is_active, description, created_at, updated_at, (image_data IS NOT NULL) AS has_image, image_updated_at';

// Nama field API → kolom database (dipakai untuk sort dan update dinamis)
const SORT_SQL = {
  name: 'lower(name)',
  price: 'price',
  stock: 'stock',
  createdAt: 'created_at',
};

const UPDATE_COLUMNS = {
  sku: 'sku',
  name: 'name',
  category: 'category',
  price: 'price',
  stock: 'stock',
  isActive: 'is_active',
  description: 'description',
};

function toProduct(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    price: row.price,
    stock: row.stock,
    isActive: row.is_active,
    description: row.description,
    // URL gambar memakai versi (waktu upload) supaya browser tidak menampilkan gambar lama
    imageUrl: row.has_image ? `/api/v1/products/${row.id}/image?v=${new Date(row.image_updated_at).getTime()}` : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// Pencarian memakai ILIKE: % dan _ dicari apa adanya, bukan sebagai wildcard
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function seedQuery(sql, ownerId) {
  return sql`
    INSERT INTO products (owner_id, sku, name, category, price, stock, is_active, description)
    SELECT ${ownerId}, x.sku, x.name, x.category, x.price, x.stock, x."isActive", x.description
    FROM jsonb_to_recordset(${JSON.stringify(SEED_PRODUCTS)}::jsonb)
      AS x(sku text, name text, category text, price int, stock int, "isActive" boolean, description text)
  `;
}

// Membuat 24 produk awal saat katalog akun ini pertama kali dipakai
async function ensureCatalog(ownerId) {
  const sql = getSql();
  const claimed = await sql`
    UPDATE users SET products_seeded = true
    WHERE id = ${ownerId} AND NOT products_seeded
    RETURNING id
  `;
  if (claimed.length > 0) await seedQuery(sql, ownerId);
}

// Reset Data: hapus semua produk akun ini lalu isi ulang 24 produk awal
async function resetCatalog(ownerId) {
  const sql = getSql();
  await sql.transaction([
    sql`DELETE FROM products WHERE owner_id = ${ownerId}`,
    seedQuery(sql, ownerId),
    sql`UPDATE users SET products_seeded = true WHERE id = ${ownerId}`,
  ]);
}

async function listProducts(ownerId, { search, category, status, sort, order, page, limit }) {
  const sql = getSql();
  const params = [ownerId];
  const where = ['owner_id = $1'];

  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const p = `$${params.length}`;
    where.push(`(name ILIKE ${p} ESCAPE '\\' OR sku ILIKE ${p} ESCAPE '\\')`);
  }
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (status === 'active') where.push('is_active');
  if (status === 'inactive') where.push('NOT is_active');

  const whereSql = where.join(' AND ');
  const countRows = await sql.query(`SELECT COUNT(*)::int AS total FROM products WHERE ${whereSql}`, params);
  const total = countRows[0].total;

  // Kolom sort diambil dari daftar tetap (bukan dari input), jadi aman dari SQL injection
  const orderSql = `${SORT_SQL[sort]} ${order === 'desc' ? 'DESC' : 'ASC'}, id ASC`;
  const rows = await sql.query(
    `SELECT ${COLUMNS} FROM products WHERE ${whereSql} ORDER BY ${orderSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit],
  );

  return { total, items: rows.map(toProduct) };
}

async function getProduct(ownerId, id) {
  const sql = getSql();
  const rows = await sql.query(`SELECT ${COLUMNS} FROM products WHERE owner_id = $1 AND id = $2`, [ownerId, id]);
  return rows[0] ? toProduct(rows[0]) : null;
}

async function isSkuTaken(ownerId, sku, exceptId) {
  const sql = getSql();
  const rows = await sql`
    SELECT id FROM products
    WHERE owner_id = ${ownerId} AND sku = ${sku} AND id <> ${exceptId || 0}
  `;
  return rows.length > 0;
}

async function createProduct(ownerId, product) {
  const sql = getSql();
  const rows = await sql.query(
    `INSERT INTO products (owner_id, sku, name, category, price, stock, is_active, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${COLUMNS}`,
    [ownerId, product.sku, product.name, product.category, product.price, product.stock, product.isActive, product.description],
  );
  return toProduct(rows[0]);
}

// Mengubah sebagian atau semua field; null kalau produk tidak ada di katalog akun ini
async function updateProduct(ownerId, id, fields) {
  const sql = getSql();
  const params = [ownerId, id];
  const sets = [];
  for (const [field, column] of Object.entries(UPDATE_COLUMNS)) {
    if (fields[field] !== undefined) {
      params.push(fields[field]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  sets.push('updated_at = now()');
  const rows = await sql.query(
    `UPDATE products SET ${sets.join(', ')} WHERE owner_id = $1 AND id = $2 RETURNING ${COLUMNS}`,
    params,
  );
  return rows[0] ? toProduct(rows[0]) : null;
}

async function deleteProduct(ownerId, id) {
  const sql = getSql();
  const rows = await sql`DELETE FROM products WHERE owner_id = ${ownerId} AND id = ${id} RETURNING id`;
  return rows.length > 0;
}

async function deleteProducts(ownerId, ids) {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM products
    WHERE owner_id = ${ownerId}
      AND id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::int)
    RETURNING id
  `;
  return rows.length;
}

// ---------- Gambar produk ----------

async function setImage(ownerId, id, base64, type) {
  const sql = getSql();
  const rows = await sql.query(
    `UPDATE products SET image_data = $3, image_type = $4, image_updated_at = now(), updated_at = now()
     WHERE owner_id = $1 AND id = $2 RETURNING ${COLUMNS}`,
    [ownerId, id, base64, type],
  );
  return rows[0] ? toProduct(rows[0]) : null;
}

async function deleteImage(ownerId, id) {
  const sql = getSql();
  const rows = await sql.query(
    `UPDATE products SET image_data = NULL, image_type = NULL, image_updated_at = NULL, updated_at = now()
     WHERE owner_id = $1 AND id = $2 RETURNING ${COLUMNS}`,
    [ownerId, id],
  );
  return rows[0] ? toProduct(rows[0]) : null;
}

// Publik (tanpa login) supaya bisa dipakai langsung di tag <img>
async function getImage(id) {
  const sql = getSql();
  const rows = await sql`SELECT image_data, image_type FROM products WHERE id = ${id} AND image_data IS NOT NULL`;
  return rows[0] ? { data: rows[0].image_data, type: rows[0].image_type } : null;
}

module.exports = {
  setImage,
  deleteImage,
  getImage,
  toProduct,
  COLUMNS,
  ensureCatalog,
  resetCatalog,
  listProducts,
  getProduct,
  isSkuTaken,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProducts,
  escapeLike,
};
