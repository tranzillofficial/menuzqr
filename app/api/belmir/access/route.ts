import {NextResponse} from 'next/server';
import {belmirAccess} from '@/lib/belmir/server';
export const dynamic='force-dynamic';
export async function GET(){const access=await belmirAccess();return NextResponse.json({allowed:access.ok},{status:access.status,headers:{'Cache-Control':'no-store'}});}
