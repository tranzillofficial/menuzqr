import {getMembership} from '@/lib/membership';
import {signQzRequest, validateQzRequest} from '@/lib/qz-signing';
export const runtime = 'nodejs';
const headers = {'Content-Type':'text/plain', 'Cache-Control':'no-store'};
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return new Response('Forbidden', {status:403, headers});
  const member = await getMembership();
  if (!member || !(member.isManager || member.permissions.includes('orders.create'))) return new Response('Sign in with cashier access', {status:403, headers});
  if (Number(request.headers.get('content-length')) > 3_000_000) return new Response('Request too large', {status:413, headers});
  const raw = await request.text();
  if (!validateQzRequest(raw)) return new Response('Unsupported print request', {status:400, headers});
  const key = process.env.MENUZQR_QZ_SIGNING_KEY_V1;
  if (!key) return new Response('Print signing is unavailable', {status:503, headers});
  try { return new Response(signQzRequest(raw, key), {headers}); }
  catch { return new Response('Print signing failed', {status:503, headers}); }
}
