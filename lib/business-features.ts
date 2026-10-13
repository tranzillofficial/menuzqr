import { moduleEnabled, type BusinessConfig, type BusinessModule } from './business-modules';
export const FEATURE_REGISTRY = {
 product_description:{module:'products',ar:'وصف المنتجات',en:'Product descriptions'},
 product_ingredients:{module:'products',ar:'مكونات المنتجات',en:'Ingredients'},
 product_english:{module:'products',ar:'أسماء إنجليزية',en:'English names'},
 product_barcode:{module:'products',ar:'قراءة باركود المنتجات',en:'Barcode scanning'},
 product_weights:{module:'products',ar:'وحدات وأوزان البيع',en:'Weight selling units'},
 product_packaging:{module:'products',ar:'علب وكراتين',en:'Boxes and cartons'},
 tax_settings:{module:'settings',ar:'الضريبة',en:'VAT settings'},
 delivery_settings:{module:'settings',ar:'رسوم التوصيل',en:'Delivery fees'},
 payment_settings:{module:'settings',ar:'بيانات الدفع',en:'Payment instructions'},
 contact_settings:{module:'settings',ar:'التواصل واللوكيشن',en:'Contact and location'},
 online_ordering:{module:'orders',ar:'الطلب من المنيو',en:'Menu ordering'},
 receipt_printing:{module:'pos',ar:'طباعة الإيصالات',en:'Receipt printing'},
} as const;
export type BusinessFeature = keyof typeof FEATURE_REGISTRY;
export const BUSINESS_FEATURES = Object.keys(FEATURE_REGISTRY) as BusinessFeature[];
export function featureEnabled(config:BusinessConfig,feature:BusinessFeature):boolean {
 if(!moduleEnabled(config,FEATURE_REGISTRY[feature].module as BusinessModule))return false;
 if(config.enabled_modules?.includes('features_v3'))return config.enabled_modules.includes(feature)||(feature==='product_barcode'&&config.enabled_modules.includes('barcode'));
 const market=['market','supermarket'].includes(config.business_kind??config.business_type??'');
 if(feature==='product_barcode'&&config.enabled_modules?.includes('barcode'))return true;
 if(['product_description','product_ingredients','product_english','tax_settings'].includes(feature))return !market;
 if(['product_barcode','product_weights'].includes(feature))return market;
 if(feature==='product_packaging')return config.business_kind==='sweets';
 return true;
}
export function presetFeatures(kind:string):BusinessFeature[]{
 return BUSINESS_FEATURES.filter(feature=>featureEnabled({business_kind:kind},feature));
}
