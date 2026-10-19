'use client';
import { ChangeEvent, Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { BillItem, Charge, SplitBill, calculateBill, newBill, newId, parseReceipt, rupiah } from '../lib/splitbill';
import { preparePhoto, readReceipt } from '../lib/receipt-ocr';

type Props = { language: 'id' | 'en'; draft: SplitBill; onDraft: Dispatch<SetStateAction<SplitBill>>; history: SplitBill[]; onHistory: Dispatch<SetStateAction<SplitBill[]>>; flash: (s: string) => void };
export default function SplitBillPanel({ language, draft: b, onDraft, history, onHistory, flash }: Props) {
  const t = (id: string, en: string) => language === 'id' ? id : en;
  const money = (n: number) => new Intl.NumberFormat(language === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const [rawText, setRawText] = useState('');
  const [scanNote, setScanNote] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [shareText, setShareText] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const scanToken = useRef(0);
  const cameraToken = useRef(0);
  const result = useMemo(() => calculateBill(b), [b]);
  const patch = (data: Partial<SplitBill>) => { onDraft(current => ({ ...current, ...data })); setShareText(''); };
  const updateItem = (id: string, data: Partial<BillItem>) => onDraft(current => ({ ...current, items: current.items.map(i => i.id === id ? { ...i, ...data } : i) }));

  useEffect(() => () => { scanToken.current++; cameraToken.current++; cancelRef.current?.(); streamRef.current?.getTracks().forEach(track => track.stop()); }, []);
  useEffect(() => { if (!preview) return; return () => URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { setShareText(''); }, [b, language]);
  useEffect(() => {
    if (!cameraOpen) return;
    dialogRef.current?.showModal();
    let live = true;
    (async () => {
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        try { await videoRef.current.play(); if (live) setCameraReady(true); } catch { if (live) setError(t('Kamera belum siap. Coba foto melalui kamera HP atau unggah gambar.', 'Camera is not ready. Try your phone camera or upload a photo.')); }
      }
    })();
    return () => { live = false; };
  // The camera stream is assigned before opening the dialog.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  function closeCamera() {
    cameraToken.current++;
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    dialogRef.current?.close(); setCameraOpen(false); setCameraReady(false);
  }
  async function openCamera() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { captureRef.current?.click(); return; }
    const token = ++cameraToken.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 2560 } }, audio: false });
      if (token !== cameraToken.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = stream; setCameraOpen(true);
    } catch {
      setError(t('Kamera tidak bisa dibuka. Izinkan kamera di browser, pakai Kamera HP, atau unggah foto struk.', 'Camera could not open. Allow camera access, use Phone camera, or upload a receipt.'));
    }
  }
  async function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .95));
    closeCamera();
    if (blob) await scan(blob);
  }
  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError(t('Maksimal 20 MB. Pilih foto yang lebih kecil.', 'Maximum 20 MB. Choose a smaller image.')); return; }
    if (file.type && !file.type.startsWith('image/')) { setError(t('Pilih foto struk JPG, PNG, atau WebP.', 'Choose a JPG, PNG, or WebP receipt photo.')); return; }
    await scan(file);
  }
  async function scan(file: Blob) {
    if (b.items.length && !window.confirm(t('Ganti daftar item dan biaya saat ini dengan hasil scan baru? Nama peserta tetap disimpan.', 'Replace the current items and charges with a new scan? Participants will be kept.'))) return;
    const token = ++scanToken.current;
    setBusy(true); setProgress(0); setError(''); setScanNote(''); setConfidence(null); setRawText('');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const photo = await preparePhoto(file);
      if (token !== scanToken.current) return;
      setPreview(URL.createObjectURL(photo));
      const job = readReceipt(photo, p => { if (token === scanToken.current) setProgress(p.status === 'recognizing text' ? 20 + Math.round((p.progress || 0) * 80) : Math.round((p.progress || 0) * 18)); });
      cancelRef.current = job.cancel;
      timeout = setTimeout(() => { job.cancel(); if (token === scanToken.current) setError(t('Scan terlalu lama. Coba foto lebih kecil atau isi manual.', 'Scan timed out. Try a smaller photo or enter it manually.')); }, 120_000);
      const scanned = await job.promise;
      if (token !== scanToken.current) return;
      const parsed = parseReceipt(scanned.text);
      setRawText(scanned.text); setConfidence(scanned.confidence);
      if (!parsed.items.length) { setError(t('Item belum terbaca. Coba foto lebih dekat, lurus, dan terang, atau isi manual. Data sebelumnya tetap ada.', 'No items detected. Try a closer, straight, well-lit photo or enter manually. Your previous entries are intact.')); return; }
      onDraft(current => ({ ...current, items: parsed.items, discount: { value: parsed.discount, mode: 'amount' }, service: { value: parsed.service, mode: 'amount' }, tax: { value: parsed.tax, mode: 'amount' }, extra: 0, taxOnService: false, expectedTotal: parsed.total, fromScan: true, reviewed: false }));
      const sumsDiffer = parsed.subtotal !== null && parsed.items.reduce((s, i) => s + i.amount, 0) !== parsed.subtotal;
      setScanNote(sumsDiffer ? t('Jumlah item berbeda dari subtotal struk. Periksa item yang terlewat atau terbaca ganda.', 'Item sum differs from receipt subtotal. Check missing or duplicate items.') : t('Hasil scan masuk ke form. Cocokkan nama, jumlah, harga, dan biaya dengan foto.', 'Scan added to the form. Check names, quantities, prices, and charges against the photo.'));
    } catch (e) {
      if (token === scanToken.current && (e as Error).message !== 'cancelled') setError(t('Scan gagal. Pastikan koneksi tersedia saat memuat pemindai. Untuk foto HEIC, coba JPG atau ambil foto baru. Input manual tetap bisa dipakai.', 'Scan failed. Make sure you are online while loading the scanner. For HEIC, try JPG or take a new photo. Manual entry is available.'));
    } finally {
      if (timeout) clearTimeout(timeout);
      if (token === scanToken.current) { setBusy(false); cancelRef.current = null; }
    }
  }
  function cancelScan() { scanToken.current++; cancelRef.current?.(); cancelRef.current = null; setBusy(false); setError(t('Scan dibatalkan. Data sebelumnya tetap ada.', 'Scan cancelled. Previous entries are intact.')); }
  function addPerson() {
    const name = newName.trim(); if (!name || b.people.length >= 30) return;
    if (b.people.some(p => p.name.toLowerCase() === name.toLowerCase())) { flash(t('Nama sudah ada. Pakai nama yang berbeda.', 'That name is already used. Choose another.')); return; }
    patch({ people: [...b.people, { id: newId(), name }] }); setNewName('');
  }
  function removePerson(id: string) {
    patch({ people: b.people.filter(p => p.id !== id), items: b.items.map(i => ({ ...i, personIds: i.personIds.filter(p => p !== id) })), payerId: b.payerId === id ? '' : b.payerId });
  }
  function addItem(quick = false) {
    if (b.items.length >= 150) return;
    patch({ items: [...b.items, { id: newId(), name: quick ? t('Total tagihan', 'Bill total') : '', quantity: 1, amount: 0, personIds: b.people.map(p => p.id) }], ...(quick ? { mode: 'equal' as const } : {}) });
  }
  function resetDraft() {
    if (b.items.length && !window.confirm(t('Mulai tagihan baru? Simpan dulu jika draft ini masih diperlukan.', 'Start a new bill? Save first if you need this draft.'))) return;
    onDraft(newBill()); setPreview(''); setRawText(''); setScanNote(''); setConfidence(null); setError('');
  }
  function save() {
    if (!result.valid) return;
    const bill = { ...b, title: b.title.trim() || t('Patungan', 'Split bill'), savedAt: new Date().toISOString() };
    onHistory(current => [bill, ...current.filter(x => x.id !== b.id)].slice(0, 40));
    onDraft(bill); flash(t('Patungan tersimpan di perangkat ini.', 'Split bill saved on this device.'));
  }
  function makeShareText() {
    const payer = b.people.find(p => p.id === b.payerId);
    const lines = ['BAGI DULU — ' + (b.title || t('Patungan', 'Split bill')), b.date, ''];
    for (const item of b.items) {
      const who = b.mode === 'equal' ? t('semua', 'everyone') : b.people.filter(p => item.personIds.includes(p.id)).map(p => p.name).join(', ');
      lines.push(item.quantity + ' × ' + item.name + ' — ' + money(item.amount) + ' (' + who + ')');
    }
    lines.push('', 'Subtotal: ' + money(result.subtotal), t('Diskon: ', 'Discount: ') + money(result.discount), 'Service: ' + money(result.service), t('Pajak: ', 'Tax: ') + money(result.tax), t('Biaya lain: ', 'Other fees: ') + money(result.extra), 'TOTAL: ' + money(result.total), '', t('BAGIAN MASING-MASING', 'EACH PERSON'));
    result.parts.forEach(p => lines.push(p.name + ': ' + money(p.amount)));
    if (payer) {
      lines.push('', t('Ditalangi oleh ', 'Paid upfront by ') + payer.name);
      result.parts.filter(p => p.id !== payer.id && p.amount > 0).forEach(p => lines.push(p.name + ' → ' + payer.name + ': ' + money(p.amount)));
    }
    lines.push('', t('Biaya dibagi proporsional. Selisih pembulatan Rp1 dialokasikan agar total pas.', 'Fees split proportionally. Rp1 rounding differences allocated so the total matches.'));
    return lines.join('\n');
  }
  async function copy() {
    if (!result.valid) return;
    const text = makeShareText();
    try { await navigator.clipboard.writeText(text); flash(t('Rincian disalin. Tinggal tempel ke chat.', 'Copied. Paste it into your chat.')); }
    catch { setShareText(text); }
  }
  const issueText: Record<string, string> = {
    people: t('Tambahkan minimal 2 orang.', 'Add at least 2 people.'), names: t('Lengkapi semua nama.', 'Fill in every name.'), duplicateNames: t('Gunakan nama berbeda untuk tiap orang.', 'Use distinct names for each person.'), items: t('Tambahkan item atau total tagihan.', 'Add items or the bill total.'), itemDetails: t('Lengkapi nama dan harga setiap item.', 'Complete every item name and price.'), unassigned: t('Ada item yang belum dibagi ke siapa pun.', 'Some items have no participants.'), discount: t('Diskon tidak boleh melebihi subtotal.', 'Discount cannot exceed the subtotal.'), review: t('Periksa dan konfirmasi hasil scan.', 'Review and confirm the scanned receipt.'), mismatch: t('Cocokkan hitungan dengan total struk.', 'Reconcile the calculation with the receipt total.'), limit: t('Maksimal total Rp1 miliar per tagihan.', 'Maximum total is Rp1 billion per bill.'),
  };
  return <section className="page sb-page">
    <div className="sb-hero"><div><span className="eyebrow">BAGI DULU · SPLIT BILL</span><h1 className="page-title">{t('makan bareng.', 'eat together.')}<br/><em>{t('hitungnya beres.', 'split it right.')}</em></h1><p>{t('Foto struk atau ketik sendiri. Siapa pesan apa, siapa bayar berapa — kebaca semua.', 'Snap a receipt or type it in. Who ordered what, who owes how much — all sorted.')}</p></div><button type="button" className="ghost-btn" disabled={busy} onClick={resetDraft}>+ {t('TAGIHAN BARU', 'NEW BILL')}</button></div>
    <input hidden ref={uploadRef} type="file" accept="image/*" onChange={pickFile}/><input hidden ref={captureRef} type="file" accept="image/*" capture="environment" onChange={pickFile}/>
    <div className="sb-entry-grid">
      <button className="sb-entry sb-entry-scan" type="button" disabled={busy} onClick={openCamera}><CameraIcon/><span><strong>{t('scan struk.', 'scan receipt.')}</strong><small>{t('Buka kamera, foto, otomatis terisi.', 'Open camera, snap, autofill.')}</small></span><b aria-hidden="true">↗</b></button>
      <button className="sb-entry" type="button" disabled={busy} onClick={() => uploadRef.current?.click()}><span className="sb-entry-icon" aria-hidden="true">↥</span><span><strong>{t('unggah foto.', 'upload photo.')}</strong><small>{t('Ambil struk dari galeri.', 'Pick a receipt from your gallery.')}</small></span><b aria-hidden="true">↗</b></button>
      <button className="sb-entry" type="button" disabled={busy} onClick={() => { if (!b.items.length) addItem(); document.getElementById('sb-items')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><span className="sb-entry-icon" aria-hidden="true">＋</span><span><strong>{t('isi manual.', 'type it in.')}</strong><small>{t('Tanpa struk? Tetap bisa patungan.', 'No receipt? Still split the bill.')}</small></span><b aria-hidden="true">↗</b></button>
    </div>
    <p className="sb-privacy">{t('Foto diproses di perangkat ini. Tidak diunggah. Pemindai perlu koneksi saat pertama dimuat.', 'Photos are processed on this device, never uploaded. The scanner needs a connection on first load.')} <button className="text-btn" type="button" disabled={busy} onClick={() => captureRef.current?.click()}>{t('Kamera HP ↗', 'Phone camera ↗')}</button></p>
    {busy && <div className="sb-progress" role="status"><span>{t('Lagi baca struk…', 'Reading your receipt…')} {progress}%</span><progress max="100" value={progress}/><button className="ghost-btn" type="button" onClick={cancelScan}>{t('Batalkan', 'Cancel')}</button></div>}
    {error && <p className="sb-alert" role="alert">{error}</p>}
    {preview && <details className="sb-scan-preview" open={b.fromScan && !b.reviewed}><summary>{t('Lihat foto & hasil pembacaan', 'View photo & recognized text')}{confidence !== null && confidence < 75 ? t(' · hasil kurang jelas', ' · low clarity') : ''}</summary><div><img src={preview} alt={t('Foto struk yang dipilih', 'Selected receipt photo')}/><section><p>{scanNote}</p>{confidence !== null && confidence < 75 && <p className="sb-alert">{t('Sebagian tulisan kurang jelas. Cek setiap nominal dengan teliti.', 'Some text is unclear. Check every amount carefully.')}</p>}<pre>{rawText || t('Belum ada teks terbaca.', 'No text recognized yet.')}</pre></section></div></details>}
    <fieldset className="sb-workspace" disabled={busy}><legend className="sb-sr-only">{t('Editor patungan', 'Split bill editor')}</legend><div className="sb-editor">
      <div className="sb-card"><div className="sb-card-head"><span className="sb-step">01</span><div><span className="eyebrow">{t('SIAPA AJA?', 'WHO IS IN?')}</span><h2>{t('mejanya rame berapa?', 'who is at the table?')}</h2></div></div>
        <div className="sb-metadata"><label className="sb-field"><span>{t('Nama tagihan', 'Bill name')}</span><input value={b.title} maxLength={80} placeholder={t('Mis. Makan malam bareng', 'e.g. Dinner with friends')} onChange={e => patch({ title: e.target.value })}/></label><label className="sb-field"><span>{t('Tanggal', 'Date')}</span><input type="date" value={b.date} onChange={e => patch({ date: e.target.value })}/></label></div>
        <form className="sb-add-person" onSubmit={e => { e.preventDefault(); addPerson(); }}><label className="sb-field"><span>{t('Nama peserta', 'Participant name')}</span><input value={newName} maxLength={40} placeholder={t('Ketik nama, lalu Enter', 'Type a name, press Enter')} onChange={e => setNewName(e.target.value)}/></label><button className="primary-btn" type="submit" disabled={!newName.trim() || b.people.length >= 30}>+ {t('Tambah', 'Add')}</button></form>
        <div className="sb-people">{b.people.map((p, i) => <div className="sb-person" key={p.id}><span className="sb-avatar">{String(i + 1).padStart(2, '0')}</span><input aria-label={t('Nama peserta ', 'Participant name ') + (i + 1)} value={p.name} maxLength={40} onChange={e => patch({ people: b.people.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) })}/><button type="button" onClick={() => removePerson(p.id)} aria-label={t('Hapus ', 'Remove ') + p.name}>×</button></div>)}</div>
        {!b.people.length && <p className="sb-hint">{t('Mulai dari nama lo, lalu teman-teman. Maksimal 30 orang.', 'Start with you, then your friends. Up to 30 people.')}</p>}
      </div>
      <div className="sb-card" id="sb-items"><div className="sb-card-head"><span className="sb-step">02</span><div><span className="eyebrow">{t('DAFTAR PESANAN', 'THE ORDER')}</span><h2>{t('siapa pesan apa?', 'who ordered what?')}</h2></div><span className="sb-count">{b.items.length} {t('item', 'items')}</span></div>
        <div className="sb-mode" aria-label={t('Cara membagi', 'Split method')}><button type="button" aria-pressed={b.mode === 'items'} onClick={() => patch({ mode: 'items' })}>{t('Sesuai pesanan', 'By item')}</button><button type="button" aria-pressed={b.mode === 'equal'} onClick={() => patch({ mode: 'equal' })}>{t('Bagi rata', 'Split equally')}</button></div>
        <p className="sb-hint">{b.mode === 'items' ? t('Pilih nama di bawah setiap item. Satu item bersama dibagi rata ke nama yang dipilih.', 'Choose names under each item. Shared items are split equally among selected people.') : t('Seluruh tagihan dibagi rata ke semua peserta.', 'The entire bill is split equally among all participants.')}</p>
        {!b.items.length && <div className="sb-empty"><span aria-hidden="true">＋</span><strong>{t('struknya belum mampir.', 'nothing on the table yet.')}</strong><p>{t('Scan di atas, tambah item, atau langsung masukkan total untuk bagi rata.', 'Scan above, add an item, or enter the total to split equally.')}</p><button className="ghost-btn" type="button" onClick={() => addItem(true)}>{t('Cukup masukkan total', 'Just enter the total')}</button></div>}
        {b.items.map((item, index) => <article className="sb-item" key={item.id}><div className="sb-item-fields"><label className="sb-field sb-item-name"><span>{String(index + 1).padStart(2, '0')} · {t('Nama item', 'Item name')}</span><input value={item.name} maxLength={80} placeholder={t('Mis. Nasi goreng', 'e.g. Fried rice')} onChange={e => updateItem(item.id, { name: e.target.value })}/></label><label className="sb-field"><span>{t('Jumlah', 'Qty')}</span><input type="number" inputMode="numeric" min="1" max="999" value={item.quantity} onChange={e => updateItem(item.id, { quantity: Math.max(1, Math.min(999, Math.round(Number(e.target.value) || 1))) })}/></label><label className="sb-field"><span>{t('Total baris · Rp', 'Line total · Rp')}</span><input type="number" inputMode="numeric" min="0" max="1000000000" step="1" value={item.amount || ''} placeholder="0" onChange={e => updateItem(item.id, { amount: rupiah(e.target.value) })}/></label><button type="button" className="sb-remove" aria-label={t('Hapus item ', 'Delete item ') + (index + 1)} onClick={() => patch({ items: b.items.filter(i => i.id !== item.id) })}>×</button></div>
          {b.mode === 'items' && <div className="sb-assign">{b.people.map(p => <button key={p.id} type="button" aria-pressed={item.personIds.includes(p.id)} onClick={() => updateItem(item.id, { personIds: item.personIds.includes(p.id) ? item.personIds.filter(id => id !== p.id) : [...item.personIds, p.id] })}>{item.personIds.includes(p.id) && <span aria-hidden="true">✓ </span>}{p.name || '…'}</button>)}{b.people.length > 0 && <button type="button" className="sb-everyone" onClick={() => updateItem(item.id, { personIds: b.people.map(p => p.id) })}>{t('Semua', 'Everyone')}</button>}{!item.personIds.length && <small>{t('Pilih yang ikut bayar', 'Choose who shares this')}</small>}</div>}
        </article>)}
        <div className="sb-item-footer"><button type="button" className="ghost-btn" disabled={b.items.length >= 150} onClick={() => addItem()}>+ {t('Tambah item', 'Add item')}</button><p>{t('Total baris = harga untuk seluruh jumlah. Angka ini tidak dikali jumlah lagi.', 'Line total = price for the entire quantity. It is not multiplied by quantity again.')}</p></div>
      </div>
      <div className="sb-card"><div className="sb-card-head"><span className="sb-step">03</span><div><span className="eyebrow">{t('BIAR PAS', 'THE FINAL DETAILS')}</span><h2>{t('pajak & teman-temannya.', 'the little extras.')}</h2></div></div>
        <div className="sb-charges"><ChargeField label={t('Diskon', 'Discount')} value={b.discount} onChange={discount => patch({ discount })} language={language}/><ChargeField label="Service" value={b.service} onChange={service => patch({ service })} language={language}/><ChargeField label={t('Pajak', 'Tax')} value={b.tax} onChange={tax => patch({ tax })} language={language}/><label className="sb-field"><span>{t('Biaya lain · Rp', 'Other fees · Rp')}</span><input type="number" inputMode="numeric" min="0" max="1000000000" value={b.extra || ''} placeholder="0" onChange={e => patch({ extra: rupiah(e.target.value) })}/></label></div>
        <label className="sb-check"><input type="checkbox" checked={b.taxOnService} onChange={e => patch({ taxOnService: e.target.checked })}/><span>{t('Pajak persentase juga dihitung dari service.', 'Percentage tax also applies to the service charge.')}</span></label>
        <p className="sb-hint">{t('Diskon mengurangi subtotal. Service % dihitung sesudah diskon. Biaya dibagi mengikuti porsi pesanan; mode bagi rata membagi semuanya sama rata. Isi nominal final jika struk memakai dasar hitung lain.', 'Discount reduces the subtotal. Service % uses the discounted subtotal. Fees follow each order share; equal mode splits everything equally. Use final amounts if your receipt uses another basis.')}</p>
        <div className="sb-metadata"><label className="sb-field"><span>{t('Total di struk · Rp (opsional)', 'Receipt total · Rp (optional)')}</span><input type="number" inputMode="numeric" min="0" max="1000000000" placeholder={t('Untuk cek selisih', 'For reconciliation')} value={b.expectedTotal ?? ''} onChange={e => patch({ expectedTotal: e.target.value === '' ? null : rupiah(e.target.value) })}/></label><label className="sb-field"><span>{t('Siapa yang nalangin?', 'Who paid upfront?')}</span><select value={b.payerId} onChange={e => patch({ payerId: e.target.value })}><option value="">{t('Belum ditentukan', 'Not selected')}</option>{b.people.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label></div>
        {b.fromScan && <label className="sb-check sb-review"><input type="checkbox" checked={b.reviewed} onChange={e => patch({ reviewed: e.target.checked })}/><span>{t('Nama, jumlah, harga, pajak, service, dan diskon sudah dicocokkan dengan struk.', 'I checked names, quantities, prices, tax, service, and discount against the receipt.')}</span></label>}
      </div>
    </div><aside className="sb-summary" aria-label={t('Hasil pembagian', 'Split result')}><div className="sb-summary-head"><span className="eyebrow">{t('TAGIHAN SATU MEJA', 'ONE TABLE, ONE BILL')}</span><span className="sb-ticket-mark" aria-hidden="true">B</span></div><div className="sb-grand"><span>{t('TOTAL DIBAGI', 'TOTAL TO SPLIT')}</span><strong>{money(result.total)}</strong><small>{b.people.length} {t('orang', 'people')} · {b.items.length} {t('item', 'items')}</small></div>
      <dl className="sb-totals"><div><dt>Subtotal</dt><dd>{money(result.subtotal)}</dd></div><div><dt>{t('Diskon', 'Discount')}</dt><dd>−{money(result.discount)}</dd></div><div><dt>Service</dt><dd>{money(result.service)}</dd></div><div><dt>{t('Pajak', 'Tax')}</dt><dd>{money(result.tax)}</dd></div><div><dt>{t('Biaya lain', 'Other fees')}</dt><dd>{money(result.extra)}</dd></div></dl>
      {result.mismatch !== null && <div className={result.mismatch === 0 ? 'sb-match' : 'sb-alert'}>{result.mismatch === 0 ? t('✓ Total cocok dengan struk', '✓ Total matches the receipt') : t('Selisih dari struk: ', 'Difference from receipt: ') + (result.mismatch > 0 ? '+' : '') + money(result.mismatch)}</div>}
      <div className="sb-person-totals"><span className="eyebrow">{t('BAGIAN MASING-MASING', 'EACH PERSON')}</span>{b.people.length === 0 ? <p className="sb-hint">{t('Nama dan nominal akan muncul di sini.', 'Names and amounts will appear here.')}</p> : result.parts.map((p, i) => <div key={p.id}><span className="sb-avatar">{String(i + 1).padStart(2, '0')}</span><span>{p.name || '…'}{p.id === b.payerId && <small>{t('yang nalangin', 'paid upfront')}</small>}</span><strong>{result.unassigned ? '—' : money(p.amount)}</strong></div>)}</div>
      {b.payerId && result.valid && <div className="sb-settlement"><span className="eyebrow">{t('TINGGAL BALIKIN KE', 'REPAY')}</span><h3>{b.people.find(p => p.id === b.payerId)?.name}</h3>{result.parts.filter(p => p.id !== b.payerId && p.amount > 0).map(p => <div key={p.id}><span>{p.name} →</span><b>{money(p.amount)}</b></div>)}</div>}
      {result.issues.length > 0 && <ul className="sb-issues">{result.issues.map(i => <li key={i}>{issueText[i]}</li>)}</ul>}
      <div className="sb-summary-actions"><button className="primary-btn" type="button" disabled={!result.valid} onClick={save}>{t('SIMPAN PATUNGAN', 'SAVE SPLIT BILL')}</button><button className="ghost-btn" type="button" disabled={!result.valid} onClick={copy}>{t('SALIN BUAT CHAT ↗', 'COPY FOR CHAT ↗')}</button></div>
      <p className="sb-hint">{t('Draft otomatis tersimpan. Tidak mencatat pengeluaran atau mentransfer uang. Selisih Rp1 dari pembulatan dialokasikan agar total pas.', 'Draft autosaves. This does not record expenses or transfer money. Rp1 rounding differences are allocated so the total matches.')}</p>
      {shareText && <label className="sb-field"><span>{t('Salin teks ini', 'Copy this text')}</span><textarea readOnly value={shareText} onFocus={e => e.target.select()} rows={10}/></label>}
    </aside></fieldset>
    {history.length > 0 && <section className="sb-history"><div className="sb-card-head"><div><span className="eyebrow">{t('RIWAYAT PATUNGAN', 'SAVED BILLS')}</span><h2>{t('yang pernah satu meja.', 'previously at the table.')}</h2></div><small>{t('40 tagihan terakhir', 'Last 40 bills')}</small></div>{history.map(bill => <article key={bill.id}><div><span>{bill.date} · {bill.people.length} {t('orang', 'people')}</span><strong>{bill.title || t('Patungan', 'Split bill')}</strong></div><b>{money(calculateBill(bill).total)}</b><button className="ghost-btn" type="button" disabled={busy} onClick={() => { if (b.items.length && b.id !== bill.id && !window.confirm(t('Buka tagihan ini? Perubahan draft yang belum disimpan akan terganti.', 'Open this bill? Unsaved draft changes will be replaced.'))) return; onDraft(bill); setPreview(''); setRawText(''); setError(''); document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' }); }}>{t('Buka', 'Open')}</button><button className="text-btn" type="button" disabled={busy} onClick={() => { if (window.confirm(t('Hapus tagihan tersimpan ini?', 'Delete this saved bill?'))) onHistory(current => current.filter(x => x.id !== bill.id)); }}>{t('Hapus', 'Delete')}</button></article>)}</section>}
    {cameraOpen && <dialog ref={dialogRef} className="sb-camera" onCancel={e => { e.preventDefault(); closeCamera(); }}><div className="sb-camera-head"><h2>{t('Foto struk', 'Capture receipt')}</h2><button type="button" className="icon-btn" onClick={closeCamera} aria-label={t('Tutup kamera', 'Close camera')}>×</button></div><p>{t('Pastikan seluruh struk masuk, tulisan tajam, dan cahaya cukup.', 'Fit the whole receipt, keep text sharp, and use good lighting.')}</p><video ref={videoRef} autoPlay muted playsInline/><div className="sb-camera-actions"><button type="button" className="primary-btn" disabled={!cameraReady} onClick={takePhoto}>{t('FOTO & BACA STRUK', 'CAPTURE & READ')}</button><button type="button" className="ghost-btn" onClick={closeCamera}>{t('Batal', 'Cancel')}</button></div></dialog>}
  </section>;
}
function ChargeField({ label, value, onChange, language }: { label: string; value: Charge; onChange: (v: Charge) => void; language: 'id' | 'en' }) {
  return <div className="sb-field"><label><span>{label}</span><input type="number" inputMode="decimal" min="0" step={value.mode === 'percent' ? '.01' : '1'} max={value.mode === 'percent' ? '100' : '1000000000'} value={value.value || ''} placeholder="0" onChange={e => onChange({ ...value, value: value.mode === 'percent' ? Math.min(100, Math.max(0, Number(e.target.value) || 0)) : rupiah(e.target.value) })}/></label><select aria-label={(language === 'id' ? 'Satuan ' : 'Unit for ') + label} value={value.mode} onChange={e => onChange({ mode: e.target.value as Charge['mode'], value: 0 })}><option value="amount">Rp</option><option value="percent">%</option></select></div>;
}
function CameraIcon() { return <svg className="sb-entry-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 9h6l2-4h8l2 4h6v18H4z"/><circle cx="16" cy="17" r="6"/><path d="M24 12h1"/></svg>; }
