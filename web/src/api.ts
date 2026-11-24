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
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
  // File mentah (misalnya gambar) dikirim apa adanya, bukan JSON
  file?: Blob
}

// Semua request ke /api/v1. Di laptop diteruskan Vite ke localhost:3000,
// di Vercel diteruskan ke project API lewat vercel.json.
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': options.file ? options.file.type || 'application/octet-stream' : 'application/json',
  }
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.file ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
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

export type RegisterPayload = {
  fullName: string
  username: string
  email: string
  phone: string
  birthDate: string
  gender: string
  password: string
  confirmPassword: string
}

export async function register(payload: RegisterPayload) {
  const result = await request<{ data: { user: User } }>('/auth/register', {
    method: 'POST',
    body: payload,
  })
  return result.data.user
}

// ---------- Produk ----------

export type Product = {
  id: number
  sku: string
  name: string
  category: string
  price: number
  stock: number
  isActive: boolean
  description: string
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export type ProductInput = {
  sku: string
  name: string
  category: string
  price: number
  stock: number
  isActive: boolean
  description: string
}

export type ProductQuery = {
  search: string
  category: string
  status: string
  sort: string
  order: string
  page: number
  limit: number
}

export type ProductListResult = {
  data: Product[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export function fetchProducts(token: string, query: ProductQuery) {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.category) params.set('category', query.category)
  if (query.status) params.set('status', query.status)
  params.set('sort', query.sort)
  params.set('order', query.order)
  params.set('page', String(query.page))
  params.set('limit', String(query.limit))
  return request<ProductListResult>(`/products?${params.toString()}`, { token })
}

export async function fetchProduct(token: string, id: number) {
  const result = await request<{ data: Product }>(`/products/${id}`, { token })
  return result.data
}

export async function createProduct(token: string, input: ProductInput) {
  const result = await request<{ data: Product }>('/products', { method: 'POST', body: input, token })
  return result.data
}

export async function updateProduct(token: string, id: number, input: ProductInput) {
  const result = await request<{ data: Product }>(`/products/${id}`, { method: 'PUT', body: input, token })
  return result.data
}

export async function deleteProduct(token: string, id: number) {
  await request<null>(`/products/${id}`, { method: 'DELETE', token })
}

export async function bulkDeleteProducts(token: string, ids: number[]) {
  const result = await request<{ data: { deleted: number } }>('/products/bulk-delete', {
    method: 'POST',
    body: { ids },
    token,
  })
  return result.data.deleted
}

export async function resetData(token: string) {
  await request<null>('/reset', { method: 'POST', token })
}

// ---------- Gambar produk (admin) ----------

export async function uploadProductImage(token: string, id: number, file: File) {
  const result = await request<{ data: Product }>(`/products/${id}/image`, { method: 'PUT', file, token })
  return result.data
}

export async function deleteProductImage(token: string, id: number) {
  await request<null>(`/products/${id}/image`, { method: 'DELETE', token })
}

// ---------- Toko ----------

export type StoreQuery = {
  search: string
  category: string
  sort: string
  order: string
  page: number
  limit: number
}

export function fetchStoreProducts(token: string, query: StoreQuery) {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.category) params.set('category', query.category)
  params.set('sort', query.sort)
  params.set('order', query.order)
  params.set('page', String(query.page))
  params.set('limit', String(query.limit))
  return request<ProductListResult>(`/store/products?${params.toString()}`, { token })
}

export async function fetchStoreProduct(token: string, id: number) {
  const result = await request<{ data: Product }>(`/store/products/${id}`, { token })
  return result.data
}

// ---------- Keranjang ----------

export type CartItem = { product: Product; quantity: number; subtotal: number; problem: string | null }
export type Cart = { items: CartItem[]; itemCount: number; subtotal: number; hasProblem: boolean }

export async function fetchCart(token: string) {
  const result = await request<{ data: Cart }>('/cart', { token })
  return result.data
}

export async function addToCart(token: string, productId: number, quantity: number) {
  const result = await request<{ data: Cart }>('/cart/items', { method: 'POST', body: { productId, quantity }, token })
  return result.data
}

export async function updateCartItem(token: string, productId: number, quantity: number) {
  const result = await request<{ data: Cart }>(`/cart/items/${productId}`, { method: 'PATCH', body: { quantity }, token })
  return result.data
}

export async function removeCartItem(token: string, productId: number) {
  const result = await request<{ data: Cart }>(`/cart/items/${productId}`, { method: 'DELETE', token })
  return result.data
}

export async function clearCart(token: string) {
  await request<null>('/cart', { method: 'DELETE', token })
}

// ---------- Checkout & pesanan ----------

export type Summary = {
  itemCount: number
  subtotal: number
  shippingCost: number
  discount: number
  total: number
  voucherCode: string | null
}

export type CheckoutInput = {
  recipientName: string
  phone: string
  address: string
  city: string
  postalCode: string
  notes: string
  shippingMethod: string
  paymentMethod: string
  voucherCode: string
}

export type OrderItem = { productId: number | null; sku: string; name: string; price: number; quantity: number; subtotal: number }

export type Order = Omit<CheckoutInput, 'voucherCode'> & {
  orderNumber: string
  status: string
  voucherCode: string
  shippingCost: number
  subtotal: number
  discount: number
  total: number
  createdAt: string
  itemCount?: number
  items?: OrderItem[]
}

export async function previewCheckout(token: string, shippingMethod: string, voucherCode: string) {
  const result = await request<{ data: Summary }>('/checkout/preview', {
    method: 'POST',
    body: { shippingMethod, voucherCode },
    token,
  })
  return result.data
}

export async function createOrder(token: string, input: CheckoutInput) {
  const result = await request<{ data: Order }>('/orders', { method: 'POST', body: input, token })
  return result.data
}

export async function fetchOrders(token: string) {
  const result = await request<{ data: Order[] }>('/orders', { token })
  return result.data
}

export async function fetchOrder(token: string, orderNumber: string) {
  const result = await request<{ data: Order }>(`/orders/${encodeURIComponent(orderNumber)}`, { token })
  return result.data
}
