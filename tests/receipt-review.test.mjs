import assert from 'node:assert/strict';
import { moduleUrl } from './load-ts.mjs';
const { parseReceipt, assessReceipt } = await import(await moduleUrl('../lib/splitbill.ts'));
const { createReceiptReview, validateReceiptReview } = await import(await moduleUrl('../lib/receipt-review.ts'));
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
const fixture = () => parseReceipt('Sup Ayam 2 47,274\nNasi Putih 2 14,548\nEs Teh Manis 2 16,364\nITEMS: 6 78,186\nPbl 10% 7,819\nRounding -5\nTotal 86,000');
test('Review keeps the exact receipt total including negative rounding', () => {
  const r = validateReceiptReview(createReceiptReview(fixture()));
  assert.equal(r.valid, true); assert.equal(r.calculated, 86000); assert.equal(r.difference, 0);
  assert.equal(r.receipt.items[0].quantity, 2); assert.equal(r.receipt.rounding, -5);
});
test('Editing and removing review rows never mutates original OCR data', () => {
  const original = fixture(), snapshot = JSON.stringify(original), draft = createReceiptReview(original);
  draft.items[0].name = 'Edited'; draft.items.splice(1, 1); draft.total = '999';
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(validateReceiptReview(draft).valid, false);
});
test('Price corrections recalculate both subtotal and total before import', () => {
  const draft = createReceiptReview(fixture()); draft.items[0].amount = '47275';
  let r = validateReceiptReview(draft);
  assert.equal(r.difference, 1); assert.deepEqual(r.issues, ['subtotal', 'total']); assert.equal(r.valid, false);
  draft.items[0].amount = 'Rp 47.274'; r = validateReceiptReview(draft);
  assert.equal(r.valid, true); assert.equal(r.receipt.items[0].amount, 47274);
});
test('Unreadable names and invalid quantities or amounts have field-specific errors', () => {
  const draft = createReceiptReview(fixture()), item = draft.items[0];
  item.name = 'le EEE EEE'; item.quantity = '1.5'; item.amount = '3';
  let r = validateReceiptReview(draft);
  assert.deepEqual(r.itemErrors[item.id], ['name', 'quantity', 'amount']); assert.equal(r.valid, false);
  item.name = 'Sup Ayam'; item.quantity = '2'; item.amount = '';
  r = validateReceiptReview(draft); assert.deepEqual(r.itemErrors[item.id], ['amount']);
});
test('An absent total, invalid charges and excessive rounding cannot be confirmed', () => {
  const draft = createReceiptReview(fixture()); draft.total = '';
  assert(validateReceiptReview(draft).amountErrors.includes('total'));
  draft.total = '86000'; draft.tax = '-7819'; draft.rounding = '-10001';
  const r = validateReceiptReview(draft); assert.equal(r.valid, false); assert.deepEqual(r.amountErrors, ['tax', 'rounding']);
});
test('Missing rows can be added and totals must reconcile again', () => {
  const draft = createReceiptReview(fixture()), removed = draft.items.pop();
  assert.equal(validateReceiptReview(draft).valid, false);
  draft.items.push(removed); assert.equal(validateReceiptReview(draft).valid, true);
});
test('Leading quantities preserve numbers in product names and sizes', () => {
  const p = parseReceipt('1 SGL Monkey 47 130.00\n2 Petrus 2009 198000.00\n5 Still Water 800 250.00\n2 Es Teh 5.000 10.000');
  assert.deepEqual(p.items.map(i => [i.name, i.quantity]), [['SGL Monkey 47',1],['Petrus 2009',2],['Still Water 800',5],['Es Teh',2]]);
});
test('Address, card payment and category summaries do not become items', () => {
  const p = parseReceipt('Jumeirah P.O BOX 73024\nCard No 9990004000\nKopi 25000\nCharged Tips 5000\nAmerican Exp 30000\nFood 25000\nTips 5000\nTotal 30000\nVAT 5% 1500');
  assert.deepEqual(p.items.map(i=>i.name), ['Kopi']); assert.equal(p.service, 5000); assert.equal(p.tax, 0); assert.equal(p.total, 30000);
});
test('Overseas receipt hints block silent import as rupiah even when totals match', () => {
  for (const heading of ['Currency AED', 'Jumeirah, Dubai P.O BOX 73024\nTRN#100306654300003']) {
    const p = parseReceipt(heading+'\nSteak 1000.00\nTotal 1000.00');
    assert.equal(p.currencyWarning, true); assert.equal(assessReceipt(p,99).usable, false);
    const r = validateReceiptReview(createReceiptReview(p)); assert.equal(r.valid, false); assert(r.issues.includes('currency'));
  }
  assert.equal(fixture().currencyWarning, undefined);
});
console.log('\n' + count + ' receipt review test groups passed.');
