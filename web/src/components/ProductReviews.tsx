import { useCallback, useEffect, useState } from 'react'
import { fetchProductReviews, reviewPhotoPath, toggleReviewHelpful } from '../api'
import type { Review, ReviewListMeta } from '../api'
import { errorMessage, handleUnauthorized } from '../errors'
import { showToast } from '../toast'
import { formatRating } from '../validation/review'
import { formatDateTime } from './OrderStatus'
import { AuthImage, ReviewModal, ReviewStatusChip, Stars } from './Reviews'

const SORTS = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'highest', label: 'Rating tertinggi' },
  { value: 'lowest', label: 'Rating terendah' },
]

// Bagian Ulasan di detail produk: ringkasan bintang, ulasan saya, daftar, filter, Membantu
export default function ProductReviews({ token, productId, productName }: { token: string; productId: number; productName: string }) {
  const [rating, setRating] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Review[]>([])
  const [meta, setMeta] = useState<ReviewListMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [helpfulBusy, setHelpfulBusy] = useState<number | null>(null)

  useEffect(() => {
    setPage(1)
  }, [rating, sort])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchProductReviews(token, productId, { rating, sort, page, limit: 5 })
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
  }, [token, productId, rating, sort, page, reload])

  const closeModal = useCallback(() => setModalOpen(false), [])

  async function helpful(review: Review) {
    setHelpfulBusy(review.id)
    try {
      const result = await toggleReviewHelpful(token, review.id)
      setItems((list) => list.map((r) => (r.id === review.id ? { ...r, helpfulByMe: result.helpful, helpfulCount: result.helpfulCount } : r)))
    } catch (err) {
      if (!handleUnauthorized(err)) setError(errorMessage(err))
    } finally {
      setHelpfulBusy(null)
    }
  }

  const mine = meta?.mine ?? null
  const count = meta?.count ?? 0

  return (
    <section className="reviews-section" id="reviews-section" data-testid="reviews-section" aria-labelledby="reviews-title">
      <div className="reviews-head">
        <h2 id="reviews-title">Ulasan</h2>
        {meta?.canReview && (
          <button type="button" className="btn btn-primary btn-sm" id="reviews-write-btn" data-testid="reviews-write-btn" onClick={() => setModalOpen(true)}>
            Tulis ulasan
          </button>
        )}
      </div>

      {meta && (
        <div className="reviews-summary" id="reviews-summary" data-testid="reviews-summary">
          <div className="reviews-average">
            <strong id="reviews-average" data-testid="reviews-average">
              {meta.average === null ? '–' : formatRating(meta.average)}
            </strong>
            <Stars value={meta.average ?? 0} size="lg" id="reviews-average-stars" />
            <span className="muted" id="reviews-count" data-testid="reviews-count">
              {count} ulasan
            </span>
          </div>
          <div className="reviews-distribution" role="group" aria-label="Saring per bintang">
            {(['5', '4', '3', '2', '1'] as const).map((star) => {
              const n = meta.distribution[star]
              const active = rating === star
              return (
                <button
                  key={star}
                  type="button"
                  className={`dist-row${active ? ' is-active' : ''}`}
                  id={`reviews-dist-${star}`}
                  data-testid={`reviews-dist-${star}`}
                  aria-pressed={active}
                  disabled={n === 0 && !active}
                  onClick={() => setRating(active ? '' : star)}
                >
                  <span>{star} ★</span>
                  <span className="dist-bar" aria-hidden="true">
                    <span style={{ width: count ? `${(n / count) * 100}%` : '0%' }} />
                  </span>
                  <span className="dist-count" id={`reviews-dist-count-${star}`} data-testid={`reviews-dist-count-${star}`}>
                    {n}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {mine && (
        <article className="review-card review-mine" id="reviews-mine" data-testid="reviews-mine">
          <div className="review-card-head">
            <strong>Ulasan kamu</strong>
            <ReviewStatusChip status={mine.status} id="reviews-mine-status" />
          </div>
          <Stars value={mine.rating} size="sm" id="reviews-mine-stars" />
          <p className="review-body" id="reviews-mine-body" data-testid="reviews-mine-body">
            {mine.body}
          </p>
          {mine.status === 'ditolak' && mine.rejectReason && (
            <p className="field-error" id="reviews-mine-reason" data-testid="reviews-mine-reason">
              Alasan ditolak: {mine.rejectReason}
            </p>
          )}
          {mine.status !== 'disetujui' && (
            <button type="button" className="btn btn-secondary btn-sm" id="reviews-mine-edit-btn" data-testid="reviews-mine-edit-btn" onClick={() => setModalOpen(true)}>
              Ubah ulasan
            </button>
          )}
        </article>
      )}

      <div className="toolbar reviews-toolbar">
        <div className="field">
          <label htmlFor="reviews-rating-filter">Bintang</label>
          <select id="reviews-rating-filter" data-testid="reviews-rating-filter" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">Semua bintang</option>
            {['5', '4', '3', '2', '1'].map((s) => (
              <option key={s} value={s}>
                {s} bintang
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="reviews-sort-select">Urutkan</label>
          <select id="reviews-sort-select" data-testid="reviews-sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" id="reviews-error-alert" data-testid="reviews-error-alert">
          {error}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="muted empty-inline" id="reviews-empty" data-testid="reviews-empty">
          {rating ? `Belum ada ulasan ${rating} bintang.` : 'Belum ada ulasan untuk produk ini.'}
        </p>
      )}

      <ul className="review-list" id="reviews-list" data-testid="reviews-list" aria-busy={loading}>
        {items.map((review) => (
          <li key={review.id} className="review-card" id={`review-item-${review.id}`} data-testid={`review-item-${review.id}`} data-rating={review.rating}>
            <div className="review-card-head">
              <Stars value={review.rating} size="sm" id={`review-stars-${review.id}`} />
              <span className="muted">
                <b id={`review-author-${review.id}`} data-testid={`review-author-${review.id}`}>
                  {review.author}
                </b>
                , {formatDateTime(review.createdAt)}
              </span>
            </div>
            <p className="review-body" id={`review-body-${review.id}`} data-testid={`review-body-${review.id}`}>
              {review.body}
            </p>
            {review.photos.length > 0 && (
              <div className="review-photos">
                {review.photos.map((photo) => (
                  <AuthImage key={photo.id} token={token} path={reviewPhotoPath(photo.url)} alt={`Foto dari ${review.author}`} className="review-photo-thumb" id={`review-photo-img-${review.id}-${photo.id}`} />
                ))}
              </div>
            )}
            {!review.mine && (
              <button
                type="button"
                className={`helpful-btn${review.helpfulByMe ? ' is-on' : ''}`}
                id={`review-helpful-btn-${review.id}`}
                data-testid={`review-helpful-btn-${review.id}`}
                aria-pressed={review.helpfulByMe}
                disabled={helpfulBusy === review.id}
                onClick={() => helpful(review)}
              >
                Membantu{' '}
                <span id={`review-helpful-count-${review.id}`} data-testid={`review-helpful-count-${review.id}`}>
                  ({review.helpfulCount})
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>

      {meta && meta.totalPages > 1 && (
        <div className="pagination-nav reviews-pagination">
          <button type="button" className="btn btn-secondary btn-sm" id="reviews-page-prev-btn" data-testid="reviews-page-prev-btn" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
            Sebelumnya
          </button>
          <span id="reviews-page-info" data-testid="reviews-page-info">
            Halaman {meta.page} dari {meta.totalPages}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" id="reviews-page-next-btn" data-testid="reviews-page-next-btn" disabled={loading || page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Berikutnya
          </button>
        </div>
      )}

      <ReviewModal
        open={modalOpen}
        token={token}
        productId={productId}
        productName={productName}
        review={mine}
        onClose={closeModal}
        onSaved={() => {
          setModalOpen(false)
          showToast(mine ? 'Ulasan diperbarui' : 'Ulasan dikirim, menunggu moderasi')
          setReload((n) => n + 1)
        }}
      />
    </section>
  )
}
