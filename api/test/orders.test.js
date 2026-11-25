// Unit test status pesanan (state transition), pembatalan, bukti transfer, lacak paket, WarungPay.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createOrderService } = require('../src/services/order-service');

const ADMIN = { id: 10, username: 'admin_user', role: 'admin' };
const BUYER = { id: 20, username: 'standard_user', role: 'user' };
const OTHER = { id: 30, username: 'rina_qa', role: 'user' };

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);

function setup(now = new Date('2026-11-24T12:00:00Z')) {
  const orders = new Map();
  let id = 0;
  const add = (no, overrides = {}) => {
    id += 1;
    const order = {
      id, orderNumber: no, userId: BUYER.id, storeOwnerId: ADMIN.id, status: 'diproses', paymentMethod: 'transfer',
      city: 'Bekasi', recipientName: 'Budi Santoso', courier: null, trackingNumber: null, paymentProof: null,
      history: [{ status: 'diproses', actor: 'standard_user', note: 'Pesanan dibuat', createdAt: '2026-11-24T01:00:00.000Z' }],
      ...overrides,
    };
    orders.set(no, order);
    return order;
  };
  const calls = [];
  const proofs = new Map();
  const deps = {
    now: () => now,
    getStoreOrder: async (ownerId, no) => {
      const o = orders.get(no);
      return o && o.storeOwnerId === ownerId ? { ...o } : null;
    },
    getOrder: async (userId, no) => {
      const o = orders.get(no);
      return o && o.userId === userId ? { ...o } : null;
    },
    listStoreOrders: async (ownerId, q) => {
      calls.push(q);
      const items = [...orders.values()].filter((o) => o.storeOwnerId === ownerId && (!q.status || o.status === q.status));
      return { total: items.length, counts: { all: items.length }, items };
    },
    changeOrderStatus: async (args) => {
      calls.push(args);
      const o = [...orders.values()].find((x) => x.id === args.orderId);
      if (o.status !== args.from) return false;
      o.status = args.to;
      if (args.courier) o.courier = args.courier;
      if (args.trackingNumber) o.trackingNumber = args.trackingNumber;
      o.history.push({ status: args.to, actor: args.actor, note: args.note, createdAt: now.toISOString() });
      return true;
    },
    setPaymentProof: async (orderId, proof) => {
      proofs.set(orderId, proof);
      const o = [...orders.values()].find((x) => x.id === orderId);
      o.paymentProof = { name: proof.name, type: proof.type, size: proof.size };
    },
    deletePaymentProof: async (orderId) => {
      proofs.delete(orderId);
      [...orders.values()].find((x) => x.id === orderId).paymentProof = null;
    },
    getPaymentProof: async (orderId) => proofs.get(orderId) || null,
    newPaymentRef: () => 'WPY-TEST1234',
    createPayment: async (p) => calls.push(p),
  };
  return { svc: createOrderService(deps), add, orders, calls };
}

const SHIP = { status: 'dikirim', courier: 'express', trackingNumber: 'WQA1234567890' };
const CANCEL = { status: 'dibatalkan', reason: 'stok-habis' };

test('state transition: semua pasangan status (boleh vs 409)', async () => {
  const allowed = new Set(['diproses>dikirim', 'diproses>dibatalkan', 'dikirim>selesai']);
  const body = { dikirim: SHIP, selesai: { status: 'selesai' }, dibatalkan: CANCEL };
  for (const from of ['diproses', 'dikirim', 'selesai', 'dibatalkan']) {
    for (const to of ['dikirim', 'selesai', 'dibatalkan']) {
      const { svc, add } = setup();
      add('WQA-1', { status: from });
      const res = await svc.changeStatus(ADMIN, 'WQA-1', body[to]);
      if (allowed.has(`${from}>${to}`)) {
        assert.equal(res.status, 200, `${from}>${to}`);
        assert.equal(res.body.data.status, to);
      } else {
        assert.equal(res.status, 409, `${from}>${to}`);
        assert.equal(res.body.error.code, 'INVALID_TRANSITION');
      }
    }
  }
  const { svc, add } = setup();
  add('WQA-1', { status: 'selesai' });
  assert.equal((await svc.changeStatus(ADMIN, 'WQA-1', { status: 'selesai' })).body.error.message, 'Status Selesai tidak bisa diubah ke Selesai');
});

test('kirim: kurir & resi wajib, format resi', async () => {
  const { svc, add } = setup();
  add('WQA-1');
  const empty = await svc.changeStatus(ADMIN, 'WQA-1', { status: 'dikirim' });
  assert.deepEqual(empty.body.error.fields, { courier: 'Pilih kurir', trackingNumber: 'Nomor resi wajib diisi' });
  for (const trackingNumber of ['WQA12', 'wqa1234567890', 'WQA-1234567890', 'A'.repeat(21)]) {
    const bad = await svc.changeStatus(ADMIN, 'WQA-1', { ...SHIP, trackingNumber });
    assert.equal(bad.body.error.fields.trackingNumber, 'Nomor resi harus 10–20 huruf kapital atau angka');
  }
  const ok = await svc.changeStatus(ADMIN, 'WQA-1', { ...SHIP, trackingNumber: ' WQA1234567890 ' });
  assert.equal(ok.body.data.trackingNumber, 'WQA1234567890');
  assert.equal(ok.body.data.history.at(-1).note, 'Kurir Express (1–2 hari), resi WQA1234567890');
});

test('batal: alasan wajib, catatan wajib untuk Lainnya, maks 200', async () => {
  const { svc, add, calls } = setup();
  add('WQA-1');
  assert.equal((await svc.changeStatus(ADMIN, 'WQA-1', { status: 'dibatalkan' })).body.error.fields.reason, 'Pilih alasan pembatalan');
  assert.equal((await svc.changeStatus(ADMIN, 'WQA-1', { status: 'dibatalkan', reason: 'lainnya' })).body.error.fields.note, 'Catatan wajib diisi kalau alasannya Lainnya');
  assert.equal((await svc.changeStatus(ADMIN, 'WQA-1', { ...CANCEL, note: 'x'.repeat(201) })).body.error.fields.note, 'Catatan maksimal 200 karakter');
  const ok = await svc.changeStatus(ADMIN, 'WQA-1', { status: 'dibatalkan', reason: 'lainnya', note: 'Pembeli salah alamat' });
  assert.equal(ok.status, 200);
  const change = calls.find((c) => c.to === 'dibatalkan');
  assert.equal(change.ownerId, ADMIN.id);
  assert.equal(change.cancelReason, 'lainnya');
  assert.equal(change.note, 'Lainnya: Pembeli salah alamat. Stok dikembalikan.');
});

test('status tidak dikenal 400, bukan admin 403, pesanan toko lain 404, berubah bersamaan 409', async () => {
  const { svc, add, orders } = setup();
  add('WQA-1');
  assert.equal((await svc.changeStatus(ADMIN, 'WQA-1', { status: 'diproses' })).status, 400);
  assert.equal((await svc.changeStatus(BUYER, 'WQA-1', SHIP)).status, 403);
  assert.equal((await svc.listStore(BUYER, {})).status, 403);
  assert.equal((await svc.changeStatus({ ...ADMIN, id: 99 }, 'WQA-1', SHIP)).status, 404);
  // Simulasi admin lain baru saja mengubahnya: data yang dibaca masih "diproses", database sudah "dibatalkan"
  const real = orders.get('WQA-1');
  const svcRace = createOrderService({
    getStoreOrder: async () => ({ ...real, status: 'diproses' }),
    changeOrderStatus: async () => false,
  });
  real.status = 'dibatalkan';
  const race = await svcRace.changeStatus(ADMIN, 'WQA-1', SHIP);
  assert.equal(race.status, 409);
  assert.equal(race.body.error.code, 'STATUS_CHANGED');
});

test('daftar pesanan toko: filter & validasi query', async () => {
  const { svc, add } = setup();
  add('WQA-1');
  add('WQA-2', { status: 'selesai' });
  assert.equal((await svc.listStore(ADMIN, { status: 'selesai' })).body.data.length, 1);
  const bad = await svc.listStore(ADMIN, { status: 'baru', sort: 'nama', limit: '7' });
  assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ['limit', 'sort', 'status']);
});

test('pembeli membatalkan pesanannya sendiri hanya selama Diproses', async () => {
  const { svc, add } = setup();
  add('WQA-1');
  add('WQA-2', { status: 'dikirim' });
  assert.equal((await svc.cancel(OTHER, 'WQA-1', CANCEL)).status, 404);
  assert.equal((await svc.cancel(BUYER, 'WQA-1', {})).body.error.fields.reason, 'Pilih alasan pembatalan');
  const ok = await svc.cancel(BUYER, 'WQA-1', { reason: 'permintaan-pembeli' });
  assert.equal(ok.body.data.status, 'dibatalkan');
  assert.equal(ok.body.data.history.at(-1).actor, 'standard_user');
  const late = await svc.cancel(BUYER, 'WQA-2', CANCEL);
  assert.equal(late.status, 409);
  assert.equal(late.body.error.message, 'Pesanan hanya bisa dibatalkan selama statusnya Diproses');
});

test('bukti transfer: hanya transfer & Diproses, PNG/JPG maks 1 MB, isi harus gambar', async () => {
  const { svc, add } = setup();
  add('WQA-1');
  add('WQA-2', { paymentMethod: 'ewallet' });
  add('WQA-3', { status: 'dikirim' });
  const up = (no, buffer, contentType, fileName) => svc.uploadProof(BUYER, no, { buffer, contentType, fileName });
  assert.equal((await up('WQA-2', PNG, 'image/png')).body.error.message, 'Bukti transfer hanya untuk pesanan dengan pembayaran transfer bank');
  assert.equal((await up('WQA-3', PNG, 'image/png')).body.error.message, 'Bukti transfer hanya bisa diubah selama pesanan Diproses');
  assert.equal((await up('WQA-1', undefined, 'application/pdf')).status, 415);
  assert.equal((await up('WQA-1', Buffer.alloc(0), 'image/png')).body.error.message, 'File bukti transfer wajib dikirim');
  assert.equal((await up('WQA-1', Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]), 'image/png')).status, 413);
  assert.equal((await up('WQA-1', Buffer.from('teks biasa'), 'image/png')).body.error.message, 'Isi file tidak cocok dengan format gambar');
  const ok = await up('WQA-1', PNG, 'image/png', 'bukti <transfer>.png');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.paymentProof.name, 'bukti transfer.png');
  assert.equal((await svc.ownProof(BUYER, 'WQA-1')).image.type, 'image/png');
  assert.equal((await svc.storeProof(ADMIN, 'WQA-1')).status, 200);
  assert.equal((await svc.ownProof(OTHER, 'WQA-1')).status, 404);
  assert.equal((await svc.deleteProof(BUYER, 'WQA-1')).status, 204);
  assert.equal((await svc.deleteProof(BUYER, 'WQA-1')).body.error.message, 'Bukti transfer belum diunggah');
});

test('lacak paket: 409 sebelum dikirim, event bertambah sesuai waktu', async () => {
  const { svc, add } = setup(new Date('2026-11-24T12:00:00Z'));
  add('WQA-1');
  assert.equal((await svc.tracking(BUYER, 'WQA-1')).body.error.message, 'Paket belum dikirim');
  add('WQA-2', {
    status: 'dikirim',
    courier: 'express',
    trackingNumber: 'WQA1234567890',
    history: [
      { status: 'diproses', createdAt: '2026-11-24T01:00:00.000Z' },
      { status: 'dikirim', createdAt: '2026-11-24T05:00:00.000Z' },
    ],
  });
  const res = await svc.tracking(BUYER, 'WQA-2');
  assert.equal(res.body.data.events.length, 2); // jam 0 dan jam 3 (sekarang jam 7 setelah dikirim)
  assert.equal(res.body.data.events[0].description, 'Paket disortir');
});

test('rentang tanggal pesanan', () => {
  const { svc } = setup();
  assert.deepEqual(svc.validateDateRange({ from: '2026-11-01', to: '2026-11-24' }).errors, {});
  assert.equal(svc.validateDateRange({ from: '2026-13-01' }).errors.from, 'Format tanggal harus YYYY-MM-DD');
  assert.equal(svc.validateDateRange({ from: '2026-11-24', to: '2026-11-01' }).errors.to, 'Tanggal akhir tidak boleh sebelum tanggal awal');
});

test('WarungPay: validasi, PIN salah 401, saldo kurang 402, sukses 201', async () => {
  const { svc } = setup();
  const empty = await svc.pay(BUYER, {});
  assert.deepEqual(empty.body.error.fields, {
    phone: 'Nomor HP e-wallet wajib diisi', pin: 'PIN wajib diisi', amount: 'Nominal harus angka bulat lebih dari 0',
  });
  assert.equal((await svc.pay(BUYER, { phone: '081234567890', pin: '12a456', amount: 1000 })).body.error.fields.pin, 'PIN harus 6 angka');
  assert.equal((await svc.pay(BUYER, { phone: '081234567890', pin: '654321', amount: 1000 })).status, 401);
  assert.equal((await svc.pay(BUYER, { phone: '081234567890', pin: '123456', amount: 2000001 })).status, 402);
  const ok = await svc.pay(BUYER, { phone: '081234567890', pin: '123456', amount: 229500 });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.paymentRef, 'WPY-TEST1234');
});

test('dokumentasi OpenAPI memuat endpoint status pesanan & widget', () => {
  const { spec } = require('../src/openapi');
  for (const path of ['/api/v1/admin/orders', '/api/v1/admin/orders/{orderNumber}/status', '/api/v1/orders/{orderNumber}/cancel', '/api/v1/orders/{orderNumber}/payment-proof', '/api/v1/orders/{orderNumber}/tracking', '/api/v1/payments/warungpay', '/api/v1/products/featured', '/api/v1/stock-movements']) {
    assert.ok(spec.paths[path], path);
  }
});
