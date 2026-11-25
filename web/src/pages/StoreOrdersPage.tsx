import { useCallback, useEffect, useState } from 'react'
import { ApiError, changeOrderStatus, fetchImageUrl, fetchStoreOrder, fetchStoreOrders } from '../api'
import type { Order, OrderStatus, StatusChange, StoreOrderCounts } from '../api'
import AppShell from '../components/AppShell'
import CancelOrderModal from '../components/CancelOrderModal'
import FormModal from '../components/FormModal'
import { StatusPill, StatusTimeline, formatDateTime } from '../components/OrderStatus'
import { errorMessage, handleUnauthorized } from '../errors'
import { Link, Redirect } from '../router'
import { showToast } from '../toast'
import { SHIPPING_OPTIONS } from '../validation/checkout'
import { STATUS_LABEL, validateShipment } from '../validation/order-status'
import { formatRupiah } from '../validation/product'
import { OrderInfo, OrderSummaryCard } from './OrdersPage'

const TABS: { id: '' | OrderStatus; key: keyof StoreOrderCounts; label: string }[] = [
  { id: '', key: 'all', label: 'Semua' },
  { id: 'diproses', key: 'diproses', label: 'Diproses' },
  { id: 'dikirim', key: 'dikirim', label: 'Dikirim' },
  { id: 'selesai', key: 'selesai', label: 'Selesai' },
  { id: 'dibatalkan', key: 'dibatalkan', label: 'Dibatalkan' },
]
const PAGE_SIZES = [5, 10, 20, 50]

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ---------- Modal Kirim pesanan ----------

function ShipOrderModal({ open, order, onSubmit, onClose }: {
  open: boolean
  order: Order | null
  onSubmit: (courier: string, trackingNumber: string) => Promise<void>
  onClose: () => void
}) {
  const [courier, setCourier] = useState('')
  const [tracking, setTracking] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && order) {
      setCourier(order.shippingMethod)
      setTracking('')
      setTouched(false)
      setServerErrors({})
      setError(null)
    }
  }, [open, order])

  const clientErrors = validateShipment(courier, tracking)
  const errors = { ...(touched ? clientErrors : {}), ...serverErrors }

  async function submit() {
    setTouched(true)
    if (Object.keys(clientErrors).length > 0) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(courier, tracking.trim())
    } catch (err) {
      setServerErrors(err instanceof ApiError ? (err.fields ?? {}) : {})
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormModal
      open={open}
      idPrefix="ship-order-modal"
      title="Kirim pesanan"
      description={order ? `${order.orderNumber} jadi Dikirim. Pembeli bisa melacak paket setelah ini.` : ''}
      submitLabel="Kirim pesanan"
      busyLabel="Menyimpan…"
      busy={busy}
      error={error}
      onSubmit={submit}
      onCancel={onClose}
    >
      <div className="field">
        <label htmlFor="ship-order-courier-select">Kurir</label>
        <select
          id="ship-order-courier-select"
          data-testid="ship-order-courier-select"
          value={courier}
          aria-invalid={errors.courier ? true : undefined}
          onChange={(e) => {
            setCourier(e.target.value)
            setServerErrors({})
          }}
        >
          <option value="">Pilih kurir</option>
          {SHIPPING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="field-message">
          {errors.courier && (
            <p className="field-error" id="ship-order-courier-error" data-testid="ship-order-courier-error">
              {errors.courier}
            </p>
          )}
        </div>
      </div>
      <div className="field">
        <label htmlFor="ship-order-tracking-input">Nomor resi</label>
        <input
          type="text"
          id="ship-order-tracking-input"
          data-testid="ship-order-tracking-input"
          className="mono"
          placeholder="Contoh: JNE1234567890"
          maxLength={25}
          value={tracking}
          aria-invalid={errors.trackingNumber ? true : undefined}
          aria-describedby="ship-order-tracking-hint"
          onChange={(e) => {
            setTracking(e.target.value)
            setServerErrors({})
          }}
        />
        <p className="muted field-hint" id="ship-order-tracking-hint">
          10–20 huruf kapital atau angka, tanpa spasi.
        </p>
        <div className="field-message">
          {errors.trackingNumber && (
            <p className="field-error" id="ship-order-tracking-error" data-testid="ship-order-tracking-error">
              {errors.trackingNumber}
            </p>
          )}
        </div>
      </div>
    </FormModal>
  )
}

// Satu tempat untuk tiga aksi status (dipakai di daftar dan di detail)
function useStatusActions(token: string, onChanged: (order: Order) => void) {
  const [shipTarget, setShipTarget] = useState<Order | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function apply(order: Order, change: StatusChange, message: string) {
    try {
      const updated = await changeOrderStatus(token, order.orderNumber, change)
      onChanged(updated)
      showToast(message)
    } catch (err) {
      if (handleUnauthorized(err)) return
      throw err
    }
  }

  async function complete(order: Order) {
    if (!window.confirm(`Tandai ${order.orderNumber} sebagai Selesai? Status Selesai tidak bisa diubah lagi.`)) return
    setCompleting(order.orderNumber)
    setActionError(null)
    try {
      await apply(order, { status: 'selesai' }, 'Pesanan selesai')
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setCompleting(null)
    }
  }

  const closeShip = useCallback(() => setShipTarget(null), [])
  const closeCancel = useCallback(() => setCancelTarget(null), [])

  const modals = (
    <>
      <ShipOrderModal
        open={shipTarget !== null}
        order={shipTarget}
        onClose={closeShip}
        onSubmit={async (courier, trackingNumber) => {
          if (!shipTarget) return
          await apply(shipTarget, { status: 'dikirim', courier, trackingNumber }, 'Pesanan dikirim')
          setShipTarget(null)
        }}
      />
      <CancelOrderModal
        open={cancelTarget !== null}
        orderNumber={cancelTarget?.orderNumber ?? ''}
        description="Stok produk dikembalikan ke katalog."
        onClose={closeCancel}
        onSubmit={async (input) => {
          if (!cancelTarget) return
          await apply(cancelTarget, { status: 'dibatalkan', reason: input.reason, note: input.note }, 'Pesanan dibatalkan')
          setCancelTarget(null)
        }}
      />
    </>
  )

  return { modals, ship: setShipTarget, cancel: setCancelTarget, complete, completing, actionError, setActionError }
}

function ActionButtons({ order, prefix, actions, compact }: {
  order: Order
  prefix: string
  actions: ReturnType<typeof useStatusActions>
  compact?: boolean
}) {
  const size = compact ? ' btn-sm' : ''
  const no = order.orderNumber
  return (
    <>
      {order.status === 'diproses' && (
        <>
          <button type="button" className={`btn btn-primary${size}`} id={`${prefix}-ship-btn-${no}`} data-testid={`${prefix}-ship-btn-${no}`} onClick={() => actions.ship(order)}>
            Kirim
          </button>
          <button type="button" className={`btn btn-ghost btn-ghost-danger${size}`} id={`${prefix}-cancel-btn-${no}`} data-testid={`${prefix}-cancel-btn-${no}`} onClick={() => actions.cancel(order)}>
            Batalkan
          </button>
        </>
      )}
      {order.status === 'dikirim' && (
        <button
          type="button"
          className={`btn btn-primary${size}`}
          id={`${prefix}-complete-btn-${no}`}
          data-testid={`${prefix}-complete-btn-${no}`}
          disabled={actions.completing === no}
          aria-busy={actions.completing === no}
          onClick={() => actions.complete(order)}
        >
          {actions.completing === no ? 'Menyimpan…' : 'Selesaikan'}
        </button>
      )}
    </>
  )
}

// ---------- Daftar pesanan toko ----------

function StoreOrdersContent({ token, reloadSignal }: { token: string; reloadSignal: number }) {
  const [status, setStatus] = useState<'' | OrderStatus>('')
  const [searchText, setSearchText] = useState('')
  const search = useDebounced(searchText.trim(), 300)
  const [sort, setSort] = useState('createdAt:desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [reloadKey, setReloadKey] = useState(0)
  const [items, setItems] = useState<Order[]>([])
  const [meta, setMeta] = useState<{ total: number; totalPages: number; page: number; counts: StoreOrderCounts } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const actions = useStatusActions(token, () => setReloadKey((k) => k + 1))

  useEffect(() => {
    setPage(1)
  }, [status, search, sort, limit])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const [sortKey, order] = sort.split(':')
    fetchStoreOrders(token, { status, search, sort: sortKey, order, page, limit })
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
  }, [token, status, search, sort, page, limit, reloadKey, reloadSignal])

  return (
    <main className="page" id="store-orders-page" data-testid="store-orders-page">
      <div className="page-head">
        <div>
          <h1 id="store-orders-title" data-testid="store-orders-title">
            Pesanan toko
          </h1>
          <p className="muted" id="store-orders-total" data-testid="store-orders-total">
            {meta ? `${meta.total} pesanan` : 'Memuat…'}
          </p>
        </div>
      </div>

      <div className="status-tabs" role="tablist" aria-label="Filter status">
        {TABS.map((tab) => {
          const active = status === tab.id
          const testId = `store-orders-tab-${tab.id || 'all'}`
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`status-tab${active ? ' is-active' : ''}`}
              id={testId}
              data-testid={testId}
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
              <span className="tab-count" id={`${testId}-count`} data-testid={`${testId}-count`}>
                {meta?.counts[tab.key] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      <div className="toolbar">
        <div className="field toolbar-search">
          <label htmlFor="store-orders-search-input">Cari</label>
          <input
            type="text"
            id="store-orders-search-input"
            data-testid="store-orders-search-input"
            placeholder="Nomor pesanan atau username pembeli"
            maxLength={100}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="store-orders-sort-select">Urutkan</label>
          <select id="store-orders-sort-select" data-testid="store-orders-sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="createdAt:desc">Terbaru</option>
            <option value="createdAt:asc">Terlama</option>
            <option value="total:desc">Total terbesar</option>
            <option value="total:asc">Total terkecil</option>
          </select>
        </div>
      </div>

      {(error || actions.actionError) && (
        <div className="alert alert-error" id="store-orders-error-alert" data-testid="store-orders-error-alert" role="alert">
          {error ?? actions.actionError}
        </div>
      )}

      <div className="table-wrap" aria-busy={loading}>
        <table className="data-table" id="store-orders-table" data-testid="store-orders-table">
          <thead>
            <tr>
              <th>No. pesanan</th>
              <th>Pembeli</th>
              <th>Tanggal</th>
              <th className="num">Total</th>
              <th>Status</th>
              <th className="col-actions">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="table-state" id="store-orders-loading" data-testid="store-orders-loading">
                  Memuat pesanan…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="table-state" id="store-orders-empty" data-testid="store-orders-empty">
                  {search || status ? 'Tidak ada pesanan yang cocok dengan filter ini.' : 'Belum ada pesanan masuk.'}
                </td>
              </tr>
            )}
            {items.map((order) => {
              const no = order.orderNumber
              return (
                <tr key={no} id={`store-orders-row-${no}`} data-testid={`store-orders-row-${no}`}>
                  <td className="mono" id={`store-orders-cell-number-${no}`} data-testid={`store-orders-cell-number-${no}`}>
                    {no}
                  </td>
                  <td id={`store-orders-cell-buyer-${no}`} data-testid={`store-orders-cell-buyer-${no}`}>
                    {order.buyer}
                  </td>
                  <td id={`store-orders-cell-date-${no}`} data-testid={`store-orders-cell-date-${no}`}>
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="num" id={`store-orders-cell-total-${no}`} data-testid={`store-orders-cell-total-${no}`}>
                    {formatRupiah(order.total)}
                  </td>
                  <td>
                    <StatusPill status={order.status} id={`store-orders-cell-status-${no}`} />
                  </td>
                  <td className="col-actions">
                    <ActionButtons order={order} prefix="store-orders" actions={actions} compact />
                    <Link to={`/admin/orders/${no}`} className="btn btn-ghost btn-sm" id={`store-orders-detail-link-${no}`} data-testid={`store-orders-detail-link-${no}`}>
                      Detail
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div className="field pagination-size">
          <label htmlFor="store-orders-page-size-select">Per halaman</label>
          <select id="store-orders-page-size-select" data-testid="store-orders-page-size-select" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="pagination-nav">
          <button type="button" className="btn btn-secondary btn-sm" id="store-orders-page-prev-btn" data-testid="store-orders-page-prev-btn" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
            Sebelumnya
          </button>
          <span id="store-orders-page-info" data-testid="store-orders-page-info" aria-live="polite">
            Halaman {meta?.page ?? page} dari {meta?.totalPages ?? 1}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            id="store-orders-page-next-btn"
            data-testid="store-orders-page-next-btn"
            disabled={loading || !meta || page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </button>
        </div>
      </div>

      {actions.modals}
    </main>
  )
}

export default function StoreOrdersPage() {
  const [reloadSignal, setReloadSignal] = useState(0)
  return (
    <AppShell onReset={() => setReloadSignal((n) => n + 1)}>
      {({ user, token }) => (user && user.role !== 'admin' ? <Redirect to="/shop" /> : <StoreOrdersContent token={token} reloadSignal={reloadSignal} />)}
    </AppShell>
  )
}

// ---------- Detail pesanan toko ----------

function ProofView({ token, order }: { token: string; order: Order }) {
  const [url, setUrl] = useState<string | null>(null)
  const uploadedAt = order.paymentProof?.uploadedAt ?? ''

  useEffect(() => {
    if (!uploadedAt) return
    let created: string | null = null
    let cancelled = false
    fetchImageUrl(token, `/admin/orders/${encodeURIComponent(order.orderNumber)}/payment-proof`)
      .then((u) => {
        created = u
        if (!cancelled) setUrl(u)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [token, order.orderNumber, uploadedAt])

  return (
    <section className="panel-section" id="store-order-proof-section" data-testid="store-order-proof-section">
      <h2>Bukti transfer</h2>
      {order.paymentProof ? (
        <div className="proof-file" id="store-order-proof-file" data-testid="store-order-proof-file">
          {url ? <img src={url} alt="Bukti transfer dari pembeli" id="store-order-proof-preview" data-testid="store-order-proof-preview" /> : <span className="proof-thumb" aria-hidden="true" />}
          <div className="proof-file-info">
            <b id="store-order-proof-name" data-testid="store-order-proof-name">
              {order.paymentProof.name}
            </b>
            <span className="muted">Diunggah {formatDateTime(order.paymentProof.uploadedAt)}</span>
          </div>
        </div>
      ) : (
        <p className="muted" id="store-order-proof-none" data-testid="store-order-proof-none">
          Pembeli belum mengunggah bukti transfer.
        </p>
      )}
    </section>
  )
}

function StoreOrderDetailContent({ token, orderNumber }: { token: string; orderNumber: string }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const actions = useStatusActions(token, setOrder)

  useEffect(() => {
    let cancelled = false
    fetchStoreOrder(token, orderNumber)
      .then((data) => {
        if (!cancelled) setOrder(data)
      })
      .catch((err: unknown) => {
        if (cancelled || handleUnauthorized(err)) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [token, orderNumber])

  if (notFound) {
    return (
      <main className="page" id="store-order-page" data-testid="store-order-page">
        <div className="empty-panel" id="store-order-not-found" data-testid="store-order-not-found">
          <h1>Pesanan tidak ditemukan</h1>
          <p className="muted">Nomor pesanan ini tidak ada di toko kamu.</p>
          <Link to="/admin/orders" className="btn btn-secondary" id="store-order-back-link" data-testid="store-order-back-link">
            Kembali ke Pesanan toko
          </Link>
        </div>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="page" id="store-order-page" data-testid="store-order-page">
        {error ? (
          <div className="alert alert-error" role="alert" id="store-order-error-alert" data-testid="store-order-error-alert">
            {error}
          </div>
        ) : (
          <p className="empty-panel">Memuat pesanan…</p>
        )}
      </main>
    )
  }

  const final = order.status === 'selesai' || order.status === 'dibatalkan'

  return (
    <main className="page" id="store-order-page" data-testid="store-order-page">
      <nav className="breadcrumb" aria-label="Lokasi halaman">
        <Link to="/admin/orders" id="store-order-breadcrumb-orders" data-testid="store-order-breadcrumb-orders">
          Pesanan toko
        </Link>
        <span aria-hidden="true">/</span>
        <span>{order.orderNumber}</span>
      </nav>
      <div className="page-head">
        <div>
          <h1 className="mono order-number-title" id="store-order-number" data-testid="store-order-number">
            {order.orderNumber}
          </h1>
          <p className="muted" id="store-order-meta" data-testid="store-order-meta">
            Dari <b id="store-order-buyer" data-testid="store-order-buyer">{order.buyer}</b>, {formatDateTime(order.createdAt)}
          </p>
        </div>
        <StatusPill status={order.status} id="store-order-status" />
      </div>

      {actions.actionError && (
        <div className="alert alert-error" role="alert" id="store-order-error-alert" data-testid="store-order-error-alert">
          {actions.actionError}
        </div>
      )}

      <div className="cart-layout">
        <section className="panel">
          <h2>Riwayat status</h2>
          <StatusTimeline status={order.status} history={order.history ?? []} idPrefix="store-order" />
          <OrderInfo order={order} prefix="store-order" />
          {order.paymentMethod === 'transfer' && <ProofView token={token} order={order} />}
        </section>
        <div className="side-stack">
          <section className="panel status-panel" id="store-order-status-panel" data-testid="store-order-status-panel">
            <h2>Ubah status</h2>
            <p className="muted" id="store-order-status-hint" data-testid="store-order-status-hint">
              {final
                ? `Status ${STATUS_LABEL[order.status]} sudah final dan tidak bisa diubah.`
                : order.status === 'diproses'
                  ? 'Kirim pesanan dengan nomor resi, atau batalkan (stok kembali).'
                  : 'Tandai Selesai setelah paket diterima pembeli.'}
            </p>
            {!final && (
              <div className="detail-actions">
                <ActionButtons order={order} prefix="store-order" actions={actions} />
              </div>
            )}
          </section>
          <OrderSummaryCard order={order} prefix="store-order" />
        </div>
      </div>

      {actions.modals}
    </main>
  )
}

export function StoreOrderDetailPage({ orderNumber }: { orderNumber: string }) {
  return (
    <AppShell>
      {({ user, token }) => (user && user.role !== 'admin' ? <Redirect to="/shop" /> : <StoreOrderDetailContent token={token} orderNumber={orderNumber} />)}
    </AppShell>
  )
}
