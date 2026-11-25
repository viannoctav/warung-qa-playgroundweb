import { isBugUser } from '../bugs'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { ApiError, cancelOrder, deletePaymentProof, fetchImageUrl, fetchMyReviews, fetchOrder, fetchOrders, uploadPaymentProof } from '../api'
import type { Order, OrderItem, Review } from '../api'
import AppShell from '../components/AppShell'
import CancelOrderModal from '../components/CancelOrderModal'
import { ReviewModal, ReviewStatusChip } from '../components/Reviews'
import { StatusPill, StatusTimeline, formatDateTime } from '../components/OrderStatus'
import { errorMessage, handleUnauthorized } from '../errors'
import { Link } from '../router'
import { showToast } from '../toast'
import { addDays, formatDateLong, paymentLabel, shippingLabel, todayJakarta } from '../validation/checkout'
import { ORDER_MESSAGES, cancelReasonLabel } from '../validation/order-status'
import { formatRupiah } from '../validation/product'

export { formatDateTime }

function formatDateEnglish(iso: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
}

const PROOF_TYPES = ['image/png', 'image/jpeg']
const PROOF_MAX = 1024 * 1024

const PRESETS = [
  { id: 'all', label: 'Semua' },
  { id: 'today', label: 'Hari ini' },
  { id: '7', label: '7 hari' },
  { id: '30', label: '30 hari' },
]

function presetRange(id: string) {
  const today = todayJakarta()
  if (id === 'today') return { from: today, to: today }
  if (id === '7') return { from: addDays(today, -6), to: today }
  if (id === '30') return { from: addDays(today, -29), to: today }
  return { from: '', to: '' }
}

// ---------- Daftar pesanan ----------

function OrdersContent({ token, reloadSignal }: { token: string; reloadSignal: number }) {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preset, setPreset] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const rangeError = from && to && to < from ? ORDER_MESSAGES.dateOrder : null

  useEffect(() => {
    if (rangeError) return
    let cancelled = false
    fetchOrders(token, { from, to })
      .then((data) => {
        if (!cancelled) {
          setOrders(data)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && !handleUnauthorized(err)) setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [token, reloadSignal, from, to, rangeError])

  function choosePreset(id: string) {
    setPreset(id)
    const range = presetRange(id)
    setFrom(range.from)
    setTo(range.to)
  }

  return (
    <main className="page" id="orders-page" data-testid="orders-page">
      <div className="page-head">
        <div>
          <h1 id="orders-title" data-testid="orders-title">
            Pesanan saya
          </h1>
          <p className="muted" id="orders-total" data-testid="orders-total">
            {orders ? `${orders.length} pesanan` : 'Memuat…'}
          </p>
        </div>
      </div>

      <section className="filter-card" aria-label="Filter tanggal">
        <div className="chip-row" role="group" aria-label="Rentang cepat">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`filter-chip${preset === p.id ? ' is-active' : ''}`}
              id={`orders-preset-${p.id}-btn`}
              data-testid={`orders-preset-${p.id}-btn`}
              aria-pressed={preset === p.id}
              onClick={() => choosePreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="date-range">
          <div className="field">
            <label htmlFor="orders-from-input">Dari</label>
            <input
              type="date"
              id="orders-from-input"
              data-testid="orders-from-input"
              value={from}
              max={todayJakarta()}
              onChange={(e) => {
                setFrom(e.target.value)
                setPreset('custom')
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="orders-to-input">Sampai</label>
            <input
              type="date"
              id="orders-to-input"
              data-testid="orders-to-input"
              value={to}
              max={todayJakarta()}
              aria-invalid={rangeError ? true : undefined}
              aria-describedby={rangeError ? 'orders-date-error' : undefined}
              onChange={(e) => {
                setTo(e.target.value)
                setPreset('custom')
              }}
            />
          </div>
        </div>
        <div className="field-message">
          {rangeError && (
            <p className="field-error" id="orders-date-error" data-testid="orders-date-error" role="alert">
              {rangeError}
            </p>
          )}
        </div>
      </section>

      {error && (
        <div className="alert alert-error" id="orders-error-alert" data-testid="orders-error-alert" role="alert">
          {error}
        </div>
      )}

      {orders && orders.length === 0 && (
        <div className="empty-panel" id="orders-empty" data-testid="orders-empty">
          <p>{from || to ? 'Tidak ada pesanan di rentang tanggal ini.' : 'Belum ada pesanan.'}</p>
          <Link to="/shop" className="btn btn-primary" id="orders-shop-link" data-testid="orders-shop-link">
            Mulai belanja
          </Link>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="table-wrap">
          <table className="data-table" id="orders-table" data-testid="orders-table">
            <thead>
              <tr>
                <th>No. pesanan</th>
                <th>Tanggal</th>
                <th className="num">Barang</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th className="col-actions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const id = order.orderNumber
                return (
                  <tr key={id} id={`orders-row-${id}`} data-testid={`orders-row-${id}`}>
                    <td className="mono" id={`orders-cell-number-${id}`} data-testid={`orders-cell-number-${id}`}>
                      {id}
                    </td>
                    <td id={`orders-cell-date-${id}`} data-testid={`orders-cell-date-${id}`}>
                      {isBugUser() ? formatDateEnglish(order.createdAt) : formatDateTime(order.createdAt)}
                    </td>
                    <td className="num" id={`orders-cell-items-${id}`} data-testid={`orders-cell-items-${id}`}>
                      {order.itemCount}
                    </td>
                    <td className="num" id={`orders-cell-total-${id}`} data-testid={`orders-cell-total-${id}`}>
                      {formatRupiah(order.total)}
                    </td>
                    <td>
                      <StatusPill status={order.status} id={`orders-cell-status-${id}`} />
                    </td>
                    <td className="col-actions">
                      <Link to={`/orders/${id}`} className="btn btn-ghost btn-sm" id={`orders-detail-link-${id}`} data-testid={`orders-detail-link-${id}`}>
                        Detail
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

export default function OrdersPage() {
  const [reloadSignal, setReloadSignal] = useState(0)
  return (
    <AppShell onReset={() => setReloadSignal((n) => n + 1)}>
      {({ token }) => <OrdersContent token={token} reloadSignal={reloadSignal} />}
    </AppShell>
  )
}

// ---------- Bukti transfer (drag & drop) ----------

function ProofUpload({ token, order, onOrder }: { token: string; order: Order; onOrder: (order: Order) => void }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editable = order.status === 'diproses'
  const proof = order.paymentProof
  const uploadedAt = proof?.uploadedAt ?? ''

  useEffect(() => {
    if (!uploadedAt) {
      setPreview(null)
      return
    }
    let url: string | null = null
    let cancelled = false
    fetchImageUrl(token, `/orders/${encodeURIComponent(order.orderNumber)}/payment-proof`)
      .then((u) => {
        url = u
        if (!cancelled) setPreview(u)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [token, order.orderNumber, uploadedAt])

  async function upload(file: File | undefined) {
    if (!file || busy) return
    setError(null)
    if ((!PROOF_TYPES.includes(file.type) && !isBugUser()) || file.size > PROOF_MAX) {
      setError(ORDER_MESSAGES.proofType)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setBusy(true)
    try {
      onOrder(await uploadPaymentProof(token, order.orderNumber, file))
      showToast('Bukti transfer diunggah')
    } catch (err) {
      if (!handleUnauthorized(err)) setError(errorMessage(err))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await deletePaymentProof(token, order.orderNumber)
      onOrder({ ...order, paymentProof: null })
      showToast('Bukti transfer dihapus')
    } catch (err) {
      if (!handleUnauthorized(err)) setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (editable) upload(event.dataTransfer.files[0])
  }

  return (
    <section className="panel-section" id="order-proof-section" data-testid="order-proof-section">
      <h2>Bukti transfer</h2>
      {editable && (
        <div
          className={`dropzone${dragging ? ' is-dragging' : ''}`}
          id="order-proof-dropzone"
          data-testid="order-proof-dropzone"
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <strong>{dragging ? 'Lepaskan file di sini' : 'Seret file ke sini'}</strong>
          <span className="muted">atau</span>
          <label className="btn btn-secondary btn-sm" htmlFor="order-proof-input">
            {proof ? 'Ganti file' : 'Pilih file'}
          </label>
          <input
            ref={inputRef}
            type="file"
            className="visually-hidden-file"
            id="order-proof-input"
            data-testid="order-proof-input"
            accept={isBugUser() ? undefined : 'image/png,image/jpeg'}
            disabled={busy}
            onChange={(event) => upload(event.target.files?.[0])}
          />
          <span className="muted">PNG atau JPG, maksimal 1 MB</span>
        </div>
      )}
      {busy && (
        <p className="muted" role="status" id="order-proof-uploading" data-testid="order-proof-uploading">
          Memproses…
        </p>
      )}
      {proof ? (
        <div className="proof-file" id="order-proof-file" data-testid="order-proof-file">
          {preview ? <img src={preview} alt="Bukti transfer" id="order-proof-preview" data-testid="order-proof-preview" /> : <span className="proof-thumb" aria-hidden="true" />}
          <div className="proof-file-info">
            <b id="order-proof-name" data-testid="order-proof-name">
              {proof.name}
            </b>
            <span className="muted">
              {Math.ceil(proof.size / 1024)} KB, diunggah {formatDateTime(proof.uploadedAt)}
            </span>
          </div>
          {editable && (
            <button type="button" className="btn btn-ghost btn-sm btn-ghost-danger" id="order-proof-delete-btn" data-testid="order-proof-delete-btn" disabled={busy} onClick={remove}>
              Hapus
            </button>
          )}
        </div>
      ) : (
        !editable && (
          <p className="muted" id="order-proof-none" data-testid="order-proof-none">
            Tidak ada bukti transfer.
          </p>
        )
      )}
      <div className="field-message">
        {error && (
          <p className="field-error" role="alert" id="order-proof-error" data-testid="order-proof-error">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

// ---------- Detail pesanan & halaman sukses ----------

export function OrderSummaryCard({ order, prefix }: { order: Order; prefix: string }) {
  return (
    <aside className="summary-card" id={`${prefix}-summary`} data-testid={`${prefix}-summary`}>
      <h2>Rincian pembayaran</h2>
      <dl className="summary-list">
        <div>
          <dt>Subtotal</dt>
          <dd id={`${prefix}-subtotal`} data-testid={`${prefix}-subtotal`}>
            {formatRupiah(order.subtotal)}
          </dd>
        </div>
        <div>
          <dt>Ongkir</dt>
          <dd id={`${prefix}-shipping-cost`} data-testid={`${prefix}-shipping-cost`}>
            {order.shippingCost === 0 ? 'Gratis' : formatRupiah(order.shippingCost)}
          </dd>
        </div>
        {order.discount > 0 && (
          <div>
            <dt>Diskon {order.voucherCode}</dt>
            <dd id={`${prefix}-discount`} data-testid={`${prefix}-discount`}>
              −{formatRupiah(order.discount)}
            </dd>
          </div>
        )}
        {order.giftCardDiscount > 0 && (
          <div>
            <dt>Gift card</dt>
            <dd id={`${prefix}-gift-card`} data-testid={`${prefix}-gift-card`}>
              −{formatRupiah(order.giftCardDiscount)}
            </dd>
          </div>
        )}
        <div className="summary-total">
          <dt>Total</dt>
          <dd id={`${prefix}-total`} data-testid={`${prefix}-total`}>
            {formatRupiah(order.total)}
          </dd>
        </div>
      </dl>
    </aside>
  )
}

export function OrderInfo({ order, prefix, reviewCell }: { order: Order; prefix: string; reviewCell?: (item: OrderItem) => ReactNode }) {
  return (
    <>
      <h2>Produk</h2>
      <div className="table-wrap">
        <table className="data-table" id={`${prefix}-items-table`} data-testid={`${prefix}-items-table`}>
          <thead>
            <tr>
              <th>Produk</th>
              <th className="num">Harga</th>
              <th className="num">Jumlah</th>
              <th className="num">Subtotal</th>
              {reviewCell && <th>Ulasan</th>}
            </tr>
          </thead>
          <tbody>
            {(order.items ?? []).map((item, index) => (
              <tr key={`${item.sku}-${index}`} id={`${prefix}-item-${item.sku}`} data-testid={`${prefix}-item-${item.sku}`}>
                <td>
                  {item.name}
                  <div className="mono muted">{item.sku}</div>
                </td>
                <td className="num">{formatRupiah(item.price)}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{formatRupiah(item.subtotal)}</td>
                {reviewCell && <td className="review-cell">{reviewCell(item)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Pengiriman</h2>
      <dl className="info-list" id={`${prefix}-address`} data-testid={`${prefix}-address`}>
        <div>
          <dt>Penerima</dt>
          <dd>
            {order.recipientName} ({order.phone})
          </dd>
        </div>
        <div>
          <dt>Alamat</dt>
          <dd>
            {order.address}, {order.city} {order.postalCode}
          </dd>
        </div>
        {order.notes && (
          <div>
            <dt>Catatan</dt>
            <dd>{order.notes}</dd>
          </div>
        )}
        {order.shipDate && (
          <div>
            <dt>Tanggal kirim</dt>
            <dd id={`${prefix}-ship-date`} data-testid={`${prefix}-ship-date`}>
              {formatDateLong(order.shipDate)}
            </dd>
          </div>
        )}
        <div>
          <dt>Kurir</dt>
          <dd id={`${prefix}-shipping-method`} data-testid={`${prefix}-shipping-method`}>
            {shippingLabel(order.courier ?? order.shippingMethod)}
          </dd>
        </div>
        {order.trackingNumber && (
          <div>
            <dt>Nomor resi</dt>
            <dd className="mono" id={`${prefix}-tracking-number`} data-testid={`${prefix}-tracking-number`}>
              {order.trackingNumber}
            </dd>
          </div>
        )}
        <div>
          <dt>Pembayaran</dt>
          <dd id={`${prefix}-payment-method`} data-testid={`${prefix}-payment-method`}>
            {paymentLabel(order.paymentMethod)}
            {order.paymentRef ? ` (${order.paymentRef})` : ''}
          </dd>
        </div>
        {order.status === 'dibatalkan' && (
          <div>
            <dt>Alasan batal</dt>
            <dd id={`${prefix}-cancel-reason`} data-testid={`${prefix}-cancel-reason`}>
              {cancelReasonLabel(order.cancelReason)}
              {order.cancelNote ? `: ${order.cancelNote}` : ''}
            </dd>
          </div>
        )}
      </dl>
    </>
  )
}

function OrderDetailContent({ token, orderNumber, success }: { token: string; orderNumber: string; success: boolean }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [myReviews, setMyReviews] = useState<Review[]>([])
  const [reviewTarget, setReviewTarget] = useState<OrderItem | null>(null)
  const prefix = success ? 'order-success' : 'order-detail'
  const done = order?.status === 'selesai'

  // Ulasan saya: untuk tombol Beri ulasan / status ulasan di tiap produk pesanan Selesai
  useEffect(() => {
    if (!done || success) return
    let cancelled = false
    fetchMyReviews(token)
      .then((list) => {
        if (!cancelled) setMyReviews(list)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [token, done, success])

  const closeReview = useCallback(() => setReviewTarget(null), [])

  useEffect(() => {
    let cancelled = false
    fetchOrder(token, orderNumber)
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

  const closeCancel = useCallback(() => setCancelOpen(false), [])

  if (notFound || error) {
    return (
      <main className="page" id={`${prefix}-page`} data-testid={`${prefix}-page`}>
        <div className="empty-panel" id="order-not-found" data-testid="order-not-found">
          <h1>Pesanan tidak ditemukan</h1>
          <p className="muted">{error ?? 'Nomor pesanan ini tidak ada di akun kamu.'}</p>
          <Link to="/orders" className="btn btn-secondary" id="order-back-link" data-testid="order-back-link">
            Lihat semua pesanan
          </Link>
        </div>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="page" id={`${prefix}-page`} data-testid={`${prefix}-page`}>
        <p className="empty-panel">Memuat pesanan…</p>
      </main>
    )
  }

  const shipped = order.status === 'dikirim' || order.status === 'selesai'
  const no = encodeURIComponent(order.orderNumber)

  return (
    <main className="page" id={`${prefix}-page`} data-testid={`${prefix}-page`}>
      {success ? (
        <div className="success-banner" id="order-success-banner" data-testid="order-success-banner" role="status">
          <h1 id="order-success-title" data-testid="order-success-title">
            Pesanan berhasil dibuat
          </h1>
          <p>
            Nomor pesanan{' '}
            <strong className="mono" id="order-success-banner-number" data-testid="order-success-banner-number">
              {order.orderNumber}
            </strong>
            . Total{' '}
            <strong id="order-success-banner-total" data-testid="order-success-banner-total">
              {formatRupiah(order.total)}
            </strong>{' '}
            lewat {paymentLabel(order.paymentMethod)}.
            {order.paymentMethod === 'transfer' && ' Unggah bukti transfer di halaman detail pesanan.'}
          </p>
          <div className="detail-actions">
            <Link to={`/orders/${order.orderNumber}`} className="btn btn-primary" id="order-success-detail-link" data-testid="order-success-detail-link">
              Lihat detail pesanan
            </Link>
            <Link to="/shop" className="btn btn-secondary" id="order-success-shop-link" data-testid="order-success-shop-link">
              Belanja lagi
            </Link>
          </div>
        </div>
      ) : (
        <>
          <nav className="breadcrumb" aria-label="Lokasi halaman">
            <Link to="/orders" id="order-detail-breadcrumb-orders" data-testid="order-detail-breadcrumb-orders">
              Pesanan saya
            </Link>
            <span aria-hidden="true">/</span>
            <span>{order.orderNumber}</span>
          </nav>
          <div className="page-head">
            <div>
              <h1 className="mono order-number-title" id="order-detail-number" data-testid="order-detail-number">
                {order.orderNumber}
              </h1>
              <p className="muted" id="order-detail-date" data-testid="order-detail-date">
                {formatDateTime(order.createdAt)}
              </p>
            </div>
            <div className="head-actions">
              <StatusPill status={order.status} id="order-detail-status" />
              {order.status === 'diproses' && (
                <button type="button" className="btn btn-ghost btn-ghost-danger" id="order-detail-cancel-btn" data-testid="order-detail-cancel-btn" onClick={() => setCancelOpen(true)}>
                  Batalkan pesanan
                </button>
              )}
            </div>
          </div>
          {order.status === 'diproses' && (
            <p className="note" id="order-detail-cancel-note" data-testid="order-detail-cancel-note">
              Pesanan masih bisa dibatalkan selama statusnya Diproses.
            </p>
          )}
        </>
      )}

      <div className="cart-layout">
        <section className="panel">
          {!success && (
            <>
              <h2>Riwayat status</h2>
              <StatusTimeline status={order.status} history={order.history ?? []} idPrefix={prefix} />
            </>
          )}
          <OrderInfo
            order={order}
            prefix={prefix}
            reviewCell={
              done && !success
                ? (item) => {
                    if (!item.productId) return <span className="muted">Produk sudah dihapus</span>
                    const mine = myReviews.find((r) => r.productId === item.productId)
                    if (mine) {
                      return (
                        <div className="review-cell-inner">
                          <ReviewStatusChip status={mine.status} id={`order-review-status-${item.productId}`} />
                          {mine.status !== 'disetujui' && (
                            <button type="button" className="btn btn-ghost btn-sm" id={`order-review-edit-btn-${item.productId}`} data-testid={`order-review-edit-btn-${item.productId}`} onClick={() => setReviewTarget(item)}>
                              Ubah
                            </button>
                          )}
                        </div>
                      )
                    }
                    return (
                      <button type="button" className="btn btn-secondary btn-sm" id={`order-review-btn-${item.productId}`} data-testid={`order-review-btn-${item.productId}`} onClick={() => setReviewTarget(item)}>
                        Beri ulasan
                      </button>
                    )
                  }
                : undefined
            }
          />
          {!success && order.paymentMethod === 'transfer' && <ProofUpload token={token} order={order} onOrder={setOrder} />}
          {!success && (
            <section className="panel-section">
              <h2>Dokumen</h2>
              <div className="detail-actions">
                <a
                  href={`/orders/${no}/invoice`}
                  target="_blank"
                  rel="opener"
                  className="btn btn-secondary"
                  id="order-detail-invoice-link"
                  data-testid="order-detail-invoice-link"
                >
                  Cetak invoice (tab baru)
                </a>
                {shipped ? (
                  <a
                    href={`/orders/${no}/tracking`}
                    target="_blank"
                    rel="opener"
                    className="btn btn-secondary"
                    id="order-detail-tracking-link"
                    data-testid="order-detail-tracking-link"
                  >
                    Lacak paket (tab baru)
                  </a>
                ) : (
                  <span className="btn btn-secondary is-disabled" aria-disabled="true" id="order-detail-tracking-link" data-testid="order-detail-tracking-link">
                    Lacak paket (aktif setelah Dikirim)
                  </span>
                )}
              </div>
            </section>
          )}
        </section>
        <OrderSummaryCard order={order} prefix={prefix} />
      </div>

      <ReviewModal
        open={reviewTarget !== null}
        token={token}
        productId={reviewTarget?.productId ?? 0}
        productName={reviewTarget?.name ?? ''}
        review={myReviews.find((r) => r.productId === reviewTarget?.productId) ?? null}
        onClose={closeReview}
        onSaved={(saved) => {
          setMyReviews((list) => [saved, ...list.filter((r) => r.id !== saved.id)])
          setReviewTarget(null)
          showToast('Ulasan dikirim, menunggu moderasi')
        }}
      />

      <CancelOrderModal
        open={cancelOpen}
        orderNumber={order.orderNumber}
        description="Stok produk dikembalikan ke toko."
        onClose={closeCancel}
        onSubmit={async (input) => {
          try {
            const updated = await cancelOrder(token, order.orderNumber, input)
            setOrder(updated)
            setCancelOpen(false)
            showToast('Pesanan dibatalkan')
          } catch (err) {
            if (handleUnauthorized(err)) return
            throw err
          }
        }}
      />
    </main>
  )
}

export function OrderDetailPage({ orderNumber, success = false }: { orderNumber: string; success?: boolean }) {
  return <AppShell>{({ token }) => <OrderDetailContent token={token} orderNumber={orderNumber} success={success} />}</AppShell>
}
