import React, { useContext, useMemo, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { updateProfile } from 'firebase/auth';
import { useColors } from '@/_hooks/useColors';

// adjust these imports to your project
import { useAuth } from '@/_context/AuthContext';
import { useUserProfile } from '@/_context/UserProfileContext';
import { auth, db } from '@/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

export default function EditProfileScreen() {
    const { user, isGuest, updateUserName } = useAuth();
    const {
        profile,
        isLoading,
        updateProfileNameLocally,
    } = useUserProfile();
    const colors = useColors();

    const initialName =
        profile?.name ||
        profile?.displayName ||
        user?.name ||
        '';

    const [name, setName] = useState(initialName);
    const [loading, setLoading] = useState(false);

    const trimmedName = useMemo(() => name.trim(), [name]);
    const isDisabled = !trimmedName || trimmedName === initialName.trim();

    const handleSave = async () => {
        if (!user) {
            Alert.alert('Error', 'No authenticated user found.');
            return;
        }

        if (!trimmedName) {
            Alert.alert('Validation', 'Name cannot be empty.');
            return;
        }

        try {
            setLoading(true);

            if (auth.currentUser) {
                await updateProfile(auth.currentUser, {
                    displayName: trimmedName,
                });
            }

            await updateDoc(doc(db, 'users', user.id), {
                name: trimmedName,
                displayName: trimmedName,
            });

            updateUserName?.(trimmedName);
            updateProfileNameLocally?.(trimmedName);

            Alert.alert('Success', 'Your name has been updated.');
            router.back();
        } catch (error) {
            Alert.alert('Update failed', error?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: 'Edit profile' }} />

            <View style={styles.content}>
                <Text style={[styles.label, { color: colors.text }]}>Your name</Text>

                <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    autoCapitalize="words"
                    autoCorrect={false}
                    maxLength={40}
                    style={[styles.input, { backgroundColor: colors.cardBackground, color: colors.text }]}
                />

                <TouchableOpacity
                    style={[styles.button, isDisabled && styles.buttonDisabled, { backgroundColor: colors.butBackground }]}
                    onPress={handleSave}
                    disabled={isDisabled || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={[styles.buttonText, { color: colors.butText }]}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: 20,
        gap: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderColor: '#d0d0d0',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
    },
    button: {
        marginTop: 8,
        backgroundColor: '#111',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});