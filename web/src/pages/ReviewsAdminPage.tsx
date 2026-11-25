import { useCallback, useEffect, useState } from 'react'
import { ApiError, fetchStoreReviews, moderateReview, reviewPhotoPath } from '../api'
import type { Review, ReviewCounts } from '../api'
import AppShell from '../components/AppShell'
import FormModal from '../components/FormModal'
import { formatDateTime } from '../components/OrderStatus'
import ProductTabs from '../components/ProductTabs'
import { AuthImage, ReviewStatusChip, Stars } from '../components/Reviews'
import { errorMessage, handleUnauthorized } from '../errors'
import { Link, Redirect } from '../router'
import { showToast } from '../toast'
import { validateRejectReason } from '../validation/review'

const TABS: { id: '' | keyof Omit<ReviewCounts, 'all'>; key: keyof ReviewCounts; label: string }[] = [
  { id: 'menunggu', key: 'menunggu', label: 'Menunggu' },
  { id: 'disetujui', key: 'disetujui', label: 'Disetujui' },
  { id: 'ditolak', key: 'ditolak', label: 'Ditolak' },
  { id: '', key: 'all', label: 'Semua' },
]

function RejectReviewModal({ review, onClose, onSubmit }: { review: Review | null; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverField, setServerField] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (review) {
      setReason('')
      setTouched(false)
      setError(null)
      setServerField(null)
    }
  }, [review])

  const clientError = validateRejectReason(reason)
  const fieldError = serverField ?? (touched ? clientError : null)

  async function submit() {
    setTouched(true)
    if (clientError) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(reason.trim())
    } catch (err) {
      setServerField(err instanceof ApiError ? (err.fields?.reason ?? null) : null)
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormModal
      open={review !== null}
      idPrefix="reject-review-modal"
      title="Tolak ulasan"
      description={review ? `Ulasan ${review.author} untuk ${review.productName}. Alasan dikirim ke pembeli lewat notifikasi.` : ''}
      submitLabel="Tolak ulasan"
      busyLabel="Menyimpan…"
      busy={busy}
      error={error}
      onSubmit={submit}
      onCancel={onClose}
    >
      <div className="field">
        <label htmlFor="reject-review-reason-input">Alasan</label>
        <textarea
          id="reject-review-reason-input"
          data-testid="reject-review-reason-input"
          rows={3}
          maxLength={250}
          value={reason}
          aria-invalid={fieldError ? true : undefined}
          onChange={(e) => {
            setReason(e.target.value)
            setServerField(null)
          }}
        />
        <div className="field-row-between">
          <div className="field-message">
            {fieldError && (
              <p className="field-error" id="reject-review-reason-error" data-testid="reject-review-reason-error">
                {fieldError}
              </p>
            )}
          </div>
          <span className="muted counter" id="reject-review-reason-counter" data-testid="reject-review-reason-counter">
            {reason.trim().length}/200
          </span>
        </div>
      </div>
    </FormModal>
  )
}

function ReviewsAdminContent({ token, reloadSignal }: { token: string; reloadSignal: number }) {
  const [status, setStatus] = useState<'' | 'menunggu' | 'disetujui' | 'ditolak'>('menunggu')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Review[]>([])
  const [meta, setMeta] = useState<{ page: number; totalPages: number; total: number; counts: ReviewCounts } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Review | null>(null)

  useEffect(() => {
    setPage(1)
  }, [status])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchStoreReviews(token, { status, page, limit: 10 })
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
  }, [token, status, page, reload, reloadSignal])

  async function approve(review: Review) {
    setBusyId(review.id)
    setError(null)
    try {
      await moderateReview(token, review.id, { status: 'disetujui' })
      showToast('Ulasan disetujui')
      setReload((n) => n + 1)
    } catch (err) {
      if (!handleUnauthorized(err)) setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const closeReject = useCallback(() => setRejectTarget(null), [])

  return (
    <main className="page" id="admin-reviews-page" data-testid="admin-reviews-page">
      <div className="page-head">
        <div>
          <h1 id="admin-reviews-title" data-testid="admin-reviews-title">
            Ulasan produk
          </h1>
          <p className="muted" id="admin-reviews-total" data-testid="admin-reviews-total">
            {meta ? `${meta.counts.menunggu} menunggu moderasi` : 'Memuat…'}
          </p>
        </div>
      </div>

      <ProductTabs />

      <div className="status-tabs" role="tablist" aria-label="Filter status ulasan">
        {TABS.map((tab) => {
          const active = status === tab.id
          const testId = `admin-reviews-tab-${tab.id || 'all'}`
          return (
            <button key={tab.key} type="button" role="tab" aria-selected={active} className={`status-tab${active ? ' is-active' : ''}`} id={testId} data-testid={testId} onClick={() => setStatus(tab.id)}>
              {tab.label}
              <span className="tab-count" id={`${testId}-count`} data-testid={`${testId}-count`}>
                {meta?.counts[tab.key] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="alert alert-error" role="alert" id="admin-reviews-error-alert" data-testid="admin-reviews-error-alert">
          {error}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="empty-panel" id="admin-reviews-empty" data-testid="admin-reviews-empty">
          {status === 'menunggu' ? 'Tidak ada ulasan yang menunggu moderasi.' : 'Belum ada ulasan di sini.'}
        </div>
      )}

      <ul className="admin-review-list" aria-busy={loading}>
        {items.map((review) => (
          <li key={review.id} className="review-card" id={`admin-review-${review.id}`} data-testid={`admin-review-${review.id}`} data-status={review.status}>
            <div className="review-card-head">
              <Link to={`/shop/${review.productId}`} className="review-product" id={`admin-review-product-${review.id}`} data-testid={`admin-review-product-${review.id}`}>
                {review.productName}
              </Link>
              <ReviewStatusChip status={review.status} id={`admin-review-status-${review.id}`} />
            </div>
            <div className="review-card-meta">
              <Stars value={review.rating} size="sm" id={`admin-review-stars-${review.id}`} />
              <span className="muted">
                <b id={`admin-review-author-${review.id}`} data-testid={`admin-review-author-${review.id}`}>
                  {review.author}
                </b>
                , {formatDateTime(review.updatedAt)}
              </span>
            </div>
            <p className="review-body" id={`admin-review-body-${review.id}`} data-testid={`admin-review-body-${review.id}`}>
              {review.body}
            </p>
            {review.photos.length > 0 && (
              <div className="review-photos">
                {review.photos.map((photo) => (
                  <AuthImage key={photo.id} token={token} path={reviewPhotoPath(photo.url)} alt={`Foto dari ${review.author}`} className="review-photo-thumb" id={`admin-review-photo-${review.id}-${photo.id}`} />
                ))}
              </div>
            )}
            {review.status === 'ditolak' && review.rejectReason && (
              <p className="muted" id={`admin-review-reason-${review.id}`} data-testid={`admin-review-reason-${review.id}`}>
                Alasan ditolak: {review.rejectReason}
              </p>
            )}
            {review.status === 'menunggu' && (
              <div className="detail-actions">
                <button type="button" className="btn btn-primary btn-sm" id={`admin-review-approve-btn-${review.id}`} data-testid={`admin-review-approve-btn-${review.id}`} disabled={busyId === review.id} aria-busy={busyId === review.id} onClick={() => approve(review)}>
                  {busyId === review.id ? 'Menyimpan…' : 'Setujui'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm btn-ghost-danger" id={`admin-review-reject-btn-${review.id}`} data-testid={`admin-review-reject-btn-${review.id}`} disabled={busyId === review.id} onClick={() => setRejectTarget(review)}>
                  Tolak
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {meta && meta.totalPages > 1 && (
        <div className="pagination-nav">
          <button type="button" className="btn btn-secondary btn-sm" id="admin-reviews-page-prev-btn" data-testid="admin-reviews-page-prev-btn" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
            Sebelumnya
          </button>
          <span id="admin-reviews-page-info" data-testid="admin-reviews-page-info">
            Halaman {meta.page} dari {meta.totalPages}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" id="admin-reviews-page-next-btn" data-testid="admin-reviews-page-next-btn" disabled={loading || page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Berikutnya
          </button>
        </div>
      )}

      <RejectReviewModal
        review={rejectTarget}
        onClose={closeReject}
        onSubmit={async (reason) => {
          if (!rejectTarget) return
          try {
            await moderateReview(token, rejectTarget.id, { status: 'ditolak', reason })
          } catch (err) {
            if (handleUnauthorized(err)) return
            throw err
          }
          setRejectTarget(null)
          showToast('Ulasan ditolak')
          setReload((n) => n + 1)
        }}
      />
    </main>
  )
}

export default function ReviewsAdminPage() {
  const [reloadSignal, setReloadSignal] = useState(0)
  return (
    <AppShell onReset={() => setReloadSignal((n) => n + 1)}>
      {({ user, token }) => (user && user.role !== 'admin' ? <Redirect to="/shop" /> : <ReviewsAdminContent token={token} reloadSignal={reloadSignal} />)}
    </AppShell>
  )
}
