// calculator_content/shared/TruckWorkingLayout.jsx
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SessionDetailsModal from '../../modals/SessionDetailsModal';
import EditTruckModal from '../truckLoading/EditTruckModal';
import NewTransportModal from '../truckLoading/NewTransportModal';
import ReportModal from '../truckLoading/ReportModal';
import AdjustTimeModal from './AdjustTimeModal';
import PauseModal from './PauseModal';
import SessionActionBar from './SessionActionBar';
import SessionXPHeader from './SessionXPHeader';
import { useTruckLogic } from './useTruckLogic';

export default function TruckWorkingLayout(props) {
    const {
        // context & colors
        calc,
        colors,

        // computed values
        startTime,
        trucks,
        trucksHistory,
        palletsLoaded,
        palletsRate,
        trucksLoadedCount,
        isPaused,
        levelData,
        xpForNextLevel,
        levelProgress,
        sessionTime,
        forcedFinishTime,
        setForcedFinishTime,
        palletsRateGoal,
        palletsNeeded,
        palletsLeft,
        isOverGoal,
        goalReachedUntilSeconds,
        palletsInputRef,
        setEditingTruck,
        editingTruck,
        changeMode,

        // UI state
        showPauseModal,
        setShowPauseModal,
        showNewTransportModal,
        setShowNewTransportModal,
        showAdjustFinishTimeModal,
        setShowAdjustFinishTimeModal,
        showPalletsModal,
        setShowPalletsModal,
        palletsInput,
        setPalletsInput,
        pendingTruckId,
        setPendingTruckId,
        expandedTruckId,
        setExpandedTruckId,

        // XP / notification
        currentXPPerMin,
        sessionXPEarned,
        showXPFloatingText,
        floatingXPAmount,
        leveledUpMessage,
        notificationState,
        setNotificationState,
        floatingAnim,

        // handlers
        addTruck,
        handleSaveEdit,
        handleSaveEditHistory,
        handleTruckDone,
        handleRemoveTruck,
        handlePauseConfirm,
        handleResume,
        handleConfirmPallets,
        formatElapsed,
        formatTruckTime,

        // extras you use in JSX
        profile,
        isWeb,
    } = useTruckLogic(props);

    const [reportVisible, setReportVisible] = useState(false);
    const [reportTruckNumber, setReportTruckNumber] = useState('');
    const [reportModalKey, setReportModalKey] = useState(0);
    const openReportTimerRef = useRef(null);
    const insets = useSafeAreaInsets();

    const showSessionInfoModal = Boolean(calc.showSessionInfoModal);
    const setShowSessionInfoModal = (visible) =>
        calc.updateState({ showSessionInfoModal: visible }, { persist: false });

    // Helpers for palletsRate highlight
    const getPalletsRateColor = (value) => {
        if (value < 38) return '#F44336';     // red
        if (value <= 48) return '#FF9800';    // orange
        return '#4CAF50';                     // green
    };

    const [animatedRate, setAnimatedRate] = useState(palletsRate);
    const [rateColor, setRateColor] = useState(
        getPalletsRateColor(Number(palletsRate) || 0)
    );

    // Keep highlighted palletsRate fresh while modal is open
    useEffect(() => {
        const value = Number(palletsRate) || 0;
        setAnimatedRate(palletsRate);
        setRateColor(getPalletsRateColor(value));
    }, [palletsRate]);

    useEffect(() => {
        return () => {
            if (openReportTimerRef.current) {
                clearTimeout(openReportTimerRef.current);
            }
        };
    }, []);

    const openReport = (truck) => {
        const nextTruckNumber = String(truck.trailer || '');
        setReportTruckNumber(nextTruckNumber);

        if (openReportTimerRef.current) {
            clearTimeout(openReportTimerRef.current);
        }

        if (reportVisible) {
            setReportVisible(false);
            setReportModalKey((value) => value + 1);

            openReportTimerRef.current = setTimeout(() => {
                setReportVisible(true);
                openReportTimerRef.current = null;
            }, 160);
            return;
        }

        setReportVisible(true);
    };

    const closeReport = () => {
        if (openReportTimerRef.current) {
            clearTimeout(openReportTimerRef.current);
            openReportTimerRef.current = null;
        }
        setReportModalKey((value) => value + 1);
        setReportVisible(false);
    };

    // Session details stats shown in the modal
    const sessionStats = [
        {
            label: 'Czas ładowania',
            value: sessionTime ? formatElapsed(sessionTime) : '00:00:00',
        },
        {
            label: 'Palety załadowane',
            value: palletsLoaded,
        },
        {
            label: 'Dostawy ukończone',
            value: trucksLoadedCount,
        },
        {
            label: 'Planowany koniec',
            value: forcedFinishTime
                ? new Date(forcedFinishTime).toLocaleTimeString()
                : 'Brak',
        },
        {
            label: 'Twój cel',
            value: `${palletsRateGoal} pal./godz`,
        },
        {
            label: 'Ilość palet do załadowania',
            value: palletsNeeded,
        },
        {
            label: 'Pozostało palet do celu',
            value: palletsLeft,
        },
        ...(isOverGoal && goalReachedUntilSeconds !== null
            ? [{
                label: 'Poniżej celu za',
                value: formatElapsed(goalReachedUntilSeconds),
            }]
            : []),
    ];

    const handleFinishSession = () => {
        const now = Date.now();
        // write endTime + mode directly into context
        calc.updateState({
            endTime: now,
            mode: 'results',
        });
    };
    // ============================================================================
    // SECTION 5: RENDER FUNCTIONS (AFTER ALL HOOKS & HELPER FUNCTIONS)
    // ============================================================================

    const allTrucks = [
        ...trucks.map((truck) => ({ ...truck, isHistory: false })),
        ...trucksHistory.map((truck) => ({ ...truck, isHistory: true })),
    ].sort((a, b) => {
        if (a.isHistory !== b.isHistory) return a.isHistory ? 1 : -1;
        return Number(b.displayId || 0) - Number(a.displayId || 0);
    });

    const renderScene = () => (
        <View style={[styles.trucksList, { backgroundColor: colors.tListBackground }]}>
            <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tableHeaderText, styles.columnId, { color: colors.textSecondary }]}>ID</Text>
                <Text style={[styles.tableHeaderText, styles.columnPallets, { color: colors.textSecondary }]}>PALETY</Text>
                <Text style={[styles.tableHeaderText, styles.columnShop, { color: colors.textSecondary }]}>SKLEP</Text>
                <Text style={[styles.tableHeaderText, styles.columnTrailer, { color: colors.textSecondary }]}>NACZEPA</Text>
                <Text style={[styles.tableHeaderText, styles.columnGate, { color: colors.textSecondary }]}>BRAMA</Text>
            </View>

            {allTrucks.length === 0 ? (
                <View style={styles.emptyList}>
                    <MaterialCommunityIcons name="truck-outline" size={40} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.text }]}>Dodaj pierwszy transport.</Text>
                </View>
            ) : allTrucks.map((truck) => renderTruckItem(truck, truck.isHistory))}
        </View>
    );

    const renderTruckItem = (truck, isHistory = false) => {
        const isExpanded = expandedTruckId === truck.id;
        const elapsedTime = truck.elapsedLoadingTime || 0;
        const statusColor = isHistory ? (colors.success || '#10b981') : (colors.butBackground || '#3b82f6');
        const shopLabel = [truck.shop, truck.secondShop].filter(Boolean).join(', ') || '—';

        const confirmRemoveTruck = (truckToRemove) => {
            Alert.alert(
                'Usuń transport?',
                `Czy na pewno chcesz usunąć transport #${truckToRemove.displayId || '—'}? Tej czynności nie można cofnąć.`,
                [
                    { text: 'Anuluj', style: 'cancel' },
                    {
                        text: 'Usuń',
                        style: 'destructive',
                        onPress: () => handleRemoveTruck(truckToRemove.id),
                    },
                ],
            );
        };

        return (
            <View key={truck.id} style={styles.tableItemWrapper}>
                <TouchableOpacity
                    onPress={() => setExpandedTruckId(isExpanded ? null : truck.id)}
                    activeOpacity={0.82}
                    style={[
                        styles.tableRow,
                        {
                            backgroundColor: isHistory ? `${statusColor}10` : colors.cardBackground,
                            borderColor: isHistory ? `${statusColor}70` : colors.border,
                            borderLeftColor: statusColor,
                        },
                    ]}
                >
                    <View style={[styles.tableCell, styles.columnId]}>
                        <TouchableOpacity
                            accessibilityLabel={isHistory ? 'Transport ukończony' : 'Oznacz transport jako ukończony'}
                            accessibilityHint={isHistory ? undefined : 'Otwiera potwierdzenie zakończenia transportu'}
                            disabled={isHistory}
                            onPress={() => handleTruckDone(truck.id)}
                            style={[styles.statusButton, { backgroundColor: `${statusColor}18` }]}
                        >
                            <Ionicons
                                name={isHistory ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                size={19}
                                color={statusColor}
                            />
                        </TouchableOpacity>
                        <Text numberOfLines={1} style={[styles.tableValue, { color: colors.text }]}>#{truck.displayId || '—'}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.tableValue, styles.columnPallets, { color: colors.text }]}>
                        {truck.palletsInProgress ? '—' : (truck.pallets || '—')}
                    </Text>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.tableValue, styles.columnShop, { color: colors.text }]}>{shopLabel}</Text>
                    <Text numberOfLines={1} style={[styles.tableValue, styles.columnTrailer, { color: colors.text }]}>{truck.trailer || '—'}</Text>
                    <View style={[styles.tableCell, styles.columnGate]}>
                        <Text numberOfLines={1} style={[styles.tableValue, { color: colors.text }]}>{truck.gate || '—'}</Text>
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textSecondary} />
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={[styles.expandedDetails, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}>
                        <View style={styles.expandedHeader}>
                            <View>
                                <Text style={[styles.expandedStatus, { color: statusColor }]}>{isHistory ? 'Ukończony transport' : 'Aktywny transport'}</Text>
                                <Text style={[styles.expandedTime, { color: colors.textSecondary }]}>Czas ładowania: {formatElapsed(elapsedTime)}</Text>
                            </View>
                            <View style={styles.expandedActions}>
                                <TouchableOpacity
                                    accessibilityLabel="Zgłoś problem"
                                    onPress={() => openReport(truck)}
                                    style={[styles.actionButton, { borderColor: colors.border }]}
                                >
                                    <MaterialIcons name="report-problem" size={19} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    accessibilityLabel="Edytuj transport"
                                    onPress={() => setEditingTruck(truck)}
                                    style={[styles.actionButton, { borderColor: colors.border }]}
                                >
                                    <MaterialCommunityIcons name="pencil-outline" size={19} color={colors.text} />
                                </TouchableOpacity>
                                {!isHistory && (
                                    <TouchableOpacity
                                        accessibilityLabel="Oznacz jako ukończony"
                                        onPress={() => handleTruckDone(truck.id)}
                                        style={[styles.actionButton, { borderColor: `${statusColor}80`, backgroundColor: `${statusColor}18` }]}
                                    >
                                        <MaterialCommunityIcons name="check" size={20} color={statusColor} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    accessibilityLabel="Usuń transport"
                                    onPress={() => confirmRemoveTruck(truck)}
                                    style={[styles.actionButton, { borderColor: `${colors.error || '#ef4444'}70` }]}
                                >
                                    <MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.error || '#ef4444'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    // ============================================================================
    // SECTION 6: MAIN RENDER
    // ============================================================================

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ReportModal
                key={reportModalKey}
                visible={reportVisible}
                onClose={closeReport}
                initialTruckNumber={reportTruckNumber}
            />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <SessionXPHeader
                    colors={colors}
                    profile={profile}
                    levelData={levelData}
                    xpForNextLevel={xpForNextLevel}
                    levelProgress={levelProgress}
                    leveledUpMessage={leveledUpMessage}
                    showXPFloatingText={showXPFloatingText}
                    floatingAnim={floatingAnim}
                    floatingXPAmount={floatingXPAmount}
                    notificationState={notificationState}
                    setNotificationState={setNotificationState}
                    showProgressCard={false}
                />

                {/* <View style={[styles.statsSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={styles.statsHeader}>
                        <View>
                            <Text style={[styles.gridTitle, { color: colors.text }]}>
                                Sesja aktywna
                            </Text>
                            <Text style={[styles.gridSubtitle, { color: colors.textSecondary }]}>
                                Twoje statystyki bieżącej sesji.
                            </Text>
                        </View>
                        <View>
                            <TouchableOpacity
                                style={styles.infoButton}
                                onPress={() => setShowSessionInfoModal(true)}
                            >
                                <Ionicons name="information-circle-outline" size={26} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.statsGrid}>

                        <View style={[styles.gridCardWide, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}>
                            <Ionicons name="flash-outline" size={28}
                                style={[
                                    styles.cardIcon,
                                    { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                                ]}
                            />
                            <Text style={[styles.gridCardTitle, { color: colors.cardTitle }]}>
                                Średnia aktualna
                            </Text>
                            <Text style={[styles.gridCardValue, { color: colors.cardValue, fontSize: 32, fontWeight: '600' }]}>
                                {palletsRate}
                            </Text>
                        </View>

                        <Pressable
                            onPress={() => setAreSessionDetailsVisible(prev => !prev)}
                            style={({ pressed }) => [
                                styles.expandButton,
                                {
                                    backgroundColor: colors.cardInCardBackground,
                                    borderColor: colors.border,
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            <View style={styles.expandButtonContent}>
                                <Text style={[styles.expandButtonText, { color: colors.cardTitle }]}>
                                    {areSessionDetailsVisible ? 'Ukryj szczegóły sesji' : 'Pokaż szczegóły sesji'}
                                </Text>

                                <Ionicons
                                    name={areSessionDetailsVisible ? 'chevron-up' : 'chevron-down'}
                                    size={20}
                                    color={colors.grayIconColor}
                                />
                            </View>
                        </Pressable>

                        <Animated.View
                            pointerEvents={areSessionDetailsVisible ? 'auto' : 'none'}
                            style={[
                                styles.expandableContent,
                                                        !areSessionDetailsVisible && styles.expandableContentHidden,
                            ]}
                        >
                            <View style={styles.statsGridHidden}>

                                <View
                                    style={[
                                        styles.gridCard,
                                        {
                                            backgroundColor: colors.cardInCardBackground,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    <View style={styles.gridCardContent}>
                                        <Ionicons
                                            name="time-outline"
                                            size={24}
                                            style={[
                                                styles.cardIcon,
                                                { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                                            ]}
                                        />
                                        <Text style={[styles.gridCardTitle, { color: colors.cardTitle }]}>
                                            Czas
                                        </Text>
                                        <Text style={[styles.gridCardValue, { color: colors.cardValue, fontSize: 24 }]}>
                                            {sessionTime ? formatElapsed(sessionTime) : '00:00:00'}
                                        </Text>
                                    </View>
                                </View>

                                <View
                                    style={[
                                        styles.gridCard,
                                        {
                                            backgroundColor: colors.cardInCardBackground,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    <View style={styles.gridCardContent}>
                                        <Ionicons
                                            name="layers-outline"
                                            size={28}
                                            style={[
                                                styles.cardIcon,
                                                { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                                            ]}
                                        />
                                        <Text style={[styles.gridCardTitle, { color: colors.cardTitle }]}>
                                            Palety
                                        </Text>
                                        <Text style={[styles.gridCardValue, { color: colors.cardValue, fontSize: 24 }]}>
                                            {palletsLoaded}
                                        </Text>
                                    </View>
                                </View>

                                <View
                                    style={[
                                        styles.gridCard,
                                        {
                                            backgroundColor: colors.cardInCardBackground,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                >
                                    <View style={styles.gridCardContent}>
                                        <MaterialCommunityIcons
                                            name="truck-check-outline"
                                            size={28}
                                            style={[
                                                styles.cardIcon,
                                                { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                                            ]}
                                        />
                                        <Text style={[styles.gridCardTitle, { color: colors.cardTitle }]}>
                                            Dostawy
                                        </Text>
                                        <Text style={[styles.gridCardValue, { color: colors.cardValue, fontSize: 24 }]}>
                                            {trucksLoadedCount}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[
                                        styles.gridCard,
                                        {
                                            backgroundColor: colors.cardInCardBackground,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    onPress={() => setShowAdjustFinishTimeModal(true)}
                                >
                                    <View style={styles.gridCardContent}>
                                        <MaterialIcons
                                            name="alarm-off"
                                            size={28}
                                            style={[
                                                styles.cardIcon,
                                                { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                                            ]}
                                        />
                                        <Text style={[styles.gridCardTitle, { color: colors.cardTitle }]}>
                                            Koniec
                                        </Text>
                                        <Text style={[styles.gridCardValue, { color: colors.cardValue, fontSize: 24 }]}>
                                            {forcedFinishTime
                                                ? new Date(forcedFinishTime).toLocaleTimeString()
                                                : 'Brak'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </View>
                </View> */}

                {/* Trucks section */}
                <View style={[styles.infoContainer, { backgroundColor: colors.cardBackground }]}>
                    <View style={styles.tabHeader}>
                        <View style={styles.listTitleBlock}>
                            <Text style={[styles.gridTitle, { color: colors.text, paddingTop: 16 }]}>Transporty</Text>
                            <Text style={[styles.gridSubtitle, { color: colors.textSecondary }]}>
                                {trucks.length} aktywne · {trucksHistory.length} ukończone · {allTrucks.length} wszystkie
                            </Text>
                            <TouchableOpacity onPress={() => setShowSessionInfoModal(true)}>
                                <Text style={[styles.sessionDetailsLink, { color: colors.outButText }]}>ⓘ Szczegóły sesji</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            accessibilityLabel="Dodaj transport"
                            style={[styles.btnOutline, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]}
                            onPress={() => setShowNewTransportModal(true)}
                        >
                            <Ionicons name="add-outline" size={24} color={colors.outButText} />
                        </TouchableOpacity>
                    </View>

                    {renderScene()}
                </View>
            </ScrollView>
            <SessionActionBar
                isPaused={isPaused}
                onResume={handleResume}
                onPause={() => setShowPauseModal(true)}
                onFinish={handleFinishSession}
                colors={colors}
                bottomInset={insets.bottom}
                finishConfirmTitle="Zakończ Sesję"
                finishConfirmMessage="Czy na pewno chcesz zakończyć tę sesję obliczeniową?"
            />

            {/* Modals */}
            {/* Pallets in progress → ask for final number */}
            <Modal
                visible={showPalletsModal}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setShowPalletsModal(false);
                    setPendingTruckId(null);
                }}
            >
                <View style={styles.palletsModalBackdrop}>
                    <View style={[styles.palletsModalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.palletsModalTitle, { color: colors.text }]}>
                            Podaj liczbę palet!
                        </Text>

                        <Text style={[styles.palletsModalSubtitle, { color: colors.textSecondary }]}>
                            Skończyłeś ładować ten transport, ale nie podałeś liczby palet. Wpisz liczbę palet (np. 12.75) i zatwierdź, aby zakończyć transport.
                        </Text>

                        <TextInput
                            ref={palletsInputRef}
                            style={[
                                styles.palletsInput,
                                { borderColor: colors.border, color: colors.text }
                            ]}
                            value={palletsInput}
                            onChangeText={setPalletsInput}
                            keyboardType="decimal-pad"
                            placeholder="Np. 12.75"
                            placeholderTextColor={colors.textSecondary}
                        />

                        <View style={styles.palletsButtonsRow}>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowPalletsModal(false);
                                    setPendingTruckId(null);
                                    setPalletsInput("");
                                }}
                                style={[
                                    styles.btnOutline,
                                    {
                                        borderColor: colors.outButBorder,
                                        backgroundColor: colors.outButBackground
                                    }
                                ]}
                            >
                                <Text style={[styles.btnOutlineText, { color: colors.outButText }]}>
                                    Anuluj
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleConfirmPallets}
                                style={[styles.btnPrimary, { backgroundColor: colors.butBackground }]}
                            >
                                <Text style={[styles.btnPrimaryText, { color: colors.butText }]}>
                                    OK
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Session details modal */}
            <SessionDetailsModal
                visible={showSessionInfoModal}
                onClose={() => setShowSessionInfoModal(false)}
                colors={colors}
                rateColor={rateColor}
                animatedRate={animatedRate}
                sessionStats={sessionStats}
            />

            <NewTransportModal
                visible={showNewTransportModal}
                onClose={() => setShowNewTransportModal(false)}
                onAdd={addTruck}
            />

            <EditTruckModal
                visible={!!editingTruck}
                truck={editingTruck}
                onClose={() => setEditingTruck(null)}
                onSave={trucksHistory.some((truck) => truck.id === editingTruck?.id) ? handleSaveEditHistory : handleSaveEdit}
            />

            <PauseModal
                visible={showPauseModal}
                onClose={() => setShowPauseModal(false)}
                onConfirm={handlePauseConfirm}
            />

            <AdjustTimeModal
                visible={showAdjustFinishTimeModal}
                onClose={() => setShowAdjustFinishTimeModal(false)}
                onConfirm={(newForcedFinishTime) => {
                    setForcedFinishTime(newForcedFinishTime);
                    setShowAdjustFinishTimeModal(false);
                }}
                initialTime={forcedFinishTime}
                type="finish"
                startTime={startTime}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 16,
        flex: 1,
        justifyContent: 'space-between',
    },
    scrollContent: {
        flexGrow: 1,
    },
    levelCard: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 24,
        marginVertical: 16,
        borderRadius: 16,
        gap: 32,
        borderWidth: 1,
        elevation: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    levelTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    progressContainer: {
        flex: 1,
    },
    progressBar: {
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
    },
    progressFill: {
        height: 10,
        borderRadius: 5,
    },
    progressText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 5,
    },
    floatingXPText: {
        position: 'absolute',
        top: 200,
        alignSelf: 'center',
        zIndex: 1000,
    },
    floatingXPValue: {
        fontSize: 24,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    levelUpBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 21,
        marginHorizontal: 24,
        marginVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        gap: 10,
    },
    levelUpText: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    statsSection: {
        marginBottom: 16,
        marginHorizontal: 24,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        paddingHorizontal: 16,
    },
    statsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    gridCardWide: {
        width: '100%',
        padding: 16,
        marginBottom: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    gridCardTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 2,
        marginTop: 2,
    },
    gridCardValue: {
        fontSize: 22,
        fontWeight: '800',
    },
    expandButton: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginTop: 0,
        marginBottom: 12,
    },
    expandButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    expandButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    expandableContent: {
        width: '100%',
        overflow: 'hidden',
        marginTop: 8,
    },
    expandableContentHidden: {
        height: 0,
        opacity: 0,
        marginTop: 0,
    },
    gridCard: {
        width: '48%',
        aspectRatio: 1,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    gridCardContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    statsGridHidden: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
    },
    autoFinishNotice: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginTop: 4,
    },
    autoFinishNoticeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    infoContainer: {
        flexGrow: 1,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 16,
        paddingBottom: 16,
        marginBottom: 16,
        marginHorizontal: 24,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    tabHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    gridTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    gridSubtitle: {
        fontSize: 15,
        paddingBottom: 12,
    },
    tabDots: {
        flexDirection: 'row',
        alignSelf: 'center',
        gap: 8,
        transform: [{ translateY: 0 }],
    },
    tabDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ccc',
    },
    btnOutline: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        padding: 12,
        borderRadius: 12,
        gap: 6,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    btnOutlineText: {
        fontSize: 17,
        fontWeight: '800',
    },
    infoButton: {
        paddingVertical: 6,
    },
    iconButton: {
        padding: 6,
        borderWidth: 2,
        borderRadius: 8,
    },
    emptyText: {
        textAlign: 'center',
        color: '#666',
        fontSize: 14,
        paddingVertical: 40,
    },
    buttonsContainer: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        paddingTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderTopWidth: 1,
    },
    btnPrimary: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 6,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    btnPrimaryText: {
        fontSize: 15,
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    resumeButtonContainer: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        paddingTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderTopWidth: 1,
    },
    btnResume: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 6,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    btnResumeText: {
        fontSize: 15,
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    // Truck List Section
    trucksList: {
        paddingTop: 4,
        borderWidth: 0,
        borderRadius: 12,
    },
    trucksListContent: {
        paddingTop: 4,
        paddingBottom: 8,
    },
    listTitleBlock: {
        flex: 1,
        paddingRight: 12,
    },
    sessionDetailsLink: {
        fontSize: 13,
        fontWeight: '700',
        paddingBottom: 12,
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 28,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        marginBottom: 6,
    },
    tableHeaderText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    tableItemWrapper: {
        marginBottom: 7,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 58,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderRadius: 10,
    },
    tableCell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    statusButton: {
        width: 27,
        height: 27,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tableValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    columnId: {
        width: '19%',
    },
    columnPallets: {
        width: '17%',
    },
    columnShop: {
        width: '31%',
        paddingRight: 5,
    },
    columnTrailer: {
        width: '18%',
        paddingRight: 4,
    },
    columnGate: {
        width: '15%',
        justifyContent: 'space-between',
    },
    emptyList: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    expandedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    expandedStatus: {
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 3,
    },
    expandedTime: {
        fontSize: 12,
    },
    expandedActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionButton: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 8,
    },
    detailGrid: {
        marginTop: 14,
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 8,
    },
    truckItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 0,
        marginBottom: 8,
    },
    truckId: {
        fontWeight: '700',
        fontSize: 15,
        letterSpacing: 0.5,
    },
    truckIdSection: {
        width: 'auto',
        minWidth: 60,
        alignItems: 'center',
        justifyContent: 'center',
        paddingRight: 8,
        paddingHorizontal: 10,
        flexDirection: 'row',
        gap: 2,
        height: 50,
        borderRadius: 10,
        marginRight: 4,
    },
    truckInfoSection: {
        flex: 1,
        marginHorizontal: 8,
    },
    compactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        gap: 8,
    },
    compactField: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    fieldValue: {
        fontSize: 14,
        fontWeight: '600',
    },

    timeValue: {
        fontSize: 13,
        fontWeight: 'bold',
    },

    expandIcon: {
        padding: 4,
        marginLeft: 4,
    },

    expandedDetails: {
        marginTop: 12,
        paddingLeft: 12,
        paddingRight: 8,
        paddingBottom: 12,
        marginBottom: 8,
        gap: 10,
        borderBottomWidth: 1,
    },

    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 0,
    },

    detailLabel: {
        fontSize: 12,
        fontWeight: '700',
        flex: 0.4,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },

    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        flex: 0.6,
        textAlign: 'right',
    },

    truckActionsRight: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        paddingLeft: 8,
    },
    palletsModalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
    },
    palletsModalContent: {
        width: "100%",
        maxWidth: 360,
        borderRadius: 16,
        padding: 20,
    },
    palletsModalTitle: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
    },
    palletsModalSubtitle: {
        fontSize: 13,
        marginBottom: 12,
    },
    palletsInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 16,
        marginBottom: 16,
    },
    palletsButtonsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 8,
    },
    truckHeaderSection: {
        flex: 1,
        minWidth: 110,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 0,
        borderRadius: 8,
    },

    truckHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    sessionInfoBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 24,
    },
    sessionInfoContentWrapper: {
        width: '100%',
        maxWidth: 420,
        alignItems: 'center',
    },
    sessionInfoContainer: {
        width: '100%',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
    },
    sessionInfoTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
        textAlign: 'center',
    },
    sessionInfoDescription: {
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    palletsRateHighlightContainer: {
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 24,
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 18,
        borderRadius: 20,
        borderWidth: 1,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
    },
    palletsRateGlowLayer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    palletsRateGlowOrb: {
        position: 'absolute',
        borderRadius: 999,
        opacity: 0.9,
        filter: 'blur(12px)',
    },
    palletsRateHighlightLabel: {
        fontSize: 14,
        marginBottom: 8,
        zIndex: 1,
    },
    palletsRateHighlightValue: {
        fontSize: 56,
        fontWeight: '800',
        textAlign: 'center',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 16,
        zIndex: 1,
    },
    sessionStatRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    sessionStatLabel: {
        fontSize: 14,
    },
    sessionStatValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    sessionInfoCloseButton: {
        marginTop: 24,
        alignSelf: 'center',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
    },
    sessionInfoCloseText: {
        fontSize: 16,
        fontWeight: '600',
    },
});