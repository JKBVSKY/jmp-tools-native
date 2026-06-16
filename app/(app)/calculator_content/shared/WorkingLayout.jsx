// calculator_content/shared/WorkingLayout.jsx
import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    Modal,
    TextInput,
    Alert,
    Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { TabView } from 'react-native-tab-view';

import ThemedCard from '@/components/ThemedCard';
import { XPEarnedNotification } from '@/components/XPEarnedNotification';
import { appConfirm } from '@/_utils/crossPlatformAlert';

import PauseModal from './PauseModal';
import AdjustTimeModal from './AdjustTimeModal';
import { useWorkingLogic } from './useWorkingLogic';
import TrucksList from '../truckLoading/TrucksList';
import NewTransportModal from '../truckLoading/NewTransportModal';
import EditTruckModal from '../truckLoading/EditTruckModal';

export default function WorkingLayout(props) {
    const {
        // context & colors
        calc,
        colors,

        // computed values
        trucks,
        trucksHistory,
        palletsLoaded,
        palletsRate,
        trucksLoadedCount,
        isPaused,
        levelData,
        xpForNextLevel,
        levelProgress,
        loadingTime,
        forcedFinishTime,
        setForcedFinishTime,
        palletsInputRef,
        editingTruck,
        changeMode,

        // UI state
        activeTab,
        setActiveTab,
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
        areSessionDetailsVisible,
        setAreSessionDetailsVisible,

        // XP / notification
        currentXPPerMin,
        sessionXPEarned,
        showXPFloatingText,
        floatingXPAmount,
        leveledUpMessage,
        notificationState,
        setNotificationState,
        floatingAnim,
        detailsAnimatedStyle,

        // handlers
        addTruck,
        handleSaveEdit,
        handleSaveEditHistory,
        handleTruckDone,
        handleRemoveHistoryTruck,
        handlePauseConfirm,
        handleResume,
        handleConfirmPallets,
        formatElapsed,
        formatTruckTime,

        // extras you use in JSX
        profile,
        isWeb,
    } = useWorkingLogic(props);

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

    // Define routes for TabView
    const routes = [
        { key: 'monitoring', title: 'Aktualne transporty' },
        { key: 'history', title: 'Zakończone transporty' },
    ];

    const navigationState = {
        index: activeTab,
        routes,
    };

    const renderScene = ({ route }) => {
        switch (route.key) {
            case 'monitoring':
                return (
                    <ScrollView style={[styles.trucksList, { backgroundColor: colors.tListBackground, borderColor: colors.border }]} contentContainerStyle={{ flexGrow: 1 }}>
                        {trucks.length === 0 ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={[styles.emptyText, { color: colors.text }]}>Rozpocznij nowy transport.</Text>
                            </View>
                        ) : (
                            trucks.map(truck => renderTruckItem(truck, false))
                        )}
                    </ScrollView>
                );
            case 'history':
                return (
                    <ScrollView style={[styles.trucksList, { backgroundColor: colors.tListBackground, borderColor: colors.border }]} contentContainerStyle={{ flexGrow: 1 }}>
                        {trucksHistory.length === 0 ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={[styles.emptyText, { color: colors.text }]}>Brak historii transportów.</Text>
                            </View>
                        ) : (
                            [...trucksHistory]
                                .sort((a, b) => b.displayId - a.displayId)
                                .map(truck => renderTruckItem(truck, true))
                        )}
                    </ScrollView>
                );
            default:
                return null;
        }
    };
    // ✅ NEW: Render truck item with collapsible design
    const renderTruckItem = (truck, isHistory = false) => {
        const isExpanded = expandedTruckId === truck.id;
        const elapsedTime = truck.elapsedLoadingTime || 0;

        return (
            <View>
                <View key={truck.id} style={[styles.truckItem, { borderBottomColor: colors.breakLine }]}>
                    {/* LEFT SECTION: Truck ID */}
                    <View style={[styles.truckIdSection, {
                        backgroundColor: colors.cardBackground,
                        borderWidth: 2,
                        borderColor: colors.border,
                    }]}>
                        <Text style={{ marginRight: 8 }}>
                            <MaterialCommunityIcons name="truck-outline" size={24} style={{ color: colors.iconColor }} />
                        </Text>
                        <Text style={[styles.truckId, { color: colors.iconColor }]}>#{truck.displayId}</Text>
                    </View>

                    {/* MIDDLE SECTION: Collapsible Info */}
                    <TouchableOpacity
                        onPress={() => setExpandedTruckId(isExpanded ? null : truck.id)}
                        style={styles.truckInfoSection}
                    >
                        {/* COLLAPSED VIEW - Always Visible */}
                        <View style={styles.compactRow}>
                            {/* Shop */}
                            <View style={styles.compactField}>
                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Sklep:</Text>
                                <Text style={[styles.fieldValue, { color: colors.text }]}>{truck.shop || '—'}</Text>
                            </View>

                            {/* Pallets */}
                            <View style={styles.compactField}>
                                <Text style={[styles.fieldLabel, { color: colors.text }]}>Palety:</Text>
                                <Text
                                    style={[
                                        styles.fieldValue,
                                        { color: truck.pallets ? colors.text : 'red' },
                                    ]}
                                >
                                    {truck.pallets || 'WTRA'}
                                </Text>
                            </View>

                            {/* Expand Icon */}
                            <View style={styles.expandIcon}>
                                <MaterialCommunityIcons
                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={20}
                                    color={colors.text}
                                />
                            </View>
                        </View>


                    </TouchableOpacity>

                    {/* RIGHT SECTION: Action Buttons */}
                    <View style={styles.truckActionsRight}>
                        <TouchableOpacity
                            onPress={() => setEditingTruck(truck)}
                            style={styles.iconButton}
                        >
                            <MaterialCommunityIcons name="pencil" size={16} color={colors.text} />
                        </TouchableOpacity>

                        {!isHistory && (
                            <TouchableOpacity
                                onPress={() => handleTruckDone(truck.id)}
                                style={[styles.iconButton, { borderLeftColor: colors.breakLine, borderLeftWidth: 1, paddingLeft: 12 }]}
                            >
                                <MaterialCommunityIcons name="check" size={16} color={colors.success || '#10b981'} />
                            </TouchableOpacity>
                        )}

                        {isHistory && (
                            <TouchableOpacity
                                onPress={() => handleRemoveHistoryTruck(truck.id)}
                                style={[styles.iconButton, { borderLeftColor: colors.breakLine, borderLeftWidth: 1, paddingLeft: 12 }]}
                            >
                                <MaterialCommunityIcons name="delete" size={16} color={colors.error || '#ef4444'} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                <View>
                    {/* EXPANDED VIEW - Additional Details */}
                    {isExpanded && (
                        <View style={[styles.expandedDetails, { borderColor: colors.breakLine }]}>
                            {/* Gate Row */}
                            <View style={styles.detailRow}>
                                <Text style={[styles.detailLabel, { color: colors.text }]}>Brama:</Text>
                                <Text style={[styles.detailValue, { color: colors.text }]}>{truck.gate || '—'}</Text>
                            </View>

                            {/* Trailer Row */}
                            <View style={styles.detailRow}>
                                <Text style={[styles.detailLabel, { color: colors.text }]}>Naczepa:</Text>
                                <Text style={[styles.detailValue, { color: colors.text }]}>{truck.trailer || '—'}</Text>
                            </View>

                            {/* Full Elapsed Time Display */}
                            <View style={styles.detailRow}>
                                <Text style={[styles.detailLabel, { color: colors.text }]}>Całkowity Czas:</Text>
                                <Text style={[styles.detailValue, { color: colors.text }]}>{formatElapsed(elapsedTime)}</Text>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    // ============================================================================
    // SECTION 6: MAIN RENDER
    // ============================================================================

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ✅ XP PROGRESS BAR - TOP OF SCREEN */}
                {profile && (

                    < ThemedCard style={[styles.levelCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View>
                            <Text style={[styles.levelTitle, { color: colors.title }]}>Poziom {profile.level}</Text>
                        </View>
                        <View style={styles.progressContainer}>
                            <View
                                style={[
                                    styles.progressBar,
                                    {
                                        backgroundColor: colors.inputBackground,
                                        borderColor: colors.border,
                                        borderWidth: 1,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.progressFill,
                                        { backgroundColor: colors.iconColor, width: `${Math.min(levelProgress, 100)}%` },
                                    ]}
                                />
                            </View>
                            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                                {levelData?.currentXP} / {xpForNextLevel} XP
                            </Text>
                        </View>
                    </ThemedCard>
                )}

                {/* ADD THE NOTIFICATION COMPONENT HERE */}
                <XPEarnedNotification
                    visible={notificationState.visible}
                    xpAmount={notificationState.xp}
                    onDismiss={() => setNotificationState({ visible: false, xp: 0 })}
                />

                {/* ✅ FLOATING XP TEXT ANIMATION */}
                {showXPFloatingText && (
                    <Animated.View
                        style={[
                            styles.floatingXPText,
                            {
                                opacity: floatingAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 0],
                                }),
                                transform: [
                                    {
                                        translateY: floatingAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0, -60],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <Text style={[styles.floatingXPValue, { color: colors.text }]}>+{floatingXPAmount} XP</Text>
                    </Animated.View>
                )}

                {/* ✅ LEVEL UP CELEBRATION */}
                {leveledUpMessage && (
                    <View style={[styles.levelUpBanner, { backgroundColor: colors.cardBackground }]}>
                        <Ionicons name="star" size={24} style={{ color: colors.iconColor }} />
                        <Text style={[styles.levelUpText, { color: colors.text }]}>Level Up to {leveledUpMessage}! 🎉</Text>
                        <Ionicons name="star" size={24} style={{ color: colors.iconColor }} />
                    </View>
                )}

                {isWeb ? (
                    <View style={styles.statsSection}>
                        <View style={styles.statsGrid}>
                            {/* Card 1: Elapsed Time */}
                            <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="time-outline" size={24} style={{ color: colors.iconColor }} />
                                    <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Czas Ładowania</Text>
                                </View>
                                <Text style={[styles.cardValue, { color: colors.text }]}>
                                    {loadingTime ? formatElapsed(loadingTime) : "00:00:00"}
                                </Text>
                            </View>

                            {/* Card 2: Pallets Loaded */}
                            <TouchableOpacity
                                style={[styles.statCard, { backgroundColor: colors.cardBackground, width: '22%' }]}
                                onPress={() => Alert.alert('Palety Załadowane', `${palletsLoaded}`)}
                            >
                                <View style={styles.cardHeader}>
                                    <Text style={[styles.cardLabelBadge, { color: colors.textSecondary }]}>Palety</Text>
                                    <MaterialCommunityIcons name="truck-delivery-outline" size={24} style={{ color: colors.iconColor }} />
                                </View>
                                <Text style={[styles.cardValue, { color: colors.text }]}>{palletsLoaded}</Text>
                            </TouchableOpacity>

                            {/* Card 3: Trucks Loaded */}
                            <TouchableOpacity
                                style={[styles.statCard, { backgroundColor: colors.cardBackground, width: '22%' }]}
                                onPress={() => Alert.alert('Dostawy załadowane', `${trucksLoadedCount}`)}
                            >
                                <View style={styles.cardHeader}>
                                    <Text style={[styles.cardLabelBadge, { color: colors.textSecondary }]}>Dostawy</Text>
                                    <MaterialCommunityIcons name="truck-check-outline" size={24} style={{ color: colors.iconColor }} />
                                </View>
                                <Text style={[styles.cardValue, { color: colors.text }]}>{trucksLoadedCount}</Text>
                            </TouchableOpacity>

                            {/* Card 4: Rate (per hour) */}
                            <View style={[styles.statCard, { backgroundColor: colors.cardBackground, width: '48%' }]}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="flash-outline" size={24} style={{ color: colors.iconColor }} />
                                    <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Wynik/godz</Text>
                                </View>
                                <Text style={[styles.cardValue, { color: colors.text }]}>{palletsRate}</Text>
                            </View>

                            {/* Card 5: Forced Finish Time */}
                            <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBackground, width: '48%' }]} onPress={() => setShowAdjustFinishTimeModal(true)}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="time-outline" size={24} style={{ color: colors.iconColor }} />
                                    <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Czas Zakończenia</Text>
                                </View>
                                <Text style={[styles.cardValue, { color: colors.text }]}>
                                    {forcedFinishTime
                                        ? `${new Date(forcedFinishTime).toLocaleTimeString()}`
                                        : 'Brak'}
                                </Text>
                            </TouchableOpacity>

                            {calc.timeOfForcedFinish && (
                                <View style={{
                                    backgroundColor: '#fff3cd',
                                    borderRadius: 12,
                                    padding: 12,
                                    marginBottom: 16,
                                    borderLeftWidth: 4,
                                    borderLeftColor: '#ff6b6b'
                                }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#cc5200' }}>
                                        ⏰ Auto-finish at {new Date(calc.timeOfForcedFinish).toLocaleTimeString()}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                ) : (
                    <View style={[styles.statsSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.gridTitle, { color: colors.text }]}>
                            Sesja aktywna
                        </Text>
                        <Text style={[styles.gridSubtitle, { color: colors.textSecondary }]}>
                            Twoje statystyki bieżącej sesji.
                        </Text>
                        <View style={styles.statsGrid}>

                            {/* Card 1: Score */}
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

                            {/* Expand / collapse button */}
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

                            {/* Hidden Cards */}
                            <Animated.View
                                pointerEvents={areSessionDetailsVisible ? 'auto' : 'none'}
                                style={[
                                    styles.expandableContent,
                                    detailsAnimatedStyle,
                                    !areSessionDetailsVisible && styles.expandableContentHidden,
                                ]}
                            >
                                <View style={styles.statsGridHidden}>
                                    {/* Card 2: Time */}
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
                                                {loadingTime ? formatElapsed(loadingTime) : '00:00:00'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Card 3: Pallets */}
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

                                    {/* Card 4: Truck loaded */}
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

                                    {/* Card 5: Forced finish */}
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
                                    </View>

                                    {calc.timeOfForcedFinish && (
                                        <View
                                            style={[
                                                styles.autoFinishNotice,
                                                {
                                                    backgroundColor: colors.cardInCardBackground,
                                                    borderColor: colors.border,
                                                },
                                            ]}
                                        >
                                            <Text style={[styles.autoFinishNoticeText, { color: colors.cardTitle }]}>
                                                ⏰ Auto-finish at {new Date(calc.timeOfForcedFinish).toLocaleTimeString()}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </Animated.View>
                        </View>
                    </View>
                )}

                {/* Trucks section */}
                <View style={[styles.infoContainer, { backgroundColor: colors.cardBackground }]}>
                    <View style={styles.tabHeader}>
                        <View style={{ flexDirection: 'column' }}>
                            <Text style={[styles.gridTitle, { color: colors.text }]}>
                                {activeTab === 0 ? "Transporty" : "Zakończone transporty"}
                            </Text>
                            <Text style={[styles.gridSubtitle, { color: colors.textSecondary }]}>
                                {activeTab === 0 ? "Lista załadunków w trakcie" : "Lista ukończonych załadunków"}
                            </Text>
                        </View>
                        <View style={[styles.tabDots, { flexDirection: 'row' }]}>
                            <TouchableOpacity
                                style={[styles.tabDot, activeTab === 0 ? { backgroundColor: colors.tabDotActive } : { backgroundColor: colors.tabDotInactive }]}
                            />
                            <TouchableOpacity
                                style={[styles.tabDot, activeTab === 1 ? { backgroundColor: colors.tabDotActive } : { backgroundColor: colors.tabDotInactive }]}
                            />
                        </View>
                        <TouchableOpacity
                            style={[styles.btnOutline, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]}
                            onPress={() => setShowNewTransportModal(true)}
                        >
                            <Ionicons name="add-outline" size={24} color={colors.outButText} />
                        </TouchableOpacity>
                    </View>

                    <TabView
                        navigationState={navigationState}
                        renderScene={renderScene}
                        onIndexChange={setActiveTab}
                        renderTabBar={() => null} // Hide default tab bar since using custom dots
                        style={{ height: 200 }} // or another explicit height
                    />
                </View>
            </ScrollView>
            {/* Buttons */}
            {
                isPaused ? (
                    // Paused - Resume button ONLY
                    <View style={[styles.resumeButtonContainer, { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }]}>
                        <TouchableOpacity
                            style={[styles.btnResume, { backgroundColor: colors.butBackground }]}
                            onPress={handleResume}
                        >
                            <Ionicons name="play" size={20} color={colors.butText} />
                            <Text style={[styles.btnResumeText, { color: colors.butText }]}>Wznów</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    // Working -  Pause, Finish buttons
                    <View style={[styles.buttonsContainer, { backgroundColor: colors.navBackground, borderTopColor: colors.border }]}>

                        <TouchableOpacity
                            style={[styles.btnPrimary, { backgroundColor: colors.butBackground }]}
                            onPress={() => setShowPauseModal(true)}
                        >
                            <Ionicons name="pause-outline" size={24} color={colors.butText} />
                            <Text style={[styles.btnPrimaryText, { color: colors.butText }]}>Zatrzymaj</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() =>
                                appConfirm(
                                    'Zakończ Sesję',
                                    'Czy na pewno chcesz zakończyć tę sesję obliczeniową?',
                                    handleFinishSession,
                                )
                            }
                            style={[styles.btnPrimary, { backgroundColor: colors.butBackground }]}
                        >
                            <MaterialCommunityIcons name="flag-checkered" size={24} color={colors.butText} />
                            <Text style={[styles.btnPrimaryText, { color: colors.butText }]}>Zakończ</Text>
                        </TouchableOpacity>
                    </View>
                )
            }

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

            <NewTransportModal
                visible={showNewTransportModal}
                onClose={() => setShowNewTransportModal(false)}
                onAdd={addTruck}
            />

            <EditTruckModal
                visible={!!editingTruck}
                truck={editingTruck}
                onClose={() => setEditingTruck(null)}
                onSave={activeTab === 0 ? handleSaveEdit : handleSaveEditHistory}
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
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
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
        elevation: 2,
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
        paddingVertical: 12,
        marginBottom: 16,
        borderRadius: 12,
        gap: 10,
    },
    levelUpText: {
        color: '#fff',
        fontSize: 16,
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
        paddingTop: 16,
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
    iconButton: {
        padding: 6,
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
        paddingVertical:  16,
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
        fontSize: 18,
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    resumeButtonContainer: {
        width: '100%',
        alignItems: 'stretch',
        borderRadius: 24,
        overflow: 'hidden',
        marginTop: 34,
    },
    btnResume: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 11,
        borderRadius: 24,
        gap: 6,
    },
    btnResumeText: {
        fontSize: 14,
        fontWeight: '600',
    },
    // Truck List Section
    trucksList: {
        borderWidth: 1,
        borderRadius: 12,
    },
    truckItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        minHeight: 60,
        borderBottomWidth: 1,
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

});