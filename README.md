# Waktu Indonesia Bercukur

## Backend setup

Copy `.env.example` to `.env.local`. Never commit real credentials or service-account JSON.

### Firebase

1. Create a Firebase project. Enable Email/Password Authentication and Firestore.
2. Register a Web App. Copy its settings into `NEXT_PUBLIC_FIREBASE_*`.
3. Create a Firebase service account and set `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` on the server.
4. Deploy the Firestore rules and index:

   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes
   ```

5. Set a strong one-time `CAPSTER_INITIAL_PASSWORD` (at least 12 characters) in `.env.local`, then run:

   ```bash
   npm run seed:capster
   ```

   The script creates or updates `hasan@waktu-indonesia.app` and attaches the `role=capster` custom claim. Do not reuse a sample or weak password.

### Google Sheets

Create a spreadsheet named `Keuangan_dan_Pelanggan_Waktu_Indonesia_Bercukur` with these tabs:

- `Rekap_Harian`
- `Transaksi_Harian`
- `Pengeluaran_Harian`
- `Database_Pelanggan`

Share it with the service-account email as an editor. Set `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_PRIVATE_KEY` in server-only environment variables. The API never sends service-account credentials to the browser.

### Vercel

Add all environment variables in the Vercel project settings. The `vercel.json` schedules the daily reset endpoint around the WIB opening times (03:00 and 05:00 UTC). Set a high-entropy `CRON_SECRET`; Vercel sends it as a Bearer authorization header for cron invocations.

## Current implementation status

Implemented on the feature branch:

- Firebase client initialization and lazy server-side Firebase Admin initialization.
- One-time Hasan account seed with a Firebase custom role claim.
- Capster login through Firebase Authentication.
- Server-verified capster identity and a single active session with a 90-second stale-session window.
- Client heartbeat every 30 seconds, session restoration across refresh in `sessionStorage`, and logout invalidation.
- WIB server-time endpoint and authenticated daily queue reset endpoint.
- Initial Firestore rules and composite index.
- Server-side Google Sheets read access, schema/header validation helpers, idempotent transaction append helper, transaction update helper, and customer upsert helper.
- Capster-only spreadsheet page with daily summary, date-filtered transactions, and customer search.
- Baseline HTTP security headers.

Not yet completed:

- The existing `barberService` still stores queue, bookings, customers, schedule, promos, and profile data in browser `localStorage`. These business records have not yet been migrated to Firestore.
- Queue quota allocation, booking slot locking, queue cancellation, schedule/promo/profile writes, and capster completion actions are not yet routed through server-verified Firestore transactions.
- Realtime Firestore `onSnapshot` subscriptions and the connected/reconnecting/offline status indicator are not yet wired into the main customer and capster store.
- Customer registration/login has not yet been migrated to Firebase Authentication with synthetic WhatsApp-based email addresses.
- Google Sheets write helpers are not yet invoked by booking creation, walk-in completion, or service completion. Retry/idempotency metadata is not yet persisted to Firestore, and `Pengeluaran_Harian` write flow is not implemented.
- Late-booking auto-cancellation and end-to-end build/runtime verification remain outstanding.

Keep the current browser-store behavior intact until those migrations are implemented and tested. Do not treat this branch as a complete production migration yet.
