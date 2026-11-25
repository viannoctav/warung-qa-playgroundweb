import { formatRating } from '../validation/review'
import { isBugUser } from '../bugs'
import { useEffect, useRef, useState } from 'react'
import { addToCart, fetchCart, fetchStoreProducts } from '../api'
import type { Cart, ProductListResult } from '../api'
import AppShell from '../components/AppShell'
import CategoryMultiSelect from '../components/CategoryMultiSelect'
import FlashSale from '../components/FlashSale'
import PriceRange from '../components/PriceRange'
import ProductImage from '../components/ProductImage'
import { announceCartCount } from '../cart'
import { errorMessage, handleUnauthorized } from '../errors'
import { useLiveRefresh } from '../live'
import { Link } from '../router'
import { showToast } from '../toast'
import { CATEGORY_OPTIONS, categoryLabel, formatRupiah } from '../validation/product'

const PAGE_SIZES = [12, 24, 48]
const PRICE_MIN = 0
const PRICE_MAX = 100000

// Pilihan urutan: nilai = "sort:order"
const SORT_OPTIONS = [
  { value: 'featured:asc', label: 'Pilihan admin' },
  { value: 'name:asc', label: 'Nama A–Z' },
  { value: 'name:desc', label: 'Nama Z–A' },
  { value: 'price:asc', label: 'Harga termurah' },
  { value: 'price:desc', label: 'Harga termahal' },
  { value: 'createdAt:desc', label: 'Terbaru' },
]

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function ShopContent({ token, reloadSignal }: { token: string; reloadSignal: number }) {
  const [searchText, setSearchText] = useState('')
  const search = useDebounced(searchText.trim(), 300)
  const [categories, setCategories] = useState<string[]>([])
  const [priceInput, setPriceInput] = useState<[number, number]>([PRICE_MIN, PRICE_MAX])
  const price = useDebounced(priceInput, 300)
  const [sortValue, setSortValue] = useState('featured:asc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(12)
  const [result, setResult] = useState<ProductListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Setiap tombol punya status sendiri: klik satu produk tidak mengunci produk lain
  const [pending, setPending] = useState<Set<number>>(new Set())
  const [justAdded, setJustAdded] = useState<Set<number>>(new Set())
  const [cartQty, setCartQty] = useState<Map<number, number>>(new Map())
  const [refreshTick, setRefreshTick] = useState(0)

  function applyCart(cart: Cart) {
    setCartQty(new Map(cart.items.map((item) => [item.product.id, item.quantity])))
    announceCartCount(cart.itemCount)
  }

  // Isi keranjang dibaca dari server (untuk menghitung sisa stok yang masih bisa ditambah)
  useEffect(() => {
    let cancelled = false
    fetchCart(token)
      .then((cart) => {
        if (!cancelled) applyCart(cart)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [token, reloadSignal, refreshTick])

  // Stok & keranjang diperbarui otomatis tiap 10 detik dan saat tab kembali aktif
  useLiveRefresh(() => setRefreshTick((n) => n + 1))

  const categoryKey = categories.join(',')
  const priceKey = price.join('-')
  useEffect(() => {
    setPage(1)
  }, [search, categoryKey, priceKey, sortValue, limit])

  const lastQuery = useRef('')
  useEffect(() => {
    let cancelled = false
    const [sort, order] = sortValue.split(':')
    const queryKey = JSON.stringify([search, categoryKey, priceKey, sortValue, page, limit, reloadSignal])
    // Penyegaran berkala berjalan diam-diam (tanpa tulisan "Memuat")
    if (queryKey !== lastQuery.current) {
      lastQuery.current = queryKey
      setLoading(true)
      setError(null)
    }
    fetchStoreProducts(token, {
      search,
      category: '',
      categories: categoryKey ? categoryKey.split(',') : [],
      // Batas bawah/atas penuh = tidak difilter (produk di atas Rp 100.000 tetap tampil)
      minPrice: price[0] > PRICE_MIN ? price[0] : null,
      maxPrice: price[1] < PRICE_MAX ? price[1] : null,
      sort,
      order,
      page,
      limit,
    })
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch((err: unknown) => {
        if (cancelled || handleUnauthorized(err)) return
        setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, search, categoryKey, priceKey, sortValue, page, limit, reloadSignal, refreshTick])

  async function handleAdd(productId: number, name: string) {
    if (pending.has(productId)) return
    setPending((set) => new Set(set).add(productId))
    setError(null)
    try {
      applyCart(await addToCart(token, productId, 1))
      showToast(`${name} ditambahkan ke keranjang`)
      setJustAdded((set) => new Set(set).add(productId))
      window.setTimeout(() => {
        setJustAdded((set) => {
          const next = new Set(set)
          next.delete(productId)
          return next
        })
      }, 1500)
    } catch (err) {
      if (!handleUnauthorized(err)) setError(errorMessage(err))
      setRefreshTick((n) => n + 1) // stok mungkin berubah, ambil data terbaru
    } finally {
      setPending((set) => {
        const next = new Set(set)
        next.delete(productId)
        return next
      })
    }
  }

  const items = result?.data ?? []
  const meta = result?.meta
  const filtersActive = searchText !== '' || categories.length > 0 || priceInput[0] !== PRICE_MIN || priceInput[1] !== PRICE_MAX

  return (
    <main className="page" id="shop-page" data-testid="shop-page">
      <div className="page-head">
        <div>
          <h1 id="shop-title" data-testid="shop-title">
            Toko
          </h1>
          <p className="muted" id="shop-total" data-testid="shop-total">
            {meta ? `${meta.total} produk tersedia` : 'Memuat…'}
          </p>
        </div>
      </div>

      <FlashSale />

      <div className="shop-layout">
      <aside className="shop-filters" aria-label="Filter produk">
        <div className="field">
          <label htmlFor="shop-search-input">Cari</label>
          <input
            type="text"
            id="shop-search-input"
            data-testid="shop-search-input"
            name="search"
            placeholder="Nama atau SKU"
            value={searchText}
            maxLength={100}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <CategoryMultiSelect
          idPrefix="shop-category"
          label="Kategori"
          options={CATEGORY_OPTIONS}
          value={categories}
          onChange={setCategories}
        />
        <PriceRange idPrefix="shop-price" min={PRICE_MIN} max={PRICE_MAX} step={1000} value={priceInput} onChange={setPriceInput} />
        <div className="field">
          <label htmlFor="shop-sort-select">Urutkan</label>
          <select
            id="shop-sort-select"
            data-testid="shop-sort-select"
            name="sort"
            value={sortValue}
            onChange={(e) => setSortValue(e.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {filtersActive && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            id="shop-reset-filters-btn"
            data-testid="shop-reset-filters-btn"
            onClick={() => {
              setSearchText('')
              setCategories([])
              setPriceInput([PRICE_MIN, PRICE_MAX])
            }}
          >
            Hapus semua filter
          </button>
        )}
      </aside>

      <section className="shop-results">
      {error && (
        <div className="alert alert-error" id="shop-error-alert" data-testid="shop-error-alert" role="alert">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <p className="empty-panel" id="shop-loading" data-testid="shop-loading">
          Memuat produk…
        </p>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="empty-panel" id="shop-empty" data-testid="shop-empty">
          {filtersActive ? (
            <>
              <p>Produk tidak ditemukan.</p>
              <button
                type="button"
                className="btn btn-secondary"
                id="shop-clear-filters-btn"
                data-testid="shop-clear-filters-btn"
                onClick={() => {
                  setSearchText('')
                  setCategories([])
                  setPriceInput([PRICE_MIN, PRICE_MAX])
                }}
              >
                Hapus filter
              </button>
            </>
          ) : (
            <p>Toko belum punya produk aktif.</p>
          )}
        </div>
      )}

      <ul className="product-grid" id="shop-grid" data-testid="shop-grid" aria-busy={loading}>
        {items.map((product) => {
          const soldOut = product.stock === 0
          const inCart = cartQty.get(product.id) ?? 0
          const available = Math.max(product.stock - inCart, 0)
          const busy = pending.has(product.id)
          const added = justAdded.has(product.id)
          let label = 'Tambah ke keranjang'
          if (soldOut) label = 'Stok habis'
          else if (available === 0) label = 'Semua stok di keranjang'
          if (busy) label = 'Menambahkan…'
          if (added) label = 'Ditambahkan ✓'
          return (
            <li className="product-card" key={product.id} id={`shop-card-${product.id}`} data-testid={`shop-card-${product.id}`}>
              <Link to={`/shop/${product.id}`} className="product-card-link" id={`shop-card-link-${product.id}`} data-testid={`shop-card-link-${product.id}`}>
                <ProductImage
                  imageUrl={product.imageUrl}
                  name={product.name}
                  category={product.category}
                  testId={`shop-card-image-${product.id}`}
                />
                <span className="product-card-category">{categoryLabel(product.category)}</span>
                <span className="product-card-name" id={`shop-card-name-${product.id}`} data-testid={`shop-card-name-${product.id}`}>
                  {product.name}
                </span>
                {(product.ratingCount ?? 0) > 0 && (
                  <span className="product-card-rating" id={`shop-card-rating-${product.id}`} data-testid={`shop-card-rating-${product.id}`}>
                    <span aria-hidden="true">★</span> {formatRating(product.ratingAverage ?? 0)} ({product.ratingCount})
                  </span>
                )}
              </Link>
              <div className="product-card-foot">
                <span className="product-card-price" id={`shop-card-price-${product.id}`} data-testid={`shop-card-price-${product.id}`}>
                  {isBugUser() ? `Rp ${product.price}` : formatRupiah(product.price)}
                </span>
                <span
                  className={`product-card-stock${soldOut ? ' is-sold-out' : ''}`}
                  id={`shop-card-stock-${product.id}`}
                  data-testid={`shop-card-stock-${product.id}`}
                >
                  {soldOut ? 'Stok habis' : `Stok ${product.stock}`}
                </span>
              </div>
              <p className="product-card-incart" id={`shop-card-incart-${product.id}`} data-testid={`shop-card-incart-${product.id}`}>
                {inCart > 0 ? `${inCart} di keranjangmu, bisa tambah ${available} lagi` : '\u00a0'}
              </p>
              <button
                type="button"
                className={`btn btn-primary btn-sm product-card-add${added ? ' is-added' : ''}`}
                id={`shop-add-btn-${product.id}`}
                data-testid={`shop-add-btn-${product.id}`}
                disabled={available === 0 || busy}
                aria-label={`Tambah ${product.name} ke keranjang`}
                onClick={() => handleAdd(product.id, product.name)}
              >
                {label}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="pagination">
        <div className="field pagination-size">
          <label htmlFor="shop-page-size-select">Per halaman</label>
          <select
            id="shop-page-size-select"
            data-testid="shop-page-size-select"
            name="limit"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="pagination-nav">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            id="shop-page-prev-btn"
            data-testid="shop-page-prev-btn"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Sebelumnya
          </button>
          <span id="shop-page-info" data-testid="shop-page-info" aria-live="polite">
            Halaman {meta?.page ?? page} dari {meta?.totalPages ?? 1}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            id="shop-page-next-btn"
            data-testid="shop-page-next-btn"
            disabled={loading || !meta || page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </button>
        </div>
      </div>
      </section>
      </div>
    </main>
  )
}

export default function ShopPage() {
  const [reloadSignal, setReloadSignal] = useState(0)
  return (
    <AppShell onReset={() => setReloadSignal((n) => n + 1)}>
      {({ token }) => <ShopContent token={token} reloadSignal={reloadSignal} />}
    </AppShell>
  )
}
