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
