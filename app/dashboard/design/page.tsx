import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/Shell";
import { ThemePicker } from "@/components/dashboard/ThemePicker";

export const metadata: Metadata = { title: "Menu Design" };

export default async function DesignPage() {
  const restaurant = await requireRestaurant();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Menu Design"
        description="Choose how your public menu looks. You can switch any time."
      />
      <ThemePicker
        current={restaurant.menu_theme}
        slug={restaurant.slug}
        isActive={restaurant.status === "active"}
      />
    </div>
  );
}
