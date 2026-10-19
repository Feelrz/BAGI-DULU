import type { Worker } from 'tesseract.js';
import { prepareScanImages } from './receipt-image';
import { recognizeReceipt } from './receipt-recognition';
export type ScanProgress = { status: string; progress: number };
export function readReceipt(blob: Blob, onProgress: (p: ScanProgress) => void) {
  let worker: Worker | undefined, cancelled = false, attempt = 0, progress = 0;
  let rejectCancelled: ((reason: Error) => void) | undefined;
  const cancelPromise = new Promise<never>((_, reject) => { rejectCancelled = reject; });
  const report = (value: number, status: string) => { progress = Math.max(progress, value); if (!cancelled) onProgress({ status, progress }); };
  const job = (async () => {
    report(.02, 'preparing');
    const images = await prepareScanImages(blob);
    if (cancelled) throw new Error('cancelled');
    const { createWorker } = await import('tesseract.js');
    if (cancelled) throw new Error('cancelled');
    try {
      worker = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr',
        logger: (p: ScanProgress) => report(p.status === 'recognizing text' ? .2 + (attempt + (p.progress || 0)) * .25 : .04 + (p.progress || 0) * .14, attempt > 0 ? 'improving' : p.status),
      });
      if (cancelled) throw new Error('cancelled');
      const result = await recognizeReceipt(worker, images, index => { attempt = index; if (cancelled) throw new Error('cancelled'); });
      report(1, 'done'); return result;
    } finally { await worker?.terminate().catch(() => undefined); worker = undefined; }
  })();
  return {
    promise: Promise.race([job, cancelPromise]),
    cancel() { cancelled = true; rejectCancelled?.(new Error('cancelled')); void worker?.terminate().catch(() => undefined); },
  };
}
