import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getInitialSystemPromos } from '../lib/services-catalog';
import { getInitialCapsterProfile } from '../lib/capster-profile';
import { OPERATIONAL_HOURS, WALKIN_DAILY_QUOTA, DEFAULT_DURATION_MINUTES, LATE_TOLERANCE_MINUTES, RESCHEDULE_MIN_LEAD_MINUTES } from '../lib/barbershop-config';

async function main() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const password = process.env.CAPSTER_INITIAL_PASSWORD;

  if (!projectId || !clientEmail || !privateKey || !password || password.length < 12) {
    throw new Error('Isi FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, dan CAPSTER_INITIAL_PASSWORD (minimal 12 karakter).');
  }

  const app = getApps()[0] || initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
  const auth = getAuth(app);
  const email = 'hasan@waktu-indonesia.app';

  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, displayName: 'Hasan' });
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({ email, password, displayName: 'Hasan', emailVerified: true });
  }

  await auth.setCustomUserClaims(user.uid, { role: 'capster', capsterId: 'hasan' });

  const db = getFirestore(app);
  await db.runTransaction(async (tx) => {
    const profileRef = db.collection('capsterProfile').doc('hasan');
    const operationalRef = db.collection('config').doc('operational');
    const [profileSnap, operationalSnap] = await Promise.all([
      tx.get(profileRef),
      tx.get(operationalRef),
    ]);

    if (!profileSnap.exists) {
      tx.create(profileRef, getInitialCapsterProfile());
    }
    if (!operationalSnap.exists) {
      tx.create(operationalRef, {
        timezone: 'Asia/Jakarta',
        hours: OPERATIONAL_HOURS,
        walkinDailyQuota: WALKIN_DAILY_QUOTA,
        defaultDurationMinutes: DEFAULT_DURATION_MINUTES,
        lateToleranceMinutes: LATE_TOLERANCE_MINUTES,
        rescheduleMinLeadMinutes: RESCHEDULE_MIN_LEAD_MINUTES,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  const promoCollection = db.collection('promos');
  for (const promo of getInitialSystemPromos()) {
    const promoRef = promoCollection.doc(promo.id);
    const promoSnap = await promoRef.get();
    if (!promoSnap.exists) {
      await promoRef.create(promo);
    }
  }

  process.stdout.write(`Capster Hasan siap. UID: ${user.uid}\nDokumen operasional, profil awal, dan promo default telah diperiksa.\nSimpan kredensial awal secara aman lalu hapus CAPSTER_INITIAL_PASSWORD dari environment setelah seed.\n`);
}

main().catch((error) => {
  process.stderr.write(String(error) + '\n');
  process.exitCode = 1;
});
