import 'server-only';
import {businessPolicy} from './business-policy';
import { redirect } from 'next/navigation';
import { requireManager } from './membership';
import { type BusinessModule } from './business-modules';
export async function requireBusinessModule(module: BusinessModule) {
 const member = await requireManager(`/dashboard/${module}`);
 if (!businessPolicy(member.restaurant,module,{role:member.role}).allowed) redirect('/dashboard');
 return member;
}
