import { moduleEnabled } from "@/lib/business-modules";
import type { Metadata } from "next";
import { getMyRestaurant, requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/Shell";
import { getBusinessT as getT, getLocale } from "@/lib/i18n/server";
import { RestaurantForm } from "@/components/dashboard/RestaurantForm";

export const metadata: Metadata = { title: "Restaurant" };

export default async function RestaurantPage() {
  await requireUser();
  const [restaurant, t] = await Promise.all([getMyRestaurant(), getT()]);

  const retail = restaurant?.enabled_modules != null && !moduleEnabled(restaurant,"tables");
  const ar = await getLocale() === "ar";
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={retail ? (ar ? "بيانات الفرع" : "Branch details") : restaurant ? t("restaurant.title") : t("restaurant.createTitle")}
        description={
          retail ? (ar ? "بيانات النشاط ووسائل التواصل" : "Business details and contact information") : restaurant ? t("restaurant.sub") : t("restaurant.createSub")
        }
      />
      <RestaurantForm restaurant={restaurant} />
    </div>
  );
}
