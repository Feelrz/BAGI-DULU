import { BillItem, MAX_MONEY, ParsedReceipt, parseReceiptMoney, receiptItemNameLooksCorrupt } from './splitbill';

export type ReviewItem = { id: string; name: string; quantity: string; amount: string };
export type ReviewAmount = 'discount' | 'service' | 'tax' | 'rounding' | 'subtotal' | 'total';
export type ReceiptReview = { items: ReviewItem[]; currencyWarning?: boolean } & Record<ReviewAmount, string>;
export type ItemProblem = 'name' | 'quantity' | 'amount';

// The review is a separate draft. Typing, removing rows or cancelling cannot
// mutate the recognized receipt or the user's saved bill.
export function createReceiptReview(receipt: ParsedReceipt): ReceiptReview {
  return {
    items: receipt.items.map(({ id, name, quantity, amount }) => ({ id, name, quantity: String(quantity), amount: String(amount) })),
    discount: String(receipt.discount), service: String(receipt.service), tax: String(receipt.tax), rounding: String(receipt.rounding),
    subtotal: receipt.subtotal === null ? '' : String(receipt.subtotal), total: receipt.total === null ? '' : String(receipt.total),
    currencyWarning: receipt.currencyWarning,
  };
}

export function validateReceiptReview(draft: ReceiptReview) {
  const itemErrors: Record<string, ItemProblem[]> = {};
  const items: BillItem[] = draft.items.map(item => {
    const errors: ItemProblem[] = [], name = item.name.trim();
    const quantity = /^\d+$/.test(item.quantity.trim()) ? Number(item.quantity) : NaN;
    const amount = parseReceiptMoney(item.amount);
    if (!name || name.length > 80 || receiptItemNameLooksCorrupt(name)) errors.push('name');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999 || (quantity > 50 && amount !== null && amount < 1000)) errors.push('quantity');
    if (amount === null || amount < 100 || amount > MAX_MONEY) errors.push('amount');
    itemErrors[item.id] = errors;
    return { id: item.id, name, quantity: Number.isFinite(quantity) ? quantity : 1, amount: amount ?? 0, personIds: [] };
  });
  const amountErrors: ReviewAmount[] = [];
  function read(key: ReviewAmount, optional = false): number | null {
    if (!draft[key].trim()) {
      if (optional) return null;
      amountErrors.push(key); return null;
    }
    const value = parseReceiptMoney(draft[key]);
    if (value === null || (key === 'rounding' ? Math.abs(value) > 10000 : value < 0 || value > MAX_MONEY) || (key === 'total' && value === 0)) amountErrors.push(key);
    return value;
  }
  const discount = read('discount') ?? 0, service = read('service') ?? 0, tax = read('tax') ?? 0, rounding = read('rounding') ?? 0;
  const expectedSubtotal = read('subtotal', true), total = read('total');
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const calculated = subtotal - discount + service + tax + rounding;
  const fieldsValid = !Object.values(itemErrors).some(errors => errors.length) && !amountErrors.length;
  const issues: string[] = [];
  if (draft.currencyWarning) issues.push('currency');
  if (!items.length) issues.push('empty');
  if (items.length > 150) issues.push('itemLimit');
  if (discount > subtotal) issues.push('discount');
  if (calculated <= 0 || calculated > MAX_MONEY || subtotal > MAX_MONEY) issues.push('limit');
  if (fieldsValid && expectedSubtotal !== null && subtotal !== expectedSubtotal) issues.push('subtotal');
  if (fieldsValid && total !== null && calculated !== total) issues.push('total');
  const receipt: ParsedReceipt = { items, discount, service, tax, rounding, total, subtotal: expectedSubtotal, skipped: [], currencyWarning: draft.currencyWarning };
  return { receipt, itemErrors, amountErrors, issues, fieldsValid, subtotal, calculated, difference: total === null ? null : calculated - total, valid: fieldsValid && issues.length === 0 };
}
