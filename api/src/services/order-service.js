// Status pesanan (admin & pembeli), bukti transfer, lacak paket, dan WarungPay.
const { SHIPPING_METHODS } = require('../store/pricing');

const STATUSES = ['diproses', 'dikirim', 'selesai', 'dibatalkan'];
const STATUS_LABEL = { diproses: 'Diproses', dikirim: 'Dikirim', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };

// Satu-satunya perpindahan status yang boleh
const TRANSITIONS = {
  diproses: ['dikirim', 'dibatalkan'],
  dikirim: ['selesai'],
  selesai: [],
  dibatalkan: [],
};

const CANCEL_REASONS = {
  'stok-habis': 'Stok tidak tersedia',
  'permintaan-pembeli': 'Permintaan pembeli',
  'alamat-tidak-valid': 'Alamat tidak valid',
  lainnya: 'Lainnya',
};

const PROOF_TYPES = ['image/png', 'image/jpeg'];
const PROOF_MAX_BYTES = 1024 * 1024;
const WARUNGPAY_PIN = '123456';
const WARUNGPAY_BALANCE = 2000000;

const TEXT = {
  forbidden: 'Hanya akun admin yang bisa mengelola pesanan toko.',
  notFound: 'Pesanan tidak ditemukan',
  statusInvalid: 'Status harus dikirim, selesai, atau dibatalkan',
  courier: 'Pilih kurir',
  trackingRequired: 'Nomor resi wajib diisi',
  trackingFormat: 'Nomor resi harus 10–20 huruf kapital atau angka',
  reasonRequired: 'Pilih alasan pembatalan',
  noteRequired: 'Catatan wajib diisi kalau alasannya Lainnya',
  noteLength: 'Catatan maksimal 200 karakter',
  changedMeanwhile: 'Status pesanan baru saja berubah. Muat ulang halaman lalu coba lagi.',
  buyerCancelOnly: 'Pesanan hanya bisa dibatalkan selama statusnya Diproses',
  proofTransferOnly: 'Bukti transfer hanya untuk pesanan dengan pembayaran transfer bank',
  proofLocked: 'Bukti transfer hanya bisa diubah selama pesanan Diproses',
  proofRequired: 'File bukti transfer wajib dikirim',
  proofType: 'File harus PNG atau JPG, maksimal 1 MB',
  proofTooLarge: 'File harus PNG atau JPG, maksimal 1 MB',
  proofMismatch: 'Isi file tidak cocok dengan format gambar',
  proofNotFound: 'Bukti transfer belum diunggah',
  notShipped: 'Paket belum dikirim',
  dateFormat: 'Format tanggal harus YYYY-MM-DD',
  dateOrder: 'Tanggal akhir tidak boleh sebelum tanggal awal',
  payPhoneRequired: 'Nomor HP e-wallet wajib diisi',
  payPhoneFormat: 'Nomor HP harus diawali 08 atau +628 dan berisi 10–14 digit',
  payPinRequired: 'PIN wajib diisi',
  payPinFormat: 'PIN harus 6 angka',
  payPinWrong: 'PIN salah',
  payAmount: 'Nominal harus angka bulat lebih dari 0',
  payBalance: 'Saldo WarungPay tidak cukup',
};

function fail(status, code, message, fields) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return { status, body: { error } };
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function matchesSignature(buffer, type) {
  if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return false;
}

function transitionError(from, to) {
  return fail(409, 'INVALID_TRANSITION', `Status ${STATUS_LABEL[from]} tidak bisa diubah ke ${STATUS_LABEL[to]}`);
}

// Validasi isi body untuk status tujuan (kurir & resi untuk dikirim, alasan untuk dibatalkan)
function validateTransitionBody(to, input) {
  const errors = {};
  const value = {};
  if (to === 'dikirim') {
    if (!Object.prototype.hasOwnProperty.call(SHIPPING_METHODS, input.courier)) errors.courier = TEXT.courier;
    const tracking = typeof input.trackingNumber === 'string' ? input.trackingNumber.trim() : '';
    if (!tracking) errors.trackingNumber = TEXT.trackingRequired;
    else if (!/^[A-Z0-9]{10,20}$/.test(tracking)) errors.trackingNumber = TEXT.trackingFormat;
    value.courier = input.courier;
    value.trackingNumber = tracking;
  }
  if (to === 'dibatalkan') {
    const note = typeof input.note === 'string' ? input.note.trim() : '';
    if (!Object.prototype.hasOwnProperty.call(CANCEL_REASONS, input.reason)) errors.reason = TEXT.reasonRequired;
    if (input.reason === 'lainnya' && !note) errors.note = TEXT.noteRequired;
    if (note.length > 200) errors.note = TEXT.noteLength;
    value.cancelReason = input.reason;
    value.cancelNote = note;
  }
  return { errors, value };
}

function createOrderService(deps) {
  const isAdmin = (user) => user && user.role === 'admin';
  const notFound = () => fail(404, 'NOT_FOUND', TEXT.notFound);
  const now = () => (deps.now ? deps.now() : new Date());

  async function applyTransition(user, order, to, body) {
    const input = body && typeof body === 'object' ? body : {};
    if (!TRANSITIONS[order.status].includes(to)) return transitionError(order.status, to);
    const { errors, value } = validateTransitionBody(to, input);
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', Object.values(errors)[0], errors);

    let note = '';
    if (to === 'dikirim') note = `Kurir ${SHIPPING_METHODS[value.courier].label}, resi ${value.trackingNumber}`;
    if (to === 'selesai') note = 'Pesanan diterima pembeli';
    if (to === 'dibatalkan') note = `${CANCEL_REASONS[value.cancelReason]}${value.cancelNote ? `: ${value.cancelNote}` : ''}. Stok dikembalikan.`;

    const changed = await deps.changeOrderStatus({
      orderId: order.id,
      ownerId: order.storeOwnerId,
      from: order.status,
      to,
      actor: user.username,
      note,
      ...value,
    });
    if (!changed) return fail(409, 'STATUS_CHANGED', TEXT.changedMeanwhile);
    return null;
  }

  // ---------- Admin ----------

  async function listStore(user, query) {
    if (!isAdmin(user)) return fail(403, 'FORBIDDEN', TEXT.forbidden);
    const q = query && typeof query === 'object' ? query : {};
    const read = (k) => (typeof q[k] === 'string' ? q[k] : '');
    const errors = {};
    const status = read('status');
    if (status && !STATUSES.includes(status)) errors.status = 'Status harus diproses, dikirim, selesai, atau dibatalkan';
    const search = read('search').trim();
    if (search.length > 100) errors.search = 'Pencarian maksimal 100 karakter';
    const sort = read('sort') || 'createdAt';
    if (!['createdAt', 'total'].includes(sort)) errors.sort = 'Sort harus createdAt atau total';
    const order = read('order') || 'desc';
    if (!['asc', 'desc'].includes(order)) errors.order = 'Order harus asc atau desc';
    const pageRaw = read('page') || '1';
    if (!/^\d+$/.test(pageRaw) || Number(pageRaw) < 1) errors.page = 'Halaman harus angka bulat mulai dari 1';
    const limitRaw = read('limit') || '10';
    if (!['5', '10', '20', '50'].includes(limitRaw)) errors.limit = 'Limit harus 5, 10, 20, atau 50';
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', 'Parameter tidak valid', errors);

    const page = Number(pageRaw);
    const limit = Number(limitRaw);
    const { total, counts, items } = await deps.listStoreOrders(user.id, { status, search, sort, order, page, limit });
    return {
      status: 200,
      body: { data: items, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), counts } },
    };
  }

  async function getStore(user, orderNumber) {
    if (!isAdmin(user)) return fail(403, 'FORBIDDEN', TEXT.forbidden);
    const order = await deps.getStoreOrder(user.id, String(orderNumber || ''));
    if (!order) return notFound();
    return { status: 200, body: { data: publicOrder(order) } };
  }

  async function changeStatus(user, orderNumber, body) {
    if (!isAdmin(user)) return fail(403, 'FORBIDDEN', TEXT.forbidden);
    const order = await deps.getStoreOrder(user.id, String(orderNumber || ''));
    if (!order) return notFound();
    const to = body && typeof body === 'object' ? body.status : undefined;
    if (!['dikirim', 'selesai', 'dibatalkan'].includes(to)) {
      return fail(400, 'VALIDATION_ERROR', TEXT.statusInvalid, { status: TEXT.statusInvalid });
    }
    const error = await applyTransition(user, { ...order, storeOwnerId: user.id }, to, body);
    if (error) return error;
    return { status: 200, body: { data: publicOrder(await deps.getStoreOrder(user.id, order.orderNumber)) } };
  }

  async function storeProof(user, orderNumber) {
    if (!isAdmin(user)) return fail(403, 'FORBIDDEN', TEXT.forbidden);
    const order = await deps.getStoreOrder(user.id, String(orderNumber || ''));
    if (!order) return notFound();
    return proofImage(order);
  }

  // ---------- Pembeli ----------

  async function findOwn(user, orderNumber) {
    return deps.getOrder(user.id, String(orderNumber || ''));
  }

  async function cancel(user, orderNumber, body) {
    const order = await findOwn(user, orderNumber);
    if (!order) return notFound();
    if (order.status !== 'diproses') return fail(409, 'INVALID_TRANSITION', TEXT.buyerCancelOnly);
    const error = await applyTransition(user, order, 'dibatalkan', body);
    if (error) return error;
    return { status: 200, body: { data: publicOrder(await findOwn(user, order.orderNumber)) } };
  }

  async function uploadProof(user, orderNumber, upload) {
    const order = await findOwn(user, orderNumber);
    if (!order) return notFound();
    if (order.paymentMethod !== 'transfer') return fail(409, 'NOT_ALLOWED', TEXT.proofTransferOnly);
    if (order.status !== 'diproses') return fail(409, 'NOT_ALLOWED', TEXT.proofLocked);

    const type = String(upload.contentType || '').split(';')[0].trim().toLowerCase();
    if (!PROOF_TYPES.includes(type)) return fail(415, 'UNSUPPORTED_MEDIA_TYPE', TEXT.proofType);
    const buffer = upload.buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return fail(400, 'VALIDATION_ERROR', TEXT.proofRequired);
    if (buffer.length > PROOF_MAX_BYTES) return fail(413, 'PAYLOAD_TOO_LARGE', TEXT.proofTooLarge);
    if (!matchesSignature(buffer, type)) return fail(400, 'VALIDATION_ERROR', TEXT.proofMismatch);

    const rawName = typeof upload.fileName === 'string' ? upload.fileName.trim() : '';
    const name = (rawName.replace(/[^\w.\- ]/g, '').slice(0, 80) || `bukti-transfer.${type === 'image/png' ? 'png' : 'jpg'}`);
    await deps.setPaymentProof(order.id, { data: buffer.toString('base64'), type, size: buffer.length, name });
    return { status: 200, body: { data: publicOrder(await findOwn(user, order.orderNumber)) } };
  }

  async function deleteProof(user, orderNumber) {
    const order = await findOwn(user, orderNumber);
    if (!order) return notFound();
    if (order.status !== 'diproses') return fail(409, 'NOT_ALLOWED', TEXT.proofLocked);
    if (!order.paymentProof) return fail(404, 'NOT_FOUND', TEXT.proofNotFound);
    await deps.deletePaymentProof(order.id);
    return { status: 204 };
  }

  async function ownProof(user, orderNumber) {
    const order = await findOwn(user, orderNumber);
    if (!order) return notFound();
    return proofImage(order);
  }

  async function proofImage(order) {
    const proof = await deps.getPaymentProof(order.id);
    if (!proof) return fail(404, 'NOT_FOUND', TEXT.proofNotFound);
    return { status: 200, image: { type: proof.type, buffer: Buffer.from(proof.data, 'base64') } };
  }

  // Pelacakan paket palsu, dibuat dari waktu pesanan dikirim
  async function tracking(user, orderNumber) {
    const order = await findOwn(user, orderNumber);
    if (!order) return notFound();
    const shipped = order.history.find((h) => h.status === 'dikirim');
    if (!shipped || !order.trackingNumber) return fail(409, 'NOT_SHIPPED', TEXT.notShipped);
    const start = new Date(shipped.createdAt).getTime();
    const at = (hours) => new Date(start + hours * 3600 * 1000).toISOString();
    const events = [
      { time: at(0), location: 'Gudang Warung QA, Jakarta', description: 'Paket diserahkan ke kurir' },
      { time: at(3), location: 'Hub Jakarta Timur', description: 'Paket disortir' },
      { time: at(9), location: `Hub ${order.city}`, description: 'Paket tiba di kota tujuan' },
      { time: at(14), location: order.city, description: 'Kurir menuju alamat penerima' },
    ].filter((e) => new Date(e.time).getTime() <= now().getTime());
    const done = order.history.find((h) => h.status === 'selesai');
    if (done) events.push({ time: done.createdAt, location: order.city, description: `Diterima oleh ${order.recipientName}` });
    return {
      status: 200,
      body: {
        data: {
          orderNumber: order.orderNumber,
          courier: order.courier,
          trackingNumber: order.trackingNumber,
          status: order.status,
          events: events.reverse(),
        },
      },
    };
  }

  // Filter riwayat pesanan pembeli: from/to (YYYY-MM-DD, WIB, inklusif)
  function validateDateRange(query) {
    const q = query && typeof query === 'object' ? query : {};
    const from = typeof q.from === 'string' ? q.from : '';
    const to = typeof q.to === 'string' ? q.to : '';
    const errors = {};
    if (from && !isDate(from)) errors.from = TEXT.dateFormat;
    if (to && !isDate(to)) errors.to = TEXT.dateFormat;
    if (!errors.from && !errors.to && from && to && to < from) errors.to = TEXT.dateOrder;
    return { errors, value: { from, to } };
  }

  // ---------- WarungPay ----------

  async function pay(user, body) {
    const input = body && typeof body === 'object' ? body : {};
    const errors = {};
    const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
    if (!phone) errors.phone = TEXT.payPhoneRequired;
    else if (!/^(08\d{8,12}|\+628\d{7,11})$/.test(phone)) errors.phone = TEXT.payPhoneFormat;
    const pin = typeof input.pin === 'string' ? input.pin : '';
    if (!pin) errors.pin = TEXT.payPinRequired;
    else if (!/^\d{6}$/.test(pin)) errors.pin = TEXT.payPinFormat;
    if (!Number.isInteger(input.amount) || input.amount < 1) errors.amount = TEXT.payAmount;
    if (Object.keys(errors).length > 0) return fail(400, 'VALIDATION_ERROR', Object.values(errors)[0], errors);
    if (pin !== WARUNGPAY_PIN) return fail(401, 'PAYMENT_DECLINED', TEXT.payPinWrong, { pin: TEXT.payPinWrong });
    if (input.amount > WARUNGPAY_BALANCE) return fail(402, 'INSUFFICIENT_BALANCE', TEXT.payBalance);

    const ref = deps.newPaymentRef();
    await deps.createPayment({ ref, userId: user.id, phone, amount: input.amount });
    return { status: 201, body: { data: { paymentRef: ref, amount: input.amount, paidAt: now().toISOString() } } };
  }

  return {
    listStore,
    getStore,
    changeStatus,
    storeProof,
    cancel,
    uploadProof,
    deleteProof,
    ownProof,
    tracking,
    validateDateRange,
    pay,
  };
}

// id internal tidak ikut dikirim ke klien
function publicOrder(order) {
  const { id, userId, storeOwnerId, ...rest } = order;
  return rest;
}

function newPaymentRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 8; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `WPY-${suffix}`;
}

module.exports = {
  createOrderService,
  newPaymentRef,
  publicOrder,
  STATUSES,
  TRANSITIONS,
  CANCEL_REASONS,
  TEXT,
  PROOF_MAX_BYTES,
  WARUNGPAY_PIN,
};
