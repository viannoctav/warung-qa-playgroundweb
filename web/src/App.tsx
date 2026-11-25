import './App.css'
import { getToken, homePath } from './auth'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import { InvoicePage, TrackingPage } from './pages/DocumentPages'
import { FeaturedPage, StockHistoryPage } from './pages/ProductExtrasPages'
import StoreOrdersPage, { StoreOrderDetailPage } from './pages/StoreOrdersPage'
import WarungPayPage from './pages/WarungPayPage'
import OrdersPage, { OrderDetailPage } from './pages/OrdersPage'
import ShopPage from './pages/ShopPage'
import UserEditPage from './pages/UserEditPage'
import UsersPage from './pages/UsersPage'
import ShopProductPage from './pages/ShopProductPage'
import LoginPage from './pages/LoginPage'
import ProductFormPage from './pages/ProductFormPage'
import ProductsPage from './pages/ProductsPage'
import RegisterPage from './pages/RegisterPage'
import { Link, Redirect, usePath } from './router'

export default function App() {
  const path = usePath()

  // Route dinamis: /products/{id}/edit
  const editMatch = /^\/products\/(\d+)\/edit$/.exec(path)
  if (editMatch) return <ProductFormPage key={path} productId={Number(editMatch[1])} />

  const userMatch = /^\/admin\/users\/(\d+)$/.exec(path)
  if (userMatch) return <UserEditPage key={path} userId={Number(userMatch[1])} />

  // /shop/{id}, /orders/{nomor}, /checkout/success/{nomor}
  const shopMatch = /^\/shop\/(\d+)$/.exec(path)
  if (shopMatch) return <ShopProductPage key={path} productId={Number(shopMatch[1])} />
  const successMatch = /^\/checkout\/success\/([A-Za-z0-9-]+)$/.exec(path)
  if (successMatch) return <OrderDetailPage key={path} orderNumber={successMatch[1]} success />
  // Dibuka di tab baru (tanpa header aplikasi)
  const docMatch = /^\/orders\/([A-Za-z0-9-]+)\/(invoice|tracking)$/.exec(path)
  if (docMatch) return docMatch[2] === 'invoice' ? <InvoicePage key={path} orderNumber={docMatch[1]} /> : <TrackingPage key={path} orderNumber={docMatch[1]} />
  const storeOrderMatch = /^\/admin\/orders\/([A-Za-z0-9-]+)$/.exec(path)
  if (storeOrderMatch) return <StoreOrderDetailPage key={path} orderNumber={storeOrderMatch[1]} />
  const orderMatch = /^\/orders\/([A-Za-z0-9-]+)$/.exec(path)
  if (orderMatch) return <OrderDetailPage key={path} orderNumber={orderMatch[1]} />

  switch (path) {
    case '/':
      return <Redirect to={getToken() ? homePath() : '/login'} />
    case '/login':
      // Sudah login lalu membuka /login → langsung ke halaman awal (Toko / Kelola Produk)
      return getToken() ? <Redirect to={homePath()} /> : <LoginPage />
    case '/products':
      return <ProductsPage />
    case '/products/featured':
      return <FeaturedPage />
    case '/products/stock-history':
      return <StockHistoryPage />
    case '/admin/orders':
      return <StoreOrdersPage />
    case '/warungpay':
      // Halaman e-wallet di dalam iframe Checkout
      return <WarungPayPage />
    case '/products/new':
      return <ProductFormPage key={path} productId={null} />
    case '/admin/users':
      return <UsersPage />
    case '/shop':
      return <ShopPage />
    case '/cart':
      return <CartPage />
    case '/checkout':
      return <CheckoutPage />
    case '/orders':
      return <OrdersPage />
    case '/register':
      // Sudah login lalu membuka /register → langsung ke halaman awal
      return getToken() ? <Redirect to={homePath()} /> : <RegisterPage />
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
