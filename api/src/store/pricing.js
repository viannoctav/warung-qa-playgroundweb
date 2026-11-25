// Ongkir, metode pembayaran, voucher, dan perhitungan total (PRD Toko & Checkout).

const SHIPPING_METHODS = {
  reguler: { label: 'Reguler (3–5 hari)', cost: 10000 },
  express: { label: 'Express (1–2 hari)', cost: 20000 },
  sameday: { label: 'Same Day', cost: 35000 },
};

const PAYMENT_METHODS = {
  transfer: 'Transfer bank',
  ewallet: 'E-wallet',
  cod: 'Bayar di tempat (COD)',
};

const COD_MAX_TOTAL = 1000000;

const VOUCHERS = {
  HEMAT10: { description: 'Diskon 10% (maks Rp 50.000), min. belanja Rp 100.000', type: 'percent', value: 10, max: 50000, minSubtotal: 100000 },
  WARUNG25K: { description: 'Potongan Rp 25.000, min. belanja Rp 150.000', type: 'fixed', value: 25000, minSubtotal: 150000 },
  ONGKIRGRATIS: { description: 'Gratis ongkir, min. belanja Rp 50.000', type: 'shipping', minSubtotal: 50000 },
  FLASH15: { description: 'Flash sale: diskon 15% (maks Rp 30.000), min. belanja Rp 75.000', type: 'percent', value: 15, max: 30000, minSubtotal: 75000 },
  KADALUARSA: { description: 'Voucher yang sudah kedaluwarsa (untuk latihan)', type: 'expired' },
};

// Gift card latihan: potongan nominal tetap, dipakai setelah voucher
const GIFT_CARDS = {
  'GIFT-7788-WQA': 20000,
  'GIFT-5000-WQA': 50000,
};

const GIFT_CARD_MESSAGES = {
  notFound: 'Kode gift card tidak ditemukan',
};

const VOUCHER_MESSAGES = {
  notFound: 'Kode voucher tidak ditemukan',
  expired: 'Voucher sudah kedaluwarsa',
};

function formatRupiah(value) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
}

function normalizeVoucher(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

/**
 * Cek voucher terhadap subtotal.
 * Mengembalikan { voucher, error } — error berupa teks pesan, atau null kalau valid / tidak dipakai.
 */
function checkVoucher(code, subtotal) {
  const normalized = normalizeVoucher(code);
  if (!normalized) return { code: null, voucher: null, error: null };
  const voucher = VOUCHERS[normalized];
  if (!voucher) return { code: normalized, voucher: null, error: VOUCHER_MESSAGES.notFound };
  if (voucher.type === 'expired') return { code: normalized, voucher: null, error: VOUCHER_MESSAGES.expired };
  if (subtotal < voucher.minSubtotal) {
    return { code: normalized, voucher: null, error: `Minimal belanja ${formatRupiah(voucher.minSubtotal)} untuk voucher ini` };
  }
  return { code: normalized, voucher, error: null };
}

/**
 * Hitung ringkasan belanja dari item keranjang.
 * items: [{ price, quantity }]
 */
function checkGiftCard(code) {
  const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!normalized) return { code: null, amount: 0, error: null };
  if (!GIFT_CARDS[normalized]) return { code: normalized, amount: 0, error: GIFT_CARD_MESSAGES.notFound };
  return { code: normalized, amount: GIFT_CARDS[normalized], error: null };
}

function computeSummary(items, shippingMethod, voucherCode, giftCardCode) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = SHIPPING_METHODS[shippingMethod];
  let shippingCost = shipping ? shipping.cost : 0;
  const { code, voucher, error } = checkVoucher(voucherCode, subtotal);

  let discount = 0;
  if (voucher && voucher.type === 'percent') discount = Math.min(Math.floor((subtotal * voucher.value) / 100), voucher.max);
  if (voucher && voucher.type === 'fixed') discount = Math.min(voucher.value, subtotal);
  if (voucher && voucher.type === 'shipping') shippingCost = 0;

  const gift = checkGiftCard(giftCardCode);
  const beforeGift = subtotal - discount + shippingCost;
  const giftCardDiscount = Math.min(gift.amount, beforeGift);

  return {
    itemCount,
    subtotal,
    shippingCost,
    discount,
    giftCardDiscount,
    total: beforeGift - giftCardDiscount,
    voucherCode: voucher ? code : null,
    voucherError: error,
    giftCardCode: gift.error ? null : gift.code,
    giftCardError: gift.error,
  };
}

module.exports = {
  SHIPPING_METHODS,
  PAYMENT_METHODS,
  COD_MAX_TOTAL,
  VOUCHERS,
  VOUCHER_MESSAGES,
  GIFT_CARDS,
  GIFT_CARD_MESSAGES,
  checkVoucher,
  checkGiftCard,
  computeSummary,
  formatRupiah,
};
