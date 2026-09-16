// services/pendingMutations/userProfileSync.js
// Small sync service for User Profile pending mutations only.
// Not a generic offline-sync engine: it just tries to flush the single
// coalesced pending mutation for a user's profile to Firestore, and keeps
// the existing profile cache (cacheStore) consistent when it succeeds.
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getCacheEntry, setCacheEntry } from '../cache/cacheStore';
import {
  getPendingMutation,
  clearPendingMutationIfMatches,
  applyPendingFields,
  pendingFieldsSatisfiedBy,
} from './pendingMutationStore';

export const USER_PROFILE_PENDING_DOMAIN = 'userProfile';
const PROFILE_CACHE_DOMAIN = 'profile';

// One in-flight sync per user - a second caller while a sync is already
// running just awaits the same run instead of issuing a parallel updateDoc().
const inFlightSyncs = new Map();

// Attempts to flush the pending profile mutation(s) for this user to
// Firestore. Loops so that a newer local change made *while* a write was in
// flight gets sent too, without ever running two updateDoc() calls at once.
// Does NOT clear the pending mutation on write success - that only happens
// once a server-confirmed onSnapshot proves Firestore reflects those values
// (see confirmPendingUserProfileMutationIfSatisfied), so a stale/earlier
// snapshot can never make the local pending state disappear.
export function syncPendingUserProfileMutation(userId) {
  if (!userId) return Promise.resolve({ synced: false, reason: 'no-user' });

  const existing = inFlightSyncs.get(userId);
  if (existing) {
    // TEMP diagnostics: a caller joined an already in-flight sync instead of starting a new one.
    console.log('🔄 [reconnect-diag] sync invoked T2 (joined in-flight):', { userId, timestamp: Date.now() });
    return existing;
  }

  // TEMP diagnostics for reconnect-delay investigation (T2 in the offline sync trace).
  console.log('🔄 [reconnect-diag] sync invoked T2:', { userId, timestamp: Date.now() });

  const run = runSync(userId).finally(() => {
    if (inFlightSyncs.get(userId) === run) {
      inFlightSyncs.delete(userId);
    }
  });
  inFlightSyncs.set(userId, run);
  return run;
}

async function runSync(userId) {
  for (;;) {
    const pending = await getPendingMutation(USER_PROFILE_PENDING_DOMAIN, userId);
    // TEMP diagnostics for reconnect-delay investigation (T3 in the offline sync trace).
    console.log('🔄 [reconnect-diag] pending read completed T3:', {
      userId,
      mutationId: pending?.mutationId,
      hasPending: Boolean(pending),
      timestamp: Date.now(),
    });
    if (!pending || Object.keys(pending.fields).length === 0) {
      return { synced: false, reason: 'no-pending' };
    }

    // TEMP diagnostics for reconnect-delay investigation (T4 in the offline sync trace).
    console.log('🔄 [reconnect-diag] updateDoc started T4:', { userId, mutationId: pending.mutationId, timestamp: Date.now() });
    try {
      await updateDoc(doc(db, 'users', userId), pending.fields);
      console.log('🔄 [reconnect-diag] updateDoc resolved T5:', { userId, mutationId: pending.mutationId, timestamp: Date.now() });
    } catch (error) {
      console.log('🔄 [reconnect-diag] updateDoc rejected T5:', { userId, mutationId: pending.mutationId, timestamp: Date.now(), code: error?.code });
      console.warn('⚠️ Failed to sync pending user profile mutation:', error);
      return { synced: false, error, mutationId: pending.mutationId };
    }

    // Best-effort: keep the existing profile cache in sync with the write we
    // just confirmed. The live onSnapshot listener will also do this, but
    // updating it here means the cache is correct even if the app is closed
    // before the next snapshot arrives.
    const cached = await getCacheEntry(PROFILE_CACHE_DOMAIN, userId);
    if (cached?.data) {
      const updatedProfile = applyPendingFields(cached.data, pending.fields);
      await setCacheEntry(PROFILE_CACHE_DOMAIN, userId, updatedProfile);
    }

    const current = await getPendingMutation(USER_PROFILE_PENDING_DOMAIN, userId);
    if (current && current.mutationId !== pending.mutationId) {
      // A newer local change landed while we were writing - send it too.
      continue;
    }

    return { synced: true, mutationId: pending.mutationId, fields: pending.fields, awaitingConfirmation: true };
  }
}

// Called from UserProfileContext's onSnapshot handler with the raw,
// server-confirmed Firestore document data. Clears the pending mutation only
// if it still matches the same generation that was sent AND the snapshot's
// values actually satisfy it - protecting against both a stale snapshot and
// a newer local change created after this generation was written.
export async function confirmPendingUserProfileMutationIfSatisfied(userId, snapshotProfileData) {
  if (!userId) return { cleared: false, current: null };

  const pending = await getPendingMutation(USER_PROFILE_PENDING_DOMAIN, userId);
  // TEMP diagnostics for reconnect-delay investigation (T7 in the offline sync trace).
  console.log('🔄 [reconnect-diag] pending re-read T7:', {
    userId,
    mutationId: pending?.mutationId,
    timestamp: Date.now(),
  });
  if (!pending || Object.keys(pending.fields).length === 0) {
    return { cleared: false, current: null };
  }

  if (!pendingFieldsSatisfiedBy(snapshotProfileData, pending.fields)) {
    return { cleared: false, current: pending };
  }

  const result = await clearPendingMutationIfMatches(USER_PROFILE_PENDING_DOMAIN, userId, pending.mutationId);
  if (result.cleared) {
    // TEMP diagnostics for reconnect-delay investigation (T8 in the offline sync trace).
    console.log('🔄 [reconnect-diag] pending cleared T8:', { userId, mutationId: pending.mutationId, timestamp: Date.now() });
  }
  return result;
}
