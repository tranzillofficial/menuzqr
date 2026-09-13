import type { Metadata } from "next";
import { getMyRestaurant, requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/Shell";
import { getT } from "@/lib/i18n/server";
import { RestaurantForm } from "@/components/dashboard/RestaurantForm";

export const metadata: Metadata = { title: "Restaurant" };

export default async function RestaurantPage() {
  await requireUser();
  const [restaurant, t] = await Promise.all([getMyRestaurant(), getT()]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={restaurant ? t("restaurant.title") : t("restaurant.createTitle")}
        description={
          restaurant ? t("restaurant.sub") : t("restaurant.createSub")
        }
      />
      <RestaurantForm restaurant={restaurant} />
    </div>
  );
}
