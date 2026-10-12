import {requireBusinessModule} from '@/lib/business-access';
import OrderInvoice from '../../orders/[id]/page';
export default async function InvoicePage(props:Parameters<typeof OrderInvoice>[0]){await requireBusinessModule('invoices');return OrderInvoice(props);}
