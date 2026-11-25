import { Link, usePath } from '../router'

const TABS = [
  { to: '/products', id: 'products-tab-list', label: 'Daftar produk' },
  { to: '/products/featured', id: 'products-tab-featured', label: 'Produk unggulan' },
  { to: '/products/stock-history', id: 'products-tab-stock', label: 'Riwayat stok' },
]

// Tab di dalam menu Kelola Produk. Tiap tab punya URL sendiri supaya bisa dibuka langsung.
export default function ProductTabs() {
  const path = usePath()
  return (
    <nav className="page-tabs" aria-label="Bagian Kelola Produk" id="products-tabs" data-testid="products-tabs">
      {TABS.map((tab) => {
        const active = path === tab.to
        return (
          <Link key={tab.to} to={tab.to} className={`page-tab${active ? ' is-active' : ''}`} id={tab.id} data-testid={tab.id} aria-current={active ? 'page' : undefined}>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
