export const CATALOG_ACTIVITIES = [
  {id:'cafe',ar:'كافيه',en:'Café'},
  {id:'restaurant',ar:'مطعم',en:'Restaurant'},
  {id:'supermarket',ar:'سوبرماركت',en:'Supermarket'},
  {id:'sweets',ar:'حلويات',en:'Sweets shop'},
  {id:'retail',ar:'متجر',en:'Retail shop'},
] as const;
export type CatalogActivity = typeof CATALOG_ACTIVITIES[number]['id'];
export function catalogActivityMatches(category: {business_types?: string[] | null}, activity: string) {
  return activity === 'all' || !category.business_types?.length || category.business_types.includes(activity);
}
