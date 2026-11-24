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
| `standard_user` | Login berhasil |
| `admin_user` | Login berhasil sebagai admin |
| `locked_user` | Akun terkunci (423) |
| `slow_user` | Login berhasil setelah 5 detik |
| `error_user` | Server error (500) |

## API

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/health` | Cek server hidup |
| POST | `/api/v1/auth/register` | Buat akun baru (aktif 24 jam). Lihat PRD Registrasi untuk body |
| POST | `/api/v1/auth/login` | Body `{ "username", "password", "remember" }` |
| GET | `/api/v1/me` | Header `Authorization: Bearer <token>` |
| POST | `/api/v1/reset` | Mengosongkan hitungan gagal login (butuh token) |

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
