# Firebase and Google Sheets setup

This repository is being migrated from browser-only persistence to Firebase. Existing UI/service behavior is retained while the server integration is introduced incrementally.

## Environment

Copy `.env.example` to `.env.local` and fill values from Firebase Console and Google Cloud. Never commit real credentials.

Client Firebase values use the `NEXT_PUBLIC_FIREBASE_*` variables. Admin SDK credentials and Google service-account credentials must remain server-only.

For private keys supplied with escaped newlines, normalize with `.replace(/\\n/g, "\n")`.

## Firebase setup

1. Create a Firebase project and enable Authentication with Email/Password.
2. Create Firestore in production mode.
3. Register a web app and copy its public configuration into the `NEXT_PUBLIC_FIREBASE_*` variables.
4. Create a service account for server-side Admin SDK access. Store its project ID, client email, and private key in the server environment.
5. Deploy Firestore rules from `firestore.rules`.
6. Set `CAPSTER_INITIAL_PASSWORD` in a secure environment before running the one-time seed script.

## Google Sheets setup

1. Create a spreadsheet named `Keuangan_dan_Pelanggan_Waktu_Indonesia_Bercukur`.
2. Create tabs: `Rekap_Harian`, `Transaksi_Harian`, `Pengeluaran_Harian`, and `Database_Pelanggan`.
3. Share the spreadsheet with the Google service account email as an editor.
4. Set `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_PRIVATE_KEY` on the server only.

## Deployment

Set all required variables in the hosting provider's encrypted environment settings. Configure a scheduled request to `/api/cron/daily-reset` with the `CRON_SECRET` authorization header. Do not expose service account keys to the browser.

## Migration status

The current client store still contains legacy localStorage business persistence. Do not treat Firebase as the source of truth until the queue, booking, and capster UI actions have been routed through the server API and verified end-to-end. This foundation intentionally avoids silently switching storage while legacy UI actions still call the old synchronous service.
