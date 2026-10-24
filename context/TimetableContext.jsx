import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useNetwork } from '../services/useNetwork';
import { db } from '../firebase/config';
import { getCacheEntry, setCacheEntry } from '../services/cache/cacheStore';

const STORAGE_KEY = '@jmp_tools_timetable';
const MIGRATED_USER_KEY = '@jmp_tools_timetable_migrated_user';
const TIMETABLE_CACHE_DOMAIN = 'timetable';

const createSnapshot = (identity, overrides = {}) => ({
    identity,
    schedule: {},
    loading: true,
    isReady: false,
    pendingSync: false,
    revision: 0,
    ...overrides,
});

const TimetableContext = createContext(null);

export function TimetableProvider({ children }) {
    const { user, isGuest, isLoading: authLoading } = useAuth();
    const { isOffline, isChecking } = useNetwork();
    const identity = isGuest
        ? `guest:${user?.id || 'anonymous'}`
        : user?.id || null;

    const [snapshot, setSnapshot] = useState(() => createSnapshot(null));
    const snapshotRef = useRef(snapshot);
    const identityRef = useRef(identity);
    const isGuestRef = useRef(isGuest);
    const isOfflineRef = useRef(isOffline);
    const isCheckingRef = useRef(isChecking);
    const generationRef = useRef(0);
    const cacheWriteQueueRef = useRef(Promise.resolve());
    const syncInFlightRef = useRef(null);

    identityRef.current = identity;
    isGuestRef.current = isGuest;
    isOfflineRef.current = isOffline;
    isCheckingRef.current = isChecking;

    const publishSnapshot = useCallback((nextSnapshot, expectedIdentity, expectedGeneration) => {
        if (
            identityRef.current !== expectedIdentity ||
            generationRef.current !== expectedGeneration
        ) {
            return false;
        }

        snapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
        return true;
    }, []);

    const enqueueCacheWrite = useCallback((userId, data) => {
        const operation = cacheWriteQueueRef.current
            .catch((error) => {
                console.error('Error in timetable cache write queue:', error);
            })
            .then(async () => {
                const saved = await setCacheEntry(TIMETABLE_CACHE_DOMAIN, userId, data);
                if (!saved) {
                    throw new Error('Unable to persist timetable cache.');
                }
            });

        cacheWriteQueueRef.current = operation;
        return operation;
    }, []);

    const syncPendingSchedule = useCallback((userId, generation) => {
        const existingSync = syncInFlightRef.current;
        if (
            existingSync?.userId === userId &&
            existingSync.generation === generation
        ) {
            return existingSync.promise;
        }

        const isCurrent = () =>
            identityRef.current === userId &&
            generationRef.current === generation;

        let promise;
        promise = (async () => {
            while (
                isCurrent() &&
                !isOfflineRef.current &&
                !isCheckingRef.current
            ) {
                const current = snapshotRef.current;
                if (
                    current.identity !== userId ||
                    !current.isReady ||
                    !current.pendingSync
                ) {
                    return { status: 'complete' };
                }

                const revision = current.revision;
                const schedule = current.schedule;

                try {
                    await cacheWriteQueueRef.current;
                } catch {
                    if (!isCurrent()) {
                        return { status: 'stale' };
                    }

                    const latest = snapshotRef.current;
                    if (latest.revision !== revision || !latest.pendingSync) {
                        continue;
                    }

                    try {
                        await enqueueCacheWrite(userId, {
                            schedule: latest.schedule,
                            pendingSync: true,
                        });
                    } catch (cacheError) {
                        console.error('Error persisting pending timetable before sync:', cacheError);
                        return { status: 'cache-error', error: cacheError };
                    }
                }
                if (!isCurrent()) {
                    return { status: 'stale' };
                }

                const latestBeforeWrite = snapshotRef.current;
                if (
                    latestBeforeWrite.revision !== revision ||
                    !latestBeforeWrite.pendingSync
                ) {
                    continue;
                }

                if (isOfflineRef.current || isCheckingRef.current) {
                    return { status: 'offline' };
                }

                try {
                    await setDoc(doc(db, 'users', userId, 'timetable', 'current'), {
                        schedule,
                        updatedAt: serverTimestamp(),
                    });
                } catch (error) {
                    console.error('Error syncing timetable:', error);
                    if (!isCurrent()) {
                        return { status: 'stale' };
                    }

                    if (snapshotRef.current.revision !== revision) {
                        continue;
                    }
                    return { status: 'error', error };
                }

                if (!isCurrent()) {
                    return { status: 'stale' };
                }

                const latestAfterWrite = snapshotRef.current;
                if (
                    latestAfterWrite.revision !== revision ||
                    !latestAfterWrite.pendingSync
                ) {
                    continue;
                }

                try {
                    await enqueueCacheWrite(userId, {
                        schedule,
                        pendingSync: false,
                    });
                } catch (error) {
                    console.error('Error marking timetable cache as synced:', error);
                    return { status: 'cache-error', error };
                }

                if (!isCurrent()) {
                    return { status: 'stale' };
                }

                const latestAfterCache = snapshotRef.current;
                if (
                    latestAfterCache.revision !== revision ||
                    !latestAfterCache.pendingSync
                ) {
                    continue;
                }

                publishSnapshot({
                    ...latestAfterCache,
                    pendingSync: false,
                }, userId, generation);
            }

            return isCurrent()
                ? { status: 'offline' }
                : { status: 'stale' };
        })().finally(() => {
            if (syncInFlightRef.current?.promise === promise) {
                syncInFlightRef.current = null;
            }
        });

        syncInFlightRef.current = { userId, generation, promise };
        return promise;
    }, [enqueueCacheWrite, publishSnapshot]);

    const saveSchedule = useCallback(async (newSchedule) => {
        const currentIdentity = identityRef.current;
        const currentGeneration = generationRef.current;
        const currentSnapshot = snapshotRef.current;

        if (isGuestRef.current || !currentIdentity) {
            const nextSnapshot = createSnapshot(currentIdentity, {
                schedule: newSchedule,
                loading: false,
                isReady: true,
                revision: currentSnapshot.revision + 1,
            });

            if (!publishSnapshot(nextSnapshot, currentIdentity, currentGeneration)) {
                return {
                    localSaved: false,
                    syncStatus: 'not-attempted',
                    reason: 'identity-changed',
                };
            }

            try {
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSchedule));
            } catch (error) {
                console.error('Error saving timetable:', error);
                return {
                    localSaved: false,
                    syncStatus: 'not-attempted',
                    reason: 'local-storage',
                    error,
                };
            }
            return identityRef.current === currentIdentity
                ? { localSaved: true, syncStatus: 'not-applicable' }
                : { localSaved: true, syncStatus: 'stale' };
        }

        if (
            currentSnapshot.identity !== currentIdentity ||
            !currentSnapshot.isReady
        ) {
            return {
                localSaved: false,
                syncStatus: 'not-attempted',
                reason: 'not-ready',
            };
        }

        const nextSnapshot = {
            ...currentSnapshot,
            schedule: newSchedule,
            loading: false,
            isReady: true,
            pendingSync: true,
            revision: currentSnapshot.revision + 1,
        };

        if (!publishSnapshot(nextSnapshot, currentIdentity, currentGeneration)) {
            return {
                localSaved: false,
                syncStatus: 'not-attempted',
                reason: 'identity-changed',
            };
        }

        try {
            await enqueueCacheWrite(currentIdentity, {
                schedule: newSchedule,
                pendingSync: true,
            });
        } catch (error) {
            console.error('Error saving timetable locally:', error);
            return {
                localSaved: false,
                syncStatus: 'not-attempted',
                reason: 'local-cache',
                error,
            };
        }

        if (identityRef.current !== currentIdentity) {
            return { localSaved: true, syncStatus: 'stale' };
        }

        if (isOfflineRef.current || isCheckingRef.current) {
            return { localSaved: true, syncStatus: 'offline' };
        }

        let result;
        try {
            result = await syncPendingSchedule(currentIdentity, currentGeneration);
        } catch (error) {
            console.error('Error syncing timetable:', error);
            return { localSaved: true, syncStatus: 'firestore-error', error };
        }

        if (result.status === 'error') {
            return {
                localSaved: true,
                syncStatus: 'firestore-error',
                error: result.error,
            };
        }
        if (result.status === 'cache-error') {
            return {
                localSaved: true,
                syncStatus: 'cache-error',
                error: result.error,
            };
        }
        if (result.status === 'offline') {
            return { localSaved: true, syncStatus: 'offline' };
        }
        if (result.status === 'stale' || identityRef.current !== currentIdentity) {
            return { localSaved: true, syncStatus: 'stale' };
        }
        return { localSaved: true, syncStatus: 'synced' };
    }, [enqueueCacheWrite, publishSnapshot, syncPendingSchedule]);

    useEffect(() => {
        const generation = generationRef.current + 1;
        generationRef.current = generation;
        const activeIdentity = identityRef.current;
        let isMounted = true;
        let unsubscribe = null;

        const isCurrent = () =>
            isMounted &&
            identityRef.current === activeIdentity &&
            generationRef.current === generation;

        const initialSnapshot = createSnapshot(activeIdentity, {
            loading: Boolean(authLoading || activeIdentity),
        });
        snapshotRef.current = initialSnapshot;
        setSnapshot(initialSnapshot);

        if (authLoading) {
            return () => {
                isMounted = false;
                if (generationRef.current === generation) {
                    generationRef.current += 1;
                }
            };
        }

        if (!activeIdentity || isGuest || !user?.id) {
            const readyState = createSnapshot(activeIdentity, {
                loading: false,
            });
            snapshotRef.current = readyState;
            setSnapshot(readyState);
            return () => {
                isMounted = false;
                if (generationRef.current === generation) {
                    generationRef.current += 1;
                }
            };
        }

        const userId = user.id;

        const migrateLegacyTimetableIfNeeded = async () => {
            const timetableRef = doc(db, 'users', userId, 'timetable', 'current');

            try {
                const migratedUserId = await AsyncStorage.getItem(MIGRATED_USER_KEY);
                if (!isCurrent()) return null;

                const legacyRaw = await AsyncStorage.getItem(STORAGE_KEY);
                if (!isCurrent()) return null;

                if (!legacyRaw || (migratedUserId && migratedUserId !== userId)) {
                    await setDoc(timetableRef, {
                        schedule: {},
                        updatedAt: serverTimestamp(),
                    });
                    if (!isCurrent()) return null;

                    const cached = await setCacheEntry(TIMETABLE_CACHE_DOMAIN, userId, {
                        schedule: {},
                        pendingSync: false,
                    });
                    if (!cached) {
                        throw new Error('Unable to cache migrated timetable.');
                    }
                    return {};
                }

                const legacySchedule = JSON.parse(legacyRaw);
                await setDoc(timetableRef, {
                    schedule: legacySchedule,
                    updatedAt: serverTimestamp(),
                });
                if (!isCurrent()) return null;

                await AsyncStorage.setItem(MIGRATED_USER_KEY, userId);
                if (!isCurrent()) return null;
                const cached = await setCacheEntry(TIMETABLE_CACHE_DOMAIN, userId, {
                    schedule: legacySchedule,
                    pendingSync: false,
                });
                if (!cached) {
                    throw new Error('Unable to cache migrated timetable.');
                }
                if (!isCurrent()) return null;
                await AsyncStorage.removeItem(STORAGE_KEY);
                return legacySchedule;
            } catch (error) {
                console.error('Error migrating legacy timetable:', error);
                return null;
            }
        };

        const handleTimetableSnapshot = async (firestoreSnapshot) => {
            if (!isCurrent()) return;

            const current = snapshotRef.current;
            if (current.identity === userId && current.pendingSync) {
                publishSnapshot({
                    ...current,
                    loading: false,
                }, activeIdentity, generation);
                return;
            }

            if (!firestoreSnapshot.exists()) {
                if (firestoreSnapshot.metadata.fromCache) {
                    return;
                }

                const migratedSchedule = await migrateLegacyTimetableIfNeeded();
                if (!isCurrent()) return;

                if (migratedSchedule === null) {
                    const latest = snapshotRef.current;
                    publishSnapshot({
                        ...latest,
                        loading: false,
                        isReady: latest.isReady,
                    }, activeIdentity, generation);
                    return;
                }

                const latest = snapshotRef.current;
                const nextSnapshot = createSnapshot(activeIdentity, {
                    schedule: migratedSchedule,
                    loading: false,
                    isReady: true,
                    revision: latest.revision + 1,
                });
                publishSnapshot(nextSnapshot, activeIdentity, generation);
                return;
            }

            const remoteSchedule = firestoreSnapshot.data()?.schedule || {};
            const latest = snapshotRef.current;
            const nextSnapshot = createSnapshot(activeIdentity, {
                schedule: remoteSchedule,
                loading: false,
                isReady: true,
                revision: latest.revision + 1,
            });

            if (publishSnapshot(nextSnapshot, activeIdentity, generation)) {
                void enqueueCacheWrite(userId, {
                    schedule: remoteSchedule,
                    pendingSync: false,
                }).catch((error) => {
                    console.error('Error caching remote timetable:', error);
                });
            }
        };

        const loadFromCache = async () => {
            try {
                const cached = await getCacheEntry(TIMETABLE_CACHE_DOMAIN, userId);
                if (!isCurrent() || !cached?.data) return;

                const current = snapshotRef.current;
                const cachedSnapshot = createSnapshot(activeIdentity, {
                    schedule: cached.data.schedule || {},
                    loading: false,
                    isReady: true,
                    pendingSync: Boolean(cached.data.pendingSync),
                    revision: current.revision + 1,
                });
                publishSnapshot(cachedSnapshot, activeIdentity, generation);
            } catch (error) {
                console.error('Error loading timetable cache:', error);
            }
        };

        loadFromCache().finally(() => {
            if (!isCurrent()) return;

            unsubscribe = onSnapshot(
                doc(db, 'users', userId, 'timetable', 'current'),
                handleTimetableSnapshot,
                (error) => {
                    console.error('Error observing timetable:', error);
                    if (!isCurrent()) return;

                    publishSnapshot({
                        ...snapshotRef.current,
                        loading: false,
                    }, activeIdentity, generation);
                }
            );
        });

        return () => {
            isMounted = false;
            if (unsubscribe) {
                unsubscribe();
            }
            if (generationRef.current === generation) {
                generationRef.current += 1;
            }
        };
    }, [authLoading, isGuest, user?.id, enqueueCacheWrite, publishSnapshot]);

    const currentSnapshot = snapshot.identity === identity
        ? snapshot
        : createSnapshot(identity, {
            loading: Boolean(authLoading || identity),
        });

    useEffect(() => {
        if (
            authLoading ||
            isGuest ||
            !identity ||
            isOffline ||
            isChecking ||
            !currentSnapshot.isReady ||
            !currentSnapshot.pendingSync
        ) {
            return;
        }

        void syncPendingSchedule(identity, generationRef.current);
    }, [
        authLoading,
        currentSnapshot.isReady,
        currentSnapshot.pendingSync,
        currentSnapshot.revision,
        identity,
        isGuest,
        isChecking,
        isOffline,
        syncPendingSchedule,
    ]);

    const getCurrentSnapshot = useCallback(() => {
        if (isGuestRef.current) {
            return { schedule: {}, isReady: false };
        }

        const latestSnapshot = snapshotRef.current;
        if (latestSnapshot.identity !== identityRef.current) {
            return { schedule: {}, isReady: false };
        }

        return {
            schedule: latestSnapshot.schedule,
            isReady: latestSnapshot.isReady,
        };
    }, []);

    const value = useMemo(() => ({
        schedule: currentSnapshot.schedule,
        loading: currentSnapshot.loading,
        isReady: currentSnapshot.isReady,
        getCurrentSnapshot,
        saveSchedule,
    }), [currentSnapshot, getCurrentSnapshot, saveSchedule]);

    return (
        <TimetableContext.Provider value={value}>
            {children}
        </TimetableContext.Provider>
    );
}

export function useTimetable() {
    const context = useContext(TimetableContext);
    if (!context) {
        throw new Error('useTimetable must be used within TimetableProvider');
    }
    return context;
}
