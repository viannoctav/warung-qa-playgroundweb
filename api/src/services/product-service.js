const { CATEGORIES } = require('../products/catalog');
const { validateProduct, validateListQuery, validateIds, MESSAGES } = require('../validation/product');

const FORBIDDEN_MESSAGE = 'Hanya akun admin yang bisa mengelola produk.';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_MESSAGES = {
  required: 'File gambar wajib dikirim',
  type: 'Format gambar harus JPG, PNG, atau WEBP',
  tooLarge: 'Ukuran gambar maksimal 2 MB',
  mismatch: 'Isi file tidak cocok dengan format gambar',
  notFound: 'Gambar tidak ditemukan',
};

// Cek "tanda tangan" byte awal file, supaya file .txt yang diganti namanya jadi .png tetap ditolak
function matchesSignature(buffer, type) {
  if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/webp') return buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
  return false;
}
const NOT_FOUND_MESSAGE = 'Produk tidak ditemukan';

function fail(status, code, message, fields) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return { status, body: { error } };
}

const forbidden = () => fail(403, 'FORBIDDEN', FORBIDDEN_MESSAGE);
const notFound = () => fail(404, 'NOT_FOUND', NOT_FOUND_MESSAGE);
const skuConflict = () => fail(409, 'ALREADY_EXISTS', MESSAGES.skuTaken, { sku: MESSAGES.skuTaken });

function canManage(user) {
  return user.role === 'admin';
}

function parseId(raw) {
  const text = String(raw);
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

/**
 * Logika Produk, terpisah dari Express dan database supaya bisa di-unit test.
 * Urutan pengecekan: 403 (role) → 404 (id) → 400 (validasi) → 409 (SKU dipakai).
 */
function createProductService(deps) {
  async function categories() {
    return { status: 200, body: { data: CATEGORIES } };
  }

  async function list(user, query) {
    if (!canManage(user)) return forbidden();
    const { errors, value } = validateListQuery(query);
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', MESSAGES.queryInvalid, errors);

    await deps.ensureCatalog(user.id);
    const { total, items } = await deps.listProducts(user.id, value);
    const totalPages = Math.max(1, Math.ceil(total / value.limit));
    return {
      status: 200,
      body: { data: items, meta: { page: value.page, limit: value.limit, total, totalPages } },
    };
  }

  async function get(user, rawId) {
    if (!canManage(user)) return forbidden();
    const id = parseId(rawId);
    if (!id) return notFound();
    await deps.ensureCatalog(user.id);
    const product = await deps.getProduct(user.id, id);
    if (!product) return notFound();
    return { status: 200, body: { data: product } };
  }

  async function saveWithConflictCheck(user, sku, exceptId, save) {
    if (sku !== undefined && (await deps.isSkuTaken(user.id, sku, exceptId))) return skuConflict();
    try {
      return await save();
    } catch (err) {
      // Dua request bersamaan dengan SKU yang sama: yang kedua ditolak database (unique)
      if (err && err.code === '23505') return skuConflict();
      throw err;
    }
  }

  async function create(user, body) {
    if (!canManage(user)) return forbidden();
    const { errors, value } = validateProduct(body);
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', MESSAGES.formInvalid, errors);

    await deps.ensureCatalog(user.id);
    return saveWithConflictCheck(user, value.sku, 0, async () => {
      const product = await deps.createProduct(user.id, value);
      return { status: 201, body: { data: product } };
    });
  }

  async function update(user, rawId, body, { partial }) {
    if (!canManage(user)) return forbidden();
    const id = parseId(rawId);
    if (!id) return notFound();

    await deps.ensureCatalog(user.id);
    const existing = await deps.getProduct(user.id, id);
    if (!existing) return notFound();

    const { errors, value, empty } = validateProduct(body, { partial });
    if (empty) return fail(400, 'VALIDATION_ERROR', MESSAGES.nothingToUpdate);
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', MESSAGES.formInvalid, errors);

    return saveWithConflictCheck(user, value.sku, id, async () => {
      const product = await deps.updateProduct(user.id, id, value);
      if (!product) return notFound();
      return { status: 200, body: { data: product } };
    });
  }

  async function remove(user, rawId) {
    if (!canManage(user)) return forbidden();
    const id = parseId(rawId);
    if (!id) return notFound();
    await deps.ensureCatalog(user.id);
    const deleted = await deps.deleteProduct(user.id, id);
    if (!deleted) return notFound();
    return { status: 204 };
  }

  async function bulkDelete(user, body) {
    if (!canManage(user)) return forbidden();
    const { error, ids } = validateIds(body);
    if (error) return fail(400, 'VALIDATION_ERROR', error, { ids: error });
    await deps.ensureCatalog(user.id);
    const deleted = await deps.deleteProducts(user.id, ids);
    return { status: 200, body: { data: { deleted } } };
  }

  // upload: { buffer, contentType } — buffer undefined kalau Content-Type bukan gambar
  async function setImage(user, rawId, upload) {
    if (!canManage(user)) return forbidden();
    const id = parseId(rawId);
    if (!id) return notFound();
    await deps.ensureCatalog(user.id);
    if (!(await deps.getProduct(user.id, id))) return notFound();

    const type = String(upload.contentType || '').split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPES.includes(type)) return fail(415, 'UNSUPPORTED_MEDIA_TYPE', IMAGE_MESSAGES.type);
    const buffer = upload.buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return fail(400, 'VALIDATION_ERROR', IMAGE_MESSAGES.required);
    if (buffer.length > IMAGE_MAX_BYTES) return fail(413, 'PAYLOAD_TOO_LARGE', IMAGE_MESSAGES.tooLarge);
    if (!matchesSignature(buffer, type)) return fail(400, 'VALIDATION_ERROR', IMAGE_MESSAGES.mismatch);

    const product = await deps.setImage(user.id, id, buffer.toString('base64'), type);
    if (!product) return notFound();
    return { status: 200, body: { data: product } };
  }

  async function deleteImage(user, rawId) {
    if (!canManage(user)) return forbidden();
    const id = parseId(rawId);
    if (!id) return notFound();
    await deps.ensureCatalog(user.id);
    const existing = await deps.getProduct(user.id, id);
    if (!existing) return notFound();
    if (!existing.imageUrl) return fail(404, 'NOT_FOUND', IMAGE_MESSAGES.notFound);
    await deps.deleteImage(user.id, id);
    return { status: 204 };
  }

  // Publik: mengembalikan { status, image } atau error
  async function getImage(rawId) {
    const id = parseId(rawId);
    const image = id ? await deps.getImage(id) : null;
    if (!image) return fail(404, 'NOT_FOUND', IMAGE_MESSAGES.notFound);
    return { status: 200, image: { type: image.type, buffer: Buffer.from(image.data, 'base64') } };
  }

  return {
    setImage,
    deleteImage,
    getImage,
    categories,
    list,
    get,
    create,
    replace: (user, id, body) => update(user, id, body, { partial: false }),
    patch: (user, id, body) => update(user, id, body, { partial: true }),
    remove,
    bulkDelete,
  };
}

module.exports = { createProductService, FORBIDDEN_MESSAGE, NOT_FOUND_MESSAGE, IMAGE_MESSAGES, IMAGE_TYPES, IMAGE_MAX_BYTES };
