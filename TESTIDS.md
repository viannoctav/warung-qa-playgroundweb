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

Reset Data dan Keluar ada di dalam **menu akun**. Buka dulu menunya (hover, klik, atau Enter / panah bawah), baru klik itemnya.

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Tombol menu akun | `header-account-menu-btn` | Berisi nama dan badge admin. `aria-expanded` = `true` saat terbuka |
| Nama pengguna | `header-username` | |
| Badge admin | `header-admin-badge` | |
| Daftar menu | `header-account-menu` | Hanya ada di DOM saat terbuka. Tertutup 300 ms setelah kursor keluar, atau Esc |
| Lonceng notifikasi | `header-notif-btn`, `header-notif-count` | Angka = belum dibaca (tidak ada kalau 0). Web mengecek notifikasi baru tiap 5 detik |
| Panel notifikasi | `header-notif-panel`, `header-notif-item-{id}`, `header-notif-read-all-btn`, `header-notif-all-link`, `header-notif-empty` | Item punya `data-type` dan `data-read`. Klik item = tandai dibaca + buka halaman terkait |
| Pop-up notifikasi baru | `notif-popups`, `notif-popup-{id}`, `notif-popup-open-btn-{id}`, `notif-popup-close-btn-{id}` | Muncul di pojok kanan bawah, hilang sendiri setelah 6 detik. Latihan *wait* |
| Item: Pesanan Saya / Reset Data / Keluar | `header-menu-orders-btn`, `header-reset-btn`, `header-logout-btn` | Panah atas/bawah pindah item, Home/End ke ujung |

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
| Menu Toko / Kelola Produk / Kelola User / Pesanan Toko / Pesanan Saya | `nav-shop-link`, `nav-products-link`, `nav-users-link`, `nav-store-orders-link`, `nav-orders-link` | Kelola Produk, Kelola User, Pesanan Toko hanya untuk admin. Menu aktif punya `aria-current="page"` |
| Keranjang + jumlah barang | `nav-cart-link`, `nav-cart-count` | |
| Menu akun | lihat bagian Header di atas | |

## Toko (`/shop`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul / jumlah | `shop-page`, `shop-title`, `shop-total` | "22 produk tersedia" (hanya produk aktif) |
| Cari / urutkan | `shop-search-input`, `shop-sort-select` | Default `featured:asc` ("Pilihan admin": urutan Produk unggulan dulu). Lainnya: `name:asc`, `name:desc`, `price:asc`, `price:desc`, `createdAt:desc` |
| Kategori (multi-select, bisa diketik) | `shop-category-input`, `shop-category-listbox`, `shop-category-option-{kategori}`, `shop-category-no-option` | Kategori: `kopi`, `teh`, `makanan-ringan`, `bumbu-dapur`, `minuman-kemasan` |
| Chip kategori terpilih | `shop-category-chip-{kategori}`, `shop-category-chip-remove-{kategori}` | |
| Rentang harga (slider 2 ujung) | `shop-price-min-slider`, `shop-price-max-slider` | 0–100.000, langkah 1.000 |
| Rentang harga (ketik) | `shop-price-min-input`, `shop-price-max-input`, `shop-price-label`, `shop-price-error` | Diterapkan saat Enter / keluar dari input |
| Reset semua filter | `shop-reset-filters-btn` | |
| Flash sale | `flash-sale-banner`, `flash-sale-loading`, `flash-sale-claim-btn`, `flash-sale-expired`, `flash-sale-retry-btn`, `flash-sale-code`, `flash-sale-copy-btn` | Latihan *wait*: tombol Klaim muncul acak 3–8 detik, hilang lagi setelah 15 detik. Kode: `FLASH15` |
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
| Kosongkan keranjang | `cart-clear-btn` | Pakai **dialog bawaan browser** `confirm`: "Kosongkan keranjang? N produk akan dihapus." |
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
| Tanggal kirim (ketik) | `checkout-ship-date-input`, `checkout-ship-date-hint`, `checkout-ship-date-error` | Format `YYYY-MM-DD`. Hari kerja saja, besok s.d. 14 hari lagi (WIB) |
| Tanggal kirim (kalender) | `checkout-ship-date-toggle-btn`, `checkout-ship-date-calendar`, `checkout-ship-date-prev-btn`, `checkout-ship-date-next-btn`, `checkout-ship-date-month`, `checkout-ship-date-day-{YYYY-MM-DD}` | Tanggal yang tidak boleh dipilih = `disabled`. Panah kiri/kanan/atas/bawah di dalam kalender |
| Error / tombol langkah 2 | `checkout-shipping-error`, `checkout-shipping-back-btn`, `checkout-shipping-next-btn` | |
| Langkah 3 | `checkout-payment-step` | |
| Pilihan pembayaran | `checkout-payment-transfer-radio`, `checkout-payment-ewallet-radio`, `checkout-payment-cod-radio` | |
| Error pembayaran | `checkout-payment-error` | Termasuk batas COD dan "Selesaikan pembayaran WarungPay dulu" |
| E-wallet (iframe) | `checkout-warungpay`, `checkout-warungpay-iframe`, `checkout-warungpay-paid`, `checkout-warungpay-stale` | Isi form ada **di dalam iframe**, lihat bagian WarungPay |
| Gift card (shadow DOM) | host `checkout-gift-card`; di dalam shadow root: `checkout-gift-card-input`, `checkout-gift-card-apply-btn`, `checkout-gift-card-message` | Kode: `GIFT-7788-WQA` (Rp 20.000), `GIFT-5000-WQA` (Rp 50.000) |
| Voucher | `checkout-voucher-input`, `checkout-voucher-apply-btn`, `checkout-voucher-remove-btn` | |
| Pesan voucher | `checkout-voucher-error`, `checkout-voucher-success` | |
| Tombol langkah 3 | `checkout-payment-back-btn`, `checkout-place-order-btn` | |
| Ringkasan | `checkout-summary`, `checkout-summary-item-{productId}`, `checkout-summary-subtotal`, `checkout-summary-shipping`, `checkout-summary-discount`, `checkout-summary-gift-card`, `checkout-summary-ship-date`, `checkout-summary-total` | |
| Error | `checkout-error-alert`, `checkout-error-cart-link`, `checkout-problem-alert` | |
| Keranjang kosong | `checkout-empty`, `checkout-shop-link` | |

## Pesanan (`/orders`, `/orders/{nomor}`, `/checkout/success/{nomor}`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Daftar: kontainer / judul / jumlah | `orders-page`, `orders-title`, `orders-total` | |
| Tabel | `orders-table` | |
| Baris | `orders-row-{nomor}` | Nomor contoh `WQA-20261124-K7Q2ZP` |
| Filter tanggal cepat | `orders-preset-all-btn`, `orders-preset-today-btn`, `orders-preset-7-btn`, `orders-preset-30-btn` | Tombol aktif punya `aria-pressed="true"` |
| Filter tanggal | `orders-from-input`, `orders-to-input`, `orders-date-error` | `<input type="date">` |
| Sel | `orders-cell-{number\|date\|items\|total}-{nomor}`, `orders-cell-status-{nomor}` | Status punya `data-status` = `diproses` / `dikirim` / `selesai` / `dibatalkan` |
| Link detail | `orders-detail-link-{nomor}` | |
| Kosong / error | `orders-empty`, `orders-shop-link`, `orders-error-alert` | |
| Halaman sukses | `order-success-page`, `order-success-banner`, `order-success-title` | |
| Nomor / total di banner | `order-success-banner-number`, `order-success-banner-total` | |
| Link di banner | `order-success-detail-link`, `order-success-shop-link` | |
| Detail: kontainer / nomor / tanggal / status | `order-detail-page`, `order-detail-number`, `order-detail-date`, `order-detail-status` | Status punya `data-status` |
| Riwayat status | `order-detail-timeline`, `order-detail-timeline-{status}` | `data-state` = `done` / `now` / `todo` |
| Batalkan pesanan | `order-detail-cancel-btn`, `order-detail-cancel-note` | Hanya saat Diproses. Buka modal batal (lihat Modal form) |
| Bukti transfer (hanya pembayaran transfer) | `order-proof-section`, `order-proof-dropzone`, `order-proof-input`, `order-proof-uploading`, `order-proof-error` | Drag & drop atau pilih file. PNG/JPG maks 1 MB. Bisa diganti/dihapus selama Diproses |
| File bukti | `order-proof-file`, `order-proof-preview`, `order-proof-name`, `order-proof-delete-btn`, `order-proof-none` | |
| Dokumen (tab baru) | `order-detail-invoice-link`, `order-detail-tracking-link` | `target="_blank"`. Link lacak `aria-disabled="true"` sebelum Dikirim |
| Breadcrumb | `order-detail-breadcrumb-orders` | |
| Isi (awalan `order-detail`, `order-success`, atau `store-order`) | `{awalan}-items-table`, `{awalan}-item-{sku}`, `{awalan}-address`, `{awalan}-ship-date`, `{awalan}-shipping-method`, `{awalan}-tracking-number`, `{awalan}-payment-method`, `{awalan}-cancel-reason` | |
| Rincian bayar | `{awalan}-summary`, `{awalan}-subtotal`, `{awalan}-shipping-cost`, `{awalan}-discount`, `{awalan}-gift-card`, `{awalan}-total` | |
| Tidak ditemukan | `order-not-found`, `order-back-link` | Pesanan akun lain juga "tidak ditemukan" |

## Kelola User (`/admin/users`, khusus admin)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul / jumlah | `users-page`, `users-title`, `users-total` | "8 user" |
| Catatan | `users-note` | |
| Cari / role / jenis | `users-search-input`, `users-role-filter`, `users-type-filter` | role: `user`/`admin`; jenis: `registered`/`demo`. Cari dikirim 300 ms setelah berhenti mengetik |
| Hapus terpilih | `users-bulk-delete-btn` | Muncul saat ada yang dipilih, teks "Hapus (n)". Pakai dialog bawaan browser `confirm` |
| Tabel | `users-table` | |
| Tombol sort | `users-sort-username-btn`, `users-sort-fullName-btn`, `users-sort-createdAt-btn` | Kolom aktif punya `aria-sort` |
| Pilih semua | `users-select-all-checkbox` | Hanya akun registrasi; bisa indeterminate |
| Baris | `users-row-{id}` | |
| Checkbox baris | `users-select-checkbox-{id}` | Nonaktif untuk akun demo |
| Sel | `users-cell-{username\|fullname\|email\|role\|type\|created\|expires}-{id}` | Akun sendiri ditandai "(kamu)"; akun demo: "Selalu aktif" |
| Edit / Lihat | `users-edit-btn-{id}` | Teks "Lihat" untuk akun demo |
| Hapus baris | `users-delete-btn-{id}` | Nonaktif untuk akun demo. Pakai dialog bawaan browser `prompt`: ketik username. Salah ketik → `alert` "Username tidak cocok. Akun tidak dihapus." |
| Kosong / error | `users-empty`, `users-clear-filters-btn`, `users-error-alert` | |
| Pagination | `users-page-prev-btn`, `users-page-next-btn`, `users-page-info`, `users-page-size-select` | 5 / 10 / 20 / 50 |

## Edit user (`/admin/users/{id}`, khusus admin)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul / info / role | `user-edit-page`, `user-edit-title`, `user-edit-meta`, `user-edit-role` | Judul "Edit user" atau "Detail user" (demo) |
| Link kembali | `user-edit-back-link` | |
| Catatan akun demo | `user-edit-demo-note` | Form jadi hanya-baca, bagian password & hapus tidak tampil |
| Form data diri | `user-edit-form` | |
| Field | `user-edit-fullname-input`, `user-edit-username-input`, `user-edit-email-input`, `user-edit-phone-input`, `user-edit-birthdate-input` | |
| Jenis kelamin | `user-edit-gender-radio-female`, `user-edit-gender-radio-male`, `user-edit-gender-radio-unspecified` | |
| Error per field | `user-edit-{fullname\|username\|email\|phone\|birthdate\|gender}-error` | Pesan sama dengan registrasi |
| Error server | `user-edit-error-alert` | Contoh 409 email sudah terdaftar |
| Batalkan / Simpan | `user-edit-reset-btn`, `user-edit-save-btn` | Nonaktif kalau belum ada perubahan |
| Form ganti password | `user-password-form` | |
| Password baru / tampilkan / kekuatan | `user-password-new-input`, `user-password-toggle-btn`, `user-password-strength` | Lemah / Sedang / Kuat |
| Konfirmasi | `user-password-confirm-input` | |
| Error | `user-password-new-error`, `user-password-confirm-error`, `user-password-error-alert` | |
| Simpan password | `user-password-save-btn` | |
| Hapus | `user-delete-section`, `user-delete-btn` | Pakai dialog bawaan browser `prompt` (ketik username), sama seperti di daftar |
| Loading / tidak ditemukan | `user-edit-loading`, `user-not-found`, `user-not-found-back-link`, `user-edit-load-error` | |

## Kelola Produk: tab

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Tab | `products-tabs`, `products-tab-list`, `products-tab-featured`, `products-tab-stock`, `products-tab-reviews` | Tiap tab punya URL: `/products`, `/products/featured`, `/products/stock-history`, `/products/reviews`. Tab aktif punya `aria-current="page"` |

## Produk unggulan (`/products/featured`, khusus admin)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul / jumlah slot | `featured-page`, `featured-title`, `featured-count` | Maks 6 produk |
| Daftar | `featured-list` | |
| Kartu (bisa di-drag) | `featured-item-{id}` | `draggable`, `data-position` = urutan (1 = paling atas) |
| Nomor urut / gambar | `featured-rank-{id}`, `featured-image-{id}` | |
| Naik / turun / keluarkan | `featured-up-btn-{id}`, `featured-down-btn-{id}`, `featured-remove-btn-{id}` | Alternatif drag & drop |
| Tambah produk | `featured-add-select`, `featured-add-btn`, `featured-full-note` | Nonaktif kalau slot penuh |
| Belum disimpan | `featured-dirty-note` | |
| Batalkan perubahan / simpan | `featured-undo-btn`, `featured-save-btn` | Nonaktif kalau tidak ada perubahan |
| Kosong / error | `featured-empty`, `featured-error-alert` | |

## Riwayat stok (`/products/stock-history`, khusus admin)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul / jumlah | `stock-history-page`, `stock-history-title`, `stock-history-total` | "Menampilkan 50 dari 504 catatan" |
| Filter produk / jenis | `stock-history-product-filter`, `stock-history-reason-filter` | Jenis: `order` Terjual, `cancel` Pesanan dibatalkan, `admin` Diubah admin, `restock` Restok, `offline` Penjualan offline |
| Tabel / baris | `stock-history-table`, `stock-history-row-{id}` | Baris punya `data-reason` |
| Perubahan / stok akhir | `stock-history-change-{id}`, `stock-history-after-{id}` | |
| Infinite scroll | `stock-history-sentinel`, `stock-history-loading`, `stock-history-end` | Scroll sampai sentinel terlihat → 50 baris berikutnya |
| Error | `stock-history-error-alert`, `stock-history-retry-btn` | |
| Kosong | `stock-history-empty` | |

## Pesanan Toko (`/admin/orders`, khusus admin)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul / jumlah | `store-orders-page`, `store-orders-title`, `store-orders-total` | |
| Tab status + jumlah | `store-orders-tab-{all\|diproses\|dikirim\|selesai\|dibatalkan}`, `store-orders-tab-{...}-count` | `role="tab"`, aktif punya `aria-selected="true"` |
| Cari / urutkan | `store-orders-search-input`, `store-orders-sort-select` | Cari nomor pesanan atau username pembeli. Sort: `createdAt:desc`, `createdAt:asc`, `total:desc`, `total:asc` |
| Tabel / baris | `store-orders-table`, `store-orders-row-{nomor}` | |
| Sel | `store-orders-cell-{number\|buyer\|date\|total}-{nomor}`, `store-orders-cell-status-{nomor}` | Status punya `data-status` |
| Aksi baris | `store-orders-ship-btn-{nomor}`, `store-orders-cancel-btn-{nomor}`, `store-orders-complete-btn-{nomor}`, `store-orders-detail-link-{nomor}` | Kirim & Batalkan saat Diproses, Selesaikan saat Dikirim |
| Loading / kosong / error | `store-orders-loading`, `store-orders-empty`, `store-orders-error-alert` | |
| Pagination | `store-orders-page-prev-btn`, `store-orders-page-next-btn`, `store-orders-page-info`, `store-orders-page-size-select` | 5 / 10 / 20 / 50 |

## Detail pesanan toko (`/admin/orders/{nomor}`, khusus admin)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / nomor / pembeli / status | `store-order-page`, `store-order-number`, `store-order-meta`, `store-order-buyer`, `store-order-status` | |
| Breadcrumb | `store-order-breadcrumb-orders` | |
| Riwayat status | `store-order-timeline`, `store-order-timeline-{status}` | `data-state` = `done` / `now` / `todo` |
| Panel ubah status | `store-order-status-panel`, `store-order-status-hint` | |
| Tombol status | `store-order-ship-btn-{nomor}`, `store-order-cancel-btn-{nomor}`, `store-order-complete-btn-{nomor}` | Selesaikan pakai dialog bawaan browser `confirm` |
| Bukti transfer | `store-order-proof-section`, `store-order-proof-file`, `store-order-proof-preview`, `store-order-proof-name`, `store-order-proof-none` | |
| Tidak ditemukan / error | `store-order-not-found`, `store-order-back-link`, `store-order-error-alert` | |

## Modal form (Kirim & Batalkan pesanan)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Modal Kirim | `ship-order-modal`, `ship-order-modal-title`, `ship-order-modal-error`, `ship-order-modal-backdrop` | |
| Kurir / resi | `ship-order-courier-select`, `ship-order-courier-error`, `ship-order-tracking-input`, `ship-order-tracking-error` | Resi: 10–20 huruf kapital atau angka |
| Tombol | `ship-order-modal-cancel-btn`, `ship-order-modal-submit-btn` | |
| Modal Batal | `cancel-order-modal`, `cancel-order-modal-title`, `cancel-order-modal-error`, `cancel-order-modal-backdrop` | Dipakai admin dan pembeli |
| Alasan / catatan | `cancel-order-reason-select`, `cancel-order-reason-error`, `cancel-order-note-input`, `cancel-order-note-counter`, `cancel-order-note-error` | Alasan: `stok-habis`, `permintaan-pembeli`, `alamat-tidak-valid`, `lainnya` (catatan wajib). Catatan maks 200 karakter |
| Tombol | `cancel-order-modal-cancel-btn`, `cancel-order-modal-submit-btn` | |

## Invoice & lacak paket (tab baru, tanpa header)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Invoice | `invoice-page`, `invoice-title`, `invoice-number`, `invoice-date`, `invoice-print-btn` | `/orders/{nomor}/invoice` |
| Isi invoice | `invoice-recipient`, `invoice-payment`, `invoice-status`, `invoice-items-table`, `invoice-item-{sku}` | |
| Total invoice | `invoice-subtotal`, `invoice-shipping-cost`, `invoice-discount`, `invoice-gift-card`, `invoice-total` | |
| Lacak paket | `tracking-page`, `tracking-title`, `tracking-order-number`, `tracking-status`, `tracking-courier`, `tracking-number` | `/orders/{nomor}/tracking` |
| Event | `tracking-events`, `tracking-event-{n}` | `n = 0` = paling baru |
| Belum dikirim | `tracking-not-shipped` | |
| Tanpa sesi / error | `invoice-login-required`, `tracking-login-required`, `invoice-error`, `tracking-error` | |

## WarungPay (`/warungpay`, di dalam iframe Checkout)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Halaman / nominal | `warungpay-page`, `warungpay-amount` | Pindah ke iframe dulu (`frameLocator` / `switchTo().frame`) |
| Form | `warungpay-form`, `warungpay-phone-input`, `warungpay-pin-input`, `warungpay-pay-btn` | PIN latihan `123456`, saldo Rp 2.000.000 |
| Error | `warungpay-phone-error`, `warungpay-pin-error`, `warungpay-error` | PIN salah tampil di `warungpay-pin-error` |
| Berhasil | `warungpay-success`, `warungpay-ref` | Iframe mengirim `postMessage` ke halaman Checkout |

## Ulasan di detail produk (`/shop/{id}`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Rating singkat dekat harga | `shop-product-rating` | Hanya kalau sudah ada ulasan disetujui |
| Rating di kartu Toko | `shop-card-rating-{id}` | Contoh "★ 4,5 (2)" |
| Bagian ulasan | `reviews-section`, `reviews-write-btn` | Tombol Tulis ulasan hanya untuk pembeli dengan pesanan Selesai yang belum mengulas |
| Ringkasan | `reviews-summary`, `reviews-average`, `reviews-average-stars`, `reviews-count` | Bintang punya `data-rating` |
| Sebaran bintang (bisa diklik sebagai filter) | `reviews-dist-{1..5}`, `reviews-dist-count-{1..5}` | `aria-pressed="true"` saat aktif |
| Ulasan kamu | `reviews-mine`, `reviews-mine-status`, `reviews-mine-stars`, `reviews-mine-body`, `reviews-mine-reason`, `reviews-mine-edit-btn` | Status punya `data-status` = `menunggu` / `disetujui` / `ditolak`. Ubah tidak ada kalau sudah disetujui |
| Filter / urutkan | `reviews-rating-filter`, `reviews-sort-select` | Sort: `newest`, `highest`, `lowest` |
| Daftar | `reviews-list`, `review-item-{id}`, `review-stars-{id}`, `review-author-{id}`, `review-body-{id}`, `review-photo-img-{id}-{fotoId}` | Item punya `data-rating` |
| Membantu | `review-helpful-btn-{id}`, `review-helpful-count-{id}` | Tidak ada di ulasan sendiri. `aria-pressed` = sudah ditandai |
| Kosong / error / halaman | `reviews-empty`, `reviews-error-alert`, `reviews-page-prev-btn`, `reviews-page-next-btn`, `reviews-page-info` | 5 ulasan per halaman |

## Modal tulis / ubah ulasan

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Modal | `review-modal`, `review-modal-title`, `review-modal-error`, `review-modal-cancel-btn`, `review-modal-submit-btn` | |
| Rating | `review-rating-star-{1..5}`, `review-rating-label`, `review-rating-error` | Radio tersembunyi: pakai `check(force=True)` atau klik bintangnya. Panah kiri/kanan juga bisa |
| Isi ulasan | `review-body-input`, `review-body-counter`, `review-body-error` | 10–500 karakter |
| Foto | `review-photo-dropzone`, `review-photo-input`, `review-photo-error`, `review-photo-list` | Drag & drop atau pilih, PNG/JPG maks 1 MB, maks 3 foto |
| Foto tersimpan / baru | `review-photo-{fotoId}`, `review-photo-remove-btn-{fotoId}`, `review-photo-new-{n}`, `review-photo-new-remove-btn-{n}` | |
| Di detail pesanan Selesai | `order-review-btn-{productId}`, `order-review-status-{productId}`, `order-review-edit-btn-{productId}` | Kolom Ulasan di tabel produk |

## Ulasan produk untuk admin (`/products/reviews`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul / jumlah | `admin-reviews-page`, `admin-reviews-title`, `admin-reviews-total` | |
| Tab status + jumlah | `admin-reviews-tab-{menunggu\|disetujui\|ditolak\|all}`, `admin-reviews-tab-{...}-count` | Default: Menunggu |
| Kartu ulasan | `admin-review-{id}`, `admin-review-product-{id}`, `admin-review-status-{id}`, `admin-review-stars-{id}`, `admin-review-author-{id}`, `admin-review-body-{id}`, `admin-review-photo-{id}-{fotoId}`, `admin-review-reason-{id}` | Kartu punya `data-status` |
| Setujui / Tolak | `admin-review-approve-btn-{id}`, `admin-review-reject-btn-{id}` | Hanya untuk yang Menunggu |
| Modal tolak | `reject-review-modal`, `reject-review-reason-input`, `reject-review-reason-counter`, `reject-review-reason-error`, `reject-review-modal-submit-btn`, `reject-review-modal-cancel-btn` | Alasan 5–200 karakter, dikirim ke pembeli lewat notifikasi |
| Kosong / error / halaman | `admin-reviews-empty`, `admin-reviews-error-alert`, `admin-reviews-page-prev-btn`, `admin-reviews-page-next-btn`, `admin-reviews-page-info` | |

## Notifikasi (`/notifications`)

| Elemen | `data-testid` | Catatan |
| --- | --- | --- |
| Kontainer / judul / belum dibaca | `notifications-page`, `notifications-title`, `notifications-unread` | |
| Filter | `notifications-filter-all`, `notifications-filter-unread` | `aria-pressed="true"` saat aktif |
| Tandai semua dibaca | `notifications-read-all-btn` | |
| Item | `notifications-item-{id}`, `notifications-open-btn-{id}`, `notifications-read-btn-{id}` | Item punya `data-type`: `order_new`, `order_shipped`, `order_done`, `order_cancelled`, `stock_low`, `review_new`, `review_approved`, `review_rejected` |
| Kosong / error / halaman | `notifications-empty`, `notifications-error-alert`, `notifications-page-prev-btn`, `notifications-page-next-btn`, `notifications-page-info` | 20 per halaman |

## Dialog bawaan browser

| Di mana | Jenis | Teks |
| --- | --- | --- |
| Keranjang, Kosongkan | `confirm` | "Kosongkan keranjang? N produk akan dihapus." |
| Kelola User, hapus satu (daftar & halaman edit) | `prompt`, lalu `alert` kalau salah | "Ketik username X untuk menghapus akun ini." |
| Kelola User, hapus terpilih | `confirm` | "Hapus N user? ..." |
| Pesanan Toko, Selesaikan | `confirm` | "Tandai {nomor} sebagai Selesai? ..." |

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
