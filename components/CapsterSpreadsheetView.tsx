'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';

type SheetCell = string | number;
type SheetRows = SheetCell[][];

function DataTable({ rows }: { rows: SheetRows }) {
  if (!rows.length) return <p className="p-4 text-sm text-zinc-500">Belum ada data.</p>;
  const [headers, ...body] = rows;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-zinc-900 text-amber-300">
          <tr>{headers.map((value, index) => <th key={index} className="whitespace-nowrap px-3 py-3 font-semibold">{String(value || `Kolom ${index + 1}`)}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {body.map((row, rowIndex) => (
            <tr key={rowIndex} className="text-stone-200 hover:bg-zinc-900/60">
              {headers.map((_, columnIndex) => (
                <td key={columnIndex} className="whitespace-nowrap px-3 py-2.5">{String(row[columnIndex] ?? '-')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CapsterSpreadsheetView() {
  const [summary, setSummary] = useState<SheetRows>([]);
  const [transactions, setTransactions] = useState<SheetRows>([]);
  const [customers, setCustomers] = useState<SheetRows>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = firebaseAuth?.currentUser;
      const sessionId = window.sessionStorage.getItem('wib_capster_session_id');
      if (!user || !sessionId) {
        throw new Error('Sesi capster tidak ditemukan. Silakan masuk kembali.');
      }
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (customerSearch.trim()) params.set('search', customerSearch.trim());

      const response = await fetch(`/api/capster/sheet?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, 'x-capster-session-id': sessionId },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Gagal memuat data spreadsheet.');
      }
      setSummary(payload.summary ?? []);
      setTransactions(payload.transactions ?? []);
      setCustomers(payload.customers ?? []);
      setSpreadsheetUrl(payload.spreadsheetUrl ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat data spreadsheet.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, customerSearch]);

  useEffect(() => { void loadData(); }, [loadData]);

  return (
    <main className="min-h-screen bg-[#0B0B0D] px-4 py-6 text-stone-100 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/capster/dashboard" className="mb-3 inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-amber-300">
              <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Keuangan & Pelanggan</h1>
            <p className="mt-1 text-sm text-zinc-400">Data baca-saja dari Google Sheets. Hanya dapat diakses oleh capster.</p>
          </div>
          <div className="flex items-center gap-3">
            {spreadsheetUrl && <a href={spreadsheetUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-amber-300 hover:text-amber-200">Buka Google Sheets</a>}
            <button onClick={() => void loadData()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-700 px-3 text-xs font-semibold hover:bg-zinc-900 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Segarkan
            </button>
          </div>
        </div>

        {error && <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-200">{error}</div>}

        <section className="space-y-3 rounded-2xl border border-zinc-800 bg-[#131317] p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">Ringkasan Harian</h2>
            <p className="text-xs text-zinc-500">Mengambil nilai dari tab Rekap_Harian.</p>
          </div>
          <DataTable rows={summary} />
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-[#131317] p-4 sm:p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div><label className="mb-1 block text-xs text-zinc-400">Dari tanggal</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="min-h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm" /></div>
            <div><label className="mb-1 block text-xs text-zinc-400">Sampai tanggal</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="min-h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm" /></div>
            <div className="min-w-56 flex-1"><label className="mb-1 block text-xs text-zinc-400">Cari pelanggan</label><div className="flex min-h-10 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3"><Search className="h-4 w-4 text-zinc-500" /><input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Nama atau WhatsApp" className="w-full bg-transparent text-sm outline-none" /></div></div>
          </div>
          <div><h2 className="mb-1 font-semibold">Transaksi Harian</h2><p className="mb-3 text-xs text-zinc-500">Maksimal 100 baris terbaru.</p><DataTable rows={transactions} /></div>
        </section>

        <section className="space-y-3 rounded-2xl border border-zinc-800 bg-[#131317] p-4 sm:p-5">
          <div><h2 className="font-semibold">Database Pelanggan</h2><p className="text-xs text-zinc-500">Maksimal 100 baris hasil pencarian.</p></div>
          <DataTable rows={customers} />
        </section>
        {loading && <p className="text-center text-xs text-zinc-500">Memuat data dari Google Sheets...</p>}
      </div>
    </main>
  );
}
