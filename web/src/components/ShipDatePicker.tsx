import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { addDays, formatDateLong, isWeekend, todayJakarta, validateShipDate } from '../validation/checkout'

type Props = { value: string; error?: string | null; onChange: (value: string) => void }

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTH = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })

function monthStart(dateText: string) {
  return `${dateText.slice(0, 7)}-01`
}

function shiftMonth(first: string, delta: number) {
  const d = new Date(`${first}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + delta)
  return d.toISOString().slice(0, 10)
}

// Tanggal kirim: bisa diketik (YYYY-MM-DD) atau dipilih di kalender.
// Kalender: panah kiri/kanan = hari, atas/bawah = minggu, Enter = pilih, Esc = tutup. Sabtu, Minggu, dan di luar H+1…H+14 nonaktif.
export default function ShipDatePicker({ value, error, onChange }: Props) {
  const today = todayJakarta()
  const minDate = addDays(today, 1)
  const maxDate = addDays(today, 14)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(monthStart(value || minDate))
  const [focusDate, setFocusDate] = useState(value || minDate)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus()
  }, [open, focusDate, month])

  const disabled = (d: string) => d < minDate || d > maxDate || isWeekend(d)

  // Sel kalender: kosong di awal supaya tanggal 1 jatuh di kolom hari yang benar (Senin pertama)
  const first = new Date(`${month}T00:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const cells: (string | null)[] = [...Array(offset).fill(null)]
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(`${month.slice(0, 8)}${String(day).padStart(2, '0')}`)

  function move(days: number) {
    const next = addDays(focusDate, days)
    setFocusDate(next)
    if (monthStart(next) !== month) setMonth(monthStart(next))
  }

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (map[event.key]) {
      event.preventDefault()
      move(map[event.key])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  const hint = value && !validateShipDate(value) ? formatDateLong(value) : 'Hari kerja, paling cepat besok, paling lambat 14 hari lagi'

  return (
    <div className="field ship-date">
      <label htmlFor="checkout-ship-date-input">Tanggal kirim</label>
      <div className="input-action">
        <input
          type="text"
          id="checkout-ship-date-input"
          data-testid="checkout-ship-date-input"
          name="shipDate"
          placeholder="YYYY-MM-DD"
          autoComplete="off"
          inputMode="numeric"
          maxLength={10}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'checkout-ship-date-error' : 'checkout-ship-date-hint'}
          onChange={(event) => onChange(event.target.value.trim())}
        />
        <button
          type="button"
          className="btn btn-secondary"
          id="checkout-ship-date-toggle-btn"
          data-testid="checkout-ship-date-toggle-btn"
          aria-expanded={open}
          aria-controls="checkout-ship-date-calendar"
          onClick={() => {
            setFocusDate(value && !validateShipDate(value) ? value : minDate)
            setMonth(monthStart(value && !validateShipDate(value) ? value : minDate))
            setOpen((v) => !v)
          }}
        >
          {open ? 'Tutup kalender' : 'Pilih di kalender'}
        </button>
      </div>
      {open && (
        <div className="calendar" role="dialog" aria-label="Pilih tanggal kirim" id="checkout-ship-date-calendar" data-testid="checkout-ship-date-calendar">
          <div className="calendar-head">
            <button
              type="button"
              className="calendar-nav"
              id="checkout-ship-date-prev-btn"
              data-testid="checkout-ship-date-prev-btn"
              aria-label="Bulan sebelumnya"
              disabled={month <= monthStart(today)}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              ‹
            </button>
            <strong id="checkout-ship-date-month" data-testid="checkout-ship-date-month" aria-live="polite">
              {MONTH.format(first)}
            </strong>
            <button
              type="button"
              className="calendar-nav"
              id="checkout-ship-date-next-btn"
              data-testid="checkout-ship-date-next-btn"
              aria-label="Bulan berikutnya"
              disabled={month >= monthStart(maxDate)}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              ›
            </button>
          </div>
          <div className="calendar-grid calendar-weekdays" aria-hidden="true">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid" ref={gridRef} role="grid" aria-label={MONTH.format(first)} onKeyDown={onGridKey}>
            {cells.map((d, i) =>
              d === null ? (
                <span key={`e${i}`} />
              ) : (
                <button
                  type="button"
                  key={d}
                  data-date={d}
                  id={`checkout-ship-date-day-${d}`}
                  data-testid={`checkout-ship-date-day-${d}`}
                  className={`calendar-day${d === value ? ' is-selected' : ''}${d === today ? ' is-today' : ''}`}
                  disabled={disabled(d)}
                  tabIndex={d === focusDate ? 0 : -1}
                  aria-pressed={d === value}
                  aria-label={formatDateLong(d)}
                  onClick={() => {
                    onChange(d)
                    setOpen(false)
                  }}
                >
                  {Number(d.slice(8))}
                </button>
              ),
            )}
          </div>
        </div>
      )}
      <p className="hint" id="checkout-ship-date-hint" data-testid="checkout-ship-date-hint">
        {hint}
      </p>
      <div className="field-message">
        {error && (
          <p className="field-error" id="checkout-ship-date-error" data-testid="checkout-ship-date-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
