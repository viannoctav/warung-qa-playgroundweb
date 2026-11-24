export const TOAST_EVENT = 'wqa:toast'

// Menampilkan toast di halaman yang sedang terbuka (tanpa pindah halaman)
export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: message }))
}
