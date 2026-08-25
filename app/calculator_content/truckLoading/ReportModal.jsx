import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Animated,
    ScrollView,
    Keyboard,
} from 'react-native';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useColors } from '../../../hooks/useColors';
import { MaterialIcons } from '@expo/vector-icons';
import { REPORT_TYPES } from '../../../constants/reportTypes';
import { useAuth } from '../../../context/AuthContext';

const ReportModal = ({
    visible,
    onClose,
    initialTruckNumber = '',
    editMode = false,
    reportId = null,
    initialData = null,
}) => {
    const colors = useColors();
    const { user } = useAuth();

    const [truckNumber, setTruckNumber] = useState(initialTruckNumber);
    const [reportType, setReportType] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const [showSuccess, setShowSuccess] = useState(false); // success state

    const scaleAnim = useRef(new Animated.Value(0.5)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) {
            setKeyboardHeight(0);
            return;
        }

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (e) => {
            setKeyboardHeight(e.endCoordinates?.height || 0);
        });

        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [visible]);

    useEffect(() => {
        if (!visible) {
            setTruckNumber(initialTruckNumber || '');
            setReportType('');
            setDescription('');
            setError(null);
            setSaving(false);
            setShowSuccess(false);
            scaleAnim.setValue(0.5);
            opacityAnim.setValue(0);
            return;
        }

        const nextTruckNumber = editMode
            ? (initialData?.truckNumber ?? initialTruckNumber ?? '')
            : (initialTruckNumber || '');
        const nextReportType = editMode
            ? (initialData?.type ?? '')
            : '';
        const nextDescription = editMode
            ? (initialData?.description ?? '')
            : '';

        setTruckNumber(nextTruckNumber);
        setReportType(nextReportType);
        setDescription(nextDescription);
        setError(null);
        setSaving(false);
        setShowSuccess(false);
        scaleAnim.setValue(0.5);
        opacityAnim.setValue(0);
    }, [visible, initialTruckNumber, editMode, initialData, scaleAnim, opacityAnim]);

    useEffect(() => {
        if (!visible || !showSuccess) {
            return;
        }

        const animation = Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                friction: 5,
                tension: 80,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]);

        animation.start();

        return () => {
            animation.stop();
        };
    }, [showSuccess, visible, scaleAnim, opacityAnim]);

    const handleCancel = () => {
        if (saving) return;
        onClose();
    };

    const handleSave = async () => {
        if (!truckNumber.trim()) {
            setError('Podaj numer ciężarówki.');
            return;
        }
        if (!reportType) {
            setError('Wybierz typ zgłoszenia.');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const payload = {
                truckNumber: truckNumber.trim(),
                type: reportType,
                description: description.trim() || null,
            };

            if (editMode && reportId) {
                await updateDoc(doc(db, 'reports', reportId), {
                    ...payload,
                    updatedAt: serverTimestamp(),
                });
            } else {
                const reporterName = user?.name || user?.email || 'Gość';
                const reporterInitials = reporterName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() || '')
                    .join('') || 'G';

                await addDoc(collection(db, 'reports'), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    reporterId: user?.id || null,
                    reporterName,
                    reporterInitials,
                });
            }

            setSaving(false);
            setShowSuccess(true);
        } catch (e) {
            console.log('Error saving report:', e);
            setSaving(false);
            setError(editMode ? 'Nie udało się zaktualizować zgłoszenia. Spróbuj ponownie.' : 'Nie udało się zapisać zgłoszenia. Spróbuj ponownie.');
        }
    };

    const handleSuccessOk = () => {
        setShowSuccess(false);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={handleCancel}
            statusBarTranslucent={true}
            navigationBarTranslucent={true}
        >
            <View style={styles.backdrop}>
                <View style={[
                    styles.container,
                    {
                        backgroundColor: colors.cardBackground,
                        marginBottom: keyboardHeight,
                    }
                ]}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                            {showSuccess ? (
                                // ✅ SUCCESS STATE
                                <View style={styles.successWrapper}>
                                    <Animated.View
                                        style={[
                                            styles.successIconWrapper,
                                            {
                                                backgroundColor: colors.cardInCardBackground,
                                                transform: [{ scale: scaleAnim }],
                                                opacity: opacityAnim,
                                            },
                                        ]}
                                    >
                                        <MaterialIcons
                                            name="error-outline" // exclamation style icon; swap if you prefer
                                            size={40}
                                            color={colors.sIconColor}
                                        />
                                    </Animated.View>

                                    <Text style={[styles.successText, { color: colors.title }]}>
                                        {editMode ? 'Zaktualizowano zgłoszenie!' : 'Dodano zgłoszenie!'}
                                    </Text>

                                    <TouchableOpacity
                                        onPress={handleSuccessOk}
                                        style={[
                                            styles.successButton,
                                            {
                                                backgroundColor: colors.butBackground,
                                                borderColor: colors.butBorder,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.successButtonText, { color: colors.butText }]}>
                                            OK
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <Text style={[styles.title, { color: colors.title }]}>Zgłoś problem</Text>

                                    {/* Truck number */}
                                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                                        Numer ciężarówki
                                    </Text>
                                    <TextInput
                                        value={truckNumber}
                                        onChangeText={setTruckNumber}
                                        placeholder="Numer naczepy lub pojazdu"
                                        placeholderTextColor={colors.phText}
                                        style={[
                                            styles.input,
                                            {
                                                backgroundColor: colors.inputBackground,
                                                borderColor: colors.inputBorder,
                                                color: colors.text,
                                            },
                                        ]}
                                    />

                                    {/* Report type */}
                                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                                        Typ zgłoszenia
                                    </Text>
                                    <View
                                        style={[
                                            styles.optionList,
                                            {
                                                backgroundColor: colors.inputBackground,
                                                borderColor: colors.inputBorder,
                                            },
                                        ]}
                                    >
                                        <ScrollView
                                            style={styles.optionScroll}
                                            nestedScrollEnabled
                                            showsVerticalScrollIndicator
                                            indicatorStyle="black"
                                        >
                                            {REPORT_TYPES.map((opt) => {
                                                const selected = reportType === opt.value;
                                                return (
                                                    <TouchableOpacity
                                                        key={opt.value}
                                                        onPress={() => setReportType(opt.value)}
                                                        style={[
                                                            styles.optionButton,
                                                            selected && {
                                                                backgroundColor: colors.butBackground,
                                                                borderColor: colors.butBorder,
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.optionText,
                                                                { color: selected ? colors.butText : colors.text },
                                                            ]}
                                                        >
                                                            {opt.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>

                                    {/* Optional description */}
                                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                                        Opis (opcjonalnie)
                                    </Text>
                                    <TextInput
                                        value={description}
                                        onChangeText={setDescription}
                                        placeholder="Dodaj szczegóły, jeśli chcesz"
                                        placeholderTextColor={colors.phText}
                                        multiline
                                        style={[
                                            styles.textArea,
                                            {
                                                backgroundColor: colors.inputBackground,
                                                borderColor: colors.inputBorder,
                                                color: colors.text,
                                            },
                                        ]}
                                    />

                                    {error ? (
                                        <Text style={[styles.error, { color: colors.textRed }]}>{error}</Text>
                                    ) : null}

                                    {/* Buttons */}
                                    <View style={styles.buttonsRow}>
                                        <TouchableOpacity
                                            style={[
                                                styles.outlinedButton,
                                                {
                                                    borderColor: colors.outButBorder,
                                                    backgroundColor: colors.outButBackground,
                                                },
                                            ]}
                                            onPress={handleCancel}
                                            disabled={saving}
                                        >
                                            <Text style={[styles.outlinedText, { color: colors.outButText }]}>
                                                Anuluj
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.primaryButton,
                                                {
                                                    backgroundColor: colors.butBackground,
                                                    borderColor: colors.butBorder,
                                                    opacity: saving ? 0.7 : 1,
                                                },
                                            ]}
                                            onPress={handleSave}
                                            disabled={saving}
                                        >
                                            <Text style={[styles.primaryText, { color: colors.butText }]}>
                                                {saving ? 'Zapisywanie...' : editMode ? 'Zapisz zmiany' : 'Zapisz'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    container: {
        width: '100%',
        minHeight: '55%',
        maxHeight: '80%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 16,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 6 },
        }),
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    label: {
        fontSize: 13,
        marginTop: 8,
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 15,
    },
    optionList: {
        borderWidth: 1,
        borderRadius: 12,
        overflow: 'hidden',
        maxHeight: 180,
    },
    optionScroll: {
        maxHeight: 180,
    },
    optionButton: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    optionText: {
        fontSize: 14,
    },
    textArea: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 15,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    error: {
        marginTop: 8,
        fontSize: 13,
    },
    buttonsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 16,
    },
    outlinedButton: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    outlinedText: {
        fontSize: 14,
        fontWeight: '500',
    },
    primaryButton: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    primaryText: {
        fontSize: 14,
        fontWeight: '600',
    },
    successWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
    },
    successIconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    successText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 24,
    },
    successButton: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 32,
        paddingVertical: 10,
    },
    successButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
});

export default ReportModal;