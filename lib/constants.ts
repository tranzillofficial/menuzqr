export const SUPPORT_WHATSAPP =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "") || "201094963553";

export const SUPPORT_WHATSAPP_DISPLAY = "+20 109 496 3553";

export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP}`;

export const PRICE_USD = 20;

export const MENU_THEMES = [
  {
    id: "elegant",
    name: "Elegant",
    tagline: "Premium dining",
    description:
      "Large photography, serif headings and generous spacing. Best for restaurants that want a fine-dining feel.",
  },
  {
    id: "modern",
    name: "Modern",
    tagline: "Cafés & fast casual",
    description:
      "Bold cards, strong hierarchy and a horizontal category rail. Compact but visual.",
  },
  {
    id: "minimal",
    name: "Minimal",
    tagline: "Simple & fast",
    description:
      "Typography-first list with no clutter. Loads fastest and reads perfectly on any phone.",
  },
] as const;

export type MenuThemeId = (typeof MENU_THEMES)[number]["id"];

export const MENU_THEME_IDS = MENU_THEMES.map((t) => t.id) as MenuThemeId[];

export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const RESTAURANT_STATUSES = ["inactive", "active", "suspended"] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "EGP", symbol: "E£" },
  { code: "SAR", symbol: "SR" },
  { code: "AED", symbol: "AED" },
  { code: "IQD", symbol: "IQD" },
  { code: "LYD", symbol: "LD" },
  { code: "KWD", symbol: "KD" },
  { code: "QAR", symbol: "QR" },
  { code: "JOD", symbol: "JD" },
  { code: "TRY", symbol: "₺" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
] as const;

export const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;

export const RESTAURANT_TYPES = [
  "Cafe",
  "Coffee Shop",
  "Fast Food",
  "Burger Joint",
  "Pizzeria",
  "Italian Restaurant",
  "Seafood Restaurant",
  "Grill / Steakhouse",
  "Middle Eastern Restaurant",
  "Asian Restaurant",
  "Bakery / Patisserie",
  "Juice Bar",
  "Dessert Shop",
  "Breakfast / Brunch",
];

/**
 * Image pipeline.
 *
 * Originals are never stored as-is: the browser downscales and re-encodes every
 * upload (see lib/image.ts) so menus stay fast on a phone connection. The input
 * limit is generous because what actually reaches storage is the compressed
 * result, which is typically 60-250 KB.
 */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

// SVG is intentionally absent: uploads are served from a public origin and an
// SVG can carry script.
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

/** Longest edge, in pixels, kept after compression — per image role. */
export const IMAGE_PRESETS = {
  logo: { maxEdge: 512, quality: 0.86 },
  cover: { maxEdge: 1600, quality: 0.78 },
  category: { maxEdge: 1200, quality: 0.78 },
  product: { maxEdge: 1200, quality: 0.8 },
  library: { maxEdge: 1200, quality: 0.8 },
} as const;

export type ImageRole = keyof typeof IMAGE_PRESETS;
