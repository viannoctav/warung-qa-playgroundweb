export const CART_EVENT = 'wqa:cart'

// Memberi tahu header jumlah barang terbaru di keranjang (untuk badge)
export function announceCartCount(count: number) {
  window.dispatchEvent(new CustomEvent<number>(CART_EVENT, { detail: count }))
}
