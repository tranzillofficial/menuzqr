import type { Metadata } from "next";
import { getMyRestaurant, requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/Shell";
import { RestaurantForm } from "@/components/dashboard/RestaurantForm";

export const metadata: Metadata = { title: "Restaurant" };

export default async function RestaurantPage() {
  await requireUser();
  const restaurant = await getMyRestaurant();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={restaurant ? "Restaurant" : "Create your restaurant"}
        description={
          restaurant
            ? "Your public profile, branding and menu link."
            : "Tell us about your venue. You can change all of this later."
        }
      />
      <RestaurantForm restaurant={restaurant} />
    </div>
  );
}
