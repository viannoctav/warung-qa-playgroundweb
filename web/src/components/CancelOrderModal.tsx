import { useEffect, useState } from 'react'
import { ApiError } from '../api'
import type { CancelInput } from '../api'
import { errorMessage } from '../errors'
import { CANCEL_REASONS, validateCancel } from '../validation/order-status'
import FormModal from './FormModal'

type Props = {
  open: boolean
  orderNumber: string
  description: string
  onSubmit: (input: CancelInput) => Promise<void>
  onClose: () => void
}

export default function CancelOrderModal({ open, orderNumber, description, onSubmit, onClose }: Props) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setReason('')
      setNote('')
      setTouched(false)
      setServerErrors({})
      setError(null)
    }
  }, [open])

  const clientErrors = validateCancel(reason, note)
  const errors = { ...(touched ? clientErrors : {}), ...serverErrors }

  async function submit() {
    setTouched(true)
    if (Object.keys(clientErrors).length > 0) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ reason, note: note.trim() })
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
      idPrefix="cancel-order-modal"
      title="Batalkan pesanan?"
      description={`${orderNumber} jadi Dibatalkan. ${description} Tindakan ini tidak bisa diulang.`}
      submitLabel="Batalkan pesanan"
      busyLabel="Membatalkan…"
      busy={busy}
      danger
      error={error}
      onSubmit={submit}
      onCancel={onClose}
    >
      <div className="field">
        <label htmlFor="cancel-order-reason-select">Alasan</label>
        <select
          id="cancel-order-reason-select"
          data-testid="cancel-order-reason-select"
          value={reason}
          aria-invalid={errors.reason ? true : undefined}
          onChange={(event) => {
            setReason(event.target.value)
            setServerErrors({})
          }}
        >
          <option value="">Pilih alasan</option>
          {CANCEL_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <div className="field-message">
          {errors.reason && (
            <p className="field-error" id="cancel-order-reason-error" data-testid="cancel-order-reason-error" role="alert">
              {errors.reason}
            </p>
          )}
        </div>
      </div>
      <div className="field">
        <label htmlFor="cancel-order-note-input">
          Catatan <span className="muted">(wajib kalau pilih Lainnya)</span>
        </label>
        <textarea
          id="cancel-order-note-input"
          data-testid="cancel-order-note-input"
          rows={3}
          value={note}
          aria-invalid={errors.note ? true : undefined}
          onChange={(event) => {
            setNote(event.target.value)
            setServerErrors({})
          }}
        />
        <p className="hint counter" id="cancel-order-note-counter" data-testid="cancel-order-note-counter">
          {note.trim().length}/200
        </p>
        <div className="field-message">
          {errors.note && (
            <p className="field-error" id="cancel-order-note-error" data-testid="cancel-order-note-error" role="alert">
              {errors.note}
            </p>
          )}
        </div>
      </div>
    </FormModal>
  )
}
