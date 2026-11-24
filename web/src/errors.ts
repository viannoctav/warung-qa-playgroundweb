import { ApiError, NETWORK_ERROR_MESSAGE } from './api'
import { clearSession } from './auth'
import { navigate } from './router'

// Sesi habis (401) → keluar dan kembali ke login. Mengembalikan true kalau sudah ditangani.
export function handleUnauthorized(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 401) {
    clearSession()
    navigate('/login', true)
    return true
  }
  return false
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE
}
