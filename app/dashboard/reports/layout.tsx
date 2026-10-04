import { requireBusinessModule } from '@/lib/business-access';
export default async function ModuleLayout({children}:{children:React.ReactNode}) {
 await requireBusinessModule('reports');
 return children;
}
