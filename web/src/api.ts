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
  headers?: Record<string, string>
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
  Object.assign(headers, options.headers ?? {})

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
  ratingAverage?: number | null
  ratingCount?: number
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
  categories?: string[]
  minPrice?: number | null
  maxPrice?: number | null
  sort: string
  order: string
  page: number
  limit: number
}

export function fetchStoreProducts(token: string, query: StoreQuery) {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  const categories = query.categories && query.categories.length > 0 ? query.categories.join(',') : query.category
  if (categories) params.set('category', categories)
  if (query.minPrice !== undefined && query.minPrice !== null) params.set('minPrice', String(query.minPrice))
  if (query.maxPrice !== undefined && query.maxPrice !== null) params.set('maxPrice', String(query.maxPrice))
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
  giftCardDiscount: number
  total: number
  voucherCode: string | null
  giftCardCode: string | null
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
  giftCardCode: string
  shipDate: string
  paymentRef: string
}

export type OrderItem = { productId: number | null; sku: string; name: string; price: number; quantity: number; subtotal: number }

export type OrderStatus = 'diproses' | 'dikirim' | 'selesai' | 'dibatalkan'
export type OrderHistory = { status: OrderStatus; actor: string; note: string; createdAt: string }

export type Order = Omit<CheckoutInput, 'voucherCode' | 'giftCardCode' | 'paymentRef'> & {
  orderNumber: string
  status: OrderStatus
  buyer?: string
  voucherCode: string
  giftCardCode: string | null
  giftCardDiscount: number
  paymentRef: string | null
  courier: string | null
  trackingNumber: string | null
  cancelReason: string | null
  cancelNote: string | null
  paymentProof: { name: string; type: string; size: number; uploadedAt: string } | null
  shippingCost: number
  subtotal: number
  discount: number
  total: number
  createdAt: string
  updatedAt?: string
  itemCount?: number
  items?: OrderItem[]
  history?: OrderHistory[]
}

export async function previewCheckout(token: string, shippingMethod: string, voucherCode: string, giftCardCode = '') {
  const result = await request<{ data: Summary }>('/checkout/preview', {
    method: 'POST',
    body: { shippingMethod, voucherCode, giftCardCode },
    token,
  })
  return result.data
}

export async function createOrder(token: string, input: CheckoutInput) {
  const result = await request<{ data: Order }>('/orders', { method: 'POST', body: input, token })
  return result.data
}

export async function fetchOrders(token: string, range: { from?: string; to?: string } = {}) {
  const params = new URLSearchParams()
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
  const query = params.toString()
  const result = await request<{ data: Order[] }>(`/orders${query ? `?${query}` : ''}`, { token })
  return result.data
}

export async function fetchOrder(token: string, orderNumber: string) {
  const result = await request<{ data: Order }>(`/orders/${encodeURIComponent(orderNumber)}`, { token })
  return result.data
}

// ---------- Kelola User (admin) ----------

export type AdminUser = {
  id: number
  username: string
  fullName: string
  email: string
  phone: string | null
  birthDate: string | null
  gender: string | null
  role: 'user' | 'admin'
  isDemo: boolean
  createdAt: string
  expiresAt: string | null
}

export type UserQuery = {
  search: string
  role: string
  type: string
  sort: string
  order: string
  page: number
  limit: number
}

export type UserProfileInput = Partial<Pick<AdminUser, 'fullName' | 'username' | 'email' | 'phone' | 'birthDate' | 'gender'>>

export function fetchUsers(token: string, query: UserQuery) {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.role) params.set('role', query.role)
  if (query.type) params.set('type', query.type)
  params.set('sort', query.sort)
  params.set('order', query.order)
  params.set('page', String(query.page))
  params.set('limit', String(query.limit))
  return request<{ data: AdminUser[]; meta: ProductListResult['meta'] }>(`/users?${params.toString()}`, { token })
}

export async function fetchUser(token: string, id: number) {
  const result = await request<{ data: AdminUser }>(`/users/${id}`, { token })
  return result.data
}

export async function updateUser(token: string, id: number, input: UserProfileInput) {
  const result = await request<{ data: AdminUser }>(`/users/${id}`, { method: 'PATCH', body: input, token })
  return result.data
}

export async function changeUserPassword(token: string, id: number, newPassword: string, confirmPassword: string) {
  await request<{ data: { message: string } }>(`/users/${id}/password`, {
    method: 'PUT',
    body: { newPassword, confirmPassword },
    token,
  })
}

export async function deleteUser(token: string, id: number) {
  await request<null>(`/users/${id}`, { method: 'DELETE', token })
}

export async function bulkDeleteUsers(token: string, ids: number[]) {
  const result = await request<{ data: { deleted: number } }>('/users/bulk-delete', { method: 'POST', body: { ids }, token })
  return result.data.deleted
}

// ---------- Status pesanan, bukti transfer, lacak paket ----------

export type CancelInput = { reason: string; note: string }

export async function cancelOrder(token: string, orderNumber: string, input: CancelInput) {
  const result = await request<{ data: Order }>(`/orders/${encodeURIComponent(orderNumber)}/cancel`, { method: 'POST', body: input, token })
  return result.data
}

export async function uploadPaymentProof(token: string, orderNumber: string, file: File) {
  const result = await request<{ data: Order }>(`/orders/${encodeURIComponent(orderNumber)}/payment-proof`, {
    method: 'PUT',
    file,
    token,
    headers: { 'X-File-Name': encodeURIComponent(file.name) },
  })
  return result.data
}

export async function deletePaymentProof(token: string, orderNumber: string) {
  await request<null>(`/orders/${encodeURIComponent(orderNumber)}/payment-proof`, { method: 'DELETE', token })
}

// Gambar yang butuh token tidak bisa langsung dipakai di <img src>: ambil sebagai blob lalu buat URL lokal
export async function fetchImageUrl(token: string, path: string) {
  const response = await fetch(`/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new ApiError(response.status, 'NOT_FOUND', 'Gambar tidak ditemukan')
  return URL.createObjectURL(await response.blob())
}

export type TrackingEvent = { time: string; location: string; description: string }
export type Tracking = { orderNumber: string; courier: string; trackingNumber: string; status: OrderStatus; events: TrackingEvent[] }

export async function fetchTracking(token: string, orderNumber: string) {
  const result = await request<{ data: Tracking }>(`/orders/${encodeURIComponent(orderNumber)}/tracking`, { token })
  return result.data
}

export async function payWarungPay(token: string, phone: string, pin: string, amount: number) {
  const result = await request<{ data: { paymentRef: string; amount: number; paidAt: string } }>('/payments/warungpay', {
    method: 'POST',
    body: { phone, pin, amount },
    token,
  })
  return result.data
}

// ---------- Pesanan toko (admin) ----------

export type StoreOrderQuery = { status: string; search: string; sort: string; order: string; page: number; limit: number }
export type StoreOrderCounts = { all: number; diproses: number; dikirim: number; selesai: number; dibatalkan: number }

export function fetchStoreOrders(token: string, query: StoreOrderQuery) {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.search) params.set('search', query.search)
  params.set('sort', query.sort)
  params.set('order', query.order)
  params.set('page', String(query.page))
  params.set('limit', String(query.limit))
  return request<{ data: Order[]; meta: ProductListResult['meta'] & { counts: StoreOrderCounts } }>(`/admin/orders?${params.toString()}`, { token })
}

export async function fetchStoreOrder(token: string, orderNumber: string) {
  const result = await request<{ data: Order }>(`/admin/orders/${encodeURIComponent(orderNumber)}`, { token })
  return result.data
}

export type StatusChange =
  | { status: 'dikirim'; courier: string; trackingNumber: string }
  | { status: 'selesai' }
  | { status: 'dibatalkan'; reason: string; note: string }

export async function changeOrderStatus(token: string, orderNumber: string, change: StatusChange) {
  const result = await request<{ data: Order }>(`/admin/orders/${encodeURIComponent(orderNumber)}/status`, {
    method: 'PATCH',
    body: change,
    token,
  })
  return result.data
}

// ---------- Produk unggulan & riwayat stok (admin) ----------

export async function fetchFeatured(token: string) {
  const result = await request<{ data: Product[] }>('/products/featured', { token })
  return result.data
}

export async function saveFeatured(token: string, ids: number[]) {
  const result = await request<{ data: Product[] }>('/products/featured', { method: 'PUT', body: { ids }, token })
  return result.data
}

export type StockMovement = {
  id: number
  productId: number
  productName: string
  change: number
  reason: 'order' | 'cancel' | 'admin' | 'restock' | 'offline'
  ref: string
  stockAfter: number
  createdAt: string
}

export function fetchStockMovements(token: string, query: { cursor: string | null; productId: string; reason: string }) {
  const params = new URLSearchParams({ limit: '50' })
  if (query.cursor) params.set('cursor', query.cursor)
  if (query.productId) params.set('productId', query.productId)
  if (query.reason) params.set('reason', query.reason)
  return request<{ data: StockMovement[]; meta: { total: number; nextCursor: string | null } }>(`/stock-movements?${params.toString()}`, { token })
}

// ---------- Ulasan produk ----------

export type ReviewStatus = 'menunggu' | 'disetujui' | 'ditolak'
export type Review = {
  id: number
  productId: number
  productName: string
  author: string
  rating: number
  body: string
  status: ReviewStatus
  rejectReason: string | null
  helpfulCount: number
  helpfulByMe: boolean
  mine?: boolean
  photos: { id: number; url: string }[]
  createdAt: string
  updatedAt: string
}
export type ReviewInput = { rating: number; body: string }
export type ReviewListMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
  count: number
  average: number | null
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>
  mine: Review | null
  canReview: boolean
}

// URL foto ulasan dari API sudah diawali /api/v1; fetchImageUrl butuh path setelahnya
export const reviewPhotoPath = (url: string) => url.replace(/^\/api\/v1/, '')

export function fetchProductReviews(token: string, productId: number, query: { rating: string; sort: string; page: number; limit: number }) {
  const params = new URLSearchParams({ sort: query.sort, page: String(query.page), limit: String(query.limit) })
  if (query.rating) params.set('rating', query.rating)
  return request<{ data: Review[]; meta: ReviewListMeta }>(`/store/products/${productId}/reviews?${params.toString()}`, { token })
}

export async function fetchMyReviews(token: string) {
  const result = await request<{ data: Review[] }>('/reviews/mine', { token })
  return result.data
}

export async function createReview(token: string, productId: number, input: ReviewInput) {
  const result = await request<{ data: Review }>(`/store/products/${productId}/reviews`, { method: 'POST', body: input, token })
  return result.data
}

export async function updateReview(token: string, id: number, input: ReviewInput) {
  const result = await request<{ data: Review }>(`/reviews/${id}`, { method: 'PATCH', body: input, token })
  return result.data
}

export async function uploadReviewPhoto(token: string, id: number, file: File) {
  const result = await request<{ data: Review }>(`/reviews/${id}/photos`, {
    method: 'POST',
    file,
    token,
    headers: { 'X-File-Name': encodeURIComponent(file.name) },
  })
  return result.data
}

export async function deleteReviewPhoto(token: string, id: number, photoId: number) {
  const result = await request<{ data: Review }>(`/reviews/${id}/photos/${photoId}`, { method: 'DELETE', token })
  return result.data
}

export async function toggleReviewHelpful(token: string, id: number) {
  const result = await request<{ data: { helpful: boolean; helpfulCount: number } }>(`/reviews/${id}/helpful`, { method: 'POST', token })
  return result.data
}

export type ReviewCounts = { all: number; menunggu: number; disetujui: number; ditolak: number }

export function fetchStoreReviews(token: string, query: { status: string; page: number; limit: number }) {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) })
  if (query.status) params.set('status', query.status)
  return request<{ data: Review[]; meta: ProductListResult['meta'] & { counts: ReviewCounts } }>(`/admin/reviews?${params.toString()}`, { token })
}

export async function moderateReview(token: string, id: number, input: { status: 'disetujui' } | { status: 'ditolak'; reason: string }) {
  const result = await request<{ data: Review }>(`/admin/reviews/${id}`, { method: 'PATCH', body: input, token })
  return result.data
}

// ---------- Notifikasi ----------

export type AppNotification = {
  id: number
  type: string
  title: string
  body: string
  link: string
  isRead: boolean
  createdAt: string
}

export function fetchNotifications(token: string, query: { unread?: boolean; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams({ page: String(query.page ?? 1), limit: String(query.limit ?? 10) })
  if (query.unread) params.set('unread', 'true')
  return request<{ data: AppNotification[]; meta: ProductListResult['meta'] & { unread: number } }>(`/notifications?${params.toString()}`, { token })
}

export async function markNotificationRead(token: string, id: number) {
  const result = await request<{ data: AppNotification }>(`/notifications/${id}/read`, { method: 'POST', token })
  return result.data
}

export async function markAllNotificationsRead(token: string) {
  const result = await request<{ data: { updated: number } }>('/notifications/read-all', { method: 'POST', token })
  return result.data
}
