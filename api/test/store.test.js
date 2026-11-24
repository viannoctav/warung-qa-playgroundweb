// Unit test Toko & Checkout: harga, voucher, validasi, keranjang, pesanan (tanpa database asli).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeSummary, checkVoucher } = require('../src/store/pricing');
const { validateCheckout } = require('../src/validation/checkout');
const { createStoreService, newOrderNumber } = require('../src/services/store-service');

const STORE_ADMIN = { id: 10, username: 'admin_user', role: 'admin' };
const BUYER = { id: 20, username: 'standard_user', role: 'user' };
const OTHER_ADMIN = { id: 30, username: 'rina_qa', role: 'admin' };

const VALID_CHECKOUT = {
  recipientName: 'Rina Wijaya',
  phone: '081234567890',
  address: 'Jl. Melati No. 10, RT 01/RW 02',
  city: 'Bekasi',
  postalCode: '17111',
  notes: '',
  shippingMethod: 'reguler',
  paymentMethod: 'transfer',
};

// ---------- Harga & voucher ----------

test('ringkasan: subtotal, ongkir, total tanpa voucher', () => {
  const s = computeSummary([{ price: 25000, quantity: 2 }, { price: 10000, quantity: 1 }], 'express', '');
  assert.deepEqual(s, {
    itemCount: 3, subtotal: 60000, shippingCost: 20000, discount: 0, total: 80000, voucherCode: null, voucherError: null,
  });
});

test('voucher HEMAT10: 10% dengan batas Rp 50.000, huruf kecil tetap diterima', () => {
  assert.equal(computeSummary([{ price: 100000, quantity: 1 }], 'reguler', 'hemat10').discount, 10000);
  const big = computeSummary([{ price: 1000000, quantity: 1 }], 'reguler', ' HEMAT10 ');
  assert.equal(big.discount, 50000);
  assert.equal(big.voucherCode, 'HEMAT10');
  assert.equal(big.total, 1000000 - 50000 + 10000);
});

test('voucher WARUNG25K dan ONGKIRGRATIS', () => {
  assert.equal(computeSummary([{ price: 150000, quantity: 1 }], 'reguler', 'WARUNG25K').discount, 25000);
  const free = computeSummary([{ price: 50000, quantity: 1 }], 'sameday', 'ONGKIRGRATIS');
  assert.equal(free.shippingCost, 0);
  assert.equal(free.total, 50000);
});

test('voucher ditolak: tidak dikenal, kedaluwarsa, belum memenuhi minimal (batas tepat)', () => {
  assert.equal(checkVoucher('ABC', 999999).error, 'Kode voucher tidak ditemukan');
  assert.equal(checkVoucher('KADALUARSA', 999999).error, 'Voucher sudah kedaluwarsa');
  assert.equal(checkVoucher('HEMAT10', 99999).error, 'Minimal belanja Rp 100.000 untuk voucher ini');
  assert.equal(checkVoucher('HEMAT10', 100000).error, null);
  const s = computeSummary([{ price: 1000, quantity: 1 }], 'reguler', 'WARUNG25K');
  assert.equal(s.discount, 0);
  assert.equal(s.voucherError, 'Minimal belanja Rp 150.000 untuk voucher ini');
});

test('validasi checkout: wajib, format, panjang, metode', () => {
  assert.deepEqual(validateCheckout(VALID_CHECKOUT).errors, {});
  const { errors } = validateCheckout({ phone: '12345', postalCode: '1711', address: 'pendek', notes: 'x'.repeat(201) });
  assert.deepEqual(errors, {
    recipientName: 'Nama penerima wajib diisi',
    phone: 'Nomor HP harus diawali 08 atau +628 dan berisi 10–14 digit',
    address: 'Alamat harus 10–200 karakter',
    city: 'Kota wajib diisi',
    postalCode: 'Kode pos harus 5 angka',
    notes: 'Catatan maksimal 200 karakter',
    shippingMethod: 'Pilih metode pengiriman',
    paymentMethod: 'Pilih metode pembayaran',
  });
  assert.equal(validateCheckout({ ...VALID_CHECKOUT, phone: '+6281234567' }).errors.phone, undefined);
});

test('nomor pesanan berformat WQA-YYYYMMDD-XXXXXX memakai tanggal WIB', () => {
  const n = newOrderNumber(new Date('2026-11-24T18:30:00Z')); // 25 Nov 01:30 WIB
  assert.match(n, /^WQA-20261125-[A-Z2-9]{6}$/);
});

// ---------- Service dengan database palsu ----------

function setup() {
  let nextId = 1;
  const products = [];
  const cart = new Map(); // `${buyer}:${product}` -> qty (urutan sisip dipertahankan)
  const orders = [];
  const seeded = new Set();

  const product = (ownerId, overrides) => {
    const row = {
      id: nextId++, ownerId, sku: `KOP-${String(nextId).padStart(4, '0')}`, name: `Produk ${nextId}`, category: 'kopi',
      price: 50000, stock: 10, isActive: true, description: '', imageUrl: null, ...overrides,
    };
    products.push(row);
    return row;
  };
  const strip = ({ ownerId, ...p }) => ({ ...p });

  const deps = {
    findDemoStoreOwnerId: async () => STORE_ADMIN.id,
    ensureCatalog: async (ownerId) => {
      if (seeded.has(ownerId)) return;
      seeded.add(ownerId);
      product(ownerId, { name: 'Kopi Aktif' });
      product(ownerId, { name: 'Kopi Nonaktif', isActive: false });
      product(ownerId, { name: 'Kopi Habis', stock: 0 });
      product(ownerId, { name: 'Kopi Mahal', price: 600000, stock: 5 });
    },
    listProducts: async (ownerId, q) => {
      const items = products.filter((p) => p.ownerId === ownerId && (q.status !== 'active' || p.isActive));
      return { total: items.length, items: items.slice((q.page - 1) * q.limit, q.page * q.limit).map(strip) };
    },
    getProduct: async (ownerId, id) => {
      const row = products.find((p) => p.ownerId === ownerId && p.id === id);
      return row ? strip(row) : null;
    },
    getCartItems: async (buyerId, ownerId) => {
      const out = [];
      for (const [key, quantity] of cart) {
        const [b, pid] = key.split(':').map(Number);
        const row = products.find((p) => p.id === pid);
        if (b === buyerId && row && row.ownerId === ownerId) out.push({ product: strip(row), quantity });
      }
      return out;
    },
    getCartQuantity: async (buyerId, productId) => cart.get(`${buyerId}:${productId}`) || 0,
    setCartQuantity: async (buyerId, productId, quantity) => {
      cart.set(`${buyerId}:${productId}`, quantity);
    },
    removeCartItem: async (buyerId, productId) => cart.delete(`${buyerId}:${productId}`),
    clearCart: async (buyerId) => {
      for (const key of [...cart.keys()]) if (key.startsWith(`${buyerId}:`)) cart.delete(key);
    },
    newOrderNumber: () => `WQA-20261124-${String(orders.length + 1).padStart(6, '0')}`,
    createOrder: async ({ buyerId, ownerId, orderNumber, checkout, summary }) => {
      const lines = await deps.getCartItems(buyerId, ownerId);
      for (const { product: p, quantity } of lines) {
        const row = products.find((x) => x.id === p.id);
        if (row.stock - quantity < 0) {
          const err = new Error('check');
          err.code = '23514';
          throw err;
        }
      }
      for (const { product: p, quantity } of lines) products.find((x) => x.id === p.id).stock -= quantity;
      const order = {
        orderNumber, buyerId, ...checkout, ...summary,
        items: lines.map(({ product: p, quantity }) => ({ productId: p.id, name: p.name, price: p.price, quantity, subtotal: p.price * quantity })),
      };
      orders.push(order);
      await deps.clearCart(buyerId);
      return order;
    },
    listOrders: async (buyerId) => orders.filter((o) => o.buyerId === buyerId),
    getOrder: async (buyerId, orderNumber) => orders.find((o) => o.buyerId === buyerId && o.orderNumber === orderNumber) || null,
  };

  const svc = createStoreService(deps);
  const byName = async (user, name) => {
    await svc.listProducts(user, {});
    const owner = user.role === 'admin' ? user.id : STORE_ADMIN.id;
    return products.find((p) => p.ownerId === owner && p.name === name);
  };
  return { svc, products, byName, cart, deps };
}

test('role user belanja di toko admin_user dan hanya melihat produk aktif', async () => {
  const { svc } = setup();
  const res = await svc.listProducts(BUYER, {});
  assert.equal(res.status, 200);
  assert.equal(res.body.meta.limit, 12);
  assert.deepEqual(res.body.data.map((p) => p.name), ['Kopi Aktif', 'Kopi Habis', 'Kopi Mahal']);
  assert.equal((await svc.listProducts(BUYER, { limit: '10' })).body.error.fields.limit, 'Limit harus 12, 24, atau 48');
});

test('detail produk: nonaktif atau milik toko lain → 404', async () => {
  const { svc, byName } = setup();
  const inactive = await byName(BUYER, 'Kopi Nonaktif');
  const active = await byName(BUYER, 'Kopi Aktif');
  assert.equal((await svc.getProduct(BUYER, String(active.id))).status, 200);
  assert.equal((await svc.getProduct(BUYER, String(inactive.id))).status, 404);
  // Admin lain punya toko sendiri, jadi produk admin_user tidak ada di tokonya
  assert.equal((await svc.getProduct(OTHER_ADMIN, String(active.id))).status, 404);
  assert.equal((await svc.getProduct(BUYER, 'abc')).body.error.message, 'Produk tidak ditemukan');
});

test('tambah ke keranjang: jumlah digabung, dicek stok dan batas 99', async () => {
  const { svc, byName } = setup();
  const kopi = await byName(BUYER, 'Kopi Aktif'); // stok 10
  const first = await svc.addItem(BUYER, { productId: kopi.id, quantity: 4 });
  assert.equal(first.status, 201);
  const second = await svc.addItem(BUYER, { productId: kopi.id });
  assert.equal(second.body.data.items[0].quantity, 5);
  assert.equal(second.body.data.subtotal, 250000);

  const over = await svc.addItem(BUYER, { productId: kopi.id, quantity: 6 });
  assert.equal(over.status, 422);
  assert.equal(over.body.error.message, 'Stok tidak cukup. Sisa stok: 10');

  const habis = await byName(BUYER, 'Kopi Habis');
  assert.equal((await svc.addItem(BUYER, { productId: habis.id, quantity: 1 })).body.error.message, 'Stok habis');
  const nonaktif = await byName(BUYER, 'Kopi Nonaktif');
  assert.equal((await svc.addItem(BUYER, { productId: nonaktif.id, quantity: 1 })).status, 404);

  for (const quantity of [0, 100, 1.5, '2']) {
    const bad = await svc.addItem(BUYER, { productId: kopi.id, quantity });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.fields.quantity, 'Jumlah harus angka bulat 1–99');
  }
  assert.equal((await svc.addItem(BUYER, { productId: 'x', quantity: 1 })).body.error.fields.productId, 'productId harus berupa id produk');
});

test('ubah & hapus item keranjang', async () => {
  const { svc, byName } = setup();
  const kopi = await byName(BUYER, 'Kopi Aktif');
  await svc.addItem(BUYER, { productId: kopi.id, quantity: 2 });
  assert.equal((await svc.updateItem(BUYER, String(kopi.id), { quantity: 7 })).body.data.items[0].quantity, 7);
  assert.equal((await svc.updateItem(BUYER, String(kopi.id), { quantity: 11 })).status, 422);
  assert.equal((await svc.updateItem(BUYER, '999', { quantity: 1 })).body.error.message, 'Produk tidak ada di keranjang');
  assert.equal((await svc.removeItem(BUYER, String(kopi.id))).body.data.items.length, 0);
  assert.equal((await svc.removeItem(BUYER, String(kopi.id))).status, 404);
});

test('keranjang menandai produk yang jadi nonaktif atau stoknya berkurang', async () => {
  const { svc, byName } = setup();
  const kopi = await byName(BUYER, 'Kopi Aktif');
  await svc.addItem(BUYER, { productId: kopi.id, quantity: 5 });
  kopi.stock = 3;
  let cart = (await svc.getCart(BUYER)).body.data;
  assert.equal(cart.items[0].problem, 'Stok tidak cukup. Sisa stok: 3');
  assert.equal(cart.hasProblem, true);
  // Mengurangi jumlah tetap boleh walau stok kurang
  assert.equal((await svc.updateItem(BUYER, String(kopi.id), { quantity: 4 })).status, 200);
  kopi.isActive = false;
  cart = (await svc.getCart(BUYER)).body.data;
  assert.equal(cart.items[0].problem, 'Produk sudah tidak dijual');
  const order = await svc.createOrder(BUYER, VALID_CHECKOUT);
  assert.equal(order.status, 422);
  assert.equal(order.body.error.code, 'CART_PROBLEM');
});

test('preview checkout: keranjang kosong, voucher salah, voucher benar', async () => {
  const { svc, byName } = setup();
  assert.equal((await svc.preview(BUYER, {})).body.error.message, 'Keranjang masih kosong');
  const kopi = await byName(BUYER, 'Kopi Aktif');
  await svc.addItem(BUYER, { productId: kopi.id, quantity: 2 }); // 100.000
  const ok = await svc.preview(BUYER, { shippingMethod: 'express', voucherCode: 'HEMAT10' });
  assert.deepEqual(ok.body.data, {
    itemCount: 2, subtotal: 100000, shippingCost: 20000, discount: 10000, total: 110000, voucherCode: 'HEMAT10',
  });
  const bad = await svc.preview(BUYER, { voucherCode: 'WARUNG25K' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.fields.voucherCode, 'Minimal belanja Rp 150.000 untuk voucher ini');
  assert.equal((await svc.preview(BUYER, { shippingMethod: 'kilat' })).body.error.fields.shippingMethod, 'Pilih metode pengiriman');
});

test('buat pesanan: stok berkurang, keranjang kosong, pesanan tersimpan', async () => {
  const { svc, byName, cart } = setup();
  const kopi = await byName(BUYER, 'Kopi Aktif');
  await svc.addItem(BUYER, { productId: kopi.id, quantity: 3 });
  const res = await svc.createOrder(BUYER, { ...VALID_CHECKOUT, voucherCode: 'hemat10' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.total, 150000 - 15000 + 10000);
  assert.equal(res.body.data.voucherCode, 'HEMAT10');
  assert.equal(kopi.stock, 7);
  assert.equal(cart.size, 0);

  const list = await svc.listOrders(BUYER);
  assert.equal(list.body.data.length, 1);
  const num = res.body.data.orderNumber;
  assert.equal((await svc.getOrder(BUYER, num)).status, 200);
  // Pesanan akun lain tidak bisa dibuka
  assert.equal((await svc.getOrder(OTHER_ADMIN, num)).body.error.message, 'Pesanan tidak ditemukan');
  assert.equal((await svc.createOrder(BUYER, VALID_CHECKOUT)).body.error.message, 'Keranjang masih kosong');
});

test('buat pesanan ditolak: form tidak valid, voucher salah, COD di atas Rp 1.000.000, stok berubah', async () => {
  const { svc, byName, products, deps } = setup();
  const bad = await svc.createOrder(BUYER, { ...VALID_CHECKOUT, postalCode: 'abc' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.fields.postalCode, 'Kode pos harus 5 angka');

  const mahal = await byName(BUYER, 'Kopi Mahal'); // 600.000, stok 5
  await svc.addItem(BUYER, { productId: mahal.id, quantity: 2 });
  const voucher = await svc.createOrder(BUYER, { ...VALID_CHECKOUT, voucherCode: 'KADALUARSA' });
  assert.equal(voucher.body.error.fields.voucherCode, 'Voucher sudah kedaluwarsa');
  const cod = await svc.createOrder(BUYER, { ...VALID_CHECKOUT, paymentMethod: 'cod' });
  assert.equal(cod.status, 400);
  assert.equal(cod.body.error.fields.paymentMethod, 'COD hanya untuk total maksimal Rp 1.000.000');

  // Pembeli lain menghabiskan stok tepat sebelum transaksi: database menolak (CHECK stock >= 0)
  const realCreate = deps.createOrder;
  deps.createOrder = async (args) => {
    mahal.stock = 1;
    return realCreate(args);
  };
  const race = await svc.createOrder(BUYER, VALID_CHECKOUT);
  assert.equal(race.status, 409);
  assert.equal(race.body.error.message, 'Stok berubah saat checkout. Periksa keranjang Anda lalu coba lagi.');
  assert.equal(products.find((p) => p.id === mahal.id).stock, 1);
});

test('admin belanja di tokonya sendiri, bukan toko admin_user', async () => {
  const { svc } = setup();
  const res = await svc.listProducts(OTHER_ADMIN, {});
  assert.equal(res.body.data.length, 3);
  const mine = res.body.data[0];
  assert.equal((await svc.addItem(OTHER_ADMIN, { productId: mine.id, quantity: 1 })).status, 201);
  assert.equal((await svc.getCart(BUYER)).body.data.items.length, 0);
});

test('dokumentasi OpenAPI memuat endpoint toko, keranjang, pesanan, gambar', () => {
  const { spec } = require('../src/openapi');
  for (const path of ['/api/v1/store/products', '/api/v1/store/products/{id}', '/api/v1/cart', '/api/v1/cart/items', '/api/v1/cart/items/{productId}', '/api/v1/checkout/preview', '/api/v1/orders', '/api/v1/orders/{orderNumber}', '/api/v1/products/{id}/image']) {
    assert.ok(spec.paths[path], path);
  }
});
