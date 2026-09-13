/**
 * The public menu designs. Names and descriptions live in the translation
 * dictionary under `theme.<id>.*` so they follow the interface language.
 *
 * Adding one: add the id here, to the `menu_theme` check constraint in SQL,
 * to `theme.<id>.*` in both dictionaries, and to the THEMES map in
 * components/menu/MenuExperience.tsx.
 */
export const MENU_THEMES = [
  { id: "elegant", swatch: ["#2f2a24", "#b9a88d", "#faf7f2"] },
  { id: "modern", swatch: ["#1c1917", "#ea580c", "#ffffff"] },
  { id: "minimal", swatch: ["#1c1917", "#a8a29e", "#ffffff"] },
  { id: "noir", swatch: ["#0b0b0d", "#c9a227", "#1a1a1f"] },
  { id: "market", swatch: ["#0f766e", "#f59e0b", "#fffbeb"] },
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


/**
 * Who a person is inside a restaurant.
 *
 * `owner` and `manager` run the dashboard. `waiter` and `chef` are sub-accounts
 * the owner creates: they sign in with their own email and password and land on
 * the station screen instead of the dashboard. `staff` is the older generic
 * role, kept so existing rows stay valid.
 */
export const MEMBER_ROLES = ["owner", "manager", "waiter", "chef", "staff"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/**
 * Roles an owner can hand out from /dashboard/staff.
 *
 * `manager` exists in the schema but is not offered yet: the dashboard's write
 * actions still resolve the restaurant by ownership, so a manager could open
 * the dashboard without being able to save anything. Offering a role that half
 * works is worse than not offering it.
 */
export const ASSIGNABLE_ROLES = ["waiter", "chef"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Roles that get the full dashboard. Everyone else gets /station. */
export const MANAGER_ROLES: MemberRole[] = ["owner", "manager"];

export const MAX_STAFF_PER_RESTAURANT = 25;
export const MIN_STAFF_PASSWORD = 8;

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
  // The shared menu ships to every restaurant that copies it, so it is the
  // one place worth compressing hardest. 1000px still covers the largest
  // place it renders (the full-screen product sheet on a phone).
  catalog: { maxEdge: 1000, quality: 0.72 },
} as const;

export type ImageRole = keyof typeof IMAGE_PRESETS;
