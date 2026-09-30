export type PricingSettings = {
  priceUsd: number; priceEgp: number; originalPriceEgp: number; originalPriceUsd: number;
  posMonthlyUsd: number; posYearlyUsd: number; posMonthlyEgp: number; posYearlyEgp: number;
  offerEnabled: boolean; posTrialDays: number;
};
export function localizedPricing(p: PricingSettings, locale: string) {
  const ar = locale === 'ar';
  return {
    currency: ar ? 'EGP' : 'USD',
    menu: p.offerEnabled ? (ar ? p.priceEgp : p.priceUsd) : (ar ? p.originalPriceEgp : p.originalPriceUsd),
    original: ar ? p.originalPriceEgp : p.originalPriceUsd,
    monthly: ar ? p.posMonthlyEgp : p.posMonthlyUsd,
    yearly: ar ? p.posYearlyEgp : p.posYearlyUsd,
    format: (value: number) => ar ? `${Math.ceil(value).toLocaleString('ar-EG')} جنيه` : `$${Math.ceil(value)}`,
  };
}
