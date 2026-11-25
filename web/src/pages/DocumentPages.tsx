import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, fetchOrder, fetchTracking } from '../api'
import type { Order, Tracking } from '../api'
import { getToken } from '../auth'
import { StatusPill, formatDateTime } from '../components/OrderStatus'
import { errorMessage } from '../errors'
import { Link } from '../router'
import { formatDateLong, paymentLabel, shippingLabel } from '../validation/checkout'
import { formatRupiah } from '../validation/product'

// Halaman yang dibuka di tab baru (invoice & lacak paket): tanpa header aplikasi, bisa dicetak.

function useLoad<T>(load: (token: string) => Promise<T>, key: string) {
  const token = getToken()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    load(token)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError({ status: err instanceof ApiError ? err.status : 0, message: errorMessage(err) })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key])

  return { token, data, error }
}

function DocShell({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} | Warung QA`
  }, [title])
  return (
    <main className="doc-page" id={id} data-testid={id}>
      <div className="doc-card">{children}</div>
    </main>
  )
}

function DocProblem({ id, token, error }: { id: string; token: string | null; error: { status: number; message: string } | null }) {
  if (!token || error?.status === 401) {
    return (
      <div className="empty-panel" id={`${id}-login-required`} data-testid={`${id}-login-required`}>
        <h1>Sesi tidak ditemukan</h1>
        <p className="muted">Buka halaman ini dari detail pesanan setelah login.</p>
        <Link to="/login" className="btn btn-primary" id={`${id}-login-link`} data-testid={`${id}-login-link`}>
          Masuk
        </Link>
      </div>
    )
  }
  if (error) {
    return (
      <div className="empty-panel" id={`${id}-error`} data-testid={`${id}-error`} role="alert">
        <h1>{error.status === 404 ? 'Pesanan tidak ditemukan' : 'Tidak bisa dibuka'}</h1>
        <p className="muted">{error.message}</p>
      </div>
    )
  }
  return <p className="empty-panel">Memuat…</p>
}

export function InvoicePage({ orderNumber }: { orderNumber: string }) {
  const { token, data: order, error } = useLoad<Order>((t) => fetchOrder(t, orderNumber), orderNumber)

  if (!order) {
    return (
      <DocShell id="invoice-page" title="Invoice">
        <DocProblem id="invoice" token={token} error={error} />
      </DocShell>
    )
  }

  return (
    <DocShell id="invoice-page" title={`Invoice ${order.orderNumber}`}>
      <header className="doc-head">
        <img src="/logo-warung-qa-dark.png" alt="Warung QA" className="doc-logo" width={640} height={570} />
        <div className="doc-head-text">
          <h1 id="invoice-title" data-testid="invoice-title">
            Invoice
          </h1>
          <p className="mono" id="invoice-number" data-testid="invoice-number">
            {order.orderNumber}
          </p>
          <p className="muted" id="invoice-date" data-testid="invoice-date">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <button type="button" className="btn btn-primary no-print" id="invoice-print-btn" data-testid="invoice-print-btn" onClick={() => window.print()}>
          Cetak
        </button>
      </header>

      <div className="doc-grid">
        <section>
          <h2>Ditagihkan ke</h2>
          <p id="invoice-recipient" data-testid="invoice-recipient">
            <b>{order.recipientName}</b>
            <br />
            {order.phone}
            <br />
            {order.address}, {order.city} {order.postalCode}
          </p>
        </section>
        <section>
          <h2>Pembayaran</h2>
          <p id="invoice-payment" data-testid="invoice-payment">
            {paymentLabel(order.paymentMethod)}
            {order.paymentRef ? ` (${order.paymentRef})` : ''}
            <br />
            Kurir {shippingLabel(order.courier ?? order.shippingMethod)}
            {order.shipDate ? `, kirim ${formatDateLong(order.shipDate)}` : ''}
            <br />
            Status <StatusPill status={order.status} id="invoice-status" />
          </p>
        </section>
      </div>

      <div className="table-wrap">
        <table className="data-table" id="invoice-items-table" data-testid="invoice-items-table">
          <thead>
            <tr>
              <th>Produk</th>
              <th className="num">Harga</th>
              <th className="num">Jumlah</th>
              <th className="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(order.items ?? []).map((item, i) => (
              <tr key={`${item.sku}-${i}`} id={`invoice-item-${item.sku}`} data-testid={`invoice-item-${item.sku}`}>
                <td>
                  {item.name} <span className="mono muted">{item.sku}</span>
                </td>
                <td className="num">{formatRupiah(item.price)}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{formatRupiah(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Subtotal</td>
              <td className="num" id="invoice-subtotal" data-testid="invoice-subtotal">
                {formatRupiah(order.subtotal)}
              </td>
            </tr>
            <tr>
              <td colSpan={3}>Ongkir</td>
              <td className="num" id="invoice-shipping-cost" data-testid="invoice-shipping-cost">
                {order.shippingCost === 0 ? 'Gratis' : formatRupiah(order.shippingCost)}
              </td>
            </tr>
            {order.discount > 0 && (
              <tr>
                <td colSpan={3}>Diskon {order.voucherCode}</td>
                <td className="num" id="invoice-discount" data-testid="invoice-discount">
                  −{formatRupiah(order.discount)}
                </td>
              </tr>
            )}
            {order.giftCardDiscount > 0 && (
              <tr>
                <td colSpan={3}>Gift card</td>
                <td className="num" id="invoice-gift-card" data-testid="invoice-gift-card">
                  −{formatRupiah(order.giftCardDiscount)}
                </td>
              </tr>
            )}
            <tr className="doc-total">
              <td colSpan={3}>Total</td>
              <td className="num" id="invoice-total" data-testid="invoice-total">
                {formatRupiah(order.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted doc-foot">Invoice latihan dari Warung QA. Bukan bukti transaksi sungguhan.</p>
    </DocShell>
  )
}

export function TrackingPage({ orderNumber }: { orderNumber: string }) {
  const { token, data, error } = useLoad<Tracking>((t) => fetchTracking(t, orderNumber), orderNumber)

  if (!data) {
    return (
      <DocShell id="tracking-page" title="Lacak paket">
        {error?.status === 409 ? (
          <div className="empty-panel" id="tracking-not-shipped" data-testid="tracking-not-shipped">
            <h1>Paket belum dikirim</h1>
            <p className="muted">{error.message}</p>
          </div>
        ) : (
          <DocProblem id="tracking" token={token} error={error} />
        )}
      </DocShell>
    )
  }

  return (
    <DocShell id="tracking-page" title={`Lacak ${data.orderNumber}`}>
      <header className="doc-head">
        <div className="doc-head-text">
          <h1 id="tracking-title" data-testid="tracking-title">
            Lacak paket
          </h1>
          <p>
            <span className="mono" id="tracking-order-number" data-testid="tracking-order-number">
              {data.orderNumber}
            </span>{' '}
            <StatusPill status={data.status} id="tracking-status" />
          </p>
          <p className="muted">
            Kurir <b id="tracking-courier" data-testid="tracking-courier">{shippingLabel(data.courier)}</b>, resi{' '}
            <b className="mono" id="tracking-number" data-testid="tracking-number">
              {data.trackingNumber}
            </b>
          </p>
        </div>
      </header>
      <ol className="tracking-list" id="tracking-events" data-testid="tracking-events">
        {data.events.map((event, i) => (
          <li key={`${event.time}-${i}`} className={i === 0 ? 'is-latest' : undefined} id={`tracking-event-${i}`} data-testid={`tracking-event-${i}`}>
            <span className="timeline-dot" aria-hidden="true" />
            <div>
              <strong>{event.description}</strong>
              <div className="muted">
                {formatDateTime(event.time)}, {event.location}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="muted doc-foot">Data pelacakan simulasi untuk latihan.</p>
    </DocShell>
  )
}
