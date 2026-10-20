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
// A median filter suppresses screen/camera speckle without averaging it into
// letter edges. Keep the original as another candidate: thin print may need it.
export function enhanceReceiptPixels(data: Uint8ClampedArray, width: number, height: number) {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(.299 * data[i * 4] + .587 * data[i * 4 + 1] + .114 * data[i * 4 + 2]);
  const neighbors = new Uint8Array(9);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) neighbors[n++] = gray[(y + dy) * width + x + dx];
    neighbors.sort();
    const p = (y * width + x) * 4;
    data[p] = data[p + 1] = data[p + 2] = neighbors[4]; data[p + 3] = 255;
  }
  return data;
}
// Use the same pixel resampling in the browser and OCR regression tests. Canvas
// interpolation varies by engine and can erase the thin strokes of small text.
// Catmull-Rom cubic interpolation retains the original colour and a white border.
export function rasterizeReceipt(data: Uint8ClampedArray, width: number, height: number, targetWidth?: number) {
  const scale = Math.min(Math.max(1, (targetWidth || 1400) / width), 3600 / Math.max(width, height), Math.sqrt(5_000_000 / (width * height)));
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  function kernel(value: number) { const x = Math.abs(value); return x <= 1 ? 1.5 * x ** 3 - 2.5 * x ** 2 + 1 : x < 2 ? -.5 * x ** 3 + 2.5 * x ** 2 - 4 * x + 2 : 0; }
  function weights(source: number, target: number) {
    const ratio = source / target, support = Math.max(1, ratio);
    return Array.from({ length: target }, (_, index) => {
      const center = (index + .5) * ratio - .5, entries: [number, number][] = [];
      let sum = 0;
      for (let i = Math.ceil(center - 2 * support); i <= Math.floor(center + 2 * support); i++) {
        const weight = kernel((center - i) / support);
        if (weight === 0) continue;
        entries.push([Math.max(0, Math.min(source - 1, i)), weight]); sum += weight;
      }
      return entries.map(([i, weight]) => [i, weight / sum] as const);
    });
  }
  const horizontal = new Float32Array(w * height), wx = weights(width, w), wy = weights(height, h);
  const outputWidth = w + 32, outputHeight = h + 32;
  const pixels = new Uint8ClampedArray(outputWidth * outputHeight * 4); pixels.fill(255);
  // Reuse one intermediate channel to limit memory on mobile devices.
  for (let channel = 0; channel < 3; channel++) {
    for (let y = 0; y < height; y++) for (let x = 0; x < w; x++) {
      let sum = 0; for (const [i, weight] of wx[x]) sum += data[(y * width + i) * 4 + channel] * weight;
      horizontal[y * w + x] = sum;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0; for (const [i, weight] of wy[y]) sum += horizontal[i * w + x] * weight;
      pixels[((y + 16) * outputWidth + x + 16) * 4 + channel] = sum;
    }
  }
  return { pixels, width: outputWidth, height: outputHeight };
}
export async function prepareScanImages(file: Blob) {
  const image = await loadImage(file);
  const w = image.naturalWidth, h = image.naturalHeight;
  const source = document.createElement('canvas'); source.width = w; source.height = h;
  const sourceContext = source.getContext('2d', { willReadFrequently: true })!;
  sourceContext.fillStyle = '#fff'; sourceContext.fillRect(0, 0, w, h); sourceContext.drawImage(image, 0, 0);
  const data = sourceContext.getImageData(0, 0, w, h).data;
  async function render(pixels: Uint8ClampedArray) {
    const raster = rasterizeReceipt(pixels, w, h);
    const target = document.createElement('canvas'); target.width = raster.width; target.height = raster.height;
    target.getContext('2d')!.putImageData(new ImageData(raster.pixels as Uint8ClampedArray<ArrayBuffer>, raster.width, raster.height), 0, 0);
    return canvasBlob(target);
  }
  const original = await render(data);
  const enhanced = await render(enhanceReceiptPixels(data, w, h));
  return { original, enhanced };
}
