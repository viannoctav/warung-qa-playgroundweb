import type { User } from './auth'

export const NETWORK_ERROR_MESSAGE = 'Tidak dapat terhubung ke server.'
const REQUEST_TIMEOUT_MS = 15000

export class ApiError extends Error {
  status: number
  code: string
  fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

type ErrorBody = {
  error?: { code?: string; message?: string; fields?: Record<string, string> }
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  token?: string
}

// Semua request ke /api/v1. Di laptop diteruskan Vite ke localhost:3000,
// di Vercel diteruskan ke project API lewat vercel.json.
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE)
  } finally {
    window.clearTimeout(timer)
  }

  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = (data as ErrorBody | null)?.error
    // Tanpa body error dari API kita (misalnya timeout dari hosting) → anggap gagal terhubung
    if (!error?.message) throw new ApiError(response.status, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE)
    throw new ApiError(response.status, error.code ?? 'UNKNOWN_ERROR', error.message, error.fields)
  }

  return data as T
}

export type LoginResult = { token: string; expiresIn: number; user: User }

export async function login(username: string, password: string, remember: boolean) {
  const result = await request<{ data: LoginResult }>('/auth/login', {
    method: 'POST',
    body: { username, password, remember },
  })
  return result.data
}

export async function fetchMe(token: string) {
  const result = await request<{ data: User }>('/me', { token })
  return result.data
}
