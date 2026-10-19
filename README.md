## Perbaikan scanner V6.0.1

Di PATUNGAN, pilih **scan struk** atau **unggah foto**. Pada HP, scan membuka kamera bawaan. Geser sudut untuk menyisakan area struk, putar jika perlu, lalu pilih **BACA AREA INI**. Pastikan harga dan total tidak terpotong. Periksa tabel hasil dan pilih **MASUKKAN KE TAGIHAN**. Hasil yang kurang jelas memerlukan pemeriksaan; foto yang tidak terbaca tidak dapat diimpor. Koreksi form lalu konfirmasi pemeriksaan struk sebelum menyimpan/membagikan.

OCR tetap berjalan di perangkat dan tidak memerlukan API key. Hasil bisa keliru pada foto buram, silau, miring, atau foto layar. Scanner mencoba beberapa versi gambar dan memeriksa subtotal/total, tetapi pengguna tetap perlu mencocokkan hasil dengan struk. Pembulatan seperti `-5` dapat diisi pada kolom pembulatan.

# BAGI DULU — Money, Before It Disappears

**BAGI DULU** is a bilingual, local-first personal finance OS with a little personality. It helps you split payday, set budgets, track money moves, build goals, manage recurring money, and see whether this month is still financially alive.

> Personal finance for people who do not want their money app to feel like homework.

## V6 — PATUNGAN / SPLIT BILL

- New **PATUNGAN / SPLIT BILL** tab, matching the existing dark/light BAGI UI and ID/EN switch.
- Camera capture, native phone-camera fallback, and gallery photo input.
- Real on-device OCR with Tesseract.js 7.0.0. No paid OCR API or secret key.
- Editable receipt items, quantities, **line totals**, tax, service, discount, and expected total.
- Manual item entry or quick total-only equal splitting.
- Equal splitting or participant selection per item, including shared dishes.
- Proportional fees, configurable tax base, and exact whole-rupiah allocation.
- Mismatch warnings and explicit scanned-receipt review before saving or copying.
- Single upfront payer and a repayment breakdown; copy detailed results for chat.
- Autosaved draft and 40 saved bills, included in JSON backup and optional existing cloud sync.
- Automatic migration from V5/V4/V3/V2. The V5 key remains available until an explicit full reset.
- Camera tracks and OCR workers released when closing, cancelling, or leaving the tab.

**See [PANDUAN-UPDATE-V6.md](PANDUAN-UPDATE-V6.md) for Indonesian setup and usage.**

## V5 features retained

- **Bahasa Indonesia + English** toggle from the top bar or Settings
- **Roast Mode**: optional dry / Gen-Z copy that can be turned off when you want the app to behave
- **Custom payday buckets**: fresh installs start empty; add, rename, lock, and delete buckets directly in Payday
- **Upil Nabung** built-in starter preset with Dana Darurat, Goals, Nongkrong, and Impulsif
- **Indonesian bank picker** with the current Bank Umum + Bank Umum Syariah names, while still allowing custom/BPR names
- **Month Health Score** from budget usage, actual cashflow, savings rate, and emergency-fund progress
- **Safe to spend / day** based on remaining monthly budget and days left
- **Daily burn rate** and projected month-end spending
- **No-spend day counter**
- **Month-over-month expense delta**
- **Transaction search + type filters**
- Existing BAGI V2–V4 local data automatically migrates to V5

## Core features

- Monthly control dashboard
- Total balance across multiple accounts
- Generic Bank default account + cash / e-wallet / savings / custom accounts
- Income, expense, and transfer ledger
- Activity calendar + day filtering
- Payday splitter with auto-balancing 100% sliders
- Lock individual payday buckets while redistributing the rest
- Empty-by-default payday setup + Upil Nabung starter preset + payday history
- Add / rename / lock / delete payday buckets directly
- Monthly budget caps per spending category
- Warning and over-budget states
- Emergency fund + unlimited custom goals
- Goal progress, target date, priority, monthly contribution, and ETA
- Recurring income / expenses with monthly duplicate protection
- Six-month income vs expense trend
- Spending mix analytics
- JSON full backup / restore
- CSV transaction export
- Dark / light mode
- LocalStorage persistence
- PWA manifest + service worker
- Responsive desktop / tablet / mobile UI
- Optional Supabase email auth + manual cross-device cloud push / pull
- GitHub Actions CI
- No analytics / tracking by default

## Brand direction

BAGI DULU is intentionally casual without turning every screen into a joke. Indonesian and English copy is short, conversational, and still clear when money is involved.

Indonesian UI examples:

- **uang masuk**
- **uang keluar**
- **jatah hidup**
- **jangan disentuh**
- **boleh khilaf**
- **lagi ngejar**
- **datang lagi**
- **uangnya ke mana?**
- **bulan ini masih aman?**

English mode keeps the same casual tone instead of doing literal corporate translations.

## Bank list

The built-in autocomplete includes the current Indonesian Bank Umum and Bank Umum Syariah names from the OJK June 2026 head-office directory. OJK publishes BPR/BPRS in separate directories, so the account field stays editable: any BPR/BPRS or custom account name can still be typed manually instead of being blocked by the preset list.

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Validate before shipping:

```bash
npm run lint
npm run build
```

## Push to GitHub

```bash
git init
git add .
git commit -m "feat: BAGI V6 split bill"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bagi.git
git push -u origin main
```

## Deploy to Vercel

1. Create a new Vercel project.
2. Import the GitHub repository.
3. Vercel detects Next.js automatically.
4. No environment variables are needed for local-only mode.
5. Deploy.

Every new push to `main` can trigger a fresh Vercel deployment.

## Optional Supabase cloud sync

BAGI works completely without a backend. Cloud sync is optional.

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Enable Email authentication.
5. Add these variables locally in `.env.local` or in **Vercel → Project Settings → Environment Variables**:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

6. Redeploy.
7. Open **Settings → Cloud sync** inside BAGI.

Cloud behavior is intentionally manual:

- **Push device → cloud** uploads the current device state.
- **Pull cloud → device** replaces local state with the latest cloud backup.

The supplied `supabase/schema.sql` enables Row Level Security so authenticated users only access their own row.

## Local data and migration

V6 writes to `bagi-finance-os-v6`. On first load, it checks V5, V4, V3, and V2 if no V6 data exists. Existing finance data is normalized into V6 and split-bill fields are added. Export a full JSON backup from the existing app before updating.

The original V5 data is not deleted during migration. JSON export/import and optional Supabase push/pull include the split-bill draft and history. Receipt photos and raw OCR text only stay in the current tab session; they are not saved in backups.

## Receipt scanning implementation

`predev` and `prebuild` run `scripts/prepare-ocr.mjs`. This copies the pinned worker, WebAssembly variants, and English Latin-character recognition model from npm packages into `public/ocr`. The app lazy-loads its scanner and serves OCR assets from its own origin. The photo itself stays in browser memory and is passed to a local Web Worker; no recognition request or receipt photo goes to a third-party server.

Manual entry is available without an OCR service. First use of the scanner needs a connection to load its assets. Browser caches may allow later use without internet, but offline OCR is not guaranteed if storage is cleared or unavailable. Camera access requires HTTPS or localhost and browser permission. A native capture input and file upload remain available when the live camera is unsupported or denied.

Supported input: decodable images, up to 20 MB. The app reduces images to a maximum 2600-pixel longest edge before OCR. HEIC support depends on the browser; use JPG/PNG or a fresh camera photo if decoding fails. PDFs are not supported. Clear, straight receipts with Latin text and prices work best. Unusual layouts, item-level discounts, inclusive tax, handwritten or blurry receipts may require manual correction. Quantities are metadata: **line total already includes quantity and must not be multiplied again**.

All OCR results require human review. The parser uses the final amount on each item line, recognizes common Indonesian/English monetary separators, ignores payment/change rows, and extracts common totals. It does not guarantee perfect parsing. A supplied expected total must reconcile exactly before save/copy. Use explicit charge amounts where the receipt uses tax or discount rules outside the supported basis.

Bills calculate shares and repayments only; they do not transfer funds, confirm real payments, or automatically add transactions to the personal-finance ledger.

Technical references:
- https://github.com/naptha/tesseract.js/blob/master/docs/api.md
- https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture

## Validation

```bash
npm ci
npm test
npm run build
node tests/ocr-smoke.mjs
```

The OCR smoke test uses the deliberately synthetic `tests/fixtures/CONTOH-STRUK.png`. Run the build first to prepare recognition assets. TypeScript and production compilation, 15 groups of calculation/parser tests (including 1000 allocation cases), and actual image OCR passed during preparation. Physical camera permissions, real-device browser interactions, and mobile layout have not been tested in this environment.

## Privacy

By default, all finance data lives in the browser's `localStorage`.

That means:

- BAGI does not connect to your bank.
- BAGI does not send finance data anywhere by default.
- Clearing browser/site data can delete local finance data.
- Use **Export full JSON** before changing devices or clearing site storage.
- Cloud sync only activates when you configure your own Supabase project and sign in.

## Stack

- Next.js 16
- React 19
- TypeScript
- Plain CSS
- Browser LocalStorage
- Optional Supabase REST/Auth
- Vercel-ready

No UI framework and no chart dependency are required.

## Important note

BAGI is a budgeting and planning tool, not financial advice and not automatic bank synchronization. Balances are derived from the opening balances and transactions you enter.
