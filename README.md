# BAGI/ — Money, Before It Disappears

**BAGI/** is a bilingual, local-first personal finance OS with a little personality. It helps you split payday, set budgets, track money moves, build goals, manage recurring money, and see whether this month is still financially alive.

> Personal finance for people who do not want their money app to feel like homework.

## V3 highlights

- **Bahasa Indonesia + English** toggle from the top bar or Settings
- **Roast Mode**: optional dry / Gen-Z copy that can be turned off when you want the app to behave
- **Month Health Score** from budget usage, actual cashflow, savings rate, and emergency-fund progress
- **Safe to spend / day** based on remaining monthly budget and days left
- **Daily burn rate** and projected month-end spending
- **No-spend day counter**
- **Month-over-month expense delta**
- **Transaction search + type filters**
- Existing BAGI V2 local data automatically migrates to V3

## Core features

- Monthly control dashboard
- Total balance across multiple accounts
- Mandiri Utama default account + cash / e-wallet / savings / custom accounts
- Income, expense, and transfer ledger
- Activity calendar + day filtering
- Payday splitter with auto-balancing 100% sliders
- Lock individual payday buckets while redistributing the rest
- Multiple payday presets + payday history
- Editable bucket labels
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

BAGI/ is intentionally not written like a bank app.

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

English mode keeps the same dry tone instead of doing literal corporate translations.

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
git commit -m "feat: BAGI V3"
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

V3 uses:

```text
bagi-finance-os-v3
```

If V3 does not find that key, it also checks the old V2 key:

```text
bagi-finance-os-v2
```

The old state is normalized into the V3 schema automatically, adding language and Roast Mode defaults without deleting the user's finance data.

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
