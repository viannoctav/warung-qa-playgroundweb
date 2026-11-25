import { useEffect, useRef } from 'react'
import type { FormEvent, ReactNode } from 'react'

type Props = {
  open: boolean
  idPrefix: string
  title: string
  description?: ReactNode
  submitLabel: string
  busyLabel: string
  busy: boolean
  danger?: boolean
  error?: string | null
  children: ReactNode
  onSubmit: () => void
  onCancel: () => void
}

// Modal berisi form (Kirim pesanan, Batalkan pesanan). Esc / klik di luar / Batal = tutup.
export default function FormModal({ open, idPrefix, title, description, submitLabel, busyLabel, busy, danger, error, children, onSubmit, onCancel }: Props) {
  const boxRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!open) return
    boxRef.current?.querySelector<HTMLElement>('select, input, textarea')?.focus()
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
      id={`${idPrefix}-backdrop`}
      data-testid={`${idPrefix}-backdrop`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <form
        ref={boxRef}
        className="modal form"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idPrefix}-title`}
        id={idPrefix}
        data-testid={idPrefix}
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          if (!busy) onSubmit()
        }}
      >
        <h2 id={`${idPrefix}-title`} data-testid={`${idPrefix}-title`}>
          {title}
        </h2>
        {description && <p>{description}</p>}
        {error && (
          <div className="alert alert-error" role="alert" id={`${idPrefix}-error`} data-testid={`${idPrefix}-error`}>
            {error}
          </div>
        )}
        {children}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" id={`${idPrefix}-cancel-btn`} data-testid={`${idPrefix}-cancel-btn`} disabled={busy} onClick={onCancel}>
            Batal
          </button>
          <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} id={`${idPrefix}-submit-btn`} data-testid={`${idPrefix}-submit-btn`} disabled={busy} aria-busy={busy}>
            {busy ? busyLabel : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
