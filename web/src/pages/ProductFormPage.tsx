import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  createProduct,
  deleteProductImage,
  fetchProduct,
  updateProduct,
  uploadProductImage,
} from '../api'
import type { Product } from '../api'
import { clearSession, setFlashToast } from '../auth'
import AppShell from '../components/AppShell'
import ConfirmModal from '../components/ConfirmModal'
import ProductImage from '../components/ProductImage'
import { Link, navigate } from '../router'
import {
  CATEGORY_OPTIONS,
  EMPTY_PRODUCT,
  digitsOnly,
  formatThousands,
  validateProduct,
} from '../validation/product'
import type { ProductErrors, ProductField, ProductFormValues } from '../validation/product'

type Props = { productId: number | null } // null = tambah produk

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const IMAGE_MESSAGES = {
  type: 'Format gambar harus JPG, PNG, atau WEBP',
  size: 'Ukuran gambar maksimal 2 MB',
}

function toFormValues(product: Product): ProductFormValues {
  return {
    sku: product.sku,
    name: product.name,
    category: product.category,
    price: String(product.price),
    stock: String(product.stock),
    isActive: product.isActive,
    description: product.description,
  }
}

function FieldError({ field, message }: { field: ProductField; message?: string }) {
  const id = `product-${field}-error`
  return (
    <div className="field-message">
      {message && (
        <p className="field-error" id={id} data-testid={id} role="alert">
          {message}
        </p>
      )}
    </div>
  )
}

function ProductForm({ token, productId }: { token: string; productId: number | null }) {
  const isEdit = productId !== null
  const [initial, setInitial] = useState<ProductFormValues>(EMPTY_PRODUCT)
  const [values, setValues] = useState<ProductFormValues>(EMPTY_PRODUCT)
  const [touched, setTouched] = useState<Partial<Record<ProductField, boolean>>>({})
  const [serverErrors, setServerErrors] = useState<ProductErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const submitting = useRef(false)
  // Id produk yang sudah tersimpan tapi gambarnya gagal diunggah (mode tambah)
  const savedId = useRef<number | null>(productId)

  // Gambar: file baru yang dipilih, gambar lama dari server, atau minta dihapus
  const [existingImage, setExistingImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const clientErrors = validateProduct(values)
  const isValid = Object.keys(clientErrors).length === 0
  const imageChanged = imageFile !== null || removeImage
  const dirty = JSON.stringify(values) !== JSON.stringify(initial) || imageChanged
  const shownImage = imagePreview ?? (removeImage ? null : existingImage)

  function pickImage(file: File | undefined) {
    setImageError(null)
    setServerError(null)
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) {
      setImageError(IMAGE_MESSAGES.type)
    } else if (file.size > IMAGE_MAX_BYTES) {
      setImageError(IMAGE_MESSAGES.size)
    } else {
      setImageFile(file)
      setRemoveImage(false)
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  function clearImage() {
    setImageFile(null)
    setImageError(null)
    if (existingImage) setRemoveImage(true)
  }

  // Mode edit: ambil data produk
  useEffect(() => {
    if (productId === null) return
    let cancelled = false
    fetchProduct(token, productId)
      .then((product) => {
        if (cancelled) return
        const formValues = toFormValues(product)
        setInitial(formValues)
        setValues(formValues)
        setExistingImage(product.imageUrl)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          clearSession()
          navigate('/login', true)
        } else if (error instanceof ApiError && error.status === 404) {
          setNotFound(true)
        } else {
          setServerError(error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, productId])

  // Peringatan bawaan browser kalau tab ditutup saat ada perubahan belum disimpan
  useEffect(() => {
    if (!dirty || saving) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])

  function errorFor(field: ProductField) {
    return serverErrors[field] ?? (touched[field] ? clientErrors[field] : undefined)
  }

  function update<K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    if (field in serverErrors) {
      setServerErrors((current) => {
        const next = { ...current }
        delete next[field as ProductField]
        return next
      })
    }
  }

  function touch(field: ProductField) {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }))
  }

  function invalid(field: ProductField) {
    return errorFor(field) ? true : undefined
  }

  function describedBy(field: ProductField) {
    return errorFor(field) ? `product-${field}-error` : undefined
  }

  function handleCancel() {
    if (dirty) setConfirmLeave(true)
    else navigate('/products')
  }

  const closeLeave = useCallback(() => setConfirmLeave(false), [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    setTouched({ sku: true, name: true, category: true, price: true, stock: true, description: true })
    if (!isValid) return

    submitting.current = true
    setSaving(true)
    setServerError(null)
    const input = {
      sku: values.sku.trim().toUpperCase(),
      name: values.name.trim(),
      category: values.category,
      price: Number(values.price),
      stock: Number(values.stock.trim()),
      isActive: values.isActive,
      description: values.description.trim(),
    }

    let saved: Product
    try {
      if (savedId.current === null) {
        saved = await createProduct(token, input)
        savedId.current = saved.id
      } else {
        saved = await updateProduct(token, savedId.current, input)
      }
    } catch (error) {
      submitting.current = false
      setSaving(false)
      if (error instanceof ApiError) {
        if (error.status === 401) {
          clearSession()
          navigate('/login', true)
          return
        }
        if (error.status === 404) {
          setNotFound(true)
          return
        }
        setServerError(error.message)
        if (error.fields) setServerErrors(error.fields as ProductErrors)
      } else {
        setServerError(NETWORK_ERROR_MESSAGE)
      }
      return
    }

    // Data produk sudah tersimpan; lanjut unggah atau hapus gambar
    try {
      if (imageFile) {
        const withImage = await uploadProductImage(token, saved.id, imageFile)
        setExistingImage(withImage.imageUrl)
      } else if (removeImage && existingImage) {
        await deleteProductImage(token, saved.id)
      }
    } catch (error) {
      submitting.current = false
      setSaving(false)
      if (error instanceof ApiError && error.status === 401) {
        clearSession()
        navigate('/login', true)
        return
      }
      const message = error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE
      // Data produk tetap tersimpan; simpan lagi hanya mengulang gambar
      setInitial(values)
      setImageError(message)
      setServerError(`Data produk tersimpan, tetapi gambar gagal disimpan: ${message}`)
      return
    }

    setFlashToast(productId === null ? 'Produk ditambahkan' : 'Perubahan disimpan')
    setInitial(values)
    setImageFile(null)
    setRemoveImage(false)
    navigate('/products')
  }

  if (notFound) {
    return (
      <main className="page page-narrow" id="product-form-page" data-testid="product-form-page">
        <div className="empty-panel" id="product-not-found" data-testid="product-not-found">
          <h1>Produk tidak ditemukan</h1>
          <p className="muted">Produk ini tidak ada di katalog akunmu, atau sudah dihapus.</p>
          <Link to="/products" className="btn btn-secondary" id="product-back-link" data-testid="product-back-link">
            Kembali ke daftar produk
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="page page-narrow" id="product-form-page" data-testid="product-form-page">
      <Link to="/products" className="back-link" id="product-back-link" data-testid="product-back-link" onClick={(e) => {
        if (dirty) {
          e.preventDefault()
          setConfirmLeave(true)
        }
      }}>
        ← Daftar produk
      </Link>
      <h1 id="product-form-title" data-testid="product-form-title">
        {isEdit ? 'Edit produk' : 'Tambah produk'}
      </h1>

      {serverError && (
        <div className="alert alert-error" id="product-error-alert" data-testid="product-error-alert" role="alert">
          {serverError}
        </div>
      )}

      {loading ? (
        <p className="muted" id="product-loading" data-testid="product-loading">
          Memuat produk…
        </p>
      ) : (
        <form className="form form-card" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="product-sku-input">SKU</label>
              <input
                type="text"
                id="product-sku-input"
                data-testid="product-sku-input"
                name="sku"
                placeholder="KOP-0001"
                autoComplete="off"
                autoFocus={!isEdit}
                value={values.sku}
                readOnly={saving}
                aria-invalid={invalid('sku')}
                aria-describedby={describedBy('sku')}
                onChange={(e) => update('sku', e.target.value.toUpperCase())}
                onBlur={() => touch('sku')}
              />
              <FieldError field="sku" message={errorFor('sku')} />
            </div>

            <div className="field">
              <label htmlFor="product-category-select">Kategori</label>
              <select
                id="product-category-select"
                data-testid="product-category-select"
                name="category"
                value={values.category}
                disabled={saving}
                aria-invalid={invalid('category')}
                aria-describedby={describedBy('category')}
                onChange={(e) => {
                  update('category', e.target.value)
                  touch('category')
                }}
                onBlur={() => touch('category')}
              >
                <option value="" disabled>
                  Pilih kategori
                </option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldError field="category" message={errorFor('category')} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="product-name-input">Nama produk</label>
            <input
              type="text"
              id="product-name-input"
              data-testid="product-name-input"
              name="name"
              value={values.name}
              readOnly={saving}
              aria-invalid={invalid('name')}
              aria-describedby={describedBy('name')}
              onChange={(e) => update('name', e.target.value)}
              onBlur={() => touch('name')}
            />
            <FieldError field="name" message={errorFor('name')} />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="product-price-input">Harga</label>
              <div className="input-prefix">
                <span aria-hidden="true">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  id="product-price-input"
                  data-testid="product-price-input"
                  name="price"
                  placeholder="0"
                  value={formatThousands(values.price)}
                  readOnly={saving}
                  aria-invalid={invalid('price')}
                  aria-describedby={describedBy('price')}
                  onChange={(e) => update('price', digitsOnly(e.target.value))}
                  onBlur={() => touch('price')}
                />
              </div>
              <FieldError field="price" message={errorFor('price')} />
            </div>

            <div className="field">
              <label htmlFor="product-stock-input">Stok</label>
              <input
                type="number"
                id="product-stock-input"
                data-testid="product-stock-input"
                name="stock"
                min={0}
                max={9999}
                step={1}
                value={values.stock}
                readOnly={saving}
                aria-invalid={invalid('stock')}
                aria-describedby={describedBy('stock')}
                onChange={(e) => update('stock', e.target.value)}
                onBlur={() => touch('stock')}
              />
              <FieldError field="stock" message={errorFor('stock')} />
            </div>
          </div>

          <div className="field">
            <label className="switch" htmlFor="product-active-switch">
              <input
                type="checkbox"
                role="switch"
                id="product-active-switch"
                data-testid="product-active-switch"
                name="isActive"
                checked={values.isActive}
                disabled={saving}
                aria-checked={values.isActive}
                onChange={(e) => update('isActive', e.target.checked)}
              />
              <span className="switch-track" aria-hidden="true" />
              <span>{values.isActive ? 'Aktif (dijual)' : 'Nonaktif (tidak dijual)'}</span>
            </label>
            <div className="field-message" />
          </div>

          <div className="field">
            <label htmlFor="product-description-textarea">Deskripsi (opsional)</label>
            <textarea
              id="product-description-textarea"
              data-testid="product-description-textarea"
              name="description"
              rows={4}
              maxLength={500}
              value={values.description}
              readOnly={saving}
              aria-invalid={invalid('description')}
              aria-describedby={describedBy('description') ?? 'product-description-counter'}
              onChange={(e) => update('description', e.target.value)}
              onBlur={() => touch('description')}
            />
            <p className="hint counter" id="product-description-counter" data-testid="product-description-counter">
              {values.description.length}/500
            </p>
            <FieldError field="description" message={errorFor('description')} />
          </div>

          <div className="field">
            <span className="field-label" id="product-image-label">
              Gambar produk (opsional)
            </span>
            <div className="image-field">
              <ProductImage
                key={shownImage ?? 'none'}
                imageUrl={shownImage}
                name={values.name || 'Produk baru'}
                category={values.category || 'kopi'}
                testId="product-image-preview"
              />
              <div className="image-field-actions">
                <input
                  ref={fileInput}
                  type="file"
                  className="file-input"
                  id="product-image-input"
                  data-testid="product-image-input"
                  name="image"
                  accept="image/jpeg,image/png,image/webp"
                  aria-labelledby="product-image-label"
                  aria-describedby={imageError ? 'product-image-error' : 'product-image-hint'}
                  disabled={saving}
                  onChange={(e) => pickImage(e.target.files?.[0])}
                />
                {shownImage && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-ghost-danger"
                    id="product-image-remove-btn"
                    data-testid="product-image-remove-btn"
                    disabled={saving}
                    onClick={clearImage}
                  >
                    Hapus gambar
                  </button>
                )}
                <p className="hint" id="product-image-hint" data-testid="product-image-hint">
                  {imageFile ? `${imageFile.name} siap diunggah saat disimpan. ` : removeImage ? 'Gambar akan dihapus saat disimpan. ' : ''}
                  JPG, PNG, atau WEBP, maksimal 2 MB.
                </p>
              </div>
            </div>
            <div className="field-message">
              {imageError && (
                <p className="field-error" id="product-image-error" data-testid="product-image-error" role="alert">
                  {imageError}
                </p>
              )}
            </div>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="btn btn-secondary"
              id="product-cancel-btn"
              data-testid="product-cancel-btn"
              disabled={saving}
              onClick={handleCancel}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              id="product-save-btn"
              data-testid="product-save-btn"
              disabled={!isValid || saving}
              aria-busy={saving}
            >
              {saving && <span className="spinner" id="product-save-spinner" data-testid="product-save-spinner" aria-hidden="true" />}
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      <ConfirmModal
        open={confirmLeave}
        title="Buang perubahan?"
        message="Perubahan yang belum disimpan akan hilang."
        confirmLabel="Buang"
        onConfirm={() => {
          setConfirmLeave(false)
          setInitial(values) // matikan peringatan sebelum pindah halaman
          setImageFile(null)
          setRemoveImage(false)
          navigate('/products')
        }}
        onCancel={closeLeave}
      />
    </main>
  )
}

export default function ProductFormPage({ productId }: Props) {
  return (
    <AppShell>
      {({ user, token }) =>
        user && user.role !== 'admin' ? (
          <main className="page page-narrow" id="product-form-page" data-testid="product-form-page">
            <div className="empty-panel" id="product-forbidden" data-testid="product-forbidden">
              <h1>Tidak bisa mengelola produk</h1>
              <p className="muted">Hanya akun admin yang bisa mengelola produk.</p>
              <Link to="/shop" className="btn btn-secondary" id="product-back-link" data-testid="product-back-link">
                Kembali ke toko
              </Link>
            </div>
          </main>
        ) : (
          <ProductForm token={token} productId={productId} />
        )
      }
    </AppShell>
  )
}
