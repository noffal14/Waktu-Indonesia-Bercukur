import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Waktu Indonesia Bercukur — Sistem Antrean & Booking Barbershop',
  description:
    'Ambil nomor antrean walk-in, pantau estimasi waktu tunggu secara langsung, cek jadwal capster, dan booking slot cukur tanpa antre menumpuk.',
  openGraph: {
    title: 'Waktu Indonesia Bercukur — Sistem Antrean & Booking Barbershop',
    description:
      'Sistem antrean walk-in dan booking capster barbershop yang adil, transparan, dan mudah digunakan di ponsel.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Waktu Indonesia Bercukur — Sistem Antrean & Booking Barbershop',
    description:
      'Sistem antrean walk-in dan booking capster barbershop yang adil dan transparan.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#0B0B0D] text-[#F5F5F4] font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200"
      >
        {children}
      </body>
    </html>
  );
}
