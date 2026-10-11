"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveWhatsappQrAction } from "@/lib/actions/restaurant";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { QrCard } from "@/components/qr/QrCard";

export function WhatsappQrSettings({ number, restaurantId }: { number: string; restaurantId?: string }) {
  const [state, action] = useActionState(saveWhatsappQrAction, null);
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return <div className="space-y-4">
    <form action={action} className="space-y-4 rounded-2xl border border-ink-200 bg-white p-5">
      <h2 className="font-semibold">واتساب وQR التواصل · WhatsApp QR</h2>
      {restaurantId && <input type="hidden" name="restaurant_id" value={restaurantId}/>}
      <label className="block text-sm">رقم واتساب بكود الدولة · Number with country code
        <input key={number} name="whatsapp_number" type="tel" dir="ltr" maxLength={24} defaultValue={number} placeholder="201012345678" className="mt-2 w-full rounded-xl border p-3"/>
      </label>
      <p className="text-xs text-ink-500">احفظ الرقم لإظهار QR يفتح محادثة واتساب مباشرة. يُستخدم نفس الرقم للتواصل بشأن الطلبات. Save to generate a WhatsApp QR. This number also receives order enquiries.</p>
      {state && <p role="status" className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p>}
      <SubmitButton>حفظ الرقم · Save number</SubmitButton>
    </form>
    {number && <div className="max-w-sm"><QrCard key={number} title="WhatsApp · واتساب" url={`https://wa.me/${number}`} filename="whatsapp-qr"/></div>}
  </div>;
}
