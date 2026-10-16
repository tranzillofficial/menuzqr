import {BUSINESS_ACTIVITIES,type BusinessActivity} from './activity-onboarding-config';
export type OnboardingDraft={activity:BusinessActivity|'';step:number;name:string;slug:string;phone:string;website_url:string;instagram_url:string;facebook_url:string;logo_url:string;description:string;plan:string;yearly:boolean};
export const EMPTY_ONBOARDING:OnboardingDraft={activity:'',step:0,name:'',slug:'',phone:'',website_url:'',instagram_url:'',facebook_url:'',logo_url:'',description:'',plan:'qr',yearly:false};
export function normalizeDraft(value:unknown):OnboardingDraft {
 const input=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const result={...EMPTY_ONBOARDING};
 for(const key of ['name','slug','phone','website_url','instagram_url','facebook_url','logo_url','description','plan'] as const)result[key]=typeof input[key]==='string'?input[key].slice(0,key==='name'?80:500):result[key];
 result.activity=BUSINESS_ACTIVITIES.some(a=>a.id===input.activity)?input.activity as BusinessActivity:'';
 result.step=result.activity&&Number.isInteger(input.step)?Math.max(0,Math.min(2,Number(input.step))):0;
 result.yearly=input.yearly===true;
 return result;
}
// These are setup capabilities, never selected-plan entitlements. Payment stays admin controlled.
export const SETUP_MODULES=['features_v2','features_v3','branch','products','catalog','design','qr','settings','product_images','product_description','product_english','qr_menu','qr_whatsapp','qr_design','qr_exports','contact_settings'];
