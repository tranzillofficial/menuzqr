import { moduleEnabled, type BusinessConfig } from './business-modules';
import type { Restaurant } from './types';
export function hasPosAccess(restaurant: Pick<Restaurant,'status'|'pos_status'|'pos_expires_at'> & BusinessConfig, enabled: boolean, now = Date.now()) {
  return moduleEnabled(restaurant,"pos") && enabled && restaurant.status === 'active' && restaurant.pos_status === 'active' && Boolean(restaurant.pos_expires_at && new Date(restaurant.pos_expires_at).getTime() > now);
}
