import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../lib/splitbill.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { newBill, calculateBill, allocate, parseReceipt, parseReceiptMoney, normalizeBill } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
const a = { id: 'a', name: 'Ayu' }, b = { id: 'b', name: 'Bimo' }, c = { id: 'c', name: 'Caca' };
const item = (id, amount, people, quantity = 1) => ({ id, name: id, amount, personIds: people, quantity });
const bill = overrides => ({ ...newBill(), people: [a,b,c], items: [item('Food', 100_000, ['a','b','c'])], ...overrides });
test('Indonesian and English currency formatting', () => {
  for (const [s,n] of [['Rp 25.000',25000],['25,000',25000],['25.000,00',25000],['25,000.00',25000],['25000.00',25000],['Rp1.000.000',1000000],['-5.000',-5000],['1.234,50',1235]]) assert.equal(parseReceiptMoney(s),n,s);
  assert.equal(parseReceiptMoney('unreadable'), null);
});
test('Equal split conserves the receipt total', () => {
  const r = calculateBill(bill({ mode: 'equal' }));
  assert.deepEqual(r.parts.map(p=>p.amount), [33334,33333,33333]); assert.equal(r.valid,true);
});
test('Shared items and percentage fees follow consumption', () => {
  const r = calculateBill(bill({ people: [a,b], items: [item('A',60000,['a']),item('B',30000,['b']),item('Shared',10000,['a','b'])], discount: {mode:'percent',value:10}, service:{mode:'percent',value:5}, tax:{mode:'percent',value:10}, taxOnService:true }));
  assert.equal(r.total,103950); assert.deepEqual(r.parts.map(p=>p.amount),[67568,36382]);
});
test('Tax base toggle changes the total predictably', () => {
  const data=bill({tax:{mode:'percent',value:10},service:{mode:'percent',value:10}});
  assert.equal(calculateBill(data).total,120000); assert.equal(calculateBill({...data,taxOnService:true}).total,121000);
});
test('Line totals are not multiplied by quantity twice', () => {
  assert.equal(calculateBill(bill({items:[item('Two coffees',50000,['a','b'],2)]})).total,50000);
});
test('Never rounds each shared item before adding shares', () => {
  const r=calculateBill(bill({people:[a,b],items:[item('One',1,['a','b']),item('Two',1,['a','b'])]}));
  assert.deepEqual(r.parts.map(p=>p.amount),[1,1]);
});
test('People with no consumption owe zero, including fees', () => {
  const r=calculateBill(bill({items:[item('Only Ayu',30000,['a'])],extra:5000}));
  assert.deepEqual(r.parts.map(p=>p.amount),[35000,0,0]);
});
test('Unassigned items block finalizing a bill', () => {
  const r=calculateBill(bill({items:[item('Unknown',12000,[])]})); assert.equal(r.valid,false); assert.equal(r.unassigned,1);
});
test('Scanned bills need explicit review and exact reconciliation', () => {
  const d=bill({fromScan:true,reviewed:false,expectedTotal:99000});
  assert.deepEqual(calculateBill(d).issues,['review','mismatch']);
  assert.equal(calculateBill({...d,reviewed:true,expectedTotal:100000}).valid,true);
});
test('Invalid participant names and excessive discounts are rejected', () => {
  assert(calculateBill(bill({people:[a,{...b,name:' ayu '}]})).issues.includes('duplicateNames'));
  assert(calculateBill(bill({discount:{mode:'amount',value:100001}})).issues.includes('discount'));
});
test('Allocation invariants for 1000 different bill amounts', () => {
  for(let i=0;i<1000;i++) {
    const total=(i*7919)%1_000_000; const weights=[i%17,(i*11)%23,(i*3)%19]; const parts=allocate(total,weights);
    assert.equal(parts.reduce((s,n)=>s+n,0),total); assert(parts.every(n=>Number.isSafeInteger(n)&&n>=0));
    if(weights.some(n=>n>0)) weights.forEach((n,j)=>{if(n===0) assert.equal(parts[j],0)});
  }
});
test('Receipt items, mixed price layouts, tax, discount, service, and tender', () => {
  const p=parseReceipt('WARUNG UJI\nNasi Goreng 2 x 25.000 50.000\n2 Es Teh 5.000 10.000\nKentang Goreng 1 20,000.00\nSubtotal 80.000\nDiskon 10% 8.000\nService 5% 3.600\nPajak 10% 7.200\nTOTAL 82.800\nCash 100.000\nKembalian 17.200');
  assert.equal(p.items.length,3); assert.equal(p.items[0].quantity,2); assert.equal(p.items[0].amount,50000); assert.equal(p.items[1].name,'Es Teh');
  assert.equal(p.subtotal,80000); assert.equal(p.total,82800); assert.equal(p.discount,8000); assert.equal(p.service,3600); assert.equal(p.tax,7200);
});
test('Receipt supports a name followed by a quantity-price row', () => {
  const p=parseReceipt('Nasi Goreng\n2 x 25000 50000\nTOTAL 50000');
  assert.equal(p.items.length,1); assert.equal(p.items[0].name,'Nasi Goreng'); assert.equal(p.items[0].quantity,2);
});
test('Receipt addresses, dates, contact info, and payments are not items', () => {
  const p=parseReceipt('Jl. Merdeka 123\nTelp 081234567890\n19/10/2026 17:30\nMeja 12\nKasir 3\nEs Kopi 25000\nGrand Total 25000\nQRIS 25000');
  assert.equal(p.items.length,1); assert.equal(p.items[0].name,'Es Kopi');
});
test('Corrupt imports cannot retain orphan or duplicate participant IDs', () => {
  const n=normalizeBill(bill({people:[a,a,b],items:[item('I',-2,['a','a','missing'])],payerId:'missing'}));
  assert.equal(n.people.length,2); assert.deepEqual(n.items[0].personIds,['a']); assert.equal(n.items[0].amount,0); assert.equal(n.payerId,'');
  assert.equal(normalizeBill(null),null); assert.equal(normalizeBill({}),null);
});
console.log('\n' + count + ' test groups passed.');
