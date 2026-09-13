import type { Metadata } from "next";
import { requireRestaurant } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/Shell";
import { getT } from "@/lib/i18n/server";
import { ThemePicker } from "@/components/dashboard/ThemePicker";

export const metadata: Metadata = { title: "Menu Design" };

export default async function DesignPage() {
  const [restaurant, t] = await Promise.all([requireRestaurant(), getT()]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("design.title")}
        description={t("design.sub")}
      />
      <ThemePicker
        current={restaurant.menu_theme}
        slug={restaurant.slug}
        isActive={restaurant.status === "active"}
      />
    </div>
  );
}
