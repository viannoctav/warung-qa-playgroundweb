import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, NETWORK_ERROR_MESSAGE, login } from '../api'
import { clearPrefillUsername, peekPrefillUsername, saveSession, setFlashToast, homePath } from '../auth'
import AuthLayout from '../components/AuthLayout'
import FlashToast from '../components/FlashToast'
import { Link, navigate } from '../router'

// Semua id dan teks di halaman ini mengikuti PRD Login + TESTIDS.md
const MESSAGES = {
  usernameRequired: 'Username wajib diisi',
  usernameLength: 'Username harus 3–30 karakter',
  passwordRequired: 'Password wajib diisi',
}

const DEMO_PASSWORD = 'Warung123!'

const DEMO_ACCOUNTS = [
  { username: 'standard_user', note: 'Login berhasil' },
  { username: 'admin_user', note: 'Login berhasil sebagai admin' },
  { username: 'locked_user', note: 'Akun terkunci' },
  { username: 'slow_user', note: 'Login berhasil setelah 5 detik' },
  { username: 'error_user', note: 'Server error' },
  { username: 'bug_user', note: 'Ada bug tersembunyi, temukan sendiri' },
]

function validateUsername(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return MESSAGES.usernameRequired
  if (trimmed.length < 3 || trimmed.length > 30) return MESSAGES.usernameLength
  return null
}

function validatePassword(value: string): string | null {
  return value === '' ? MESSAGES.passwordRequired : null
}

export default function LoginPage() {
  // Setelah registrasi berhasil, username baru langsung terisi
  const [username, setUsername] = useState(peekPrefillUsername)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState({ username: false, password: false })
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const submitting = useRef(false)

  useEffect(() => {
    clearPrefillUsername()
  }, [])

  const usernameError = touched.username ? validateUsername(username) : null
  const passwordError = touched.password ? validatePassword(password) : null
  const canSubmit = username.trim() !== '' && password !== '' && !loading

  // Klik akun demo: username & password langsung terisi
  function fillDemoAccount(demoUsername: string) {
    setUsername(demoUsername)
    setPassword(DEMO_PASSWORD)
    setTouched({ username: false, password: false })
    setServerError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return

    setTouched({ username: true, password: true })
    if (validateUsername(username) || validatePassword(password)) return

    submitting.current = true
    setLoading(true)
    setServerError(null)

    try {
      const result = await login(username, password, remember)
      saveSession(result.token, result.user, remember)
      setFlashToast(`Selamat datang, ${result.user.name}`)
      navigate(homePath(result.user), true)
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE)
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <AuthLayout pageId="login-page">
        <h1 id="login-title" data-testid="login-title">
          Masuk ke Warung QA
        </h1>
        <p className="form-intro">Pakai salah satu akun demo di bawah form, atau akun hasil registrasi.</p>

        {serverError && (
          <div className="alert alert-error" id="login-error-alert" data-testid="login-error-alert" role="alert">
            {serverError}
          </div>
        )}

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-username-input">Username</label>
            <input
              id="login-username-input"
              data-testid="login-username-input"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              readOnly={loading}
              aria-invalid={usernameError ? true : undefined}
              aria-describedby={usernameError ? 'login-username-error' : undefined}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, username: true }))}
            />
            {/* Ruang pesan error selalu disediakan supaya tata letak tidak bergeser */}
            <div className="field-message">
              {usernameError && (
                <p className="field-error" id="login-username-error" data-testid="login-username-error" role="alert">
                  {usernameError}
                </p>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="login-password-input">Password</label>
            <div className="input-with-button">
              <input
                id="login-password-input"
                data-testid="login-password-input"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                readOnly={loading}
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? 'login-password-error' : undefined}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              />
              <button
                type="button"
                className="btn btn-ghost"
                id="login-password-toggle-btn"
                data-testid="login-password-toggle-btn"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-controls="login-password-input"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
            {/* Ruang pesan error selalu disediakan supaya tata letak tidak bergeser */}
            <div className="field-message">
              {passwordError && (
                <p className="field-error" id="login-password-error" data-testid="login-password-error" role="alert">
                  {passwordError}
                </p>
              )}
            </div>
          </div>

          <div className="field-row">
            <label className="checkbox" htmlFor="login-remember-checkbox">
              <input
                id="login-remember-checkbox"
                data-testid="login-remember-checkbox"
                name="remember"
                type="checkbox"
                checked={remember}
                disabled={loading}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Ingat saya
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            id="login-submit-btn"
            data-testid="login-submit-btn"
            disabled={!canSubmit}
            aria-busy={loading}
          >
            {loading && (
              <span className="spinner" id="login-submit-spinner" data-testid="login-submit-spinner" aria-hidden="true" />
            )}
            {loading ? 'Memproses…' : 'Masuk'}
          </button>
        </form>

        <p className="auth-footer">
          Belum punya akun?{' '}
          <Link to="/register" id="login-register-link" data-testid="login-register-link">
            Daftar
          </Link>
        </p>

      <section className="demo-panel" id="login-demo-panel" data-testid="login-demo-panel" aria-labelledby="login-demo-title">
        <div className="demo-panel-head">
          <h2 id="login-demo-title">Akun demo</h2>
          <p>
            Password semua akun: <code>{DEMO_PASSWORD}</code>
          </p>
        </div>
        <ul>
          {DEMO_ACCOUNTS.map((account) => (
            <li
              key={account.username}
              id={`login-demo-account-${account.username}`}
              data-testid={`login-demo-account-${account.username}`}
            >
              <button
                type="button"
                className="demo-account"
                id={`login-demo-fill-btn-${account.username}`}
                data-testid={`login-demo-fill-btn-${account.username}`}
                disabled={loading}
                onClick={() => fillDemoAccount(account.username)}
              >
                <code>{account.username}</code>
                <span>{account.note}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <FlashToast />
    </AuthLayout>
  )
}
