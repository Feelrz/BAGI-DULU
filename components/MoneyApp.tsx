"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Theme = "dark" | "light";
type Language = "id" | "en";
type Tab = "overview" | "payday" | "transactions" | "goals" | "recurring" | "analytics" | "settings";
type TxType = "income" | "expense" | "transfer";
type AccountKind = "bank" | "cash" | "ewallet" | "savings";
type GoalKind = "emergency" | "goal";
type BucketId = "emergency" | "goals" | "hangout" | "impulse";

type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  openingBalance: number;
  archived: boolean;
};

type Category = {
  id: string;
  name: string;
  monthlyLimit: number;
  archived: boolean;
};

type Transaction = {
  id: string;
  date: string;
  type: TxType;
  amount: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  note: string;
  recurringId?: string;
  recurringPeriod?: string;
};

type RecurringRule = {
  id: string;
  name: string;
  type: Exclude<TxType, "transfer">;
  amount: number;
  day: number;
  accountId: string;
  categoryId?: string;
  active: boolean;
};

type Goal = {
  id: string;
  name: string;
  kind: GoalKind;
  current: number;
  target: number;
  monthlyContribution: number;
  targetDate: string;
  priority: "high" | "medium" | "low";
};

type Bucket = {
  id: BucketId;
  name: string;
  note: string;
  percent: number;
  locked: boolean;
};

type PaydayRun = {
  id: string;
  createdAt: string;
  income: number;
  reserve: number;
  distributable: number;
  buckets: Record<BucketId, number>;
};

type AppState = {
  version: 4;
  theme: Theme;
  language: Language;
  roastMode: boolean;
  selectedMonth: string;
  monthlyIncome: number;
  essentialReserve: number;
  buckets: Bucket[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: RecurringRule[];
  goals: Goal[];
  paydayHistory: PaydayRun[];
};

const STORAGE_KEY = "bagi-finance-os-v4";
const LEGACY_STORAGE_KEYS = ["bagi-finance-os-v3", "bagi-finance-os-v2"];
const CLOUD_SESSION_KEY = "bagi-cloud-session-v1";

const DEFAULT_BUCKETS: Bucket[] = [
  { id: "emergency", name: "Dana Darurat", note: "safety net / buffer", percent: 40, locked: false },
  { id: "goals", name: "Goals", note: "target, trip, gear, project", percent: 30, locked: false },
  { id: "hangout", name: "Nongkrong", note: "social / hangout budget", percent: 15, locked: false },
  { id: "impulse", name: "Impulsif", note: "boleh khilaf, tapi dibatasi", percent: 15, locked: false },
];

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "mandiri-main", name: "Mandiri Utama", kind: "bank", openingBalance: 0, archived: false },
  { id: "cash", name: "Cash", kind: "cash", openingBalance: 0, archived: false },
  { id: "ewallet", name: "E-Wallet", kind: "ewallet", openingBalance: 0, archived: false },
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: "food", name: "Makan", monthlyLimit: 0, archived: false },
  { id: "transport", name: "Transport", monthlyLimit: 0, archived: false },
  { id: "hangout", name: "Nongkrong", monthlyLimit: 0, archived: false },
  { id: "shopping", name: "Belanja", monthlyLimit: 0, archived: false },
  { id: "subscription", name: "Subscription", monthlyLimit: 0, archived: false },
  { id: "bills", name: "Bills", monthlyLimit: 0, archived: false },
  { id: "other", name: "Lainnya", monthlyLimit: 0, archived: false },
];

const DEFAULT_GOALS: Goal[] = [
  { id: "emergency-fund", name: "Dana Darurat", kind: "emergency", current: 0, target: 0, monthlyContribution: 0, targetDate: "", priority: "high" },
];

const PRESETS: Record<string, { label: string; caption: string; values: Record<BucketId, number> }> = {
  balanced: { label: "Balanced", caption: "Aman tapi tetap hidup.", values: { emergency: 40, goals: 30, hangout: 15, impulse: 15 } },
  safety: { label: "Safety First", caption: "Ngebut bikin safety net.", values: { emergency: 55, goals: 25, hangout: 10, impulse: 10 } },
  goals: { label: "Goal Hunter", caption: "Target besar didahulukan.", values: { emergency: 25, goals: 50, hangout: 15, impulse: 10 } },
  strict: { label: "No Nonsense", caption: "Lifestyle ditekan sementara.", values: { emergency: 60, goals: 35, hangout: 5, impulse: 0 } },
};

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function bi(language: Language, id: string, en: string) {
  return language === "id" ? id : en;
}

function bucketDisplayName(bucket: Bucket, language: Language) {
  if (language === "id") return bucket.name;
  const defaults: Record<BucketId, string> = { emergency: "Dana Darurat", goals: "Goals", hangout: "Nongkrong", impulse: "Impulsif" };
  const english: Record<BucketId, string> = { emergency: "Do Not Touch", goals: "Goals", hangout: "Going Out", impulse: "Allowed Bad Decisions" };
  return bucket.name === defaults[bucket.id] ? english[bucket.id] : bucket.name;
}

function bucketDisplayNote(bucket: Bucket, language: Language) {
  if (language === "id") return bucket.note;
  const notes: Record<BucketId, string> = {
    emergency: "emergency money. discounts do not count.",
    goals: "trip, gear, projects, future-you stuff.",
    hangout: "friends, coffee, and leaving the house.",
    impulse: "fun money with adult supervision.",
  };
  return notes[bucket.id];
}

function money(value: number, language: Language = "id") {
  return new Intl.NumberFormat(language === "id" ? "id-ID" : "en-US", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.round(value || 0));
}

function compactMoney(value: number, language: Language = "id") {
  return new Intl.NumberFormat(language === "id" ? "id-ID" : "en-US", { style: "currency", currency: "IDR", notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(value: string, language: Language = "id") {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function dateLabel(value: string, language: Language = "id") {
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}

function shiftMonth(value: string, delta: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKey(date);
}

function distributeInteger(total: number, source: Bucket[]) {
  if (!source.length) return [] as number[];
  const sourceTotal = source.reduce((sum, item) => sum + item.percent, 0);
  const raw = source.map((item) => (sourceTotal > 0 ? (total * item.percent) / sourceTotal : total / source.length));
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - floors[index] })).sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remainder; i += 1) floors[order[i % order.length].index] += 1;
  return floors;
}

function baseState(): AppState {
  return {
    version: 4,
    theme: "dark",
    language: "id",
    roastMode: true,
    selectedMonth: monthKey(),
    monthlyIncome: 0,
    essentialReserve: 0,
    buckets: DEFAULT_BUCKETS,
    accounts: DEFAULT_ACCOUNTS,
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    recurring: [],
    goals: DEFAULT_GOALS,
    paydayHistory: [],
  };
}

function normalizeState(input: Partial<AppState>): AppState | null {
  try {
    const defaults = baseState();
    const buckets = Array.isArray(input.buckets) ? input.buckets : defaults.buckets;
    const ids: BucketId[] = ["emergency", "goals", "hangout", "impulse"];
    if (!ids.every((id) => buckets.some((bucket) => bucket.id === id))) return null;
    const cleanedBuckets = ids.map((id) => {
      const item = buckets.find((bucket) => bucket.id === id)!;
      const fallback = defaults.buckets.find((bucket) => bucket.id === id)!;
      return {
        id,
        name: String(item.name || fallback.name).slice(0, 32),
        note: String(item.note || fallback.note).slice(0, 80),
        percent: clamp(Math.round(Number(item.percent) || 0), 0, 100),
        locked: Boolean(item.locked),
      };
    });
    if (cleanedBuckets.reduce((sum, item) => sum + item.percent, 0) !== 100) return null;

    const accounts = Array.isArray(input.accounts) && input.accounts.length ? input.accounts.map((a) => ({
      id: String(a.id || uid("acc")),
      name: String(a.name || "Account").slice(0, 40),
      kind: (["bank", "cash", "ewallet", "savings"].includes(a.kind) ? a.kind : "bank") as AccountKind,
      openingBalance: Number(a.openingBalance) || 0,
      archived: Boolean(a.archived),
    })) : defaults.accounts;

    let categories = Array.isArray(input.categories) && input.categories.length ? input.categories.map((c) => ({
      id: String(c.id || uid("cat")),
      name: String(c.name || "Category").slice(0, 40),
      monthlyLimit: Math.max(0, Number(c.monthlyLimit) || 0),
      archived: Boolean(c.archived),
    })) : defaults.categories;

    const transactions = Array.isArray(input.transactions) ? input.transactions.map((t) => ({
      id: String(t.id || uid("tx")),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(t.date)) ? String(t.date) : todayKey(),
      type: (["income", "expense", "transfer"].includes(t.type) ? t.type : "expense") as TxType,
      amount: Math.max(0, Number(t.amount) || 0),
      accountId: String(t.accountId || accounts[0].id),
      toAccountId: t.toAccountId ? String(t.toAccountId) : undefined,
      categoryId: t.categoryId ? String(t.categoryId) : undefined,
      note: String(t.note || "").slice(0, 120),
      recurringId: t.recurringId ? String(t.recurringId) : undefined,
      recurringPeriod: t.recurringPeriod ? String(t.recurringPeriod) : undefined,
    })) : [];

    const recurring = Array.isArray(input.recurring) ? input.recurring.map((r) => ({
      id: String(r.id || uid("rec")),
      name: String(r.name || "Recurring").slice(0, 60),
      type: (r.type === "income" ? "income" : "expense") as Exclude<TxType, "transfer">,
      amount: Math.max(0, Number(r.amount) || 0),
      day: clamp(Math.round(Number(r.day) || 1), 1, 28),
      accountId: String(r.accountId || accounts[0].id),
      categoryId: r.categoryId ? String(r.categoryId) : undefined,
      active: r.active !== false,
    })) : [];

    let goals = Array.isArray(input.goals) && input.goals.length ? input.goals.map((g) => ({
      id: String(g.id || uid("goal")),
      name: String(g.name || "Goal").slice(0, 50),
      kind: (g.kind === "emergency" ? "emergency" : "goal") as GoalKind,
      current: Math.max(0, Number(g.current) || 0),
      target: Math.max(0, Number(g.target) || 0),
      monthlyContribution: Math.max(0, Number(g.monthlyContribution) || 0),
      targetDate: /^\d{4}-\d{2}-\d{2}$/.test(String(g.targetDate || "")) ? String(g.targetDate) : "",
      priority: (["high", "medium", "low"].includes(g.priority) ? g.priority : "medium") as Goal["priority"],
    })) : defaults.goals;

    const paydayHistory = Array.isArray(input.paydayHistory) ? input.paydayHistory.slice(0, 80) as PaydayRun[] : [];
    const inputVersion = Number(input.version || 0);
    const legacyLooksUntouched = inputVersion < 4
      && transactions.length === 0
      && recurring.length === 0
      && paydayHistory.length === 0
      && accounts.every((account) => account.openingBalance === 0);

    let normalizedMonthlyIncome = Math.max(0, Number(input.monthlyIncome) || 0);
    let normalizedReserve = Math.max(0, Number(input.essentialReserve) || 0);

    // V2/V3 shipped with demo numbers. Strip only those exact seed values on an untouched profile,
    // while preserving anything the user actually typed (for example a Rp200k income test).
    if (legacyLooksUntouched) {
      if (normalizedMonthlyIncome === 6_000_000) normalizedMonthlyIncome = 0;
      if (normalizedReserve === 2_000_000) normalizedReserve = 0;

      const oldLimits: Record<string, number> = {
        food: 1_000_000,
        transport: 500_000,
        hangout: 600_000,
        shopping: 500_000,
        subscription: 250_000,
        bills: 1_000_000,
        other: 400_000,
      };
      categories = categories.map((category) => oldLimits[category.id] === category.monthlyLimit ? { ...category, monthlyLimit: 0 } : category);

      goals = goals
        .filter((goal) => !(goal.id === "main-goal" && goal.current === 0 && goal.target === 6_000_000 && goal.monthlyContribution === 750_000))
        .map((goal) => goal.id === "emergency-fund" && goal.current === 0 && goal.target === 12_000_000 && goal.monthlyContribution === 1_000_000
          ? { ...goal, target: 0, monthlyContribution: 0 }
          : goal);
    }

    // Reserve can never silently eat more than the income being allocated.
    normalizedReserve = normalizedMonthlyIncome > 0 ? Math.min(normalizedReserve, normalizedMonthlyIncome) : 0;

    return {
      version: 4,
      theme: input.theme === "light" ? "light" : "dark",
      language: input.language === "en" ? "en" : "id",
      roastMode: input.roastMode !== false,
      selectedMonth: /^\d{4}-\d{2}$/.test(String(input.selectedMonth)) ? String(input.selectedMonth) : defaults.selectedMonth,
      monthlyIncome: normalizedMonthlyIncome,
      essentialReserve: normalizedReserve,
      buckets: cleanedBuckets,
      accounts,
      categories,
      transactions,
      recurring,
      goals,
      paydayHistory,
    };
  } catch {
    return null;
  }
}

export default function MoneyApp() {
  const defaults = useMemo(() => baseState(), []);
  const [tab, setTab] = useState<Tab>("overview");
  const [theme, setTheme] = useState<Theme>(defaults.theme);
  const [language, setLanguage] = useState<Language>(defaults.language);
  const [roastMode, setRoastMode] = useState(defaults.roastMode);
  const [selectedMonth, setSelectedMonth] = useState(defaults.selectedMonth);
  const [monthlyIncome, setMonthlyIncome] = useState(defaults.monthlyIncome);
  const [essentialReserve, setEssentialReserve] = useState(defaults.essentialReserve);
  const [buckets, setBuckets] = useState<Bucket[]>(defaults.buckets);
  const [accounts, setAccounts] = useState<Account[]>(defaults.accounts);
  const [categories, setCategories] = useState<Category[]>(defaults.categories);
  const [transactions, setTransactions] = useState<Transaction[]>(defaults.transactions);
  const [recurring, setRecurring] = useState<RecurringRule[]>(defaults.recurring);
  const [goals, setGoals] = useState<Goal[]>(defaults.goals);
  const [paydayHistory, setPaydayHistory] = useState<PaydayRun[]>(defaults.paydayHistory);
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | TxType>("all");
  const [paydayAccountId, setPaydayAccountId] = useState(defaults.accounts[0]?.id || "");
  const importRef = useRef<HTMLInputElement>(null);

  const currentAppState = useMemo<AppState>(() => ({
    version: 4, theme, language, roastMode, selectedMonth, monthlyIncome, essentialReserve, buckets, accounts, categories, transactions, recurring, goals, paydayHistory,
  }), [theme, language, roastMode, selectedMonth, monthlyIncome, essentialReserve, buckets, accounts, categories, transactions, recurring, goals, paydayHistory]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
      if (raw) {
        const saved = normalizeState(JSON.parse(raw));
        if (saved) {
          setTheme(saved.theme);
          setLanguage(saved.language);
          setRoastMode(saved.roastMode);
          setSelectedMonth(saved.selectedMonth);
          setMonthlyIncome(saved.monthlyIncome);
          setEssentialReserve(saved.essentialReserve);
          setBuckets(saved.buckets);
          setAccounts(saved.accounts);
          setCategories(saved.categories);
          setTransactions(saved.transactions);
          setRecurring(saved.recurring);
          setGoals(saved.goals);
          setPaydayHistory(saved.paydayHistory);
        }
      }
    } catch {
      // Keep defaults when storage is unavailable or corrupt.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentAppState));
  }, [hydrated, currentAppState]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => setDayFilter(null), [selectedMonth]);

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const activeCategories = useMemo(() => categories.filter((c) => !c.archived), [categories]);

  useEffect(() => {
    if (!activeAccounts.length) return;
    if (!activeAccounts.some((account) => account.id === paydayAccountId)) setPaydayAccountId(activeAccounts[0].id);
  }, [activeAccounts, paydayAccountId]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const monthTransactions = useMemo(() => transactions.filter((tx) => tx.date.startsWith(selectedMonth)), [transactions, selectedMonth]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of monthTransactions) {
      if (tx.type === "income") income += tx.amount;
      if (tx.type === "expense") expense += tx.amount;
    }
    return { income, expense, net: income - expense, savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0 };
  }, [monthTransactions]);

  const balances = useMemo(() => {
    const map: Record<string, number> = Object.fromEntries(accounts.map((a) => [a.id, a.openingBalance]));
    for (const tx of transactions) {
      if (!(tx.accountId in map)) map[tx.accountId] = 0;
      if (tx.type === "income") map[tx.accountId] += tx.amount;
      if (tx.type === "expense") map[tx.accountId] -= tx.amount;
      if (tx.type === "transfer") {
        map[tx.accountId] -= tx.amount;
        if (tx.toAccountId) {
          if (!(tx.toAccountId in map)) map[tx.toAccountId] = 0;
          map[tx.toAccountId] += tx.amount;
        }
      }
    }
    return map;
  }, [accounts, transactions]);

  const totalBalance = useMemo(() => activeAccounts.reduce((sum, account) => sum + (balances[account.id] || 0), 0), [activeAccounts, balances]);

  const categorySpend = useMemo(() => {
    const spend: Record<string, number> = {};
    for (const tx of monthTransactions) if (tx.type === "expense" && tx.categoryId) spend[tx.categoryId] = (spend[tx.categoryId] || 0) + tx.amount;
    return spend;
  }, [monthTransactions]);

  const distributable = Math.max(0, monthlyIncome - essentialReserve);
  const allocation = useMemo(() => Object.fromEntries(buckets.map((b) => [b.id, (distributable * b.percent) / 100])) as Record<BucketId, number>, [buckets, distributable]);
  const plannedSavings = allocation.emergency + allocation.goals;
  const plannedFun = allocation.hangout + allocation.impulse;
  const budgetTotal = activeCategories.reduce((sum, c) => sum + c.monthlyLimit, 0);
  const spentAgainstBudget = activeCategories.reduce((sum, c) => sum + (categorySpend[c.id] || 0), 0);
  const budgetUsage = budgetTotal > 0 ? (spentAgainstBudget / budgetTotal) * 100 : 0;

  const monthTrend = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const key = shiftMonth(selectedMonth, index - 5);
    const txs = transactions.filter((tx) => tx.date.startsWith(key));
    const income = txs.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
    const expense = txs.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
    return { key, income, expense, net: income - expense };
  }), [selectedMonth, transactions]);

  const alerts = useMemo(() => {
    const items: string[] = [];
    activeCategories.forEach((category) => {
      const spent = categorySpend[category.id] || 0;
      if (category.monthlyLimit > 0 && spent > category.monthlyLimit) items.push(bi(language, `${category.name} kelewatan ${money(spent - category.monthlyLimit, language)}.`, `${category.name} is over by ${money(spent - category.monthlyLimit, language)}.`));
      else if (category.monthlyLimit > 0 && spent / category.monthlyLimit >= 0.8) items.push(bi(language, `${category.name} sudah ${Math.round((spent / category.monthlyLimit) * 100)}% dari batas.`, `${category.name} is already at ${Math.round((spent / category.monthlyLimit) * 100)}% of its limit.`));
    });
    if (totals.net < 0) items.push(bi(language, `Cashflow ${monthLabel(selectedMonth, language)} minus ${money(Math.abs(totals.net), language)}.`, `${monthLabel(selectedMonth, language)} cashflow is negative by ${money(Math.abs(totals.net), language)}.`));
    const emergency = goals.find((goal) => goal.kind === "emergency");
    if (emergency && emergency.target > 0 && emergency.current / emergency.target < 0.25) items.push(bi(language, "Dana darurat masih di bawah 25% target.", "Emergency fund is still below 25% of target."));
    if (items.length === 0) {
      const hasAnyMoneyData = monthTransactions.length > 0 || budgetTotal > 0 || totalBalance !== 0;
      items.push(hasAnyMoneyData
        ? bi(language, roastMode ? "Nggak ada red flag besar. Dompet masih punya denyut nadi." : "Nggak ada red flag besar bulan ini.", roastMode ? "No major red flags. Wallet still has a pulse." : "No major red flags this month.")
        : bi(language, roastMode ? "Belum cukup bukti buat nge-judge. Catat uang dulu." : "Belum cukup data keuangan.", roastMode ? "Not enough evidence to judge you yet. Add some money data first." : "Not enough financial data yet."));
    }
    return items.slice(0, 4);
  }, [activeCategories, budgetTotal, categorySpend, goals, language, monthTransactions.length, roastMode, selectedMonth, totalBalance, totals.net]);

  const previousMonth = shiftMonth(selectedMonth, -1);
  const previousTotals = useMemo(() => {
    const txs = transactions.filter((tx) => tx.date.startsWith(previousMonth));
    const income = txs.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
    const expense = txs.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
    return { income, expense, net: income - expense };
  }, [previousMonth, transactions]);

  const monthStats = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const current = monthKey() === selectedMonth;
    const elapsed = current ? Math.max(1, new Date().getDate()) : daysInMonth;
    const remainingDays = current ? Math.max(1, daysInMonth - new Date().getDate() + 1) : 1;
    const remainingBudget = Math.max(0, budgetTotal - spentAgainstBudget);
    const dailySafe = remainingBudget / remainingDays;
    const dailyBurn = totals.expense / elapsed;
    const projectedSpend = current ? dailyBurn * daysInMonth : totals.expense;
    const expenseDays = new Set(monthTransactions.filter((tx) => tx.type === "expense").map((tx) => Number(tx.date.slice(-2))));
    const noSpendDays = monthTransactions.length > 0 ? Math.max(0, elapsed - expenseDays.size) : 0;
    const emergency = goals.find((goal) => goal.kind === "emergency");
    const emergencyPct = emergency && emergency.target > 0 ? clamp((emergency.current / emergency.target) * 100, 0, 100) : 0;
    const hasHealthData = monthTransactions.length > 0 || budgetTotal > 0 || goals.some((goal) => goal.current > 0 || goal.target > 0);
    const budgetScore = budgetTotal <= 0 ? 70 : clamp(100 - Math.max(0, budgetUsage - 65) * 1.6, 0, 100);
    const cashflowScore = totals.income <= 0 ? 60 : clamp(55 + totals.savingsRate, 0, 100);
    const emergencyScore = clamp(emergencyPct, 0, 100);
    const healthScore = hasHealthData ? Math.round(budgetScore * 0.45 + cashflowScore * 0.35 + emergencyScore * 0.20) : null;
    const prevDelta = previousTotals.expense > 0 ? ((totals.expense - previousTotals.expense) / previousTotals.expense) * 100 : null;
    return { daysInMonth, elapsed, remainingDays, remainingBudget, dailySafe, dailyBurn, projectedSpend, noSpendDays, healthScore, prevDelta };
  }, [budgetTotal, budgetUsage, goals, monthTransactions, previousTotals.expense, selectedMonth, spentAgainstBudget, totals.expense, totals.income, totals.savingsRate]);

  const monthMood = useMemo(() => {
    if (!monthTransactions.length) return {
      title: bi(language, "masih bersih.", "fresh start."),
      copy: bi(language, roastMode ? "Belum ada transaksi. Entah disiplin, entah baru buka aplikasi." : "Belum ada transaksi bulan ini.", roastMode ? "No transactions yet. Either disciplined or you just opened the app." : "No transactions this month yet."),
    };
    if (budgetUsage > 110 || totals.net < 0) return {
      title: bi(language, "agak gawat.", "a little cooked."),
      copy: bi(language, roastMode ? "Angkanya mulai ngasih side-eye. Cek pengeluaran sebelum saldo ikut menghilang." : "Pengeluaran perlu dicek lagi bulan ini.", roastMode ? "The numbers are giving side-eye. Check spending before the balance disappears too." : "Spending needs another look this month."),
    };
    if (budgetUsage >= 80) return {
      title: bi(language, "mulai tipis.", "getting tight."),
      copy: bi(language, roastMode ? "Masih aman, tapi jangan tiba-tiba merasa kaya di minggu terakhir." : "Budget mulai mendekati batas.", roastMode ? "Still okay. Just don't suddenly feel rich in the final week." : "Budget is getting close to its limit."),
    };
    return {
      title: bi(language, "masih aman.", "still good."),
      copy: bi(language, roastMode ? "Uang masih punya tujuan. Rare sight, enjoy it." : "Cashflow dan budget masih dalam jalur.", roastMode ? "Your money still has a plan. Rare sight, enjoy it." : "Cashflow and budget are still on track."),
    };
  }, [budgetUsage, language, monthTransactions.length, roastMode, totals.net]);

  const filteredTransactions = useMemo(() => {
    const needle = txSearch.trim().toLowerCase();
    return monthTransactions.filter((tx) => {
      if (dayFilter && Number(tx.date.slice(-2)) !== dayFilter) return false;
      if (txTypeFilter !== "all" && tx.type !== txTypeFilter) return false;
      if (!needle) return true;
      const haystack = [tx.note, tx.type, accountMap.get(tx.accountId)?.name, tx.toAccountId ? accountMap.get(tx.toAccountId)?.name : "", tx.categoryId ? categoryMap.get(tx.categoryId)?.name : ""].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [accountMap, categoryMap, dayFilter, monthTransactions, txSearch, txTypeFilter]);

  function flash(message: string) {
    setToast(message);
  }

  function changeMonthlyIncome(raw: string) {
    const next = Math.max(0, Number(raw) || 0);
    setMonthlyIncome(next);
    setEssentialReserve((current) => next > 0 ? Math.min(current, next) : 0);
  }

  function changeEssentialReserve(raw: string) {
    const requested = Math.max(0, Number(raw) || 0);
    setEssentialReserve(monthlyIncome > 0 ? Math.min(requested, monthlyIncome) : 0);
  }

  function recordPaydayToBalance() {
    if (monthlyIncome <= 0) {
      flash(bi(language, "Masukin nominal gajian dulu.", "Enter your payday amount first."));
      return;
    }
    if (!paydayAccountId) {
      flash(bi(language, "Pilih rekening tujuan dulu.", "Choose a destination account first."));
      return;
    }
    const marker = `BAGI DULU · ${selectedMonth}`;
    const exists = transactions.some((tx) => tx.type === "income" && tx.accountId === paydayAccountId && tx.note === marker);
    if (exists) {
      flash(bi(language, "Gajian bulan ini sudah tercatat di rekening itu.", "This month's payday is already recorded in that account."));
      return;
    }
    const date = selectedMonth === monthKey() ? todayKey() : `${selectedMonth}-01`;
    setTransactions((current) => [{ id: uid("tx"), date, type: "income", amount: monthlyIncome, accountId: paydayAccountId, note: marker }, ...current]);
    const run: PaydayRun = {
      id: uid("payday"),
      createdAt: new Date().toISOString(),
      income: monthlyIncome,
      reserve: essentialReserve,
      distributable,
      buckets: Object.fromEntries(buckets.map((bucket) => [bucket.id, bucket.percent])) as Record<BucketId, number>,
    };
    setPaydayHistory((current) => [run, ...current].slice(0, 80));
    flash(bi(language, "Gajian masuk saldo + pembagian disimpan.", "Payday added to balance + split saved."));
  }

  function changePercent(id: BucketId, requested: number) {
    setBuckets((current) => {
      const changed = current.find((item) => item.id === id);
      if (!changed || changed.locked) return current;
      const lockedOthers = current.filter((item) => item.id !== id && item.locked);
      const adjustableOthers = current.filter((item) => item.id !== id && !item.locked);
      const lockedTotal = lockedOthers.reduce((sum, item) => sum + item.percent, 0);
      const max = Math.max(0, 100 - lockedTotal);
      const next = clamp(Math.round(requested || 0), 0, max);
      const remaining = 100 - lockedTotal - next;
      if (!adjustableOthers.length) return current.map((item) => item.id === id ? { ...item, percent: max } : item);
      const distribution = distributeInteger(remaining, adjustableOthers);
      return current.map((item) => {
        if (item.id === id) return { ...item, percent: next };
        const idx = adjustableOthers.findIndex((candidate) => candidate.id === item.id);
        return idx >= 0 ? { ...item, percent: distribution[idx] } : item;
      });
    });
  }

  function applyPreset(key: keyof typeof PRESETS) {
    const preset = PRESETS[key];
    setBuckets((current) => current.map((bucket) => ({ ...bucket, percent: preset.values[bucket.id], locked: false })));
    flash(bi(language, `${preset.label} dipakai`, `${preset.label} applied`));
  }

  function commitPayday() {
    const run: PaydayRun = {
      id: uid("payday"),
      createdAt: new Date().toISOString(),
      income: monthlyIncome,
      reserve: essentialReserve,
      distributable,
      buckets: Object.fromEntries(buckets.map((bucket) => [bucket.id, bucket.percent])) as Record<BucketId, number>,
    };
    setPaydayHistory((current) => [run, ...current].slice(0, 80));
    flash(bi(language, "Pembagian gajian disimpan", "Payday split saved"));
  }

  function addTransaction(payload: Omit<Transaction, "id">) {
    setTransactions((current) => [{ ...payload, id: uid("tx") }, ...current]);
    flash(payload.type === "income" ? bi(language, "Uang masuk dicatat", "Income added") : payload.type === "expense" ? bi(language, "Uang keluar dicatat", "Expense added") : bi(language, "Pindahan dicatat", "Transfer added"));
  }

  function deleteTransaction(id: string) {
    setTransactions((current) => current.filter((tx) => tx.id !== id));
  }

  function applyRecurringDue() {
    const [year, month] = selectedMonth.split("-").map(Number);
    const isCurrent = selectedMonth === monthKey();
    const cutoff = isCurrent ? new Date().getDate() : new Date(year, month, 0).getDate();
    const due = recurring.filter((rule) => rule.active && rule.day <= cutoff);
    const additions: Transaction[] = [];
    for (const rule of due) {
      if (transactions.some((tx) => tx.recurringId === rule.id && tx.recurringPeriod === selectedMonth)) continue;
      const lastDay = new Date(year, month, 0).getDate();
      const day = Math.min(rule.day, lastDay);
      additions.push({
        id: uid("tx"),
        date: `${selectedMonth}-${String(day).padStart(2, "0")}`,
        type: rule.type,
        amount: rule.amount,
        accountId: rule.accountId,
        categoryId: rule.type === "expense" ? rule.categoryId : undefined,
        note: rule.name,
        recurringId: rule.id,
        recurringPeriod: selectedMonth,
      });
    }
    if (!additions.length) return flash(bi(language, "Nggak ada recurring yang perlu diterapkan", "No unapplied recurring items due"));
    setTransactions((current) => [...additions, ...current]);
    flash(bi(language, `${additions.length} recurring diterapkan`, `${additions.length} recurring item applied`));
  }

  function exportJson() {
    downloadBlob(JSON.stringify(currentAppState, null, 2), "application/json", `bagi-dulu-backup-${todayKey()}.json`);
    flash(bi(language, "Backup lengkap diexport", "Full backup exported"));
  }

  function exportTransactionsCsv() {
    const rows = [
      ["Date", "Type", "Amount", "Account", "To Account", "Category", "Note"],
      ...transactions.map((tx) => [tx.date, tx.type, tx.amount, accountMap.get(tx.accountId)?.name || tx.accountId, tx.toAccountId ? accountMap.get(tx.toAccountId)?.name || tx.toAccountId : "", tx.categoryId ? categoryMap.get(tx.categoryId)?.name || tx.categoryId : "", tx.note]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadBlob(csv, "text/csv;charset=utf-8", `bagi-dulu-transactions-${todayKey()}.csv`);
    flash(bi(language, "CSV transaksi diexport", "Transactions CSV exported"));
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const state = normalizeState(JSON.parse(await file.text()));
      if (!state) throw new Error("Invalid");
      applyFullState(state);
      flash(bi(language, "Backup masuk. Welcome back.", "Backup imported. Welcome back."));
    } catch {
      flash(bi(language, "Import gagal — file BAGI nggak valid", "Import failed — invalid BAGI backup"));
    }
  }

  function applyFullState(state: AppState) {
    setTheme(state.theme);
    setLanguage(state.language);
    setRoastMode(state.roastMode);
    setSelectedMonth(state.selectedMonth);
    setMonthlyIncome(state.monthlyIncome);
    setEssentialReserve(state.essentialReserve);
    setBuckets(state.buckets);
    setAccounts(state.accounts);
    setCategories(state.categories);
    setTransactions(state.transactions);
    setRecurring(state.recurring);
    setGoals(state.goals);
    setPaydayHistory(state.paydayHistory);
  }

  function resetAll() {
    if (!window.confirm(bi(language, "Reset seluruh data BAGI di browser ini? Ini nggak bisa di-undo.", "Reset all BAGI data in this browser? This cannot be undone."))) return;
    const state = baseState();
    setTheme(state.theme);
    setLanguage(state.language);
    setRoastMode(state.roastMode);
    setSelectedMonth(state.selectedMonth);
    setMonthlyIncome(state.monthlyIncome);
    setEssentialReserve(state.essentialReserve);
    setBuckets(state.buckets);
    setAccounts(state.accounts);
    setCategories(state.categories);
    setTransactions([]);
    setRecurring([]);
    setGoals(state.goals);
    setPaydayHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    flash(bi(language, "BAGI balik ke nol", "BAGI reset complete"));
  }

  const donutStyle = {
    background: `conic-gradient(var(--c1) 0 ${buckets[0].percent}%, var(--c2) ${buckets[0].percent}% ${buckets[0].percent + buckets[1].percent}%, var(--c3) ${buckets[0].percent + buckets[1].percent}% ${buckets[0].percent + buckets[1].percent + buckets[2].percent}%, var(--c4) ${buckets[0].percent + buckets[1].percent + buckets[2].percent}% 100%)`,
  } as React.CSSProperties;

  const navigation: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "payday", label: "Payday" },
    { id: "transactions", label: "Transactions" },
    { id: "goals", label: "Goals" },
    { id: "recurring", label: "Recurring" },
    { id: "analytics", label: "Analytics" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <main className="app-shell" id="top">
      <div className="noise" aria-hidden="true" />
      <header className="topbar">
        <button className="brand brand-button" type="button" onClick={() => setTab("overview")} aria-label="BAGI overview">
          <span className="brand-mark">B</span>
          <span><strong>BAGI DULU</strong><small>{bi(language, "uang lo, tapi lebih niat", "money, but with a plan")}</small></span>
        </button>
        <div className="top-month">
          <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} aria-label={bi(language, "Bulan sebelumnya", "Previous month")}>←</button>
          <button type="button" className="month-label" onClick={() => setSelectedMonth(monthKey())}>{monthLabel(selectedMonth, language)}</button>
          <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} aria-label={bi(language, "Bulan berikutnya", "Next month")}>→</button>
        </div>
        <div className="top-actions">
          <div className="lang-toggle" aria-label={bi(language, "Pilih bahasa", "Choose language")}>
            <button type="button" className={language === "id" ? "active" : ""} onClick={() => setLanguage("id")}>ID</button>
            <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
          </div>
          <button className="ghost-btn" type="button" onClick={() => setTab("transactions")}>{bi(language, "+ CATAT UANG", "+ ADD MONEY MOVE")}</button>
          <button className="icon-btn" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={bi(language, "Ganti tema", "Toggle theme")}>{theme === "dark" ? "☼" : "◐"}</button>
        </div>
      </header>

      <nav className="tabs" aria-label={bi(language, "Bagian aplikasi", "App sections")}>
        {navigation.map((item) => {
          const labels: Record<Tab, [string, string]> = {
            overview: ["Bulan Ini", "This Month"], payday: ["Bagi Gajian", "Payday"], transactions: ["Uangnya Ke Mana?", "Money Moves"], goals: ["Lagi Ngejar", "Goals"], recurring: ["Datang Lagi", "Recurring"], analytics: ["Cek Pola", "Patterns"], settings: ["Atur", "Settings"],
          };
          return <button key={item.id} className={tab === item.id ? "tab active" : "tab"} type="button" onClick={() => setTab(item.id)}>{bi(language, labels[item.id][0], labels[item.id][1])}</button>;
        })}
      </nav>

      {tab === "overview" && (
        <section className="page">
          <div className="overview-hero mood-hero">
            <div>
              <span className="eyebrow">BAGI DULU · MONTH CHECK</span>
              <h1>{bi(language, "bulan ini ", "this month: ")}<em>{monthMood.title}</em></h1>
              <p>{monthMood.copy}</p>
              <div className="mood-meta"><span>{bi(language, "MONEY HEALTH", "MONEY HEALTH")}</span><strong>{monthStats.healthScore === null ? "—" : `${monthStats.healthScore}/100`}</strong><i>{monthStats.healthScore === null ? bi(language, "belum cukup data", "not enough data") : monthStats.healthScore >= 80 ? bi(language, "rapi", "clean") : monthStats.healthScore >= 60 ? bi(language, "masih waras", "holding up") : bi(language, "butuh perhatian", "needs attention")}</i></div>
            </div>
            <article className="hero-balance">
              <span>{bi(language, "uang sekarang", "money right now")}</span>
              <strong>{money(totalBalance, language)}</strong>
              <small>{activeAccounts.length} {bi(language, "tempat uang aktif", "active money spots")}</small>
            </article>
          </div>

          <div className="metric-grid four">
            <Metric label={bi(language, "Uang masuk", "Money in")} value={money(totals.income, language)} sub={monthLabel(selectedMonth, language)} tone="positive" />
            <Metric label={bi(language, "Uang keluar", "Money out")} value={money(totals.expense, language)} sub={`${monthTransactions.filter((t) => t.type === "expense").length} ${bi(language, "transaksi", "transactions")}`} tone="negative" />
            <Metric label={bi(language, "Sisa cashflow", "Net cashflow")} value={money(totals.net, language)} sub={totals.net >= 0 ? bi(language, "masih napas", "still breathing") : bi(language, "minus, noted", "negative, noted")} tone={totals.net >= 0 ? "positive" : "negative"} />
            <Metric label={bi(language, "Jatah kepakai", "Budget used")} value={budgetTotal > 0 ? `${Math.round(budgetUsage)}%` : "—"} sub={budgetTotal > 0 ? `${money(spentAgainstBudget, language)} / ${money(budgetTotal, language)}` : bi(language, "atur batas dulu", "set your limits first")} tone={budgetUsage > 100 ? "negative" : "neutral"} />
          </div>

          <div className="pulse-grid">
            <article className="pulse-card"><span>{bi(language, "aman dibelanjain / hari", "safe to spend / day")}</span><strong>{budgetTotal > 0 ? money(monthStats.dailySafe, language) : "—"}</strong><small>{budgetTotal > 0 ? bi(language, `${monthStats.remainingDays} hari tersisa`, `${monthStats.remainingDays} days left`) : bi(language, "set budget dulu", "set a budget first")}</small></article>
            <article className="pulse-card"><span>{bi(language, "burn rate harian", "daily burn rate")}</span><strong>{monthTransactions.length ? money(monthStats.dailyBurn, language) : "—"}</strong><small>{monthTransactions.length ? bi(language, "rata-rata sejauh ini", "average so far") : bi(language, "belum ada transaksi", "no transactions yet")}</small></article>
            <article className="pulse-card"><span>{bi(language, "hari tanpa belanja", "no-spend days")}</span><strong>{monthTransactions.length ? monthStats.noSpendDays : "—"}</strong><small>{monthTransactions.length ? bi(language, roastMode ? "small win, tetap dihitung" : "bulan ini", roastMode ? "small win, still counts" : "this month") : bi(language, "mulai catat dulu", "start tracking first")}</small></article>
            <article className="pulse-card"><span>{bi(language, "proyeksi keluar", "projected spend")}</span><strong>{monthTransactions.length ? money(monthStats.projectedSpend, language) : "—"}</strong><small>{!monthTransactions.length ? bi(language, "belum cukup data", "not enough data") : monthStats.prevDelta === null ? bi(language, "belum ada pembanding", "no comparison yet") : `${monthStats.prevDelta >= 0 ? "+" : ""}${Math.round(monthStats.prevDelta)}% ${bi(language, "vs bulan lalu", "vs last month")}`}</small></article>
          </div>

          <div className="dashboard-grid">
            <article className="panel account-panel">
              <div className="panel-head"><div><span className="eyebrow">{bi(language, "UANG LO TINGGAL DI SINI", "WHERE THE MONEY LIVES")}</span><h2>{bi(language, "rekening & dompet.", "accounts & wallets.")}</h2></div><button type="button" className="text-btn" onClick={() => setTab("settings")}>{bi(language, "Atur →", "Manage →")}</button></div>
              <div className="account-list">{activeAccounts.map((account) => <div className="account-row" key={account.id}><div><i>{account.kind}</i><b>{account.name}</b></div><strong>{money(balances[account.id] || 0, language)}</strong></div>)}</div>
            </article>

            <article className="panel alert-panel">
              <div className="panel-head"><div><span className="eyebrow">MONEY RADAR</span><h2>{bi(language, "yang perlu dilirik.", "worth a look.")}</h2></div></div>
              <div className="alert-list">{alerts.map((alert, index) => <div key={`${alert}-${index}`}><span>0{index + 1}</span><p>{alert}</p></div>)}</div>
            </article>
          </div>

          <div className="dashboard-grid lower">
            <article className="panel">
              <div className="panel-head"><div><span className="eyebrow">{bi(language, "JATAH HIDUP", "BUDGET CHECK")}</span><h2>{bi(language, "berapa yang udah kepake.", "what's already gone.")}</h2></div><button className="text-btn" type="button" onClick={() => setTab("analytics")}>{bi(language, "Bedah →", "Details →")}</button></div>
              {budgetTotal > 0 ? <div className="budget-list compact">{activeCategories.slice(0, 6).map((category) => { const spent = categorySpend[category.id] || 0; const pct = category.monthlyLimit > 0 ? (spent / category.monthlyLimit) * 100 : 0; return <BudgetBar key={category.id} name={category.name} spent={spent} limit={category.monthlyLimit} percent={pct} language={language} />; })}</div> : <p className="muted-empty">{bi(language, "Belum ada jatah bulanan. Atur batas kategori dulu biar radar budget mulai kerja.", "No monthly limits yet. Set category budgets first so the budget radar can do its thing.")}</p>}
            </article>

            <article className="panel">
              <div className="panel-head"><div><span className="eyebrow">{bi(language, "BARU KEJADIAN", "RECENT MOVES")}</span><h2>{bi(language, "uangnya barusan ke mana?", "where did it just go?")}</h2></div><button className="text-btn" type="button" onClick={() => setTab("transactions")}>{bi(language, "Semua →", "All →")}</button></div>
              <div className="mini-tx-list">{monthTransactions.slice(0, 6).map((tx) => <MiniTransaction key={tx.id} tx={tx} accountMap={accountMap} categoryMap={categoryMap} language={language} />)}{monthTransactions.length === 0 && <p className="muted-empty">{bi(language, roastMode ? "Masih bersih. Mencurigakan, tapi bagus." : "Belum ada transaksi bulan ini.", roastMode ? "Still clean. Suspicious, but good." : "No transactions this month yet.")}</p>}</div>
            </article>
          </div>
        </section>
      )}

      {tab === "payday" && (
        <section className="page">
          <div className="section-heading first-heading"><div><span className="eyebrow">{bi(language, "GAJIAN TURUN", "PAYDAY MODE")}</span><h1 className="page-title">{bi(language, "bagi dulu sebelum hilang sendiri.", "split it before it disappears.")}</h1></div><p>{bi(language, "Sisihin yang wajib, kasih tujuan ke sisanya, baru silakan hidup.", "Cover the essentials, give the rest a job, then go live your life.")}</p></div>

          <div className="payday-hero">
            <label className="big-input"><span>{bi(language, "Uang masuk bulan ini", "Monthly take-home")}</span><div><b>Rp</b><input type="number" min={0} step={50_000} placeholder="0" value={monthlyIncome || ""} onChange={(e) => changeMonthlyIncome(e.target.value)} /></div><small>{bi(language, "Begitu diketik, semua nominal pembagian langsung ikut berubah.", "Every allocation updates instantly as you type.")}</small></label>
            <label className="big-input"><span>{bi(language, "Yang wajib dulu · opsional", "Essentials reserve · optional")}</span><div><b>Rp</b><input type="number" min={0} max={monthlyIncome || undefined} step={50_000} placeholder="0" value={essentialReserve || ""} onChange={(e) => changeEssentialReserve(e.target.value)} /></div><small>{bi(language, "Nggak bisa lebih besar dari uang masuk. Jadi nggak ada lagi Rp0 misterius.", "Never exceeds your income, so no more mystery Rp0.")}</small></label>
            <article className="distributable-card"><span>{bi(language, "siap dibagi", "ready to split")}</span><strong>{money(distributable, language)}</strong><small>{monthlyIncome > 0 ? `${Math.round((distributable / monthlyIncome) * 100)}% ${bi(language, "dari pemasukan", "of income")}` : "0%"}</small></article>
          </div>

          <div className="payday-layout">
            <article className="donut-card payday-donut"><div className="donut" style={donutStyle}><div className="donut-hole"><small>{bi(language, "SIAP", "READY")}</small><strong>100%</strong><span>{compactMoney(distributable, language)}</span></div></div><div className="legend">{buckets.map((bucket, index) => <div key={bucket.id}><i className={`dot c${index + 1}`} /><span>{bucketDisplayName(bucket, language)}</span><b>{bucket.percent}%</b></div>)}</div></article>
            <div className="preset-grid payday-presets">{Object.entries(PRESETS).map(([key, preset]) => { const copy: Record<string, [string, string]> = { balanced: ["Aman tapi masih hidup.", "Responsible, still alive."], safety: ["Safety net dulu. Flex belakangan.", "Safety net first. Flex later."], goals: ["Target dulu. Dopamine nanti.", "Goal first. Dopamine later."], strict: ["Mode jangan macam-macam.", "No-nonsense mode."] }; return <button type="button" className="preset-card" key={key} onClick={() => applyPreset(key as keyof typeof PRESETS)}><span>{preset.label}</span><small>{bi(language, copy[key][0], copy[key][1])}</small><b>↗</b></button>; })}</div>
          </div>

          <div className="bucket-stack">{buckets.map((bucket, index) => (
            <article className="bucket-card" key={bucket.id}><div className="bucket-index">0{index + 1}</div><div className="bucket-main"><div className="bucket-title-row"><div><h3>{bucketDisplayName(bucket, language)}</h3><p>{bucketDisplayNote(bucket, language)}</p></div><div className="bucket-amount"><strong>{money(allocation[bucket.id], language)}</strong><span>{bucket.percent}%</span></div></div><div className="range-row"><input type="range" min={0} max={100} value={bucket.percent} disabled={bucket.locked} onChange={(e) => changePercent(bucket.id, Number(e.target.value))} /><input className="pct-input" type="number" min={0} max={100} value={bucket.percent} disabled={bucket.locked} onChange={(e) => changePercent(bucket.id, Number(e.target.value))} /><span className="pct-sign">%</span><button type="button" className={bucket.locked ? "lock-btn locked" : "lock-btn"} onClick={() => setBuckets((current) => current.map((item) => item.id === bucket.id ? { ...item, locked: !item.locked } : item))}>{bucket.locked ? bi(language, "DIKUNCI", "LOCKED") : bi(language, "KUNCI", "LOCK")}</button></div></div></article>
          ))}</div>

          <div className="summary-panel"><div><span>{bi(language, "Jangan disentuh", "Do not touch")}</span><strong>{money(allocation.emergency, language)}</strong></div><div><span>{bi(language, "Lagi ngejar", "Goals")}</span><strong>{money(allocation.goals, language)}</strong></div><div><span>{bi(language, "Boleh khilaf", "Fun money")}</span><strong>{money(plannedFun, language)}</strong></div><div><span>{bi(language, "Buat nanti", "Planned savings")}</span><strong>{money(plannedSavings, language)}</strong></div></div>
          <div className="payday-actions payday-actions-v4"><button className="primary-btn" type="button" onClick={commitPayday}>{bi(language, "SIMPAN RENCANA", "SAVE PLAN")}</button><div className="payday-record"><select aria-label={bi(language, "Rekening tujuan gajian", "Payday destination account")} value={paydayAccountId} onChange={(e) => setPaydayAccountId(e.target.value)}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><button className="ghost-btn" type="button" disabled={!activeAccounts.length || monthlyIncome <= 0} onClick={recordPaydayToBalance}>{bi(language, "CATAT GAJIAN KE SALDO", "ADD PAYDAY TO BALANCE")}</button></div><small>{bi(language, "Pembagian di atas adalah rencana. Kalau mau angka di Bulan Ini ikut berubah, catat gajian ke saldo.", "The split above is a plan. To update This Month and your balance, add payday to an account.")}</small></div>

          {paydayHistory.length > 0 && <div className="history-list compact-history"><div className="panel-head"><div><span className="eyebrow">{bi(language, "RIWAYAT GAJIAN", "PAYDAY HISTORY")}</span><h2>{bi(language, "pernah dibagi begini.", "recent splits.")}</h2></div></div>{paydayHistory.slice(0, 6).map((run) => <article className="history-card" key={run.id}><div><span>{new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.createdAt))}</span><strong>{money(run.distributable, language)} {bi(language, "dibagi", "split")}</strong></div><div className="history-pills"><i>E {run.buckets.emergency}%</i><i>G {run.buckets.goals}%</i><i>N {run.buckets.hangout}%</i><i>I {run.buckets.impulse}%</i></div><div className="history-actions"><button type="button" onClick={() => setPaydayHistory((current) => current.filter((x) => x.id !== run.id))}>{bi(language, "Hapus", "Delete")}</button></div></article>)}</div>}
        </section>
      )}

      {tab === "transactions" && (
        <section className="page">
          <div className="section-heading first-heading"><div><span className="eyebrow">{bi(language, "UANGNYA KE MANA?", "MONEY MOVES")}</span><h1 className="page-title">{bi(language, "semua gerak-gerik duit, kelihatan.", "every move, accounted for.")}</h1></div><p>{bi(language, "Masuk, keluar, pindahan. Nggak ada lagi transaksi jadi urban legend.", "Income, expense, transfers. No more mystery transactions.")}</p></div>
          <TransactionComposer accounts={activeAccounts} categories={activeCategories} onAdd={addTransaction} language={language} />
          <div className="tx-toolbar"><input value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder={bi(language, "cari tersangka...", "search the suspects...")} /><div className="tx-filter">{(["all", "expense", "income", "transfer"] as const).map((value) => <button type="button" key={value} className={txTypeFilter === value ? "active" : ""} onClick={() => setTxTypeFilter(value)}>{value === "all" ? bi(language, "semua", "all") : value}</button>)}</div></div>
          <div className="transactions-grid">
            <CalendarPanel selectedMonth={selectedMonth} transactions={monthTransactions} selectedDay={dayFilter} onSelectDay={setDayFilter} language={language} />
            <article className="panel ledger-panel"><div className="panel-head"><div><span className="eyebrow">{dayFilter ? `${bi(language, "TANGGAL", "DAY")} ${dayFilter}` : bi(language, "BULAN", "MONTH")}</span><h2>{dayFilter ? `${dayFilter} ${monthLabel(selectedMonth, language)}` : monthLabel(selectedMonth, language)}</h2></div>{dayFilter && <button className="text-btn" type="button" onClick={() => setDayFilter(null)}>{bi(language, "Hapus filter", "Clear filter")}</button>}</div><div className="ledger-list">{filteredTransactions.map((tx) => <LedgerRow key={tx.id} tx={tx} accountMap={accountMap} categoryMap={categoryMap} onDelete={() => deleteTransaction(tx.id)} language={language} />)}{filteredTransactions.length === 0 && <p className="muted-empty">{bi(language, roastMode ? "Nggak ketemu. Tersangkanya punya alibi." : "Tidak ada transaksi yang cocok.", roastMode ? "Nothing found. The suspect has an alibi." : "No matching transactions.")}</p>}</div></article>
          </div>
        </section>
      )}

      {tab === "goals" && (
        <section className="page">
          <div className="section-heading first-heading"><div><span className="eyebrow">{bi(language, "LAGI NGEJAR", "GOAL ENGINE")}</span><h1 className="page-title">{bi(language, "future you lagi nabung.", "make future money visible.")}</h1></div><button className="primary-btn" type="button" onClick={() => setGoals((current) => [...current, { id: uid("goal"), name: bi(language, "Target Baru", "New Goal"), kind: "goal", current: 0, target: 0, monthlyContribution: 0, targetDate: "", priority: "medium" }])}>{bi(language, "+ TAMBAH TARGET", "+ ADD GOAL")}</button></div>
          <div className="goal-grid">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} onChange={(next) => setGoals((current) => current.map((item) => item.id === goal.id ? next : item))} onDelete={goal.kind === "emergency" ? undefined : () => setGoals((current) => current.filter((item) => item.id !== goal.id))} language={language} />)}</div>
        </section>
      )}

      {tab === "recurring" && (
        <section className="page">
          <div className="section-heading first-heading"><div><span className="eyebrow">{bi(language, "DATANG LAGI", "AUTOPILOT")}</span><h1 className="page-title">{bi(language, "tagihan emang konsisten banget.", "recurring money, minus the forgetting.")}</h1></div><button className="primary-btn" type="button" onClick={applyRecurringDue}>{bi(language, `TERAPKAN YANG JATUH TEMPO · ${monthLabel(selectedMonth, language)}`, `APPLY DUE · ${monthLabel(selectedMonth, language)}`)}</button></div>
          <RecurringComposer accounts={activeAccounts} categories={activeCategories} onAdd={(rule) => { setRecurring((current) => [rule, ...current]); flash(bi(language, "Recurring ditambah", "Recurring rule added")); }} language={language} />
          <div className="recurring-list">{recurring.map((rule) => <article className="recurring-card" key={rule.id}><div className="recurring-day"><span>{bi(language, "TGL", "DAY")}</span><b>{rule.day}</b></div><div className="recurring-copy"><div><strong>{rule.name}</strong><span>{rule.type} · {accountMap.get(rule.accountId)?.name || bi(language, "Akun nggak dikenal", "Unknown account")}{rule.categoryId ? ` · ${categoryMap.get(rule.categoryId)?.name || bi(language, "Kategori", "Category")}` : ""}</span></div><b className={rule.type === "income" ? "positive" : "negative"}>{rule.type === "income" ? "+" : "−"}{money(rule.amount, language)}</b></div><div className="recurring-actions"><button type="button" className={rule.active ? "status-btn active" : "status-btn"} onClick={() => setRecurring((current) => current.map((item) => item.id === rule.id ? { ...item, active: !item.active } : item))}>{rule.active ? bi(language, "AKTIF", "ACTIVE") : bi(language, "PAUSE", "PAUSED")}</button><button type="button" className="icon-danger" onClick={() => setRecurring((current) => current.filter((item) => item.id !== rule.id))}>×</button></div></article>)}{recurring.length === 0 && <div className="empty-state"><b>{bi(language, "BELUM ADA YANG BALIK LAGI.", "NO RECURRING RULES.")}</b><p>{bi(language, "Masukin gaji, subscription, kos, tagihan, atau hal yang rajin datang tiap bulan.", "Add salary, subscriptions, rent, bills, or anything that reliably comes back every month.")}</p></div>}</div>
        </section>
      )}

      {tab === "analytics" && (
        <section className="page">
          <div className="section-heading first-heading"><div><span className="eyebrow">{bi(language, "CEK POLA", "PATTERNS")}</span><h1 className="page-title">{bi(language, "lihat kebiasaan sebelum jadi kebiasaan buruk.", "see the pattern before it becomes a habit.")}</h1></div><p>{bi(language, "Plan vs actual, tren enam bulan, dan kategori mana yang paling haus uang.", "Plan vs actual, six-month trends, and which categories are drinking the budget.")}</p></div>
          <div className="metric-grid four"><Metric label={bi(language, "Uang masuk", "Actual income")} value={money(totals.income, language)} sub={bi(language, "bulan ini", "this month")} tone="positive" /><Metric label={bi(language, "Uang keluar", "Actual spend")} value={money(totals.expense, language)} sub={bi(language, "bulan ini", "this month")} tone="negative" /><Metric label="Net" value={money(totals.net, language)} sub={`${Math.round(totals.savingsRate)}% ${bi(language, "saving rate aktual", "actual savings rate")}`} tone={totals.net >= 0 ? "positive" : "negative"} /><Metric label={bi(language, "Plan: simpan", "Plan: save")} value={money(plannedSavings, language)} sub={`${buckets[0].percent + buckets[1].percent}% ${bi(language, "dari uang siap dibagi", "of distributable")}`} tone="neutral" /></div>
          <article className="panel trend-panel"><div className="panel-head"><div><span className="eyebrow">{bi(language, "TREN 6 BULAN", "6 MONTH TREND")}</span><h2>{bi(language, "masuk vs keluar.", "income vs spending.")}</h2></div></div><TrendChart data={monthTrend} language={language} /></article>
          <div className="analytics-grid"><article className="panel"><div className="panel-head"><div><span className="eyebrow">{bi(language, "BATAS JATAH", "BUDGET LIMITS")}</span><h2>{bi(language, "kategori mana yang mulai nakal.", "category health.")}</h2></div></div><div className="budget-list">{activeCategories.map((category) => { const spent = categorySpend[category.id] || 0; const pct = category.monthlyLimit > 0 ? (spent / category.monthlyLimit) * 100 : 0; return <BudgetBar key={category.id} name={category.name} spent={spent} limit={category.monthlyLimit} percent={pct} language={language} />; })}</div></article><article className="panel"><div className="panel-head"><div><span className="eyebrow">{bi(language, "DUITNYA KE SINI", "SPENDING MIX")}</span><h2>{bi(language, "siapa yang paling banyak makan budget.", "where it went.")}</h2></div></div><SpendingMix categories={activeCategories} categorySpend={categorySpend} language={language} /></article></div>
        </section>
      )}

      {tab === "settings" && (
        <section className="page">
          <div className="section-heading first-heading"><div><span className="eyebrow">BAGI DULU · SYSTEM</span><h1 className="page-title">{bi(language, "atur yang ngatur uang.", "control the control panel.")}</h1></div><p>{bi(language, "Bahasa, personality, rekening, budget, backup, dan cloud. Semua yang nerdy ada di sini.", "Language, personality, accounts, budgets, backup, and cloud. All the nerdy stuff lives here.")}</p></div>
          <div className="settings-grid wide-settings">
            <article className="settings-card personality-card"><h2>{bi(language, "Bahasa & personality", "Language & personality")}</h2><p>{bi(language, "Dua bahasa. Satu dompet. Humor bisa dimatiin kalau lagi pengen serius.", "Two languages. One wallet. Turn the jokes off when you need the app to behave.")}</p><div className="settings-choice"><span>{bi(language, "Bahasa", "Language")}</span><div className="lang-toggle large"><button type="button" className={language === "id" ? "active" : ""} onClick={() => setLanguage("id")}>Indonesia</button><button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button></div></div><div className="settings-choice"><span>{bi(language, "Roast mode", "Roast mode")}</span><button className={roastMode ? "status-btn active" : "status-btn"} type="button" onClick={() => setRoastMode((value) => !value)}>{roastMode ? bi(language, "NYALA", "ON") : bi(language, "TENANG", "OFF")}</button></div></article>
            <AccountSettings accounts={accounts} balances={balances} onChange={setAccounts} language={language} />
            <CategorySettings categories={categories} onChange={setCategories} language={language} />
            <article className="settings-card"><h2>{bi(language, "Nama bucket gajian", "Payday bucket labels")}</h2><p>{bi(language, "Mau ganti 'Impulsif' jadi 'Kebodohan Terencana'? Silakan.", "Rename 'Fun Money' to 'Planned Bad Decisions' if that's more accurate.")}</p><div className="rename-list">{buckets.map((bucket) => <label key={bucket.id}><span>{bucket.id}</span><input value={bucket.name} onChange={(e) => setBuckets((current) => current.map((item) => item.id === bucket.id ? { ...item, name: e.target.value.slice(0, 32) } : item))} /></label>)}</div></article>
            <article className="settings-card"><h2>{bi(language, "Backup & kabur", "Backup & export")}</h2><p>{bi(language, "JSON buat seluruh state. CSV buat dibawa ke spreadsheet kalau tiba-tiba kangen Excel.", "JSON keeps the whole app state. CSV is for when you suddenly miss spreadsheets.")}</p><div className="button-column"><button className="primary-btn" type="button" onClick={exportJson}>{bi(language, "EXPORT SEMUA JSON", "EXPORT FULL JSON")}</button><button className="ghost-btn wide" type="button" onClick={exportTransactionsCsv}>{bi(language, "EXPORT TRANSAKSI CSV", "EXPORT TRANSACTIONS CSV")}</button><button className="ghost-btn wide" type="button" onClick={() => importRef.current?.click()}>{bi(language, "IMPORT BACKUP BAGI", "IMPORT BAGI BACKUP")}</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={importJson} /></div></article>
            <article className="settings-card"><h2>{bi(language, "Privasi & penyimpanan", "Privacy & storage")}</h2><p>{bi(language, "Default-nya local-first. Data tinggal di browser kecuali kamu sendiri nyalain cloud sync.", "Local-first by default. Data stays in the browser unless you explicitly enable cloud sync.")}</p><div className="privacy-stamp">LOCAL FIRST <span>✓</span></div></article>
            <CloudSyncCard state={currentAppState} onApply={applyFullState} flash={flash} language={language} />
            <article className="settings-card danger-card"><h2>{bi(language, "Zona jangan iseng", "Danger zone")}</h2><p>{bi(language, "Ini ngehapus transaksi, akun, goals, recurring, payday history, dan semua setting lokal.", "This removes transactions, accounts, goals, recurring rules, payday history, and all local settings.")}</p><button className="danger-btn" type="button" onClick={resetAll}>{bi(language, "RESET SEMUANYA", "RESET EVERYTHING")}</button></article>
          </div>
        </section>
      )}

      <footer className="footer"><span>BAGI DULU V4.0</span><p>{bi(language, "money, before it disappears · local-first · bilingual · PWA-ready", "money, before it disappears · local-first · bilingual · PWA-ready")}</p></footer>
      <div className={toast ? "toast show" : "toast"} role="status" aria-live="polite">{toast}</div>
    </main>
  );
}


function downloadBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "positive" | "negative" | "neutral" }) {
  return <article className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></article>;
}

function MiniTransaction({ tx, accountMap, categoryMap, language }: { tx: Transaction; accountMap: Map<string, Account>; categoryMap: Map<string, Category>; language: Language }) {
  return <div className="mini-tx"><div><b>{tx.note || (tx.type === "transfer" ? bi(language, "Pindahan", "Transfer") : tx.type)}</b><span>{dateLabel(tx.date, language)} · {accountMap.get(tx.accountId)?.name || bi(language, "Akun", "Account")}{tx.categoryId ? ` · ${categoryMap.get(tx.categoryId)?.name || bi(language, "Kategori", "Category")}` : ""}</span></div><strong className={tx.type === "income" ? "positive" : tx.type === "expense" ? "negative" : ""}>{tx.type === "income" ? "+" : tx.type === "expense" ? "−" : "↔"}{money(tx.amount, language)}</strong></div>;
}

function BudgetBar({ name, spent, limit, percent, language }: { name: string; spent: number; limit: number; percent: number; language: Language }) {
  const width = clamp(percent, 0, 100);
  return <div className="budget-row"><div className="budget-meta"><div><b>{name}</b><span>{Math.round(percent)}%</span></div><div><span>{money(spent, language)}</span><span>/ {money(limit, language)}</span></div></div><div className={percent > 100 ? "budget-track over" : percent >= 80 ? "budget-track warning" : "budget-track"}><i style={{ width: `${width}%` }} /></div></div>;
}

function TransactionComposer({ accounts, categories, onAdd, language }: { accounts: Account[]; categories: Category[]; onAdd: (tx: Omit<Transaction, "id">) => void; language: Language }) {
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState("");

  useEffect(() => { if (!accounts.some((a) => a.id === accountId)) setAccountId(accounts[0]?.id || ""); }, [accounts, accountId]);
  useEffect(() => {
    const validTarget = accounts.some((a) => a.id === toAccountId && a.id !== accountId);
    if (!validTarget) setToAccountId(accounts.find((a) => a.id !== accountId)?.id || "");
  }, [accounts, accountId, toAccountId]);
  useEffect(() => { if (!categories.some((c) => c.id === categoryId)) setCategoryId(categories[0]?.id || ""); }, [categories, categoryId]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const numeric = Math.max(0, Number(amount) || 0);
    if (!numeric || !accountId) return;
    if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return;
    onAdd({ date, type, amount: numeric, accountId, toAccountId: type === "transfer" ? toAccountId : undefined, categoryId: type === "expense" ? categoryId : undefined, note: note.trim() });
    setAmount("");
    setNote("");
  }

  const typeLabel = (value: TxType) => value === "expense" ? bi(language, "keluar", "expense") : value === "income" ? bi(language, "masuk", "income") : bi(language, "pindah", "transfer");
  return <form className="tx-composer" onSubmit={submit}>
    <div className="segmented">{(["expense", "income", "transfer"] as TxType[]).map((value) => <button type="button" key={value} className={type === value ? "active" : ""} onClick={() => setType(value)}>{typeLabel(value)}</button>)}</div>
    <label><span>{bi(language, "Nominal", "Amount")}</span><input required type="number" min={1} step={1000} placeholder="250000" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
    <label><span>{bi(language, "Dari / akun", "From / account")}</span><select value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    {type === "transfer" ? <label><span>{bi(language, "Ke akun", "To account")}</span><select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>{accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label> : type === "expense" ? <label><span>{bi(language, "Kategori", "Category")}</span><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : <label><span>{bi(language, "Kategori", "Category")}</span><input disabled value={bi(language, "Uang masuk", "Income")} /></label>}
    <label><span>{bi(language, "Tanggal", "Date")}</span><input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
    <label className="tx-note"><span>{bi(language, "Catatan", "Note")}</span><input maxLength={120} placeholder={bi(language, "opsional, tapi nanti berguna", "optional, future you may care")} value={note} onChange={(e) => setNote(e.target.value)} /></label>
    <button className="primary-btn tx-submit" type="submit">{bi(language, "CATAT", "ADD")} {typeLabel(type).toUpperCase()}</button>
  </form>;
}

function CalendarPanel({ selectedMonth, transactions, selectedDay, onSelectDay, language }: { selectedMonth: string; transactions: Transaction[]; selectedDay: number | null; onSelectDay: (day: number | null) => void; language: Language }) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daily = useMemo(() => {
    const map: Record<number, { expense: number; income: number; count: number }> = {};
    transactions.forEach((tx) => {
      const day = Number(tx.date.slice(-2));
      map[day] ||= { expense: 0, income: 0, count: 0 };
      if (tx.type === "expense") map[day].expense += tx.amount;
      if (tx.type === "income") map[day].income += tx.amount;
      map[day].count += 1;
    });
    return map;
  }, [transactions]);
  const weekdays = language === "id" ? ["M", "S", "S", "R", "K", "J", "S"] : ["S", "M", "T", "W", "T", "F", "S"];
  return <article className="panel calendar-panel"><div className="panel-head"><div><span className="eyebrow">{bi(language, "KALENDER GERAK-GERIK", "ACTIVITY CALENDAR")}</span><h2>{monthLabel(selectedMonth, language)}</h2></div></div><div className="calendar-week">{weekdays.map((day, i) => <span key={`${day}-${i}`}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: firstWeekday }, (_, i) => <i key={`blank-${i}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const stat = daily[day]; return <button key={day} type="button" className={selectedDay === day ? "calendar-day selected" : stat ? "calendar-day active" : "calendar-day"} onClick={() => onSelectDay(selectedDay === day ? null : day)}><b>{day}</b>{stat && <><span>{stat.count} tx</span>{stat.expense > 0 && <small>−{compactMoney(stat.expense, language)}</small>}</>}</button>; })}</div></article>;
}

function LedgerRow({ tx, accountMap, categoryMap, onDelete, language }: { tx: Transaction; accountMap: Map<string, Account>; categoryMap: Map<string, Category>; onDelete: () => void; language: Language }) {
  return <div className="ledger-row"><div className={`tx-symbol ${tx.type}`}>{tx.type === "income" ? "+" : tx.type === "expense" ? "−" : "↔"}</div><div className="ledger-main"><b>{tx.note || (tx.type === "transfer" ? bi(language, "Pindahan", "Transfer") : tx.type)}</b><span>{dateLabel(tx.date, language)} · {accountMap.get(tx.accountId)?.name || bi(language, "Nggak dikenal", "Unknown")}{tx.type === "transfer" && tx.toAccountId ? ` → ${accountMap.get(tx.toAccountId)?.name || bi(language, "Nggak dikenal", "Unknown")}` : tx.categoryId ? ` · ${categoryMap.get(tx.categoryId)?.name || bi(language, "Kategori", "Category")}` : ""}</span></div><strong className={tx.type === "income" ? "positive" : tx.type === "expense" ? "negative" : ""}>{tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}{money(tx.amount, language)}</strong><button className="row-delete" type="button" onClick={onDelete} aria-label={bi(language, "Hapus transaksi", "Delete transaction")}>×</button></div>;
}

function GoalCard({ goal, onChange, onDelete, language }: { goal: Goal; onChange: (goal: Goal) => void; onDelete?: () => void; language: Language }) {
  const [contribution, setContribution] = useState("");
  const progress = goal.target > 0 ? clamp((goal.current / goal.target) * 100, 0, 100) : 0;
  const remaining = Math.max(0, goal.target - goal.current);
  const eta = goal.target <= 0 ? null : remaining === 0 ? 0 : goal.monthlyContribution > 0 ? Math.ceil(remaining / goal.monthlyContribution) : null;
  function addContribution() {
    const amount = Math.max(0, Number(contribution) || 0);
    if (!amount) return;
    onChange({ ...goal, current: goal.current + amount });
    setContribution("");
  }
  return <article className="goal-card"><div className="goal-card-head"><div><span className="eyebrow">{goal.kind === "emergency" ? bi(language, "JANGAN DISENTUH", "DO NOT TOUCH") : goal.priority.toUpperCase()}</span><input className="goal-title-input" value={goal.name} onChange={(e) => onChange({ ...goal, name: e.target.value.slice(0, 50) })} /></div><strong>{Math.round(progress)}%</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><div className="goal-amount"><strong>{money(goal.current, language)}</strong><span>{bi(language, "dari", "of")} {money(goal.target, language)}</span></div><div className="goal-fields"><label><span>Target</span><input type="number" min={0} value={goal.target} onChange={(e) => onChange({ ...goal, target: Math.max(0, Number(e.target.value) || 0) })} /></label><label><span>{bi(language, "Plan / bulan", "Monthly plan")}</span><input type="number" min={0} value={goal.monthlyContribution} onChange={(e) => onChange({ ...goal, monthlyContribution: Math.max(0, Number(e.target.value) || 0) })} /></label><label><span>{bi(language, "Tanggal target", "Target date")}</span><input type="date" value={goal.targetDate} onChange={(e) => onChange({ ...goal, targetDate: e.target.value })} /></label><label><span>{bi(language, "Prioritas", "Priority")}</span><select value={goal.priority} onChange={(e) => onChange({ ...goal, priority: e.target.value as Goal["priority"] })}><option value="high">{bi(language, "Tinggi", "High")}</option><option value="medium">{bi(language, "Sedang", "Medium")}</option><option value="low">{bi(language, "Santai", "Low")}</option></select></label></div><div className="goal-contribution"><input type="number" min={0} placeholder={bi(language, "tambah tabungan", "add contribution")} value={contribution} onChange={(e) => setContribution(e.target.value)} /><button className="primary-btn" type="button" onClick={addContribution}>+ {bi(language, "TAMBAH", "ADD")}</button></div><div className="goal-footer"><span>{bi(language, "Kurang", "Remaining")} <b>{money(remaining, language)}</b></span><span>ETA <b>{goal.target <= 0 ? bi(language, "SET TARGET", "SET TARGET") : eta === null ? "∞" : eta === 0 ? bi(language, "BERES", "DONE") : `${eta} ${bi(language, "bln", "mo")}`}</b></span>{onDelete && <button type="button" onClick={onDelete}>{bi(language, "Hapus target", "Delete goal")}</button>}</div></article>;
}

function RecurringComposer({ accounts, categories, onAdd, language }: { accounts: Account[]; categories: Category[]; onAdd: (rule: RecurringRule) => void; language: Language }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Exclude<TxType, "transfer">>("expense");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState(1);
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  useEffect(() => { if (!accounts.some((a) => a.id === accountId)) setAccountId(accounts[0]?.id || ""); }, [accounts, accountId]);
  useEffect(() => { if (!categories.some((c) => c.id === categoryId)) setCategoryId(categories[0]?.id || ""); }, [categories, categoryId]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const numeric = Math.max(0, Number(amount) || 0);
    if (!name.trim() || !numeric || !accountId) return;
    onAdd({ id: uid("rec"), name: name.trim().slice(0, 60), type, amount: numeric, day: clamp(day, 1, 28), accountId, categoryId: type === "expense" ? categoryId : undefined, active: true });
    setName(""); setAmount("");
  }
  return <form className="recurring-composer" onSubmit={submit}><label><span>{bi(language, "Nama", "Name")}</span><input required placeholder={bi(language, "Netflix / gaji / kos", "Netflix / salary / rent")} value={name} onChange={(e) => setName(e.target.value)} /></label><label><span>{bi(language, "Tipe", "Type")}</span><select value={type} onChange={(e) => setType(e.target.value as Exclude<TxType, "transfer">)}><option value="expense">{bi(language, "Keluar", "Expense")}</option><option value="income">{bi(language, "Masuk", "Income")}</option></select></label><label><span>{bi(language, "Nominal", "Amount")}</span><input required type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></label><label><span>{bi(language, "Tanggal 1–28", "Day 1–28")}</span><input type="number" min={1} max={28} value={day} onChange={(e) => setDay(clamp(Number(e.target.value) || 1, 1, 28))} /></label><label><span>{bi(language, "Akun", "Account")}</span><select value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{type === "expense" ? <label><span>{bi(language, "Kategori", "Category")}</span><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : <div className="composer-spacer" />}<button className="primary-btn" type="submit">+ {bi(language, "TAMBAH YANG DATANG LAGI", "ADD RECURRING")}</button></form>;
}

function TrendChart({ data, language }: { data: Array<{ key: string; income: number; expense: number; net: number }>; language: Language }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));
  return <div className="trend-chart"><div className="trend-legend"><span><i className="income-dot" />{bi(language, "Masuk", "Income")}</span><span><i className="expense-dot" />{bi(language, "Keluar", "Expense")}</span></div><div className="trend-bars">{data.map((item) => <div className="trend-col" key={item.key}><div className="trend-pair"><i className="income-bar" style={{ height: `${Math.max(item.income ? 4 : 0, (item.income / max) * 100)}%` }} title={`${bi(language, "Masuk", "Income")} ${money(item.income, language)}`} /><i className="expense-bar" style={{ height: `${Math.max(item.expense ? 4 : 0, (item.expense / max) * 100)}%` }} title={`${bi(language, "Keluar", "Expense")} ${money(item.expense, language)}`} /></div><b>{monthLabel(item.key, language).split(" ")[0].slice(0, 3)}</b><small className={item.net >= 0 ? "positive" : "negative"}>{item.net >= 0 ? "+" : ""}{compactMoney(item.net, language)}</small></div>)}</div></div>;
}

function SpendingMix({ categories, categorySpend, language }: { categories: Category[]; categorySpend: Record<string, number>; language: Language }) {
  const sorted = [...categories].map((category) => ({ ...category, spent: categorySpend[category.id] || 0 })).filter((item) => item.spent > 0).sort((a, b) => b.spent - a.spent);
  const total = sorted.reduce((sum, item) => sum + item.spent, 0);
  if (!sorted.length) return <p className="muted-empty">{bi(language, "Belum ada pengeluaran buat dibedah.", "No spending to dissect yet.")}</p>;
  return <div className="mix-list">{sorted.map((item, index) => <div className="mix-row" key={item.id}><span className={`mix-dot c${(index % 4) + 1}`} /><div><b>{item.name}</b><i style={{ width: `${total ? (item.spent / total) * 100 : 0}%` }} /></div><strong>{Math.round((item.spent / total) * 100)}%</strong><small>{money(item.spent, language)}</small></div>)}</div>;
}

function CloudSyncCard({ state, onApply, flash, language }: { state: AppState; onApply: (state: AppState) => void; flash: (message: string) => void; language: Language }) {
  type CloudSession = { access_token: string; refresh_token?: string; user: { id: string; email?: string } };
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const configured = Boolean(supabaseUrl && supabaseKey);
  const [session, setSession] = useState<CloudSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLOUD_SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      localStorage.removeItem(CLOUD_SESSION_KEY);
    }
  }, []);

  function saveSession(next: CloudSession | null) {
    setSession(next);
    if (next) localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(CLOUD_SESSION_KEY);
  }

  async function auth(mode: "signin" | "signup") {
    if (!configured || !email || password.length < 6) return;
    setBusy(true);
    try {
      const url = mode === "signin" ? `${supabaseUrl}/auth/v1/token?grant_type=password` : `${supabaseUrl}/auth/v1/signup`;
      const response = await fetch(url, {
        method: "POST",
        headers: { apikey: supabaseKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.msg || data?.message || "Authentication failed");
      if (data.access_token && data.user) {
        saveSession({ access_token: data.access_token, refresh_token: data.refresh_token, user: { id: data.user.id, email: data.user.email } });
        setPassword("");
        flash(mode === "signin" ? bi(language, "Cloud masuk", "Cloud signed in") : bi(language, "Akun dibuat dan langsung masuk", "Account created and signed in"));
      } else {
        flash(bi(language, "Cek email buat konfirmasi akun Supabase", "Check your email to confirm the Supabase account"));
      }
    } catch (error) {
      flash(error instanceof Error ? error.message : "Cloud auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function authorizedFetch(url: string, init: RequestInit = {}) {
    if (!session) throw new Error("Not signed in");
    const request = async (token: string) => fetch(url, {
      ...init,
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    let response = await request(session.access_token);
    if (response.status !== 401 || !session.refresh_token) return response;
    const refreshResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: supabaseKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const refreshed = await refreshResponse.json();
    if (!refreshResponse.ok || !refreshed.access_token || !refreshed.user) return response;
    const nextSession: CloudSession = { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, user: { id: refreshed.user.id, email: refreshed.user.email } };
    saveSession(nextSession);
    response = await request(nextSession.access_token);
    return response;
  }

  async function pushCloud() {
    if (!session || !configured) return;
    setBusy(true);
    try {
      const updatedAt = new Date().toISOString();
      const response = await authorizedFetch(`${supabaseUrl}/rest/v1/bagi_user_data?on_conflict=user_id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({ user_id: session.user.id, data: state, updated_at: updatedAt }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Cloud session expired — sign in again" : `Cloud push failed (${response.status})`);
      setLastSync(updatedAt);
      flash(bi(language, "Backup cloud di-update", "Cloud backup updated"));
    } catch (error) {
      flash(error instanceof Error ? error.message : "Cloud push failed");
    } finally {
      setBusy(false);
    }
  }

  async function pullCloud() {
    if (!session || !configured) return;
    if (!window.confirm("Replace local BAGI data with the latest cloud backup?")) return;
    setBusy(true);
    try {
      const response = await authorizedFetch(`${supabaseUrl}/rest/v1/bagi_user_data?user_id=eq.${encodeURIComponent(session.user.id)}&select=data,updated_at&limit=1`);
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "Cloud session expired — sign in again" : `Cloud pull failed (${response.status})`);
      if (!Array.isArray(data) || !data.length) return flash(bi(language, "Belum ada backup cloud — push device ini dulu", "No cloud backup yet — push this device first"));
      const normalized = normalizeState(data[0].data);
      if (!normalized) throw new Error("Cloud backup is invalid");
      onApply(normalized);
      setLastSync(String(data[0].updated_at || ""));
      flash(bi(language, "Backup cloud dipulihkan", "Cloud backup restored"));
    } catch (error) {
      flash(error instanceof Error ? error.message : "Cloud pull failed");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <article className="settings-card cloud-card"><h2>{bi(language, "Cloud sync (opsional)", "Optional cloud sync")}</h2><p>{bi(language, "Supabase-ready, tapi mati secara default. Isi environment variables di Vercel kalau mau backup lintas device.", "Supabase-ready, but off by default. Add the environment variables in Vercel to enable cross-device backup.")}</p><div className="cloud-off">NOT CONFIGURED</div></article>;
  }

  if (!session) {
    return <article className="settings-card cloud-card"><h2>Cloud sync</h2><p>{bi(language, "Login pakai project Supabase punya lo sendiri. Password langsung ke Supabase, bukan server BAGI.", "Sign in with your own Supabase project. Passwords go straight to Supabase, not a BAGI server.")}</p><div className="cloud-auth"><input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><input type="password" autoComplete="current-password" placeholder={bi(language, "Password (min. 6)", "Password (min. 6)")} value={password} onChange={(e) => setPassword(e.target.value)} /><div><button className="primary-btn" type="button" disabled={busy || !email || password.length < 6} onClick={() => auth("signin")}>{bi(language, "MASUK", "SIGN IN")}</button><button className="ghost-btn" type="button" disabled={busy || !email || password.length < 6} onClick={() => auth("signup")}>{bi(language, "BUAT AKUN", "CREATE ACCOUNT")}</button></div></div></article>;
  }

  return <article className="settings-card cloud-card"><div className="cloud-user"><div><h2>Cloud sync</h2><p>{session.user.email || bi(language, "Sudah masuk", "Signed in")}</p></div><button className="text-btn" type="button" onClick={() => { saveSession(null); flash(bi(language, "Keluar dari cloud", "Cloud signed out")); }}>{bi(language, "Keluar", "Sign out")}</button></div><p>{bi(language, "Push nyimpen state device ini. Pull mengganti data lokal dengan backup cloud terbaru.", "Push stores this device state. Pull replaces local data with the latest cloud backup.")}</p><div className="button-column"><button className="primary-btn" type="button" disabled={busy} onClick={pushCloud}>{bi(language, "PUSH DEVICE → CLOUD", "PUSH DEVICE → CLOUD")}</button><button className="ghost-btn wide" type="button" disabled={busy} onClick={pullCloud}>{bi(language, "PULL CLOUD → DEVICE", "PULL CLOUD → DEVICE")}</button></div>{lastSync && <small className="cloud-last">{bi(language, "Sync terakhir", "Last sync")}: {new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastSync))}</small>}</article>;
}

function AccountSettings({ accounts, balances, onChange, language }: { accounts: Account[]; balances: Record<string, number>; onChange: (accounts: Account[]) => void; language: Language }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("bank");
  const [openingBalance, setOpeningBalance] = useState(0);
  function add() {
    if (!name.trim()) return;
    onChange([...accounts, { id: uid("acc"), name: name.trim().slice(0, 40), kind, openingBalance, archived: false }]);
    setName(""); setOpeningBalance(0);
  }
  return <article className="settings-card settings-span"><h2>{bi(language, "Tempat uang", "Accounts")}</h2><p>{bi(language, "Mandiri Utama jadi default. Tambah cash, e-wallet, tabungan, atau bank lain sesuka sistem hidup lo.", "Mandiri Utama is the default. Add cash, e-wallets, savings, or any other bank you use.")}</p><div className="manage-list">{accounts.map((account) => <div className="manage-row" key={account.id}><div><input value={account.name} onChange={(e) => onChange(accounts.map((item) => item.id === account.id ? { ...item, name: e.target.value.slice(0, 40) } : item))} /><span>{account.kind} · {bi(language, "sekarang", "current")} {money(balances[account.id] || 0, language)}</span></div><label><span>{bi(language, "Saldo awal", "Opening")}</span><input type="number" value={account.openingBalance} onChange={(e) => onChange(accounts.map((item) => item.id === account.id ? { ...item, openingBalance: Number(e.target.value) || 0 } : item))} /></label><button type="button" className={account.archived ? "status-btn" : "status-btn active"} disabled={!account.archived && accounts.filter((item) => !item.archived).length <= 1} title={!account.archived && accounts.filter((item) => !item.archived).length <= 1 ? bi(language, "Minimal satu akun harus aktif", "Keep at least one active account") : undefined} onClick={() => onChange(accounts.map((item) => item.id === account.id ? { ...item, archived: !item.archived } : item))}>{account.archived ? bi(language, "ARSIP", "ARCHIVED") : bi(language, "AKTIF", "ACTIVE")}</button></div>)}</div><div className="inline-add"><input placeholder={bi(language, "Akun baru", "New account")} value={name} onChange={(e) => setName(e.target.value)} /><select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}><option value="bank">Bank</option><option value="cash">Cash</option><option value="ewallet">E-Wallet</option><option value="savings">{bi(language, "Tabungan", "Savings")}</option></select><input type="number" placeholder={bi(language, "Saldo awal", "Opening balance")} value={openingBalance || ""} onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)} /><button className="primary-btn" type="button" onClick={add}>{bi(language, "TAMBAH", "ADD")}</button></div></article>;
}

function CategorySettings({ categories, onChange, language }: { categories: Category[]; onChange: (categories: Category[]) => void; language: Language }) {
  const [name, setName] = useState("");
  const [limit, setLimit] = useState(0);
  function add() {
    if (!name.trim()) return;
    onChange([...categories, { id: uid("cat"), name: name.trim().slice(0, 40), monthlyLimit: Math.max(0, limit), archived: false }]);
    setName(""); setLimit(0);
  }
  return <article className="settings-card settings-span"><h2>{bi(language, "Kategori jatah", "Budget categories")}</h2><p>{bi(language, "Pasang batas bulanan. BAGI bakal kasih tahu kalau sebuah kategori mulai kelewat nyaman.", "Set monthly limits. BAGI will flag categories that are getting a little too comfortable.")}</p><div className="manage-list">{categories.map((category) => <div className="manage-row" key={category.id}><div><input value={category.name} onChange={(e) => onChange(categories.map((item) => item.id === category.id ? { ...item, name: e.target.value.slice(0, 40) } : item))} /><span>{category.archived ? bi(language, "disembunyikan dari transaksi baru", "hidden from new transactions") : bi(language, "tersedia di transaksi", "available in transactions")}</span></div><label><span>{bi(language, "Batas bulanan", "Monthly limit")}</span><input type="number" min={0} value={category.monthlyLimit} onChange={(e) => onChange(categories.map((item) => item.id === category.id ? { ...item, monthlyLimit: Math.max(0, Number(e.target.value) || 0) } : item))} /></label><button type="button" className={category.archived ? "status-btn" : "status-btn active"} disabled={!category.archived && categories.filter((item) => !item.archived).length <= 1} title={!category.archived && categories.filter((item) => !item.archived).length <= 1 ? bi(language, "Minimal satu kategori harus aktif", "Keep at least one active category") : undefined} onClick={() => onChange(categories.map((item) => item.id === category.id ? { ...item, archived: !item.archived } : item))}>{category.archived ? bi(language, "ARSIP", "ARCHIVED") : bi(language, "AKTIF", "ACTIVE")}</button></div>)}</div><div className="inline-add"><input placeholder={bi(language, "Kategori baru", "New category")} value={name} onChange={(e) => setName(e.target.value)} /><input type="number" min={0} placeholder={bi(language, "Batas bulanan", "Monthly limit")} value={limit || ""} onChange={(e) => setLimit(Number(e.target.value) || 0)} /><button className="primary-btn" type="button" onClick={add}>{bi(language, "TAMBAH", "ADD")}</button></div></article>;
}
