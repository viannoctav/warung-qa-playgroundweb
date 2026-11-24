// Aturan validasi Produk dan parameter daftar produk (PRD Produk).
// Teks pesan harus sama persis dengan yang tampil di browser.
const { CATEGORY_VALUES } = require('../products/catalog');

const MESSAGES = {
  skuRequired: 'SKU wajib diisi',
  skuFormat: 'SKU harus berformat 3 huruf, tanda hubung, 4 angka (contoh KOP-0001)',
  skuTaken: 'SKU sudah dipakai',
  nameRequired: 'Nama produk wajib diisi',
  nameLength: 'Nama produk harus 3–80 karakter',
  categoryRequired: 'Pilih kategori',
  priceRequired: 'Harga wajib diisi',
  priceInteger: 'Harga harus berupa angka bulat',
  priceRange: 'Harga harus 1.000–10.000.000',
  stockRequired: 'Stok wajib diisi',
  stockInteger: 'Stok harus berupa angka bulat',
  stockRange: 'Stok harus 0–9.999',
  isActiveInvalid: 'Status aktif harus true atau false',
  descriptionLength: 'Deskripsi maksimal 500 karakter',
  descriptionType: 'Deskripsi harus berupa teks',
  formInvalid: 'Data produk belum valid. Periksa kembali isian Anda.',
  nothingToUpdate: 'Tidak ada field yang diubah',
  queryInvalid: 'Parameter tidak valid',
  idsInvalid: 'ids harus berisi 1–50 id produk',
};

const SKU_PATTERN = /^[A-Z]{3}-\d{4}$/;
const FIELDS = ['sku', 'name', 'category', 'price', 'stock', 'isActive', 'description'];

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function checkInteger(value, min, max, messages) {
  if (isBlank(value)) return messages.required;
  if (typeof value !== 'number' || !Number.isInteger(value)) return messages.integer;
  if (value < min || value > max) return messages.range;
  return null;
}

/**
 * Validasi body produk.
 * partial = true untuk PATCH: hanya field yang dikirim yang dicek.
 */
function validateProduct(body, { partial = false } = {}) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};
  const value = {};
  const has = (field) => !partial || input[field] !== undefined;

  if (partial && !FIELDS.some((field) => input[field] !== undefined)) {
    return { errors: {}, value, empty: true };
  }

  if (has('sku')) {
    const sku = typeof input.sku === 'string' ? input.sku.trim().toUpperCase() : '';
    if (!sku) errors.sku = MESSAGES.skuRequired;
    else if (!SKU_PATTERN.test(sku)) errors.sku = MESSAGES.skuFormat;
    value.sku = sku;
  }

  if (has('name')) {
    const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
    if (!name) errors.name = MESSAGES.nameRequired;
    else if (name.length < 3 || name.length > 80) errors.name = MESSAGES.nameLength;
    value.name = name;
  }

  if (has('category')) {
    if (!CATEGORY_VALUES.includes(input.category)) errors.category = MESSAGES.categoryRequired;
    value.category = input.category;
  }

  if (has('price')) {
    const error = checkInteger(input.price, 1000, 10000000, {
      required: MESSAGES.priceRequired,
      integer: MESSAGES.priceInteger,
      range: MESSAGES.priceRange,
    });
    if (error) errors.price = error;
    value.price = input.price;
  }

  if (has('stock')) {
    const error = checkInteger(input.stock, 0, 9999, {
      required: MESSAGES.stockRequired,
      integer: MESSAGES.stockInteger,
      range: MESSAGES.stockRange,
    });
    if (error) errors.stock = error;
    value.stock = input.stock;
  }

  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') errors.isActive = MESSAGES.isActiveInvalid;
    value.isActive = input.isActive;
  } else if (!partial) {
    value.isActive = true;
  }

  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== 'string') errors.description = MESSAGES.descriptionType;
    else if (input.description.length > 500) errors.description = MESSAGES.descriptionLength;
    value.description = typeof input.description === 'string' ? input.description.trim() : '';
  } else if (!partial || input.description === null) {
    value.description = '';
  }

  return { errors, value, empty: false };
}

const SORTS = ['name', 'price', 'stock', 'createdAt'];
const LIMITS = [5, 10, 20, 50];

// Validasi query string GET /products. Semua nilai datang sebagai teks.
function validateListQuery(query, { limits = LIMITS, defaultLimit = '10' } = {}) {
  const q = query && typeof query === 'object' ? query : {};
  const errors = {};
  const read = (key) => (q[key] === undefined ? '' : q[key]);

  const search = read('search');
  if (typeof search !== 'string') errors.search = 'Pencarian harus berupa teks';
  else if (search.length > 100) errors.search = 'Pencarian maksimal 100 karakter';

  const category = read('category');
  if (category !== '' && !CATEGORY_VALUES.includes(category)) errors.category = 'Kategori tidak dikenal';

  const status = read('status');
  if (status !== '' && status !== 'active' && status !== 'inactive') errors.status = 'Status harus active atau inactive';

  const sort = read('sort') || 'name';
  if (!SORTS.includes(sort)) errors.sort = 'Sort harus name, price, stock, atau createdAt';

  const order = read('order') || 'asc';
  if (order !== 'asc' && order !== 'desc') errors.order = 'Order harus asc atau desc';

  const pageRaw = read('page') || '1';
  const page = Number(pageRaw);
  if (typeof pageRaw !== 'string' || !/^\d+$/.test(pageRaw) || page < 1) errors.page = 'Halaman harus angka bulat mulai dari 1';

  const limitRaw = read('limit') || defaultLimit;
  const limit = Number(limitRaw);
  if (typeof limitRaw !== 'string' || !limits.includes(limit) || !/^\d+$/.test(limitRaw)) {
    errors.limit = `Limit harus ${limits.slice(0, -1).join(', ')}, atau ${limits[limits.length - 1]}`;
  }

  return {
    errors,
    value: {
      search: typeof search === 'string' ? search.trim() : '',
      category,
      status,
      sort,
      order,
      page,
      limit,
    },
  };
}

// Validasi body bulk-delete: { ids: [1, 2, 3] }
function validateIds(body) {
  const ids = body && Array.isArray(body.ids) ? body.ids : null;
  if (!ids || ids.length < 1 || ids.length > 50 || !ids.every((id) => Number.isInteger(id) && id > 0)) {
    return { error: MESSAGES.idsInvalid, ids: [] };
  }
  return { error: null, ids: [...new Set(ids)] };
}

module.exports = { validateProduct, validateListQuery, validateIds, MESSAGES, SORTS, LIMITS };
