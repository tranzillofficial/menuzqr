export type CoverDisplay = {cover_fit?: 'contain'|'cover'|null;cover_position_x?:number|null;cover_position_y?:number|null};
export function coverPosition(value:unknown):number {
 const number=Number(value);return Number.isFinite(number)?Math.min(100,Math.max(0,number)):50;
}
export function coverDisplay(value:CoverDisplay){return {fit:value.cover_fit==='cover'?'cover' as const:'contain' as const,x:coverPosition(value.cover_position_x??50),y:coverPosition(value.cover_position_y??50)};}
