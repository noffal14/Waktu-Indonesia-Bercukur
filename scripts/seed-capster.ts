import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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
  process.stdout.write(`Capster Hasan siap. UID: ${user.uid}\nSimpan kredensial awal secara aman lalu hapus CAPSTER_INITIAL_PASSWORD dari environment setelah seed.\n`);
}

main().catch((error) => {
  process.stderr.write(String(error) + '\n');
  process.exitCode = 1;
});
