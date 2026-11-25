import type { ReviewStatus } from '../api'

// Pesan sama persis dengan API
export const REVIEW_MESSAGES = {
  ratingInvalid: 'Pilih rating 1–5 bintang',
  bodyRequired: 'Ulasan wajib diisi',
  bodyMin: 'Ulasan minimal 10 karakter',
  bodyMax: 'Ulasan maksimal 500 karakter',
  photoType: 'Foto harus PNG atau JPG, maksimal 1 MB',
  photoCount: 'Maksimal 3 foto per ulasan',
  reasonRequired: 'Alasan penolakan wajib diisi',
  reasonMin: 'Alasan minimal 5 karakter',
  reasonMax: 'Alasan maksimal 200 karakter',
}

export const REVIEW_BODY_MAX = 500
export const REVIEW_PHOTO_MAX = 3
export const REVIEW_PHOTO_BYTES = 1024 * 1024
export const REVIEW_PHOTO_TYPES = ['image/png', 'image/jpeg']

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  menunggu: 'Menunggu moderasi',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
}

export function validateReview(rating: number, body: string) {
  const errors: { rating?: string; body?: string } = {}
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = REVIEW_MESSAGES.ratingInvalid
  const text = body.trim()
  if (!text) errors.body = REVIEW_MESSAGES.bodyRequired
  else if (text.length < 10) errors.body = REVIEW_MESSAGES.bodyMin
  else if (text.length > REVIEW_BODY_MAX) errors.body = REVIEW_MESSAGES.bodyMax
  return errors
}

export function validateRejectReason(reason: string) {
  const text = reason.trim()
  if (!text) return REVIEW_MESSAGES.reasonRequired
  if (text.length < 5) return REVIEW_MESSAGES.reasonMin
  if (text.length > 200) return REVIEW_MESSAGES.reasonMax
  return null
}

export function formatRating(value: number) {
  return value.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
