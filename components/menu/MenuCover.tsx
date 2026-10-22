"use client";
import Image from 'next/image';
import {useState} from 'react';
import {coverDisplay,type CoverDisplay} from '@/lib/menu-cover';
import {cn} from '@/lib/utils';

/** Fit the entire original over a soft extension, or crop at the owner's focal point. */
export function MenuCover({restaurant,className,priority=true}:{restaurant:CoverDisplay&{cover_url:string|null};className?:string;priority?:boolean}){
 const [failed,setFailed]=useState<string|null>(null);const {fit,x,y}=coverDisplay(restaurant);
 if(!restaurant.cover_url||failed===restaurant.cover_url)return null;
 return <div data-menu-cover className={cn('relative isolate overflow-hidden bg-neutral-200',className)}>
 {fit==='contain'&&<Image src={restaurant.cover_url} alt="" fill sizes="100vw" aria-hidden className="scale-110 object-cover blur-xl brightness-75"/>}
 <Image src={restaurant.cover_url} alt="" fill sizes="100vw" priority={priority} onError={()=>setFailed(restaurant.cover_url)} style={{objectFit:fit,objectPosition:`${x}% ${y}%`}}/>
 </div>;
}
