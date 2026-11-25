# Catatan mentor: bug tersembunyi di `bug_user`

File ini hanya ada di laptop (diabaikan git lewat pola `*.local.md`). Jangan dibagikan ke peserta.

Login: `bug_user` / `Warung123!` (pembeli, belanja di toko `admin_user`).
Semua bug hanya muncul di akun ini. Akun lain berjalan normal.

**Cara paling gampang memastikan sebuah bug:** lakukan langkah yang sama dengan `standard_user`, lalu bandingkan. Kalau hasilnya beda, itu bugnya.

## Ringkasan

| Tingkat | Jumlah | Nomor |
| --- | --- | --- |
| Critical | 4 | C1–C4 |
| High | 5 | H1–H5 |
| Moderate | 6 | M1–M6 |
| Low | 5 | L1–L5 |
| **Total** | **20** | |

Kolom **"Yang terlihat (ini bugnya)"** adalah hasil yang kamu dapat di `bug_user`. Kolom **"Seharusnya"** adalah hasil di `standard_user`.

## Critical: uang salah, alur utama rusak

| # | Lokasi | Cara memunculkan | Yang terlihat (ini bugnya) | Seharusnya |
| --- | --- | --- | --- | --- |
| C1 | Checkout | Pakai voucher `HEMAT10`, buat pesanan. Catat total di ringkasan checkout, lalu buka detail pesanannya | Total di detail pesanan lebih kecil dari ringkasan (diskon dipotong dua kali) | Total pesanan sama dengan ringkasan |
| C2 | Checkout | Klik dua kali cepat tombol Buat pesanan, lalu buka Pesanan Saya | Muncul 2 pesanan (yang kedua tanpa barang, tapi tetap ada tagihannya) | Hanya 1 pesanan, tombol terkunci saat diproses |
| C3 | Checkout (layar HP) | Buka checkout, kecilkan layar ke ukuran HP (DevTools → Toggle device toolbar → iPhone), isi sampai langkah pembayaran | Tombol Buat pesanan hilang, pembeli di HP tidak bisa menyelesaikan pesanan | Tombol tetap terlihat di semua ukuran layar |
| C4 | Keranjang → Checkout | Pilih produk stok di bawah 99 (misal stok 40). Ketik jumlah 99 lalu Tambah ke keranjang (atau ketik 99 di keranjang lalu Enter). Lanjut checkout | Jumlah 99 diterima, pesanan dibuat, stok produk tidak berkurang | Ditolak: stok tidak cukup |

## High: fungsi penting salah, masih ada jalan lain

| # | Lokasi | Cara memunculkan | Yang terlihat (ini bugnya) | Seharusnya |
| --- | --- | --- | --- | --- |
| H1 | Toko | Pilih urutan Harga termurah, cek halaman 1 dan 2 | Urutan seperti teks: Rp 12.500 di atas padahal ada Rp 4.000; di halaman 2 Rp 45.000 sebelum Rp 6.000 | Urut dari angka terkecil |
| H2 | Toko | Centang kategori Kopi dan Teh | Hanya produk kategori terakhir yang tampil | Kopi dan Teh tampil |
| H3 | Detail produk | Ubah jumlah jadi 3, klik **Beli sekarang**, lihat jumlah di checkout/keranjang | Jumlah di keranjang **tetap 1** | Jumlah di keranjang 3 |
| H4 | Header | Buka Pesanan Saya, Keluar, lalu tekan Back di browser | Halaman Pesanan Saya terbuka lagi | Diarahkan ke halaman login |
| H5 | Detail pesanan | Buat pesanan dengan Transfer bank, buka detailnya, unggah file .txt atau .pdf | File diterima dan tersimpan sebagai bukti transfer | Ditolak: "File harus PNG atau JPG, maksimal 1 MB" |

## Moderate: mengganggu, tidak menghalangi

| # | Lokasi | Cara memunculkan | Yang terlihat (ini bugnya) | Seharusnya |
| --- | --- | --- | --- | --- |
| M1 | Header | Isi 2 barang di keranjang, hapus 1 | Angka di ikon Keranjang tetap 2 (baru benar setelah refresh) | Angka langsung jadi 1 |
| M2 | Toko | Cari "kopi" (huruf kecil) | Tidak ada hasil, padahal cari "Kopi" ada | Hasil sama dengan "Kopi" |
| M3 | Checkout | Buka kalender tanggal kirim | Sabtu/Minggu bisa dipilih, baru ditolak saat Buat pesanan | Sabtu/Minggu abu-abu, tidak bisa dipilih |
| M4 | Toko | Lihat produk terakhir halaman 1, klik Berikutnya | Produk pertama halaman 2 sama dengan produk terakhir halaman 1 | Tidak ada produk dobel |
| M5 | Checkout | Isi Nomor HP `+6281234567890` lalu Lanjut | **Ditolak** dengan pesan "harus diawali 08 atau +628", padahal nomornya sudah +628 | Diterima |
| M6 | Keranjang | Buka keranjang yang ada isinya, lihat tombol di bawah ringkasan | Tombol Lanjut ke checkout putih polos tanpa tulisan (teks putih di atas putih) | Tombol berwarna dengan tulisan "Lanjut ke checkout" |

## Low: kosmetik dan teks

| # | Lokasi | Cara memunculkan | Yang terlihat (ini bugnya) | Seharusnya |
| --- | --- | --- | --- | --- |
| L1 | Detail produk | Buka detail produk | Tombol bertuliskan "Tambah ke keranjnag" | "Tambah ke keranjang" |
| L2 | Toko | Lihat harga di kartu produk | Rp 85000 (tanpa titik) | Rp 85.000 |
| L3 | Pesanan Saya | Lihat kolom tanggal | "Nov 25, 2026" (format Inggris) | "25 Nov 2026" |
| L4 | Checkout | Lihat kolom Alamat lengkap yang masih kosong | Contoh isian "Lorem ipsum dolor sit amet" | "Jl. Kenanga No. 5, RT 01/RW 02" |
| L5 | Header | Lihat logo Warung QA di kiri atas | Logo gepeng (melebar dan pendek) | Logo proporsional |

## Catatan untuk mentor

- Setiap bug selalu muncul dengan langkah yang sama (tidak acak).
- H3 dan M5 sering dikira "normal" karena hasilnya terlihat wajar. Bandingkan dengan `standard_user`: di sana jumlah ikut 3 dan nomor +628 diterima.
- C4 hanya membuat stok tidak berkurang. Stok pembeli lain tidak rusak. Admin bisa memulihkan katalog dengan Reset Data.
- `bug_user` muncul di daftar akun demo halaman login dengan catatan "Ada bug tersembunyi, temukan sendiri".
- Kode sumber di GitHub bersifat publik, jadi peserta yang membaca kode bisa menemukan letak bug. Untuk kelas, minta peserta menguji lewat web dan API saja.
