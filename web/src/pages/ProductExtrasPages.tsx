import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { fetchFeatured, fetchProducts, fetchStockMovements, saveFeatured } from '../api'
import type { Product, StockMovement } from '../api'
import AppShell from '../components/AppShell'
import { formatDateTime } from '../components/OrderStatus'
import ProductImage from '../components/ProductImage'
import ProductTabs from '../components/ProductTabs'
import { errorMessage, handleUnauthorized } from '../errors'
import { Redirect } from '../router'
import { showToast } from '../toast'
import { formatRupiah } from '../validation/product'

export const FEATURED_MAX = 6

// Semua produk akun admin (diambil per 50 sampai habis)
async function loadAllProducts(token: string) {
  const all: Product[] = []
  for (let page = 1; page <= 20; page += 1) {
    const result = await fetchProducts(token, { search: '', category: '', status: '', sort: 'name', order: 'asc', page, limit: 50 })
    all.push(...result.data)
    if (page >= result.meta.totalPages) break
  }
  return all
}

function AdminOnly({ children }: { children: (token: string, reloadSignal: number) => ReactNode }) {
  const [reloadSignal, setReloadSignal] = useState(0)
  return (
    <AppShell onReset={() => setReloadSignal((n) => n + 1)}>
      {({ user, token }) => (user && user.role !== 'admin' ? <Redirect to="/shop" /> : children(token, reloadSignal))}
    </AppShell>
  )
}

// ---------- Produk unggulan (drag & drop urutan) ----------

function FeaturedContent({ token, reloadSignal }: { token: string; reloadSignal: number }) {
  const [saved, setSaved] = useState<number[]>([])
  const [list, setList] = useState<Product[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [pick, setPick] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchFeatured(token), loadAllProducts(token)])
      .then(([featured, all]) => {
        if (cancelled) return
        setList(featured)
        setSaved(featured.map((p) => p.id))
        setProducts(all)
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
  }, [token, reloadSignal])

  const ids = list.map((p) => p.id)
  const dirty = ids.join(',') !== saved.join(',')
  const full = list.length >= FEATURED_MAX
  const candidates = products.filter((p) => !ids.includes(p.id))

  function move(from: number, to: number) {
    if (to < 0 || to >= list.length || from === to) return
    setList((current) => {
      const next = [...current]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  function onDrop(event: DragEvent, index: number) {
    event.preventDefault()
    const from = list.findIndex((p) => p.id === dragId)
    if (from >= 0) move(from, index)
    setDragId(null)
    setOverIndex(null)
  }

  function add() {
    const product = products.find((p) => String(p.id) === pick)
    if (!product || full) return
    setList((current) => [...current, product])
    setPick('')
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const result = await saveFeatured(token, ids)
      setList(result)
      setSaved(result.map((p) => p.id))
      showToast('Urutan unggulan disimpan')
    } catch (err) {
      if (!handleUnauthorized(err)) setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page" id="featured-page" data-testid="featured-page">
      <div className="page-head">
        <div>
          <h1 id="featured-title" data-testid="featured-title">
            Produk unggulan
          </h1>
          <p className="muted" id="featured-count" data-testid="featured-count">
            {list.length} dari {FEATURED_MAX} slot terisi. Urutan ini dipakai sort “Pilihan admin” di Toko.
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-secondary" id="featured-undo-btn" data-testid="featured-undo-btn" disabled={!dirty || saving} onClick={() => setList(saved.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p)))}>
            Batalkan perubahan
          </button>
          <button type="button" className="btn btn-primary" id="featured-save-btn" data-testid="featured-save-btn" disabled={!dirty || saving} aria-busy={saving} onClick={save}>
            {saving ? 'Menyimpan…' : 'Simpan urutan'}
          </button>
        </div>
      </div>

      <ProductTabs />

      {error && (
        <div className="alert alert-error" role="alert" id="featured-error-alert" data-testid="featured-error-alert">
          {error}
        </div>
      )}
      {dirty && (
        <p className="note" id="featured-dirty-note" data-testid="featured-dirty-note" role="status">
          Ada perubahan yang belum disimpan.
        </p>
      )}

      <div className="featured-layout">
        <section className="panel">
          <h2>Urutan tampil</h2>
          <p className="muted">Seret kartu untuk mengubah urutan, atau pakai tombol ↑ ↓.</p>
          {loading && <p className="muted">Memuat…</p>}
          {!loading && list.length === 0 && (
            <p className="muted" id="featured-empty" data-testid="featured-empty">
              Belum ada produk unggulan. Tambahkan dari daftar di samping.
            </p>
          )}
          <ol className="featured-list" id="featured-list" data-testid="featured-list">
            {list.map((product, index) => (
              <li
                key={product.id}
                className={`featured-item${dragId === product.id ? ' is-dragging' : ''}${overIndex === index && dragId !== product.id ? ' is-over' : ''}`}
                id={`featured-item-${product.id}`}
                data-testid={`featured-item-${product.id}`}
                data-position={index + 1}
                draggable
                onDragStart={(e) => {
                  setDragId(product.id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', String(product.id))
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverIndex(index)
                }}
                onDragLeave={() => setOverIndex((i) => (i === index ? null : i))}
                onDrop={(e) => onDrop(e, index)}
                onDragEnd={() => {
                  setDragId(null)
                  setOverIndex(null)
                }}
              >
                <span className="drag-handle" aria-hidden="true">⠿</span>
                <span className="featured-rank" id={`featured-rank-${product.id}`} data-testid={`featured-rank-${product.id}`}>
                  {index + 1}
                </span>
                <ProductImage imageUrl={product.imageUrl} name={product.name} category={product.category} testId={`featured-image-${product.id}`} size="thumb" />
                <div className="featured-info">
                  <b>{product.name}</b>
                  <span className="muted">
                    {product.sku}, {formatRupiah(product.price)}
                  </span>
                </div>
                <div className="featured-actions">
                  <button type="button" className="btn btn-ghost btn-sm" id={`featured-up-btn-${product.id}`} data-testid={`featured-up-btn-${product.id}`} aria-label={`Naikkan ${product.name}`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    id={`featured-down-btn-${product.id}`}
                    data-testid={`featured-down-btn-${product.id}`}
                    aria-label={`Turunkan ${product.name}`}
                    disabled={index === list.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-ghost-danger"
                    id={`featured-remove-btn-${product.id}`}
                    data-testid={`featured-remove-btn-${product.id}`}
                    aria-label={`Keluarkan ${product.name} dari unggulan`}
                    onClick={() => setList((current) => current.filter((p) => p.id !== product.id))}
                  >
                    Keluarkan
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel">
          <h2>Tambah produk</h2>
          <div className="field">
            <label htmlFor="featured-add-select">Produk</label>
            <select id="featured-add-select" data-testid="featured-add-select" value={pick} disabled={full || loading} onChange={(e) => setPick(e.target.value)}>
              <option value="">Pilih produk</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-secondary" id="featured-add-btn" data-testid="featured-add-btn" disabled={!pick || full} onClick={add}>
            Tambahkan
          </button>
          {full && (
            <p className="field-hint muted" id="featured-full-note" data-testid="featured-full-note">
              Slot penuh. Keluarkan satu produk dulu untuk menambah yang lain.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

export function FeaturedPage() {
  return <AdminOnly>{(token, reloadSignal) => <FeaturedContent token={token} reloadSignal={reloadSignal} />}</AdminOnly>
}

// ---------- Riwayat stok (infinite scroll) ----------

export const REASON_LABEL: Record<StockMovement['reason'], string> = {
  order: 'Terjual',
  cancel: 'Pesanan dibatalkan',
  admin: 'Diubah admin',
  restock: 'Restok',
  offline: 'Penjualan offline',
}

function StockHistoryContent({ token, reloadSignal }: { token: string; reloadSignal: number }) {
  const [productId, setProductId] = useState('')
  const [reason, setReason] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [rows, setRows] = useState<StockMovement[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const generation = useRef(0)
  const busy = useRef(false)

  useEffect(() => {
    loadAllProducts(token)
      .then(setProducts)
      .catch(() => undefined)
  }, [token, reloadSignal])

  const loadMore = useCallback(
    async (reset: boolean) => {
      // Lanjutan hanya kalau ada cursor dan tidak sedang memuat (cegah halaman dobel)
      if (!reset && (busy.current || !cursor)) return
      const gen = reset ? ++generation.current : generation.current
      busy.current = true
      setLoading(true)
      setError(null)
      try {
        const result = await fetchStockMovements(token, { cursor: reset ? null : cursor, productId, reason })
        if (gen !== generation.current) return
        setRows((current) => (reset ? result.data : [...current, ...result.data]))
        setTotal(result.meta.total)
        setCursor(result.meta.nextCursor)
        setDone(!result.meta.nextCursor)
      } catch (err) {
        if (gen === generation.current && !handleUnauthorized(err)) setError(errorMessage(err))
      } finally {
        if (gen === generation.current) {
          busy.current = false
          setLoading(false)
        }
      }
    },
    [token, cursor, productId, reason],
  )

  // Filter berubah / Reset Data → mulai lagi dari atas
  useEffect(() => {
    setRows([])
    setCursor(null)
    setDone(false)
    loadMore(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, productId, reason, reloadSignal])

  // Sentinel di bawah tabel terlihat → ambil 50 baris berikutnya
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || done || loading || error) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore(false)
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [done, loading, error, loadMore])

  return (
    <main className="page" id="stock-history-page" data-testid="stock-history-page">
      <div className="page-head">
        <div>
          <h1 id="stock-history-title" data-testid="stock-history-title">
            Riwayat stok
          </h1>
          <p className="muted" id="stock-history-total" data-testid="stock-history-total" aria-live="polite">
            {total === null ? 'Memuat…' : `Menampilkan ${rows.length} dari ${total} catatan`}
          </p>
        </div>
      </div>

      <ProductTabs />

      <div className="toolbar">
        <div className="field">
          <label htmlFor="stock-history-product-filter">Produk</label>
          <select id="stock-history-product-filter" data-testid="stock-history-product-filter" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Semua produk</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="stock-history-reason-filter">Jenis</label>
          <select id="stock-history-reason-filter" data-testid="stock-history-reason-filter" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Semua jenis</option>
            {Object.entries(REASON_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table" id="stock-history-table" data-testid="stock-history-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Produk</th>
              <th>Jenis</th>
              <th className="num">Perubahan</th>
              <th className="num">Stok akhir</th>
              <th>Referensi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} id={`stock-history-row-${row.id}`} data-testid={`stock-history-row-${row.id}`} data-reason={row.reason}>
                <td>{formatDateTime(row.createdAt)}</td>
                <td>{row.productName}</td>
                <td>
                  <span className={`reason-tag reason-${row.reason}`}>{REASON_LABEL[row.reason] ?? row.reason}</span>
                </td>
                <td className={`num ${row.change > 0 ? 'is-plus' : 'is-minus'}`} id={`stock-history-change-${row.id}`} data-testid={`stock-history-change-${row.id}`}>
                  {row.change > 0 ? `+${row.change}` : row.change}
                </td>
                <td className="num" id={`stock-history-after-${row.id}`} data-testid={`stock-history-after-${row.id}`}>
                  {row.stockAfter}
                </td>
                <td className="mono muted">{row.ref}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="table-state" id="stock-history-empty" data-testid="stock-history-empty">
                  Tidak ada catatan untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="infinite-foot" ref={sentinelRef} id="stock-history-sentinel" data-testid="stock-history-sentinel">
        {loading && (
          <p className="muted" role="status" id="stock-history-loading" data-testid="stock-history-loading">
            Memuat catatan…
          </p>
        )}
        {error && (
          <div className="alert alert-error" role="alert" id="stock-history-error-alert" data-testid="stock-history-error-alert">
            {error}{' '}
            <button type="button" className="btn btn-secondary btn-sm" id="stock-history-retry-btn" data-testid="stock-history-retry-btn" onClick={() => loadMore(rows.length === 0)}>
              Coba lagi
            </button>
          </div>
        )}
        {done && rows.length > 0 && (
          <p className="muted" id="stock-history-end" data-testid="stock-history-end">
            Semua catatan sudah ditampilkan.
          </p>
        )}
      </div>
    </main>
  )
}

export function StockHistoryPage() {
  return <AdminOnly>{(token, reloadSignal) => <StockHistoryContent token={token} reloadSignal={reloadSignal} />}</AdminOnly>
}
