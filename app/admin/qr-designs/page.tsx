import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { QrDesignManager } from "@/components/admin/QrDesignManager";
import type { QrTemplate } from "@/lib/types";

export const metadata: Metadata = { title: "Admin — QR designs" };

export default async function AdminQrDesignsPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("qr_templates")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">QR designs</h1>
        <p className="mt-1 text-sm text-ink-500">
          The label templates restaurants choose from on their QR codes page.
        </p>
      </div>
      <QrDesignManager templates={(data ?? []) as QrTemplate[]} />
    </div>
  );
}
