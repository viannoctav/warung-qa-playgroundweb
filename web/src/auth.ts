export type User = {
  id: number
  username: string
  name: string
  role: 'user' | 'admin'
}

const TOKEN_KEY = 'wqa_token'
const USER_KEY = 'wqa_user'
const TOAST_KEY = 'wqa_toast'
const PREFILL_USERNAME_KEY = 'wqa_prefill_username'

// "Ingat saya" → localStorage (bertahan setelah browser ditutup).
// Tidak dicentang → sessionStorage (hilang saat browser ditutup).
export function saveSession(token: string, user: User, remember: boolean) {
  clearSession()
  const storage = remember ? window.localStorage : window.sessionStorage
  storage.setItem(TOKEN_KEY, token)
  storage.setItem(USER_KEY, JSON.stringify(user))
}

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY) ?? window.sessionStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): User | null {
  const raw = window.localStorage.getItem(USER_KEY) ?? window.sessionStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function clearSession() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    storage.removeItem(TOKEN_KEY)
    storage.removeItem(USER_KEY)
  }
}

// Pesan toast yang dibawa ke halaman berikutnya (misalnya "Selamat datang, ...")
export function setFlashToast(message: string) {
  window.sessionStorage.setItem(TOAST_KEY, message)
}

export function peekFlashToast(): string | null {
  return window.sessionStorage.getItem(TOAST_KEY)
}

export function clearFlashToast() {
  window.sessionStorage.removeItem(TOAST_KEY)
}

// Username yang diisi otomatis di halaman login setelah registrasi berhasil
export function setPrefillUsername(username: string) {
  window.sessionStorage.setItem(PREFILL_USERNAME_KEY, username)
}

export function peekPrefillUsername(): string {
  return window.sessionStorage.getItem(PREFILL_USERNAME_KEY) ?? ''
}

export function clearPrefillUsername() {
  window.sessionStorage.removeItem(PREFILL_USERNAME_KEY)
}
