import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

type Option = { value: string; label: string }
type Props = { idPrefix: string; label: string; options: Option[]; value: string[]; onChange: (value: string[]) => void }

// Pilih banyak kategori: ketik untuk mencari, pilih dari daftar, pilihan tampil sebagai chip.
// Keyboard: panah atas/bawah memilih opsi, Enter menambah/menghapus, Backspace di input kosong menghapus chip terakhir, Esc menutup.
export default function CategoryMultiSelect({ idPrefix, label, options, value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = `${idPrefix}-listbox`
  const hintId = useId()

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
    setQuery('')
    inputRef.current?.focus()
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (open && filtered[active]) toggle(filtered[active].value)
      else setOpen(true)
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'Backspace' && query === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      className="multi-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
      }}
    >
      <label htmlFor={`${idPrefix}-input`}>{label}</label>
      <div className={`multi-select-box${open ? ' is-open' : ''}`} onClick={() => inputRef.current?.focus()}>
        {value.map((v) => (
          <span className="chip" key={v} id={`${idPrefix}-chip-${v}`} data-testid={`${idPrefix}-chip-${v}`}>
            {labelOf(v)}
            <button
              type="button"
              aria-label={`Hapus ${labelOf(v)}`}
              id={`${idPrefix}-chip-remove-${v}`}
              data-testid={`${idPrefix}-chip-remove-${v}`}
              onClick={(event) => {
                event.stopPropagation()
                onChange(value.filter((x) => x !== v))
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          id={`${idPrefix}-input`}
          data-testid={`${idPrefix}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={hintId}
          aria-activedescendant={open && filtered[active] ? `${idPrefix}-option-${filtered[active].value}` : undefined}
          placeholder={value.length === 0 ? 'Semua kategori' : ''}
          value={query}
          maxLength={30}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={onKey}
        />
      </div>
      <span className="sr-only" id={hintId}>
        Ketik untuk mencari. Panah atas atau bawah untuk memilih, Enter untuk menambah atau menghapus.
      </span>
      {open && (
        <ul className="multi-select-list" role="listbox" aria-multiselectable="true" id={listId} data-testid={listId} aria-label={label}>
          {filtered.length === 0 && (
            <li className="multi-select-empty" id={`${idPrefix}-no-option`} data-testid={`${idPrefix}-no-option`}>
              Kategori tidak ditemukan
            </li>
          )}
          {filtered.map((option, index) => {
            const selected = value.includes(option.value)
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={selected}
                className={index === active ? 'is-active' : undefined}
                id={`${idPrefix}-option-${option.value}`}
                data-testid={`${idPrefix}-option-${option.value}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => toggle(option.value)}
              >
                <span className={`multi-select-check${selected ? ' is-checked' : ''}`} aria-hidden="true">
                  {selected ? '✓' : ''}
                </span>
                {option.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
