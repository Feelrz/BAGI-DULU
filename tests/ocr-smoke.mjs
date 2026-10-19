import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createWorker, PSM } from 'tesseract.js';
import ts from 'typescript';
const source = await readFile(new URL('../lib/splitbill.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { parseReceipt } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const worker = await createWorker('eng', 1, { langPath:fileURLToPath(new URL('../public/ocr',import.meta.url)), cacheMethod:'none' });
try {
  await worker.setParameters({tessedit_pageseg_mode: PSM.SINGLE_BLOCK,preserve_interword_spaces:'1',user_defined_dpi:'300'});
  const {data} = await worker.recognize(fileURLToPath(new URL('./fixtures/CONTOH-STRUK.png',import.meta.url)));
  const receipt = parseReceipt(data.text);
  console.log(data.text);
  console.log('OCR confidence:', data.confidence);
  assert.deepEqual(receipt.items.map(i=>i.amount),[50000,10000,20000]);
  assert.equal(receipt.total,82800);assert.equal(receipt.tax,7200);assert.equal(receipt.service,3600);assert.equal(receipt.discount,8000);
  console.log('PASS actual OCR image → text → parsed bill (three items + all totals).');
} finally { await worker.terminate(); }
