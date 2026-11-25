import { useEffect, useRef, useState } from 'react'
import { bulkDeleteUsers, deleteUser, fetchUsers } from '../api'
import type { AdminUser } from '../api'
import AppShell from '../components/AppShell'
import { errorMessage, handleUnauthorized } from '../errors'
import { Link, Redirect } from '../router'
import { showToast } from '../toast'
import { formatDateTime } from './OrdersPage'

type SortKey = 'username' | 'fullName' | 'createdAt'
const PAGE_SIZES = [5, 10, 20, 50]

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function SelectAll({ checked, indeterminate, disabled, onChange }: {
  checked: boolean
  indeterminate: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      id="users-select-all-checkbox"
      data-testid="users-select-all-checkbox"
      aria-label="Pilih semua akun registrasi di halaman ini"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}


function UsersContent({ token, currentUserId }: { token: string; currentUserId: number | null }) {
  const [searchText, setSearchText] = useState('')
  const search = useDebounced(searchText.trim(), 300)
  const [role, setRole] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState<SortKey>('createdAt')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [meta, setMeta] = useState<{ total: number; totalPages: number; page: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setPage(1)
  }, [search, role, type, sort, order, limit])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetchUsers(token, { search, role, type, sort, order, page, limit })
      .then((result) => {
        if (cancelled) return
        setUsers(result.data)
        setMeta(result.meta)
        // Pilihan yang sudah tidak ada di daftar dibuang
        setSelected((current) => new Set([...current].filter((id) => result.data.some((u) => u.id === id))))
      })
      .catch((err: unknown) => {
        if (!cancelled && !handleUnauthorized(err)) setLoadError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, search, role, type, sort, order, page, limit, reload])

  const selectable = users.filter((u) => !u.isDemo)
  const selectedOnPage = selectable.filter((u) => selected.has(u.id))
  const allSelected = selectable.length > 0 && selectedOnPage.length === selectable.length

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(selectable.map((u) => u.id)) : new Set())
  }

  function toggleOne(id: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSort(key: SortKey) {
    if (sort === key) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setOrder(key === 'createdAt' ? 'desc' : 'asc')
    }
  }

  const ariaSort = (key: SortKey) => (sort === key ? (order === 'asc' ? 'ascending' : 'descending') : undefined)

  function sortButton(key: SortKey, label: string) {
    const active = sort === key
    return (
      <button
        type="button"
        className={`sort-btn${active ? ' is-active' : ''}`}
        id={`users-sort-${key}-btn`}
        data-testid={`users-sort-${key}-btn`}
        onClick={() => toggleSort(key)}
      >
        {label}
        <span className="sort-indicator" aria-hidden="true">
          {active ? (order === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    )
  }

  // Dialog bawaan browser (latihan handle dialog di automation):
  // hapus satu user → prompt ketik username, hapus banyak → confirm
  function askDeleteOne(id: number, username: string) {
    const typed = window.prompt(`Ketik username ${username} untuk menghapus akun ini.`)
    if (typed === null) return
    if (typed.trim() !== username) {
      window.alert('Username tidak cocok. Akun tidak dihapus.')
      return
    }
    runDelete([id])
  }

  function askDeleteMany(ids: number[]) {
    if (!window.confirm(`Hapus ${ids.length} user? Akun yang dipilih beserta keranjang dan pesanannya akan dihapus permanen.`)) return
    runDelete(ids)
  }

  async function runDelete(ids: number[]) {
    setDeleting(true)
    try {
      if (ids.length === 1) {
        await deleteUser(token, ids[0])
        showToast('User dihapus')
      } else {
        const deleted = await bulkDeleteUsers(token, ids)
        showToast(`${deleted} user dihapus`)
      }
      setSelected(new Set())
      setReload((n) => n + 1)
    } catch (err) {
      if (!handleUnauthorized(err)) setLoadError(errorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const filtersActive = searchText !== '' || role !== '' || type !== ''

  return (
    <main className="page page-wide" id="users-page" data-testid="users-page">
      <div className="page-head">
        <div>
          <h1 id="users-title" data-testid="users-title">
            Kelola User
          </h1>
          <p className="muted" id="users-total" data-testid="users-total">
            {meta ? `${meta.total} user` : 'Memuat…'}
          </p>
        </div>
      </div>

      <p className="note" id="users-note" data-testid="users-note">
        Akun demo hanya bisa dilihat. Akun hasil registrasi terhapus otomatis 24 jam setelah dibuat.
      </p>

      <div className="toolbar">
        <div className="field toolbar-search">
          <label htmlFor="users-search-input">Cari</label>
          <input
            type="text"
            id="users-search-input"
            data-testid="users-search-input"
            name="search"
            placeholder="Username, nama, atau email"
            value={searchText}
            maxLength={100}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="users-role-filter">Role</label>
          <select id="users-role-filter" data-testid="users-role-filter" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Semua role</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="users-type-filter">Jenis akun</label>
          <select id="users-type-filter" data-testid="users-type-filter" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Semua jenis</option>
            <option value="registered">Registrasi</option>
            <option value="demo">Demo</option>
          </select>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            className="btn btn-danger toolbar-action"
            id="users-bulk-delete-btn"
            data-testid="users-bulk-delete-btn"
            disabled={deleting}
            onClick={() => askDeleteMany([...selected])}
          >
            Hapus ({selected.size})
          </button>
        )}
      </div>

      {loadError && (
        <div className="alert alert-error" id="users-error-alert" data-testid="users-error-alert" role="alert">
          {loadError}
        </div>
      )}

      <div className="table-wrap" aria-busy={loading}>
        <table className="data-table" id="users-table" data-testid="users-table">
          <thead>
            <tr>
              <th className="col-check">
                <SelectAll
                  checked={allSelected}
                  indeterminate={selectedOnPage.length > 0 && !allSelected}
                  disabled={selectable.length === 0}
                  onChange={toggleAll}
                />
              </th>
              <th aria-sort={ariaSort('username')}>{sortButton('username', 'Username')}</th>
              <th aria-sort={ariaSort('fullName')}>{sortButton('fullName', 'Nama')}</th>
              <th>Email</th>
              <th>Role</th>
              <th>Jenis</th>
              <th aria-sort={ariaSort('createdAt')}>{sortButton('createdAt', 'Dibuat')}</th>
              <th>Aktif sampai</th>
              <th className="col-actions">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="empty-panel" id="users-empty" data-testid="users-empty">
                    <p>{filtersActive ? 'User tidak ditemukan.' : 'Belum ada user.'}</p>
                    {filtersActive && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        id="users-clear-filters-btn"
                        data-testid="users-clear-filters-btn"
                        onClick={() => {
                          setSearchText('')
                          setRole('')
                          setType('')
                        }}
                      >
                        Hapus filter
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {users.map((user) => {
              const id = user.id
              const self = user.id === currentUserId
              return (
                <tr key={id} id={`users-row-${id}`} data-testid={`users-row-${id}`} className={selected.has(id) ? 'is-selected' : undefined}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      id={`users-select-checkbox-${id}`}
                      data-testid={`users-select-checkbox-${id}`}
                      aria-label={`Pilih ${user.username}`}
                      checked={selected.has(id)}
                      disabled={user.isDemo}
                      onChange={(e) => toggleOne(id, e.target.checked)}
                    />
                  </td>
                  <td className="mono" id={`users-cell-username-${id}`} data-testid={`users-cell-username-${id}`}>
                    {user.username}
                    {self && <span className="muted"> (kamu)</span>}
                  </td>
                  <td id={`users-cell-fullname-${id}`} data-testid={`users-cell-fullname-${id}`}>
                    {user.fullName}
                  </td>
                  <td id={`users-cell-email-${id}`} data-testid={`users-cell-email-${id}`}>
                    {user.email}
                  </td>
                  <td>
                    <span className={`pill ${user.role === 'admin' ? 'pill-admin' : 'pill-on'}`} id={`users-cell-role-${id}`} data-testid={`users-cell-role-${id}`}>
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${user.isDemo ? 'pill-off' : 'pill-on'}`} id={`users-cell-type-${id}`} data-testid={`users-cell-type-${id}`}>
                      {user.isDemo ? 'Demo' : 'Registrasi'}
                    </span>
                  </td>
                  <td id={`users-cell-created-${id}`} data-testid={`users-cell-created-${id}`}>
                    {formatDateTime(user.createdAt)}
                  </td>
                  <td id={`users-cell-expires-${id}`} data-testid={`users-cell-expires-${id}`}>
                    {user.expiresAt ? formatDateTime(user.expiresAt) : 'Selalu aktif'}
                  </td>
                  <td className="col-actions">
                    <div className="row-actions">
                      <Link to={`/admin/users/${id}`} className="btn btn-ghost btn-sm" id={`users-edit-btn-${id}`} data-testid={`users-edit-btn-${id}`}>
                        {user.isDemo ? 'Lihat' : 'Edit'}
                      </Link>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-ghost-danger"
                        id={`users-delete-btn-${id}`}
                        data-testid={`users-delete-btn-${id}`}
                        disabled={user.isDemo}
                        title={user.isDemo ? 'Akun demo tidak bisa dihapus' : undefined}
                        aria-label={`Hapus ${user.username}`}
                        onClick={() => askDeleteOne(id, user.username)}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div className="field pagination-size">
          <label htmlFor="users-page-size-select">Per halaman</label>
          <select id="users-page-size-select" data-testid="users-page-size-select" name="limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="pagination-nav">
          <button type="button" className="btn btn-secondary btn-sm" id="users-page-prev-btn" data-testid="users-page-prev-btn" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
            Sebelumnya
          </button>
          <span id="users-page-info" data-testid="users-page-info" aria-live="polite">
            Halaman {meta?.page ?? page} dari {meta?.totalPages ?? 1}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            id="users-page-next-btn"
            data-testid="users-page-next-btn"
            disabled={loading || !meta || page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </button>
        </div>
      </div>

    </main>
  )
}

export default function UsersPage() {
  return (
    <AppShell>
      {({ user, token }) =>
        user && user.role !== 'admin' ? <Redirect to="/shop" /> : <UsersContent token={token} currentUserId={user?.id ?? null} />
      }
    </AppShell>
  )
}
