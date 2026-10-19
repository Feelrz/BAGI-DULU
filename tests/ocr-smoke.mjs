import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';
import { moduleUrl } from './load-ts.mjs';
const { recognizeReceipt, receiptRows } = await import(await moduleUrl('../lib/receipt-recognition.ts'));
const worker = await createWorker('eng', 1, { langPath:fileURLToPath(new URL('../public/ocr',import.meta.url)), cacheMethod:'none' });
try {
  const image = fileURLToPath(new URL('./fixtures/CONTOH-STRUK.png',import.meta.url));
  const result = await recognizeReceipt(worker, {original:image,enhanced:image});
  const receipt = result.receipt;
  assert.deepEqual(receipt.items.map(i=>i.amount),[50000,10000,20000]);
  assert.equal(receipt.total,82800);assert.equal(receipt.tax,7200);assert.equal(receipt.service,3600);assert.equal(receipt.discount,8000);
  assert.equal(result.assessment.usable,true);assert.equal(result.assessment.issues.length,0);
  console.log('PASS actual OCR → candidate selection → bill; confidence',result.confidence);
  const word=(text,x,y)=>({text,bbox:{x0:x,y0:y,x1:x+40,y1:y+20}});
  const words=[word('Kopi',0,10),word('Teh',0,40),word('25,000',160,10),word('10,000',160,40)];
  assert.equal(receiptRows([{paragraphs:[{lines:[{words}]}]}]),'Kopi 25,000\nTeh 10,000');
  console.log('PASS separated name/price columns are reconstructed into rows.');
} finally { await worker.terminate(); }
