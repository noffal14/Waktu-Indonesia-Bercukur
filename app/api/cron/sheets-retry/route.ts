import { drainSheetSyncQueue } from '@/lib/sheets-outbox';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await drainSheetSyncQueue(50);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('[sheets-retry-cron]', error);
    return Response.json({ ok: false, message: 'Gagal menjalankan retry Google Sheets.' }, { status: 500 });
  }
}
