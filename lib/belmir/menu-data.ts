import type { MenuData } from '../types';
import type { MenuThemeId } from '../constants';
import type { BelmirContent } from './validation';

/** Adapt the managed café content to the same data contract as the demo. */
export function belmirMenuData(content: BelmirContent, theme: MenuThemeId): MenuData {
  const date = '2026-10-18T00:00:00Z';
  return {
    menu_path: '/belmir/menu',
    restaurant: {
      id: 'belmir', slug: 'belmir', name: 'Belmir', business_kind: 'cafe',
      description: 'A moment to share. Café & Bakery.',
      logo_url: '/belmir-site/assets/brand/belmir-seal.svg',
      cover_url: '/belmir-site/assets/coffee.jpg',
      phone: content.phone, address: content.address, currency: content.currency,
      language: 'en', menu_theme: theme, ordering_enabled: false, waiter_calls_enabled: false,
      tax_mode: 'none', vat_registered: false, prices_include_vat: true,
      menu_prices_include_vat: true, business_timezone: 'Africa/Cairo',
    },
    payments: {
      remote_ordering_enabled: false, cash_wallet: '', instapay_address: '',
      payment_whatsapp: content.whatsapp, location_url: content.mapsUrl,
      instagram_url: content.instagram, facebook_url: content.facebook, tiktok_url: content.tiktok,
      website_url: 'https://menuzqr.shop/belmir',
    },
    categories: content.categories.map((category, index) => ({
      id: category.id, restaurant_id: 'belmir', name: category.name,
      description: null, image_url: category.image || null, sort_order: index,
      is_active: true, created_at: date, updated_at: date,
      products: category.items.map((item, position) => ({
        id: item.id, restaurant_id: 'belmir', category_id: category.id,
        name: item.name,
        description: [item.description, item.priceApproximate && item.price !== '' ? 'Estimated price' : ''].filter(Boolean).join(' · ') || null,
        ingredients: null, image_url: item.image || null,
        image_source: item.image ? 'uploaded' : 'none',
        sort_order: position, is_active: true, created_at: date, updated_at: date,
        vat_code: 'standard',
        product_variants: item.price.trim() === '' ? [] : [{
          id: `${item.id}-standard`, restaurant_id: 'belmir', product_id: item.id,
          name: 'Standard', price: Number(item.price), image_url: null,
          sort_order: 0, is_active: true, created_at: date,
        }],
      })),
    })),
  };
}
