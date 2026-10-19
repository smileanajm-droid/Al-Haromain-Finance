# Al Haromain Finance — Prototipe PWA 0.1

## Yang sudah bisa diuji
- Dashboard pemasukan, pengeluaran, pembayaran SPP dan tunggakan contoh.
- Filter periode dan unit.
- Form transaksi demo.
- Ringkasan per unit.
- Ekspor riwayat transaksi ke CSV.
- Manifest PWA, ikon PNG 192/512, service worker dan layout responsif.

## Cara menjalankan lokal
Cara paling mudah adalah mengunggah folder ini ke repositori GitHub dan mengaktifkan GitHub Pages. PWA memerlukan HTTPS agar service worker dan instalasi berfungsi penuh. Jangan hanya membuka `index.html` sebagai file lokal jika ingin menguji instalasi PWA.

### GitHub Pages
1. Buat repositori baru, misalnya `al-haromain-finance`.
2. Unggah seluruh isi folder ini (file `index.html` harus berada di root repositori).
3. Buka Settings → Pages.
4. Pada Build and deployment pilih Deploy from a branch, pilih `main` dan folder `/ (root)`, lalu Save.
5. Tunggu hingga URL Pages tersedia.
6. Buka URL HTTPS tersebut di Chrome Android, tunggu beberapa detik, lalu muat ulang.
7. Gunakan tombol “Pasang aplikasi” bila muncul, atau menu Chrome → Tambahkan ke layar utama.

## Batasan penting
- Ini hanya prototipe demonstrasi, bukan aplikasi keuangan produksi.
- Data transaksi disimpan di localStorage pada browser/perangkat yang digunakan. Data tidak tersinkron ke perangkat lain dan bisa hilang jika data situs dihapus.
- Pemilihan peran hanya simulasi tampilan; belum ada autentikasi atau keamanan akses sungguhan.
- Jangan masukkan nama siswa, NIS, bukti pembayaran, nomor rekening, atau transaksi nyata.
- Jangan gunakan angka demo untuk laporan keuangan.
- Sebelum produksi perlu backend/database terpusat, autentikasi, otorisasi per unit pada sisi server/database, audit log yang tidak mudah diubah, backup teruji, pengamanan data, serta pengujian rekonsiliasi.

## Tahap teknis berikutnya
1. Buat skema database: units, students, fee_rates, invoices, payments, cash_accounts, transactions, users, roles, audit_logs.
2. Bangun backend/database terpusat.
3. Terapkan autentikasi dan hak akses berbasis unit di database/server.
4. Hubungkan UI ke database; hilangkan data contoh dan localStorage transaksi.
5. Uji transaksi ganda, cicilan, pembatalan, tunggakan, dan rekonsiliasi.
6. Uji backup dan pemulihan sebelum dipakai untuk data nyata.


## Database baseline (Supabase)
- File `supabase_schema_v1.sql` creates the first normalized schema and seeds the four education units.
- It enables RLS and deliberately does not grant browser access yet. Add and test role/unit policies before connecting the app.
