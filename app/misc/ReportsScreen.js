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
import ReportModal from '../calculator_content/truckLoading/ReportModal';

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

const getInitials = (value) => {
    if (!value) return 'G';

    const parts = String(value).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'G';

    return parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'G';
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
    const [activeTab, setActiveTab] = useState('all');
    const [reportVisible, setReportVisible] = useState(false);
    const [reportTruckNumber, setReportTruckNumber] = useState('');
    const [editingReport, setEditingReport] = useState(null);

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
        const searchedReports = queryText
            ? reports.filter((item) => {
                const truckStr = String(item.truckNumber || '').toLowerCase();
                const typeStr = getReportTypeLabel(item.type).toLowerCase();
                const descStr = String(item.description || '').toLowerCase();
                const reporterNameStr = String(item.reporterName || '').toLowerCase();

                return (
                    truckStr.includes(queryText) ||
                    typeStr.includes(queryText) ||
                    descStr.includes(queryText) ||
                    reporterNameStr.includes(queryText)
                );
            })
            : reports;

        if (activeTab === 'mine' && !queryText) {
            return searchedReports.filter((item) => item.reporterId === user?.id);
        }

        return searchedReports;
    }, [reports, search, activeTab, user?.id]);

    const openReport = () => {
        setEditingReport(null);
        setReportTruckNumber(search.trim());
        setReportVisible(true);
    };

    const openEditReport = (report) => {
        setEditingReport(report);
        setReportTruckNumber(report.truckNumber || '');
        setReportVisible(true);
    };

    const closeReport = () => {
        setEditingReport(null);
        setReportVisible(false);
    };

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

        const reporterName = item.reporterName || 'Gość';
        const reporterInitials = item.reporterInitials || getInitials(reporterName);
        const canEdit = !!user?.id && item.reporterId === user.id;

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
<View style={styles.reporterRow}>
                        <View style={[styles.avatar, { backgroundColor: colors.butBackground }]}> 
                            <Text style={[styles.avatarText, { color: colors.butText }]}>{reporterInitials}</Text>
                        </View>
                        <Text style={[styles.reporterText, { color: colors.textSecondary }]}> 
                            Zgłoszono przez: {reporterName}
                        </Text>
                    </View>

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

                <View style={styles.actionButtonsRow}>
                    {canEdit && (
                        <TouchableOpacity
                            onPress={() => openEditReport(item)}
                            style={[
                                styles.editButton,
                                { borderColor: colors.border, backgroundColor: colors.cardBackground },
                            ]}
                        >
                            <Text style={[styles.deleteText, { color: colors.textSecondary }]}>✎</Text>
                        </TouchableOpacity>
                    )}

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
            <ReportModal
                visible={reportVisible}
                onClose={closeReport}
                initialTruckNumber={reportTruckNumber}
                editMode={!!editingReport}
                reportId={editingReport?.id || null}
                initialData={editingReport}
            />
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
                    <View style={styles.headerContent}>
                        <View style={styles.tabsRow}>
                            <TouchableOpacity
                                onPress={() => setActiveTab('all')}
                                style={[
                                    styles.tabButton,
                                    activeTab === 'all' && {
                                        backgroundColor: colors.butBackground,
                                        borderColor: colors.butBorder,
                                    },
                                    { borderColor: colors.border },
                                ]}
                            >
                                <Text style={[
                                    styles.tabText,
                                    { color: activeTab === 'all' ? colors.butText : colors.textSecondary },
                                ]}>
                                    Wszystkie zgłoszenia
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setActiveTab('mine')}
                                style={[
                                    styles.tabButton,
                                    activeTab === 'mine' && {
                                        backgroundColor: colors.butBackground,
                                        borderColor: colors.butBorder,
                                    },
                                    { borderColor: colors.border },
                                ]}
                            >
                                <Text style={[
                                    styles.tabText,
                                    { color: activeTab === 'mine' ? colors.butText : colors.textSecondary },
                                ]}>
                                    Twoje zgłoszenia
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.headerActions}>
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

                            <TouchableOpacity
                                onPress={openReport}
                                style={[
                                    styles.reportButton,
                                    {
                                        backgroundColor: colors.butBackground,
                                        borderColor: colors.butBorder,
                                    },
                                ]}
                            >
                                <Text style={[styles.reportButtonText, { color: colors.butText }]}>Zgłoś</Text>
                            </TouchableOpacity>
                        </View>
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
    headerContent: {
        marginBottom: 12,
    },
    tabsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    tabButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 8,
        alignItems: 'center',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchWrapper: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    searchInput: {
        fontSize: 14,
    },
    reportButton: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    reportButtonText: {
        fontSize: 13,
        fontWeight: '600',
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
    reporterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 8,
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 11,
        fontWeight: '700',
    },
    reporterText: {
        fontSize: 12,
        flexShrink: 1,
    },
    timestamp: {
        marginTop: 6,
        fontSize: 11,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    editButton: {
        borderWidth: 1,
        borderRadius: 50,
        paddingHorizontal: 8,
        paddingVertical: 6,
        alignSelf: 'flex-start',
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