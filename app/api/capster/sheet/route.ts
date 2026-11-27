import { google } from 'googleapis';
import { verifyCapsterRequest, capsterErrorResponse } from '@/lib/server/capster-auth';
import { getSpreadsheetUrl } from '@/lib/google-sheets';
import { SHEET_TABS, normalizeHeader } from '@/lib/sheets-config';

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

    const transactionRows = transactions.data.values ?? [];
    const customerRows = customers.data.values ?? [];
    const params = new URL(request.url).searchParams;
    const dateFrom = params.get('from') || '';
    const dateTo = params.get('to') || '';
    const search = (params.get('search') || '').trim().toLocaleLowerCase('id-ID');

    const transactionHeaders = transactionRows[0] ?? [];
    const dateColumn = transactionHeaders.findIndex((header) => normalizeHeader(header) === normalizeHeader('Tanggal'));
    const filteredTransactions = transactionRows.length
      ? [transactionHeaders, ...transactionRows.slice(1).filter((row) => {
          const date = dateColumn >= 0 ? String(row[dateColumn] ?? '').slice(0, 10) : '';
          return (!dateFrom || !date || date >= dateFrom) && (!dateTo || !date || date <= dateTo);
        })].slice(0, 101)
      : [];

    const customerHeaders = customerRows[0] ?? [];
    const nameColumn = customerHeaders.findIndex((header) => normalizeHeader(header) === normalizeHeader('Nama'));
    const phoneColumn = customerHeaders.findIndex((header) => normalizeHeader(header) === normalizeHeader('Nomor WhatsApp'));
    const filteredCustomers = customerRows.length
      ? [customerHeaders, ...customerRows.slice(1).filter((row) => !search || [
          nameColumn >= 0 ? row[nameColumn] : '',
          phoneColumn >= 0 ? row[phoneColumn] : '',
        ].some((value) => String(value ?? '').toLocaleLowerCase('id-ID').includes(search)))].slice(0, 101)
      : [];

    return Response.json({
      ok: true,
      summary: summary.data.values ?? [],
      transactions: filteredTransactions,
      customers: filteredCustomers,
      spreadsheetUrl: getSpreadsheetUrl(),
      fetchedAt: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return capsterErrorResponse(error);
  }
}
