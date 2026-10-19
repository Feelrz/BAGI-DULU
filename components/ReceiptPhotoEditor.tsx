'use client';
import { PointerEvent, useEffect, useRef, useState } from 'react';
import { Crop, FULL_CROP, preparePhoto } from '../lib/receipt-image';

type Corner = 'nw' | 'ne' | 'sw' | 'se';
export default function ReceiptPhotoEditor({ file, language, onCancel, onConfirm }: { file: Blob; language: 'id' | 'en'; onCancel: () => void; onConfirm: (photo: Blob) => void }) {
  const t = (id: string, en: string) => language === 'id' ? id : en;
  const dialog = useRef<HTMLDialogElement>(null), stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ corner: Corner; x: number; y: number; crop: Crop; width: number; height: number } | null>(null);
  const [rotation, setRotation] = useState(0), [crop, setCrop] = useState<Crop>(FULL_CROP);
  const [source, setSource] = useState<Blob | null>(null), [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true, objectUrl = '';
    setLoading(true); setError(''); setSource(null); setCrop(FULL_CROP);
    preparePhoto(file, rotation).then(photo => {
      if (!active) return;
      objectUrl = URL.createObjectURL(photo); setSource(photo); setUrl(objectUrl);
    }).catch(() => { if (active) setError(t('Foto tidak bisa dibuka. Coba JPG/PNG atau ambil foto baru.', 'This photo could not open. Try JPG/PNG or take a new photo.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  // Language changes do not restart photo decoding.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, rotation]);
  function move(corner: Corner, original: Crop, dx: number, dy: number) {
    const right = original.x + original.width, bottom = original.y + original.height;
    const x = corner.includes('w') ? Math.max(0, Math.min(right - .08, original.x + dx)) : original.x;
    const y = corner.includes('n') ? Math.max(0, Math.min(bottom - .08, original.y + dy)) : original.y;
    const r = corner.includes('e') ? Math.max(x + .08, Math.min(1, right + dx)) : right;
    const b = corner.includes('s') ? Math.max(y + .08, Math.min(1, bottom + dy)) : bottom;
    setCrop({ x, y, width: r - x, height: b - y });
  }
  function start(event: PointerEvent<HTMLButtonElement>, corner: Corner) {
    const rect = stage.current?.getBoundingClientRect(); if (!rect) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { corner, x: event.clientX, y: event.clientY, crop, width: rect.width, height: rect.height };
  }
  async function confirm() {
    if (!source || saving) return;
    setSaving(true); setError('');
    try { onConfirm(await preparePhoto(source, 0, crop)); }
    catch { setSaving(false); setError(t('Foto gagal diproses. Coba lagi.', 'Could not prepare the photo. Please retry.')); }
  }
  const labels: Record<Corner, string> = { nw: t('Sudut kiri atas', 'Top left corner'), ne: t('Sudut kanan atas', 'Top right corner'), sw: t('Sudut kiri bawah', 'Bottom left corner'), se: t('Sudut kanan bawah', 'Bottom right corner') };
  return <dialog ref={dialog} className="sb-camera sb-photo-editor" aria-labelledby="sb-photo-title" onCancel={e => { e.preventDefault(); if (!saving) onCancel(); }}>
    <div className="sb-camera-head"><h2 id="sb-photo-title">{t('Rapikan foto struk.', 'Frame your receipt.')}</h2><button className="icon-btn" type="button" onClick={onCancel} disabled={saving} aria-label={t('Tutup foto', 'Close photo')}>×</button></div>
    <p>{t('Geser empat sudut ke tepi struk. Sertakan nama pesanan, harga, pajak, dan total. Putar jika tulisan menyamping.', 'Drag the four corners to the receipt edges. Include item names, prices, tax, and total. Rotate sideways text.')}</p>
    {loading && <p role="status">{t('Menyiapkan foto…', 'Preparing photo…')}</p>}
    {error && <p className="sb-alert" role="alert">{error}</p>}
    {!loading && source && <><div className="sb-crop-stage" ref={stage}>
      <img src={url} alt={t('Atur area struk yang akan dibaca', 'Adjust the receipt area to recognize')} draggable={false}/>
      <div className="sb-crop-box" style={{ left: crop.x * 100 + '%', top: crop.y * 100 + '%', width: crop.width * 100 + '%', height: crop.height * 100 + '%' }}>
        {(['nw', 'ne', 'sw', 'se'] as Corner[]).map(corner => <button type="button" key={corner} className={'sb-crop-handle sb-crop-' + corner} aria-label={labels[corner]} disabled={saving} onPointerDown={e => start(e, corner)} onPointerMove={e => { const d = drag.current; if (d && e.currentTarget.hasPointerCapture(e.pointerId)) move(d.corner, d.crop, (e.clientX - d.x) / d.width, (e.clientY - d.y) / d.height); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={e => { if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); move(corner, crop, e.key === 'ArrowLeft' ? -.01 : e.key === 'ArrowRight' ? .01 : 0, e.key === 'ArrowUp' ? -.01 : e.key === 'ArrowDown' ? .01 : 0); }}/>)}</div>
    </div><div className="sb-photo-tools"><button type="button" className="ghost-btn" disabled={saving} onClick={() => setRotation(r => (r + 270) % 360)}>↶ {t('Putar kiri', 'Rotate left')}</button><button type="button" className="ghost-btn" disabled={saving} onClick={() => setRotation(r => (r + 90) % 360)}>↷ {t('Putar kanan', 'Rotate right')}</button><button type="button" className="text-btn" disabled={saving} onClick={() => setCrop(FULL_CROP)}>{t('Foto utuh', 'Full photo')}</button></div></>}
    <div className="sb-camera-actions"><button type="button" className="primary-btn" disabled={loading || saving || !source} onClick={confirm}>{saving ? t('Menyiapkan…', 'Preparing…') : t('BACA AREA INI', 'READ THIS AREA')}</button><button type="button" className="ghost-btn" disabled={saving} onClick={onCancel}>{t('Batal', 'Cancel')}</button></div>
    <p className="sb-hint">{t('Buram atau silau? Ambil ulang dengan kamera HP. Foto tajam membantu hasil lebih akurat.', 'Blurry or reflective? Retake with your phone camera. Sharp photos improve accuracy.')}</p>
  </dialog>;
}
