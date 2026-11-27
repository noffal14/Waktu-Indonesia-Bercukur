import { google } from 'googleapis';
import { verifyCapsterRequest, capsterErrorResponse } from '@/lib/server/capster-auth';
import { getSpreadsheetUrl } from '@/lib/google-sheets';
import { SHEET_TABS } from '@/lib/sheets-config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await verifyCapsterRequest(request);
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!email || !privateKey || !spreadsheetId) {
      return Response.json({ ok: false, message: 'Integrasi Google Sheets belum dikonfigurasi.' }, { status: 503 });
    }

    const auth = new google.auth.JWT({
      email, key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const [summary, transactions, customers] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId, range: `'${SHEET_TABS.dailySummary}'!A1:Z30`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId, range: `'${SHEET_TABS.transactions}'!A1:Z101`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId, range: `'${SHEET_TABS.customers}'!A1:Z101`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      }),
    ]);

    return Response.json({
      ok: true,
      summary: summary.data.values ?? [],
      transactions: transactions.data.values ?? [],
      customers: customers.data.values ?? [],
      spreadsheetUrl: getSpreadsheetUrl(),
      fetchedAt: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return capsterErrorResponse(error);
  }
}
