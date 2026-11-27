# Waktu Indonesia Bercukur

## 1. Menyiapkan Firebase

1. Buat project di Firebase Console.
2. Aktifkan Firebase Authentication dengan metode Email/Password.
3. Tambahkan domain production Vercel dan `localhost` ke daftar Authorized domains Firebase Authentication.
4. Buat Firestore Database.
5. Daftarkan Web App dan salin konfigurasi ke variabel `NEXT_PUBLIC_FIREBASE_*`.
6. Buat service account untuk Firebase Admin SDK. Simpan project ID, client email, dan private key di environment server sebagai `FIREBASE_ADMIN_*`.
7. Deploy rules dan index:

   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes
   ```

7. Isi `CAPSTER_INITIAL_PASSWORD` (minimal 12 karakter dan unik) di environment lokal/server, lalu jalankan seed sekali:

   ```bash
   npm run seed:capster
   ```

   Seed membuat atau memperbarui akun `hasan@waktu-indonesia.app` dan menempelkan custom claim `role=capster`. Jangan memasukkan password awal ke source code atau mengirimkannya di chat.

## 2. Menyiapkan Google Sheets

Buat spreadsheet bernama `Keuangan_dan_Pelanggan_Waktu_Indonesia_Bercukur` dengan tab dan header baris pertama berikut.

### Transaksi_Harian

`Tanggal`, `Jam`, `Kode Booking`, `Nama Pelanggan`, `Nomor WhatsApp`, `Capster`, `Layanan (daftar)`, `Kategori`, `Harga Normal`, `Potongan Promo`, `Total Harga`, `Status`, `Sumber`.

### Database_Pelanggan

`Nama`, `Nomor WhatsApp`, `Email`, `Tanggal Daftar`, `Kunjungan Terakhir`, `Total Kunjungan`.

Buat juga tab `Rekap_Harian` (untuk formula ringkasan pendapatan, pengeluaran, dan laba bersih) serta `Pengeluaran_Harian`. Bagikan spreadsheet kepada service account Google dengan hak Editor. Isi `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, dan `GOOGLE_PRIVATE_KEY` di environment server.

Semua penulisan transaksi memeriksa header sebelum menulis. Tab `Rekap_Harian` hanya dibaca, tidak pernah ditulis oleh aplikasi. Kegagalan sinkronisasi dimasukkan ke Firestore `sheetSyncQueue` dan dicoba ulang dengan backoff.

## 3. Environment dan deployment

Gunakan Node.js 22 atau lebih baru untuk pengembangan dan runtime deployment. Salin `.env.example` ke `.env.local`. Jangan commit nilai rahasia. Atur seluruh environment variable pada pengaturan project Vercel. Pastikan `CRON_SECRET` adalah secret acak yang kuat. Endpoint cron menerima header `Authorization: Bearer ...`.

Jadwal maintenance memakai GitHub Actions agar tidak bergantung pada batas frekuensi cron Vercel Hobby. Di GitHub repository settings, tambahkan Actions secrets:

- `WIB_APP_URL`: URL production Vercel, tanpa garis miring di akhir.
- `WIB_CRON_SECRET`: nilai yang sama dengan `CRON_SECRET` pada Vercel.

Workflow `.github/workflows/scheduled-maintenance.yml` aktif setelah branch ini digabung ke default branch. Jadwal UTC: daily reset pukul 03:00 dan 05:00, booking expiry setiap 5 menit, dan retry Google Sheets setiap 15 menit. Workflow juga dapat dijalankan manual melalui GitHub Actions. `vercel.json` sengaja tidak menjadwalkan cron agar deployment tetap kompatibel dengan paket Vercel Hobby.
## 4. Implementasi pada branch fitur

- Firebase Authentication untuk pelanggan menggunakan email internal yang diturunkan dari nomor WhatsApp. UI tetap meminta nomor WhatsApp.
- Akun Hasan menggunakan Firebase Auth custom claim `role=capster`, bukan password yang tertanam di kode.
- Sesi capster satu perangkat: session ID di `sessionStorage`, heartbeat 30 detik, timeout 90 detik, dan pemeriksaan server untuk setiap API capster.
- Data antrean, booking, jadwal, kuota, promosi, profil, dan pelanggan disimpan di Firestore.
- Pelanggan hanya membaca data pribadi miliknya. Data publik antrean dan booking menggunakan nama tersamarkan.
- Penulisan antrean dan booking melewati server. Kuota/counter serta penguncian slot multi-durasi memakai Firestore transaction.
- Listener Firestore `onSnapshot` memperbarui halaman pelanggan dan capster. Jam UI dikoreksi dengan endpoint waktu server WIB.
- Cron reset antrean mempertahankan kuota yang dikonfigurasi capster, mengatur ulang nomor, dan mengubah antrean Waiting dari sesi lama menjadi Kedaluwarsa.
- Booking yang lewat toleransi 15 menit dibatalkan server-side dan slot dikosongkan.
- Ketika menyelesaikan walk-in, capster memilih layanan. Ketika menyelesaikan booking, capster mengonfirmasi harga final.
- Penulisan booking, pembatalan, walk-in selesai, dan database pelanggan tersambung ke Google Sheets. Outbox retry mencegah kegagalan sementara spreadsheet membatalkan transaksi.
- Halaman `/capster/spreadsheet` menampilkan ringkasan, transaksi dengan filter tanggal, dan pencarian database pelanggan. API hanya mengirim data kepada capster dengan sesi valid.
- Service lama tidak lagi membaca atau menulis data bisnis di localStorage. Sisa data localStorage dari versi lama sengaja tidak dihapus otomatis sebagai salinan lokal. Data historis lama belum diimpor otomatis ke Firestore.

## 5. Verifikasi sebelum produksi

Sebelum mengalihkan domain produksi atau merge ke `main`, lengkapi langkah berikut:

1. Isi environment Vercel dengan Firebase dan Google service account yang benar.
2. Deploy Firestore rules/indexes dan jalankan seed akun Hasan.
3. Pastikan seluruh header sheet cocok persis dengan daftar di atas.
4. Jalankan build GitHub Actions dan tes end-to-end dengan dua browser/perangkat: customer, capster, kuota penuh, slot bentrok, reschedule, pembatalan, sesi capster kedua, auto-expiry, dan retry Google Sheets.
5. Impor atau arsipkan data historis localStorage versi sebelumnya secara terpisah jika diperlukan.

Branch kerja ini tidak mengubah `main`. PR dibuat sebagai Draft sampai build dan tes end-to-end selesai.
