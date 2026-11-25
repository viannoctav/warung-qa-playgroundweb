import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, changeUserPassword, deleteUser, fetchUser, updateUser } from '../api'
import type { AdminUser } from '../api'
import { setFlashToast } from '../auth'
import AppShell from '../components/AppShell'
import { errorMessage, handleUnauthorized } from '../errors'
import { Link, Redirect, navigate } from '../router'
import { showToast } from '../toast'
import { GENDER_OPTIONS, passwordStrength, todayInJakarta } from '../validation/register'
import { changedFields, validatePasswordChange, validateProfile } from '../validation/user-admin'
import type { PasswordErrors, PasswordValues, ProfileErrors, ProfileField, ProfileValues } from '../validation/user-admin'
import { formatDateTime } from './OrdersPage'

// Bagian nama data-testid tiap field, contoh user-edit-fullname-input / user-edit-fullname-error
const SLUG: Record<ProfileField, string> = {
  fullName: 'fullname',
  username: 'username',
  email: 'email',
  phone: 'phone',
  birthDate: 'birthdate',
  gender: 'gender',
}

const TEXT_FIELDS: { field: Exclude<ProfileField, 'gender'>; label: string; type: string; autoComplete: string }[] = [
  { field: 'fullName', label: 'Nama lengkap', type: 'text', autoComplete: 'off' },
  { field: 'username', label: 'Username', type: 'text', autoComplete: 'off' },
  { field: 'email', label: 'Email', type: 'email', autoComplete: 'off' },
  { field: 'phone', label: 'Nomor HP', type: 'tel', autoComplete: 'off' },
  { field: 'birthDate', label: 'Tanggal lahir', type: 'date', autoComplete: 'off' },
]

function toProfile(user: AdminUser): ProfileValues {
  return {
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone ?? '',
    birthDate: user.birthDate ?? '',
    gender: user.gender ?? '',
  }
}

function FieldError({ id, message }: { id: string; message?: string | null }) {
  return (
    <div className="field-message">
      {message && (
        <p className="field-error" id={id} data-testid={id} role="alert">
          {message}
        </p>
      )}
    </div>
  )
}

const EMPTY_PASSWORD: PasswordValues = { newPassword: '', confirmPassword: '' }

function UserEditor({ token, userId }: { token: string; userId: number }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'not-found'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  // Form data diri
  const [initial, setInitial] = useState<ProfileValues | null>(null)
  const [values, setValues] = useState<ProfileValues | null>(null)
  const [touched, setTouched] = useState<Partial<Record<ProfileField, boolean>>>({})
  const [serverErrors, setServerErrors] = useState<ProfileErrors>({})
  const [profileError, setProfileError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const profileLock = useRef(false)

  // Form ganti password
  const [password, setPassword] = useState<PasswordValues>(EMPTY_PASSWORD)
  const [passwordTouched, setPasswordTouched] = useState<Partial<Record<keyof PasswordValues, boolean>>>({})
  const [passwordServerErrors, setPasswordServerErrors] = useState<PasswordErrors>({})
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const passwordLock = useRef(false)

  // Hapus
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchUser(token, userId)
      .then((data) => {
        if (cancelled) return
        setUser(data)
        setInitial(toProfile(data))
        setValues(toProfile(data))
        setLoadState('ready')
      })
      .catch((err: unknown) => {
        if (cancelled || handleUnauthorized(err)) return
        if (err instanceof ApiError && err.status === 404) setLoadState('not-found')
        else setLoadError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [token, userId])


  if (loadError) {
    return (
      <main className="page page-narrow" id="user-edit-page" data-testid="user-edit-page">
        <div className="alert alert-error" id="user-edit-load-error" data-testid="user-edit-load-error" role="alert">
          {loadError}
        </div>
      </main>
    )
  }

  if (loadState === 'not-found') {
    return (
      <main className="page page-narrow" id="user-edit-page" data-testid="user-edit-page">
        <div className="empty-panel" id="user-not-found" data-testid="user-not-found">
          <h1>User tidak ditemukan</h1>
          <p className="muted">Akun ini tidak ada, sudah dihapus, atau sudah lewat 24 jam.</p>
          <Link to="/admin/users" className="btn btn-secondary" id="user-not-found-back-link" data-testid="user-not-found-back-link">
            Kembali ke Kelola User
          </Link>
        </div>
      </main>
    )
  }

  if (!user || !values || !initial) {
    return (
      <main className="page page-narrow" id="user-edit-page" data-testid="user-edit-page">
        <p className="empty-panel" id="user-edit-loading" data-testid="user-edit-loading">
          Memuat data user…
        </p>
      </main>
    )
  }

  const readOnly = user.isDemo
  const clientErrors = validateProfile(values)
  const changes = changedFields(values, initial)
  const hasChanges = Object.keys(changes).length > 0
  const profileValid = Object.keys(clientErrors).length === 0
  const errorFor = (field: ProfileField) => serverErrors[field] ?? (touched[field] ? clientErrors[field] : undefined)
  const errorId = (field: ProfileField) => `user-edit-${SLUG[field]}-error`

  const passwordClientErrors = validatePasswordChange(password)
  const passwordErrorFor = (field: keyof PasswordValues) =>
    passwordServerErrors[field] ?? (passwordTouched[field] ? passwordClientErrors[field] : undefined)
  const strength = passwordStrength(password.newPassword)

  function setField(field: ProfileField, value: string) {
    setValues((current) => (current ? { ...current, [field]: value } : current))
    setServerErrors((current) => ({ ...current, [field]: undefined }))
    setProfileError(null)
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (profileLock.current || !values || !initial) return
    setTouched({ fullName: true, username: true, email: true, phone: true, birthDate: true, gender: true })
    if (!profileValid) {
      const first = Object.keys(clientErrors)[0] as ProfileField
      document.getElementById(`user-edit-${SLUG[first]}-input`)?.focus()
      return
    }
    if (!hasChanges) return
    profileLock.current = true
    setSavingProfile(true)
    setProfileError(null)
    try {
      const updated = await updateUser(token, userId, changes)
      setUser(updated)
      setInitial(toProfile(updated))
      setValues(toProfile(updated))
      setTouched({})
      showToast('Data user disimpan')
    } catch (err) {
      if (handleUnauthorized(err)) return
      if (err instanceof ApiError && err.fields) setServerErrors(err.fields as ProfileErrors)
      setProfileError(errorMessage(err))
    } finally {
      profileLock.current = false
      setSavingProfile(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (passwordLock.current) return
    setPasswordTouched({ newPassword: true, confirmPassword: true })
    if (Object.keys(passwordClientErrors).length > 0) {
      document.getElementById(passwordClientErrors.newPassword ? 'user-password-new-input' : 'user-password-confirm-input')?.focus()
      return
    }
    passwordLock.current = true
    setSavingPassword(true)
    setPasswordError(null)
    try {
      await changeUserPassword(token, userId, password.newPassword, password.confirmPassword)
      setPassword(EMPTY_PASSWORD)
      setPasswordTouched({})
      setShowPassword(false)
      showToast('Password berhasil diubah')
    } catch (err) {
      if (handleUnauthorized(err)) return
      if (err instanceof ApiError && err.fields) setPasswordServerErrors(err.fields as PasswordErrors)
      setPasswordError(errorMessage(err))
    } finally {
      passwordLock.current = false
      setSavingPassword(false)
    }
  }

  // Dialog bawaan browser: ketik username untuk konfirmasi
  async function handleDelete() {
    if (!user) return
    const typed = window.prompt(`Ketik username ${user.username} untuk menghapus akun ini.`)
    if (typed === null) return
    if (typed.trim() !== user.username) {
      window.alert('Username tidak cocok. Akun tidak dihapus.')
      return
    }
    setDeleting(true)
    try {
      await deleteUser(token, userId)
      setFlashToast(`${user?.username} dihapus`)
      navigate('/admin/users', true)
    } catch (err) {
      setDeleting(false)
      if (!handleUnauthorized(err)) setProfileError(errorMessage(err))
    }
  }

  return (
    <main className="page page-narrow" id="user-edit-page" data-testid="user-edit-page">
      <Link to="/admin/users" className="back-link" id="user-edit-back-link" data-testid="user-edit-back-link">
        ← Kelola User
      </Link>
      <div className="page-head">
        <div>
          <h1 id="user-edit-title" data-testid="user-edit-title">
            {readOnly ? 'Detail user' : 'Edit user'}
          </h1>
          <p className="muted" id="user-edit-meta" data-testid="user-edit-meta">
            <span className="mono">{user.username}</span>, dibuat {formatDateTime(user.createdAt)}
            {user.expiresAt ? `, aktif sampai ${formatDateTime(user.expiresAt)}` : ''}
          </p>
        </div>
        <span className={`pill ${user.role === 'admin' ? 'pill-admin' : 'pill-on'}`} id="user-edit-role" data-testid="user-edit-role">
          {user.role === 'admin' ? 'Admin' : 'User'}
        </span>
      </div>

      {readOnly && (
        <p className="note" id="user-edit-demo-note" data-testid="user-edit-demo-note">
          Ini akun demo. Datanya hanya bisa dilihat, tidak bisa diubah, diganti password, atau dihapus.
        </p>
      )}

      {/* ---------- Data diri ---------- */}
      <form className="form form-card" id="user-edit-form" data-testid="user-edit-form" onSubmit={saveProfile} noValidate>
        <h2>Data diri</h2>
        {profileError && (
          <div className="alert alert-error" id="user-edit-error-alert" data-testid="user-edit-error-alert" role="alert">
            {profileError}
          </div>
        )}
        <div className="form-grid">
          {TEXT_FIELDS.map(({ field, label, type, autoComplete }) => {
            const id = `user-edit-${SLUG[field]}-input`
            const message = readOnly ? undefined : errorFor(field)
            return (
              <div className={`field${field === 'fullName' ? ' field-wide' : ''}`} key={field}>
                <label htmlFor={id}>{label}</label>
                <input
                  id={id}
                  data-testid={id}
                  name={field}
                  type={type}
                  autoComplete={autoComplete}
                  value={values[field]}
                  max={field === 'birthDate' ? todayInJakarta() : undefined}
                  readOnly={readOnly}
                  disabled={savingProfile}
                  aria-invalid={message ? true : undefined}
                  aria-describedby={message ? errorId(field) : undefined}
                  onChange={(e) => setField(field, e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, [field]: true }))}
                />
                <FieldError id={errorId(field)} message={message} />
              </div>
            )
          })}
        </div>

        <fieldset className="field" aria-describedby={errorFor('gender') ? errorId('gender') : undefined}>
          <legend>Jenis kelamin</legend>
          <div className="choice-group">
            {GENDER_OPTIONS.map((option) => {
              const id = `user-edit-gender-radio-${option.value}`
              return (
                <label className="choice" htmlFor={id} key={option.value}>
                  <input
                    type="radio"
                    id={id}
                    data-testid={id}
                    name="gender"
                    value={option.value}
                    checked={values.gender === option.value}
                    disabled={readOnly || savingProfile}
                    onChange={() => setField('gender', option.value)}
                  />
                  {option.label}
                </label>
              )
            })}
          </div>
          <FieldError id={errorId('gender')} message={readOnly ? undefined : errorFor('gender')} />
        </fieldset>

        {!readOnly && (
          <div className="button-row">
            <button
              type="button"
              className="btn btn-secondary"
              id="user-edit-reset-btn"
              data-testid="user-edit-reset-btn"
              disabled={!hasChanges || savingProfile}
              onClick={() => {
                setValues(initial)
                setTouched({})
                setServerErrors({})
                setProfileError(null)
              }}
            >
              Batalkan perubahan
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              id="user-edit-save-btn"
              data-testid="user-edit-save-btn"
              disabled={!hasChanges || savingProfile}
            >
              {savingProfile ? 'Menyimpan…' : 'Simpan data'}
            </button>
          </div>
        )}
      </form>

      {!readOnly && (
        <>
          {/* ---------- Ganti password ---------- */}
          <form className="form form-card" id="user-password-form" data-testid="user-password-form" onSubmit={savePassword} noValidate>
            <h2>Ganti password</h2>
            <p className="hint">Minimal 8 karakter, berisi huruf besar, huruf kecil, angka, dan simbol.</p>
            {passwordError && (
              <div className="alert alert-error" id="user-password-error-alert" data-testid="user-password-error-alert" role="alert">
                {passwordError}
              </div>
            )}
            <div className="field">
              <label htmlFor="user-password-new-input">Password baru</label>
              <div className="input-with-button">
                <input
                  id="user-password-new-input"
                  data-testid="user-password-new-input"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password.newPassword}
                  disabled={savingPassword}
                  aria-invalid={passwordErrorFor('newPassword') ? true : undefined}
                  onChange={(e) => {
                    setPassword((p) => ({ ...p, newPassword: e.target.value }))
                    setPasswordServerErrors({})
                    setPasswordError(null)
                  }}
                  onBlur={() => setPasswordTouched((t) => ({ ...t, newPassword: true }))}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  id="user-password-toggle-btn"
                  data-testid="user-password-toggle-btn"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-controls="user-password-new-input"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
              {strength && (
                <p className="hint">
                  Kekuatan password:{' '}
                  <span className={`strength strength-${strength.toLowerCase()}`} id="user-password-strength" data-testid="user-password-strength">
                    {strength}
                  </span>
                </p>
              )}
              <FieldError id="user-password-new-error" message={passwordErrorFor('newPassword')} />
            </div>
            <div className="field">
              <label htmlFor="user-password-confirm-input">Konfirmasi password baru</label>
              <input
                id="user-password-confirm-input"
                data-testid="user-password-confirm-input"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={password.confirmPassword}
                disabled={savingPassword}
                aria-invalid={passwordErrorFor('confirmPassword') ? true : undefined}
                onChange={(e) => {
                  setPassword((p) => ({ ...p, confirmPassword: e.target.value }))
                  setPasswordServerErrors({})
                  setPasswordError(null)
                }}
                onBlur={() => setPasswordTouched((t) => ({ ...t, confirmPassword: true }))}
              />
              <FieldError id="user-password-confirm-error" message={passwordErrorFor('confirmPassword')} />
            </div>
            <div className="button-row">
              <button type="submit" className="btn btn-primary" id="user-password-save-btn" data-testid="user-password-save-btn" disabled={savingPassword}>
                {savingPassword ? 'Menyimpan…' : 'Simpan password'}
              </button>
            </div>
          </form>

          {/* ---------- Hapus ---------- */}
          <section className="form-card danger-zone" id="user-delete-section" data-testid="user-delete-section">
            <h2>Hapus user</h2>
            <p className="muted">Akun ini beserta keranjang dan pesanannya dihapus permanen. User langsung keluar dari sesinya.</p>
            <button
              type="button"
              className="btn btn-danger"
              id="user-delete-btn"
              data-testid="user-delete-btn"
              disabled={deleting}
              aria-busy={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Menghapus…' : 'Hapus user ini'}
            </button>
          </section>
        </>
      )}

    </main>
  )
}

export default function UserEditPage({ userId }: { userId: number }) {
  return (
    <AppShell>
      {({ user, token }) => (user && user.role !== 'admin' ? <Redirect to="/shop" /> : <UserEditor token={token} userId={userId} />)}
    </AppShell>
  )
}
