import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api'
import type { AppNotification } from '../api'
import { Link, navigate } from '../router'
import { formatDateTime } from './OrderStatus'

export const NOTIFICATIONS_EVENT = 'wqa:notifications-changed'
const POLL_MS = 5000
const POPUP_MS = 6000

// Beri tahu lonceng supaya langsung mengambil ulang (misalnya setelah ditandai dibaca di halaman Notifikasi)
export function announceNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT))
}

// Lonceng notifikasi: cek otomatis tiap 5 detik, pop-up kecil saat ada notifikasi baru
export default function NotificationBell({ token }: { token: string }) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [panelTop, setPanelTop] = useState(72)
  const [popups, setPopups] = useState<AppNotification[]>([])
  const lastSeenId = useRef<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    try {
      const result = await fetchNotifications(token, { limit: 10 })
      setItems(result.data)
      setUnread(result.meta.unread)
      const newest = result.data[0]?.id ?? 0
      // Kunjungan pertama: hanya catat id terakhir, tanpa pop-up untuk notifikasi lama
      if (lastSeenId.current !== null) {
        const fresh = result.data.filter((n) => n.id > (lastSeenId.current ?? 0) && !n.isRead).reverse()
        if (fresh.length > 0) setPopups((list) => [...list, ...fresh].slice(-3))
      }
      lastSeenId.current = Math.max(lastSeenId.current ?? 0, newest)
    } catch {
      // Gagal sesekali tidak apa-apa: dicoba lagi di putaran berikutnya
    }
  }, [token])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, POLL_MS)
    window.addEventListener(NOTIFICATIONS_EVENT, load)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(NOTIFICATIONS_EVENT, load)
    }
  }, [load])

  // Pop-up hilang sendiri setelah 6 detik
  useEffect(() => {
    if (popups.length === 0) return
    const timer = window.setTimeout(() => setPopups((list) => list.slice(1)), POPUP_MS)
    return () => window.clearTimeout(timer)
  }, [popups])

  // Tutup panel saat klik di luar / Esc
  useEffect(() => {
    if (!open) return
    function onDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function openItem(item: AppNotification) {
    setOpen(false)
    setPopups((list) => list.filter((n) => n.id !== item.id))
    if (!item.isRead) {
      try {
        await markNotificationRead(token, item.id)
      } catch {
        // tetap buka halamannya
      }
      load()
    }
    if (item.link) navigate(item.link)
  }

  async function readAll() {
    try {
      await markAllNotificationsRead(token)
    } finally {
      load()
    }
  }

  return (
    <div className="notif" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="notif-btn"
        id="header-notif-btn"
        data-testid="header-notif-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="header-notif-panel"
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
        onClick={() => {
          // Di HP panel menempel ke lebar layar, tepat di bawah tombol
          if (buttonRef.current) setPanelTop(buttonRef.current.getBoundingClientRect().bottom + 8)
          setOpen((v) => !v)
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0-6 6v3.6l-1.7 2.9A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.5L18 12.6V9a6 6 0 0 0-6-6Zm-2.6 15.5a2.7 2.7 0 0 0 5.2 0Z" fill="currentColor" />
        </svg>
        {unread > 0 && (
          <span className="notif-count" id="header-notif-count" data-testid="header-notif-count">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel" id="header-notif-panel" data-testid="header-notif-panel" role="dialog" aria-label="Notifikasi" style={{ '--notif-top': `${panelTop}px` } as CSSProperties}>
          <div className="notif-panel-head">
            <strong>Notifikasi</strong>
            <button type="button" className="link-btn" id="header-notif-read-all-btn" data-testid="header-notif-read-all-btn" disabled={unread === 0} onClick={readAll}>
              Tandai semua dibaca
            </button>
          </div>
          {items.length === 0 ? (
            <p className="muted notif-empty" id="header-notif-empty" data-testid="header-notif-empty">
              Belum ada notifikasi.
            </p>
          ) : (
            <ul className="notif-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`notif-item${item.isRead ? '' : ' is-unread'}`}
                    id={`header-notif-item-${item.id}`}
                    data-testid={`header-notif-item-${item.id}`}
                    data-type={item.type}
                    data-read={item.isRead}
                    onClick={() => openItem(item)}
                  >
                    <span className="notif-dot" aria-hidden="true" />
                    <span className="notif-text">
                      <b>{item.title}</b>
                      <span>{item.body}</span>
                      <span className="muted notif-time">{formatDateTime(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" className="notif-all" id="header-notif-all-link" data-testid="header-notif-all-link" onClick={() => setOpen(false)}>
            Lihat semua notifikasi
          </Link>
        </div>
      )}

      <div className="notif-popups" aria-live="polite" id="notif-popups" data-testid="notif-popups">
        {popups.map((item) => (
          <div key={item.id} className="notif-popup" id={`notif-popup-${item.id}`} data-testid={`notif-popup-${item.id}`} data-type={item.type}>
            <button type="button" className="notif-popup-body" id={`notif-popup-open-btn-${item.id}`} data-testid={`notif-popup-open-btn-${item.id}`} onClick={() => openItem(item)}>
              <b>{item.title}</b>
              <span>{item.body}</span>
            </button>
            <button type="button" className="notif-popup-close" id={`notif-popup-close-btn-${item.id}`} data-testid={`notif-popup-close-btn-${item.id}`} aria-label="Tutup notifikasi" onClick={() => setPopups((list) => list.filter((n) => n.id !== item.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
