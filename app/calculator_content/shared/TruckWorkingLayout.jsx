// calculator_content/shared/TruckWorkingLayout.jsx
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Modal,
    Pressable,
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
    const [showTimeLeft, setShowTimeLeft] = useState(false);
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

    const [xpRewardAmount, setXpRewardAmount] = useState(0);
    const [xpRewardPosition, setXpRewardPosition] = useState(null);
    const xpStatRef = useRef(null);
    const xpRewardAnimation = useRef(new Animated.Value(0)).current;
    const previousSessionXPRef = useRef(Number(sessionXPEarned) || 0);

    useEffect(() => {
        const previousXP = previousSessionXPRef.current;
        const nextXP = Number(sessionXPEarned) || 0;
        previousSessionXPRef.current = nextXP;

        if (nextXP <= previousXP || !xpStatRef.current?.measureInWindow) return undefined;

        let cancelled = false;
        let animation;

        xpStatRef.current.measureInWindow((x, y, width) => {
            if (cancelled || !width) return;

            setXpRewardPosition({ left: x, top: y, width });
            setXpRewardAmount(nextXP - previousXP);
            xpRewardAnimation.stopAnimation();
            xpRewardAnimation.setValue(0);

            animation = Animated.timing(xpRewardAnimation, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            });

            animation.start(({ finished }) => {
                if (finished) setXpRewardAmount(0);
            });
        });

        return () => {
            cancelled = true;
            animation?.stop();
        };
    }, [sessionXPEarned, xpRewardAnimation]);

    // Keep highlighted palletsRate fresh while modal is open
    useEffect(() => {
        const value = Number(palletsRate) || 0;
        setAnimatedRate(palletsRate);
        setRateColor(getPalletsRateColor(value));
    }, [palletsRate]);

    const sessionDuration = startTime && forcedFinishTime
        ? Math.max(0, Math.floor((forcedFinishTime - startTime) / 1000))
        : 0;
    const elapsedSessionTime = Math.max(0, Number(sessionTime) || 0);
    const sessionProgress = sessionDuration > 0
        ? Math.min(1, elapsedSessionTime / sessionDuration)
        : 0;
    const sessionTimeLeft = Math.max(0, sessionDuration - elapsedSessionTime);
    const hasSessionDeadline = sessionDuration > 0;

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

    const truckStats = [
        {
            icon: <Ionicons name="speedometer" color={colors.iconColor} size={24} />,
            value: palletsRate,
            onPress: () => setShowSessionInfoModal(true),
        },
        {
            icon: <MaterialCommunityIcons name="shipping-pallet" color={colors.iconColor} size={24} />,
            value: palletsLoaded,
            onPress: () => setShowSessionInfoModal(true),
        },
        {
            icon: <Text style={{ color: colors.iconColor, fontWeight: '700', fontSize: 18 }}>XP</Text>,
            value: sessionXPEarned,
            isXpStat: true,
        },
        {
            icon: <MaterialCommunityIcons name="flag-checkered" color={colors.iconColor} size={24} />,
            value: forcedFinishTime
                ? new Date(forcedFinishTime).toLocaleTimeString('pl-PL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                })
                : '—',
            onPress: () => setShowAdjustFinishTimeModal(true),
        },
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
            <Modal
                visible={Boolean(xpRewardAmount && xpRewardPosition)}
                transparent
                animationType="none"
                statusBarTranslucent
                onRequestClose={() => {}}
            >
                <View style={styles.xpRewardPortal} pointerEvents="none">
                    <Animated.View
                        style={[
                            styles.xpRewardPortalItem,
                            {
                                left: xpRewardPosition?.left || 0,
                                top: Math.max(8, (xpRewardPosition?.top || 0) + 32),
                                width: xpRewardPosition?.width || 0,
                                opacity: xpRewardAnimation.interpolate({
                                    inputRange: [0, 0.15, 1],
                                    outputRange: [0, 1, 0],
                                }),
                                transform: [
                                    {
                                        translateY: xpRewardAnimation.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [6, -28],
                                        }),
                                    },
                                    {
                                        scale: xpRewardAnimation.interpolate({
                                            inputRange: [0, 0.2, 1],
                                            outputRange: [0.9, 1.05, 1],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <Text style={styles.xpRewardText}>+{xpRewardAmount} XP</Text>
                    </Animated.View>
                </View>
            </Modal>
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

                <View style={[styles.statsSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={styles.statsBar}>
                        {truckStats.map(({ icon, value, onPress, isXpStat }, index) => (
                            <Pressable
                                key={index}
                                ref={isXpStat ? xpStatRef : undefined}
                                onPress={onPress}
                                disabled={!onPress}
                                style={({ pressed }) => [
                                    styles.stat,
                                    index < truckStats.length - 1 && styles.statWithDivider,
                                    { borderColor: colors.border },
                                    pressed && styles.statPressed,
                                ]}
                            >
                                {icon}
                                <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                                    {value}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Postęp sesji"
                        accessibilityHint="Przełącza między czasem sesji a czasem pozostałym"
                        onPress={() => setShowTimeLeft((visible) => !visible)}
                        style={({ pressed }) => [
                            styles.sessionProgress,
                            { backgroundColor: colors.inputBackground, borderColor: colors.border },
                            pressed && styles.statPressed,
                        ]}
                    >
                        <View
                            style={[
                                styles.sessionProgressFill,
                                { backgroundColor: '#F44336', width: `${sessionProgress * 100}%` },
                            ]}
                        />
                        <Text style={[styles.sessionProgressText, { color: colors.text }]}>
                            {showTimeLeft
                                ? (hasSessionDeadline ? formatElapsed(sessionTimeLeft) : '—')
                                : formatElapsed(elapsedSessionTime)}
                        </Text>
                    </Pressable>
                </View>

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
                            style={[styles.btnOutline, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder, marginTop: 16 }]}
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
    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingTop: 16,
        paddingBottom: 12,
    },
    stat: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 2,
    },
    statWithDivider: {
        borderRightWidth: StyleSheet.hairlineWidth,
    },
    statValue: {
        flexShrink: 1,
        fontSize: 13,
        fontWeight: '700',
    },
    statPressed: {
        opacity: 0.65,
    },
    xpRewardPortal: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 9999,
    },
    xpRewardPortalItem: {
        position: 'absolute',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    xpRewardText: {
        color: '#F59E0B',
        fontSize: 14,
        fontWeight: '800',
        textShadowColor: 'rgba(0,0,0,0.18)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    sessionProgress: {
        position: 'relative',
        height: 24,
        width: '100%',
        overflow: 'hidden',
        borderWidth: 1,
        borderRadius: 10,
        justifyContent: 'center',
        marginBottom: 14,
    },
    sessionProgressFill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
    },
    sessionProgressText: {
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '800',
        textShadowColor: 'rgba(255,255,255,0.65)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
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
        alignItems: 'flex-start',
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
        paddingVertical: 4,
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
        paddingVertical: 12,
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