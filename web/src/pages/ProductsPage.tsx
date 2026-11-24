import { useEffect, useState } from 'react'
import { ApiError, fetchMe } from '../api'
import type { User } from '../auth'
import { clearFlashToast, clearSession, getStoredUser, getToken, peekFlashToast } from '../auth'
import { navigate } from '../router'

// Halaman sementara. Tabel produk lengkap dibangun di Fase 3.
export default function ProductsPage() {
  const [user, setUser] = useState<User | null>(getStoredUser)
  const [toast, setToast] = useState<string | null>(peekFlashToast)

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

  // Toast "Selamat datang" tampil 3 detik
  useEffect(() => {
    if (!toast) return
    clearFlashToast()
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  function handleLogout() {
    clearSession()
    navigate('/login', true)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">Warung QA</span>
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

      {toast && (
        <div className="toast toast-success" id="toast-success" data-testid="toast-success" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
