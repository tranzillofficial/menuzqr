import type { QrTemplate } from './types';
/** Null is public; an empty list is private and unassigned. Branded cafe artwork is always private. */
export function qrTemplateAvailable(template: Pick<QrTemplate,'layout'|'allowed_restaurant_ids'>, restaurantId: string): boolean {
 const assigned=template.allowed_restaurant_ids;
 return assigned!=null ? assigned.includes(restaurantId) : template.layout!=='cafe';
}
