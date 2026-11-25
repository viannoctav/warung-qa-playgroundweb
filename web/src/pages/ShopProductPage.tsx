import ProductReviews from '../components/ProductReviews'
import { Stars } from '../components/Reviews'
import { formatRating } from '../validation/review'
import { isBugUser } from '../bugs'
import { useEffect, useState } from 'react'
import { ApiError, addToCart, fetchCart, fetchStoreProduct } from '../api'
import type { Product } from '../api'
import AppShell from '../components/AppShell'
import ProductImage from '../components/ProductImage'
import QuantityStepper from '../components/QuantityStepper'
import { announceCartCount } from '../cart'
import { errorMessage, handleUnauthorized } from '../errors'
import { useLiveRefresh } from '../live'
import { Link, navigate } from '../router'
import { showToast } from '../toast'
import { CHECKOUT_MESSAGES } from '../validation/checkout'
import { categoryLabel, formatRupiah } from '../validation/product'

// available = stok dikurangi yang sudah ada di keranjang akun ini
function quantityError(text: string, stock: number, inCart: number): string | null {
  if (!/^\d+$/.test(text)) return CHECKOUT_MESSAGES.quantity
  const quantity = Number(text)
  if (quantity < 1 || quantity > 99) return CHECKOUT_MESSAGES.quantity
  if (quantity > stock - inCart) {
    return inCart > 0
      ? `Stok tidak cukup. Sisa stok: ${stock}, sudah ${inCart} di keranjangmu`
      : `Stok tidak cukup. Sisa stok: ${stock}`
  }
  return null
}

function ProductDetail({ token, productId }: { token: string; productId: number }) {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'add' | 'buy' | null>(null)
  const [inCart, setInCart] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)

  // Stok produk & isi keranjang diperbarui otomatis tiap 10 detik dan saat tab kembali aktif
  useLiveRefresh(() => setRefreshTick((n) => n + 1))

  useEffect(() => {
    let cancelled = false
    fetchCart(token)
      .then((cart) => {
        if (cancelled) return
        setInCart(cart.items.find((item) => item.product.id === productId)?.quantity ?? 0)
        announceCartCount(cart.itemCount)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [token, productId, refreshTick])

  useEffect(() => {
    let cancelled = false
    fetchStoreProduct(token, productId)
      .then((data) => {
        if (!cancelled) setProduct(data)
      })
      .catch((err: unknown) => {
        if (cancelled || handleUnauthorized(err)) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setServerError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, productId, refreshTick])

  if (loading) {
    return (
      <main className="page" id="shop-product-page" data-testid="shop-product-page">
        <p className="empty-panel" id="shop-product-loading" data-testid="shop-product-loading">
          Memuat produk…
        </p>
      </main>
    )
  }

  if (notFound || !product) {
    return (
      <main className="page" id="shop-product-page" data-testid="shop-product-page">
        <div className="empty-panel" id="shop-product-not-found" data-testid="shop-product-not-found">
          <h1>Produk tidak ditemukan</h1>
          <p className="muted">{serverError ?? 'Produk ini tidak ada atau sudah tidak dijual.'}</p>
          <Link to="/shop" className="btn btn-secondary" id="shop-product-back-link" data-testid="shop-product-back-link">
            Kembali ke toko
          </Link>
        </div>
      </main>
    )
  }

  const soldOut = product.stock === 0
  const available = Math.max(product.stock - inCart, 0)
  const error = touched ? quantityError(quantity, product.stock, inCart) : null

  async function submit(mode: 'add' | 'buy') {
    if (!product || busy) return
    setTouched(true)
    setServerError(null)
    if (quantityError(quantity, product.stock, inCart)) return
    setBusy(mode)
    try {
      // bug_user: Beli sekarang selalu memasukkan 1
      const cart = await addToCart(token, product.id, mode === 'buy' && isBugUser() ? 1 : Number(quantity))
      announceCartCount(cart.itemCount)
      setInCart(cart.items.find((item) => item.product.id === product.id)?.quantity ?? 0)
      if (mode === 'buy') {
        navigate('/checkout')
        return
      }
      showToast(`${quantity} × ${product.name} ditambahkan ke keranjang`)
      setQuantity('1')
      setTouched(false)
    } catch (err) {
      if (!handleUnauthorized(err)) setServerError(errorMessage(err))
      setRefreshTick((n) => n + 1) // stok mungkin berubah, ambil data terbaru
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="page" id="shop-product-page" data-testid="shop-product-page">
      <nav className="breadcrumb" aria-label="Lokasi halaman">
        <Link to="/shop" id="shop-product-breadcrumb-shop" data-testid="shop-product-breadcrumb-shop">
          Toko
        </Link>
        <span aria-hidden="true">/</span>
        <span>{categoryLabel(product.category)}</span>
      </nav>

      <div className="detail-layout">
        <ProductImage
          imageUrl={product.imageUrl}
          name={product.name}
          category={product.category}
          testId="shop-product-image"
          size="large"
        />

        <section className="detail-info">
          <p className="product-card-category" id="shop-product-category" data-testid="shop-product-category">
            {categoryLabel(product.category)}
          </p>
          <h1 id="shop-product-name" data-testid="shop-product-name">
            {product.name}
          </h1>
          <p className="mono muted" id="shop-product-sku" data-testid="shop-product-sku">
            SKU {product.sku}
          </p>
          <p className="detail-price" id="shop-product-price" data-testid="shop-product-price">
            {formatRupiah(product.price)}
          </p>
          {(product.ratingCount ?? 0) > 0 && (
            <a href="#reviews-section" className="rating-link" id="shop-product-rating" data-testid="shop-product-rating">
              <Stars value={product.ratingAverage ?? 0} size="sm" /> {formatRating(product.ratingAverage ?? 0)} ({product.ratingCount} ulasan)
            </a>
          )}
          <p
            className={`product-card-stock${soldOut ? ' is-sold-out' : ''}`}
            id="shop-product-stock"
            data-testid="shop-product-stock"
          >
            {soldOut ? 'Stok habis' : `Stok tersedia: ${product.stock}`}
          </p>
          {inCart > 0 && (
            <p className="muted" id="shop-product-incart" data-testid="shop-product-incart">
              {inCart} sudah di keranjangmu, bisa tambah {available} lagi.
            </p>
          )}
          {product.description && (
            <p className="detail-description" id="shop-product-description" data-testid="shop-product-description">
              {product.description}
            </p>
          )}

          {serverError && (
            <div className="alert alert-error" id="shop-product-error-alert" data-testid="shop-product-error-alert" role="alert">
              {serverError}
            </div>
          )}

          <div className="field">
            <label htmlFor="shop-product-quantity-input">Jumlah</label>
            <QuantityStepper
              idPrefix="shop-product-quantity"
              label="Jumlah"
              value={quantity}
              max={available}
              disabled={available === 0}
              onChange={(value) => {
                setQuantity(value)
                setTouched(true)
              }}
            />
            <div className="field-message">
              {error && (
                <p className="field-error" id="shop-product-quantity-error" data-testid="shop-product-quantity-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="detail-actions">
            <button
              type="button"
              className="btn btn-secondary"
              id="shop-product-add-btn"
              data-testid="shop-product-add-btn"
              disabled={available === 0 || busy !== null}
              onClick={() => submit('add')}
            >
              {busy === 'add' ? 'Menambahkan…' : isBugUser() ? 'Tambah ke keranjnag' : 'Tambah ke keranjang'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              id="shop-product-buy-btn"
              data-testid="shop-product-buy-btn"
              disabled={available === 0 || busy !== null}
              onClick={() => submit('buy')}
            >
              {busy === 'buy' ? 'Memproses…' : 'Beli sekarang'}
            </button>
          </div>
        </section>
      </div>

      <ProductReviews token={token} productId={product.id} productName={product.name} />
    </main>
  )
}

export default function ShopProductPage({ productId }: { productId: number }) {
  return <AppShell>{({ token }) => <ProductDetail token={token} productId={productId} />}</AppShell>
}
