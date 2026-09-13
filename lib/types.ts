import type { MemberRole, MenuThemeId, OrderStatus, RestaurantStatus } from "./constants";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
};

export type Restaurant = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  language: string;
  restaurant_type: string | null;
  menu_theme: MenuThemeId;
  ordering_enabled: boolean;
  waiter_calls_enabled: boolean;
  status: RestaurantStatus;
  activated_at: string | null;
  activation_expires_at: string | null;
  payment_method: string | null;
  payment_status: string | null;
  subscription_type: string | null;
  price_cents: number;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductVariant = {
  id: string;
  restaurant_id: string;
  product_id: string;
  name: string;
  price: number;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  ingredients: string | null;
  image_url: string | null;
  image_source: "uploaded" | "library" | "none";
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductWithVariants = Product & { product_variants: ProductVariant[] };

export type RestaurantTable = {
  id: string;
  restaurant_id: string;
  label: string;
  qr_token: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  restaurant_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  note: string | null;
  line_total: number;
};

export type Order = {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  placed_by: string | null;
  order_number: number;
  public_token: string;
  session_id: string | null;
  status: OrderStatus;
  note: string | null;
  total: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type OrderWithDetails = Order & {
  order_items: OrderItem[];
  restaurant_tables: Pick<RestaurantTable, "id" | "label"> | null;
};

export type WaiterRequest = {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  order_id: string | null;
  origin: "guest" | "staff";
  created_by: string | null;
  note: string | null;
  status: "pending" | "handled" | "cancelled";
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
  restaurant_tables?: Pick<RestaurantTable, "id" | "label"> | null;
  orders?: Pick<Order, "id" | "order_number"> | null;
};

/** A row of `restaurant_members`, joined with the account's email. */
export type StaffMember = {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: MemberRole;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  email: string | null;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  restaurant_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type LibraryImage = {
  id: string;
  group_name: string;
  category: string;
  title: string;
  keywords: string[];
  url: string;
  attribution: string | null;
  license: string | null;
  sort_order: number;
  is_active: boolean;
};

export type QrTemplate = {
  id: string;
  name: string;
  layout: "counter" | "square" | "tent";
  scope: "general" | "table" | "both";
  bg_color: string;
  panel_color: string;
  accent_color: string;
  text_color: string;
  qr_color: string;
  headline: string | null;
  cta_text: string | null;
  is_active: boolean;
  sort_order: number;
};

export type CatalogVariant = { name: string; price?: number | null };

export type CatalogCategory = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type CatalogItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  ingredients: string | null;
  category_name: string | null;
  image_url: string | null;
  variants: CatalogVariant[];
  keywords: string[];
  cuisine: string | null;
  is_active: boolean;
  sort_order: number;
};

export type AdminAction = {
  id: string;
  restaurant_id: string;
  admin_id: string | null;
  action: string;
  notes: string | null;
  created_at: string;
};

/** Everything a public menu theme needs to render. */
export type MenuData = {
  restaurant: Pick<
    Restaurant,
    | "id"
    | "name"
    | "slug"
    | "description"
    | "logo_url"
    | "cover_url"
    | "phone"
    | "address"
    | "currency"
    | "language"
    | "menu_theme"
    | "ordering_enabled"
    | "waiter_calls_enabled"
  >;
  categories: Array<Category & { products: ProductWithVariants[] }>;
};

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;
