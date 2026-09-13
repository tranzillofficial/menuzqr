"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MenuData, ProductWithVariants } from "@/lib/types";

export type CartItem = {
  key: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
  note: string;
  imageUrl: string | null;
};

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
    const total =
      Math.round(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) * 100) / 100;

    return {
      data,
      currency: data.restaurant.currency,
      showPrices,
      showIngredients,
      table,
      // A signed-in waiter or cook can still take an order from a table even
      // when the owner has switched guest ordering off.
      orderingEnabled: (data.restaurant.ordering_enabled || staffMode) && Boolean(table),
      waiterEnabled: (data.restaurant.waiter_calls_enabled || staffMode) && Boolean(table),
      staffMode,
      items,
      itemCount,
      total,
      openProduct: setActiveProduct,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      activeProduct,
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

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}
