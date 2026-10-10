"use client";
import {alhamdUnitLabel} from "@/lib/alhamd-units";

import { useEffect, useEffectEvent, useImperativeHandle, type Ref, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from "@/components/ui/Icons";
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/components/i18n/I18nProvider';
import { useToast } from '@/components/ui/Toast';
import { recordReceiptPrint } from "@/lib/actions/fiscal";
import { bridgeHealth, pairPrintBridge, bridgeRequest, printBrowserReceipt, DEFAULT_PRINTER, printerDots, receiptRaster, type PosReceipt, type PrinterSettings } from '@/lib/thermal-print';

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
  const pendingReceipt = useRef<PosReceipt | null>(null);
  const job = useRef<{ number: number; id: string } | null>(null);

  function patch(next: Partial<PrinterSettings>) {
    const value = { ...settings, ...next }; setSessionSettings(value);
    try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('menuzqr-printer-settings')); } catch { /* Session only. */ }
    if (next.token !== undefined) { setConnected(false); setPrinters([]); }
  }
  async function connect(): Promise<PrinterSettings | null> {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setMessage('');
    try {
      let token = settings.token;
      let result;
      if (token) {
        try { result = await bridgeRequest(settings, '/printers'); } catch { token = ''; }
      }
      if (!token) token = await pairPrintBridge();
      result ??= await bridgeRequest({...settings, token}, '/printers');
      if ((result.version ?? 1) < 3) {
        setConnected(false);
        setMessage(label('حمّل المثبّت الجديد وشغّله لتحديث برنامج الطباعة، ثم ارجع للصفحة.', 'Download and run the new installer to update MenuzQR Print, then return to this page.'));
        return null;
      }
      const names = result.printers || [];
      const printer = names.includes(settings.printer) ? settings.printer : result.suggestedPrinter ?? '';
      const width = !settings.printer && /(?:pos[- _]?58|58\s?mm)/i.test(printer) ? 58 : settings.width;
      const value: PrinterSettings = {...settings, token, printer, width, dots: printerDots(width, settings.dots), mode:'bridge'};
      patch(value); setPrinters(names); setConnected(true);
      setMessage(printer ? label('الطابعة جاهزة. يمكنك طباعة الإيصال أو تجربة طباعة اختبار.', 'Printer ready. Print your receipt or try a test receipt.') : names.length ? label('تم الاتصال. اختار الطابعة مرة واحدة، وسيتم حفظ اختيارك.', 'Connected. Choose your printer once; your choice will be saved.') : label('برنامج الطباعة جاهز، لكن Windows لا يعرض أي طابعة. وصّل الطابعة وثبّت تعريف الموديل.', 'MenuzQR Print is ready, but Windows has no printers. Connect your printer and install its model driver.'));
      return value;
    } catch {
      setConnected(false);
      setMessage(label('جهّز الطباعة المباشرة: حمّل مثبّت Windows وشغّله مرة واحدة، ثم ارجع للصفحة. اسمح بالوصول للشبكة المحلية لو المتصفح طلبه.', 'Set up direct printing: download and run the Windows installer once, then return here. Allow local network access if your browser asks.'));
      return null;
    } finally { lock.current = false; setBusy(false); }
  }
  const reconnect = useEffectEvent(() => { if (!lock.current) void connect(); });
  useEffect(() => {
    if (!open || connected || settings.mode === 'browser') return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { await bridgeHealth(); if (!cancelled) reconnect(); } catch { /* Installer is not running yet. */ }
      if (!cancelled) timer = setTimeout(poll, 4000);
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, connected, settings.mode]);
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
    let effective = settings;
    if (!browser && settings.mode !== 'browser' && (!settings.token || !settings.printer)) {
      pendingReceipt.current = test ? null : data;
      const ready = await connect();
      if (!ready?.printer) { setOpen(true); return; }
      effective = ready;
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
    let submitted = false;
    try {
      const bridge = await bridgeRequest(effective, '/printers');
      if ((bridge.version ?? 1) < 3) {
        setOpen(true);
        setMessage(label('حدّث برنامج الربط من الرابط بالأسفل ثم أعد طباعة الإيصال المحفوظ. لم يتم إرسال الإيصال للنسخة القديمة.', 'Update the print bridge below, then retry the saved receipt. Nothing was sent to the old bridge.'));
        return;
      }
      const bitmap = await receiptRaster({...data,lines:data.lines.map(line=>({...line,variant:alhamdUnitLabel(line.variant,restaurantId)}))}, restaurantName, currency, ar, effective.width, effective.dots);
      submitted = true;
      await bridgeRequest(effective, '/print', { ...bitmap, printer: effective.printer, cut: effective.cut, feedMm: effective.feedMm ?? 3, jobId: job.current!.id });
      job.current = null; pendingReceipt.current = null;
      if (!test) await journal(data, 'thermal');
      toast(label('اترسل الإيصال للطابعة.', 'Receipt sent to the printer.'), 'success');
      setMessage(label('اترسل الإيصال للطابعة.', 'Receipt sent to the printer.'));
    } catch {
      if (!submitted) { setConnected(false); setOpen(true); pendingReceipt.current = test ? null : data; }
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
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="font-semibold">{label('تثبيت مرة واحدة على جهاز الكاشير', 'Install once on this cashier computer')}</p>
          <p>{label('حمّل البرنامج وشغّل المثبّت، ثم ارجع هنا. البرنامج يبدأ تلقائيًا مع Windows، والاتصال يتم تلقائيًا بدون أوامر أو كود ربط.', 'Download and run the installer, then return here. MenuzQR Print starts with Windows and connects automatically, with no commands or pairing codes.')}</p>
          <a href="https://github.com/tranzillofficial/menuzqr/releases/download/print-v3/MenuzQR-Print-Setup.exe" className="inline-flex rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white">{label('تحميل برنامج الطباعة لـWindows', 'Download MenuzQR Print for Windows')}</a>
          <p className="text-xs text-ink-600">{label('Windows 10/11 · 64-bit. وصّل طابعة حرارية متوافقة مع ESC/POS ومثبتة بتعريفها. قد يطلب المتصفح إذن الوصول للشبكة المحلية.', 'Windows 10/11 · 64-bit. Connect an ESC/POS thermal printer with its Windows driver installed. Your browser may request local network permission.')}</p>
          {!connected && <p role="status">{label('في انتظار برنامج الطباعة… سيتم اكتشافه تلقائيًا بعد التثبيت.', 'Waiting for MenuzQR Print… It will be detected automatically after installation.')}</p>}
        </div>
        <fieldset disabled={busy} className="space-y-3">
          <Button type="button" disabled={busy} loading={busy} onClick={() => connect()}>{label('إعادة الاتصال واكتشاف الطابعات', 'Reconnect and find printers')}</Button>
          {connected && <label className="block">{label('الطابعة', 'Printer')}<select value={settings.printer} onChange={e => patch({ printer: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3"><option value="">{label('اختار طابعة', 'Select printer')}</option>{printers.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}
          <label className="block">{label('عرض الورق', 'Paper width')}<select value={settings.width} onChange={e => { const width = Number(e.target.value) === 58 ? 58 : 80; patch({ width, dots: printerDots(width) }); }} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3"><option value={80}>80 mm</option><option value={58}>58 mm</option></select></label>
          {settings.width === 80 && <label className="block">{label('عرض الطباعة الفعلي حسب موديل الطابعة', 'Printable width for your printer model')}<select value={settings.dots ?? 576} onChange={e => patch({ dots: Number(e.target.value) === 512 ? 512 : 576 })} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3"><option value={576}>72 mm · 576 dots</option><option value={512}>64 mm · 512 dots</option></select></label>}
          <label className="block">{label('مسافة إضافية بعد الإيصال (مم)', 'Extra feed after receipt (mm)')}<input type="number" min={0} max={30} step={1} value={settings.feedMm ?? 3} onChange={e => patch({ feedMm: Math.min(30, Math.max(0, Math.round(Number(e.target.value) || 0))) })} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3" /></label>
          <p className="text-xs text-ink-500">{label('ابدأ بـ3 مم. مسافة رأس الطباعة حتى القاطع تختلف حسب الطابعة ولا يمكن إلغاؤها بالكامل. إعدادات المسافة والقص تخص الطباعة المباشرة.', 'Start with 3 mm. The print-head-to-cutter distance depends on the printer and cannot be fully removed. Feed and cut settings apply to direct printing.')}</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.cut} onChange={e => patch({ cut: e.target.checked })} />{label('قص الورق تلقائي لو الطابعة بتدعمه', 'Auto cut if supported by the printer')}</label>
          {connected && settings.printer && (receipt || pendingReceipt.current) && <Button type="button" disabled={busy} onClick={() => print(false, pendingReceipt.current ?? undefined)}>{label('طباعة الإيصال المحفوظ', 'Print saved receipt')}</Button>}
          <Button type="button" variant="secondary" disabled={!settings.printer || !connected || busy} onClick={() => print(true)}>{label('طباعة اختبار', 'Print test receipt')}</Button>
        </fieldset>
        {message && <p role="status" className="rounded-xl bg-ink-50 p-3">{message}</p>}
        <p className="text-xs text-ink-500">{label('الإعدادات بتتحفظ على الجهاز ده. جرّب الطباعة قبل التشغيل الفعلي. تأكيد الإرسال معناه إن Windows استلم الإيصال، مش إن الورق خرج.', 'Settings are saved on this device. Test before use. Sending confirms Windows accepted the job, not that paper physically printed.')}</p>
      </div>
    </Modal>
  </div>;
}
