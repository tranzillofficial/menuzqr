import {moduleEnabled,type BusinessConfig,type BusinessModule} from './business-modules';
import {featureEnabled,type BusinessFeature} from './business-features';
export type PolicyContext={role:string;active?:boolean;posAvailable?:boolean;permission?:string;permissions?:readonly string[]};
export type PolicyDecision={allowed:boolean;reason:'allowed'|'module_disabled'|'capability_disabled'|'role_denied'|'subscription_denied'|'account_inactive'};
export function businessPolicy(config:BusinessConfig,target:BusinessModule|BusinessFeature,context:PolicyContext,options:{capability?:boolean;requiresPos?:boolean;public?:boolean}={}):PolicyDecision{
 if(context.active===false)return {allowed:false,reason:'account_inactive'};
 if(options.capability?!featureEnabled(config,target as BusinessFeature):!moduleEnabled(config,target as BusinessModule))return {allowed:false,reason:options.capability?'capability_disabled':'module_disabled'};
 if(!options.public && !['owner','manager','admin'].includes(context.role) && !(context.permission&&context.permissions?.includes(context.permission)))return {allowed:false,reason:'role_denied'};
 if(options.requiresPos&&context.posAvailable!==true)return {allowed:false,reason:'subscription_denied'};
 return {allowed:true,reason:'allowed'};
}
