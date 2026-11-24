// Unit test Produk: validasi, hak akses, katalog per akun (tanpa database asli).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createProductService } = require('../src/services/product-service');
const { validateProduct, validateListQuery, validateIds, MESSAGES } = require('../src/validation/product');
const { SEED_PRODUCTS } = require('../src/products/catalog');
const { escapeLike } = require('../src/repositories/products');
const { spec } = require('../src/openapi');

const ADMIN = { id: 1, username: 'admin_user', role: 'admin' };
const OTHER_ADMIN = { id: 2, username: 'rina_qa', role: 'admin' };
const VIEWER = { id: 3, username: 'standard_user', role: 'user' };

// Database palsu di memori yang meniru repositories/products.js
function createFakeRepo() {
  let nextId = 1;
  const rows = [];
  const seeded = new Set();
  const seed = (ownerId) => {
    for (const p of SEED_PRODUCTS) rows.push({ id: nextId++, ownerId, ...p, createdAt: 't', updatedAt: 't' });
  };
  const strip = ({ ownerId, imageData, imageType, ...p }) => ({ ...p, imageUrl: imageData ? `/api/v1/products/${p.id}/image?v=1` : null });
  const repo = {
    rows,
    ensureCatalog: async (ownerId) => {
      if (!seeded.has(ownerId)) {
        seeded.add(ownerId);
        seed(ownerId);
      }
    },
    resetCatalog: async (ownerId) => {
      for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].ownerId === ownerId) rows.splice(i, 1);
      seed(ownerId);
      seeded.add(ownerId);
    },
    listProducts: async (ownerId, q) => {
      let items = rows.filter((r) => r.ownerId === ownerId);
      if (q.search) items = items.filter((r) => `${r.name} ${r.sku}`.toLowerCase().includes(q.search.toLowerCase()));
      if (q.category) items = items.filter((r) => r.category === q.category);
      if (q.status) items = items.filter((r) => r.isActive === (q.status === 'active'));
      const key = q.sort === 'createdAt' ? 'id' : q.sort;
      items.sort((a, b) => {
        const x = key === 'name' ? a.name.toLowerCase() : a[key];
        const y = key === 'name' ? b.name.toLowerCase() : b[key];
        return (x < y ? -1 : x > y ? 1 : a.id - b.id) * (q.order === 'desc' ? -1 : 1);
      });
      return { total: items.length, items: items.slice((q.page - 1) * q.limit, q.page * q.limit).map(strip) };
    },
    getProduct: async (ownerId, id) => {
      const row = rows.find((r) => r.ownerId === ownerId && r.id === id);
      return row ? strip(row) : null;
    },
    isSkuTaken: async (ownerId, sku, exceptId) => rows.some((r) => r.ownerId === ownerId && r.sku === sku && r.id !== exceptId),
    createProduct: async (ownerId, p) => {
      const row = { id: nextId++, ownerId, ...p, createdAt: 't', updatedAt: 't' };
      rows.push(row);
      return strip(row);
    },
    updateProduct: async (ownerId, id, fields) => {
      const row = rows.find((r) => r.ownerId === ownerId && r.id === id);
      if (!row) return null;
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) row[k] = v;
      return strip(row);
    },
    deleteProduct: async (ownerId, id) => {
      const i = rows.findIndex((r) => r.ownerId === ownerId && r.id === id);
      if (i < 0) return false;
      rows.splice(i, 1);
      return true;
    },
    deleteProducts: async (ownerId, ids) => {
      let n = 0;
      for (const id of ids) if (await repo.deleteProduct(ownerId, id)) n += 1;
      return n;
    },
    setImage: async (ownerId, id, data, type) => {
      const row = rows.find((r) => r.ownerId === ownerId && r.id === id);
      if (!row) return null;
      Object.assign(row, { imageData: data, imageType: type });
      return strip(row);
    },
    deleteImage: async (ownerId, id) => {
      const row = rows.find((r) => r.ownerId === ownerId && r.id === id);
      if (!row) return null;
      Object.assign(row, { imageData: null, imageType: null });
      return strip(row);
    },
    getImage: async (id) => {
      const row = rows.find((r) => r.id === id && r.imageData);
      return row ? { data: row.imageData, type: row.imageType } : null;
    },
  };
  return repo;
}

function setup() {
  const repo = createFakeRepo();
  return { repo, svc: createProductService(repo) };
}

const validInput = (o = {}) => ({ sku: 'KOP-0099', name: 'Kopi Mandailing 250 g', category: 'kopi', price: 75000, stock: 20, ...o });

// ---------- Validasi ----------

test('produk valid lolos, isActive bawaan true, deskripsi bawaan kosong', () => {
  const { errors, value } = validateProduct(validInput({ sku: ' kop-0099 ' }));
  assert.deepEqual(errors, {});
  assert.equal(value.sku, 'KOP-0099');
  assert.equal(value.isActive, true);
  assert.equal(value.description, '');
});

test('produk kosong memunculkan semua error wajib', () => {
  const { errors } = validateProduct({});
  assert.deepEqual(errors, {
    sku: MESSAGES.skuRequired,
    name: MESSAGES.nameRequired,
    category: MESSAGES.categoryRequired,
    price: MESSAGES.priceRequired,
    stock: MESSAGES.stockRequired,
  });
});

test('SKU, nama, kategori: format dan batas', () => {
  assert.equal(validateProduct(validInput({ sku: 'KO-001' })).errors.sku, MESSAGES.skuFormat);
  assert.equal(validateProduct(validInput({ sku: 'KOPI-0001' })).errors.sku, MESSAGES.skuFormat);
  assert.equal(validateProduct(validInput({ name: 'Ko' })).errors.name, MESSAGES.nameLength);
  assert.equal(validateProduct(validInput({ name: 'a'.repeat(81) })).errors.name, MESSAGES.nameLength);
  assert.equal(validateProduct(validInput({ name: 'a'.repeat(80) })).errors.name, undefined);
  assert.equal(validateProduct(validInput({ category: 'rokok' })).errors.category, MESSAGES.categoryRequired);
});

test('harga & stok: angka bulat dan batas tepat', () => {
  const e = (o) => validateProduct(validInput(o)).errors;
  assert.equal(e({ price: 1000 }).price, undefined);
  assert.equal(e({ price: 999 }).price, MESSAGES.priceRange);
  assert.equal(e({ price: 10000000 }).price, undefined);
  assert.equal(e({ price: 10000001 }).price, MESSAGES.priceRange);
  assert.equal(e({ price: '75000' }).price, MESSAGES.priceInteger);
  assert.equal(e({ price: 7500.5 }).price, MESSAGES.priceInteger);
  assert.equal(e({ stock: 0 }).stock, undefined);
  assert.equal(e({ stock: -1 }).stock, MESSAGES.stockRange);
  assert.equal(e({ stock: 9999 }).stock, undefined);
  assert.equal(e({ stock: 10000 }).stock, MESSAGES.stockRange);
  assert.equal(e({ stock: null }).stock, MESSAGES.stockRequired);
});

test('isActive dan deskripsi', () => {
  assert.equal(validateProduct(validInput({ isActive: 'ya' })).errors.isActive, MESSAGES.isActiveInvalid);
  assert.equal(validateProduct(validInput({ description: 'a'.repeat(500) })).errors.description, undefined);
  assert.equal(validateProduct(validInput({ description: 'a'.repeat(501) })).errors.description, MESSAGES.descriptionLength);
  assert.equal(validateProduct(validInput({ description: 123 })).errors.description, MESSAGES.descriptionType);
});

test('PATCH hanya mengecek field yang dikirim; body tanpa field dikenal ditolak', () => {
  assert.deepEqual(validateProduct({ stock: 5 }, { partial: true }).errors, {});
  assert.deepEqual(validateProduct({ stock: 5 }, { partial: true }).value, { stock: 5 });
  assert.equal(validateProduct({ price: 1 }, { partial: true }).errors.price, MESSAGES.priceRange);
  assert.equal(validateProduct({ foo: 1 }, { partial: true }).empty, true);
});

test('query daftar produk: nilai bawaan dan nilai yang ditolak', () => {
  assert.deepEqual(validateListQuery({}).value, { search: '', category: '', status: '', sort: 'name', order: 'asc', page: 1, limit: 10 });
  const bad = validateListQuery({ category: 'rokok', status: 'all', sort: 'id', order: 'up', page: '0', limit: '7' }).errors;
  assert.deepEqual(Object.keys(bad).sort(), ['category', 'limit', 'order', 'page', 'sort', 'status']);
  assert.equal(validateListQuery({ page: '1.5' }).errors.page, 'Halaman harus angka bulat mulai dari 1');
  assert.equal(validateListQuery({ page: ['1', '2'] }).errors.page, 'Halaman harus angka bulat mulai dari 1');
  assert.equal(validateListQuery({ search: 'a'.repeat(101) }).errors.search, 'Pencarian maksimal 100 karakter');
});

test('ids bulk-delete: 1–50 bilangan bulat positif', () => {
  assert.equal(validateIds({ ids: [] }).error, MESSAGES.idsInvalid);
  assert.equal(validateIds({ ids: [1, 'a'] }).error, MESSAGES.idsInvalid);
  assert.equal(validateIds({ ids: Array.from({ length: 51 }, (_, i) => i + 1) }).error, MESSAGES.idsInvalid);
  assert.deepEqual(validateIds({ ids: [3, 3, 4] }).ids, [3, 4]);
});

test('escapeLike membuat % dan _ dicari apa adanya', () => {
  assert.equal(escapeLike('50%_off\\'), '50\\%\\_off\\\\');
});

// ---------- Service: katalog per akun & hak akses ----------

test('akun baru langsung punya 24 produk, 10 per halaman', async () => {
  const { svc } = setup();
  const res = await svc.list(ADMIN, {});
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 10);
  assert.deepEqual(res.body.meta, { page: 1, limit: 10, total: 24, totalPages: 3 });
  assert.equal(res.body.data[0].name, 'Air Mineral 600 ml');
});

test('filter, sort, dan halaman di luar jangkauan', async () => {
  const { svc } = setup();
  const kopi = await svc.list(ADMIN, { category: 'kopi', sort: 'price', order: 'desc' });
  assert.equal(kopi.body.meta.total, 5);
  assert.equal(kopi.body.data[0].sku, 'KOP-0004');
  const inactive = await svc.list(ADMIN, { status: 'inactive' });
  assert.equal(inactive.body.meta.total, 2);
  const far = await svc.list(ADMIN, { page: '99' });
  assert.deepEqual(far.body.data, []);
  assert.equal(far.body.meta.totalPages, 3);
  const bad = await svc.list(ADMIN, { limit: '7' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.fields.limit, 'Limit harus 5, 10, 20, atau 50');
});

test('role user tidak bisa mengelola produk: semua endpoint /products 403', async () => {
  const { svc } = setup();
  const first = (await svc.list(ADMIN, {})).body.data[0];
  for (const res of [
    await svc.list(VIEWER, {}),
    await svc.get(VIEWER, String(first.id)),
    await svc.create(VIEWER, validInput()),
    await svc.replace(VIEWER, String(first.id), validInput()),
    await svc.patch(VIEWER, String(first.id), { stock: 1 }),
    await svc.remove(VIEWER, String(first.id)),
    await svc.bulkDelete(VIEWER, { ids: [first.id] }),
    await svc.setImage(VIEWER, String(first.id), { buffer: Buffer.from('x'), contentType: 'image/png' }),
    await svc.deleteImage(VIEWER, String(first.id)),
  ]) {
    assert.equal(res.status, 403);
    assert.equal(res.body.error.message, 'Hanya akun admin yang bisa mengelola produk.');
  }
});

test('katalog terpisah: produk akun lain menghasilkan 404', async () => {
  const { svc } = setup();
  const mine = (await svc.list(ADMIN, {})).body.data[0];
  await svc.list(OTHER_ADMIN, {});
  assert.equal((await svc.get(OTHER_ADMIN, String(mine.id))).status, 404);
  assert.equal((await svc.patch(OTHER_ADMIN, String(mine.id), { stock: 1 })).status, 404);
  assert.equal((await svc.remove(OTHER_ADMIN, String(mine.id))).status, 404);
  assert.equal((await svc.get(ADMIN, String(mine.id))).status, 200);
});

test('id tidak valid menghasilkan 404', async () => {
  const { svc } = setup();
  for (const id of ['abc', '0', '-1', '1.5', '99999999999']) {
    assert.equal((await svc.get(ADMIN, id)).status, 404, id);
  }
});

test('tambah produk: 201, lalu SKU yang sama 409', async () => {
  const { svc } = setup();
  const created = await svc.create(ADMIN, validInput());
  assert.equal(created.status, 201);
  assert.equal(created.body.data.sku, 'KOP-0099');
  const dup = await svc.create(ADMIN, validInput({ sku: 'kop-0099' }));
  assert.equal(dup.status, 409);
  assert.deepEqual(dup.body.error.fields, { sku: 'SKU sudah dipakai' });
  const seedDup = await svc.create(ADMIN, validInput({ sku: 'KOP-0001' }));
  assert.equal(seedDup.status, 409);
  const sameSkuOtherAccount = await svc.create(OTHER_ADMIN, validInput());
  assert.equal(sameSkuOtherAccount.status, 201);
});

test('tambah produk tidak valid: 400 dengan semua field', async () => {
  const { svc } = setup();
  const res = await svc.create(ADMIN, { sku: 'x' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, 'Data produk belum valid. Periksa kembali isian Anda.');
  assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['category', 'name', 'price', 'sku', 'stock']);
});

test('PUT mengganti semua field, PATCH sebagian, SKU milik produk lain 409', async () => {
  const { svc } = setup();
  const [a, b] = (await svc.list(ADMIN, {})).body.data;
  const put = await svc.replace(ADMIN, String(a.id), validInput({ sku: a.sku, name: 'Nama Baru Produk' }));
  assert.equal(put.status, 200);
  assert.equal(put.body.data.name, 'Nama Baru Produk');
  const patch = await svc.patch(ADMIN, String(a.id), { stock: 0, isActive: false });
  assert.equal(patch.body.data.stock, 0);
  assert.equal(patch.body.data.isActive, false);
  assert.equal(patch.body.data.name, 'Nama Baru Produk');
  assert.equal((await svc.patch(ADMIN, String(a.id), { sku: b.sku })).status, 409);
  assert.equal((await svc.patch(ADMIN, String(a.id), {})).body.error.message, 'Tidak ada field yang diubah');
  assert.equal((await svc.replace(ADMIN, String(a.id), { stock: 1 })).status, 400);
});

test('hapus satu (204) dan hapus banyak (jumlah yang benar-benar terhapus)', async () => {
  const { svc } = setup();
  const items = (await svc.list(ADMIN, {})).body.data;
  assert.equal((await svc.remove(ADMIN, String(items[0].id))).status, 204);
  assert.equal((await svc.remove(ADMIN, String(items[0].id))).status, 404);
  const bulk = await svc.bulkDelete(ADMIN, { ids: [items[1].id, items[2].id, 9999] });
  assert.deepEqual(bulk.body, { data: { deleted: 2 } });
  assert.equal((await svc.list(ADMIN, {})).body.meta.total, 21);
  assert.equal((await svc.bulkDelete(ADMIN, { ids: [] })).status, 400);
});

test('reset mengembalikan 24 produk walaupun semuanya sudah dihapus', async () => {
  const { svc, repo } = setup();
  const ids = (await svc.list(ADMIN, { limit: '50' })).body.data.map((p) => p.id);
  await svc.bulkDelete(ADMIN, { ids });
  assert.equal((await svc.list(ADMIN, {})).body.meta.total, 0);
  await repo.resetCatalog(ADMIN.id);
  assert.equal((await svc.list(ADMIN, {})).body.meta.total, 24);
});

test('produk awal: 24 buah, SKU unik dan valid, 2 nonaktif, 2 stok 0', () => {
  assert.equal(SEED_PRODUCTS.length, 24);
  assert.equal(new Set(SEED_PRODUCTS.map((p) => p.sku)).size, 24);
  for (const p of SEED_PRODUCTS) assert.deepEqual(validateProduct(p).errors, {}, p.sku);
  assert.equal(SEED_PRODUCTS.filter((p) => !p.isActive).length, 2);
  assert.equal(SEED_PRODUCTS.filter((p) => p.stock === 0).length, 2);
});

test('dokumentasi OpenAPI memuat semua endpoint', () => {
  for (const path of ['/health', '/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/me', '/api/v1/reset', '/api/v1/categories', '/api/v1/products', '/api/v1/products/{id}', '/api/v1/products/bulk-delete']) {
    assert.ok(spec.paths[path], path);
  }
});

// ---------- Gambar produk ----------

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);

test('upload gambar PNG/JPG berhasil, lalu bisa diambil publik dan dihapus', async () => {
  const { svc } = setup();
  const first = (await svc.list(ADMIN, {})).body.data[0];
  assert.equal(first.imageUrl, null);

  const up = await svc.setImage(ADMIN, String(first.id), { buffer: PNG, contentType: 'image/png' });
  assert.equal(up.status, 200);
  assert.match(up.body.data.imageUrl, new RegExp(`^/api/v1/products/${first.id}/image`));

  const got = await svc.getImage(String(first.id));
  assert.equal(got.status, 200);
  assert.equal(got.image.type, 'image/png');
  assert.ok(got.image.buffer.equals(PNG));

  assert.equal((await svc.setImage(ADMIN, String(first.id), { buffer: JPG, contentType: 'image/jpeg; charset=x' })).status, 200);
  assert.equal((await svc.deleteImage(ADMIN, String(first.id))).status, 204);
  assert.equal((await svc.getImage(String(first.id))).status, 404);
  assert.equal((await svc.deleteImage(ADMIN, String(first.id))).body.error.message, 'Gambar tidak ditemukan');
});

test('upload gambar ditolak: format, file kosong, isi palsu, terlalu besar, produk akun lain', async () => {
  const { svc } = setup();
  const first = (await svc.list(ADMIN, {})).body.data[0];
  const id = String(first.id);
  const gif = await svc.setImage(ADMIN, id, { buffer: undefined, contentType: 'image/gif' });
  assert.equal(gif.status, 415);
  assert.equal(gif.body.error.message, 'Format gambar harus JPG, PNG, atau WEBP');
  assert.equal((await svc.setImage(ADMIN, id, { buffer: Buffer.alloc(0), contentType: 'image/png' })).body.error.message, 'File gambar wajib dikirim');
  const fake = await svc.setImage(ADMIN, id, { buffer: Buffer.from('bukan gambar'), contentType: 'image/png' });
  assert.equal(fake.status, 400);
  assert.equal(fake.body.error.message, 'Isi file tidak cocok dengan format gambar');
  const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
  assert.equal((await svc.setImage(ADMIN, id, { buffer: big, contentType: 'image/png' })).status, 413);
  await svc.list(OTHER_ADMIN, {});
  assert.equal((await svc.setImage(OTHER_ADMIN, id, { buffer: PNG, contentType: 'image/png' })).status, 404);
  assert.equal((await svc.getImage('abc')).status, 404);
});
