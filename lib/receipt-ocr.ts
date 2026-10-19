import type { Worker } from 'tesseract.js';
export type ScanProgress = { status: string; progress: number };
export function readReceipt(blob: Blob, onProgress: (p: ScanProgress) => void) {
  let worker: Worker | undefined;
  let cancelled = false;
  let rejectCancelled: ((reason: Error) => void) | undefined;
  const cancelPromise = new Promise<never>((_, reject) => { rejectCancelled = reject; });
  const job = (async () => {
    const { createWorker, PSM } = await import('tesseract.js');
    if (cancelled) throw new Error('cancelled');
    worker = await createWorker('eng', 1, {
      workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr',
      logger: (p: ScanProgress) => { if (!cancelled) onProgress(p); },
    });
    if (cancelled) { await worker.terminate(); throw new Error('cancelled'); }
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1', user_defined_dpi: '300' });
      const result = await worker.recognize(blob);
      return { text: result.data.text, confidence: result.data.confidence };
    } finally { await worker.terminate().catch(() => undefined); worker = undefined; }
  })();
  return {
    promise: Promise.race([job, cancelPromise]),
    cancel() { cancelled = true; rejectCancelled?.(new Error('cancelled')); void worker?.terminate().catch(() => undefined); },
  };
}
export async function preparePhoto(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('image');
    const scale = Math.min(1, 2600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('image')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
