// Account-specific packaging UI; other businesses keep their existing sizes.
export const ALHAMD_ID = 'e7e19d22-ec5e-4573-8c4e-1f741626476b';
export function isAlhamd(restaurant: {id: string}) { return restaurant.id === ALHAMD_ID; }
export function packagingDraft(name: string) {
  const carton = /^(?:كرتونة|كرتونه|carton)(?:\s*\((\d+)\s*علبة\))?$/i.exec(name.trim());
  return carton ? {name:'كرتونة',boxes:carton[1] ?? ''} : /^(?:علبة|علبه|box)$/i.test(name.trim()) ? {name:'علبة',boxes:''} : {name:'',boxes:''};
}
export function packagingName(unit: string, boxes: string) {
  return unit === 'كرتونة' ? `كرتونة (${boxes} علبة)` : unit === 'علبة' ? 'علبة' : '';
}
export function validPackagingName(name: string) {
  return name === 'علبة' || /^كرتونة \([1-9]\d{0,3} علبة\)$/.test(name);
}
export function alhamdUnitLabel(name: string, restaurantId: string) {
  return restaurantId === ALHAMD_ID && /^(regular|عادي)$/i.test(name.trim()) ? '' : name;
}
