import type { Metadata } from "next";
import {requireBusinessModule} from "@/lib/business-access";
import { PageHeader } from "@/components/dashboard/Shell";
import { getBusinessT as getT } from "@/lib/i18n/server";
import { ThemePicker } from "@/components/dashboard/ThemePicker";
import Link from "next/link";

export const metadata: Metadata = { title: "Menu Design" };

export default async function DesignPage() {
  const [member, t] = await Promise.all([requireBusinessModule("design"), getT()]);
  const restaurant=member.restaurant;


  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("design.title")}
        description={t("design.sub")}
      />
      {restaurant.business_kind === "supermarket" ? (
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <div className="mb-4 h-24 rounded-2xl bg-[#0f766e]" aria-hidden="true" />
          <h2 className="font-bold text-ink-900">{restaurant.language === "ar" ? "واجهة السوبر ماركت" : "Supermarket storefront"}</h2>
          <p className="mt-2 text-sm leading-7 text-ink-500">{restaurant.language === "ar" ? "واجهة موحدة لكل حسابات السوبر ماركت. يمكنك تخصيص الشعار والغلاف وصور الأقسام والمنتجات والعروض من أقسامها في لوحة التحكم." : "One storefront for all supermarket accounts. Customize your logo, cover, category and product images, and offers from their dashboard sections."}</p>
          <Link href={`/${restaurant.slug}/menu`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{restaurant.language === "ar" ? "معاينة المينيو" : "Preview menu"}</Link>
        </section>
      ) : <ThemePicker
        current={restaurant.menu_theme}
        slug={restaurant.slug}
        isActive={restaurant.status === "active"}
      />}
    </div>
  );
}
