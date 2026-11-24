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
| Link lupa password | `login-forgot-link` | Ke `/forgot-password` |
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
| Tombol Keluar | `header-logout-btn` |

## Produk (`/products`, sementara)

| Elemen | `data-testid` |
| --- | --- |
| Kontainer halaman | `products-page` |
| Judul | `products-title` |

## Global

| Elemen | `data-testid` |
| --- | --- |
| Logo Warung QA (semua halaman) | `brand-logo` |
| Toast sukses | `toast-success` |

## Halaman sementara (`/forgot-password`)

| Elemen | `data-testid` |
| --- | --- |
| Kontainer | `forgot-password-page` |
| Judul | `forgot-password-title` |
| Pesan | `coming-soon-message` |
| Link kembali | `coming-soon-back-link` |
