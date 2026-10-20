# V6.1.0 — 2026-10-20

- Tambah review yang dapat diedit sebelum impor, foto pembanding, penanda kolom bermasalah, item tambahan, hapus/urungkan, serta rincian seluruh biaya.
- Hitung selisih subtotal/total saat edit. Impor memerlukan data valid, total cocok, dan konfirmasi; edit membatalkan konfirmasi sebelumnya.
- Draft tagihan tidak berubah selama review atau ketika hasil dibatalkan. Koreksi angka sesudah impor meminta pemeriksaan ulang.
- Pertahankan angka pada nama produk jika jumlah sudah ada di awal baris, abaikan metadata kartu/alamat dan ringkasan pembayaran, serta hindari menambahkan ulang pajak yang dirinci setelah total.
- Tandai indikasi mata uang selain rupiah. Belum ada dukungan multi-mata-uang atau konversi otomatis.
- Tambah regresi review, format struk dan perlindungan impor; uji foto gelap, struk panjang luar negeri, dan foto miring/tertutup tanpa menyimpan foto pengguna di repository.

# V6.0.2 — 2026-10-20

- Kurangi noise foto dengan filter median, pertahankan gambar asli sebagai alternatif, dan pakai pembesaran piksel yang sama pada browser dan uji OCR.
- Baca ulang gambar bersih dengan tata letak kolom struk. Hasil dengan item valid diprioritaskan; subtotal saja tidak dianggap sebagai total akhir.
- Tolak teks acak dan nominal tidak masuk akal sebelum impor. Tandai draft scan lama yang terindikasi rusak tanpa menghapus data pengguna.
- Tambah tombol atur area dan baca ulang dari foto asli; tampilkan versi scanner agar pembaruan mudah dikenali.
- Uji OCR sekarang menjalankan fungsi pemrosesan gambar produksi, bukan pembesaran gambar khusus pengujian.
- Perbarui cache aplikasi dan pemeriksaan pembaruan service worker.

# V6.0.1 — 2026-10-19

- Kamera HP memakai pengambilan foto native; desktop memakai foto resolusi penuh jika didukung.
- Tambah editor potong/putar foto sebelum OCR, pembesaran teks kecil, pengurangan noise, kontras, dan beberapa percobaan pembacaan.
- Susun kembali nama/kuantitas/harga berdasarkan posisi baris. Pilih hasil berdasarkan kejelasan dan kecocokan subtotal/total.
- Hasil scan diperiksa sebelum mengganti tagihan. Hasil buruk tidak langsung diimpor; teks mentah disimpan dalam panel tertutup.
- Kenali ringkasan ITEMS, pajak PB1/Pbl, pembayaran, dan pembulatan negatif. Pembulatan tersimpan dalam draft/riwayat dan ikut dihitung.
- Tambah regresi struk restoran, proteksi OCR acak, dan uji pembacaan gambar nyata.

# V6.0.0 — 2026-10-19

- Added PATUNGAN / SPLIT BILL with real on-device receipt OCR and manual entry.
- Added camera, phone capture fallback, photo upload, progress, cancellation, and editable review.
- Added equal/per-item sharing, shared dishes, discount, service, tax, optional service-tax base, other fees, reconciliation, upfront payer, and exact integer allocations.
- Added autosaved draft, saved history, bilingual copy, responsive styling, and clipboard summary.
- Extended migration, backup/import, cloud state, and reset to include split bills.
- Bundled self-hosted OCR assets at build time; no API keys or receipt upload.
- Restricted service-worker caching to same-origin static assets/pages; avoids caching cloud/auth requests and returning HTML as a worker/script fallback.
- Added parser/calculation tests and a synthetic receipt OCR smoke test.

# Changelog

## 5.0.0
- Fresh installs now start with no payday buckets.
- Added the built-in **Upil Nabung** starter preset.
- Payday buckets can now be added, renamed, locked, and deleted directly.
- Reworked donut and payday history to support dynamic bucket structures.
- Replaced Mandiri Utama default account with generic **Bank**.
- Added the current OJK Bank Umum + Bank Umum Syariah names to bank autocomplete, plus manual BPR/BPRS/custom entry.
- Cleaned up Indonesian and English copy to stay playful without forced slang.
- Replaced unclear “future you” goal copy with clearer goal-progress language.
- Added V4 → V5 local data migration and renamed the old default Mandiri account to Bank.
- Bumped PWA shell cache to v5.

## 4.0.0
- Removed slash branding and renamed visible product brand to BAGI DULU.
- Fresh installs no longer ship with fake/demo money, budget, or goal numbers.
- Added safe V2/V3 seed-data migration without wiping real user-entered values.
- Fixed payday allocation: essentials reserve can never silently exceed income.
- Payday amounts now update instantly from income input.
- Added explicit “add payday to balance” flow so Overview/account balances update intentionally.
- Money Health shows no score until enough real data exists.
- No-spend days no longer fabricate a streak on an empty month.
- Bumped PWA cache to v4 to prevent stale UI after Vercel redeploy.


## 3.0.0

- Added Bahasa Indonesia / English UI switching.
- Added persisted Roast Mode setting.
- Rebranded interface copy around BAGI DULU personality.
- Added Money Health score.
- Added safe-to-spend-per-day metric.
- Added daily burn rate and end-of-month spending projection.
- Added no-spend day count.
- Added previous-month expense comparison.
- Added transaction search.
- Added transaction type filters.
- Added V2 localStorage migration path.
- Updated PWA cache namespace and product metadata.
- Preserved all V2 account, budget, goal, recurring, analytics, backup, PWA, and optional Supabase functionality.
