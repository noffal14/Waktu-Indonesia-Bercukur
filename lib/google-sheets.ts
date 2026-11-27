import 'server-only';

import { google } from 'googleapis';
import { SHEET_COLUMNS, SHEET_TABS, columnLetter, createSheetRow, normalizeHeader, resolveHeaderMap } from '@/lib/sheets-config';

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!process.env.GOOGLE_SHEET_ID || !email || !privateKey) {
    throw new Error('Google Sheets belum dikonfigurasi pada environment server.');
  }
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID belum diatur.');
  return id;
}

export async function readSheetRange(range: string) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return response.data.values ?? [];
}

export async function appendTransactionOnce(values: Record<string, string | number | null | undefined>) {
  const sheets = getSheetsClient();
  const range = `'${SHEET_TABS.transactions}'!A:Z`;
  const existing = await readSheetRange(range);
  const headers = existing[0] ?? [];
  const map = resolveHeaderMap(headers, SHEET_COLUMNS.transactions);
  const bookingCode = String(values['Kode Booking'] ?? '').trim();
  if (!bookingCode) throw new Error('Kode Booking wajib tersedia untuk sinkronisasi transaksi.');

  const existingIndex = existing.findIndex((row, index) =>
    index > 0 && String(row[map['Kode Booking']] ?? '').trim() === bookingCode
  );
  if (existingIndex > 0) {
    return { synced: true, duplicate: true, rowNumber: existingIndex + 1 };
  }

  const row = createSheetRow(headers, values);
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  const updatedRange = response.data.updates?.updatedRange ?? '';
  const rowNumber = Number(updatedRange.match(/![A-Z]+(\d+)/)?.[1] ?? 0);
  return { synced: true, duplicate: false, rowNumber, updatedRange };
}

export async function updateTransactionByCode(bookingCode: string, values: Record<string, string | number | null | undefined>) {
  const sheets = getSheetsClient();
  const range = `'${SHEET_TABS.transactions}'!A:Z`;
  const existing = await readSheetRange(range);
  const headers = existing[0] ?? [];
  const map = resolveHeaderMap(headers, SHEET_COLUMNS.transactions);
  const index = existing.findIndex((row, rowIndex) =>
    rowIndex > 0 && String(row[map['Kode Booking']] ?? '').trim() === bookingCode
  );
  if (index < 1) throw new Error(`Transaksi dengan kode ${bookingCode} tidak ditemukan.`);

  const rowNumber = index + 1;
  const nextRow = [...existing[index]];
  for (const [column, value] of Object.entries(values)) {
    const columnIndex = map[column];
    if (columnIndex === undefined) throw new Error(`Kolom ${column} tidak tersedia pada sheet.`);
    nextRow[columnIndex] = value == null ? '' : value;
  }
  const lastColumn = columnLetter(Math.max(headers.length - 1, 0));
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `'${SHEET_TABS.transactions}'!A${rowNumber}:${lastColumn}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [nextRow] },
  });
  return { synced: true, rowNumber };
}

export async function upsertCustomerByWhatsApp(values: Record<string, string | number | null | undefined>) {
  const sheets = getSheetsClient();
  const range = `'${SHEET_TABS.customers}'!A:Z`;
  const existing = await readSheetRange(range);
  const headers = existing[0] ?? [];
  const map = resolveHeaderMap(headers, SHEET_COLUMNS.customers);
  const phone = String(values['Nomor WhatsApp'] ?? '').trim();
  if (!phone) throw new Error('Nomor WhatsApp wajib tersedia untuk data pelanggan.');

  const index = existing.findIndex((row, rowIndex) =>
    rowIndex > 0 && String(row[map['Nomor WhatsApp']] ?? '').trim() === phone
  );
  if (index < 1) {
    const row = createSheetRow(headers, values);
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(), range,
      valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
    const updatedRange = response.data.updates?.updatedRange ?? '';
    const rowNumber = Number(updatedRange.match(/![A-Z]+(\\d+)/)?.[1] ?? 0);
    return { synced: true, created: true, rowNumber: rowNumber || undefined, updatedRange };
  }

  const rowNumber = index + 1;
  const nextRow = [...existing[index]];
  for (const [column, value] of Object.entries(values)) {
    const columnIndex = map[normalizeHeader(column)] ?? map[column];
    if (columnIndex === undefined) throw new Error(`Kolom ${column} tidak tersedia pada sheet.`);
    nextRow[columnIndex] = value == null ? '' : value;
  }
  const lastColumn = columnLetter(Math.max(headers.length - 1, 0));
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `'${SHEET_TABS.customers}'!A${rowNumber}:${lastColumn}${rowNumber}`,
    valueInputOption: 'USER_ENTERED', requestBody: { values: [nextRow] },
  });
  return { synced: true, created: false, rowNumber };
}

export function getSpreadsheetUrl() {
  return `https://docs.google.com/spreadsheets/d/${getSpreadsheetId()}/edit`;
}
