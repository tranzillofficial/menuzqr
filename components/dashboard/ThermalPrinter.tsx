"use client";
import {alhamdUnitLabel} from "@/lib/alhamd-units";

import { useEffect, useEffectEvent, useImperativeHandle, type Ref, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from "@/components/ui/Icons";
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/components/i18n/I18nProvider';
import { useToast } from '@/components/ui/Toast';
import { recordReceiptPrint } from "@/lib/actions/fiscal";
import { PrintConnectionError, bridgeHealth, pairPrintBridge, bridgeRequest, DEFAULT_PRINTER, receiptRaster, type PosReceipt, type PrinterSettings } from '@/lib/thermal-print';

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
        return { token: data.token, printer: data.printer, width };
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
  const job = useRef<{ key: string; id: string } | null>(null);

  function patch(next: Partial<PrinterSettings>) {
    const value = { ...settings, ...next }; setSessionSettings(value);
    try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('menuzqr-printer-settings')); } catch { /* Session only. */ }
    if (next.token !== undefined) { setConnected(false); setPrinters([]); }
  }
  async function connect(): Promise<PrinterSettings | null> {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setMessage(label('جاري الاتصال بالطابعة…', 'Connecting to printer…'));
    try {
      let token = settings.token;
      let result;
      if (token) {
        try { result = await bridgeRequest(settings, '/printers'); } catch { token = ''; }
      }
      if (!token) token = await pairPrintBridge();
      if (!result) {
        try { result = await bridgeRequest({...settings, token}, '/printers'); }
        catch { throw new PrintConnectionError('discovery'); }
      }
      if ((result.version ?? 1) < 5) {
        throw new PrintConnectionError('outdated');
      }
      const names = result.printers || [];
      const printer = names.includes(settings.printer) ? settings.printer : result.suggestedPrinter ?? '';
      const width = !settings.printer && /(?:pos[- _]?58|58\s?mm)/i.test(printer) ? 58 : settings.width;
      const value: PrinterSettings = {...settings, token, printer, width};
      patch(value); setPrinters(names); setConnected(true);
      setMessage(printer ? label('الطابعة جاهزة. يمكنك طباعة الإيصال أو تجربة طباعة اختبار.', 'Printer ready. Print your receipt or try a test receipt.') : names.length ? label('تم الاتصال. افتح إعدادات الطابعة واختار طابعتك مرة واحدة.', 'Connected. Open Printer settings and choose your printer once.') : label('برنامج الطباعة جاهز، لكن Windows لا يعرض أي طابعة. وصّل الطابعة وثبّت تعريف الموديل.', 'MenuzQR Print is ready, but Windows has no printers. Connect your printer and install its model driver.'));
      return value;
    } catch (cause) {
      setConnected(false);
      const code = cause instanceof PrintConnectionError ? cause.code : 'unreachable';
      const errors = {
        unreachable: label('تعذر الوصول لبرنامج الطباعة على الجهاز. شغّل MenuzQR Print واسمح للمتصفح بالوصول للشبكة المحلية، ثم أعد المحاولة.', 'Cannot reach MenuzQR Print on this computer. Start MenuzQR Print and allow local network access in your browser, then retry.'),
        outdated: label('برنامج الطباعة المتصل نسخة قديمة. افتح إعدادات الطابعة لتحميل التحديث وتشغيله.', 'The connected print bridge is outdated. Open Printer settings to download and run the new installer.'),
        session: label('تعذر الحصول على تصريح ربط الطابعة من الموقع. تحقق من الإنترنت وتسجيل الدخول ثم أعد المحاولة.', 'Could not authorize printer connection with the site. Check your internet connection and sign-in, then retry.'),
        pairing: label('برنامج الطباعة موجود، لكن الربط بالموقع لم يكتمل. أعد تشغيل MenuzQR Print ثم أعد المحاولة.', 'MenuzQR Print was found, but connecting it to the site failed. Restart MenuzQR Print, then retry.'),
        discovery: label('تم ربط برنامج الطباعة، لكن تعذر قراءة طابعات Windows. أعد تشغيل البرنامج وتحقق من تعريف الطابعة.', 'Connected to MenuzQR Print, but could not read Windows printers. Restart the program and check the printer driver.'),
      };
      setMessage(`${errors[code]} [${code}]`);
      return null;
    } finally { lock.current = false; setBusy(false); }
  }
  const reconnect = useEffectEvent(() => { if (!lock.current) void connect(); });
  useEffect(() => {
    if (!open || connected) return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { await bridgeHealth(); if (!cancelled) reconnect(); } catch { /* Installer is not running yet. */ }
      if (!cancelled) timer = setTimeout(poll, 4000);
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, connected]);
  useImperativeHandle(printRef, () => ({ printReceipt: data => print(false, data) }));

  async function journal(data: PosReceipt, method: 'thermal' | 'browser') {
    if (!data.orderId) return;
    try {
      const logged = await recordReceiptPrint(data.orderId, data.creditNote ? 'credit' : 'invoice', method);
      if (!logged.ok) throw new Error('Journal unavailable');
    } catch { toast(label('تم طلب الطباعة، لكن تعذر تسجيلها في السجل.', 'Print requested, but the journal could not be updated.'), 'error'); }
  }
  async function print(test = false, override?: PosReceipt) {
    if (lock.current) {
      toast(label('الطابعة مشغولة. الطلب محفوظ؛ اضغط طباعة الإيصال لما تخلص.', 'Printer busy. Order saved; use Print receipt when it finishes.'), 'error');
      return;
    }
    const data: PosReceipt | null = test ? { testPrint: true, number: 0, total: 10, received: 20, payment: 'cash', tableLabel: label('اختبار', 'Test'), note: label('اختبار الطابعة الحرارية', 'Thermal printer test'), createdAt: new Date().toISOString(), lines: [{ variantId: 'test', name: label('طباعة عربي وإنجليزي', 'Arabic and English printing'), variant: 'MenuzQR', price: 10, quantity: 1 }] } : override ?? receipt;
    if (!data) return;
    // Checkout and test printing never open settings, including on connection failure.
    // Browser/PDF printing is deliberately not part of checkout or test printing.
    const effective = await connect();
    if (!effective?.printer) {
      if (!test) pendingReceipt.current = data;
      return;
    }
    lock.current = true; setBusy(true); setMessage(label('جاري الطباعة…', 'Printing…'));
    let submitted = false;
    try {
    // Reuse the job ID after a lost response so retrying cannot enqueue twice.
    const jobKey = `${key}:job:${data.orderId ?? data.number}:${data.creditNote ? 'credit' : 'invoice'}`;
    if (test || job.current?.key !== jobKey) {
      let id = crypto.randomUUID();
      if (!test) {
        try { id = localStorage.getItem(jobKey) || id; localStorage.setItem(jobKey, id); } catch { /* Session deduplication remains available. */ }
      }
      job.current = { key: jobKey, id };
    }
      const bridge = await bridgeRequest(effective, '/printers');
      if ((bridge.version ?? 1) < 5) {
        setConnected(false);
        if (!test) pendingReceipt.current = data;
        setMessage(label('افتح إعدادات الطابعة وحدّث برنامج الربط ثم أعد طباعة الإيصال المحفوظ. لم يتم إرسال الإيصال للنسخة القديمة.', 'Open Printer settings to update the print bridge, then retry the saved receipt. Nothing was sent to the old bridge.'));
        return;
      }
      const bitmap = await receiptRaster({...data,lines:data.lines.map(line=>({...line,variant:alhamdUnitLabel(line.variant,restaurantId)}))}, restaurantName, currency, ar, effective.width);
      submitted = true;
      const result = await bridgeRequest(effective, '/print', { ...bitmap, printer: effective.printer, testPrint: test, jobId: job.current!.id });
      if (!test) pendingReceipt.current = null;
      if (result.duplicate) { setMessage(label('المهمة دي اتبعتت قبل كده؛ لم نرسل نسخة إضافية.', 'This job was already sent; no additional copy was sent.')); return; }
      setOpen(false);
      if (!test) await journal(data, 'thermal');
      toast(label('اترسل الإيصال للطابعة.', 'Receipt sent to the printer.'), 'success');
      setMessage(label('اترسل الإيصال للطابعة.', 'Receipt sent to the printer.'));
    } catch (cause) {
      if (!submitted) { setConnected(false); pendingReceipt.current = test ? null : data; }
      const error = label('تعذر تأكيد الطباعة. راجع برنامج الربط والطابعة والورق. لو الإيصال طلع بالفعل متعيدش طباعته.', 'Printing could not be confirmed. Check the bridge, printer and paper. If the receipt already printed, do not reprint it.');
      const detail = cause instanceof Error ? cause.message : '';
      toast(error, 'error'); setMessage(detail ? `${error} ${detail}` : error);
    } finally { lock.current = false; setBusy(false); }
  }

  return <div className={compact ? "space-y-2" : "space-y-2 rounded-xl border border-ink-200 bg-white p-3"}>
    <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="secondary" aria-label={label('إعدادات الطابعة', 'Printer settings')} onClick={() => setOpen(true)}><Icon.settings className="size-4" />{!compact && label('إعداد الطابعة الحرارية', 'Thermal printer setup')}</Button>
      {receipt && <Button type="button" loading={busy} disabled={busy} onClick={() => print()}>{label('طباعة الإيصال', 'Print receipt')} #{receipt.number}</Button>}
      <Button type="button" size="sm" variant="secondary" loading={busy} disabled={busy} onClick={() => print(true)}>{label('تست طباعة', 'Test print')}</Button></div>
    {message && <p role="status" aria-live="polite" className="fixed bottom-24 left-4 right-4 z-[110] mx-auto max-w-lg rounded-xl border border-ink-200 bg-white p-4 text-sm font-semibold text-ink-900 shadow-xl" data-testid="printer-status">{message}</p>}
    {!compact && <p className="text-xs text-ink-500">{label('الطباعة المباشرة تضبط عرض الإيصال وطوله حسب المحتوى. إعداد الطابعة مرة واحدة على جهاز الكاشير، والطلب يُحفظ قبل الطباعة.', 'Direct printing sets the receipt width and length from its content. Set up the printer once on the cashier computer. Orders are saved before printing.')}</p>}
    {settings.printer && <p className="text-xs text-ink-500">{settings.printer} · {settings.width} mm</p>}
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title={label('الطابعة الحرارية', 'Thermal printer')} size="sm">
      <div className="space-y-4 text-sm">
        {!connected && <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="font-semibold">{label('تثبيت مرة واحدة على جهاز الكاشير', 'Install once on this cashier computer')}</p>
          <p>{label('حمّل البرنامج وشغّل المثبّت، ثم ارجع هنا. البرنامج يبدأ تلقائيًا مع Windows، والاتصال يتم تلقائيًا بدون أوامر أو كود ربط.', 'Download and run the installer, then return here. MenuzQR Print starts with Windows and connects automatically, with no commands or pairing codes.')}</p>
          <a href="https://github.com/tranzillofficial/menuzqr/releases/download/print-v5/MenuzQR-Print-Setup.exe" className="inline-flex rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white">{label('تحميل برنامج الطباعة لـWindows', 'Download MenuzQR Print for Windows')}</a>
          <a href="https://github.com/tranzillofficial/menuzqr/releases/download/print-win7-v5/MenuzQR-Print-Win7-Setup.exe" className="inline-flex rounded-xl border border-brand-600 px-4 py-3 font-semibold text-brand-700">{label('نسخة Windows 7 SP1 — 32 و64 بت', 'Windows 7 SP1 compatibility — 32/64-bit')}</a>
          <p className="text-xs text-ink-600">{label('لو ظهرت رسالة عدم توافق على Windows 7، استخدم نسخة التوافق. تشمل Python ومكتبات التشغيل تلقائيًا؛ لا تحتاج تثبيت برامج إضافية. تتطلب Windows 7 SP1. أنظمة Windows 7 وPython 3.8 خارج الدعم؛ يفضّل جهاز بنظام حديث.', 'For an incompatible Windows 7 message, use the compatibility installer. Python and runtime libraries are included; no separate software installation. Requires Windows 7 SP1. Windows 7 and Python 3.8 are out of support; a modern system is preferable.')}</p>
          <p className="text-xs text-ink-600">{label('Windows 10/11 · 64-bit. وصّل طابعة حرارية مثبتة بتعريف الشركة المصنّعة. قد يطلب المتصفح إذن الوصول للشبكة المحلية.', 'Windows 10/11 · 64-bit. Connect a thermal printer with its manufacturer Windows driver installed. Your browser may request local network permission.')}</p>
          {!connected && <p role="status">{label('في انتظار برنامج الطباعة… سيتم اكتشافه تلقائيًا بعد التثبيت.', 'Waiting for MenuzQR Print… It will be detected automatically after installation.')}</p>}
        </div>}
        <fieldset disabled={busy} className="space-y-3">
          <Button type="button" disabled={busy} loading={busy} onClick={() => connect()}>{label('إعادة الاتصال واكتشاف الطابعات', 'Reconnect and find printers')}</Button>
          {connected && <label className="block">{label('الطابعة', 'Printer')}<select value={settings.printer} onChange={e => patch({ printer: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3"><option value="">{label('اختار طابعة', 'Select printer')}</option>{printers.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}
          <label className="block">{label('عرض الورق', 'Paper width')}<select value={settings.width} onChange={e => { const width = Number(e.target.value) === 58 ? 58 : 80; patch({ width }); }} className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3"><option value={80}>80 mm</option><option value={58}>58 mm</option></select></label>
          <p className="text-xs text-ink-500">{label('الطباعة تستخدم تعريف Windows ومقاس الرول فقط. فعّل القص بعد كل مستند في تفضيلات تعريف الطابعة إذا كان الموديل يدعمه.', 'Printing uses your Windows driver and roll size. Enable cut after each document in the driver preferences if your printer supports it.')}</p>
          {connected && settings.printer && (receipt || pendingReceipt.current) && <Button type="button" disabled={busy} onClick={() => print(false, pendingReceipt.current ?? undefined)}>{label('طباعة الإيصال المحفوظ', 'Print saved receipt')}</Button>}
        </fieldset>
        {message && <p role="status" className="rounded-xl bg-ink-50 p-3">{message}</p>}
        <p className="text-xs text-ink-500">{label('الإعدادات بتتحفظ على الجهاز ده. جرّب الطباعة قبل التشغيل الفعلي. تأكيد الإرسال معناه إن Windows استلم الإيصال، مش إن الورق خرج.', 'Settings are saved on this device. Test before use. Sending confirms Windows accepted the job, not that paper physically printed.')}</p>
      </div>
    </Modal>
  </div>;
}
