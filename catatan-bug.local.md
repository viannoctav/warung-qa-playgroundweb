# Catatan mentor: bug tersembunyi di `bug_user`

File ini hanya ada di laptop (diabaikan git lewat pola `*.local.md`). Jangan dibagikan ke peserta.

Login: `bug_user` / `Warung123!` (pembeli, belanja di toko `admin_user`).
Semua bug hanya muncul di akun ini. Akun lain berjalan normal.

## Ringkasan

| Tingkat | Jumlah | Nomor |
| --- | --- | --- |
| Critical | 4 | C1–C4 |
| High | 5 | H1–H5 |
| Moderate | 6 | M1–M6 |
| Low | 5 | L1–L5 |
| **Total** | **20** | |

## Critical: uang salah, data bocor, atau alur utama rusak

| # | Lokasi | Bug | Cara memunculkan | Seharusnya |
| --- | --- | --- | --- | --- |
| C1 | Checkout | Ringkasan menampilkan total benar, tapi pesanan tersimpan dengan diskon voucher dipotong dua kali | Pakai `HEMAT10` (belanja ≥ Rp 100.000), buat pesanan, bandingkan total ringkasan dengan total di detail pesanan | Total pesanan = total ringkasan |
| C2 | Checkout | Klik dua kali tombol Buat pesanan membuat 2 pesanan | Double click Buat pesanan | Hanya 1 pesanan, tombol terkunci saat diproses |
| C3 | Pesanan Saya + API | Bisa melihat pesanan akun lain dengan mengganti nomor pesanan di URL atau `GET /api/v1/orders/{nomor}` | Ganti nomor di URL dengan nomor pesanan `standard_user` | 404 "Pesanan tidak ditemukan" |
| C4 | Keranjang → Checkout | Jumlah bisa melebihi stok, pesanan tetap dibuat, stok tidak berkurang (overselling) | Ketik jumlah 999 di keranjang, lalu checkout | Ditolak: stok tidak cukup |

## High: fungsi penting salah, masih ada jalan lain

| # | Lokasi | Bug | Cara memunculkan | Seharusnya |
| --- | --- | --- | --- | --- |
| H1 | Toko | Urutan "Harga termurah" mengurutkan seperti teks (Rp 12.500 sebelum Rp 4.000) | Pilih urutan Harga termurah | Urut dari angka terkecil |
| H2 | Toko | Memilih 2 kategori hanya menampilkan kategori terakhir | Pilih Kopi + Teh | Produk Kopi dan Teh tampil |
| H3 | Detail produk | Beli sekarang selalu memasukkan jumlah 1 | Isi jumlah 3, klik Beli sekarang | Jumlah di keranjang 3 | 
| H4 | Header | Setelah Keluar, tombol Back browser masih membuka Pesanan Saya dan masih bisa dipakai | Keluar, lalu tekan Back | Diarahkan ke halaman login |
| H5 | Detail pesanan + API | Upload bukti transfer menerima file apa saja (.txt, .pdf) | Unggah file .txt | Ditolak: "File harus PNG atau JPG, maksimal 1 MB" |

## Moderate: mengganggu, tidak menghalangi

| # | Lokasi | Bug | Cara memunculkan | Seharusnya |
| --- | --- | --- | --- | --- |
| M1 | Header | Angka di ikon Keranjang tidak berubah setelah item dihapus (baru benar setelah refresh) | Hapus item di keranjang | Angka langsung berkurang |
| M2 | Toko | Pencarian membedakan huruf besar/kecil | Cari "kopi" | Sama dengan cari "Kopi" |
| M3 | Checkout | Kalender membolehkan Sabtu/Minggu, lalu server menolak | Pilih hari Sabtu di kalender | Akhir pekan nonaktif di kalender |
| M4 | Toko | Halaman 2 mengulang produk terakhir halaman 1 | Klik Berikutnya | Tidak ada produk dobel |
| M5 | Checkout | Nomor HP valid `+6281234567890` ditolak | Isi nomor HP pakai +62 | Diterima |
| M6 | API | `GET /api/v1/cart` mengembalikan `subtotal` sebagai teks (`"85000"`) | Panggil API keranjang | Angka (`85000`), sesuai Swagger |

## Low: kosmetik, teks, aksesibilitas

| # | Lokasi | Bug | Cara memunculkan | Seharusnya |
| --- | --- | --- | --- | --- |
| L1 | Detail produk | Typo tombol "Tambah ke keranjnag" | Buka detail produk | "Tambah ke keranjang" |
| L2 | Toko | Harga tanpa titik ribuan (Rp 85000) | Lihat kartu produk | Rp 85.000 |
| L3 | Pesanan Saya | Tanggal format Inggris ("Nov 25, 2026") | Buka Pesanan Saya | Format Indonesia ("25 Nov 2026") |
| L4 | Keranjang | Tombol Kosongkan keranjang tanpa garis fokus keyboard | Tekan Tab sampai ke tombol itu | Ada garis fokus |
| L5 | Keranjang | Dua elemen dengan `data-testid` sama (`cart-item-name-{id}`) | Cek di DevTools / Playwright | Setiap `data-testid` unik |

## Catatan untuk mentor

- Setiap bug selalu muncul dengan langkah yang sama (tidak acak).
- C4 hanya membuat stok tidak berkurang. Stok pembeli lain tidak rusak. Admin bisa memulihkan katalog dengan Reset Data.
- Kode sumber di GitHub bersifat publik, jadi peserta yang membaca kode bisa menemukan letak bug. Untuk kelas, minta peserta menguji lewat web dan API saja.
