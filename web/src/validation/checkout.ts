// Aturan checkout — teks pesan sama persis dengan API (api/src/validation/checkout.js)

export const CHECKOUT_MESSAGES = {
  quantity: 'Jumlah harus angka bulat 1–99',
  recipientNameRequired: 'Nama penerima wajib diisi',
  recipientNameLength: 'Nama penerima harus 3–50 karakter',
  phoneRequired: 'Nomor HP wajib diisi',
  phoneFormat: 'Nomor HP harus diawali 08 atau +628 dan berisi 10–14 digit',
  addressRequired: 'Alamat wajib diisi',
  addressLength: 'Alamat harus 10–200 karakter',
  cityRequired: 'Kota wajib diisi',
  cityLength: 'Kota harus 3–40 karakter',
  postalCodeRequired: 'Kode pos wajib diisi',
  postalCodeFormat: 'Kode pos harus 5 angka',
  notesLength: 'Catatan maksimal 200 karakter',
  shippingMethod: 'Pilih metode pengiriman',
  paymentMethod: 'Pilih metode pembayaran',
  voucherRequired: 'Masukkan kode voucher',
  codLimit: 'COD hanya untuk total maksimal Rp 1.000.000',
}

export const SHIPPING_OPTIONS = [
  { value: 'reguler', label: 'Reguler', eta: '3–5 hari', cost: 10000 },
  { value: 'express', label: 'Express', eta: '1–2 hari', cost: 20000 },
  { value: 'sameday', label: 'Same Day', eta: 'Hari ini', cost: 35000 },
]

export const PAYMENT_OPTIONS = [
  { value: 'transfer', label: 'Transfer bank', hint: 'BCA, BNI, BRI, Mandiri' },
  { value: 'ewallet', label: 'E-wallet', hint: 'GoPay, OVO, DANA' },
  { value: 'cod', label: 'Bayar di tempat (COD)', hint: 'Maksimal total Rp 1.000.000' },
]

export const COD_MAX_TOTAL = 1000000

export function shippingLabel(value: string) {
  return SHIPPING_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export function paymentLabel(value: string) {
  return PAYMENT_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export type AddressValues = {
  recipientName: string
  phone: string
  address: string
  city: string
  postalCode: string
  notes: string
}

export type AddressField = keyof AddressValues

export const EMPTY_ADDRESS: AddressValues = {
  recipientName: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  notes: '',
}

function lengthError(value: string, min: number, max: number, required: string, length: string) {
  if (!value) return required
  if (value.length < min || value.length > max) return length
  return undefined
}

export function validateAddress(values: AddressValues): Partial<Record<AddressField, string>> {
  const errors: Partial<Record<AddressField, string>> = {}
  const name = values.recipientName.trim().replace(/\s+/g, ' ')
  const phone = values.phone.trim()
  const postalCode = values.postalCode.trim()

  const nameError = lengthError(name, 3, 50, CHECKOUT_MESSAGES.recipientNameRequired, CHECKOUT_MESSAGES.recipientNameLength)
  if (nameError) errors.recipientName = nameError

  if (!phone) errors.phone = CHECKOUT_MESSAGES.phoneRequired
  else if (!/^(08\d{8,12}|\+628\d{7,11})$/.test(phone)) errors.phone = CHECKOUT_MESSAGES.phoneFormat

  const addressError = lengthError(values.address.trim(), 10, 200, CHECKOUT_MESSAGES.addressRequired, CHECKOUT_MESSAGES.addressLength)
  if (addressError) errors.address = addressError

  const cityError = lengthError(values.city.trim(), 3, 40, CHECKOUT_MESSAGES.cityRequired, CHECKOUT_MESSAGES.cityLength)
  if (cityError) errors.city = cityError

  if (!postalCode) errors.postalCode = CHECKOUT_MESSAGES.postalCodeRequired
  else if (!/^\d{5}$/.test(postalCode)) errors.postalCode = CHECKOUT_MESSAGES.postalCodeFormat

  if (values.notes.trim().length > 200) errors.notes = CHECKOUT_MESSAGES.notesLength
  return errors
}
