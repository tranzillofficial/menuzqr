export type BelmirItem = { id: string; name: string; price: string; image: string; description?: string; priceApproximate?: boolean };
export type BelmirCategory = { id: string; name: string; type: 'drinks' | 'food'; image: string; items: BelmirItem[] };
export type BelmirContent = { phone: string; whatsapp: string; address: string; mapsUrl: string; instagram: string; facebook: string; currency: string; defaultView: 'list' | 'grid'; categories: BelmirCategory[] };
function text(value: unknown, max: number, required = false): string {
 if(typeof value !== 'string' || value.length > max || (required && !value.trim())) throw Error('Please check the required fields and text length.');
 return value.trim();
}
function record(value: unknown): Record<string, unknown> { if(!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid content.'); return value as Record<string, unknown>; }
function url(value: unknown, image = false): string {
 const s=text(value,2048);if(!s)return '';
 if(image && /^\/belmir-site\/assets\/[a-zA-Z0-9._-]+$/.test(s))return s;
 let u: URL;try{u=new URL(s);}catch{throw Error('Use a full HTTPS link.');}
 if(u.protocol!=='https:' || u.username || u.password)throw Error('Use a full HTTPS link.');return u.href;
}
export function validateBelmirContent(value: unknown): BelmirContent {
 const v=record(value);if(!Array.isArray(v.categories)||v.categories.length<1||v.categories.length>40)throw Error('Keep between 1 and 40 categories.');
 const ids=new Set<string>();let total=0;
 const id=(v:unknown)=>{const s=text(v,80,true);if(!/^[a-zA-Z0-9_-]+$/.test(s)||ids.has(s))throw Error('Invalid or duplicate item ID.');ids.add(s);return s;};
 const categories=v.categories.map(raw=>{const c=record(raw);if(!Array.isArray(c.items)||c.items.length>200)throw Error('Too many products in a category.');if(c.type!=='drinks'&&c.type!=='food')throw Error('Choose a category type.');
 const items=c.items.map(raw=>{total++;const p=record(raw);const price=text(p.price,12);if(price && (!/^\d+(\.\d{1,2})?$/.test(price)||Number(price)>1000000))throw Error('Prices must be positive amounts with up to 2 decimal places.');if(p.priceApproximate!==undefined&&typeof p.priceApproximate!=='boolean')throw Error('Invalid price flag.');return {id:id(p.id),name:text(p.name,160,true),price,image:url(p.image,true),description:text(p.description??'',300),priceApproximate:p.priceApproximate===true};});
 return {id:id(c.id),name:text(c.name,100,true),type:c.type,image:url(c.image,true),items} as BelmirCategory;});
 if(total>1000)throw Error('Maximum 1,000 products.');
 const phone=text(v.phone,30,true),whatsapp=text(v.whatsapp,20);
 if(!/^[+\d ()-]{6,30}$/.test(phone)|| (whatsapp&&!/^\d{8,15}$/.test(whatsapp)))throw Error('Check phone and WhatsApp numbers.');
 const currency=text(v.currency,3,true);if(!/^[A-Z]{3}$/.test(currency))throw Error('Use a three-letter currency, e.g. EGP.');
 if(v.defaultView!=='list'&&v.defaultView!=='grid')throw Error('Choose list or grid view.');
 return {phone,whatsapp,address:text(v.address,500,true),mapsUrl:url(v.mapsUrl),instagram:url(v.instagram),facebook:url(v.facebook),currency,defaultView:v.defaultView,categories};
}
