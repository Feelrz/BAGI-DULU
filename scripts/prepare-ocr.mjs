import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdir, readdir, copyFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const destination = new URL('../public/ocr/', import.meta.url);
await mkdir(destination, { recursive: true });
const core = dirname(require.resolve('tesseract.js-core/package.json'));
for (const name of await readdir(core)) {
  if (name.endsWith('.wasm') || name.endsWith('.wasm.js') || name === 'LICENSE') await copyFile(join(core, name), new URL(name, destination));
}
const library = dirname(require.resolve('tesseract.js/package.json'));
for (const name of ['worker.min.js', 'worker.min.js.LICENSE.txt']) await copyFile(join(library, 'dist', name), new URL(name, destination));
const data = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
await copyFile(join(data, '4.0.0_best_int', 'eng.traineddata.gz'), new URL('eng.traineddata.gz', destination));
console.log('OCR assets ready at /ocr (same origin; receipt images stay on the device).');
