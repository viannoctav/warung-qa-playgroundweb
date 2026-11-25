# Warung QA

Playground latihan QA untuk **manual testing, automation, dan API testing** dalam satu web bertema toko mini.

| | Link |
| --- | --- |
| Web | https://warung-qa-playgroundweb-pearl.vercel.app |
| API | https://warung-qa-playgroundweb.vercel.app (cek: `/health`) |

## Akun demo

Password semua akun: `Warung123!`

| Username | Perilaku |
| --- | --- |
| `standard_user` | Pembeli: belanja di toko milik `admin_user` |
| `admin_user` | Admin: kelola produk + gambar, kelola user, dan bisa belanja di tokonya sendiri |
| `locked_user` | Akun terkunci (423) |
| `slow_user` | Login berhasil setelah 5 detik |
| `error_user` | Server error (500) |

Akun hasil registrasi selalu ber-role **user** (pembeli di toko `admin_user`) dan aktif 24 jam. Admin hanya `admin_user`.

## Alur toko

1. **Toko** (`/shop`): cari, filter kategori (multi-select), rentang harga (slider), urutkan, tambah ke keranjang. Banner flash sale: tombol Klaim muncul acak 3–8 detik.
2. **Detail produk** (`/shop/{id}`): pilih jumlah, *Tambah ke keranjang* atau *Beli sekarang*.
3. **Keranjang** (`/cart`): ubah jumlah, hapus, kosongkan (dialog `confirm` bawaan browser).
4. **Checkout** (`/checkout`): Alamat, lalu Pengiriman + tanggal kirim (kalender, hari kerja saja), lalu Pembayaran + voucher + gift card (shadow DOM). E-wallet dibayar di iframe WarungPay.
5. **Pesanan Saya** (`/orders`): riwayat dengan filter tanggal, detail dengan riwayat status, batalkan (selama Diproses), unggah bukti transfer (drag & drop), invoice dan lacak paket di tab baru.

Status pesanan:

| Dari | Ke | Siapa |
| --- | --- | --- |
| Diproses | Dikirim (kurir + nomor resi) | Admin |
| Diproses | Dibatalkan (alasan, stok kembali) | Admin atau pembeli |
| Dikirim | Selesai | Admin |

Perubahan lain ditolak dengan 409 `INVALID_TRANSITION`.

Admin (`admin_user`):

- **Pesanan Toko** (`/admin/orders`): tab status, cari, urutkan, kirim / selesaikan / batalkan.
- **Kelola Produk**: tab *Daftar produk*, *Produk unggulan* (drag & drop urutan, maks 6, dipakai sort "Pilihan admin" di Toko), dan *Riwayat stok* (sekitar 500 baris, infinite scroll).
- **Kelola User**: hapus pakai dialog `prompt` (ketik username).

Data latihan:

| Apa | Nilai |
| --- | --- |
| PIN WarungPay | `123456` (saldo Rp 2.000.000) |
| Gift card | `GIFT-7788-WQA` (Rp 20.000), `GIFT-5000-WQA` (Rp 50.000) |
| Resi | 10–20 huruf kapital atau angka, contoh `JNE1234567890` |

Voucher latihan:

| Kode | Aturan |
| --- | --- |
| `HEMAT10` | Diskon 10% (maks Rp 50.000), min. belanja Rp 100.000 |
| `WARUNG25K` | Potongan Rp 25.000, min. belanja Rp 150.000 |
| `ONGKIRGRATIS` | Gratis ongkir, min. belanja Rp 50.000 |
| `FLASH15` | Diskon 15% (maks Rp 30.000), min. belanja Rp 75.000 (dari banner flash sale) |
| `KADALUARSA` | Selalu ditolak: "Voucher sudah kedaluwarsa" |

Ongkir: Reguler Rp 10.000, Express Rp 20.000, Same Day Rp 35.000. COD hanya untuk total maksimal Rp 1.000.000.

**Reset Data** mengosongkan keranjang dan pesanan akun yang login. Untuk akun admin, katalog juga kembali ke 24 produk awal (stok pulih, gambar terhapus).

## API

Dokumentasi interaktif (Swagger): **https://warung-qa-playgroundweb.vercel.app/api-docs**.
File OpenAPI untuk di-import ke Postman: `/api-docs/openapi.json`.

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/health` | Cek server hidup |
| POST | `/api/v1/auth/register` | Buat akun baru (aktif 24 jam, role user) |
| POST | `/api/v1/auth/login` | Body `{ "username", "password", "remember" }` |
| GET | `/api/v1/me` | Profil akun yang login |
| POST | `/api/v1/reset` | Kosongkan keranjang & pesanan; admin: katalog kembali ke 24 produk awal |
| GET | `/api/v1/categories` | Daftar kategori |
| GET | `/api/v1/products` | Kelola produk (admin): `search`, `category`, `status`, `sort`, `order`, `page`, `limit` |
| GET / PUT | `/api/v1/products/featured` | Produk unggulan / simpan urutan, body `{ "ids": [3, 1, 7] }` maks 6 (admin) |
| GET | `/api/v1/stock-movements` | Riwayat stok (admin): `cursor`, `limit` (1–100), `productId`, `reason` |
| GET / PUT / PATCH / DELETE | `/api/v1/products/{id}` | Detail / ubah semua / ubah sebagian / hapus (admin) |
| POST | `/api/v1/products` | Tambah produk (admin) |
| POST | `/api/v1/products/bulk-delete` | Body `{ "ids": [1, 2] }` (admin) |
| PUT / DELETE | `/api/v1/products/{id}/image` | Upload (file mentah, `Content-Type: image/jpeg\|png\|webp`, maks 2 MB) / hapus gambar (admin) |
| GET | `/api/v1/products/{id}/image` | Ambil gambar (tanpa token) |
| GET | `/api/v1/store/products` | Katalog toko, produk aktif saja: `search`, `category` (boleh beberapa, pisah koma), `minPrice`, `maxPrice`, `sort` (termasuk `featured`), `order`, `page`, `limit` (12/24/48) |
| GET | `/api/v1/store/products/{id}` | Detail produk di toko |
| GET / DELETE | `/api/v1/cart` | Isi keranjang / kosongkan |
| POST | `/api/v1/cart/items` | Body `{ "productId", "quantity" }` (jumlah digabung) |
| PATCH / DELETE | `/api/v1/cart/items/{productId}` | Ubah jumlah / hapus dari keranjang |
| POST | `/api/v1/checkout/preview` | Body `{ "shippingMethod", "voucherCode", "giftCardCode" }`: hitung total |
| POST | `/api/v1/payments/warungpay` | Body `{ "phone", "pin", "amount" }` → `paymentRef` untuk pesanan e-wallet |
| POST | `/api/v1/orders` | Buat pesanan dari keranjang. Wajib `shipDate` (YYYY-MM-DD); e-wallet wajib `paymentRef` |
| GET | `/api/v1/orders`, `/api/v1/orders/{nomor}` | Riwayat (filter `from`, `to`) / detail pesanan |
| POST | `/api/v1/orders/{nomor}/cancel` | Pembeli batalkan, body `{ "reason", "note" }` |
| GET | `/api/v1/orders/{nomor}/tracking` | Lacak paket (409 kalau belum dikirim) |
| PUT / GET / DELETE | `/api/v1/orders/{nomor}/payment-proof` | Bukti transfer: file mentah PNG/JPG maks 1 MB, nama di header `X-File-Name` |
| GET | `/api/v1/admin/orders` | Pesanan Toko (admin): `status`, `search`, `sort`, `order`, `page`, `limit` + jumlah per status |
| GET | `/api/v1/admin/orders/{nomor}` | Detail pesanan toko (admin) |
| PATCH | `/api/v1/admin/orders/{nomor}/status` | Body `{ "status": "dikirim", "courier", "trackingNumber" }`, `{ "status": "selesai" }`, atau `{ "status": "dibatalkan", "reason", "note" }` |
| GET | `/api/v1/admin/orders/{nomor}/payment-proof` | Bukti transfer dari pembeli (admin) |
| GET | `/api/v1/users` | Kelola User (admin): `search`, `role`, `type` (demo/registered), `sort`, `order`, `page`, `limit` |
| GET / PATCH / DELETE | `/api/v1/users/{id}` | Detail / ubah data (fullName, username, email, phone, birthDate, gender) / hapus (admin) |
| PUT | `/api/v1/users/{id}/password` | Body `{ "newPassword", "confirmPassword" }` (admin) |
| POST | `/api/v1/users/bulk-delete` | Body `{ "ids": [10, 11] }` (admin) |

Akun demo bisa dilihat di Kelola User, tapi tidak bisa diubah, diganti password, atau dihapus (403 `DEMO_PROTECTED`).

Semua endpoint selain `/health`, login, dan register butuh header `Authorization: Bearer <token>`.

## Menjalankan di laptop

Butuh Node.js LTS. Buat file `api/.env` berisi `DATABASE_URL` (dari Neon) dan `JWT_SECRET`.

```powershell
# Terminal 1: API
cd api
npm install
npm run db:setup   # buat/perbarui tabel + akun demo (aman diulang)
npm run dev        # http://localhost:3000

# Terminal 2: Web
cd web
npm install
npm run dev        # http://localhost:5173
```

Unit test API: `cd api` lalu `npm test`.

Daftar `data-testid` ada di [TESTIDS.md](TESTIDS.md).
