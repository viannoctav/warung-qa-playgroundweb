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
| `admin_user` | Admin: kelola produk + gambar, dan bisa belanja di tokonya sendiri |
| `locked_user` | Akun terkunci (423) |
| `slow_user` | Login berhasil setelah 5 detik |
| `error_user` | Server error (500) |

Akun hasil registrasi ber-role admin untuk **tokonya sendiri** dan aktif 24 jam.

## Alur toko

1. **Toko** (`/shop`): cari, filter kategori, urutkan, tambah ke keranjang.
2. **Detail produk** (`/shop/{id}`): pilih jumlah, *Tambah ke keranjang* atau *Beli sekarang*.
3. **Keranjang** (`/cart`): ubah jumlah, hapus, kosongkan.
4. **Checkout** (`/checkout`): Alamat, lalu Pengiriman, lalu Pembayaran + voucher.
5. **Pesanan** (`/orders`): riwayat dan detail. Stok produk berkurang setelah pesanan dibuat.

Voucher latihan:

| Kode | Aturan |
| --- | --- |
| `HEMAT10` | Diskon 10% (maks Rp 50.000), min. belanja Rp 100.000 |
| `WARUNG25K` | Potongan Rp 25.000, min. belanja Rp 150.000 |
| `ONGKIRGRATIS` | Gratis ongkir, min. belanja Rp 50.000 |
| `KADALUARSA` | Selalu ditolak: "Voucher sudah kedaluwarsa" |

Ongkir: Reguler Rp 10.000, Express Rp 20.000, Same Day Rp 35.000. COD hanya untuk total maksimal Rp 1.000.000.

**Reset Data** mengosongkan keranjang dan pesanan akun yang login. Untuk akun admin, katalog juga kembali ke 24 produk awal (stok pulih, gambar terhapus).

## API

Dokumentasi interaktif (Swagger): **https://warung-qa-playgroundweb.vercel.app/api-docs**.
File OpenAPI untuk di-import ke Postman: `/api-docs/openapi.json`.

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/health` | Cek server hidup |
| POST | `/api/v1/auth/register` | Buat akun baru (aktif 24 jam, role admin untuk katalognya sendiri) |
| POST | `/api/v1/auth/login` | Body `{ "username", "password", "remember" }` |
| GET | `/api/v1/me` | Profil akun yang login |
| POST | `/api/v1/reset` | Kosongkan keranjang & pesanan; admin: katalog kembali ke 24 produk awal |
| GET | `/api/v1/categories` | Daftar kategori |
| GET | `/api/v1/products` | Kelola produk (admin): `search`, `category`, `status`, `sort`, `order`, `page`, `limit` |
| GET / PUT / PATCH / DELETE | `/api/v1/products/{id}` | Detail / ubah semua / ubah sebagian / hapus (admin) |
| POST | `/api/v1/products` | Tambah produk (admin) |
| POST | `/api/v1/products/bulk-delete` | Body `{ "ids": [1, 2] }` (admin) |
| PUT / DELETE | `/api/v1/products/{id}/image` | Upload (file mentah, `Content-Type: image/jpeg\|png\|webp`, maks 2 MB) / hapus gambar (admin) |
| GET | `/api/v1/products/{id}/image` | Ambil gambar (tanpa token) |
| GET | `/api/v1/store/products` | Katalog toko, produk aktif saja: `search`, `category`, `sort`, `order`, `page`, `limit` (12/24/48) |
| GET | `/api/v1/store/products/{id}` | Detail produk di toko |
| GET / DELETE | `/api/v1/cart` | Isi keranjang / kosongkan |
| POST | `/api/v1/cart/items` | Body `{ "productId", "quantity" }` (jumlah digabung) |
| PATCH / DELETE | `/api/v1/cart/items/{productId}` | Ubah jumlah / hapus dari keranjang |
| POST | `/api/v1/checkout/preview` | Body `{ "shippingMethod", "voucherCode" }`: hitung total |
| POST | `/api/v1/orders` | Buat pesanan dari keranjang |
| GET | `/api/v1/orders`, `/api/v1/orders/{nomor}` | Riwayat / detail pesanan |

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
