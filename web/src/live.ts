import { useEffect, useRef } from 'react'

// Menjalankan fn berkala (default 10 detik) dan setiap tab kembali aktif,
// supaya stok & keranjang yang tampil selalu mengikuti database.
export function useLiveRefresh(fn: () => void, intervalMs = 10000) {
  const latest = useRef(fn)
  latest.current = fn

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') latest.current()
    }
    const timer = window.setInterval(run, intervalMs)
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
    }
  }, [intervalMs])
}
