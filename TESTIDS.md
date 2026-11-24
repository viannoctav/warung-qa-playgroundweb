# TESTIDS — Warung QA

Daftar `data-testid` di setiap halaman. Untuk elemen interaktif, `id` sama dengan `data-testid`.

Konvensi: `{halaman}-{nama}-{jenis}`, huruf kecil, dipisah tanda hubung. Elemen yang berulang memakai id data, bukan index (contoh `login-demo-account-locked_user`).

## Login (`/login`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer halaman | `login-page` | |
| Judul | `login-title` | "Masuk ke Warung QA" |
| Input username | `login-username-input` | `name=username`, fokus otomatis |
| Error username | `login-username-error` | Hanya ada saat error |
| Input password | `login-password-input` | `name=password` |
| Error password | `login-password-error` | Hanya ada saat error |
| Tombol tampil/sembunyi password | `login-password-toggle-btn` | `aria-label` berganti |
| Checkbox "Ingat saya" | `login-remember-checkbox` | `name=remember` |
| Tombol Masuk | `login-submit-btn` | Disabled sampai username & password terisi |
| Spinner loading | `login-submit-spinner` | Hanya ada saat loading |
| Alert error dari server | `login-error-alert` | |
| Link daftar | `login-register-link` | Ke `/register` |
| Panel akun demo | `login-demo-panel` | |
| Baris akun demo | `login-demo-account-{username}` | Contoh `login-demo-account-slow_user` |
| Tombol isi akun demo | `login-demo-fill-btn-{username}` | Klik: username & password terisi otomatis |

## Registrasi (`/register`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer halaman | `register-page` | |
| Judul | `register-title` | "Buat Akun Warung QA" |
| Catatan 24 jam | `register-info-note` | |
| Alert error dari server | `register-error-alert` | |
| Nama lengkap | `register-fullname-input` | `name=fullName` |
| Username | `register-username-input` | `name=username` |
| Email | `register-email-input` | `name=email` |
| Nomor HP | `register-phone-input` | `name=phone` |
| Tanggal lahir | `register-birthdate-input` | `name=birthDate` |
| Jenis kelamin | `register-gender-radio-{female\|male\|unspecified}` | `name=gender` |
| Password | `register-password-input` | |
| Tombol tampil/sembunyi password | `register-password-toggle-btn` | |
| Kekuatan password | `register-password-strength` | "Lemah" / "Sedang" / "Kuat" |
| Konfirmasi password | `register-confirm-password-input` | `name=confirmPassword` |
| Tombol Reset | `register-reset-btn` | |
| Tombol Daftar | `register-submit-btn` | Disabled sampai form valid |
| Spinner loading | `register-submit-spinner` | |
| Link ke login | `register-login-link` | |

Pesan error per field: `register-{field}-error`, dengan `{field}` = `fullname`, `username`, `email`, `phone`, `birthdate`, `gender`, `password`, `confirm-password`.

## Header (setelah login)

| Elemen | `data-testid` |
| --- | --- |
| Nama pengguna | `header-username` |
| Badge admin | `header-admin-badge` |
| Tombol Reset Data | `header-reset-btn` |
| Tombol Keluar | `header-logout-btn` |

## Produk (`/products`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul | `products-page`, `products-title` | |
| Total produk | `products-total` | Contoh "24 produk" |
| Tombol tambah | `products-add-btn` | Halaman ini khusus admin; role user diarahkan ke `/shop` |
| Pencarian | `products-search-input` | Dikirim 300 ms setelah berhenti mengetik |
| Filter kategori / status | `products-category-filter`, `products-status-filter` | |
| Hapus terpilih | `products-bulk-delete-btn` | Muncul saat ada yang dipilih, teks "Hapus (n)" |
| Tabel | `products-table` | |
| Tombol sort | `products-sort-name-btn`, `products-sort-price-btn`, `products-sort-stock-btn` | Kolom aktif punya `aria-sort` |
| Pilih semua | `products-select-all-checkbox` | Bisa indeterminate |
| Baris | `products-row-{id}` | |
| Checkbox baris | `products-select-checkbox-{id}` | |
| Sel | `products-cell-{sku\|name\|category\|price\|stock\|status}-{id}` | |
| Gambar kecil | `products-cell-image-{id}` | Berisi `<img>` kalau ada gambar, kalau tidak kotak kategori |
| Edit / hapus baris | `products-edit-btn-{id}`, `products-delete-btn-{id}` | |
| Loading / kosong | `products-loading`, `products-empty`, `products-clear-filters-btn` | |
| Error memuat | `products-error-alert` | |
| Pagination | `products-page-prev-btn`, `products-page-next-btn`, `products-page-info`, `products-page-size-select` | |

## Form produk (`/products/new`, `/products/{id}/edit`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul | `product-form-page`, `product-form-title` | "Tambah produk" / "Edit produk" |
| Link kembali | `product-back-link` | |
| SKU | `product-sku-input` | Otomatis huruf besar |
| Kategori | `product-category-select` | |
| Nama | `product-name-input` | |
| Harga | `product-price-input` | Tampil berformat ribuan, contoh "75.000" |
| Stok | `product-stock-input` | |
| Status aktif | `product-active-switch` | `role="switch"` |
| Deskripsi + penghitung | `product-description-textarea`, `product-description-counter` | |
| Gambar: pilih file | `product-image-input` | `input type=file`, JPG/PNG/WEBP maks 2 MB. Di Playwright: `set_input_files` |
| Gambar: pratinjau / hapus | `product-image-preview`, `product-image-remove-btn` | Gambar diunggah saat Simpan |
| Gambar: keterangan / error | `product-image-hint`, `product-image-error` | |
| Pesan error per field | `product-{sku\|name\|category\|price\|stock\|description}-error` | |
| Alert error server | `product-error-alert` | |
| Simpan / Batal | `product-save-btn`, `product-cancel-btn` | |
| Spinner simpan | `product-save-spinner` | |
| Loading data | `product-loading` | Mode edit |
| Tidak ditemukan / tidak boleh | `product-not-found`, `product-forbidden` | `product-forbidden` untuk role user |

## Header & navigasi (setelah login)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Menu Toko / Kelola Produk / Pesanan | `nav-shop-link`, `nav-products-link`, `nav-orders-link` | `nav-products-link` hanya untuk admin. Menu aktif punya `aria-current="page"` |
| Keranjang + jumlah barang | `nav-cart-link`, `nav-cart-count` | |
| Nama akun / badge admin | `header-username`, `header-admin-badge` | |
| Reset Data / Keluar | `header-reset-btn`, `header-logout-btn` | |

## Toko (`/shop`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul / jumlah | `shop-page`, `shop-title`, `shop-total` | "22 produk tersedia" (hanya produk aktif) |
| Cari / kategori / urutkan | `shop-search-input`, `shop-category-filter`, `shop-sort-select` | Nilai sort: `name:asc`, `name:desc`, `price:asc`, `price:desc`, `createdAt:desc` |
| Grid | `shop-grid` | |
| Kartu produk | `shop-card-{id}` | |
| Link kartu (ke detail) | `shop-card-link-{id}` | |
| Gambar / nama / harga / stok | `shop-card-image-{id}`, `shop-card-name-{id}`, `shop-card-price-{id}`, `shop-card-stock-{id}` | Stok 0 → "Stok habis" |
| Tambah ke keranjang | `shop-add-btn-{id}` | Nonaktif kalau stok habis |
| Loading / kosong / error | `shop-loading`, `shop-empty`, `shop-clear-filters-btn`, `shop-error-alert` | |
| Pagination | `shop-page-prev-btn`, `shop-page-next-btn`, `shop-page-info`, `shop-page-size-select` | 12 / 24 / 48 |

## Detail produk (`/shop/{id}`)

| Elemen | `data-testid` |
| --- | --- |
| Kontainer | `shop-product-page` |
| Breadcrumb ke toko | `shop-product-breadcrumb-shop` |
| Gambar / kategori / nama / SKU | `shop-product-image`, `shop-product-category`, `shop-product-name`, `shop-product-sku` |
| Harga / stok / deskripsi | `shop-product-price`, `shop-product-stock`, `shop-product-description` |
| Jumlah (− input +) | `shop-product-quantity-decrease-btn`, `shop-product-quantity-input`, `shop-product-quantity-increase-btn` |
| Error jumlah | `shop-product-quantity-error` |
| Error dari server | `shop-product-error-alert` |
| Tambah ke keranjang / Beli sekarang | `shop-product-add-btn`, `shop-product-buy-btn` |
| Loading / tidak ditemukan | `shop-product-loading`, `shop-product-not-found`, `shop-product-back-link` |

## Keranjang (`/cart`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul / total barang | `cart-page`, `cart-title`, `cart-total-items` | |
| Daftar | `cart-items` | |
| Baris | `cart-item-{productId}` | |
| Gambar / nama / harga / subtotal | `cart-item-image-{productId}`, `cart-item-name-{productId}`, `cart-item-price-{productId}`, `cart-item-subtotal-{productId}` | |
| Jumlah | `cart-item-quantity-{productId}-decrease-btn`, `cart-item-quantity-{productId}-input`, `cart-item-quantity-{productId}-increase-btn` | Disimpan saat klik −/+, Enter, atau keluar dari input |
| Pesan per baris | `cart-item-error-{productId}` | Jumlah tidak valid, stok kurang, produk tidak dijual lagi |
| Hapus baris | `cart-item-remove-btn-{productId}` | |
| Kosongkan keranjang | `cart-clear-btn` | Pakai modal konfirmasi |
| Ringkasan | `cart-summary`, `cart-summary-count`, `cart-summary-subtotal` | |
| Catatan ada masalah | `cart-problem-note` | Tombol checkout nonaktif |
| Checkout / lanjut belanja | `cart-checkout-btn`, `cart-continue-link` | |
| Kosong / error | `cart-empty`, `cart-shop-link`, `cart-error-alert` | |

## Checkout (`/checkout`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul | `checkout-page`, `checkout-title` | |
| Langkah | `checkout-steps`, `checkout-step-1`, `checkout-step-2`, `checkout-step-3` | Langkah aktif punya `aria-current="step"` |
| Form alamat | `checkout-address-form` | |
| Field alamat | `checkout-recipient-name-input`, `checkout-phone-input`, `checkout-address-input`, `checkout-city-input`, `checkout-postal-code-input`, `checkout-notes-input` | |
| Error alamat | `checkout-{recipient-name\|phone\|address\|city\|postal-code\|notes}-error` | |
| Tombol langkah 1 | `checkout-back-cart-link`, `checkout-address-next-btn` | |
| Langkah 2 | `checkout-shipping-step` | |
| Pilihan kurir | `checkout-shipping-reguler-radio`, `checkout-shipping-express-radio`, `checkout-shipping-sameday-radio` | |
| Error / tombol langkah 2 | `checkout-shipping-error`, `checkout-shipping-back-btn`, `checkout-shipping-next-btn` | |
| Langkah 3 | `checkout-payment-step` | |
| Pilihan pembayaran | `checkout-payment-transfer-radio`, `checkout-payment-ewallet-radio`, `checkout-payment-cod-radio` | |
| Error pembayaran | `checkout-payment-error` | Termasuk batas COD |
| Voucher | `checkout-voucher-input`, `checkout-voucher-apply-btn`, `checkout-voucher-remove-btn` | |
| Pesan voucher | `checkout-voucher-error`, `checkout-voucher-success` | |
| Tombol langkah 3 | `checkout-payment-back-btn`, `checkout-place-order-btn` | |
| Ringkasan | `checkout-summary`, `checkout-summary-item-{productId}`, `checkout-summary-subtotal`, `checkout-summary-shipping`, `checkout-summary-discount`, `checkout-summary-total` | |
| Error | `checkout-error-alert`, `checkout-error-cart-link`, `checkout-problem-alert` | |
| Keranjang kosong | `checkout-empty`, `checkout-shop-link` | |

## Pesanan (`/orders`, `/orders/{nomor}`, `/checkout/success/{nomor}`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Daftar: kontainer / judul / jumlah | `orders-page`, `orders-title`, `orders-total` | |
| Tabel | `orders-table` | |
| Baris | `orders-row-{nomor}` | Nomor contoh `WQA-20261124-K7Q2ZP` |
| Sel | `orders-cell-{number\|date\|items\|total\|status}-{nomor}` | |
| Link detail | `orders-detail-link-{nomor}` | |
| Kosong / error | `orders-empty`, `orders-shop-link`, `orders-error-alert` | |
| Halaman sukses | `order-success-page`, `order-success-banner`, `order-success-title` | |
| Nomor / total di banner | `order-success-banner-number`, `order-success-banner-total` | |
| Link di banner | `order-success-detail-link`, `order-success-shop-link` | |
| Detail: kontainer / nomor / tanggal / status | `order-detail-page`, `order-detail-number`, `order-detail-date`, `order-detail-status` | |
| Breadcrumb | `order-detail-breadcrumb-orders` | |
| Isi (awalan `order-detail` atau `order-success`) | `{awalan}-items-table`, `{awalan}-item-{sku}`, `{awalan}-address`, `{awalan}-shipping-method`, `{awalan}-payment-method` | |
| Rincian bayar | `{awalan}-summary`, `{awalan}-subtotal`, `{awalan}-shipping-cost`, `{awalan}-discount`, `{awalan}-total` | |
| Tidak ditemukan | `order-not-found`, `order-back-link` | Pesanan akun lain juga "tidak ditemukan" |

## Modal konfirmasi (semua halaman)

| Elemen | `data-testid` |
| --- | --- |
| Latar belakang (klik = tutup) | `confirm-modal-backdrop` |
| Kotak modal | `confirm-modal` |
| Judul / pesan | `confirm-modal-title`, `confirm-modal-message` |
| Tombol Batal / konfirmasi | `confirm-modal-cancel-btn`, `confirm-modal-confirm-btn` |

## Global

| Elemen | `data-testid` |
| --- | --- |
| Logo Warung QA (semua halaman) | `brand-logo` |
| Toast sukses | `toast-success` |
