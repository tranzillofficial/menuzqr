import type { MenuData } from './types';

type Named = { name: string; name_en?: string | null; name_ar?: string | null; legacy_name?: string | null };
const key = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** Catalog fallback applies only while the merchant retains a source name. */
export function withCatalogName<T extends Named>(row: T, source?: Named | null): T {
  if (!source || ![source.name, source.name_en, source.legacy_name].some(name => name && key(name) === key(row.name))) return row;
  return { ...row, name_ar: source.name, name_en: row.name_en || source.name_en };
}

export function menuName(row: Named, locale: 'ar' | 'en') {
  return (locale === 'en' ? row.name_en : row.name_ar)?.trim() || row.name;
}

export function localizeMenu(data: MenuData, locale: 'ar' | 'en'): MenuData {
  return { ...data, categories: data.categories.map(category => ({
    ...category, name: menuName(category, locale),
    products: category.products.map(product => ({
      ...product, name: menuName(product, locale),
      product_variants: product.product_variants.map(variant => ({ ...variant, name: menuName(variant, locale) })),
    })),
  })) };
}
