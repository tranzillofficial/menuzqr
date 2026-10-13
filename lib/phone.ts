/** Store WhatsApp digits in international format, without duplicating Egypt's prefix. */
export function normalizeWhatsapp(value:string):string {
 const digits=value.trim().replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0)).replace(/[\s()+.-]/g,'');
 if(!digits)return '';
 const phone=digits.startsWith('00')?digits.slice(2):digits;
 if(/^01[0125]\d{8}$/.test(phone))return '2'+phone;
 if(/^1[0125]\d{8}$/.test(phone))return '20'+phone;
 return phone;
}

export function phoneWithCountry(value:string,country:string):string {
 const digits=value.trim().replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0)).replace(/[\s()+.-]/g,'');
 if(!digits)return '';
 if(value.trim().startsWith('+')||digits.startsWith('00'))return normalizeWhatsapp(value);
 if(digits.startsWith(country))return digits;
 if(country==='20')return normalizeWhatsapp(digits);
 return country+digits.replace(/^0/,'');
}
