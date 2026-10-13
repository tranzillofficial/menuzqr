"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveWhatsappQrAction } from "@/lib/actions/restaurant";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {WhatsappQrStudio} from "@/components/qr/WhatsappQrStudio";

export function WhatsappQrSettings({ number, restaurantId }: { number: string; restaurantId?: string }) {
  const [state, action] = useActionState(saveWhatsappQrAction, null);
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return <div className="space-y-4">
    <form action={action} className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5">
      <h2 className="font-semibold">واتساب وQR التواصل · WhatsApp QR</h2>
      {restaurantId && <input type="hidden" name="restaurant_id" value={restaurantId}/>}
      <label className="block text-sm">رقم واتساب · Egypt +20
        <input key={number} name="whatsapp_number" type="tel" dir="ltr" maxLength={24} defaultValue={number} placeholder="01012345678" className="mt-2 w-full rounded-xl border border-ink-100 p-3 text-xs sm:text-sm"/>
      </label>
      <p className="text-xs text-ink-500">احفظ الرقم لإظهار QR يفتح محادثة واتساب مباشرة. يُستخدم نفس الرقم للتواصل بشأن الطلبات. الأرقام المصرية يُضاف لها +20 تلقائيًا. Save to generate a WhatsApp QR. This number also receives order enquiries.</p>
      {state && <p role="status" className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p>}
      <SubmitButton>حفظ الرقم · Save number</SubmitButton>
    </form>
    {number && <div className="max-w-sm"><WhatsappQrStudio key={number} number={number}/></div>}
  </div>;
}
