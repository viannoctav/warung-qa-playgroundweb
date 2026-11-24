import './App.css'
import { getToken } from './auth'
import ComingSoonPage from './pages/ComingSoonPage'
import LoginPage from './pages/LoginPage'
import ProductsPage from './pages/ProductsPage'
import RegisterPage from './pages/RegisterPage'
import { Link, Redirect, usePath } from './router'

export default function App() {
  const path = usePath()

  switch (path) {
    case '/':
      return <Redirect to={getToken() ? '/products' : '/login'} />
    case '/login':
      // Sudah login lalu membuka /login → langsung ke /products
      return getToken() ? <Redirect to="/products" /> : <LoginPage />
    case '/products':
      return <ProductsPage />
    case '/register':
      // Sudah login lalu membuka /register → langsung ke /products
      return getToken() ? <Redirect to="/products" /> : <RegisterPage />
    case '/forgot-password':
      return <ComingSoonPage title="Lupa password" pageId="forgot-password" />
    default:
      return (
        <main className="auth-page" id="not-found-page" data-testid="not-found-page">
          <div className="auth-card">
            <h1 id="not-found-title" data-testid="not-found-title">
              Halaman tidak ditemukan
            </h1>
            <Link to="/" id="not-found-home-link" data-testid="not-found-home-link">
              Kembali ke beranda
            </Link>
          </div>
        </main>
      )
  }
}
