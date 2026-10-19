export type Crop = { x: number; y: number; width: number; height: number };
export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 };
async function loadImage(file: Blob) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('image');
    return image;
  } finally { URL.revokeObjectURL(url); }
}
export function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('image')), 'image/png'));
}
// Browser decoding respects iPhone EXIF orientation. Keep enough pixels for thin receipt text.
export async function preparePhoto(file: Blob, rotation = 0, crop: Crop = FULL_CROP): Promise<Blob> {
  const image = await loadImage(file);
  const sideways = Math.abs(rotation % 180) === 90;
  const w = sideways ? image.naturalHeight : image.naturalWidth;
  const h = sideways ? image.naturalWidth : image.naturalHeight;
  const scale = Math.min(1, 4000 / Math.max(w, h), Math.sqrt(6_000_000 / (w * h)));
  const source = document.createElement('canvas'); source.width = Math.round(w * scale); source.height = Math.round(h * scale);
  const context = source.getContext('2d'); if (!context) throw new Error('canvas');
  context.fillStyle = '#fff'; context.fillRect(0, 0, source.width, source.height);
  context.translate(source.width / 2, source.height / 2); context.rotate(rotation * Math.PI / 180);
  context.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  const left = Math.max(0, Math.min(.95, crop.x)), top = Math.max(0, Math.min(.95, crop.y));
  const width = Math.max(.05, Math.min(1 - left, crop.width)), height = Math.max(.05, Math.min(1 - top, crop.height));
  const result = document.createElement('canvas'); result.width = Math.max(1, Math.round(source.width * width)); result.height = Math.max(1, Math.round(source.height * height));
  result.getContext('2d')!.drawImage(source, source.width * left, source.height * top, source.width * width, source.height * height, 0, 0, result.width, result.height);
  return canvasBlob(result);
}
// Mild smoothing suppresses camera/screen grain; percentile contrast keeps faint ink.
// The original remains a separate OCR candidate so enhancement cannot discard it.
export function enhanceReceiptPixels(data: Uint8ClampedArray, width: number, height: number) {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(.299 * data[i * 4] + .587 * data[i * 4 + 1] + .114 * data[i * 4 + 2]);
  const smooth = new Uint8Array(gray.length); const histogram = new Uint32Array(256);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const value = Math.round((gray[i] * 4 + gray[y * width + Math.max(0, x - 1)] + gray[y * width + Math.min(width - 1, x + 1)] + gray[Math.max(0, y - 1) * width + x] + gray[Math.min(height - 1, y + 1) * width + x]) / 8);
    smooth[i] = value; histogram[value]++;
  }
  function percentile(percent: number) { let count = 0; for (let i = 0; i < 256; i++) { count += histogram[i]; if (count >= gray.length * percent) return i; } return 255; }
  const low = percentile(.02), high = percentile(.9), range = Math.max(30, high - low);
  for (let i = 0; i < gray.length; i++) { const value = Math.max(0, Math.min(255, (smooth[i] - low) * 255 / range)); data[i * 4] = value; data[i * 4 + 1] = value; data[i * 4 + 2] = value; data[i * 4 + 3] = 255; }
  return data;
}
export async function prepareScanImages(file: Blob) {
  const image = await loadImage(file);
  const w = image.naturalWidth, h = image.naturalHeight;
  const scale = Math.min(Math.max(1, 1400 / w), 3600 / Math.max(w, h), Math.sqrt(5_000_000 / (w * h)));
  const source = document.createElement('canvas'); source.width = w; source.height = h;
  const sourceContext = source.getContext('2d', { willReadFrequently: true })!;
  sourceContext.fillStyle = '#fff'; sourceContext.fillRect(0, 0, w, h); sourceContext.drawImage(image, 0, 0);
  const target = document.createElement('canvas'); target.width = Math.round(w * scale) + 32; target.height = Math.round(h * scale) + 32;
  const context = target.getContext('2d')!;
  function draw() { context.fillStyle = '#fff'; context.fillRect(0, 0, target.width, target.height); context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(source, 16, 16, target.width - 32, target.height - 32); }
  draw(); const original = await canvasBlob(target);
  const pixels = sourceContext.getImageData(0, 0, w, h); enhanceReceiptPixels(pixels.data, w, h); sourceContext.putImageData(pixels, 0, 0);
  draw(); const enhanced = await canvasBlob(target);
  return { original, enhanced };
}
