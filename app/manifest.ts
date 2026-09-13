import type { MetadataRoute } from "next";

/**
 * Installing the site to a phone's home screen is what makes background
 * notifications possible at all: on iOS, web push is only delivered to a page
 * that has been added to the Home Screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MenuzQR — restaurant dashboard",
    short_name: "MenuzQR",
    description:
      "Run your QR menu: live orders, waiter calls and kitchen tickets on any phone or tablet.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ea580c",
    categories: ["food", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
