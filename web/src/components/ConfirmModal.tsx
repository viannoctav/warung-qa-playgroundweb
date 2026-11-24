import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  busyLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Modal konfirmasi: tutup dengan tombol Batal, tombol Esc, atau klik di luar kotak
export default function ConfirmModal({ open, title, message, confirmLabel, busyLabel, busy = false, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      id="confirm-modal-backdrop"
      data-testid="confirm-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        id="confirm-modal"
        data-testid="confirm-modal"
      >
        <h2 id="confirm-modal-title" data-testid="confirm-modal-title">
          {title}
        </h2>
        <p id="confirm-modal-message" data-testid="confirm-modal-message">
          {message}
        </p>
        <div className="modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            id="confirm-modal-cancel-btn"
            data-testid="confirm-modal-cancel-btn"
            disabled={busy}
            onClick={onCancel}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-danger"
            id="confirm-modal-confirm-btn"
            data-testid="confirm-modal-confirm-btn"
            disabled={busy}
            aria-busy={busy}
            onClick={onConfirm}
          >
            {busy ? (busyLabel ?? 'Memproses…') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
