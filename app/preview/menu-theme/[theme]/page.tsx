import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuThemePreview } from "@/components/dashboard/MenuThemePreview";
import { MENU_THEME_IDS, type MenuThemeId } from "@/lib/constants";

export const metadata: Metadata = { title: "Menu design preview", robots: { index: false, follow: false } };

export default async function ThemePreviewPage({ params, searchParams }: {
  params: Promise<{ theme: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ theme }, search] = await Promise.all([params, searchParams]);
  if (!MENU_THEME_IDS.includes(theme as MenuThemeId)) notFound();
  return <MenuThemePreview theme={theme as MenuThemeId} locale={search.lang === "en" ? "en" : "ar"} />;
}
