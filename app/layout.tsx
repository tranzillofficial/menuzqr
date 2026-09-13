import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display, Cairo } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { getLocale } from "@/lib/i18n/server";
import { dirOf } from "@/lib/i18n";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const cairo = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "MenuzQR — Digital QR menus for restaurants & cafés",
    template: "%s · MenuzQR",
  },
  description:
    "Build a beautiful digital menu for your restaurant in minutes, generate QR codes for every table, and take orders straight from the table.",
  manifest: "/manifest.webmanifest",
  applicationName: "MenuzQR",
  appleWebApp: {
    capable: true,
    title: "MenuzQR",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${cairo.variable} h-full`}
    >
      <body className="min-h-full">
        <I18nProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
