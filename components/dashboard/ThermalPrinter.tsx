"use client";
import {alhamdUnitLabel} from "@/lib/alhamd-units";

import { useImperativeHandle, type Ref, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from "@/components/ui/Icons";
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/components/i18n/I18nProvider';
import { useToast } from '@/components/ui/Toast';
import { recordReceiptPrint } from "@/lib/actions/fiscal";
import { bridgeRequest, printBrowserReceipt, DEFAULT_PRINTER, printerDots, receiptRaster, type PosReceipt, type PrinterSettings } from '@/lib/thermal-print';

function subscribeSettings(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('menuzqr-printer-settings', callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener('menuzqr-printer-settings', callback); };
}

export type ReceiptPrinterHandle = { printReceipt: (receipt: PosReceipt) => Promise<void> };

export function ThermalPrinter({ restaurantId, restaurantName, currency, receipt, printRef, compact = false }: {
  compact?: boolean;
  printRef?: Ref<ReceiptPrinterHandle>;
  restaurantId: string; restaurantName: string; currency: string; receipt: PosReceipt | null;
}) {
  const { locale } = useI18n();
  const ar = locale === 'ar';
  const label = (a: string, e: string) => ar ? a : e;
  const toast = useToast();
  const key = `menuzqr-printer:${restaurantId}`;
  const [sessionSettings, setSessionSettings] = useState<PrinterSettings | null>(null);
  const saved = useSyncExternalStore(subscribeSettings, () => {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  }, () => '');
  const persisted = useMemo(() => {
    try {
      const data = JSON.parse(saved || 'null');
      if (data && typeof data.token === 'string' && typeof data.printer === 'string') {
        const width = data.width === 58 ? 58 as const : 80 as const;
        return { token: data.token, printer: data.printer, width, dots: printerDots(width, data.dots), feedMm: Number.isInteger(data.feedMm) && data.feedMm >= 0 && data.feedMm <= 30 ? data.feedMm : 3, cut: data.cut !== false, mode: data.mode === 'browser' ? 'browser' as const : 'bridge' as const };
      }
    } catch { /* Settings remain available when browser storage is disabled. */ }
    return DEFAULT_PRINTER;
  }, [saved]);
  const settings = sessionSettings ?? persisted;
  const [printers, setPrinters] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const job = useRef<{ number: number; id: string } | null>(null);

  function patch(next: Partial<PrinterSettings>) {
    const value = { ...settings, ...next }; setSessionSettings(value);
    try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('menuzqr-printer-settings')); } catch { /* Session only. */ }
    if (next.token !== undefined) { setConnected(false); setPrinters([]); }
  }
  async function connect() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const result = await bridgeRequest(settings, '/printers');
      if ((result.version ?? 1) < 2) {
        setConnected(false);
        setMessage(label('حمّل إصدار برنامج الربط الجديد من الرابط بالأسفل، واقفل النسخة القديمة وشغّل الجديدة بنفس كود الربط.', 'Download the updated bridge below, close the old version and start the new one with the same pairing code.'));
        return;
      }
      const names = result.printers || []; setPrinters(names); setConnected(true);
      // Do not silently choose a PDF/office printer from the OS printer list.
      patch({ mode: 'bridge', printer: names.includes(settings.printer) ? settings.printer : '' });
      setMessage(names.length ? label('تم الاتصال. اختار الطابعة واطبع اختبار.', 'Connected. Select a printer and print a test.') : label('مفيش طابعات متثبتة على الجهاز. ثبّت تعريف الطابعة الأول.', 'No installed printers. Install the printer driver first.'));
    } catch {
      setConnected(false);
      setMessage(label('تعذر الاتصال. شغّل برنامج الربط على نفس الجهاز، وراجع كود الربط واسمح بالوصول للشبكة المحلية لو المتصفح طلبه.', 'Could not connect. Start the bridge on this computer, check the pairing code and allow local network access if prompted.'));
    } finally { lock.current = false; setBusy(false); }
  }
  useImperativeHandle(printRef, () => ({ printReceipt: data => print(false, data) }));

  async function journal(data: PosReceipt, method: 'thermal' | 'browser') {
    if (!data.orderId) return;
    try {
      const logged = await recordReceiptPrint(data.orderId, data.creditNote ? 'credit' : 'invoice', method);
      if (!logged.ok) throw new Error('Journal unavailable');
    } catch { toast(label('تم طلب الطباعة، لكن تعذر تسجيلها في السجل.', 'Print requested, but the journal could not be updated.'), 'error'); }
  }
  async function print(test = false, override?: PosReceipt, browser = false) {
    if (lock.current) {
      toast(label('الطابعة مشغولة. الطلب محفوظ؛ اضغط طباعة الإيصال لما تخلص.', 'Printer busy. Order saved; use Print receipt when it finishes.'), 'error');
      return;
    }
    const data: PosReceipt | null = test ? { number: 0, total: 10, received: 20, payment: 'cash', tableLabel: label('اختبار', 'Test'), note: label('اختبار الطابعة الحرارية', 'Thermal printer test'), createdAt: new Date().toISOString(), lines: [{ variantId: 'test', name: label('طباعة عربي وإنجليزي', 'Arabic and English printing'), variant: 'MenuzQR', price: 10, quantity: 1 }] } : override ?? receipt;
    if (!data) return;
    if (!browser && settings.mode !== 'browser' && (!settings.token || !settings.printer)) {
      setOpen(true);
      setMessage(label('الطلب محفوظ. جهّز الطباعة المباشرة واختار طابعتك أول مرة، وبعدها اطبع الإيصال. طباعة المتصفح متاحة كاختيار بديل.', 'Order saved. Set up direct printing and select your printer once, then print the receipt. Browser printing is available as a fallback.'));
      return;
    }
    lock.current = true; setBusy(true); setMessage(label('جاري تجهيز الإيصال…', 'Preparing receipt…'));
    if (browser || settings.mode === 'browser') {
      try {
        await printBrowserReceipt({...data,lines:data.lines.map(line=>({...line,variant:alhamdUnitLabel(line.variant,restaurantId)}))}, restaurantName, currency, ar, settings.width, settings.dots);
        setMessage(label('تم طلب فتح نافذة الطباعة. اختار الطابعة ومقاس الورق واضغط طباعة. لو النافذة مظهرتش أو اتلغت، اضغط طباعة الإيصال تاني؛ الطلب محفوظ.', 'Print dialog requested. Select the printer and paper size, then Print. If it did not open or was cancelled, print the receipt again; the order is saved.'));
        if (!test) await journal(data, 'browser');
      } catch {
        setMessage(label('الطلب محفوظ، لكن تعذر فتح الطباعة. اضغط طباعة الإيصال لإعادة المحاولة.', 'Order saved, but printing could not open. Use Print receipt to retry.'));
        toast(label('تعذر فتح الطباعة', 'Could not open printing'), 'error');
      } finally { lock.current = false; setBusy(false); }
      return;
    }
    // Reuse the job ID after a lost response so retrying cannot enqueue twice.
    if (test || job.current?.number !== data.number) job.current = { number: data.number, id: crypto.randomUUID() };
    try {
      const bridge = await bridgeRequest(settings, '/printers');
      if ((bridge.version ?? 1) < 2) {
        setOpen(true);
        setMessage(label('حدّث برنامج الربط من الرابط بالأسفل ثم أعد طباعة الإيصال المحفوظ. لم يتم إرسال الإيصال للنسخة القديمة.', 'Update the print bridge below, then retry the saved receipt. Nothing was sent to the old bridge.'));
        return;
      }
      const bitmap = await receiptRaster({...data,lines:data.lines.map(line=>({...line,variant:alhamdUnitLabel(line.variant,restaurantId)}))}, restaurantName, currency, ar, settings.width, settings.dots);
      await bridgeRequest(settings, '/print', { ...bitmap, printer: settings.printer, cut: settings.cut, feedMm: settings.feedMm ?? 3, jobId: job.current!.id });
      job.current = null;
      if (!test) await journal(data, 'thermal');
      toast(label('اترسل الإيصال للطابعة.', 'Receipt sent to the printer.'), 'success');
      setMessage(label('اترسل الإيصال للطابعة.', 'Receipt sent to the printer.'));
    } catch {
      const error = label('تعذر تأكيد الطباعة. راجع برنامج الربط والطابعة والورق. لو الإيصال طلع بالفعل متعيدش طباعته.', 'Printing could not be confirmed. Check the bridge, printer and paper. If the receipt already printed, do not reprint it.');
      toast(error, 'error'); setMessage(error);
    } finally { lock.current = false; setBusy(false); }
  }

  return <div className={compact ? "space-y-2" : "space-y-2 rounded-xl border border-ink-200 bg-white p-3"}>
    <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="secondary" aria-label={label('إعدادات الطابعة', 'Printer settings')} onClick={() => setOpen(true)}><Icon.settings className="size-4" />{!compact && label('إعداد الطابعة الحرارية', 'Thermal printer setup')}</Button>
      {receipt && <Button type="button" loading={busy} disabled={busy} onClick={() => print()}>{label('طباعة الإيصال', 'Print receipt')} #{receipt.number}</Button>}
      {receipt && settings.mode !== 'browser' && <Button type="button" variant="secondary" disabled={busy} onClick={() => print(false, undefined, true)}>{label('الطباعة عن طريق تعريف الجهاز', 'Print using system driver')}</Button>}</div>
    {message && <p role="status" aria-live="polite" className="rounded-lg bg-ink-50 p-3 text-sm">{message}</p>}
    {!compact && <p className="text-xs text-ink-500">{label('الطباعة المباشرة تضبط عرض الإيصال وطوله حسب المحتوى. إعداد الطابعة مرة واحدة على جهاز الكاشير، والطلب يُحفظ قبل الطباعة.', 'Direct printing sets the receipt width and length from its content. Set up the printer once on the cashier computer. Orders are saved before printing.')}</p>}
    {settings.mode === 'browser' && <p className="text-xs text-ink-500">{label('وضع المتصفح: لو الفاتورة مدوّرة أو فيها ورق زائد، اختار الطباعة المباشرة من إعدادات الطابعة. في نافذة المتصفح اختار اتجاه رأسي ومقياس 100% ومقاس الرول، وألغِ رؤوس وتذييلات الصفحات.', 'Browser mode: for rotated receipts or excess paper, choose direct printing in printer settings. In the browser dialog use portrait, 100% scale, the roll size, and no headers or footers.')}</p>}
    {settings.printer && <p className="text-xs text-ink-500">{settings.printer} · {settings.width} mm</p>}
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title={label('الطابعة الحرارية', 'Thermal printer')} size="sm">
      <div className="space-y-4 text-sm">
        <label className="block">{label('طريقة الطباعة بعد الدفع', 'Printing after checkout')}<select disabled={busy} value={settings.mode ?? 'bridge'} onChange={e => patch({ mode: e.target.value === 'browser' ? 'browser' : 'bridge' })} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3"><option value="bridge">{label('مباشرة — الموصى بها للطابعة الحرارية', 'Direct — recommended for thermal printers')}</option><option value="browser">{label('نافذة المتصفح — بديل بتعريف الجهاز', 'Browser dialog — system driver fallback')}</option></select></label>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => print(true, undefined, true)}>{label('اختبار الطباعة بتعريف الجهاز', 'Test system driver printing')}</Button>
        <p>{label('للطباعة بطول الإيصال بدون PDF أو إعدادات صفحات: شغّل برنامج الربط على جهاز Windows المتصل بطابعة ESC/POS متوافقة. يدعم الطابعات المثبتة بتعريف Windows سواء USB أو بلوتوث أو شبكة. حدّث النسخة القديمة إذا كانت مثبتة.', 'Print to the receipt length without PDF or page settings: run the bridge on the Windows computer connected to a compatible ESC/POS printer. Supports printers installed in Windows over USB, Bluetooth or network. Replace an older bridge if installed.')}</p>
        <ol className="list-inside list-decimal space-y-2">
          <li>{label('ثبّت Python 3 لو مش موجود.', 'Install Python 3 if needed.')}</li>
          <li><a href="/menuzqr-print-bridge.py" download className="font-medium text-brand-700 underline">{label('حمّل برنامج الربط المجاني', 'Download the free print bridge')}</a></li>
          <li>{label('شغّله بالأمر ده وسيب نافذته مفتوحة:', 'Run this command and keep its window open:')}<code dir="ltr" className="mt-2 block break-all rounded-lg bg-ink-50 p-2">py menuzqr-print-bridge.py</code></li>
          <li>{label('انسخ كود الربط اللي هيظهر وحطه هنا، وبعدها اضغط اتصال.', 'Paste the pairing code shown in the window, then connect.')}</li>
        </ol>
        <fieldset disabled={busy} className="space-y-3">
          <label className="block">{label('كود الربط', 'Pairing code')}<input type="password" autoComplete="off" value={settings.token} onChange={e => patch({ token: e.target.value.trim() })} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3" /></label>
          <Button type="button" disabled={!settings.token || busy} loading={busy} onClick={connect}>{label('اتصال وعرض الطابعات', 'Connect and find printers')}</Button>
          {connected && <label className="block">{label('الطابعة', 'Printer')}<select value={settings.printer} onChange={e => patch({ printer: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3"><option value="">{label('اختار طابعة', 'Select printer')}</option>{printers.map(name => <option key={name}>{name}</option>)}</select></label>}
          <label className="block">{label('عرض الورق', 'Paper width')}<select value={settings.width} onChange={e => { const width = Number(e.target.value) === 58 ? 58 : 80; patch({ width, dots: printerDots(width) }); }} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3"><option value={80}>80 mm</option><option value={58}>58 mm</option></select></label>
          {settings.width === 80 && <label className="block">{label('عرض الطباعة الفعلي حسب موديل الطابعة', 'Printable width for your printer model')}<select value={settings.dots ?? 576} onChange={e => patch({ dots: Number(e.target.value) === 512 ? 512 : 576 })} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3"><option value={576}>72 mm · 576 dots</option><option value={512}>64 mm · 512 dots</option></select></label>}
          <label className="block">{label('مسافة إضافية بعد الإيصال (مم)', 'Extra feed after receipt (mm)')}<input type="number" min={0} max={30} step={1} value={settings.feedMm ?? 3} onChange={e => patch({ feedMm: Math.min(30, Math.max(0, Math.round(Number(e.target.value) || 0))) })} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3" /></label>
          <p className="text-xs text-ink-500">{label('ابدأ بـ3 مم. مسافة رأس الطباعة حتى القاطع تختلف حسب الطابعة ولا يمكن إلغاؤها بالكامل. إعدادات المسافة والقص تخص الطباعة المباشرة.', 'Start with 3 mm. The print-head-to-cutter distance depends on the printer and cannot be fully removed. Feed and cut settings apply to direct printing.')}</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.cut} onChange={e => patch({ cut: e.target.checked })} />{label('قص الورق تلقائي لو الطابعة بتدعمه', 'Auto cut if supported by the printer')}</label>
          <Button type="button" variant="secondary" disabled={!settings.printer || !connected || busy} onClick={() => print(true)}>{label('طباعة اختبار', 'Print test receipt')}</Button>
        </fieldset>
        {message && <p role="status" className="rounded-xl bg-ink-50 p-3">{message}</p>}
        <p className="text-xs text-ink-500">{label('الإعدادات بتتحفظ على الجهاز ده. جرّب الطباعة قبل التشغيل الفعلي. تأكيد الإرسال معناه إن Windows استلم الإيصال، مش إن الورق خرج.', 'Settings are saved on this device. Test before use. Sending confirms Windows accepted the job, not that paper physically printed.')}</p>
      </div>
    </Modal>
  </div>;
}
