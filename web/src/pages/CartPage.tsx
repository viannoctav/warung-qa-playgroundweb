import { useCallback, useEffect, useState } from 'react'
import { clearCart, fetchCart, removeCartItem, updateCartItem } from '../api'
import type { Cart, CartItem } from '../api'
import AppShell from '../components/AppShell'
import ConfirmModal from '../components/ConfirmModal'
import ProductImage from '../components/ProductImage'
import QuantityStepper from '../components/QuantityStepper'
import { announceCartCount } from '../cart'
import { errorMessage, handleUnauthorized } from '../errors'
import { useLiveRefresh } from '../live'
import { Link, navigate } from '../router'
import { showToast } from '../toast'
import { CHECKOUT_MESSAGES } from '../validation/checkout'
import { formatRupiah } from '../validation/product'

function CartLine({ item, token, onCart, onError }: {
  item: CartItem
  token: string
  onCart: (cart: Cart) => void
  onError: (productId: number, message: string | null) => void
}) {
  const { product } = item
  const id = product.id
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [busy, setBusy] = useState(false)
  const [lineError, setLineError] = useState<string | null>(null)

  useEffect(() => {
    setQuantity(String(item.quantity))
  }, [item.quantity])

  async function commit(next: number) {
    if (busy || next === item.quantity) return
    if (!Number.isInteger(next) || next < 1 || next > 99) {
      setLineError(CHECKOUT_MESSAGES.quantity)
      return
    }
    setBusy(true)
    setLineError(null)
    onError(id, null)
    try {
      onCart(await updateCartItem(token, id, next))
    } catch (err) {
      if (handleUnauthorized(err)) return
      setLineError(errorMessage(err))
      setQuantity(String(item.quantity))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      onCart(await removeCartItem(token, id))
      showToast(`${product.name} dihapus dari keranjang`)
    } catch (err) {
      if (!handleUnauthorized(err)) onError(id, errorMessage(err))
      setBusy(false)
    }
  }

  const typedError = /^\d+$/.test(quantity) && Number(quantity) >= 1 && Number(quantity) <= 99 ? null : CHECKOUT_MESSAGES.quantity
  const message = lineError ?? (quantity !== String(item.quantity) ? typedError : null) ?? item.problem

  return (
    <li className={`cart-line${item.problem ? ' has-problem' : ''}`} id={`cart-item-${id}`} data-testid={`cart-item-${id}`}>
      <ProductImage
        imageUrl={product.imageUrl}
        name={product.name}
        category={product.category}
        testId={`cart-item-image-${id}`}
        size="thumb"
      />
      <div className="cart-line-info">
        <Link to={`/shop/${id}`} className="cart-line-name" id={`cart-item-name-${id}`} data-testid={`cart-item-name-${id}`}>
          {product.name}
        </Link>
        <span className="muted" id={`cart-item-price-${id}`} data-testid={`cart-item-price-${id}`}>
          {formatRupiah(product.price)}
        </span>
        <div className="field-message">
          {message && (
            <p className="field-error" id={`cart-item-error-${id}`} data-testid={`cart-item-error-${id}`} role="alert">
              {message}
            </p>
          )}
        </div>
      </div>
      <QuantityStepper
        idPrefix={`cart-item-quantity-${id}`}
        label={`Jumlah ${product.name}`}
        value={quantity}
        max={Math.max(product.stock, item.quantity)}
        disabled={busy}
        onChange={(value) => {
          setQuantity(value)
          setLineError(null)
        }}
        onCommit={commit}
      />
      <span className="cart-line-subtotal" id={`cart-item-subtotal-${id}`} data-testid={`cart-item-subtotal-${id}`}>
        {formatRupiah(item.subtotal)}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-ghost-danger"
        id={`cart-item-remove-btn-${id}`}
        data-testid={`cart-item-remove-btn-${id}`}
        aria-label={`Hapus ${product.name} dari keranjang`}
        disabled={busy}
        onClick={remove}
      >
        Hapus
      </button>
    </li>
  )
}

function CartContent({ token, reloadSignal }: { token: string; reloadSignal: number }) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  // Stok berubah (dibeli akun lain / diubah admin) langsung terlihat di keranjang
  useLiveRefresh(() => setRefreshTick((n) => n + 1))

  const applyCart = useCallback((next: Cart) => {
    setCart(next)
    announceCartCount(next.itemCount)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchCart(token)
      .then((data) => {
        if (!cancelled) applyCart(data)
      })
      .catch((err: unknown) => {
        if (!cancelled && !handleUnauthorized(err)) setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [token, reloadSignal, refreshTick, applyCart])

  const cancelClear = useCallback(() => setConfirmClear(false), [])

  async function handleClear() {
    setClearing(true)
    try {
      await clearCart(token)
      applyCart({ items: [], itemCount: 0, subtotal: 0, hasProblem: false })
      showToast('Keranjang dikosongkan')
    } catch (err) {
      if (!handleUnauthorized(err)) setError(errorMessage(err))
    } finally {
      setClearing(false)
      setConfirmClear(false)
    }
  }

  return (
    <main className="page" id="cart-page" data-testid="cart-page">
      <div className="page-head">
        <div>
          <h1 id="cart-title" data-testid="cart-title">
            Keranjang
          </h1>
          <p className="muted" id="cart-total-items" data-testid="cart-total-items">
            {cart ? `${cart.itemCount} barang` : 'Memuat…'}
          </p>
        </div>
        {cart && cart.items.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-ghost-danger"
            id="cart-clear-btn"
            data-testid="cart-clear-btn"
            onClick={() => setConfirmClear(true)}
          >
            Kosongkan keranjang
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error" id="cart-error-alert" data-testid="cart-error-alert" role="alert">
          {error}
        </div>
      )}

      {cart && cart.items.length === 0 && (
        <div className="empty-panel" id="cart-empty" data-testid="cart-empty">
          <p>Keranjang masih kosong.</p>
          <Link to="/shop" className="btn btn-primary" id="cart-shop-link" data-testid="cart-shop-link">
            Mulai belanja
          </Link>
        </div>
      )}

      {cart && cart.items.length > 0 && (
        <div className="cart-layout">
          <ul className="cart-lines" id="cart-items" data-testid="cart-items">
            {cart.items.map((item) => (
              <CartLine
                key={item.product.id}
                item={item}
                token={token}
                onCart={applyCart}
                onError={(_, message) => setError(message)}
              />
            ))}
          </ul>

          <aside className="summary-card" id="cart-summary" data-testid="cart-summary">
            <h2>Ringkasan</h2>
            <dl className="summary-list">
              <div>
                <dt>Total barang</dt>
                <dd id="cart-summary-count" data-testid="cart-summary-count">
                  {cart.itemCount}
                </dd>
              </div>
              <div className="summary-total">
                <dt>Subtotal</dt>
                <dd id="cart-summary-subtotal" data-testid="cart-summary-subtotal">
                  {formatRupiah(cart.subtotal)}
                </dd>
              </div>
            </dl>
            {cart.hasProblem && (
              <p className="note" id="cart-problem-note" data-testid="cart-problem-note">
                Perbaiki produk yang ditandai merah sebelum checkout.
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary btn-block"
              id="cart-checkout-btn"
              data-testid="cart-checkout-btn"
              disabled={cart.hasProblem}
              onClick={() => navigate('/checkout')}
            >
              Lanjut ke checkout
            </button>
            <Link to="/shop" className="btn btn-ghost btn-block" id="cart-continue-link" data-testid="cart-continue-link">
              Lanjut belanja
            </Link>
          </aside>
        </div>
      )}

      <ConfirmModal
        open={confirmClear}
        title="Kosongkan keranjang?"
        message="Semua produk di keranjang akan dihapus."
        confirmLabel="Kosongkan"
        busyLabel="Mengosongkan…"
        busy={clearing}
        onConfirm={handleClear}
        onCancel={cancelClear}
      />
    </main>
  )
}

export default function CartPage() {
  const [reloadSignal, setReloadSignal] = useState(0)
  return (
    <AppShell onReset={() => setReloadSignal((n) => n + 1)}>
      {({ token }) => <CartContent token={token} reloadSignal={reloadSignal} />}
    </AppShell>
  )
}
