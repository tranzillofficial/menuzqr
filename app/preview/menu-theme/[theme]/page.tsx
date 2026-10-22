import type { Metadata } from "next";
import {requireBusinessModule} from "@/lib/business-access";
import { notFound } from "next/navigation";
import { MenuThemePreview } from "@/components/dashboard/MenuThemePreview";
import { MENU_THEME_IDS, type MenuThemeId } from "@/lib/constants";

export const metadata: Metadata = { title: "Menu design preview", robots: { index: false, follow: false } };

export default async function ThemePreviewPage({ params, searchParams }: {
  params: Promise<{ theme: string }>;
  searchParams: Promise<{ lang?: string; account?: string }>;
}) {
  const [{ theme }, search] = await Promise.all([params, searchParams]);
  if (!MENU_THEME_IDS.includes(theme as MenuThemeId)) notFound();
  const member=search.account==="1"?await requireBusinessModule("design"):null;
  const r=member?.restaurant;
  const branding=r?{name:r.name,description:r.description,logo_url:r.logo_url,cover_url:r.cover_url,cover_fit:r.cover_fit,cover_position_x:r.cover_position_x,cover_position_y:r.cover_position_y}:undefined;
  return <MenuThemePreview branding={branding} theme={theme as MenuThemeId} locale={search.lang === "en" ? "en" : "ar"} />;
}
