import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { User } from '../auth'
import { navigate } from '../router'

type Props = { user: User | null; onReset: () => void; onLogout: () => void }

const CLOSE_DELAY_MS = 300

// Menu akun: terbuka saat kursor di atas tombol nama (hover) atau lewat keyboard (Enter / Spasi / panah bawah).
// Di dalam menu: panah atas/bawah pindah item, Home/End ke ujung, Esc menutup, Tab keluar dari menu.
export default function AccountMenu({ user, onReset, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<number | null>(null)
  // Waktu menu dibuka oleh hover. Klik yang menyusul hover (atau tap di HP) tidak boleh langsung menutupnya.
  const hoverOpenedAt = useRef(0)

  const items = () => Array.from(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  function cancelClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }

  function scheduleClose() {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }

  useEffect(() => cancelClose, [])

  // Klik di luar menu menutupnya
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function openAndFocus(index: number) {
    setOpen(true)
    window.setTimeout(() => {
      const list = items()
      list[(index + list.length) % list.length]?.focus()
    }, 0)
  }

  function onButtonKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openAndFocus(0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openAndFocus(-1)
    } else if (event.key === 'Escape') {
      cancelClose()
      setOpen(false)
    }
  }

  function onMenuKey(event: KeyboardEvent<HTMLUListElement>) {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      list[(index + 1) % list.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      list[(index - 1 + list.length) % list.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      list[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      list[list.length - 1]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  function choose(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div
      className="account-menu"
      ref={wrapRef}
      onMouseEnter={() => {
        cancelClose()
        setOpen((v) => {
          if (!v) hoverOpenedAt.current = Date.now()
          return true
        })
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        ref={buttonRef}
        className="account-menu-btn"
        id="header-account-menu-btn"
        data-testid="header-account-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="header-account-menu"
        onClick={() => {
          // Baru saja dibuka oleh hover → klik ini tetap membuka (tidak menutup lagi)
          if (Date.now() - hoverOpenedAt.current < 600) setOpen(true)
          else setOpen((v) => !v)
        }}
        onKeyDown={onButtonKey}
      >
        <span id="header-username" data-testid="header-username">
          {user?.name ?? 'Akun'}
        </span>
        {user?.role === 'admin' && (
          <span className="badge" id="header-admin-badge" data-testid="header-admin-badge">
            Admin
          </span>
        )}
        <span aria-hidden="true" className="account-menu-caret">
          ▾
        </span>
      </button>
      {open && (
        <ul className="account-menu-list" role="menu" id="header-account-menu" data-testid="header-account-menu" aria-label="Menu akun" onKeyDown={onMenuKey}>
          <li role="none">
            <button type="button" role="menuitem" id="header-menu-orders-btn" data-testid="header-menu-orders-btn" onClick={() => choose(() => navigate('/orders'))}>
              Pesanan saya
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" id="header-reset-btn" data-testid="header-reset-btn" onClick={() => choose(onReset)}>
              Reset Data
            </button>
          </li>
          <li role="separator" className="account-menu-sep" />
          <li role="none">
            <button type="button" role="menuitem" className="is-danger" id="header-logout-btn" data-testid="header-logout-btn" onClick={() => choose(onLogout)}>
              Keluar
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
