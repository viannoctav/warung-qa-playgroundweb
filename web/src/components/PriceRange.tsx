import { useEffect, useState } from 'react'
import { formatThousands } from '../validation/product'

type Props = {
  idPrefix: string
  min: number
  max: number
  step: number
  value: [number, number]
  onChange: (value: [number, number]) => void
}

export const PRICE_ORDER_ERROR = 'Harga minimum tidak boleh lebih dari maksimum'

// Rentang harga: dua slider (bisa digeser mouse atau panah keyboard) + dua kotak angka.
// Slider dikunci supaya min tidak melewati max; kotak angka boleh diketik bebas dan divalidasi.
export default function PriceRange({ idPrefix, min, max, step, value, onChange }: Props) {
  const [low, high] = value
  const [lowText, setLowText] = useState(String(low))
  const [highText, setHighText] = useState(String(high))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLowText(String(low))
    setHighText(String(high))
  }, [low, high])

  const percent = (v: number) => ((v - min) / (max - min)) * 100

  function commitText() {
    const a = /^\d+$/.test(lowText) ? Number(lowText) : NaN
    const b = /^\d+$/.test(highText) ? Number(highText) : NaN
    if (Number.isNaN(a) || Number.isNaN(b)) {
      setError(`Harga harus angka ${formatThousands(String(min))}–${formatThousands(String(max))}`)
      return
    }
    if (a > b) {
      setError(PRICE_ORDER_ERROR)
      return
    }
    setError(null)
    onChange([Math.max(min, Math.min(a, max)), Math.max(min, Math.min(b, max))])
  }

  return (
    <fieldset className="price-range" aria-describedby={error ? `${idPrefix}-error` : undefined}>
      <legend>Rentang harga</legend>
      <div className="price-range-track">
        <div className="price-range-fill" style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }} />
        <input
          type="range"
          id={`${idPrefix}-min-slider`}
          data-testid={`${idPrefix}-min-slider`}
          aria-label="Harga minimum"
          aria-valuetext={`Rp ${formatThousands(String(low))}`}
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(event) => {
            setError(null)
            onChange([Math.min(Number(event.target.value), high), high])
          }}
        />
        <input
          type="range"
          id={`${idPrefix}-max-slider`}
          data-testid={`${idPrefix}-max-slider`}
          aria-label="Harga maksimum"
          aria-valuetext={`Rp ${formatThousands(String(high))}`}
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(event) => {
            setError(null)
            onChange([low, Math.max(Number(event.target.value), low)])
          }}
        />
      </div>
      <div className="price-range-inputs">
        <label>
          Min (Rp)
          <input
            type="text"
            inputMode="numeric"
            id={`${idPrefix}-min-input`}
            data-testid={`${idPrefix}-min-input`}
            value={lowText}
            maxLength={7}
            onChange={(event) => setLowText(event.target.value)}
            onBlur={commitText}
            onKeyDown={(event) => event.key === 'Enter' && commitText()}
          />
        </label>
        <label>
          Maks (Rp)
          <input
            type="text"
            inputMode="numeric"
            id={`${idPrefix}-max-input`}
            data-testid={`${idPrefix}-max-input`}
            value={highText}
            maxLength={7}
            onChange={(event) => setHighText(event.target.value)}
            onBlur={commitText}
            onKeyDown={(event) => event.key === 'Enter' && commitText()}
          />
        </label>
      </div>
      <p className="hint" id={`${idPrefix}-label`} data-testid={`${idPrefix}-label`}>
        Rp {formatThousands(String(low))} – Rp {formatThousands(String(high))}
      </p>
      <div className="field-message">
        {error && (
          <p className="field-error" id={`${idPrefix}-error`} data-testid={`${idPrefix}-error`} role="alert">
            {error}
          </p>
        )}
      </div>
    </fieldset>
  )
}
