import 'server-only';
import { redirect } from 'next/navigation';
import { requireManager } from './membership';
import { moduleEnabled, type BusinessModule } from './business-modules';
export async function requireBusinessModule(module: BusinessModule) {
 const member = await requireManager(`/dashboard/${module}`);
 if (!moduleEnabled(member.restaurant,module)) redirect('/dashboard');
 return member;
}
