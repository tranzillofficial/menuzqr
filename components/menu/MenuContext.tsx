"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { orderTaxAmounts, taxAmounts } from "@/lib/tax";
import type { MenuData, ProductWithVariants } from "@/lib/types";

export type CartItem = {
  key: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  tax?: { basePrice: number; rate: number; inclusive: boolean; showGross?: boolean };
  quantity: number;
  note: string;
  imageUrl: string | null;
};

export function cartLineTotal(item: Pick<CartItem,"unitPrice"|"quantity"|"tax">) { return item.tax ? taxAmounts(item.tax.basePrice,item.quantity,item.tax.rate,item.tax.inclusive).gross : Math.round(item.unitPrice*item.quantity*100)/100; }

export function cartLineDisplay(item: Pick<CartItem,"unitPrice"|"quantity"|"tax">) { return item.tax?.showGross === false && !item.tax.inclusive ? Math.round(item.tax.basePrice*item.quantity*100)/100 : cartLineTotal(item); }
export function cartLineVat(item: Pick<CartItem,"unitPrice"|"quantity"|"tax">) { return item.tax ? taxAmounts(item.tax.basePrice,item.quantity,item.tax.rate,item.tax.inclusive).vat : 0; }

type MenuContextValue = {
  data: MenuData;
  currency: string;
  showPrices: boolean;
  showIngredients: boolean;
  staffMode: boolean;
  table: { id: string; label: string } | null;
  orderingEnabled: boolean;
  waiterEnabled: boolean;
  items: CartItem[];
  itemCount: number;
  total: number;
  vat: number;
  openProduct: (product: ProductWithVariants) => void;
  addItem: (item: Omit<CartItem, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  activeProduct: ProductWithVariants | null;
  closeProduct: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
};

const MenuContext = createContext<MenuContextValue | null>(null);

export function useMenu() {
  const value = useContext(MenuContext);
  if (!value) throw new Error("useMenu must be used inside MenuProvider");
  return value;
}

export function MenuProvider({
  data,
  table,
  showPrices,
  showIngredients,
  staffMode = false,
  children,
}: {
  data: MenuData;
  table: { id: string; label: string } | null;
  showPrices: boolean;
  showIngredients: boolean;
  staffMode?: boolean;
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [activeProduct, setActiveProduct] = useState<ProductWithVariants | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const addItem = useCallback((item: Omit<CartItem, "key">) => {
    setItems((list) => {
      const existing = list.find(
        (i) => i.variantId === item.variantId && i.note.trim() === item.note.trim()
      );
      if (existing) {
        return list.map((i) =>
          i.key === existing.key
            ? { ...i, quantity: Math.min(99, i.quantity + item.quantity) }
            : i
        );
      }
      return [...list, { ...item, key: `${item.variantId}-${Date.now()}` }];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((list) =>
      quantity <= 0
        ? list.filter((i) => i.key !== key)
        : list.map((i) => (i.key === key ? { ...i, quantity: Math.min(99, quantity) } : i))
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((list) => list.filter((i) => i.key !== key));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo<MenuContextValue>(() => {
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const amounts = orderTaxAmounts(items.map(i => ({ price: i.tax?.basePrice ?? i.unitPrice, quantity: i.quantity, rate: i.tax?.rate ?? 0 })), data.restaurant);
    const total = amounts.gross;

    return {
      data,
      currency: data.restaurant.currency,
      showPrices,
      showIngredients,
      table,
      // A signed-in waiter or cook can still take an order from a table even
      // when the owner has switched guest ordering off.
      orderingEnabled: (data.restaurant.ordering_enabled || (staffMode && Boolean(table))) && (Boolean(table) || Boolean(data.restaurant.business_kind === "supermarket" || data.payments?.remote_ordering_enabled && (data.payments.cash_wallet || data.payments.instapay_address) && data.payments.payment_whatsapp)),
      waiterEnabled: (data.restaurant.waiter_calls_enabled || staffMode) && Boolean(table),
      staffMode,
      items: items.map(item => {
        const product = data.categories.flatMap(category => category.products).find(product => product.id === item.productId);
        const variant = product?.product_variants.find(variant => variant.id === item.variantId);
        return { ...item, productName: product?.name ?? item.productName, variantName: variant?.name ?? item.variantName };
      }),
      itemCount,
      total,
      vat: amounts.vat,
      openProduct: setActiveProduct,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      activeProduct: activeProduct ? data.categories.flatMap(category => category.products).find(product => product.id === activeProduct.id) ?? activeProduct : null,
      closeProduct: () => setActiveProduct(null),
      cartOpen,
      setCartOpen,
    };
  }, [
    data,
    items,
    table,
    showPrices,
    showIngredients,
    staffMode,
    addItem,
    setQuantity,
    removeItem,
    clearCart,
    activeProduct,
    cartOpen,
  ]);

  return <MenuContext.Provider value={value}>{showPrices && data.restaurant.vat_registered && !data.restaurant.prices_include_vat && data.restaurant.menu_prices_include_vat === false && <p className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">الأسعار قبل الضريبة؛ VAT تضاف إلى الإجمالي قبل تأكيد الطلب. · Prices exclude VAT; VAT is added to the total before ordering.</p>}{children}</MenuContext.Provider>;
}
