import { useEffect, useState } from 'react'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api'
import type { AppNotification } from '../api'
import AppShell from '../components/AppShell'
import { announceNotificationsChanged } from '../components/NotificationBell'
import { formatDateTime } from '../components/OrderStatus'
import { errorMessage, handleUnauthorized } from '../errors'
import { navigate } from '../router'

function NotificationsContent({ token, reloadSignal }: { token: string; reloadSignal: number }) {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AppNotification[]>([])
  const [meta, setMeta] = useState<{ page: number; totalPages: number; total: number; unread: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setPage(1)
  }, [unreadOnly])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchNotifications(token, { unread: unreadOnly, page, limit: 20 })
      .then((result) => {
        if (cancelled) return
        setItems(result.data)
        setMeta(result.meta)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled && !handleUnauthorized(err)) setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, unreadOnly, page, reload, reloadSignal])

  async function markOne(item: AppNotification) {
    try {
      await markNotificationRead(token, item.id)
      setReload((n) => n + 1)
      announceNotificationsChanged()
    } catch (err) {
      if (!handleUnauthorized(err)) setError(errorMessage(err))
    }
  }

  async function markAll() {
    try {
      await markAllNotificationsRead(token)
      setReload((n) => n + 1)
      announceNotificationsChanged()
    } catch (err) {
      if (!handleUnauthorized(err)) setError(errorMessage(err))
    }
  }

  return (
    <main className="page" id="notifications-page" data-testid="notifications-page">
      <div className="page-head">
        <div>
          <h1 id="notifications-title" data-testid="notifications-title">
            Notifikasi
          </h1>
          <p className="muted" id="notifications-unread" data-testid="notifications-unread">
            {meta ? `${meta.unread} belum dibaca` : 'Memuat…'}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" id="notifications-read-all-btn" data-testid="notifications-read-all-btn" disabled={!meta || meta.unread === 0} onClick={markAll}>
          Tandai semua dibaca
        </button>
      </div>

      <div className="chip-row notif-filter" role="group" aria-label="Filter notifikasi">
        <button type="button" className={`filter-chip${!unreadOnly ? ' is-active' : ''}`} id="notifications-filter-all" data-testid="notifications-filter-all" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>
          Semua
        </button>
        <button type="button" className={`filter-chip${unreadOnly ? ' is-active' : ''}`} id="notifications-filter-unread" data-testid="notifications-filter-unread" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>
          Belum dibaca
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" id="notifications-error-alert" data-testid="notifications-error-alert">
          {error}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="empty-panel" id="notifications-empty" data-testid="notifications-empty">
          {unreadOnly ? 'Semua notifikasi sudah dibaca.' : 'Belum ada notifikasi.'}
        </div>
      )}

      <ul className="notif-page-list" aria-busy={loading}>
        {items.map((item) => (
          <li key={item.id} className={`notif-row${item.isRead ? '' : ' is-unread'}`} id={`notifications-item-${item.id}`} data-testid={`notifications-item-${item.id}`} data-type={item.type} data-read={item.isRead}>
            <span className="notif-dot" aria-hidden="true" />
            <div className="notif-text">
              <b>{item.title}</b>
              <span>{item.body}</span>
              <span className="muted notif-time">{formatDateTime(item.createdAt)}</span>
            </div>
            <div className="notif-row-actions">
              {item.link && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  id={`notifications-open-btn-${item.id}`}
                  data-testid={`notifications-open-btn-${item.id}`}
                  onClick={async () => {
                    if (!item.isRead) await markOne(item)
                    navigate(item.link)
                  }}
                >
                  Buka
                </button>
              )}
              {!item.isRead && (
                <button type="button" className="btn btn-ghost btn-sm" id={`notifications-read-btn-${item.id}`} data-testid={`notifications-read-btn-${item.id}`} onClick={() => markOne(item)}>
                  Tandai dibaca
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {meta && meta.totalPages > 1 && (
        <div className="pagination-nav">
          <button type="button" className="btn btn-secondary btn-sm" id="notifications-page-prev-btn" data-testid="notifications-page-prev-btn" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
            Sebelumnya
          </button>
          <span id="notifications-page-info" data-testid="notifications-page-info">
            Halaman {meta.page} dari {meta.totalPages}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" id="notifications-page-next-btn" data-testid="notifications-page-next-btn" disabled={loading || page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Berikutnya
          </button>
        </div>
      )}
    </main>
  )
}

export default function NotificationsPage() {
  const [reloadSignal, setReloadSignal] = useState(0)
  return (
    <AppShell onReset={() => setReloadSignal((n) => n + 1)}>
      {({ token }) => <NotificationsContent token={token} reloadSignal={reloadSignal} />}
    </AppShell>
  )
}
