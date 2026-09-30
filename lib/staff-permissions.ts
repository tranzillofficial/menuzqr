export const STAFF_PERMISSIONS = ['orders.accept', 'orders.prepare', 'orders.complete', 'orders.cancel', 'orders.create', 'calls.resolve'] as const;
export type StaffPermission = typeof STAFF_PERMISSIONS[number];
export const PERMISSION_LABELS: Record<StaffPermission, { ar: string; en: string }> = {
  'orders.accept': { ar: 'قبول الطلبات الجديدة', en: 'Accept new orders' },
  'orders.prepare': { ar: 'تحضير الطلبات وتجهيزها وطلب الاستلام', en: 'Prepare orders and request pickup' },
  'orders.complete': { ar: 'تأكيد تسليم الطلبات', en: 'Complete delivered orders' },
  'orders.cancel': { ar: 'إلغاء الطلبات', en: 'Cancel orders' },
  'orders.create': { ar: 'تسجيل طلبات للترابيزات', en: 'Place table orders' },
  'calls.resolve': { ar: 'استقبال نداءات الخدمة والتعامل معاها', en: 'Handle service calls' },
};
export function staffPermissions(role: string, custom?: string[] | null): StaffPermission[] {
  if (role === 'owner' || role === 'manager') return [...STAFF_PERMISSIONS];
  if (custom !== null && custom !== undefined) return STAFF_PERMISSIONS.filter(p => custom.includes(p));
  return role === 'chef' ? ['orders.accept', 'orders.prepare'] : ['orders.create', 'orders.complete', 'calls.resolve'];
}
export function statusPermission(status: string): StaffPermission | null {
  if (status === 'accepted') return 'orders.accept';
  if (status === 'preparing' || status === 'ready') return 'orders.prepare';
  if (status === 'completed') return 'orders.complete';
  if (status === 'cancelled') return 'orders.cancel';
  return null;
}
