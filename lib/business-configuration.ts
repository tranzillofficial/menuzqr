import {BUSINESS_MODULES,type BusinessModule} from './business-modules';
import {BUSINESS_FEATURES,FEATURE_REGISTRY,type BusinessFeature} from './business-features';
export type BusinessType = {id:string;key:string;name_ar:string;name_en:string;business_kind:string;available_modules:string[];default_modules:string[];available_capabilities:string[];default_capabilities:string[];country_code:string;currency:string;is_active:boolean};
export type ConfigurationOverride = {feature_key:string;enabled:boolean};
export const CONFIGURATION_KEYS=[...BUSINESS_MODULES,...BUSINESS_FEATURES];
export function resolveConfiguration(type:Pick<BusinessType,'default_modules'|'default_capabilities'> & Partial<Pick<BusinessType,'available_modules'|'available_capabilities'>>,overrides:ConfigurationOverride[]){
 const flags=new Set([...type.default_modules,...type.default_capabilities]);
 for(const override of overrides)if(CONFIGURATION_KEYS.includes(override.feature_key as BusinessModule|BusinessFeature)){if(override.enabled)flags.add(override.feature_key);else flags.delete(override.feature_key);}
 const unavailable=overrides.filter(o=>o.enabled&&(BUSINESS_MODULES.includes(o.feature_key as BusinessModule)?type.available_modules&&!type.available_modules.includes(o.feature_key):type.available_capabilities&&!type.available_capabilities.includes(o.feature_key)));
 const modules=BUSINESS_MODULES.filter(id=>flags.has(id));
 const capabilities=BUSINESS_FEATURES.filter(id=>flags.has(id)&&flags.has(FEATURE_REGISTRY[id].module));
 const errors:string[]=unavailable.map(o=>`${o.feature_key} is not available for this business type`);
 if(flags.has('service_calls')&&!flags.has('tables'))errors.push('service_calls requires tables');
 for(const override of overrides)if(override.enabled&&BUSINESS_FEATURES.includes(override.feature_key as BusinessFeature)&&!flags.has(FEATURE_REGISTRY[override.feature_key as BusinessFeature].module))errors.push(`${override.feature_key} requires ${FEATURE_REGISTRY[override.feature_key as BusinessFeature].module}`);
 return {modules,capabilities,errors,enabled_modules:[...modules,...capabilities,'features_v2','features_v3']};
}
export function normalizeBusinessKind(kind:string|null|undefined){return kind==='market'?'supermarket':kind==='wholesale'?'sweets':kind==='cafe'?'restaurant':kind;}
export function canonicalModuleId(id:string){return id==='team'?'staff':id==='barcode'?'product_barcode':id;}
