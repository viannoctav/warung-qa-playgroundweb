import { useEffect, useState } from 'react'
import { ApiError, fetchOrder, fetchOrders } from '../api'
import type { Order } from '../api'
import AppShell from '../components/AppShell'
import { errorMessage, handleUnauthorized } from '../errors'
import { Link } from '../router'
import { paymentLabel, shippingLabel } from '../validation/checkout'
import { formatRupiah } from '../validation/product'

const STATUS_LABEL: Record<string, string> = { diproses: 'Diproses' }

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))
}

function OrdersContent({ token, reloadSignal }: { token: string; reloadSignal: number }) {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchOrders(token)
      .then((data) => {
        if (!cancelled) setOrders(data)
      })
      .catch((err: unknown) => {
        if (!cancelled && !handleUnauthorized(err)) setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [token, reloadSignal])

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

      {error && (
        <div className="alert alert-error" id="orders-error-alert" data-testid="orders-error-alert" role="alert">
          {error}
        </div>
      )}

      {orders && orders.length === 0 && (
        <div className="empty-panel" id="orders-empty" data-testid="orders-empty">
          <p>Belum ada pesanan.</p>
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
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="num" id={`orders-cell-items-${id}`} data-testid={`orders-cell-items-${id}`}>
                      {order.itemCount}
                    </td>
                    <td className="num" id={`orders-cell-total-${id}`} data-testid={`orders-cell-total-${id}`}>
                      {formatRupiah(order.total)}
                    </td>
                    <td>
                      <span className="pill pill-on" id={`orders-cell-status-${id}`} data-testid={`orders-cell-status-${id}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
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

// ---------- Detail pesanan & halaman sukses ----------

function OrderDetailContent({ token, orderNumber, success }: { token: string; orderNumber: string; success: boolean }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefix = success ? 'order-success' : 'order-detail'

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
            . Total yang harus dibayar{' '}
            <strong id="order-success-banner-total" data-testid="order-success-banner-total">
              {formatRupiah(order.total)}
            </strong>{' '}
            lewat {paymentLabel(order.paymentMethod)}.
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
              <h1 className="mono" id="order-detail-number" data-testid="order-detail-number">
                {order.orderNumber}
              </h1>
              <p className="muted" id="order-detail-date" data-testid="order-detail-date">
                {formatDateTime(order.createdAt)}
              </p>
            </div>
            <span className="pill pill-on" id="order-detail-status" data-testid="order-detail-status">
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>
        </>
      )}

      <div className="cart-layout">
        <section className="panel">
          <h2>Produk</h2>
          <div className="table-wrap">
            <table className="data-table" id={`${prefix}-items-table`} data-testid={`${prefix}-items-table`}>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th className="num">Harga</th>
                  <th className="num">Jumlah</th>
                  <th className="num">Subtotal</th>
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
            <div>
              <dt>Kurir</dt>
              <dd id={`${prefix}-shipping-method`} data-testid={`${prefix}-shipping-method`}>
                {shippingLabel(order.shippingMethod)}
              </dd>
            </div>
            <div>
              <dt>Pembayaran</dt>
              <dd id={`${prefix}-payment-method`} data-testid={`${prefix}-payment-method`}>
                {paymentLabel(order.paymentMethod)}
              </dd>
            </div>
          </dl>
        </section>

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
            <div className="summary-total">
              <dt>Total</dt>
              <dd id={`${prefix}-total`} data-testid={`${prefix}-total`}>
                {formatRupiah(order.total)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </main>
  )
}

export function OrderDetailPage({ orderNumber, success = false }: { orderNumber: string; success?: boolean }) {
  return <AppShell>{({ token }) => <OrderDetailContent token={token} orderNumber={orderNumber} success={success} />}</AppShell>
}
