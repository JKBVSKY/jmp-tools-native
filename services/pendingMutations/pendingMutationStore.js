// services/pendingMutations/pendingMutationStore.js
// Small, generic "pending mutation" store on top of AsyncStorage.
// Holds, per (domain, userId), the *current* coalesced set of locally
// changed fields that have not yet been confirmed by the backend.
// This is intentionally NOT an event log: a new patch for the same field
// simply replaces the previous pending value (last local write wins).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'pendingMutation:v1:';

const buildKey = (domain, userId) => `${KEY_PREFIX}${domain}:${userId}`;

// Serializes read-modify-write operations per (domain, userId) so concurrent
// mergePendingMutation()/clearPendingMutationIfMatches() calls can never
// interleave their AsyncStorage read and write.
const operationChains = new Map();

function enqueue(domain, userId, operation) {
  const key = buildKey(domain, userId);
  const previous = operationChains.get(key) || Promise.resolve();
  const next = previous.then(operation, operation);
  operationChains.set(key, next);
  return next;
}

let mutationCounter = 0;
function generateMutationId() {
  mutationCounter += 1;
  return `${Date.now()}-${mutationCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getPendingMutation(domain, userId) {
  if (!domain || !userId) return null;
  try {
    const raw = await AsyncStorage.getItem(buildKey(domain, userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.domain !== domain || parsed.userId !== userId || !parsed.fields) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn(`pendingMutationStore: failed to read "${domain}" mutation for ${userId}:`, error);
    return null;
  }
}

// Merges a patch of dot-path fields (e.g. { 'preferences.sections': [...] })
// into the existing pending mutation, coalescing repeated changes to the
// same field into a single latest value. Serialized per (domain, userId) so
// rapid, overlapping calls can never lose one another's changes, and each
// resulting generation gets a fresh mutationId.
export async function mergePendingMutation(domain, userId, fieldsPatch) {
  if (!domain || !userId || !fieldsPatch || Object.keys(fieldsPatch).length === 0) return null;

  return enqueue(domain, userId, async () => {
    const existing = await getPendingMutation(domain, userId);
    const merged = {
      domain,
      userId,
      mutationId: generateMutationId(),
      fields: { ...(existing?.fields || {}), ...fieldsPatch },
      updatedAt: Date.now(),
    };

    try {
      await AsyncStorage.setItem(buildKey(domain, userId), JSON.stringify(merged));
    } catch (error) {
      console.warn(`pendingMutationStore: failed to write "${domain}" mutation for ${userId}:`, error);
    }
    return merged;
  });
}

export async function clearPendingMutation(domain, userId) {
  if (!domain || !userId) return;
  try {
    await AsyncStorage.removeItem(buildKey(domain, userId));
  } catch (error) {
    console.warn(`pendingMutationStore: failed to clear "${domain}" mutation for ${userId}:`, error);
  }
}

// Removes the pending mutation only if it is still the exact generation
// identified by mutationId - so a sync that finishes late can never delete a
// newer local change made while it was in flight. Serialized through the same
// per (domain, userId) queue as mergePendingMutation.
export async function clearPendingMutationIfMatches(domain, userId, mutationId) {
  if (!domain || !userId) return { cleared: false, current: null };

  return enqueue(domain, userId, async () => {
    const current = await getPendingMutation(domain, userId);
    if (!current || current.mutationId !== mutationId) {
      return { cleared: false, current };
    }
    try {
      await AsyncStorage.removeItem(buildKey(domain, userId));
    } catch (error) {
      console.warn(`pendingMutationStore: failed to clear "${domain}" mutation for ${userId}:`, error);
      return { cleared: false, current };
    }
    return { cleared: true, current: null };
  });
}

// Applies dot-path fields (e.g. 'preferences.sections') on top of a plain
// object, returning a new object. Used to compute the "effective" value of
// something (profile, etc.) as base data + not-yet-synced local changes.
export function applyPendingFields(baseObject, fields) {
  if (!fields || Object.keys(fields).length === 0) return baseObject;

  let result = { ...(baseObject || {}) };
  for (const [path, value] of Object.entries(fields)) {
    result = setDotPath(result, path, value);
  }
  return result;
}

function setDotPath(obj, path, value) {
  const parts = path.split('.');
  const result = { ...obj };
  let cursor = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return result;
}

function getDotPath(obj, path) {
  const parts = path.split('.');
  let cursor = obj;
  for (const part of parts) {
    if (cursor == null) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

// Checks whether baseObject already holds the same values as `fields`
// (dot-path keyed). Used to decide whether a Firestore snapshot actually
// reflects a pending mutation before treating it as confirmed.
export function pendingFieldsSatisfiedBy(baseObject, fields) {
  if (!fields || Object.keys(fields).length === 0) return true;
  return Object.entries(fields).every(([path, value]) => {
    const current = getDotPath(baseObject, path);
    if (Array.isArray(value) || Array.isArray(current)) {
      return JSON.stringify(current) === JSON.stringify(value);
    }
    return current === value;
  });
}
