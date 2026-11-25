// Validasi keranjang dan checkout (PRD Toko & Checkout).
const { SHIPPING_METHODS, PAYMENT_METHODS } = require('../store/pricing');

const MESSAGES = {
  quantity: 'Jumlah harus angka bulat 1–99',
  productId: 'productId harus berupa id produk',
  recipientNameRequired: 'Nama penerima wajib diisi',
  recipientNameLength: 'Nama penerima harus 3–50 karakter',
  phoneRequired: 'Nomor HP wajib diisi',
  phoneFormat: 'Nomor HP harus diawali 08 atau +628 dan berisi 10–14 digit',
  addressRequired: 'Alamat wajib diisi',
  addressLength: 'Alamat harus 10–200 karakter',
  cityRequired: 'Kota wajib diisi',
  cityLength: 'Kota harus 3–40 karakter',
  postalCodeRequired: 'Kode pos wajib diisi',
  postalCodeFormat: 'Kode pos harus 5 angka',
  notesLength: 'Catatan maksimal 200 karakter',
  shippingMethod: 'Pilih metode pengiriman',
  paymentMethod: 'Pilih metode pembayaran',
  formInvalid: 'Data checkout belum valid. Periksa kembali isian Anda.',
  shipDateRequired: 'Tanggal kirim wajib dipilih',
  shipDateFormat: 'Format tanggal kirim harus YYYY-MM-DD',
  shipDateWeekend: 'Tanggal kirim harus hari kerja (Senin–Jumat)',
  shipDateRange: 'Tanggal kirim paling cepat besok dan paling lambat 14 hari lagi',
  paymentRefRequired: 'Selesaikan pembayaran WarungPay dulu',
};

// Tanggal hari ini di WIB (YYYY-MM-DD)
function todayJakarta(now = new Date()) {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(dateText, days) {
  const d = new Date(`${dateText}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function validateShipDate(value, now = new Date()) {
  if (!value) return MESSAGES.shipDateRequired;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return MESSAGES.shipDateFormat;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return MESSAGES.shipDateFormat;
  const today = todayJakarta(now);
  if (value < addDays(today, 1) || value > addDays(today, 14)) return MESSAGES.shipDateRange;
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return MESSAGES.shipDateWeekend;
  return null;
}

function isQuantity(value) {
  return Number.isInteger(value) && value >= 1 && value <= 99;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lengthError(value, min, max, required, length) {
  if (!value) return required;
  if (value.length < min || value.length > max) return length;
  return null;
}

// Data penerima + metode pengiriman & pembayaran
function validateCheckout(body, now = new Date()) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};
  const value = {
    recipientName: text(input.recipientName).replace(/\s+/g, ' '),
    phone: text(input.phone),
    address: text(input.address),
    city: text(input.city),
    postalCode: text(input.postalCode),
    notes: text(input.notes),
    shippingMethod: input.shippingMethod,
    paymentMethod: input.paymentMethod,
    voucherCode: input.voucherCode,
    giftCardCode: input.giftCardCode,
    shipDate: typeof input.shipDate === 'string' ? input.shipDate.trim() : input.shipDate,
    paymentRef: text(input.paymentRef),
  };

  const set = (field, message) => {
    if (message) errors[field] = message;
  };
  set('recipientName', lengthError(value.recipientName, 3, 50, MESSAGES.recipientNameRequired, MESSAGES.recipientNameLength));
  if (!value.phone) set('phone', MESSAGES.phoneRequired);
  else if (!/^(08\d{8,12}|\+628\d{7,11})$/.test(value.phone)) set('phone', MESSAGES.phoneFormat);
  set('address', lengthError(value.address, 10, 200, MESSAGES.addressRequired, MESSAGES.addressLength));
  set('city', lengthError(value.city, 3, 40, MESSAGES.cityRequired, MESSAGES.cityLength));
  if (!value.postalCode) set('postalCode', MESSAGES.postalCodeRequired);
  else if (!/^\d{5}$/.test(value.postalCode)) set('postalCode', MESSAGES.postalCodeFormat);
  if (value.notes.length > 200) set('notes', MESSAGES.notesLength);
  if (!Object.prototype.hasOwnProperty.call(SHIPPING_METHODS, value.shippingMethod)) set('shippingMethod', MESSAGES.shippingMethod);
  if (!Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, value.paymentMethod)) set('paymentMethod', MESSAGES.paymentMethod);
  set('shipDate', validateShipDate(value.shipDate, now));
  if (value.paymentMethod === 'ewallet' && !value.paymentRef) set('paymentRef', MESSAGES.paymentRefRequired);

  return { errors, value };
}

module.exports = { validateCheckout, validateShipDate, todayJakarta, addDays, isQuantity, MESSAGES };
