type Props = {
  idPrefix: string
  value: string
  max: number
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  onCommit?: (value: number) => void
}

// Input jumlah dengan tombol − dan +. Input boleh diketik bebas (untuk latihan validasi).
export default function QuantityStepper({ idPrefix, value, max, disabled = false, label, onChange, onCommit }: Props) {
  const number = Number(value)
  const valid = /^\d+$/.test(value)

  function step(delta: number) {
    const next = Math.min(Math.max((valid ? number : 1) + delta, 1), Math.max(max, 1))
    onChange(String(next))
    onCommit?.(next)
  }

  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper-btn"
        id={`${idPrefix}-decrease-btn`}
        data-testid={`${idPrefix}-decrease-btn`}
        aria-label="Kurangi jumlah"
        disabled={disabled || !valid || number <= 1}
        onClick={() => step(-1)}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        className="stepper-input"
        id={`${idPrefix}-input`}
        data-testid={`${idPrefix}-input`}
        aria-label={label}
        value={value}
        disabled={disabled}
        maxLength={3}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (valid && number >= 1) onCommit?.(number)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid && number >= 1) onCommit?.(number)
        }}
      />
      <button
        type="button"
        className="stepper-btn"
        id={`${idPrefix}-increase-btn`}
        data-testid={`${idPrefix}-increase-btn`}
        aria-label="Tambah jumlah"
        disabled={disabled || (valid && number >= Math.min(max, 99))}
        onClick={() => step(1)}
      >
        +
      </button>
    </div>
  )
}
