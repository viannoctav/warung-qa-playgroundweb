import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { ApiError, NETWORK_ERROR_MESSAGE, register } from '../api'
import { setFlashToast, setPrefillUsername } from '../auth'
import AuthLayout from '../components/AuthLayout'
import { Link, navigate } from '../router'
import {
  DEFAULT_VALUES,
  GENDER_OPTIONS,
  passwordStrength,
  todayInJakarta,
  validateRegister,
} from '../validation/register'
import type { RegisterErrors, RegisterField, RegisterValues } from '../validation/register'

// Bagian nama data-testid untuk tiap field, contoh register-fullname-input / register-fullname-error
const SLUG: Record<RegisterField, string> = {
  fullName: 'fullname',
  username: 'username',
  email: 'email',
  phone: 'phone',
  birthDate: 'birthdate',
  gender: 'gender',
  password: 'password',
  confirmPassword: 'confirm-password',
}

const ALL_FIELDS = Object.keys(SLUG) as RegisterField[]

function errorId(field: RegisterField) {
  return `register-${SLUG[field]}-error`
}

// Ruang pesan error selalu disediakan supaya tata letak tidak bergeser
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

export default function RegisterPage() {
  const [values, setValues] = useState<RegisterValues>(DEFAULT_VALUES)
  const [touched, setTouched] = useState<Partial<Record<RegisterField, boolean>>>({})
  const [serverFieldErrors, setServerFieldErrors] = useState<RegisterErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const submitting = useRef(false)

  const clientErrors = validateRegister(values)
  const isValid = Object.keys(clientErrors).length === 0
  const strength = passwordStrength(values.password)
  const today = todayInJakarta()

  function errorFor(field: RegisterField): string | undefined {
    return serverFieldErrors[field] ?? (touched[field] ? clientErrors[field] : undefined)
  }

  function describedBy(field: RegisterField) {
    return errorFor(field) ? errorId(field) : undefined
  }

  function update<K extends RegisterField>(field: K, value: RegisterValues[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    setServerFieldErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function touch(field: RegisterField) {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }))
  }

  function touchAll() {
    setTouched(Object.fromEntries(ALL_FIELDS.map((field) => [field, true])))
  }

  function textProps(field: RegisterField) {
    const value = values[field]
    return {
      id: `register-${SLUG[field]}-input`,
      'data-testid': `register-${SLUG[field]}-input`,
      name: field,
      value: typeof value === 'string' ? value : '',
      readOnly: loading,
      'aria-invalid': errorFor(field) ? true : undefined,
      'aria-describedby': describedBy(field),
      onChange: (e: ChangeEvent<HTMLInputElement>) => update(field, e.target.value as RegisterValues[typeof field]),
      onBlur: () => touch(field),
    }
  }

  function handleReset() {
    setValues(DEFAULT_VALUES)
    setTouched({})
    setServerFieldErrors({})
    setServerError(null)
    setShowPassword(false)
  }

  // Enter saat form belum valid: tampilkan semua pesan error
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement
    if (event.key === 'Enter' && target.tagName !== 'BUTTON' && !isValid) {
      event.preventDefault()
      touchAll()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    touchAll()
    if (!isValid) return

    submitting.current = true
    setLoading(true)
    setServerError(null)

    try {
      const user = await register(values)
      setFlashToast('Registrasi berhasil. Silakan login.')
      setPrefillUsername(user.username)
      navigate('/login', true)
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.message)
        if (error.fields) setServerFieldErrors(error.fields as RegisterErrors)
      } else {
        setServerError(NETWORK_ERROR_MESSAGE)
      }
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <AuthLayout pageId="register-page">
        <h1 id="register-title" data-testid="register-title">
          Buat Akun Warung QA
        </h1>
        <p className="note" id="register-info-note" data-testid="register-info-note">
          Akun yang kamu buat aktif selama 24 jam, setelah itu dihapus otomatis.
        </p>

        {serverError && (
          <div className="alert alert-error" id="register-error-alert" data-testid="register-error-alert" role="alert">
            {serverError}
          </div>
        )}

        <form className="form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
          <div className="field">
            <label htmlFor="register-fullname-input">Nama lengkap</label>
            <input type="text" autoComplete="name" autoFocus {...textProps('fullName')} />
            <FieldError id={errorId('fullName')} message={errorFor('fullName')} />
          </div>

          <div className="field">
            <label htmlFor="register-username-input">Username</label>
            <input type="text" autoComplete="username" {...textProps('username')} />
            <FieldError id={errorId('username')} message={errorFor('username')} />
          </div>

          <div className="field">
            <label htmlFor="register-email-input">Email</label>
            <input type="email" autoComplete="email" {...textProps('email')} />
            <FieldError id={errorId('email')} message={errorFor('email')} />
          </div>

          <div className="field">
            <label htmlFor="register-phone-input">Nomor HP</label>
            <input type="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" {...textProps('phone')} />
            <FieldError id={errorId('phone')} message={errorFor('phone')} />
          </div>

          <div className="field">
            <label htmlFor="register-birthdate-input">Tanggal lahir</label>
            <input type="date" autoComplete="bday" max={today} {...textProps('birthDate')} />
            <FieldError id={errorId('birthDate')} message={errorFor('birthDate')} />
          </div>

          <fieldset className="field" aria-describedby={describedBy('gender')}>
            <legend>Jenis kelamin</legend>
            <div className="choice-group">
              {GENDER_OPTIONS.map((option) => {
                const id = `register-gender-radio-${option.value}`
                return (
                  <label className="choice" htmlFor={id} key={option.value}>
                    <input
                      type="radio"
                      id={id}
                      data-testid={id}
                      name="gender"
                      value={option.value}
                      checked={values.gender === option.value}
                      disabled={loading}
                      onChange={() => {
                        update('gender', option.value)
                        touch('gender')
                      }}
                      onBlur={() => touch('gender')}
                    />
                    {option.label}
                  </label>
                )
              })}
            </div>
            <FieldError id={errorId('gender')} message={errorFor('gender')} />
          </fieldset>

          <div className="field">
            <label htmlFor="register-password-input">Password</label>
            <div className="input-with-button">
              <input
                {...textProps('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="btn btn-ghost"
                id="register-password-toggle-btn"
                data-testid="register-password-toggle-btn"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-controls="register-password-input"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>
            {strength && (
              <p className="hint">
                Kekuatan password:{' '}
                <span
                  className={`strength strength-${strength.toLowerCase()}`}
                  id="register-password-strength"
                  data-testid="register-password-strength"
                >
                  {strength}
                </span>
              </p>
            )}
            <FieldError id={errorId('password')} message={errorFor('password')} />
          </div>

          <div className="field">
            <label htmlFor="register-confirm-password-input">Konfirmasi password</label>
            <input type="password" autoComplete="new-password" {...textProps('confirmPassword')} />
            <FieldError id={errorId('confirmPassword')} message={errorFor('confirmPassword')} />
          </div>

          <div className="button-row">
            <button
              type="button"
              className="btn btn-secondary"
              id="register-reset-btn"
              data-testid="register-reset-btn"
              disabled={loading}
              onClick={handleReset}
            >
              Reset
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              id="register-submit-btn"
              data-testid="register-submit-btn"
              disabled={!isValid || loading}
              aria-busy={loading}
            >
              {loading && (
                <span className="spinner" id="register-submit-spinner" data-testid="register-submit-spinner" aria-hidden="true" />
              )}
              {loading ? 'Memproses…' : 'Daftar'}
            </button>
          </div>
        </form>

        <p className="auth-footer">
          Sudah punya akun?{' '}
          <Link to="/login" id="register-login-link" data-testid="register-login-link">
            Masuk
          </Link>
        </p>
    </AuthLayout>
  )
}
