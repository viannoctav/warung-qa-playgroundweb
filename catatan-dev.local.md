# Catatan pengembang (pribadi)

File ini hanya ada di laptop (diabaikan git lewat pola `*.local.md`).

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

## Rilis ke production

1. `cd api`, lalu `npm run db:setup` kalau ada tabel/kolom baru (pastikan `DATABASE_URL` di `api/.env` sama dengan di Vercel).
2. `npm test` harus `fail 0`.
3. `cd ..`, `git add .`, `git commit -m "..."`, `git push`. Vercel otomatis deploy web dan API.
