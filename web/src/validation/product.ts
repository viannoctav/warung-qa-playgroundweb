// Aturan validasi Produk di browser. Teks pesan harus sama persis dengan API
// (api/src/validation/product.js) dan PRD Produk.

export const CATEGORY_OPTIONS = [
  { value: 'kopi', label: 'Kopi' },
  { value: 'teh', label: 'Teh' },
  { value: 'makanan-ringan', label: 'Makanan Ringan' },
  { value: 'bumbu-dapur', label: 'Bumbu Dapur' },
  { value: 'minuman-kemasan', label: 'Minuman Kemasan' },
]

export function categoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export const PRODUCT_MESSAGES = {
  skuRequired: 'SKU wajib diisi',
  skuFormat: 'SKU harus berformat 3 huruf, tanda hubung, 4 angka (contoh KOP-0001)',
  nameRequired: 'Nama produk wajib diisi',
  nameLength: 'Nama produk harus 3–80 karakter',
  categoryRequired: 'Pilih kategori',
  priceRequired: 'Harga wajib diisi',
  priceRange: 'Harga harus 1.000–10.000.000',
  stockRequired: 'Stok wajib diisi',
  stockInteger: 'Stok harus berupa angka bulat',
  stockRange: 'Stok harus 0–9.999',
  descriptionLength: 'Deskripsi maksimal 500 karakter',
}

// Nilai form selalu teks supaya bisa menampilkan apa yang diketik pengguna
export type ProductFormValues = {
  sku: string
  name: string
  category: string
  price: string // hanya angka, tanpa titik ribuan
  stock: string
  isActive: boolean
  description: string
}

export type ProductField = 'sku' | 'name' | 'category' | 'price' | 'stock' | 'description'
export type ProductErrors = Partial<Record<ProductField, string>>

export const EMPTY_PRODUCT: ProductFormValues = {
  sku: '',
  name: '',
  category: '',
  price: '',
  stock: '',
  isActive: true,
  description: '',
}

export function validateProduct(values: ProductFormValues): ProductErrors {
  const errors: ProductErrors = {}

  const sku = values.sku.trim().toUpperCase()
  if (!sku) errors.sku = PRODUCT_MESSAGES.skuRequired
  else if (!/^[A-Z]{3}-\d{4}$/.test(sku)) errors.sku = PRODUCT_MESSAGES.skuFormat

  const name = values.name.trim().replace(/\s+/g, ' ')
  if (!name) errors.name = PRODUCT_MESSAGES.nameRequired
  else if (name.length < 3 || name.length > 80) errors.name = PRODUCT_MESSAGES.nameLength

  if (!values.category) errors.category = PRODUCT_MESSAGES.categoryRequired

  if (values.price === '') errors.price = PRODUCT_MESSAGES.priceRequired
  else {
    const price = Number(values.price)
    if (price < 1000 || price > 10000000) errors.price = PRODUCT_MESSAGES.priceRange
  }

  const stockText = values.stock.trim()
  if (stockText === '') errors.stock = PRODUCT_MESSAGES.stockRequired
  else if (!/^-?\d+$/.test(stockText)) errors.stock = PRODUCT_MESSAGES.stockInteger
  else {
    const stock = Number(stockText)
    if (stock < 0 || stock > 9999) errors.stock = PRODUCT_MESSAGES.stockRange
  }

  if (values.description.length > 500) errors.description = PRODUCT_MESSAGES.descriptionLength

  return errors
}

// Hanya menyimpan angka dari input harga (titik ribuan dan huruf dibuang)
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9)
}

export function formatThousands(digits: string): string {
  return digits === '' ? '' : new Intl.NumberFormat('id-ID').format(Number(digits))
}

export function formatRupiah(value: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value)}`
}
