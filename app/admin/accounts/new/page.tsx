import { requireAdmin } from '@/lib/auth';
import { BusinessAccountForm } from '@/components/admin/BusinessAccountForm';
export default async function NewAccount(){await requireAdmin();return <div className="mx-auto max-w-3xl"><BusinessAccountForm/></div>;}
