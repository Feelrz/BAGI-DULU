# BAGI DULU V6 — PATUNGAN

Paket ini melanjutkan arsip BAGI-DULU-v5-ADVANCED dari 7 Oktober 2026. Website yang diperiksa pada 19 Oktober 2026 juga menampilkan V5.0. Isi repo GitHub terkini belum dibandingkan, sehingga perubahan yang dibuat setelah arsip V5 perlu digabungkan, bukan ditimpa begitu saja.

## Cara pasang ke proyek yang sudah ada

1. Di BAGI yang sekarang, buka **ATUR → Export full JSON** untuk menyimpan data keuangan sebelum update.
2. Ekstrak ZIP ini. Di folder proyek, `package.json` harus berada di root, sejajar dengan `app`, `components`, `lib`, `scripts`, dan `public`.
3. Bandingkan dengan repo `Feelrz/BAGI-DULU`. Kalau belum ada perubahan setelah arsip V5, paket ini merupakan source lengkap yang bisa dipakai. Kalau sudah ada perubahan, gabungkan file pada daftar di bawah. Gunakan branch/PR untuk meninjau perubahan.
4. Jalankan `npm ci`, `npm test`, dan `npm run build`.
5. Commit source beserta `package-lock.json` ke repo yang terhubung ke Vercel. Jika deployment Git aktif, merge/push ke branch produksi memicu deploy. Jangan upload ZIP sebagai satu file ke repo; masukkan isi source-nya.
6. Setelah deploy berhasil, refresh BAGI pada domain yang sama. Footer akan menampilkan **V6.0** dan ada tab **PATUNGAN**. Bila PWA masih menampilkan versi lama, tutup tab/aplikasi dan buka kembali. Jangan hapus data situs untuk memaksa refresh.

Tidak perlu API key OCR, layanan AI berbayar, atau environment variable baru. Pengaturan Supabase lama tetap bisa digunakan bila sebelumnya dipakai. `npm run build` otomatis menyiapkan aset OCR. Folder `public/ocr` sengaja tidak disertakan dalam ZIP karena dibuat ulang dari dependency; jangan melewati langkah build.

## Cara pakai

1. Buka **PATUNGAN**.
2. Pilih **scan struk** untuk kamera langsung, **Kamera HP** untuk kamera bawaan ponsel, **unggah foto** dari galeri, atau **isi manual**. Izinkan kamera hanya saat ingin mengambil foto.
3. Tambahkan nama peserta. Bisa sampai 30 orang.
4. Periksa hasil scan: nama item, jumlah, total baris, diskon, pajak, service, dan total struk. Bisa diedit semuanya. Foto dan teks hasil baca terlihat di panel pemeriksaan selama tab ini terbuka.
5. Pilih **Sesuai pesanan**, lalu pilih nama di bawah tiap item. Satu item untuk beberapa orang otomatis dibagi rata di antara mereka. Pilih **Bagi rata** untuk membagi seluruh tagihan sama rata. Tanpa rincian, pilih **Cukup masukkan total**.
6. Isi biaya tambahan. Angka persen otomatis dihitung; pilih Rp untuk memasukkan nominal final persis seperti struk. Biaya di struk yang sudah termasuk total jangan ditambahkan dua kali.
7. Kalau total hitungan berbeda dengan kolom total struk, koreksi item/biaya terlebih dahulu. Setelah cocok, centang konfirmasi hasil scan.
8. Pilih siapa yang membayar seluruh tagihan lebih dulu, bila ada. Rincian akan menunjukkan bagian masing-masing dan nominal yang harus dikembalikan kepadanya.
9. Klik **Simpan patungan** untuk riwayat atau **Salin buat chat** untuk menempel rincian ke WhatsApp/chat pilihanmu. Tidak ada pesan yang dikirim otomatis.

### Penting tentang jumlah dan harga

Kolom **Total baris** adalah harga seluruh jumlah pada baris tersebut. Contoh: dua nasi goreng @Rp25.000 → jumlah `2`, total baris `50000`. Total tidak dikalikan jumlah lagi. Jika struk menampilkan harga satuan saja, hitung total barisnya saat mengoreksi.

### Cara biaya dibagi

- Diskon mengurangi subtotal item.
- Service dalam persen dihitung dari subtotal sesudah diskon.
- Pajak dalam persen dihitung dari subtotal sesudah diskon, ditambah service hanya jika opsi tersebut dicentang.
- Diskon dan biaya berlaku ke seluruh tagihan. Diskon khusus item dapat dimasukkan dengan mengedit total item menjadi harga sesudah diskon dan tidak menambah diskon global lagi.
- Mode sesuai pesanan membagi total akhir menurut porsi item tiap orang. Mode bagi rata membaginya sama rata.
- Pembagian memakai rupiah bulat. Sisa pembulatan Rp1 diberikan menurut sisa pecahan terbesar; jika sama, mengikuti urutan peserta. Jumlah bagian semua orang tepat sama dengan total.
- Fitur ini menghitung patungan, tanpa otomatis mencatat pengeluaran BAGI atau memindahkan uang.

## File baru dan file yang diubah

Baru:
- `components/SplitBillPanel.tsx`
- `lib/splitbill.ts`
- `lib/receipt-ocr.ts`
- `scripts/prepare-ocr.mjs`
- `tests/splitbill.test.mjs`
- `tests/ocr-smoke.mjs`
- `tests/fixtures/CONTOH-STRUK.png` dan `receipt.txt`
- `package-lock.json` dan panduan ini

Diubah:
- `components/MoneyApp.tsx` — tab, state V6, migrasi, backup, reset
- `app/globals.css` — style PATUNGAN
- `app/layout.tsx` — deskripsi
- `public/sw.js` — cache aplikasi dan OCR
- `package.json` — dependency dan langkah persiapan OCR
- `tsconfig.json` — penyesuaian otomatis Next.js
- `.gitignore`, `.github/workflows/ci.yml`, `README.md`, `CHANGELOG.md`

## Hasil verifikasi dan batasnya

- TypeScript dan build produksi Next.js: lulus.
- 15 kelompok uji perhitungan/parser: lulus, termasuk 1.000 kombinasi alokasi.
- Gambar contoh struk benar-benar dibaca OCR menjadi tiga item (Rp50.000, Rp10.000, Rp20.000), diskon Rp8.000, service Rp3.600, pajak Rp7.200, dan total Rp82.800.
- Kamera fisik, izin kamera iOS/Android/desktop, dan tampilan browser pada perangkat nyata belum diuji dalam sesi ini.
- Ini OCR berbasis tulisan Latin, bukan pemahaman struk sempurna. Struk buram, miring, tabel rumit, diskon khusus item, dan pajak inklusif perlu koreksi. Selalu periksa hasil.
- Foto dibaca di perangkat. Model OCR dimuat dari domain aplikasimu. Pertama kali memakai scan perlu koneksi; input manual tidak memerlukan layanan OCR.
- Foto dan teks mentah tidak disimpan dalam backup; draft serta riwayat patungan ikut backup. Data pada perangkat tetap bergantung pada penyimpanan browser.

Paket ini belum dipasang ke website Vercel. Menghubungkan GitHub memungkinkan peninjauan repo terkini dan pemasangan melalui repo tersebut.
