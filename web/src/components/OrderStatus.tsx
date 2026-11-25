import type { OrderHistory, OrderStatus } from '../api'
import { STATUS_LABEL } from '../validation/order-status'

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))
}

export function StatusPill({ status, id }: { status: OrderStatus; id: string }) {
  return (
    <span className={`status-pill status-${status}`} id={id} data-testid={id} data-status={status}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// Riwayat status: langkah yang sudah lewat, yang sekarang, dan yang masih menunggu
export function StatusTimeline({ status, history, idPrefix }: { status: OrderStatus; history: OrderHistory[]; idPrefix: string }) {
  const flow: OrderStatus[] = status === 'dibatalkan' ? ['diproses', 'dibatalkan'] : ['diproses', 'dikirim', 'selesai']
  return (
    <ol className="timeline" id={`${idPrefix}-timeline`} data-testid={`${idPrefix}-timeline`}>
      {flow.map((step) => {
        const entry = [...history].reverse().find((h) => h.status === step)
        const state = entry ? (step === status ? 'now' : 'done') : 'todo'
        return (
          <li key={step} className={`timeline-step is-${state} status-${step}`} id={`${idPrefix}-timeline-${step}`} data-testid={`${idPrefix}-timeline-${step}`} data-state={state}>
            <span className="timeline-dot" aria-hidden="true" />
            <div>
              <strong>{STATUS_LABEL[step]}</strong>
              <div className="muted timeline-meta">{entry ? `${formatDateTime(entry.createdAt)} oleh ${entry.actor}` : 'Menunggu'}</div>
              {entry?.note && <div className="timeline-note">{entry.note}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
