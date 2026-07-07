import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    TextInput,
    TouchableOpacity,
    Alert,
} from 'react-native';
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    deleteDoc,
    doc,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useColors } from '@/_hooks/useColors';
import { useAuth } from '@/_context/AuthContext';
import { getReportTypeLabel } from '@/constants/reportTypes';

const ADMIN_EMAILS = ['jakub.jaskola7@gmail.com'];

const formatTimestamp = (ts) => {
    if (!ts || !ts.toDate) return '';
    const d = ts.toDate();
    const pad = (n) => String(n).padStart(2, '0');

    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
};

const ReportsScreen = () => {
    const colors = useColors();
    const { user, isGuest } = useAuth();
    const isAdmin =
        !!user?.email &&
        !isGuest &&
        ADMIN_EMAILS.includes(user.email.toLowerCase());

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const q = query(
            collection(db, 'reports'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setReports(data);
                setLoading(false);
            },
            (error) => {
                console.log('Error fetching reports:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const filteredReports = useMemo(() => {
        const queryText = search.trim().toLowerCase();
        if (!queryText) return reports;

        return reports.filter((item) => {
            const truckStr = String(item.truckNumber || '').toLowerCase();
            const typeStr = getReportTypeLabel(item.type).toLowerCase();
            const descStr = String(item.description || '').toLowerCase();

            return (
                truckStr.includes(queryText) ||
                typeStr.includes(queryText) ||
                descStr.includes(queryText)
            );
        });
    }, [reports, search]);

    const handleDelete = (id) => {
        if (!isAdmin) return;

        Alert.alert(
            'Usuń zgłoszenie',
            'Na pewno chcesz usunąć to zgłoszenie?',
            [
                { text: 'Anuluj', style: 'cancel' },
                {
                    text: 'Usuń',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'reports', id));
                        } catch (e) {
                            console.log('Error deleting report:', e);
                            Alert.alert('Błąd', 'Nie udało się usunąć zgłoszenia.');
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }) => {
        const reportTypeLabel = getReportTypeLabel(item.type);

        return (<View
            style={[
                styles.item,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                },
            ]}
        >
            <View style={styles.itemContent}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.truck, { color: colors.title }]}>
                        Ciężarówka: {item.truckNumber}
                    </Text>
                    <Text style={[styles.type, { color: colors.textSecondary }]}>
                        Typ: {reportTypeLabel}
                    </Text>
                    {item.description ? (
                        <Text style={[styles.desc, { color: colors.text }]} numberOfLines={3}>
                            {item.description}
                        </Text>
                    ) : null}
                    {item.createdAt && (
                        <Text style={[styles.timestamp, { color: colors.grayIconColor }]}>
                            {formatTimestamp(item.createdAt)}
                        </Text>
                    )}
                </View>

                {isAdmin && (
                    <TouchableOpacity
                        onPress={() => handleDelete(item.id)}
                        style={[
                            styles.deleteButton,
                            { borderColor: colors.border, backgroundColor: colors.cardBackground },
                        ]}
                    >
                        <Text style={[styles.deleteText, { color: colors.textSecondary }]}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator color={colors.sIconColor} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={filteredReports}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                ListEmptyComponent={
                    <Text style={{ color: colors.textSecondary, paddingHorizontal: 4, }}>
                        Brak zgłoszeń.
                    </Text>
                }
                ListHeaderComponent={
                    <View
                        style={[
                            styles.searchWrapper,
                            {
                                backgroundColor: colors.cardBackground,
                                borderColor: colors.inputBorder,
                            },
                        ]}
                    >
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Szukaj po numerze, typie, opisie..."
                            placeholderTextColor={colors.phText}
                            style={[
                                styles.searchInput,
                                {
                                    color: colors.text,
                                },
                            ]}
                        />
                    </View>
                }
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
    },
    searchWrapper: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12,
    },
    searchInput: {
        fontSize: 14,
    },
    item: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    truck: {
        fontSize: 15,
        fontWeight: '600',
    },
    type: {
        marginTop: 4,
        fontSize: 13,
    },
    desc: {
        marginTop: 6,
        fontSize: 14,
    },
    timestamp: {
        marginTop: 6,
        fontSize: 11,
    },
    deleteButton: {
        borderWidth: 1,
        borderRadius: 50,
        paddingHorizontal: 8,
        paddingVertical: 6,
        alignSelf: 'flex-start',
    },
    deleteText: {
        fontSize: 12,
        fontWeight: '700',
    },
});

export default ReportsScreen;