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