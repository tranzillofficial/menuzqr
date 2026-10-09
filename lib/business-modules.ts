// Register a implemented feature here once: navigation and account controls share it.
export const MODULE_REGISTRY = {
 offers:{nav:{label:"nav.offers",icon:"sparkles"},ar:"العروض",en:"Offers",paths:["offers"]},
 customers:{nav:{label:"nav.customers",icon:"users"},ar:"العملاء",en:"Customers",paths:["customers"]},
 pos:{nav:{label:"nav.pos",icon:"receipt"},ar:'الكاشير',en:'Point of sale',paths:['pos']},
 reports:{nav:{label:"nav.reports",icon:"receipt"},ar:'تقارير المبيعات',en:'Sales reports',paths:['reports']},
 catalog:{nav:{label:"nav.catalog",icon:"sparkles"},ar:'المكتبة العامة',en:'General catalog',paths:['catalog']},
 tables:{nav:{label:"nav.tables",icon:"table"},ar:'الطاولات',en:'Tables',paths:['tables']},
 orders:{nav:{label:"nav.orders",icon:"receipt"},ar:'الطلبات',en:'Orders',paths:['orders']},
 staff:{nav:{label:"nav.staff",icon:"users"},ar:'حسابات الموظفين',en:'Staff accounts',paths:['staff']},
 design:{nav:{label:"nav.design",icon:"palette"},ar:'تصميم المنيو',en:'Menu design',paths:['design']},
 service_calls:{ar:'نداءات الخدمة',en:'Service calls',paths:[]},
 subcategories:{ar:'الأقسام الفرعية',en:'Subcategories',paths:[]},
 branch:{nav:{label:"nav.restaurant",icon:"store"},ar:'الفرع وبيانات النشاط',en:'Branch and business profile',paths:['restaurant']},
 products:{nav:{label:"nav.products",icon:"grid"},ar:'المنتجات والأقسام',en:'Products and categories',paths:['products','categories']},
 qr:{nav:{label:"nav.qrCodes",icon:"qr"},ar:'أكواد QR',en:'QR codes',paths:['qr-codes']},
 settings:{nav:{label:"nav.settings",icon:"settings"},ar:'الإعدادات',en:'Settings',paths:['settings']},
} as const;
export type BusinessModule = keyof typeof MODULE_REGISTRY;
export const BUSINESS_MODULES = Object.keys(MODULE_REGISTRY) as BusinessModule[];
export const MODULE_LABELS = MODULE_REGISTRY;
export type BusinessConfig = { business_kind?: string | null; enabled_modules?: string[] | null };
// Old custom arrays predate core toggles; retain their previously available tools.
const CORE: BusinessModule[]=['branch','products','qr','settings'];
export function moduleEnabled(config: BusinessConfig, module: BusinessModule): boolean {
 if(config.enabled_modules==null)return module!=='subcategories';
 if(CORE.includes(module)&&!config.enabled_modules.includes('features_v2'))return true;
 return config.enabled_modules.includes(module);
}
export const RETAIL_MODULES: BusinessModule[] = ['pos','reports','orders','staff','subcategories',...CORE];
export const BUSINESS_PRESETS = {
 restaurant:{ar:'مطعم أو كافيه',en:'Restaurant or cafe',modules:BUSINESS_MODULES.filter(m=>m!=='subcategories')},
 sweets:{ar:'حلويات وتجارة جملة',en:'Sweets and wholesale',modules:RETAIL_MODULES},
 supermarket:{ar:'سوبر ماركت',en:'Supermarket',modules:RETAIL_MODULES},
 retail:{ar:'محل أو شركة',en:'Retail or company',modules:RETAIL_MODULES},
} as const;
export function moduleForPath(path:string):BusinessModule|null {
 const segment=path.split('/')[2];
 return BUSINESS_MODULES.find(m=>(MODULE_REGISTRY[m].paths as readonly string[]).includes(segment))??null;
}
export function dashboardPathEnabled(config:BusinessConfig,path:string){const feature=moduleForPath(path);return !feature||moduleEnabled(config,feature);}

export const MODULE_NAVIGATION = BUSINESS_MODULES.flatMap(id=>{
 const feature=MODULE_REGISTRY[id];
 return 'nav' in feature ? [{id,href:'/dashboard/'+feature.paths[0],label:feature.nav.label,icon:feature.nav.icon}] : [];
});
