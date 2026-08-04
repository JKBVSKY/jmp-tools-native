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
    updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useColors } from '../../hooks/useColors';
import { useAuth } from '../../context/AuthContext';
import { getReportTypeLabel } from '../../constants/reportTypes';

const ADMIN_EMAILS = ['jakub.jaskola7@gmail.com'];
const REPORT_STATUSES = {
    reported: 'reported',
    submitted: 'submitted',
    fixed: 'fixed',
};

const getValidStatus = (status) => {
    if (
        status === REPORT_STATUSES.reported ||
        status === REPORT_STATUSES.submitted ||
        status === REPORT_STATUSES.fixed
    ) {
        return status;
    }

    return REPORT_STATUSES.reported;
};

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

    const statusStyles = useMemo(
        () => ({
            [REPORT_STATUSES.reported]: {
                label: 'Do zgłoszenia',
                color: '#D64545',
            },
            [REPORT_STATUSES.submitted]: {
                label: 'Przekazane',
                color: '#E68A00',
            },
            [REPORT_STATUSES.fixed]: {
                label: 'Naprawione',
                color: '#2E9B57',
            },
        }),
        []
    );

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

    const handleStatusChange = async (id, nextStatus) => {
        if (!isAdmin) return;

        try {
            await updateDoc(doc(db, 'reports', id), {
                status: getValidStatus(nextStatus),
            });
        } catch (e) {
            console.log('Error updating report status:', e);
            Alert.alert('Błąd', 'Nie udało się zaktualizować statusu zgłoszenia.');
        }
    };

    const renderItem = ({ item }) => {
        const reportTypeLabel = getReportTypeLabel(item.type);
        const status = getValidStatus(item.status);
        const statusConfig = statusStyles[status];

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
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        Status: {statusConfig.label}
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

                    {isAdmin && (
                        <View style={styles.statusButtonsRow}>
                            <TouchableOpacity
                                onPress={() =>
                                    handleStatusChange(item.id, REPORT_STATUSES.reported)
                                }
                                style={[
                                    styles.statusButton,
                                    { borderColor: '#D64545', backgroundColor: colors.cardBackground },
                                ]}
                            >
                                <Text style={[styles.statusButtonText, { color: '#D64545' }]}>Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() =>
                                    handleStatusChange(item.id, REPORT_STATUSES.submitted)
                                }
                                style={[
                                    styles.statusButton,
                                    { borderColor: '#E68A00', backgroundColor: colors.cardBackground },
                                ]}
                            >
                                <Text style={[styles.statusButtonText, { color: '#E68A00' }]}>Zgłoszone</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() =>
                                    handleStatusChange(item.id, REPORT_STATUSES.fixed)
                                }
                                style={[
                                    styles.statusButton,
                                    { borderColor: '#2E9B57', backgroundColor: colors.cardBackground },
                                ]}
                            >
                                <Text style={[styles.statusButtonText, { color: '#2E9B57' }]}>Naprawione</Text>
                            </TouchableOpacity>
                        </View>
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
    statusText: {
        marginTop: 4,
        fontSize: 13,
        fontWeight: '700',
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
    statusButtonsRow: {
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 8,
    },
    statusButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    statusButtonText: {
        fontSize: 12,
        fontWeight: '700',
    },
});

export default ReportsScreen;