export type Person = { id: string; name: string };
export type BillItem = { id: string; name: string; quantity: number; amount: number; personIds: string[] };
export type Charge = { value: number; mode: 'amount' | 'percent' };
export type SplitBill = {
  id: string; title: string; date: string; people: Person[]; items: BillItem[];
  mode: 'items' | 'equal'; discount: Charge; service: Charge; tax: Charge;
  taxOnService: boolean; extra: number; payerId: string; expectedTotal: number | null;
  fromScan: boolean; reviewed: boolean; savedAt?: string;
};
export const MAX_MONEY = 1_000_000_000;
export const newId = () => globalThis.crypto?.randomUUID?.() || 'b-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
const nonnegative = (v: unknown, max = MAX_MONEY) => Math.min(max, Math.max(0, Number(v) || 0));
export const rupiah = (v: unknown) => Math.round(nonnegative(v));
const blankCharge = (): Charge => ({ value: 0, mode: 'amount' });
export function newBill(): SplitBill {
  const d = new Date();
  const date = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  return { id: newId(), title: '', date, people: [], items: [], mode: 'items', discount: blankCharge(), service: blankCharge(), tax: blankCharge(), taxOnService: false, extra: 0, payerId: '', expectedTotal: null, fromScan: false, reviewed: true };
}
export function normalizeBill(value: unknown): SplitBill | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const b = value as Partial<SplitBill>;
  if (!Array.isArray(b.people) || !Array.isArray(b.items)) return null;
  const people: Person[] = [];
  for (const p of b.people.slice(0, 30)) {
    if (!p || typeof p !== 'object') continue;
    const id = String(p.id || newId()).slice(0, 80);
    if (people.some(x => x.id === id)) continue;
    people.push({ id, name: String(p.name || '').slice(0, 40) });
  }
  const ids = new Set(people.map(p => p.id));
  const seen = new Set<string>();
  const items = b.items.slice(0, 150).filter(x => x && typeof x === 'object').map(i => {
    let id = String(i.id || newId()).slice(0, 80);
    if (seen.has(id)) id = newId();
    seen.add(id);
    return { id, name: String(i.name || '').slice(0, 80), quantity: Math.max(1, Math.round(nonnegative(i.quantity, 999))), amount: rupiah(i.amount), personIds: Array.from(new Set(Array.isArray(i.personIds) ? i.personIds.filter(id => ids.has(id)) : [])) };
  });
  const charge = (v: Charge | undefined): Charge => ({ value: nonnegative(v?.value, v?.mode === 'percent' ? 100 : MAX_MONEY), mode: v?.mode === 'percent' ? 'percent' : 'amount' });
  return { ...newBill(), id: String(b.id || newId()).slice(0, 80), title: String(b.title || '').slice(0, 80), date: /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? b.date! : newBill().date, people, items, mode: b.mode === 'equal' ? 'equal' : 'items', discount: charge(b.discount), service: charge(b.service), tax: charge(b.tax), taxOnService: b.taxOnService === true, extra: rupiah(b.extra), payerId: ids.has(b.payerId || '') ? b.payerId! : '', expectedTotal: b.expectedTotal == null ? null : rupiah(b.expectedTotal), fromScan: b.fromScan === true, reviewed: b.reviewed !== false, savedAt: typeof b.savedAt === 'string' ? b.savedAt : undefined };
}
// Largest remainder allocation. Ties follow participant order; totals stay exact in whole rupiah.
export function allocate(total: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const safe = weights.map(w => Number.isFinite(w) ? Math.max(0, w) : 0);
  const sum = safe.reduce((s, n) => s + n, 0);
  const raw = safe.map(w => total * (sum > 0 ? w / sum : 1 / safe.length));
  const parts = raw.map(Math.floor);
  const remaining = Math.round(total) - parts.reduce((s, n) => s + n, 0);
  const order = raw.map((n, i) => ({ i, fraction: n - parts[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (let k = 0; k < remaining; k++) parts[order[k % order.length].i]++;
  return parts;
}
export function calculateBill(b: SplitBill) {
  const subtotal = b.items.reduce((s, i) => s + rupiah(i.amount), 0);
  const charge = (c: Charge, base: number) => Math.round(c.mode === 'percent' ? base * nonnegative(c.value, 100) / 100 : rupiah(c.value));
  const requestedDiscount = charge(b.discount, subtotal);
  const discount = Math.min(subtotal, requestedDiscount);
  const net = subtotal - discount;
  const service = charge(b.service, net);
  const tax = charge(b.tax, net + (b.taxOnService ? service : 0));
  const extra = rupiah(b.extra);
  const total = net + service + tax + extra;
  const weights = b.people.map(() => 0);
  let unassigned = 0;
  if (b.mode === 'equal') weights.fill(1);
  else for (const item of b.items) {
    const indices = b.people.map((p, i) => item.personIds.includes(p.id) ? i : -1).filter(i => i >= 0);
    if (!indices.length && item.amount > 0) { unassigned++; continue; }
    // Keep fractional item shares until the FINAL allocation to avoid accumulating Rp1 errors.
    indices.forEach(i => { weights[i] += rupiah(item.amount) / indices.length; });
  }
  const amounts = allocate(total, weights);
  const parts = b.people.map((p, i) => ({ ...p, amount: amounts[i] || 0 }));
  const mismatch = b.expectedTotal === null ? null : total - b.expectedTotal;
  const issues: string[] = [];
  if (b.people.length < 2) issues.push('people');
  if (b.people.some(p => !p.name.trim())) issues.push('names');
  if (new Set(b.people.map(p => p.name.trim().toLowerCase())).size !== b.people.length) issues.push('duplicateNames');
  if (!b.items.length || subtotal <= 0) issues.push('items');
  if (b.items.some(i => !i.name.trim() || i.amount <= 0)) issues.push('itemDetails');
  if (unassigned) issues.push('unassigned');
  if (requestedDiscount > subtotal) issues.push('discount');
  if (b.fromScan && !b.reviewed) issues.push('review');
  if (mismatch !== null && mismatch !== 0) issues.push('mismatch');
  if (total > MAX_MONEY) issues.push('limit');
  return { subtotal, discount, service, tax, extra, total, parts, unassigned, mismatch, issues, valid: issues.length === 0 };
}
// Accept Indonesian and English receipt separators; round sub-rupiah fractions once.
export function parseReceiptMoney(input: string): number | null {
  let s = input.replace(/(?:Rp|IDR)/gi, '').replace(/\s/g, '').trim();
  if (!/^-?\d[\d.,]*$/.test(s)) return null;
  const negative = s.startsWith('-'); s = s.replace(/^-/, '');
  const last = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (last >= 0 && s.length - last - 1 <= 2) s = s.slice(0, last).replace(/[.,]/g, '') + '.' + s.slice(last + 1);
  else s = s.replace(/[.,]/g, '');
  const n = Number(s);
  return Number.isFinite(n) && n <= MAX_MONEY ? Math.round(n) * (negative ? -1 : 1) : null;
}
export type ParsedReceipt = { items: BillItem[]; tax: number; service: number; discount: number; total: number | null; subtotal: number | null; skipped: string[] };
export function parseReceipt(text: string): ParsedReceipt {
  const out: ParsedReceipt = { items: [], tax: 0, service: 0, discount: 0, total: null, subtotal: null, skipped: [] };
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  let pendingName = '';
  let footer = false;
  for (const line of lines) {
    const match = line.match(/(-?(?:Rp\.?\s*)?\d[\d.,]*)\s*(?:[A-Z*])?\s*$/i);
    if (!match) {
      if (!footer && /^[A-Za-z][A-Za-z\s&()/'-]{2,70}$/.test(line) && !/kasir|cashier|alamat|address|terima kasih|thank|receipt|invoice|table|meja/i.test(line)) pendingName = line;
      else pendingName = '';
      continue;
    }
    const amount = parseReceiptMoney(match[1]);
    if (amount === null) { out.skipped.push(line); pendingName = ''; continue; }
    const lead = line.slice(0, match.index).trim();
    const lower = lead.toLowerCase();
    if (/^(sub\s*total|subtotal)\b/.test(lower)) { out.subtotal = Math.abs(amount); footer = true; pendingName = ''; continue; }
    if (/^(grand\s*total|total\s*(bayar|payment|tagihan|due)?|amount\s*due|jumlah\s*(bayar|tagihan))\s*[:=]?\s*$/.test(lower)) { out.total = Math.abs(amount); footer = true; pendingName = ''; continue; }
    if (/^(pajak|tax|ppn|pb1|pbjt|vat)\b/.test(lower)) { out.tax += Math.abs(amount); footer = true; pendingName = ''; continue; }
    if (/^(service|servis|svc|layanan)\b/.test(lower)) { out.service += Math.abs(amount); footer = true; pendingName = ''; continue; }
    if (/^(discount|diskon|disc|potongan)\b/.test(lower)) { out.discount += Math.abs(amount); pendingName = ''; continue; }
    if (/\b(cash|tunai|change|kembali|kembalian|debit|credit|kredit|qris|visa|mastercard|payment|bayar|tender|telp|phone|npwp|kasir|cashier|meja|table|receipt|invoice|order|ref)\b/i.test(lead) || /\d[:/]\d/.test(line) || /^\s*(no\.?|nomor|jl\.?|jalan)\b/i.test(lead)) { pendingName = ''; continue; }
    if (footer) { out.skipped.push(line); pendingName = ''; continue; }
    let name = lead;
    let quantity = 1;
    const start = name.match(/^(\d{1,3})\s*(?:[xX×]\s*|\s+)(?=[A-Za-z])/);
    if (start) { quantity = Math.max(1, Number(start[1])); name = name.slice(start[0].length); }
    // NAME 2 x 25.000 [50.000] or NAME 2 25.000 [50.000].
    const columns = name.match(/\s+(\d{1,3})\s*(?:[xX×@]\s*|\s+)(?:Rp\.?\s*)?\d[\d.,]*\s*$/i);
    if (columns) { quantity = Math.max(1, Number(columns[1])); name = name.slice(0, columns.index).trim(); }
    const trailingQuantity = name.match(/\s+(?:[xX×]\s*)?(\d{1,3})\s*$/);
    if (trailingQuantity) { quantity = Math.max(1, Number(trailingQuantity[1])); name = name.slice(0, trailingQuantity.index).trim(); }
    // 2 x 25000 [50000] under a standalone item name.
    if ((!name || /^[\d\s.,xX×@]+$/.test(name)) && pendingName) { name = pendingName; const q = lead.match(/^(\d{1,3})\s*[xX×@]/); if (q) quantity = Number(q[1]); }
    name = name.replace(/\s+@?\s*(?:Rp\.?\s*)?\d[\d.,]*\s*$/i, '').replace(/[:=]+$/, '').trim();
    if (amount > 0 && /[A-Za-z]/.test(name) && name.length >= 2) out.items.push({ id: newId(), name: name.slice(0, 80), quantity, amount, personIds: [] });
    else out.skipped.push(line);
    pendingName = '';
  }
  return out;
}
