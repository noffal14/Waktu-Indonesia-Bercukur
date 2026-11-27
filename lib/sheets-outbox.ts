import 'server-only';

import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  appendTransactionOnce,
  updateTransactionByCode,
  upsertCustomerByWhatsApp,
} from '@/lib/google-sheets';

export type SheetSyncOperation = 'appendTransaction' | 'updateTransaction' | 'upsertCustomer';
export type SheetSyncValues = Record<string, string | number | null | undefined>;

export async function enqueueSheetSync(
  id: string,
  operation: SheetSyncOperation,
  values: SheetSyncValues,
  options: { bookingCode?: string; sourcePath?: string; sourceId?: string } = {}
) {
  await getAdminDb().collection('sheetSyncQueue').doc(id).set({
    id,
    operation,
    values,
    bookingCode: options.bookingCode || null,
    sourcePath: options.sourcePath || null,
    sourceId: options.sourceId || null,
    status: 'pending',
    attempts: 0,
    runAfter: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function drainSheetSyncQueue(maxItems = 50) {
  const db = getAdminDb();
  const staleProcessing = await db.collection('sheetSyncQueue')
    .where('status', '==', 'processing')
    .where('processingStartedAt', '<=', Timestamp.fromMillis(Date.now() - 10 * 60_000))
    .limit(100).get();
  if (!staleProcessing.empty) {
    const recover = db.batch();
    staleProcessing.docs.forEach((doc) => recover.update(doc.ref, {
      status: 'failed',
      runAfter: Date.now(),
      lastError: 'Retry worker lease expired before completion.',
      updatedAt: FieldValue.serverTimestamp(),
    }));
    await recover.commit();
  }

  const snapshot = await db.collection('sheetSyncQueue')
    .where('status', 'in', ['pending', 'failed'])
    .where('runAfter', '<=', Date.now())
    .orderBy('runAfter', 'asc')
    .limit(Math.max(1, Math.min(100, maxItems)))
    .get();

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of snapshot.docs) {
    const job = item.data();
    const values = (job.values || {}) as SheetSyncValues;
    const phone = job.operation === 'upsertCustomer'
      ? String(values['Nomor WhatsApp'] || '').trim()
      : '';
    const bookingCode = job.operation === 'appendTransaction' || job.operation === 'updateTransaction'
      ? String(job.bookingCode || values['Kode Booking'] || '').trim()
      : '';
    const lockKey = phone
      ? 'customer-' + phone
      : bookingCode
        ? 'transaction-' + bookingCode
        : '';
    const syncLockRef = lockKey
      ? db.collection('sheetSyncLocks').doc(lockKey)
      : null;

    const workerToken = randomUUID();
    const claimed = await db.runTransaction(async (tx) => {
      const current = await tx.get(item.ref);
      if (!current.exists) return false;
      const data = current.data()!;
      if (!['pending', 'failed'].includes(String(data.status))) return false;
      if (Number(data.runAfter || 0) > Date.now()) return false;

      const syncLock = syncLockRef ? await tx.get(syncLockRef) : null;
      const lockData = syncLock?.data();
      const lockActive = Number(lockData?.leaseUntil || 0) > Date.now();
      if (syncLock?.exists && lockActive && lockData?.ownerToken !== workerToken) return false;

      tx.update(item.ref, {
        status: 'processing',
        processingStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (syncLockRef) {
        tx.set(syncLockRef, {
          ownerJobId: item.id,
          ownerToken: workerToken,
          leaseUntil: Date.now() + 10 * 60_000,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return true;
    });

    if (!claimed) {
      skipped += 1;
      continue;
    }

    const releaseSyncLock = async () => {
      if (!syncLockRef) return;
      await db.runTransaction(async (tx) => {
        const lock = await tx.get(syncLockRef);
        if (lock.exists && lock.data()?.ownerToken === workerToken) {
          tx.delete(syncLockRef);
        }
      });
    };

    try {
      if (job.operation === 'appendTransaction') {
        await appendTransactionOnce(values);
      } else if (job.operation === 'updateTransaction') {
        if (!job.bookingCode) throw new Error('Kode Booking untuk retry tidak tersedia.');
        try {
          await updateTransactionByCode(String(job.bookingCode), values);
        } catch (error) {
          // Bila append awal gagal, buat satu baris final. Append helper tetap idempotent.
          if (String(error).includes('tidak ditemukan')) await appendTransactionOnce(values);
          else throw error;
        }
      } else if (job.operation === 'upsertCustomer') {
        await upsertCustomerByWhatsApp(values);
      } else {
        throw new Error('Jenis sinkronisasi spreadsheet tidak dikenal.');
      }

      await item.ref.update({
        status: 'synced',
        syncedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastError: FieldValue.delete(),
      });
      if (job.sourcePath && job.sourceId) {
        await db.collection(String(job.sourcePath)).doc(String(job.sourceId)).set({
          sheetSyncStatus: 'synced',
          sheetSyncUpdatedAt: Date.now(),
          sheetSyncError: FieldValue.delete(),
        }, { merge: true });
      }
      await releaseSyncLock();
      synced += 1;
    } catch (error) {
      const attempts = Number(job.attempts || 0) + 1;
      const backoffMs = Math.min(6 * 60 * 60_000, 60_000 * Math.pow(2, Math.min(attempts - 1, 8)));
      await item.ref.update({
        status: 'failed',
        attempts,
        runAfter: Date.now() + backoffMs,
        lastError: String(error).slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (job.sourcePath && job.sourceId) {
        await db.collection(String(job.sourcePath)).doc(String(job.sourceId)).set({
          sheetSyncStatus: 'failed',
          sheetSyncAttempts: attempts,
          sheetSyncError: String(error).slice(0, 500),
          sheetSyncUpdatedAt: Date.now(),
        }, { merge: true });
      }
      await releaseSyncLock();
      failed += 1;
    }
  }

  return { scanned: snapshot.size, synced, failed, skipped };
}
