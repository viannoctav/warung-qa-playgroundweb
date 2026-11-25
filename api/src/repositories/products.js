const { getSql } = require('../db');
const { SEED_PRODUCTS, FEATURED_SKUS, buildMovements } = require('../products/catalog');

const COLUMNS =
  'id, sku, name, category, price, stock, is_active, description, created_at, updated_at, (image_data IS NOT NULL) AS has_image, image_updated_at, featured_rank';

// Nama field API → kolom database (dipakai untuk sort dan update dinamis)
const SORT_SQL = {
  name: 'lower(name)',
  price: 'price',
  stock: 'stock',
  createdAt: 'created_at',
  featured: 'featured_rank',
  priceText: 'price::text',
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
    featuredRank: row.featured_rank ?? null,
    ...(row.rating_count !== undefined
      ? { ratingAverage: row.rating_average === null ? null : Number(row.rating_average), ratingCount: row.rating_count }
      : {}),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// Rata-rata bintang & jumlah ulasan yang sudah disetujui
const RATING_COLUMNS = `(SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.product_id = products.id AND r.status = 'disetujui') AS rating_average,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = products.id AND r.status = 'disetujui')::int AS rating_count`;

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

// Riwayat stok contoh (±500 baris) dan produk unggulan awal, dibuat bersama 24 produk awal
function seedExtrasQueries(sql, ownerId) {
  const movements = buildMovements(SEED_PRODUCTS.map((p) => ({ sku: p.sku, stock: p.stock })));
  return [
    sql`
      INSERT INTO stock_movements (owner_id, product_id, product_name, change, reason, ref, stock_after, created_at)
      SELECT ${ownerId}, p.id, p.name, x.change, x.reason, x.ref, x.after, now() - make_interval(mins => x.ago)
      FROM jsonb_to_recordset(${JSON.stringify(movements)}::jsonb)
        AS x(sku text, change int, reason text, ref text, after int, ago int)
      JOIN products p ON p.owner_id = ${ownerId} AND p.sku = x.sku
      ORDER BY x.ago DESC
    `,
    sql`
      UPDATE products p SET featured_rank = f.rank
      FROM jsonb_to_recordset(${JSON.stringify(FEATURED_SKUS.map((sku, i) => ({ sku, rank: i + 1 })))}::jsonb) AS f(sku text, rank int)
      WHERE p.owner_id = ${ownerId} AND p.sku = f.sku
    `,
  ];
}

// Membuat 24 produk awal saat katalog akun ini pertama kali dipakai
async function ensureCatalog(ownerId) {
  const sql = getSql();
  const claimed = await sql`
    UPDATE users SET products_seeded = true
    WHERE id = ${ownerId} AND NOT products_seeded
    RETURNING id
  `;
  if (claimed.length > 0) await sql.transaction([seedQuery(sql, ownerId), ...seedExtrasQueries(sql, ownerId)]);
}

// Reset Data: hapus semua produk akun ini lalu isi ulang 24 produk awal
async function resetCatalog(ownerId) {
  const sql = getSql();
  await sql.transaction([
    sql`DELETE FROM products WHERE owner_id = ${ownerId}`,
    seedQuery(sql, ownerId),
    ...seedExtrasQueries(sql, ownerId),
    sql`UPDATE users SET products_seeded = true WHERE id = ${ownerId}`,
  ]);
}

async function listProducts(ownerId, { search, category, categories, minPrice, maxPrice, status, sort, order, page, limit, caseSensitive, offsetShift = 0 }) {
  const sql = getSql();
  const params = [ownerId];
  const where = ['owner_id = $1'];

  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const p = `$${params.length}`;
    const like = caseSensitive ? 'LIKE' : 'ILIKE';
    where.push(`(name ${like} ${p} ESCAPE '\\' OR sku ${like} ${p} ESCAPE '\\')`);
  }
  const categoryList = categories && categories.length > 0 ? categories : category ? [category] : [];
  if (categoryList.length > 0) {
    params.push(JSON.stringify(categoryList));
    where.push(`category IN (SELECT jsonb_array_elements_text($${params.length}::jsonb))`);
  }
  if (Number.isInteger(minPrice)) {
    params.push(minPrice);
    where.push(`price >= $${params.length}`);
  }
  if (Number.isInteger(maxPrice)) {
    params.push(maxPrice);
    where.push(`price <= $${params.length}`);
  }
  if (status === 'active') where.push('is_active');
  if (status === 'inactive') where.push('NOT is_active');

  const whereSql = where.join(' AND ');
  const countRows = await sql.query(`SELECT COUNT(*)::int AS total FROM products WHERE ${whereSql}`, params);
  const total = countRows[0].total;

  // Kolom sort diambil dari daftar tetap (bukan dari input), jadi aman dari SQL injection
  // "Pilihan admin": produk unggulan dulu sesuai urutan, sisanya urut nama
  const orderSql =
    sort === 'featured'
      ? 'featured_rank ASC NULLS LAST, lower(name) ASC, id ASC'
      : `${SORT_SQL[sort]} ${order === 'desc' ? 'DESC' : 'ASC'}, id ASC`;
  const rows = await sql.query(
    `SELECT ${COLUMNS}, ${RATING_COLUMNS} FROM products WHERE ${whereSql} ORDER BY ${orderSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, Math.max(0, (page - 1) * limit + offsetShift)],
  );

  return { total, items: rows.map(toProduct) };
}

async function getProduct(ownerId, id) {
  const sql = getSql();
  const rows = await sql.query(`SELECT ${COLUMNS}, ${RATING_COLUMNS} FROM products WHERE owner_id = $1 AND id = $2`, [ownerId, id]);
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

// ---------- Produk unggulan ----------

async function listFeatured(ownerId) {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${COLUMNS} FROM products WHERE owner_id = $1 AND featured_rank IS NOT NULL ORDER BY featured_rank, id`,
    [ownerId],
  );
  return rows.map(toProduct);
}

// ids sudah divalidasi (unik, maks 6, milik akun ini)
async function setFeatured(ownerId, ids) {
  const sql = getSql();
  await sql.transaction([
    sql`UPDATE products SET featured_rank = NULL WHERE owner_id = ${ownerId} AND featured_rank IS NOT NULL`,
    sql`
      UPDATE products p SET featured_rank = f.rank
      FROM jsonb_to_recordset(${JSON.stringify(ids.map((id, i) => ({ id, rank: i + 1 })))}::jsonb) AS f(id int, rank int)
      WHERE p.owner_id = ${ownerId} AND p.id = f.id
    `,
  ]);
  return listFeatured(ownerId);
}

async function countOwnedProducts(ownerId, ids) {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM products
    WHERE owner_id = ${ownerId} AND id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::int)
  `;
  return rows[0].n;
}

// ---------- Riwayat stok ----------

async function recordStockMovement(ownerId, product, change, reason, ref) {
  const sql = getSql();
  await sql`
    INSERT INTO stock_movements (owner_id, product_id, product_name, change, reason, ref, stock_after)
    VALUES (${ownerId}, ${product.id}, ${product.name}, ${change}, ${reason}, ${ref}, ${product.stock})
  `;
}

function toMovement(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    change: row.change,
    reason: row.reason,
    ref: row.ref,
    stockAfter: row.stock_after,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// Cursor = id baris terakhir yang sudah diterima (terbaru dulu)
async function listStockMovements(ownerId, { cursor, limit, productId, reason }) {
  const sql = getSql();
  const params = [ownerId];
  const where = ['owner_id = $1'];
  if (productId) {
    params.push(productId);
    where.push(`product_id = $${params.length}`);
  }
  if (reason) {
    params.push(reason);
    where.push(`reason = $${params.length}`);
  }
  const filterSql = where.join(' AND ');
  const countRows = await sql.query(`SELECT COUNT(*)::int AS total FROM stock_movements WHERE ${filterSql}`, params);
  const pageParams = [...params];
  let pageWhere = filterSql;
  if (cursor) {
    pageParams.push(cursor);
    pageWhere += ` AND id < $${pageParams.length}`;
  }
  pageParams.push(limit + 1);
  const rows = await sql.query(
    `SELECT * FROM stock_movements WHERE ${pageWhere} ORDER BY id DESC LIMIT $${pageParams.length}`,
    pageParams,
  );
  const items = rows.slice(0, limit).map(toMovement);
  return { total: countRows[0].total, items, nextCursor: rows.length > limit ? String(items[items.length - 1].id) : null };
}

module.exports = {
  listFeatured,
  setFeatured,
  countOwnedProducts,
  recordStockMovement,
  listStockMovements,
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
