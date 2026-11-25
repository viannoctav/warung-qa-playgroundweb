import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { ApiError, createReview, deleteReviewPhoto, fetchImageUrl, reviewPhotoPath, updateReview, uploadReviewPhoto } from '../api'
import type { Review, ReviewStatus } from '../api'
import { errorMessage } from '../errors'
import {
  REVIEW_BODY_MAX,
  REVIEW_MESSAGES,
  REVIEW_PHOTO_BYTES,
  REVIEW_PHOTO_MAX,
  REVIEW_PHOTO_TYPES,
  REVIEW_STATUS_LABEL,
  formatRating,
  validateReview,
} from '../validation/review'
import FormModal from './FormModal'

// Bintang untuk ditampilkan (bukan input)
export function Stars({ value, id, size = 'md' }: { value: number; id?: string; size?: 'sm' | 'md' | 'lg' }) {
  const rounded = Math.round(value)
  return (
    <span className={`stars stars-${size}`} role="img" aria-label={`${formatRating(value)} dari 5 bintang`} id={id} data-testid={id} data-rating={value}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? 'star is-on' : 'star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  )
}

export function ReviewStatusChip({ status, id }: { status: ReviewStatus; id: string }) {
  return (
    <span className={`review-status review-status-${status}`} id={id} data-testid={id} data-status={status}>
      {REVIEW_STATUS_LABEL[status]}
    </span>
  )
}

// Gambar yang butuh token (foto ulasan)
export function AuthImage({ token, path, alt, id, className }: { token: string; path: string; alt: string; id?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let created: string | null = null
    let cancelled = false
    fetchImageUrl(token, path)
      .then((u) => {
        created = u
        if (!cancelled) setUrl(u)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [token, path])
  if (failed) return <span className={`photo-missing ${className ?? ''}`} id={id} data-testid={id}>Foto tidak tersedia</span>
  if (!url) return <span className={`photo-loading ${className ?? ''}`} aria-hidden="true" />
  return <img src={url} alt={alt} className={className} id={id} data-testid={id} />
}

// Input rating: 5 radio (bisa dipilih pakai panah kiri/kanan)
function StarRatingInput({ value, error, onChange }: { value: number; error?: string; onChange: (value: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const labels = ['', 'Sangat buruk', 'Buruk', 'Cukup', 'Bagus', 'Sangat bagus']
  return (
    <fieldset className="star-input" aria-describedby={error ? 'review-rating-error' : 'review-rating-label'}>
      <legend>Rating</legend>
      <div className="star-input-row" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`star-option${n <= shown ? ' is-on' : ''}`} onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              name="review-rating"
              value={n}
              className="visually-hidden-file"
              id={`review-rating-star-${n}`}
              data-testid={`review-rating-star-${n}`}
              checked={value === n}
              aria-label={`${n} bintang`}
              onChange={() => onChange(n)}
            />
            <span aria-hidden="true">★</span>
          </label>
        ))}
        <span className="muted star-input-label" id="review-rating-label" data-testid="review-rating-label">
          {shown ? labels[shown] : 'Belum dipilih'}
        </span>
      </div>
      <div className="field-message">
        {error && (
          <p className="field-error" id="review-rating-error" data-testid="review-rating-error">
            {error}
          </p>
        )}
      </div>
    </fieldset>
  )
}

type Props = {
  open: boolean
  token: string
  productId: number
  productName: string
  review: Review | null // null = tulis baru
  onSaved: (review: Review) => void
  onClose: () => void
}

// Modal tulis / ubah ulasan, termasuk foto (drag & drop, maks 3)
export function ReviewModal({ open, token, productId, productName, review, onSaved, onClose }: Props) {
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [kept, setKept] = useState<Review['photos']>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [touched, setTouched] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setRating(review?.rating ?? 0)
    setBody(review?.body ?? '')
    setKept(review?.photos ?? [])
    setNewFiles([])
    setPhotoError(null)
    setTouched(false)
    setServerErrors({})
    setError(null)
  }, [open, review])

  const clientErrors = validateReview(rating, body)
  const errors = { ...(touched ? clientErrors : {}), ...serverErrors }
  const photoCount = kept.length + newFiles.length

  function addFiles(list: FileList | null) {
    if (!list) return
    setPhotoError(null)
    const files = Array.from(list)
    const next = [...newFiles]
    for (const file of files) {
      if (!REVIEW_PHOTO_TYPES.includes(file.type) || file.size > REVIEW_PHOTO_BYTES) {
        setPhotoError(REVIEW_MESSAGES.photoType)
        continue
      }
      if (kept.length + next.length >= REVIEW_PHOTO_MAX) {
        setPhotoError(REVIEW_MESSAGES.photoCount)
        break
      }
      next.push(file)
    }
    setNewFiles(next)
    if (inputRef.current) inputRef.current.value = ''
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  async function submit() {
    setTouched(true)
    if (Object.keys(clientErrors).length > 0) return
    setBusy(true)
    setError(null)
    setServerErrors({})
    try {
      const input = { rating, body: body.trim() }
      let saved = review ? await updateReview(token, review.id, input) : await createReview(token, productId, input)
      // Foto yang dihapus lalu foto baru (berurutan supaya batas 3 foto tetap terjaga)
      for (const photo of review?.photos ?? []) {
        if (!kept.some((p) => p.id === photo.id)) saved = await deleteReviewPhoto(token, saved.id, photo.id)
      }
      for (const file of newFiles) saved = await uploadReviewPhoto(token, saved.id, file)
      onSaved(saved)
    } catch (err) {
      setServerErrors(err instanceof ApiError ? (err.fields ?? {}) : {})
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormModal
      open={open}
      idPrefix="review-modal"
      title={review ? 'Ubah ulasan' : 'Tulis ulasan'}
      description={
        review?.status === 'ditolak'
          ? `${productName}. Ditolak: ${review.rejectReason}. Setelah diubah, ulasan menunggu moderasi lagi.`
          : `${productName}. Ulasan tampil di toko setelah disetujui admin.`
      }
      submitLabel={review ? 'Simpan ulasan' : 'Kirim ulasan'}
      busyLabel="Menyimpan…"
      busy={busy}
      error={error}
      onSubmit={submit}
      onCancel={onClose}
    >
      <StarRatingInput
        value={rating}
        error={errors.rating}
        onChange={(n) => {
          setRating(n)
          setServerErrors({})
        }}
      />
      <div className="field">
        <label htmlFor="review-body-input">Ulasan</label>
        <textarea
          id="review-body-input"
          data-testid="review-body-input"
          rows={4}
          maxLength={REVIEW_BODY_MAX + 50}
          placeholder="Ceritakan kualitas produk, kemasan, atau rasanya"
          value={body}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby="review-body-counter"
          onChange={(e) => {
            setBody(e.target.value)
            setServerErrors({})
          }}
        />
        <div className="field-row-between">
          <div className="field-message">
            {errors.body && (
              <p className="field-error" id="review-body-error" data-testid="review-body-error">
                {errors.body}
              </p>
            )}
          </div>
          <span className={`muted counter${body.trim().length > REVIEW_BODY_MAX ? ' is-over' : ''}`} id="review-body-counter" data-testid="review-body-counter">
            {body.trim().length}/{REVIEW_BODY_MAX}
          </span>
        </div>
      </div>

      <div className="field">
        <span className="field-label">Foto (opsional, maks {REVIEW_PHOTO_MAX})</span>
        {photoCount > 0 && (
          <ul className="review-photo-list" id="review-photo-list" data-testid="review-photo-list">
            {kept.map((photo) => (
              <li key={`k${photo.id}`} id={`review-photo-${photo.id}`} data-testid={`review-photo-${photo.id}`}>
                <AuthImage token={token} path={reviewPhotoPath(photo.url)} alt="Foto ulasan" className="review-photo-thumb" />
                <button type="button" className="btn btn-ghost btn-sm btn-ghost-danger" id={`review-photo-remove-btn-${photo.id}`} data-testid={`review-photo-remove-btn-${photo.id}`} aria-label="Hapus foto" disabled={busy} onClick={() => setKept((list) => list.filter((p) => p.id !== photo.id))}>
                  Hapus
                </button>
              </li>
            ))}
            {newFiles.map((file, index) => (
              <li key={`n${index}-${file.name}`} id={`review-photo-new-${index}`} data-testid={`review-photo-new-${index}`}>
                <img src={URL.createObjectURL(file)} alt={file.name} className="review-photo-thumb" />
                <button type="button" className="btn btn-ghost btn-sm btn-ghost-danger" id={`review-photo-new-remove-btn-${index}`} data-testid={`review-photo-new-remove-btn-${index}`} aria-label={`Hapus ${file.name}`} disabled={busy} onClick={() => setNewFiles((list) => list.filter((_, i) => i !== index))}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
        {photoCount < REVIEW_PHOTO_MAX && (
          <div
            className={`dropzone dropzone-sm${dragging ? ' is-dragging' : ''}`}
            id="review-photo-dropzone"
            data-testid="review-photo-dropzone"
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span>{dragging ? 'Lepaskan foto di sini' : 'Seret foto ke sini atau'}</span>
            <label className="btn btn-secondary btn-sm" htmlFor="review-photo-input">
              Pilih foto
            </label>
            <input ref={inputRef} type="file" multiple className="visually-hidden-file" id="review-photo-input" data-testid="review-photo-input" accept="image/png,image/jpeg" disabled={busy} onChange={(e) => addFiles(e.target.files)} />
            <span className="muted">PNG atau JPG, maks 1 MB per foto</span>
          </div>
        )}
        <div className="field-message">
          {photoError && (
            <p className="field-error" id="review-photo-error" data-testid="review-photo-error" role="alert">
              {photoError}
            </p>
          )}
        </div>
      </div>
    </FormModal>
  )
}
