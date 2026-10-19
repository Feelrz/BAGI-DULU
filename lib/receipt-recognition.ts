import type { Worker, ImageLike, Block } from 'tesseract.js';
import { assessReceipt, parseReceipt } from './splitbill';
// Column layouts can emit all names before all prices. Rejoin words by their Y coordinate.
export function receiptRows(blocks: Block[] | null | undefined) {
  const words = (blocks || []).flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words))).filter(w => w.text.trim());
  const rows: { y: number; height: number; words: typeof words }[] = [];
  for (const word of words.sort((a, b) => (a.bbox.y0 + a.bbox.y1) - (b.bbox.y0 + b.bbox.y1))) {
    const height = word.bbox.y1 - word.bbox.y0, y = (word.bbox.y0 + word.bbox.y1) / 2;
    const row = rows.find(r => Math.abs(r.y - y) <= Math.max(4, Math.min(r.height, height) * .55));
    if (row) { row.y = (row.y * row.words.length + y) / (row.words.length + 1); row.height = Math.max(row.height, height); row.words.push(word); }
    else rows.push({ y, height, words: [word] });
  }
  return rows.sort((a, b) => a.y - b.y).map(r => r.words.sort((a, b) => a.bbox.x0 - b.bbox.x0).map(w => w.text).join(' ')).join('\n');
}
export async function recognizeReceipt(worker: Worker, images: { original: ImageLike; enhanced: ImageLike }, onAttempt: (attempt: number) => void = () => {}) {
  let best: { text: string; confidence: number; receipt: ReturnType<typeof parseReceipt>; assessment: ReturnType<typeof assessReceipt> } | undefined;
  const attempts = [{ image: images.original, mode: '6', threshold: '0' }, { image: images.enhanced, mode: '6', threshold: '2' }, { image: images.original, mode: '4', threshold: '2' }];
  for (let i = 0; i < attempts.length; i++) {
    onAttempt(i);
    const attempt = attempts[i];
    await worker.setParameters({ tessedit_pageseg_mode: attempt.mode as Parameters<Worker['setParameters']>[0]['tessedit_pageseg_mode'], thresholding_method: attempt.threshold, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    const { data } = await worker.recognize(attempt.image, { rotateAuto: true }, { text: true, blocks: true });
    for (const text of [data.text, receiptRows(data.blocks)]) {
      const receipt = parseReceipt(text), assessment = assessReceipt(receipt, data.confidence);
      if (!best || assessment.score > best.assessment.score) best = { text, confidence: data.confidence, receipt, assessment };
    }
    if (best && best.assessment.issues.length === 0 && best.confidence >= 80) break;
  }
  if (!best) throw new Error('empty');
  return best;
}
