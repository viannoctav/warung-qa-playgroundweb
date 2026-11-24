import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, NETWORK_ERROR_MESSAGE, bulkDeleteProducts, deleteProduct, fetchProducts } from '../api'
import type { Product, ProductListResult } from '../api'
import { clearSession } from '../auth'
import AppShell from '../components/AppShell'
import ConfirmModal from '../components/ConfirmModal'
import ProductImage from '../components/ProductImage'
import { Link, Redirect, navigate } from '../router'
import { showToast } from '../toast'
import { CATEGORY_OPTIONS, categoryLabel, formatRupiah } from '../validation/product'

type SortKey = 'name' | 'price' | 'stock'
type PendingDelete = { ids: number[]; title: string; message: string } | null

const PAGE_SIZES = [5, 10, 20, 50]

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function SelectAllCheckbox({ checked, indeterminate, disabled, onChange }: {
  checked: boolean
  indeterminate: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      id="products-select-all-checkbox"
      data-testid="products-select-all-checkbox"
      aria-label="Pilih semua produk di halaman ini"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}

function ProductsContent({ token, canManage, reloadSignal }: { token: string; canManage: boolean; reloadSignal: number }) {
  const [searchText, setSearchText] = useState('')
  const search = useDebounced(searchText.trim(), 300)
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [reloadKey, setReloadKey] = useState(0)

  const [result, setResult] = useState<ProductListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)
  const [deleting, setDeleting] = useState(false)

  // Kembali ke halaman 1 setiap kali pencarian atau filter berubah
  useEffect(() => {
    setPage(1)
  }, [search, category, status, limit])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetchProducts(token, { search, category, status, sort, order, page, limit })
      .then((data) => {
        if (cancelled) return
        setResult(data)
        setSelected(new Set())
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          clearSession()
          navigate('/login', true)
          return
        }
        setLoadError(error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, search, category, status, sort, order, page, limit, reloadKey, reloadSignal])

  const items: Product[] = result?.data ?? []
  const meta = result?.meta
  const filtersActive = searchText !== '' || category !== '' || status !== ''
  const pageIds = items.map((item) => item.id)
  const selectedOnPage = pageIds.filter((id) => selected.has(id))
  const allSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(key)
      setOrder('asc')
    }
  }

  function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (sort !== key) return 'none'
    return order === 'asc' ? 'ascending' : 'descending'
  }

  function clearFilters() {
    setSearchText('')
    setCategory('')
    setStatus('')
  }

  function toggleRow(id: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(pageIds) : new Set())
  }

  const cancelDelete = useCallback(() => setPendingDelete(null), [])

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const { ids } = pendingDelete
      if (ids.length === 1) {
        await deleteProduct(token, ids[0])
        showToast('Produk dihapus')
      } else {
        const deleted = await bulkDeleteProducts(token, ids)
        showToast(`${deleted} produk dihapus`)
      }
      setPendingDelete(null)
      // Halaman jadi kosong setelah dihapus → mundur satu halaman
      if (ids.length >= items.length && page > 1) setPage(page - 1)
      else setReloadKey((key) => key + 1)
    } catch (error) {
      setPendingDelete(null)
      if (error instanceof ApiError && error.status === 401) {
        clearSession()
        navigate('/login', true)
        return
      }
      setLoadError(error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE)
    } finally {
      setDeleting(false)
    }
  }

  function sortButton(key: SortKey, label: string) {
    const active = sort === key
    return (
      <button
        type="button"
        className={`sort-btn${active ? ' is-active' : ''}`}
        id={`products-sort-${key}-btn`}
        data-testid={`products-sort-${key}-btn`}
        onClick={() => toggleSort(key)}
      >
        {label}
        <span className="sort-indicator" aria-hidden="true">
          {active ? (order === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    )
  }

  const columnCount = canManage ? 9 : 7

  return (
    <main className="page" id="products-page" data-testid="products-page">
      <div className="page-head">
        <div>
          <h1 id="products-title" data-testid="products-title">
            Produk
          </h1>
          <p className="muted" id="products-total" data-testid="products-total">
            {meta ? `${meta.total} produk` : 'Memuat…'}
          </p>
        </div>
        <Link to="/products/new" className="btn btn-primary" id="products-add-btn" data-testid="products-add-btn">
          Tambah produk
        </Link>
      </div>

      <div className="toolbar">
        <div className="field toolbar-search">
          <label htmlFor="products-search-input">Cari</label>
          <input
            type="text"
            id="products-search-input"
            data-testid="products-search-input"
            name="search"
            placeholder="Nama atau SKU"
            value={searchText}
            maxLength={100}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="products-category-filter">Kategori</label>
          <select
            id="products-category-filter"
            data-testid="products-category-filter"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Semua kategori</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="products-status-filter">Status</label>
          <select
            id="products-status-filter"
            data-testid="products-status-filter"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
        {canManage && selected.size > 0 && (
          <button
            type="button"
            className="btn btn-danger toolbar-action"
            id="products-bulk-delete-btn"
            data-testid="products-bulk-delete-btn"
            onClick={() =>
              setPendingDelete({
                ids: [...selected],
                title: `Hapus ${selected.size} produk?`,
                message: 'Produk yang dipilih akan dihapus dari katalog akun ini.',
              })
            }
          >
            Hapus ({selected.size})
          </button>
        )}
      </div>

      {loadError && (
        <div className="alert alert-error" id="products-error-alert" data-testid="products-error-alert" role="alert">
          {loadError}
        </div>
      )}

      <div className="table-wrap" aria-busy={loading}>
        <table className="data-table" id="products-table" data-testid="products-table">
          <thead>
            <tr>
              {canManage && (
                <th className="col-check">
                  <SelectAllCheckbox
                    checked={allSelected}
                    indeterminate={selectedOnPage.length > 0 && !allSelected}
                    disabled={items.length === 0}
                    onChange={toggleAll}
                  />
                </th>
              )}
              <th className="col-thumb">
                <span className="sr-only">Gambar</span>
              </th>
              <th>SKU</th>
              <th aria-sort={ariaSort('name')}>{sortButton('name', 'Nama')}</th>
              <th>Kategori</th>
              <th className="num" aria-sort={ariaSort('price')}>
                {sortButton('price', 'Harga')}
              </th>
              <th className="num" aria-sort={ariaSort('stock')}>
                {sortButton('stock', 'Stok')}
              </th>
              <th>Status</th>
              {canManage && <th className="col-actions">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="table-state" id="products-loading" data-testid="products-loading">
                  Memuat produk…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && !loadError && (
              <tr>
                <td colSpan={columnCount} className="table-state" id="products-empty" data-testid="products-empty">
                  {filtersActive ? (
                    <>
                      <p>Produk tidak ditemukan.</p>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        id="products-clear-filters-btn"
                        data-testid="products-clear-filters-btn"
                        onClick={clearFilters}
                      >
                        Hapus filter
                      </button>
                    </>
                  ) : (
                    <p>Belum ada produk. Gunakan Reset Data untuk mengembalikan 24 produk awal.</p>
                  )}
                </td>
              </tr>
            )}
            {items.map((product) => (
              <tr
                key={product.id}
                id={`products-row-${product.id}`}
                data-testid={`products-row-${product.id}`}
                className={selected.has(product.id) ? 'is-selected' : undefined}
              >
                {canManage && (
                  <td className="col-check">
                    <input
                      type="checkbox"
                      id={`products-select-checkbox-${product.id}`}
                      data-testid={`products-select-checkbox-${product.id}`}
                      aria-label={`Pilih ${product.name}`}
                      checked={selected.has(product.id)}
                      onChange={(e) => toggleRow(product.id, e.target.checked)}
                    />
                  </td>
                )}
                <td className="col-thumb">
                  <ProductImage
                    imageUrl={product.imageUrl}
                    name={product.name}
                    category={product.category}
                    testId={`products-cell-image-${product.id}`}
                    size="thumb"
                  />
                </td>
                <td className="mono" id={`products-cell-sku-${product.id}`} data-testid={`products-cell-sku-${product.id}`}>
                  {product.sku}
                </td>
                <td id={`products-cell-name-${product.id}`} data-testid={`products-cell-name-${product.id}`}>
                  {product.name}
                </td>
                <td id={`products-cell-category-${product.id}`} data-testid={`products-cell-category-${product.id}`}>
                  {categoryLabel(product.category)}
                </td>
                <td className="num" id={`products-cell-price-${product.id}`} data-testid={`products-cell-price-${product.id}`}>
                  {formatRupiah(product.price)}
                </td>
                <td
                  className={`num${product.stock === 0 ? ' is-empty-stock' : ''}`}
                  id={`products-cell-stock-${product.id}`}
                  data-testid={`products-cell-stock-${product.id}`}
                >
                  {product.stock}
                </td>
                <td id={`products-cell-status-${product.id}`} data-testid={`products-cell-status-${product.id}`}>
                  <span className={`pill ${product.isActive ? 'pill-on' : 'pill-off'}`}>
                    {product.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                {canManage && (
                  <td className="col-actions">
                    <Link
                      to={`/products/${product.id}/edit`}
                      className="btn btn-ghost btn-sm"
                      id={`products-edit-btn-${product.id}`}
                      data-testid={`products-edit-btn-${product.id}`}
                      aria-label={`Edit ${product.name}`}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-ghost-danger"
                      id={`products-delete-btn-${product.id}`}
                      data-testid={`products-delete-btn-${product.id}`}
                      aria-label={`Hapus ${product.name}`}
                      onClick={() =>
                        setPendingDelete({
                          ids: [product.id],
                          title: 'Hapus produk?',
                          message: `${product.name} (${product.sku}) akan dihapus dari katalog akun ini.`,
                        })
                      }
                    >
                      Hapus
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div className="field pagination-size">
          <label htmlFor="products-page-size-select">Per halaman</label>
          <select
            id="products-page-size-select"
            data-testid="products-page-size-select"
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
            id="products-page-prev-btn"
            data-testid="products-page-prev-btn"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Sebelumnya
          </button>
          <span id="products-page-info" data-testid="products-page-info" aria-live="polite">
            Halaman {meta?.page ?? page} dari {meta?.totalPages ?? 1}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            id="products-page-next-btn"
            data-testid="products-page-next-btn"
            disabled={loading || !meta || page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </button>
        </div>
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title={pendingDelete?.title ?? ''}
        message={pendingDelete?.message ?? ''}
        confirmLabel="Hapus"
        busyLabel="Menghapus…"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </main>
  )
}

export default function ProductsPage() {
  const [reloadSignal, setReloadSignal] = useState(0)
  return (
    <AppShell onReset={() => setReloadSignal((n) => n + 1)}>
      {({ user, token }) =>
        // Kelola Produk khusus admin; pembeli diarahkan ke Toko
        user && user.role !== 'admin' ? (
          <Redirect to="/shop" />
        ) : (
          <ProductsContent token={token} canManage reloadSignal={reloadSignal} />
        )
      }
    </AppShell>
  )
}
