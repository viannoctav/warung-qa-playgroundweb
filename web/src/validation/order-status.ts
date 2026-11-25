import type { OrderStatus } from '../api'

// Label & aturan status pesanan (sama dengan API)
export const STATUS_LABEL: Record<OrderStatus, string> = {
  diproses: 'Diproses',
  dikirim: 'Dikirim',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

export const STATUS_ORDER: OrderStatus[] = ['diproses', 'dikirim', 'selesai', 'dibatalkan']

export const CANCEL_REASONS = [
  { value: 'stok-habis', label: 'Stok tidak tersedia' },
  { value: 'permintaan-pembeli', label: 'Permintaan pembeli' },
  { value: 'alamat-tidak-valid', label: 'Alamat tidak valid' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const ORDER_MESSAGES = {
  reasonRequired: 'Pilih alasan pembatalan',
  noteRequired: 'Catatan wajib diisi kalau alasannya Lainnya',
  noteLength: 'Catatan maksimal 200 karakter',
  courier: 'Pilih kurir',
  trackingRequired: 'Nomor resi wajib diisi',
  trackingFormat: 'Nomor resi harus 10–20 huruf kapital atau angka',
  proofType: 'File harus PNG atau JPG, maksimal 1 MB',
  dateOrder: 'Tanggal akhir tidak boleh sebelum tanggal awal',
}

export function cancelReasonLabel(value: string | null) {
  return CANCEL_REASONS.find((r) => r.value === value)?.label ?? value ?? ''
}

export function validateCancel(reason: string, note: string) {
  const errors: { reason?: string; note?: string } = {}
  if (!CANCEL_REASONS.some((r) => r.value === reason)) errors.reason = ORDER_MESSAGES.reasonRequired
  if (reason === 'lainnya' && !note.trim()) errors.note = ORDER_MESSAGES.noteRequired
  if (note.trim().length > 200) errors.note = ORDER_MESSAGES.noteLength
  return errors
}

export function validateShipment(courier: string, trackingNumber: string) {
  const errors: { courier?: string; trackingNumber?: string } = {}
  if (!['reguler', 'express', 'sameday'].includes(courier)) errors.courier = ORDER_MESSAGES.courier
  const t = trackingNumber.trim()
  if (!t) errors.trackingNumber = ORDER_MESSAGES.trackingRequired
  else if (!/^[A-Z0-9]{10,20}$/.test(t)) errors.trackingNumber = ORDER_MESSAGES.trackingFormat
  return errors
}
