/**
 * MenuzQR activity-aware onboarding / plan configuration.
 * Central source for NEW signup experiences; existing paid subscriptions
 * must be preserved during migration.
 */
export const BUSINESS_ACTIVITIES = [
  { id: "restaurant", labelAr: "مطعم", labelEn: "Restaurant", catalog: "food_service" },
  { id: "cafe", labelAr: "كافيه", labelEn: "Café", catalog: "food_service" },
  { id: "supermarket", labelAr: "سوبر ماركت", labelEn: "Supermarket", catalog: "supermarket" },
  { id: "other", labelAr: "نشاط آخر", labelEn: "Other business", catalog: "empty" },
] as const;

export type BusinessActivity = (typeof BUSINESS_ACTIVITIES)[number]["id"];
export type BusinessCatalog = (typeof BUSINESS_ACTIVITIES)[number]["catalog"];
export type PlanId = "basic" | "starter" | "business" | "pro";
export type ModuleId =
  | "overview" | "catalog" | "categories" | "qr" | "settings"
  | "orders" | "pos" | "customers" | "inventory" | "barcode"
  | "reports" | "staff" | "tables" | "waiter_calls" | "kitchen"
  | "branches";

export const SUPERMARKET_PLANS: Record<PlanId, {
  label: string; monthlyEgp: number | null; yearlyEgp: number | null;
  lifetimeEgp: number | null; modules: readonly ModuleId[];
}> = {
  basic: {
    label: "Basic", monthlyEgp: null, yearlyEgp: null, lifetimeEgp: 800,
    modules: ["overview", "catalog", "categories", "qr", "settings"],
  },
  starter: {
    label: "Starter", monthlyEgp: 100, yearlyEgp: 1000, lifetimeEgp: null,
    modules: ["overview", "catalog", "categories", "qr", "settings", "orders", "pos", "barcode", "staff"],
  },
  business: {
    label: "Business", monthlyEgp: 200, yearlyEgp: 2000, lifetimeEgp: null,
    modules: ["overview", "catalog", "categories", "qr", "settings", "orders", "pos", "barcode", "customers", "inventory", "reports", "staff"],
  },
  pro: {
    label: "Pro", monthlyEgp: 300, yearlyEgp: 3000, lifetimeEgp: null,
    modules: ["overview", "catalog", "categories", "qr", "settings", "orders", "pos", "barcode", "customers", "inventory", "reports", "staff", "branches"],
  },
};

/** Modules meaningful for the selected activity, independently of payment. */
const ACTIVITY_MODULES: Record<BusinessActivity, readonly ModuleId[]> = {
  restaurant: ["overview","catalog","categories","qr","settings","orders","pos","customers","inventory","reports","staff","tables","waiter_calls","kitchen","branches"],
  cafe: ["overview","catalog","categories","qr","settings","orders","pos","customers","inventory","reports","staff","tables","waiter_calls","kitchen","branches"],
  supermarket: ["overview","catalog","categories","qr","settings","orders","pos","customers","inventory","reports","staff","barcode","branches"],
  other: ["overview","catalog","categories","qr","settings","orders","pos","customers","inventory","reports","staff","branches"],
};

export const ONBOARDING_STEPS = ["activity", "brand", "plan"] as const;

export function catalogForActivity(activity: BusinessActivity): BusinessCatalog {
  return BUSINESS_ACTIVITIES.find(item => item.id === activity)?.catalog ?? "empty";
}

/** Never grant modules based only on a client-provided plan id. */
export function allowedModules(
  activity: BusinessActivity,
  entitledModules: readonly ModuleId[],
): ModuleId[] {
  const allowed = new Set(ACTIVITY_MODULES[activity]);
  return entitledModules.filter(module => allowed.has(module));
}

/** Slug is only a suggestion. Backend MUST check unique availability on save. */
export function suggestedSlug(input: string): string {
  return input.trim().toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48).replace(/-+$/g, "");
}
