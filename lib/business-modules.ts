export const BUSINESS_MODULES = ['pos','reports','catalog','tables','orders','staff','design','service_calls','subcategories'] as const;
export type BusinessModule = typeof BUSINESS_MODULES[number];
export type BusinessConfig = { business_kind?: string | null; enabled_modules?: string[] | null };
export const MODULE_LABELS: Record<BusinessModule,{ar:string;en:string}> = {
 pos:{ar:'الكاشير',en:'Point of sale'},reports:{ar:'تقارير المبيعات',en:'Sales reports'},catalog:{ar:'المكتبة العامة',en:'General catalog'},tables:{ar:'الطاولات',en:'Tables'},orders:{ar:'الطلبات',en:'Orders'},staff:{ar:'حسابات الموظفين',en:'Staff accounts'},design:{ar:'تصميم المنيو',en:'Menu design'},service_calls:{ar:'نداءات الخدمة',en:'Service calls'},subcategories:{ar:'الأقسام الفرعية',en:'Subcategories'}
};
// Null preserves the existing experience; hierarchy is explicitly opt-in.
export function moduleEnabled(config: BusinessConfig, module: BusinessModule): boolean {
 return config.enabled_modules == null ? module !== 'subcategories' : config.enabled_modules.includes(module);
}
export const RETAIL_MODULES: BusinessModule[] = ['pos','reports','orders','staff','subcategories'];
export function moduleForPath(path: string): BusinessModule | null {
 const segment = path.split('/')[2];
 return BUSINESS_MODULES.includes(segment as BusinessModule) ? segment as BusinessModule : null;
}
export function dashboardPathEnabled(config: BusinessConfig, path: string) {
 const feature = moduleForPath(path); return !feature || moduleEnabled(config,feature);
}
