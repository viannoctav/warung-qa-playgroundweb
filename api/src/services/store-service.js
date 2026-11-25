const { validateListQuery } = require('../validation/product');
const { validateCheckout, isQuantity, MESSAGES } = require('../validation/checkout');
const { SHIPPING_METHODS, COD_MAX_TOTAL, computeSummary, formatRupiah } = require('../store/pricing');
const { publicOrder } = require('./order-service');

const STORE_LIMITS = [12, 24, 48];

const TEXT = {
  productNotFound: 'Produk tidak ditemukan',
  notInCart: 'Produk tidak ada di keranjang',
  orderNotFound: 'Pesanan tidak ditemukan',
  storeMissing: 'Toko belum tersedia. Jalankan npm run db:setup.',
  cartEmpty: 'Keranjang masih kosong',
  outOfStock: 'Stok habis',
  inactive: 'Produk sudah tidak dijual',
  cartProblem: 'Ada produk di keranjang yang stoknya tidak cukup atau sudah tidak dijual. Periksa keranjang Anda.',
  stockChanged: 'Stok berubah saat checkout. Periksa keranjang Anda lalu coba lagi.',
  codLimit: `COD hanya untuk total maksimal ${formatRupiah(COD_MAX_TOTAL)}`,
  voucherInvalid: 'Voucher tidak bisa dipakai',
  paymentNotFound: 'Pembayaran WarungPay tidak ditemukan',
  paymentUsed: 'Pembayaran WarungPay ini sudah dipakai untuk pesanan lain',
  paymentAmount: 'Nominal pembayaran tidak sama dengan total pesanan',
};

function fail(status, code, message, fields) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return { status, body: { error } };
}

function stockMessage(stock) {
  return stock > 0 ? `Stok tidak cukup. Sisa stok: ${stock}` : TEXT.outOfStock;
}

function parseId(raw) {
  const text = String(raw);
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

// Masalah satu baris keranjang (null kalau aman dibeli)
function lineProblem(product, quantity) {
  if (!product.isActive) return TEXT.inactive;
  if (product.stock < quantity) return stockMessage(product.stock);
  return null;
}

/**
 * Logika Toko: katalog untuk pembeli, keranjang, checkout, dan pesanan.
 * Role admin belanja di tokonya sendiri; role user belanja di toko milik admin_user.
 */
function createStoreService(deps) {
  async function storeOwnerId(user) {
    if (user.role === 'admin') return user.id;
    return deps.findDemoStoreOwnerId();
  }

  // Menjalankan fn(ownerId) setelah katalog toko dipastikan ada
  async function withStore(user, fn) {
    const ownerId = await storeOwnerId(user);
    if (!ownerId) return fail(503, 'STORE_UNAVAILABLE', TEXT.storeMissing);
    await deps.ensureCatalog(ownerId);
    return fn(ownerId);
  }

  async function findStoreProduct(ownerId, rawId) {
    const id = parseId(rawId);
    if (!id) return null;
    const product = await deps.getProduct(ownerId, id);
    return product && product.isActive ? product : null;
  }

  async function cartData(user, ownerId) {
    const lines = await deps.getCartItems(user.id, ownerId);
    const items = lines.map(({ product, quantity }) => ({
      product,
      quantity,
      subtotal: product.price * quantity,
      problem: lineProblem(product, quantity),
    }));
    const summary = computeSummary(
      items.map((item) => ({ price: item.product.price, quantity: item.quantity })),
      null,
      null,
    );
    return { items, itemCount: summary.itemCount, subtotal: summary.subtotal, hasProblem: items.some((i) => i.problem) };
  }

  const cartResult = async (user, ownerId, status = 200) => ({
    status,
    body: { data: await cartData(user, ownerId) },
  });

  // ---------- Katalog toko ----------

  async function listProducts(user, query) {
    const { errors, value } = validateListQuery(query, { limits: STORE_LIMITS, defaultLimit: '12', extraSorts: ['featured'] });
    delete errors.status; // pembeli selalu hanya melihat produk aktif
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', 'Parameter tidak valid', errors);

    return withStore(user, async (ownerId) => {
      const { total, items } = await deps.listProducts(ownerId, { ...value, status: 'active' });
      const totalPages = Math.max(1, Math.ceil(total / value.limit));
      return {
        status: 200,
        body: { data: items, meta: { page: value.page, limit: value.limit, total, totalPages } },
      };
    });
  }

  async function getProduct(user, rawId) {
    return withStore(user, async (ownerId) => {
      const product = await findStoreProduct(ownerId, rawId);
      if (!product) return fail(404, 'NOT_FOUND', TEXT.productNotFound);
      return { status: 200, body: { data: product } };
    });
  }

  // ---------- Keranjang ----------

  async function getCart(user) {
    return withStore(user, (ownerId) => cartResult(user, ownerId));
  }

  async function addItem(user, body) {
    const input = body && typeof body === 'object' ? body : {};
    const quantity = input.quantity === undefined ? 1 : input.quantity;
    const fields = {};
    if (!Number.isInteger(input.productId) || input.productId < 1) fields.productId = MESSAGES.productId;
    if (!isQuantity(quantity)) fields.quantity = MESSAGES.quantity;
    if (Object.keys(fields).length > 0) return fail(400, 'VALIDATION_ERROR', Object.values(fields)[0], fields);

    return withStore(user, async (ownerId) => {
      const product = await findStoreProduct(ownerId, input.productId);
      if (!product) return fail(404, 'NOT_FOUND', TEXT.productNotFound);

      const total = (await deps.getCartQuantity(user.id, product.id)) + quantity;
      if (total > 99) return fail(422, 'QUANTITY_LIMIT', 'Maksimal 99 per produk di keranjang', { quantity: MESSAGES.quantity });
      if (total > product.stock) {
        const message = stockMessage(product.stock);
        return fail(422, 'INSUFFICIENT_STOCK', message, { quantity: message });
      }
      await deps.setCartQuantity(user.id, product.id, total);
      return cartResult(user, ownerId, 201);
    });
  }

  async function updateItem(user, rawProductId, body) {
    const quantity = body && typeof body === 'object' ? body.quantity : undefined;
    if (!isQuantity(quantity)) return fail(400, 'VALIDATION_ERROR', MESSAGES.quantity, { quantity: MESSAGES.quantity });

    return withStore(user, async (ownerId) => {
      const productId = parseId(rawProductId);
      const current = productId ? await deps.getCartQuantity(user.id, productId) : 0;
      if (!current) return fail(404, 'NOT_FOUND', TEXT.notInCart);

      const product = await deps.getProduct(ownerId, productId);
      if (!product) return fail(404, 'NOT_FOUND', TEXT.notInCart);
      // Mengurangi jumlah selalu boleh; menambah dicek terhadap stok
      if (quantity > current && quantity > product.stock) {
        const message = stockMessage(product.stock);
        return fail(422, 'INSUFFICIENT_STOCK', message, { quantity: message });
      }
      await deps.setCartQuantity(user.id, productId, quantity);
      return cartResult(user, ownerId);
    });
  }

  async function removeItem(user, rawProductId) {
    return withStore(user, async (ownerId) => {
      const productId = parseId(rawProductId);
      const removed = productId ? await deps.removeCartItem(user.id, productId) : false;
      if (!removed) return fail(404, 'NOT_FOUND', TEXT.notInCart);
      return cartResult(user, ownerId);
    });
  }

  async function clearCart(user) {
    await deps.clearCart(user.id);
    return { status: 204 };
  }

  // ---------- Checkout ----------

  // Hitung ringkasan; null kalau keranjang kosong
  async function summarize(user, ownerId, shippingMethod, voucherCode, giftCardCode) {
    const cart = await cartData(user, ownerId);
    if (cart.items.length === 0) return null;
    const summary = computeSummary(
      cart.items.map((item) => ({ price: item.product.price, quantity: item.quantity })),
      shippingMethod,
      voucherCode,
      giftCardCode,
    );
    return { cart, summary };
  }

  async function preview(user, body) {
    const input = body && typeof body === 'object' ? body : {};
    const shippingMethod = input.shippingMethod === undefined ? 'reguler' : input.shippingMethod;
    if (!Object.prototype.hasOwnProperty.call(SHIPPING_METHODS, shippingMethod)) {
      return fail(400, 'VALIDATION_ERROR', MESSAGES.shippingMethod, { shippingMethod: MESSAGES.shippingMethod });
    }

    return withStore(user, async (ownerId) => {
      const result = await summarize(user, ownerId, shippingMethod, input.voucherCode, input.giftCardCode);
      if (!result) return fail(400, 'CART_EMPTY', TEXT.cartEmpty);
      const { voucherError, giftCardError, ...summary } = result.summary;
      const fields = {};
      if (voucherError) fields.voucherCode = voucherError;
      if (giftCardError) fields.giftCardCode = giftCardError;
      if (Object.keys(fields).length > 0) return fail(400, 'VALIDATION_ERROR', Object.values(fields)[0], fields);
      return { status: 200, body: { data: summary } };
    });
  }

  async function createOrder(user, body) {
    const { errors, value } = validateCheckout(body, deps.now ? deps.now() : new Date());
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', MESSAGES.formInvalid, errors);

    return withStore(user, async (ownerId) => {
      const result = await summarize(user, ownerId, value.shippingMethod, value.voucherCode, value.giftCardCode);
      if (!result) return fail(400, 'CART_EMPTY', TEXT.cartEmpty);
      const { cart, summary } = result;

      if (cart.hasProblem) return fail(422, 'CART_PROBLEM', TEXT.cartProblem);
      if (summary.voucherError) {
        return fail(400, 'VALIDATION_ERROR', summary.voucherError, { voucherCode: summary.voucherError });
      }
      if (summary.giftCardError) {
        return fail(400, 'VALIDATION_ERROR', summary.giftCardError, { giftCardCode: summary.giftCardError });
      }
      // E-wallet: harus sudah dibayar lewat WarungPay dengan nominal yang sama persis
      if (value.paymentMethod === 'ewallet') {
        const payment = await deps.findPayment(value.paymentRef, user.id);
        if (!payment) return fail(400, 'VALIDATION_ERROR', TEXT.paymentNotFound, { paymentRef: TEXT.paymentNotFound });
        if (payment.used) return fail(409, 'PAYMENT_USED', TEXT.paymentUsed, { paymentRef: TEXT.paymentUsed });
        if (payment.amount !== summary.total) {
          return fail(400, 'VALIDATION_ERROR', TEXT.paymentAmount, { paymentRef: TEXT.paymentAmount });
        }
      }
      if (value.paymentMethod === 'cod' && summary.total > COD_MAX_TOTAL) {
        return fail(400, 'VALIDATION_ERROR', TEXT.codLimit, { paymentMethod: TEXT.codLimit });
      }

      try {
        const order = await deps.createOrder({
          buyerId: user.id,
          buyerUsername: user.username,
          ownerId,
          orderNumber: deps.newOrderNumber(),
          checkout: { ...value, paymentRef: value.paymentMethod === 'ewallet' ? value.paymentRef : '' },
          summary,
        });
        return { status: 201, body: { data: publicOrder(order) } };
      } catch (err) {
        // Stok dibeli orang lain di saat yang sama: CHECK (stock >= 0) menggagalkan transaksi
        if (err && err.code === '23514') return fail(409, 'STOCK_CHANGED', TEXT.stockChanged);
        throw err;
      }
    });
  }

  // ---------- Pesanan ----------

  async function listOrders(user, range = {}) {
    return { status: 200, body: { data: await deps.listOrders(user.id, range) } };
  }

  async function getOrder(user, orderNumber) {
    const order = await deps.getOrder(user.id, String(orderNumber || ''));
    if (!order) return fail(404, 'NOT_FOUND', TEXT.orderNotFound);
    return { status: 200, body: { data: publicOrder(order) } };
  }

  return {
    listProducts,
    getProduct,
    getCart,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    preview,
    createOrder,
    listOrders,
    getOrder,
  };
}

// Contoh: WQA-20261124-K7Q2ZP
function newOrderNumber(now = new Date()) {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const date = wib.toISOString().slice(0, 10).replace(/-/g, '');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `WQA-${date}-${suffix}`;
}

module.exports = { createStoreService, newOrderNumber, STORE_LIMITS, TEXT };
