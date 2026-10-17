import { Aref_Ruqaa } from 'next/font/google';
export const receiptRuqaa = Aref_Ruqaa({weight:'700',subsets:['arabic','latin'],display:'swap',preload:false});
export const hasArabicBrand = (name:string) => /[\u0620-\u064a\u066e-\u06d3]/.test(name);
