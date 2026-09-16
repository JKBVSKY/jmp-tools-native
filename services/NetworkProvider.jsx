import React, { createContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const NetworkContext = createContext(null);

export function NetworkProvider({ children }) {
    const [networkState, setNetworkState] = useState({
        isConnected: null,
        isInternetReachable: null,
    });

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            // TEMP diagnostics for reconnect-delay investigation (T0 in the offline sync trace).
            console.log('🌐 [reconnect-diag] NetInfo event T0:', {
                isConnected: state.isConnected,
                isInternetReachable: state.isInternetReachable,
                timestamp: Date.now(),
            });
            setNetworkState({
                isConnected: state.isConnected,
                isInternetReachable: state.isInternetReachable,
            });
        });

        return unsubscribe;
    }, []);

    const isChecking = networkState.isConnected === null;

    const isOnline =
        networkState.isConnected === true &&
        networkState.isInternetReachable !== false;

    const isOffline =
        networkState.isConnected === false ||
        networkState.isInternetReachable === false;

    useEffect(() => {
        if (isChecking) return;
        // TEMP diagnostics: derived isOffline/isOnline (T1 in the offline sync trace).
        console.log('🌐 [reconnect-diag] derived network state T1:', {
            isOnline,
            isOffline,
            timestamp: Date.now(),
        });
    }, [isOnline, isOffline, isChecking]);

    return (
        <NetworkContext.Provider
            value={{
                isConnected: networkState.isConnected,
                isInternetReachable: networkState.isInternetReachable,
                isChecking,
                isOnline,
                isOffline,
            }}
        >
            {children}
        </NetworkContext.Provider>
    );
}