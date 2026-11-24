// Aturan validasi Registrasi di browser. Teks pesan harus sama persis dengan API
// (api/src/validation/register.js) dan PRD Registrasi.

export const GENDER_OPTIONS = [
  { value: 'female', label: 'Perempuan' },
  { value: 'male', label: 'Laki-laki' },
  { value: 'unspecified', label: 'Tidak ingin menyebutkan' },
]

export const MESSAGES = {
  fullNameRequired: 'Nama lengkap wajib diisi',
  fullNameLength: 'Nama lengkap harus 3–50 karakter',
  fullNameChars: 'Nama lengkap hanya boleh berisi huruf, spasi, titik, dan apostrof',
  usernameRequired: 'Username wajib diisi',
  usernameLength: 'Username harus 3–30 karakter',
  usernameChars: 'Username hanya boleh berisi huruf, angka, dan garis bawah',
  emailRequired: 'Email wajib diisi',
  emailFormat: 'Format email tidak valid',
  phoneRequired: 'Nomor HP wajib diisi',
  phoneFormat: 'Nomor HP harus diawali 08 atau +628 dan berisi 10–14 digit',
  birthDateRequired: 'Tanggal lahir wajib diisi',
  birthDateFuture: 'Tanggal lahir tidak boleh di masa depan',
  birthDateAge: 'Umur minimal 17 tahun',
  genderRequired: 'Pilih jenis kelamin',
  passwordRequired: 'Password wajib diisi',
  passwordLength: 'Password minimal 8 karakter',
  passwordComplexity: 'Password harus mengandung huruf besar, huruf kecil, angka, dan simbol',
  confirmPasswordRequired: 'Konfirmasi password wajib diisi',
  confirmPasswordMismatch: 'Konfirmasi password tidak sama',
}

export type RegisterValues = {
  fullName: string
  username: string
  email: string
  phone: string
  birthDate: string
  gender: string
  password: string
  confirmPassword: string
}

export type RegisterField = keyof RegisterValues
export type RegisterErrors = Partial<Record<RegisterField, string>>

export const DEFAULT_VALUES: RegisterValues = {
  fullName: '',
  username: '',
  email: '',
  phone: '',
  birthDate: '',
  gender: '',
  password: '',
  confirmPassword: '',
}

// Tanggal hari ini (WIB) dalam format YYYY-MM-DD, sama seperti di API
export function todayInJakarta(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function seventeenYearsAgo(today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  return new Date(Date.UTC(y - 17, m - 1, d)).toISOString().slice(0, 10)
}

function hasAllCharacterTypes(password: string) {
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)
}

export function validateRegister(values: RegisterValues): RegisterErrors {
  const errors: RegisterErrors = {}

  const fullName = values.fullName.trim().replace(/\s+/g, ' ')
  if (!fullName) errors.fullName = MESSAGES.fullNameRequired
  else if (fullName.length < 3 || fullName.length > 50) errors.fullName = MESSAGES.fullNameLength
  else if (!/^[\p{L} .']+$/u.test(fullName)) errors.fullName = MESSAGES.fullNameChars

  const username = values.username.trim().toLowerCase()
  if (!username) errors.username = MESSAGES.usernameRequired
  else if (username.length < 3 || username.length > 30) errors.username = MESSAGES.usernameLength
  else if (!/^[a-z0-9_]+$/.test(username)) errors.username = MESSAGES.usernameChars

  const email = values.email.trim()
  if (!email) errors.email = MESSAGES.emailRequired
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = MESSAGES.emailFormat

  const phone = values.phone.trim()
  if (!phone) errors.phone = MESSAGES.phoneRequired
  else if (!/^(08\d{8,12}|\+628\d{7,11})$/.test(phone)) errors.phone = MESSAGES.phoneFormat

  if (!values.birthDate) {
    errors.birthDate = MESSAGES.birthDateRequired
  } else {
    const today = todayInJakarta()
    if (values.birthDate > today) errors.birthDate = MESSAGES.birthDateFuture
    else if (values.birthDate > seventeenYearsAgo(today)) errors.birthDate = MESSAGES.birthDateAge
  }

  if (!values.gender) errors.gender = MESSAGES.genderRequired
  if (!values.password) errors.password = MESSAGES.passwordRequired
  else if (values.password.length < 8) errors.password = MESSAGES.passwordLength
  else if (!hasAllCharacterTypes(values.password)) errors.password = MESSAGES.passwordComplexity

  if (!values.confirmPassword) errors.confirmPassword = MESSAGES.confirmPasswordRequired
  else if (values.confirmPassword !== values.password) errors.confirmPassword = MESSAGES.confirmPasswordMismatch


  return errors
}

export type PasswordStrength = 'Lemah' | 'Sedang' | 'Kuat'

// Lemah: < 2 jenis karakter; Sedang: 2–3 jenis (atau 4 jenis tapi < 8 karakter); Kuat: 4 jenis dan ≥ 8 karakter
export function passwordStrength(password: string): PasswordStrength | null {
  if (!password) return null
  const types = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length
  if (types === 4 && password.length >= 8) return 'Kuat'
  if (types >= 2) return 'Sedang'
  return 'Lemah'
}
