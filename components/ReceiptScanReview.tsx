'use client';
import { useMemo, useState } from 'react';
import { ParsedReceipt, newId } from '../lib/splitbill';
import { ReceiptReview, ReviewAmount, ReviewItem, createReceiptReview, validateReceiptReview } from '../lib/receipt-review';

type Props = {
  receipt: ParsedReceipt; confidence: number; initiallyUsable: boolean; photo: string; language: 'id' | 'en';
  onApply: (receipt: ParsedReceipt) => void; onDiscard: () => void; onRetake: () => void; onRecrop?: () => void;
};
export default function ReceiptScanReview({ receipt, confidence, initiallyUsable, photo, language, onApply, onDiscard, onRetake, onRecrop }: Props) {
  const t = (id: string, en: string) => language === 'id' ? id : en;
  const money = (n: number) => new Intl.NumberFormat(language === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  const [draft, setDraft] = useState(() => createReceiptReview(receipt));
  const [confirmed, setConfirmed] = useState(false);
  const [removed, setRemoved] = useState<{ item: ReviewItem; index: number } | null>(null);
  const result = useMemo(() => validateReceiptReview(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(createReceiptReview(receipt));
  function edit(change: (current: ReceiptReview) => ReceiptReview) { setDraft(change); setConfirmed(false); }
  function updateItem(id: string, data: Partial<ReviewItem>) { edit(current => ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...data } : item) })); }
  function leave(action: () => void) {
    if (dirty && !window.confirm(t('Koreksi di review ini belum dimasukkan ke tagihan. Lanjut tanpa menyimpannya?', 'These review edits have not been added to your bill. Continue without them?'))) return;
    action();
  }
  const problemText = {
    name: t('Periksa nama: kosong atau tampak seperti teks acak.', 'Check the name: it is empty or appears unreadable.'),
    quantity: t('Isi jumlah utuh 1–999 dan cocokkan dengan foto.', 'Enter a whole quantity from 1–999 and check the photo.'),
    amount: t('Periksa nominal baris. Isi Rp100–Rp1 miliar.', 'Check the line amount. Enter Rp100–Rp1 billion.'),
  };
  const amountLabels: Record<ReviewAmount, string> = {
    discount: t('Diskon · Rp', 'Discount · Rp'), service: 'Service · Rp', tax: t('Pajak · Rp', 'Tax · Rp'),
    rounding: t('Pembulatan · Rp (boleh minus)', 'Rounding · Rp (can be negative)'),
    subtotal: t('Subtotal di struk · Rp (opsional)', 'Receipt subtotal · Rp (optional)'), total: t('Total akhir di struk · Rp', 'Final receipt total · Rp'),
  };
  const issues: Record<string, string> = {
    currency: t('Struk terindikasi memakai mata uang selain rupiah.', 'The receipt appears to use a currency other than rupiah.'),
    empty: t('Tambahkan minimal satu item.', 'Add at least one item.'), itemLimit: t('Maksimal 150 item per tagihan.', 'Maximum 150 items per bill.'),
    discount: t('Diskon melebihi subtotal. Cocokkan lagi dengan foto.', 'The discount exceeds the subtotal. Check the photo.'),
    limit: t('Total harus lebih dari Rp0 dan maksimal Rp1 miliar.', 'The total must be above Rp0 and at most Rp1 billion.'),
    subtotal: t('Jumlah harga item belum sama dengan subtotal pada struk.', 'Item amounts do not match the receipt subtotal.'),
    total: t('Total hitungan belum cocok. Periksa item dan seluruh biaya.', 'The calculated total does not match. Check the items and all charges.'),
  };
  if (receipt.currencyWarning) return <div className="sb-review-editor">
    <p className="sb-alert" role="alert">{t('Struk ini terindikasi memakai mata uang selain rupiah. Patungan saat ini hanya mendukung rupiah, jadi angka pada struk ini tidak akan dimasukkan sebagai Rp. Belum ada konversi mata uang otomatis.', 'This receipt appears to use a currency other than rupiah. Split bills currently support rupiah only, so these figures will not be imported as IDR. Automatic currency conversion is not available.')}</p>
    <details className="sb-review-photo"><summary>{t('Lihat foto struk', 'View receipt photo')}</summary><img src={photo} alt={t('Struk yang perlu diperiksa mata uangnya', 'Receipt whose currency needs checking')}/></details>
    <div className="sb-photo-tools"><button type="button" className="ghost-btn" onClick={onRetake}>{t('Foto struk lain', 'Capture another receipt')}</button><button type="button" className="text-btn" onClick={onDiscard}>{t('Tutup hasil ini', 'Close these results')}</button></div>
  </div>;
  return <div className="sb-review-editor">
    {(!initiallyUsable || confidence < 70) && <p className="sb-alert" role="status">{t('Pembacaan foto kurang meyakinkan. Koreksi kolom yang ditandai, lengkapi item yang terlewat, atau ambil foto ulang.', 'The photo reading is uncertain. Correct the marked fields, add missing items, or retake the photo.')}</p>}
    <div className="sb-review-layout">
      <details className="sb-review-photo" open><summary>{t('Foto pembanding · ketuk untuk tutup/buka', 'Reference photo · tap to collapse/expand')}</summary><img src={photo} alt={t('Struk untuk mencocokkan hasil scan', 'Receipt for checking scan results')}/><p className="sb-hint">{t('Cocokkan nama, jumlah, harga, dan biaya dengan foto ini.', 'Compare names, quantities, prices and charges with this photo.')}</p></details>
      <div className="sb-review-fields">
        <p className="sb-hint">{t('Nominal dalam rupiah. Edit hasil di sini; total baris adalah harga seluruh jumlah, bukan harga satuan.', 'Amounts are in rupiah. Edit the results here; line total is the amount for the entire quantity, not the unit price.')}</p>
        <div className="sb-review-rows">{draft.items.map((item, index) => {
          const errors = result.itemErrors[item.id] || [], prefix = t('Review item ', 'Review item ') + (index + 1);
          return <article className={'sb-review-row' + (errors.length ? ' sb-review-row-warning' : '')} key={item.id} aria-label={prefix}>
            <label className="sb-field sb-review-name"><span>{String(index + 1).padStart(2, '0')} · {t('Nama item', 'Item name')}</span><input aria-label={prefix + t(' · Nama', ' · Name')} aria-invalid={errors.includes('name')} aria-describedby={errors.length ? 'review-' + item.id : undefined} value={item.name} maxLength={80} onChange={e => updateItem(item.id, { name: e.target.value })}/></label>
            <label className="sb-field"><span>{t('Jumlah', 'Qty')}</span><input type="text" inputMode="numeric" aria-label={prefix + t(' · Jumlah', ' · Qty')} aria-invalid={errors.includes('quantity')} aria-describedby={errors.length ? 'review-' + item.id : undefined} value={item.quantity} maxLength={3} onChange={e => updateItem(item.id, { quantity: e.target.value })}/></label>
            <label className="sb-field"><span>{t('Total baris · Rp', 'Line total · Rp')}</span><input type="text" inputMode="numeric" aria-label={prefix + t(' · Total baris', ' · Line total')} aria-invalid={errors.includes('amount')} aria-describedby={errors.length ? 'review-' + item.id : undefined} value={item.amount} maxLength={24} onChange={e => updateItem(item.id, { amount: e.target.value })}/></label>
            <button type="button" className="sb-remove" aria-label={t('Hapus hasil item ', 'Remove result item ') + (index + 1)} onClick={() => { setRemoved({ item, index }); edit(current => ({ ...current, items: current.items.filter(row => row.id !== item.id) })); }}>×</button>
            {errors.length > 0 && <p className="sb-review-field-errors" id={'review-' + item.id}>{errors.map(error => problemText[error]).join(' ')}</p>}
          </article>;
        })}</div>
        <div className="sb-photo-tools"><button type="button" className="ghost-btn" disabled={draft.items.length >= 150} onClick={() => edit(current => ({ ...current, items: [...current.items, { id: newId(), name: '', quantity: '1', amount: '' }] }))}>+ {t('Tambah item terlewat', 'Add missing item')}</button>{removed && <button type="button" className="text-btn" disabled={draft.items.length >= 150} onClick={() => { edit(current => { const items = [...current.items]; items.splice(Math.min(removed.index, items.length), 0, removed.item); return { ...current, items }; }); setRemoved(null); }}>{t('Urungkan hapus', 'Undo remove')}</button>}</div>
        <div className="sb-review-charges">{(['discount', 'service', 'tax', 'rounding', 'subtotal', 'total'] as ReviewAmount[]).map(key => <label className="sb-field" key={key}><span>{amountLabels[key]}</span><input type="text" inputMode={key === 'rounding' ? 'text' : 'numeric'} aria-label={t('Review · ', 'Review · ') + amountLabels[key]} aria-invalid={result.amountErrors.includes(key)} value={draft[key]} maxLength={24} placeholder={key === 'subtotal' ? t('Jika tercantum', 'If shown') : '0'} onChange={e => edit(current => ({ ...current, [key]: e.target.value }))}/>{result.amountErrors.includes(key) && <small className="sb-review-field-errors">{key === 'rounding' ? t('Isi angka dari −10.000 sampai 10.000.', 'Enter an amount from −10,000 to 10,000.') : t('Isi nominal yang valid sesuai struk.', 'Enter a valid amount from the receipt.')}</small>}</label>)}</div>
      </div>
    </div>
    <div className="sb-review-balance" role="status" aria-live="polite">
      <div><span>{t('Jumlah harga item', 'Item subtotal')}</span><strong>{result.fieldsValid ? money(result.subtotal) : '—'}</strong></div>
      <div><span>{t('Total setelah biaya', 'Total after charges')}</span><strong>{result.fieldsValid ? money(result.calculated) : '—'}</strong></div>
      <div className={result.valid ? 'sb-match' : 'sb-review-difference'}><span>{result.valid ? t('✓ Cocok dengan struk', '✓ Matches the receipt') : t('Selisih dari total struk', 'Difference from receipt total')}</span><strong>{result.fieldsValid && result.difference !== null ? money(result.difference) : '—'}</strong></div>
    </div>
    {(!result.fieldsValid || result.issues.length > 0) && <div className="sb-alert" role="status">{!result.fieldsValid && <p>{t('Lengkapi atau koreksi kolom yang ditandai.', 'Complete or correct the marked fields.')}</p>}{result.issues.map(issue => <p key={issue}>{issues[issue]}</p>)}</div>}
    <label className="sb-check sb-review-confirm"><input type="checkbox" checked={confirmed} disabled={!result.valid} onChange={e => setConfirmed(e.target.checked)}/><span>{t('Nama, jumlah, harga, dan seluruh biaya sudah saya cocokkan dengan foto.', 'I checked names, quantities, prices and all charges against the photo.')}</span></label>
    <div className="sb-photo-tools"><button type="button" className="primary-btn" disabled={!result.valid || !confirmed} onClick={() => { if (result.valid && confirmed) onApply(result.receipt); }}>{t('MASUKKAN KE TAGIHAN', 'ADD TO BILL')}</button>{onRecrop && <button type="button" className="ghost-btn" onClick={() => leave(onRecrop)}>{t('Atur area & baca ulang', 'Adjust area & rescan')}</button>}<button type="button" className="ghost-btn" onClick={() => leave(onRetake)}>{t('Foto ulang', 'Retake photo')}</button><button type="button" className="text-btn" onClick={() => leave(onDiscard)}>{t('Batalkan hasil ini', 'Discard these results')}</button></div>
    <p className="sb-hint">{t('Koreksi ini belum mengubah tagihan. Setiap edit membatalkan centang pemeriksaan agar hasil terbaru dicek lagi.', 'These edits have not changed the bill. Each edit resets the confirmation so the latest values are reviewed.')}</p>
  </div>;
}
