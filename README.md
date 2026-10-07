# BAGI DULU — Money, Before It Disappears

**BAGI DULU** is a bilingual, local-first personal finance OS with a little personality. It helps you split payday, set budgets, track money moves, build goals, manage recurring money, and see whether this month is still financially alive.

> Personal finance for people who do not want their money app to feel like homework.

## V5 highlights

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
git commit -m "feat: BAGI V4"
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

V4 uses:

```text
bagi-finance-os-v4
```

If V4 does not find that key, it also checks the old V2 key:

```text
bagi-finance-os-v2
```

The old state is normalized into the V4 schema automatically, adding language and Roast Mode defaults without deleting the user's finance data.

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
