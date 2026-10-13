export function offerTotals(
  items: { price: number; quantity: number }[],
  type: string,
  sale: number,
  kind = "percent",
  value = 0,
) {
  const originalCents = items.reduce(
    (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
    0,
  );
  const saleCents =
    type === "bundle"
      ? Math.round(sale * 100)
      : type === "discount"
        ? kind === "percent"
          ? Math.round((originalCents * (100 - value)) / 100)
          : originalCents - Math.round(value * 100)
        : originalCents;
  return {
    original: originalCents / 100,
    sale: saleCents / 100,
    saving: (originalCents - saleCents) / 100,
  };
}
