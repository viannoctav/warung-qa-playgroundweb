// Isi notifikasi untuk setiap kejadian. Teks sama persis di API dan web.
const { formatRupiah, SHIPPING_METHODS } = require('../store/pricing');

const LOW_STOCK_THRESHOLD = 5;

const courierLabel = (value) => (SHIPPING_METHODS[value] ? SHIPPING_METHODS[value].label : value);

const messages = {
  orderNew: (order, buyer) => ({
    type: 'order_new',
    title: 'Pesanan baru',
    body: `${buyer} membuat pesanan ${order.orderNumber} senilai ${formatRupiah(order.total)}.`,
    link: `/admin/orders/${order.orderNumber}`,
  }),
  stockLow: (product) => ({
    type: 'stock_low',
    title: 'Stok menipis',
    body: product.stock === 0 ? `${product.name} habis.` : `${product.name} tinggal ${product.stock}.`,
    link: `/products/${product.id}/edit`,
  }),
  orderShipped: (order) => ({
    type: 'order_shipped',
    title: 'Pesanan dikirim',
    body: `${order.orderNumber} dikirim lewat ${courierLabel(order.courier)}, resi ${order.trackingNumber}.`,
    link: `/orders/${order.orderNumber}`,
  }),
  orderDone: (order) => ({
    type: 'order_done',
    title: 'Pesanan selesai',
    body: `${order.orderNumber} sudah diterima. Beri ulasan untuk produknya.`,
    link: `/orders/${order.orderNumber}`,
  }),
  orderCancelledByStore: (order, reasonLabel) => ({
    type: 'order_cancelled',
    title: 'Pesanan dibatalkan toko',
    body: `${order.orderNumber} dibatalkan: ${reasonLabel}. Stok dikembalikan.`,
    link: `/orders/${order.orderNumber}`,
  }),
  orderCancelledByBuyer: (order, buyer) => ({
    type: 'order_cancelled',
    title: 'Pesanan dibatalkan pembeli',
    body: `${buyer} membatalkan ${order.orderNumber}.`,
    link: `/admin/orders/${order.orderNumber}`,
  }),
  reviewNew: (review) => ({
    type: 'review_new',
    title: 'Ulasan baru menunggu',
    body: `${review.author} memberi ${review.rating} bintang untuk ${review.productName}.`,
    link: '/products/reviews',
  }),
  reviewApproved: (review) => ({
    type: 'review_approved',
    title: 'Ulasan disetujui',
    body: `Ulasan kamu untuk ${review.productName} sudah tampil di toko.`,
    link: `/shop/${review.productId}`,
  }),
  reviewRejected: (review) => ({
    type: 'review_rejected',
    title: 'Ulasan ditolak',
    body: `Ulasan kamu untuk ${review.productName} ditolak: ${review.rejectReason}. Ubah lalu kirim lagi.`,
    link: `/shop/${review.productId}`,
  }),
};

module.exports = { messages, LOW_STOCK_THRESHOLD };
