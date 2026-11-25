import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, NETWORK_ERROR_MESSAGE, fetchCart, fetchMe, resetData } from '../api'
import type { User } from '../auth'
import { clearSession, getShellToken, getStoredUser, logoutKeepingLeftover } from '../auth'
import { isBugUser } from '../bugs'
import NotificationBell, { announceNotificationsChanged } from './NotificationBell'
import { CART_EVENT, announceCartCount } from '../cart'
import { Link, navigate, usePath } from '../router'
import { showToast } from '../toast'
import AccountMenu from './AccountMenu'
import ConfirmModal from './ConfirmModal'
import FlashToast from './FlashToast'

type Props = {
  children: (context: { user: User | null; token: string }) => ReactNode
  onReset?: () => void
}

// Kerangka halaman setelah login: header (logo, menu, menu akun berisi Reset Data & Keluar) + isi halaman
export default function AppShell({ children, onReset }: Props) {
  const token = getShellToken() ?? ''
  const [user, setUser] = useState<User | null>(getStoredUser)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [cartCount, setCartCount] = useState<number | null>(null)
  const path = usePath()

  // Badge keranjang: diambil sekali, lalu diperbarui setiap halaman mengumumkan jumlah baru
  useEffect(() => {
    const onCart = (event: Event) => setCartCount((event as CustomEvent<number>).detail)
    window.addEventListener(CART_EVENT, onCart)
    if (token) {
      fetchCart(token)
        .then((cart) => setCartCount(cart.itemCount))
        .catch(() => undefined)
    }
    return () => window.removeEventListener(CART_EVENT, onCart)
  }, [token])

  // Pastikan sesi masih valid lewat GET /api/v1/me
  useEffect(() => {
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
        if (!cancelled && error instanceof ApiError && error.status === 401) {
          clearSession()
          navigate('/login', true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  function handleLogout() {
    if (isBugUser()) {
      logoutKeepingLeftover()
      navigate('/login')
      return
    }
    clearSession()
    navigate('/login', true)
  }

  const cancelReset = useCallback(() => setConfirmReset(false), [])

  async function handleReset() {
    setResetting(true)
    try {
      await resetData(token)
      setConfirmReset(false)
      showToast('Data direset')
      announceCartCount(0)
      announceNotificationsChanged()
      onReset?.()
    } catch (error) {
      setConfirmReset(false)
      if (error instanceof ApiError && error.status === 401) {
        clearSession()
        navigate('/login', true)
        return
      }
      window.alert(error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE)
    } finally {
      setResetting(false)
    }
  }

  if (!token) return null

  function navLink(to: string, label: string, id: string, active: boolean) {
    return (
      <Link
        to={to}
        className={`app-nav-link${active ? ' is-active' : ''}`}
        id={id}
        data-testid={id}
        aria-current={active ? 'page' : undefined}
      >
        {label}
      </Link>
    )
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
        <nav className="app-nav" aria-label="Menu utama">
          {navLink('/shop', 'Toko', 'nav-shop-link', path === '/shop' || path.startsWith('/shop/'))}
          {user?.role === 'admin' &&
            navLink('/products', 'Kelola Produk', 'nav-products-link', path.startsWith('/products'))}
          {user?.role === 'admin' &&
            navLink('/admin/users', 'Kelola User', 'nav-users-link', path.startsWith('/admin/users'))}
          {user?.role === 'admin' &&
            navLink('/admin/orders', 'Pesanan Toko', 'nav-store-orders-link', path.startsWith('/admin/orders'))}
          {navLink('/orders', 'Pesanan Saya', 'nav-orders-link', path.startsWith('/orders') || path.startsWith('/checkout/success'))}
          <Link
            to="/cart"
            className={`app-nav-link nav-cart${path === '/cart' || path === '/checkout' ? ' is-active' : ''}`}
            id="nav-cart-link"
            data-testid="nav-cart-link"
            aria-label={`Keranjang, ${cartCount ?? 0} barang`}
          >
            Keranjang
            <span className="cart-count" id="nav-cart-count" data-testid="nav-cart-count">
              {cartCount ?? 0}
            </span>
          </Link>
        </nav>
        <NotificationBell token={token} />
        <AccountMenu user={user} onReset={() => setConfirmReset(true)} onLogout={handleLogout} />
      </header>

      {children({ user, token })}

      <ConfirmModal
        open={confirmReset}
        title="Reset data?"
        message={
          user?.role === 'admin'
            ? 'Katalog produk akun ini kembali ke 24 produk awal (gambar ikut terhapus). Keranjang dan riwayat pesanan akun ini juga dikosongkan.'
            : 'Keranjang dan riwayat pesanan akun ini akan dikosongkan.'
        }
        confirmLabel="Reset"
        busyLabel="Mereset…"
        busy={resetting}
        onConfirm={handleReset}
        onCancel={cancelReset}
      />
      <FlashToast />
    </div>
  )
}
