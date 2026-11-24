import { useEffect, useState } from 'react'
import { ApiError, fetchMe } from '../api'
import type { User } from '../auth'
import { clearSession, getStoredUser, getToken } from '../auth'
import FlashToast from '../components/FlashToast'
import { navigate } from '../router'

// Halaman sementara. Tabel produk lengkap dibangun di Fase 3.
export default function ProductsPage() {
  const [user, setUser] = useState<User | null>(getStoredUser)

  // Pastikan sesi masih valid lewat GET /api/v1/me
  useEffect(() => {
    const token = getToken()
    if (!token) {
      navigate('/login', true)
      return
    }

    let cancelled = false
    fetchMe(token)
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          clearSession()
          navigate('/login', true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  function handleLogout() {
    clearSession()
    navigate('/login', true)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <img
          src="/logo-warung-qa-dark.png"
          alt="Warung QA"
          className="header-logo"
          id="brand-logo"
          data-testid="brand-logo"
          width={640}
          height={570}
        />
        <div className="header-user">
          {user && (
            <span id="header-username" data-testid="header-username">
              {user.name}
              {user.role === 'admin' && (
                <span className="badge" id="header-admin-badge" data-testid="header-admin-badge">
                  Admin
                </span>
              )}
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            id="header-logout-btn"
            data-testid="header-logout-btn"
            onClick={handleLogout}
          >
            Keluar
          </button>
        </div>
      </header>

      <main className="page" id="products-page" data-testid="products-page">
        <h1 id="products-title" data-testid="products-title">
          Produk
        </h1>
        <p className="muted">Halaman produk sedang dibangun (Fase 3).</p>
      </main>

      <FlashToast />
    </div>
  )
}
