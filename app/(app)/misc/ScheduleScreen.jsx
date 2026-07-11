import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useColors } from '@/_hooks/useColors';
import { useAuth } from '@/_context/AuthContext';
import { db } from '@/firebase/config';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    writeBatch,
} from 'firebase/firestore';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';

const { text } = await recognizeText(imagePath);

const ADMIN_EMAILS = ['jakub.jaskola7@gmail.com'];

const formatTimestamp = (value) => {
    if (!value) return '';
    const date = value.toDate ? value.toDate() : new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const parseScheduleText = (text) => {
    if (!text) return [];

    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const headerIndex = lines.findIndex(
        (line) => /\blp\b/i.test(line) && /\bnr\b/i.test(line) && /\bsklep\b/i.test(line)
    );

    const dataLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;
    const rows = [];

    for (const rawLine of dataLines) {
        const cleaned = rawLine.replace(/\|/g, ' ').replace(/\s{2,}/g, ' ');
        const tokens = cleaned
            .split(/\t|\s{2,}|,/)
            .map((token) => token.trim())
            .filter(Boolean);

        if (tokens.length < 3) continue;

        const lp = tokens[0];
        const nr = tokens[1];
        const sklep = tokens.slice(2).join(' ');

        if (!lp || !nr || !sklep) continue;

        rows.push({
            lp,
            nr,
            sklep,
            createdAt: new Date(),
        });
    }

    return rows;
};

const ScheduleScreen = () => {
    const colors = useColors();
    const { user, isGuest } = useAuth();
    const [items, setItems] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(true);
    const [verificationVisible, setVerificationVisible] = useState(false);
    const [verificationItems, setVerificationItems] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    const isAdmin = !!user?.email && !isGuest && ADMIN_EMAILS.includes(user.email.toLowerCase());
    const scheduleCollection = user ? collection(db, 'users', user.id, 'scheduleItems') : null;

    useEffect(() => {
        if (!scheduleCollection) {
            setLoading(false);
            return;
        }

        const q = query(scheduleCollection, orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((docItem) => ({
                    id: docItem.id,
                    ...docItem.data(),
                }));
                setItems(data);
                setLoading(false);
            },
            (error) => {
                console.log('Schedule subscription error:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [scheduleCollection]);

    const filteredItems = useMemo(() => {
        const queryText = searchText.trim().toLowerCase();
        if (!queryText) return items;

        return items.filter((item) =>
            [item.lp, item.nr, item.sklep]
                .map((value) => String(value || '').toLowerCase())
                .some((value) => value.includes(queryText))
        );
    }, [items, searchText]);

    const updateItemField = (id, field, value) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    };

    const saveInlineItem = async (item) => {
        if (!isAdmin || !user || !item?.id) return;

        try {
            await updateDoc(doc(db, 'users', user.id, 'scheduleItems', item.id), {
                lp: item.lp,
                nr: item.nr,
                sklep: item.sklep,
            });
        } catch (error) {
            console.error('Inline item save error:', error);
            Alert.alert('Błąd', 'Nie udało się zapisać zmian w wierszu.');
        }
    };

    const clearAllItems = async () => {
        if (!scheduleCollection || !user) return;

        try {
            const snapshot = await getDocs(scheduleCollection);
            if (snapshot.empty) return;

            const batch = writeBatch(db);
            snapshot.docs.forEach((docItem) => {
                batch.delete(doc(db, 'users', user.id, 'scheduleItems', docItem.id));
            });
            await batch.commit();
        } catch (error) {
            console.error('Clear schedule error:', error);
            Alert.alert('Błąd', 'Nie udało się wyczyścić listy.');
        }
    };

    const handleClearPress = () => {
        if (!isAdmin) return;

        Alert.alert('Wyczyść harmonogram', 'Czy na pewno chcesz usunąć wszystkie zeskanowane pozycje?', [
            { text: 'Anuluj', style: 'cancel' },
            {
                text: 'Wyczyść',
                style: 'destructive',
                onPress: async () => {
                    await clearAllItems();
                },
            },
        ]);
    };

    const saveVerificationItems = async () => {
        if (!isAdmin || !user) return;

        setIsSaving(true);

        try {
            const snapshot = await getDocs(scheduleCollection);
            const batch = writeBatch(db);
            snapshot.docs.forEach((docItem) => batch.delete(doc(db, 'users', user.id, 'scheduleItems', docItem.id)));
            await batch.commit();

            for (const item of verificationItems) {
                await addDoc(scheduleCollection, {
                    lp: item.lp,
                    nr: item.nr,
                    sklep: item.sklep,
                    createdAt: item.createdAt || new Date(),
                });
            }

            setVerificationVisible(false);
            Alert.alert('Gotowe', 'Zapisano harmonogram.');
        } catch (error) {
            console.error('Verification save error:', error);
            Alert.alert('Błąd', 'Nie udało się zapisać danych z weryfikacji.');
        } finally {
            setIsSaving(false);
        }
    };

    const recognizeTextFromImage = async (uri) => {
        try {
            if (!uri) return null;

            const mlkit = await import('expo-mlkit-ocr');
            if (!mlkit) return null;

            const result =
                typeof mlkit.recognizeText === 'function'
                    ? await mlkit.recognizeText(uri)
                    : typeof mlkit.default?.recognizeText === 'function'
                        ? await mlkit.default.recognizeText(uri)
                        : null;

            if (!result) return null;

            if (typeof result === 'string') return result;
            if (typeof result?.text === 'string') return result.text;
            if (Array.isArray(result?.blocks)) {
                return result.blocks.map((block) => block.text).filter(Boolean).join('\n');
            }

            return null;
        } catch (error) {
            console.log('Text recognition unavailable:', error);
            return null;
        }
    };

    const pickImage = async (source) => {
        try {
            const ImagePicker = await import('expo-image-picker');
            const permissionMethod = source === 'camera'
                ? ImagePicker.requestCameraPermissionsAsync
                : ImagePicker.requestMediaLibraryPermissionsAsync;

            const permission = await permissionMethod();
            if (!permission.granted) {
                Alert.alert('Brak uprawnień', 'Proszę zezwolić na dostęp do aparatu lub galerii.');
                return null;
            }

            const options = {
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                base64: false,
            };

            const result =
                source === 'camera'
                    ? await ImagePicker.launchCameraAsync(options)
                    : await ImagePicker.launchImageLibraryAsync(options);

            if (result.cancelled || result.canceled) return null;
            return result.assets?.[0]?.uri ?? result.uri;
        } catch (error) {
            console.log('Image picker unavailable:', error);
            Alert.alert('Skanowanie niedostępne', 'Zainstaluj expo-image-picker, aby użyć tej funkcji.');
            return null;
        }
    };

    const processScannedImage = async (uri) => {
        if (!uri) return;

        const ocrText = await recognizeTextFromImage(uri);
        if (!ocrText) {
            Alert.alert(
                'OCR niedostępne',
                'Nie udało się rozpoznać tekstu. Upewnij się, że masz zainstalowany moduł OCR lub spróbuj inną fotografię.'
            );
            return;
        }

        const parsedRows = parseScheduleText(ocrText);
        if (!parsedRows.length) {
            Alert.alert(
                'Brak danych',
                'Nie znaleziono w dokumencie kolumn LP, NR i SKLEP. Sprawdź obraz i spróbuj ponownie.'
            );
            return;
        }

        setVerificationItems(parsedRows.map((item, index) => ({
            ...item,
            id: `scanned-${Date.now()}-${index}`,
            createdAt: item.createdAt || new Date(),
        })));
        setVerificationVisible(true);
    };

    const handleScanPress = () => {
        if (!isAdmin) return;

        Alert.alert('Skanuj dokument', 'Wybierz źródło obrazu', [
            { text: 'Anuluj', style: 'cancel' },
            {
                text: 'Galeria',
                onPress: async () => {
                    const uri = await pickImage('gallery');
                    await processScannedImage(uri);
                },
            },
            {
                text: 'Aparat',
                onPress: async () => {
                    const uri = await pickImage('camera');
                    await processScannedImage(uri);
                },
            },
        ]);
    };

    const handleEditPress = () => {
        if (!isAdmin) return;
        if (!items.length) {
            Alert.alert('Brak danych', 'Nie ma jeszcze zeskanowanych pozycji do edycji.');
            return;
        }
        setVerificationItems(items.map((item) => ({ ...item })));
        setVerificationVisible(true);
    };

    const renderRow = ({ item }) => (
        <View style={[styles.row, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.rowTop}>
                <Text style={[styles.rowTimestamp, { color: colors.grayIconColor }]}> {formatTimestamp(item.createdAt)} </Text>
            </View>
            <View style={styles.rowFields}>
                <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LP</Text>
                    <TextInput
                        value={String(item.lp ?? '')}
                        onChangeText={(value) => updateItemField(item.id, 'lp', value)}
                        onEndEditing={() => saveInlineItem(item)}
                        editable={isAdmin}
                        style={[styles.fieldInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
                    />
                </View>
                <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>NR</Text>
                    <TextInput
                        value={String(item.nr ?? '')}
                        onChangeText={(value) => updateItemField(item.id, 'nr', value)}
                        onEndEditing={() => saveInlineItem(item)}
                        editable={isAdmin}
                        style={[styles.fieldInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
                    />
                </View>
                <View style={styles.fieldContainerLarge}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SKLEP</Text>
                    <TextInput
                        value={String(item.sklep ?? '')}
                        onChangeText={(value) => updateItemField(item.id, 'sklep', value)}
                        onEndEditing={() => saveInlineItem(item)}
                        editable={isAdmin}
                        style={[styles.fieldInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
                    />
                </View>
            </View>
        </View>
    );

    const renderVerificationRow = ({ item }) => (
        <View style={[styles.verificationRow, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.verificationTimestamp, { color: colors.grayIconColor }]}> {formatTimestamp(item.createdAt)} </Text>
            <View style={styles.rowFields}>
                <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LP</Text>
                    <TextInput
                        value={String(item.lp ?? '')}
                        onChangeText={(value) => {
                            setVerificationItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, lp: value } : row)));
                        }}
                        style={[styles.fieldInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
                    />
                </View>
                <View style={styles.fieldContainer}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>NR</Text>
                    <TextInput
                        value={String(item.nr ?? '')}
                        onChangeText={(value) => {
                            setVerificationItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, nr: value } : row)));
                        }}
                        style={[styles.fieldInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
                    />
                </View>
                <View style={styles.fieldContainerLarge}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SKLEP</Text>
                    <TextInput
                        value={String(item.sklep ?? '')}
                        onChangeText={(value) => {
                            setVerificationItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, sklep: value } : row)));
                        }}
                        style={[styles.fieldInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder }]}
                    />
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: 'Schedule' }} />

            <View style={[styles.header, { backgroundColor: colors.navBackground, borderColor: colors.border }]}>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.title, { color: colors.text }]}>Schedule</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Scan and manage your schedule list</Text>
                </View>

                {isAdmin ? (
                    <View style={styles.headerButtons}>
                        <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.butBackground }]} onPress={handleScanPress}>
                            <Text style={[styles.headerButtonText, { color: colors.butText }]}>Scan</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.butBackground }]} onPress={handleEditPress}>
                            <Text style={[styles.headerButtonText, { color: colors.butText }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.butBackground }]} onPress={handleClearPress}>
                            <Text style={[styles.headerButtonText, { color: colors.butText }]}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>

            <View style={[styles.content, { backgroundColor: colors.background }]}>
                <View style={[styles.searchWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <TextInput
                        placeholder="Szukaj w harmonogramie..."
                        placeholderTextColor={colors.phText}
                        value={searchText}
                        onChangeText={setSearchText}
                        style={[styles.searchInput, { color: colors.text }]}
                        returnKeyType="search"
                    />
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={colors.sIconColor} size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredItems}
                        keyExtractor={(item) => item.id}
                        renderItem={renderRow}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Brak zeskanowanych pozycji.</Text>
                        }
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            <Modal visible={verificationVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Weryfikacja skanu</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Sprawdź i popraw dane przed zapisaniem.</Text>

                        <FlatList
                            data={verificationItems}
                            keyExtractor={(item) => item.id}
                            renderItem={renderVerificationRow}
                            contentContainerStyle={{ paddingVertical: 8 }}
                            ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>Brak pozycji do weryfikacji.</Text>}
                            keyboardShouldPersistTaps="handled"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} onPress={() => setVerificationVisible(false)}>
                                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.butBackground }]} onPress={saveVerificationItems} disabled={isSaving}>
                                {isSaving ? (
                                    <ActivityIndicator color={colors.butText} />
                                ) : (
                                    <Text style={[styles.modalButtonText, { color: colors.butText }]}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerTextContainer: {
        flex: 1,
        paddingRight: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: 10,
    },
    headerButton: {
        width: 72,
        height: 72,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
        paddingHorizontal: 8,
        paddingVertical: 10,
    },
    headerButtonText: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    searchWrapper: {
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 14,
    },
    searchInput: {
        fontSize: 14,
        minHeight: 40,
    },
    listContent: {
        paddingBottom: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 24,
    },
    row: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    rowTop: {
        marginBottom: 10,
    },
    rowTimestamp: {
        fontSize: 12,
    },
    rowFields: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    fieldContainer: {
        flexBasis: '30%',
        minWidth: 90,
        marginBottom: 10,
    },
    fieldContainerLarge: {
        flexBasis: '65%',
        minWidth: 140,
        marginBottom: 10,
    },
    fieldLabel: {
        fontSize: 12,
        marginBottom: 6,
    },
    fieldInput: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: Platform.OS === 'android' ? 6 : 10,
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    modalContainer: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '85%',
        borderWidth: 1,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 6,
    },
    modalSubtitle: {
        fontSize: 13,
        marginBottom: 12,
    },
    verificationRow: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
    },
    verificationTimestamp: {
        fontSize: 12,
        marginBottom: 10,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    modalButton: {
        flex: 1,
        marginHorizontal: 4,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonText: {
        fontSize: 15,
        fontWeight: '700',
    },
});

export default ScheduleScreen;
