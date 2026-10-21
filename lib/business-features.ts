import {
  moduleEnabled,
  type BusinessConfig,
  type BusinessModule,
} from "./business-modules";
export const FEATURE_REGISTRY = {
  customer_create: { module: "customers", ar: "إضافة العملاء يدويًا", en: "Manually add customers" },
  customer_edit: { module: "customers", ar: "تعديل بيانات العملاء", en: "Edit customer details" },
  product_images: {
    module: "products",
    ar: "صور المنتجات",
    en: "Product images",
  },
  product_options: {
    module: "products",
    ar: "إضافة وحذف وحدات البيع",
    en: "Add/remove selling options",
  },
  qr_menu: { module: "qr", ar: "QR المنيو", en: "Menu QR" },
  qr_whatsapp: { module: "qr", ar: "QR واتساب", en: "WhatsApp QR" },
  qr_tables: {
    module: "qr",
    ar: "QR الطاولات (يتطلب الطاولات)",
    en: "Table QR (requires tables)",
  },
  qr_design: {
    module: "qr",
    ar: "تخصيص تصميم ومحتوى QR",
    en: "QR design and label editing",
  },
  qr_exports: {
    module: "qr",
    ar: "تحميل وطباعة QR",
    en: "QR downloads and printing",
  },
  offer_pos: { module: "offers", ar: "تطبيق العروض تلقائيًا في الكاشير", en: "Automatic POS offer pricing" },
  offer_bundle: { module: "offers", ar: "عروض الباكدج", en: "Bundle offers" },
  offer_discount: { module: "offers", ar: "عروض الخصم", en: "Discount offers" },
  offer_images: { module: "offers", ar: "صور العروض", en: "Offer images" },
  offer_schedule: {
    module: "offers",
    ar: "مدة العروض",
    en: "Offer scheduling",
  },
  offer_barcode_scan: {
    module: "offers",
    ar: "إضافة للعرض بالباركود",
    en: "Add offer items by barcode",
  },
  product_description: {
    module: "products",
    ar: "وصف المنتجات",
    en: "Product descriptions",
  },
  product_ingredients: {
    module: "products",
    ar: "مكونات المنتجات",
    en: "Ingredients",
  },
  product_english: {
    module: "products",
    ar: "أسماء إنجليزية",
    en: "English names",
  },
  product_barcode: {
    module: "products",
    ar: "قراءة باركود المنتجات",
    en: "Barcode scanning",
  },
  product_weights: {
    module: "products",
    ar: "وحدات وأوزان البيع",
    en: "Weight selling units",
  },
  product_packaging: {
    module: "products",
    ar: "علب وكراتين",
    en: "Boxes and cartons",
  },
  tax_settings: { module: "settings", ar: "الضريبة", en: "VAT settings" },
  delivery_settings: {
    module: "settings",
    ar: "رسوم التوصيل",
    en: "Delivery fees",
  },
  payment_settings: {
    module: "settings",
    ar: "بيانات الدفع",
    en: "Payment instructions",
  },
  contact_settings: {
    module: "settings",
    ar: "التواصل واللوكيشن",
    en: "Contact and location",
  },
  online_ordering: {
    module: "orders",
    ar: "الطلب من المنيو",
    en: "Menu ordering",
  },
  receipt_printing: {
    module: "pos",
    ar: "طباعة الإيصالات",
    en: "Receipt printing",
  },
} as const;
export type BusinessFeature = keyof typeof FEATURE_REGISTRY;
export const BUSINESS_FEATURES = Object.keys(
  FEATURE_REGISTRY,
) as BusinessFeature[];
export function featureEnabled(
  config: BusinessConfig,
  feature: BusinessFeature,
): boolean {
  if (
    !moduleEnabled(config, FEATURE_REGISTRY[feature].module as BusinessModule)
  )
    return false;
  if (feature === "qr_tables" && !moduleEnabled(config, "tables")) return false;
  if (config.enabled_modules?.includes("features_v3"))
    return (
      config.enabled_modules.includes(feature) ||
      (feature === "product_barcode" &&
        config.enabled_modules.includes("barcode"))
    );
  const market = ["market", "supermarket"].includes(
    config.business_kind ?? config.business_type ?? "",
  );
  if (
    feature === "product_barcode" &&
    config.enabled_modules?.includes("barcode")
  )
    return true;
  if (
    [
      "product_description",
      "product_ingredients",
      "product_english",
      "tax_settings",
    ].includes(feature)
  )
    return !market;
  if (["product_barcode", "product_weights"].includes(feature)) return market;
  if (feature === "product_packaging") return config.business_kind === "sweets";
  return true;
}
export function presetFeatures(kind: string): BusinessFeature[] {
  return BUSINESS_FEATURES.filter((feature) =>
    featureEnabled({ business_kind: kind }, feature),
  );
}

export const MENU_ONLY_FEATURES: BusinessFeature[] = ['product_images','product_options','product_description','product_ingredients','product_english','qr_menu','qr_design','qr_exports'];
