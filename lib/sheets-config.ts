export const SPREADSHEET_NAME = 'Keuangan_dan_Pelanggan_Waktu_Indonesia_Bercukur';

export const SHEET_TABS = {
  dailySummary: 'Rekap_Harian',
  transactions: 'Transaksi_Harian',
  expenses: 'Pengeluaran_Harian',
  customers: 'Database_Pelanggan',
} as const;

export const SHEET_COLUMNS = {
  transactions: [
    'Tanggal', 'Jam', 'Kode Booking', 'Nama Pelanggan', 'Nomor WhatsApp',
    'Capster', 'Layanan (daftar)', 'Kategori', 'Harga Normal',
    'Potongan Promo', 'Total Harga', 'Status', 'Sumber',
  ],
  customers: [
    'Nama', 'Nomor WhatsApp', 'Email', 'Tanggal Daftar',
    'Kunjungan Terakhir', 'Total Kunjungan',
  ],
} as const;

export type SheetColumnMap = Record<string, number>;

export function normalizeHeader(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ');
}

export function resolveHeaderMap(headers: unknown[], required: readonly string[]): SheetColumnMap {
  const normalized = new Map<string, number>();
  headers.forEach((header, index) => normalized.set(normalizeHeader(header), index));

  const missing = required.filter((column) => !normalized.has(normalizeHeader(column)));
  if (missing.length) {
    throw new Error(`Header Google Sheets tidak cocok. Kolom wajib tidak ditemukan: ${missing.join(', ')}`);
  }

  return Object.fromEntries(required.map((column) => [column, normalized.get(normalizeHeader(column))!]));
}

export function createSheetRow(headers: unknown[], values: Record<string, string | number | null | undefined>) {
  const requiredColumns = Object.keys(values);
  const map = resolveHeaderMap(headers, requiredColumns);
  const row: Array<string | number> = Array(Math.max(headers.length, 1)).fill('');
  for (const [column, value] of Object.entries(values)) {
    row[map[column]] = value == null ? '' : value;
  }
  return row;
}

export function columnLetter(index: number) {
  let value = index + 1;
  let output = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}
