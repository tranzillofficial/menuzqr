import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { CouponManager } from "@/components/admin/CouponManager";
import { Card } from "@/components/ui/Card";
import type { Coupon } from "@/lib/types";

export const metadata: Metadata = { title: "Admin — Coupons" };

export default async function AdminCouponsPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Coupons</h1>
        <p className="mt-1 text-sm text-ink-500">
          Discounts on the one-time menu fee, the POS subscription, or both.
        </p>
      </div>

      <Card className="border-sky-200 bg-sky-50 p-4 sm:p-5">
        <p className="text-sm text-sky-900">
          Owners never see this list — they type a code you gave them and the server checks that one
          code. Nothing is charged automatically: a valid code changes the quoted price, and you
          apply it when they pay over WhatsApp.
        </p>
      </Card>

      <CouponManager coupons={(data ?? []) as Coupon[]} />
    </div>
  );
}
