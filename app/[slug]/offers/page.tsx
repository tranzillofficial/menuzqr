import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicMenu } from "@/lib/menu-data";
import { MenuUnavailable } from "@/components/menu/MenuUnavailable";
import { OfferCards } from "@/components/menu/OfferCards";
import { moduleEnabled } from "@/lib/business-modules";
import { getLocale } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";
export default async function OffersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublicMenu(slug, undefined, "__offers");
  if (result.state === "not_found") notFound();
  if (result.state === "inactive")
    return (
      <MenuUnavailable
        restaurantName={result.restaurantName}
        status={result.status}
        language={result.language}
      />
    );
  const data = result.data;
  if (!moduleEnabled(data.restaurant, "offers")) notFound();
  const ar = (await getLocale()) === "ar";
  const menuPath = data.menu_path ?? `/${slug}/menu`;
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header>
        <Link href={menuPath} className="text-sm text-brand-700">
          {ar ? "← الرجوع للمنيو" : "← Back to menu"}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">
          {data.restaurant.name} · {ar ? "العروض" : "Offers"}
        </h1>
      </header>
      {data.offers?.length ? (
        <OfferCards
          offers={data.offers}
          currency={data.restaurant.currency}
          whatsapp={data.payments?.payment_whatsapp}
          menuPath={menuPath}
        />
      ) : (
        <p className="rounded-2xl bg-white p-5 text-sm text-ink-500">
          {ar ? "لا توجد عروض حالية." : "No current offers."}
        </p>
      )}
    </main>
  );
}
