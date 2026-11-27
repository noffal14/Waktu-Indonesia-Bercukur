export const dynamic = 'force-dynamic';

export async function GET() {
  const now = Date.now();
  const wib = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).format(now);

  return Response.json({ serverTime: now, timezone: 'Asia/Jakarta', wib });
}
