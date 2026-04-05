// utils/crossPlatformAlert.js
import { Alert, Platform } from 'react-native';

export function appAlert(title, message = '', onOk) {
    if (Platform.OS === 'web') {
        window.alert([title, message].filter(Boolean).join('\n\n'));
        if (onOk) onOk();
        return;
    }
    Alert.alert(title, message, [
        {
            text: 'OK',
            onPress: onOk,
        },
    ]);
}

export function appConfirm(title, message = '', onConfirm, onCancel) {
    if (Platform.OS === 'web') {
        const result = window.confirm([title, message].filter(Boolean).join('\n\n'));
        if (result) onConfirm && onConfirm();
        else onCancel && onCancel();
        return;
    }

    Alert.alert(title, message, [
        { text: 'Anuluj', style: 'cancel', onPress: onCancel },
        { text: 'OK', onPress: onConfirm },
    ]);
}