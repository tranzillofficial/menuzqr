"use client";

import { MenuProvider } from "./MenuContext";
import { ProductSheet } from "./ProductSheet";
import { CartBar } from "./CartSheet";
import { WaiterButton } from "./WaiterButton";
import { ElegantMenu } from "./themes/ElegantMenu";
import { ModernMenu } from "./themes/ModernMenu";
import { MinimalMenu } from "./themes/MinimalMenu";
import type { MenuData } from "@/lib/types";

const THEMES = {
  elegant: ElegantMenu,
  modern: ModernMenu,
  minimal: MinimalMenu,
} as const;

export function MenuExperience({
  data,
  table,
  tableToken,
  showPrices,
  showIngredients,
}: {
  data: MenuData;
  table: { id: string; label: string } | null;
  tableToken: string;
  showPrices: boolean;
  showIngredients: boolean;
}) {
  const Theme = THEMES[data.restaurant.menu_theme] ?? ElegantMenu;
  const lightFab = data.restaurant.menu_theme === "elegant";

  return (
    <MenuProvider
      data={data}
      table={table}
      showPrices={showPrices}
      showIngredients={showIngredients}
    >
      {table && (
        <div className="sticky top-0 z-30 bg-ink-900 px-4 py-2 text-center text-xs font-medium text-white">
          You are at {table.label}
        </div>
      )}

      <Theme />

      <ProductSheet />

      {table && (
        <>
          <CartBar slug={data.restaurant.slug} tableToken={tableToken} />
          <WaiterButton
            slug={data.restaurant.slug}
            tableToken={tableToken}
            variant={lightFab ? "light" : "dark"}
          />
        </>
      )}
    </MenuProvider>
  );
}
