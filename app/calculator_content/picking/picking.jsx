import React, { useState } from 'react';
import { Alert, Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePickingLogic } from './usePickingLogic';
import PauseModal from '../shared/PauseModal';
import SessionActionBar from '../shared/SessionActionBar';
import SessionXPHeader from '../shared/SessionXPHeader';

const formatElapsed = (seconds) => {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    return [hours, minutes, remainingSeconds]
        .map(value => String(value).padStart(2, '0'))
        .join(':');
};

export default function Picking(props) {
    const {
        colors,
        calc,
        profile,
        sessionTime,
        subsection,
        boxesCount,
        ordersCount,
        subsectionTime,
        goal,
        boxesRate,
        isOverGoal,
        boxesRemainingToGoal,
        levelData,
        xpForNextLevel,
        levelProgress,
        boxesInputHint,
        isPaused,
        canSubmitBoxes,
        leveledUpMessage,
        showXPFloatingText,
        floatingAnim,
        floatingXPAmount,
        notificationState,
        setNotificationState,
        showPauseModal,
        setShowPauseModal,
        pickingSubsections,
        setSubsection,
        boxesInput,
        handleBoxesInputChange,
        submitBoxesInput,
        updateBoxesCount,
        handlePauseConfirm,
        handleResume,
        handleFinishSession,
    } = usePickingLogic(props);
    const insets = useSafeAreaInsets();
    const [showEditBoxesModal, setShowEditBoxesModal] = useState(false);
    const [editedBoxesCount, setEditedBoxesCount] = useState('');
    const [subtractBoxesInput, setSubtractBoxesInput] = useState('');

    const openEditBoxesModal = () => {
        setEditedBoxesCount(String(boxesCount ?? 0));
        setShowEditBoxesModal(true);
    };

    const handleEditedBoxesCountChange = (value) => {
        const normalized = value.replace(',', '.');
        if (!/^\d*(?:\.\d{0,2})?$/.test(normalized)) {
            return;
        }
        setEditedBoxesCount(normalized);
    };

    const handleConfirmEditBoxes = () => {
        Keyboard.dismiss();

        const normalized = editedBoxesCount.replace(',', '.').trim();
        const parsed = Number(normalized);

        if (normalized === '' || !Number.isFinite(parsed) || parsed < 0) {
            return;
        }

        const updated = updateBoxesCount(parsed);
        if (!updated) {
            return;
        }

        setShowEditBoxesModal(false);
    };

    const handleSubmitBoxes = () => {
        Keyboard.dismiss();

        if (!canSubmitBoxes) {
            return;
        }

        submitBoxesInput();
    };

    const handleSubtractBoxesInputChange = (value) => {
        const normalized = value.replace(',', '.');
        if (!/^\d*(?:\.\d{0,2})?$/.test(normalized)) {
            return;
        }
        setSubtractBoxesInput(normalized);
    };

    const handleSubtractBoxes = () => {
        Keyboard.dismiss();

        if (isPaused) {
            return;
        }

        const normalized = subtractBoxesInput.replace(',', '.').trim();
        const parsed = Number(normalized);

        if (normalized === '' || !Number.isFinite(parsed) || parsed <= 0) {
            Alert.alert('Nieprawidłowa wartość', 'Wpisz dodatnią liczbę opakowań do odjęcia (maksymalnie 2 miejsca po przecinku).');
            return;
        }

        if (parsed > boxesCount) {
            Alert.alert('Za duża wartość', 'Nie możesz odjąć więcej opakowań niż aktualnie zapisano.');
            return;
        }

        const nextBoxesCount = Number((boxesCount - parsed).toFixed(2));
        const updated = updateBoxesCount(nextBoxesCount);

        if (!updated) {
            return;
        }

        setSubtractBoxesInput('');
    };

    const canSubtractBoxes = !isPaused && subtractBoxesInput.trim() !== '';

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

                <View style={styles.contentInner}>
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Podsekcja</Text>
                        <View style={styles.chipsWrap}>
                            {pickingSubsections.map((item) => {
                                const isActive = subsection === item;
                                return (
                                    <TouchableOpacity
                                        key={item}
                                        onPress={() => setSubsection(item)}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: isActive ? colors.butBackground : colors.inputBackground,
                                                borderColor: isActive ? colors.butBackground : colors.border,
                                            }
                                        ]}
                                    >
                                        <Text style={[styles.chipText, { color: isActive ? colors.butText : colors.text }]}>{item}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Statystyki</Text>
                        <View
                            style={[
                                styles.wideStatsCard,
                                {
                                    backgroundColor: colors.cardInCardBackground || colors.inputBackground,
                                    borderColor: colors.border,
                                },
                            ]}
                        >
                            <View style={styles.wideStatsColumn}>
                                <Text style={[styles.wideStatsLabel, { color: colors.textSecondary }]}>Wynik/godz</Text>
                                <Text style={[styles.wideStatsValue, { color: colors.text }]}>{boxesRate.toFixed(2)}</Text>
                            </View>
                            <View style={[styles.wideStatsDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.wideStatsColumn} onPress={openEditBoxesModal} activeOpacity={0.8}>
                                <Text style={[styles.wideStatsLabel, { color: colors.textSecondary }]}>Opakowania</Text>
                                <Text style={[styles.wideStatsValue, { color: colors.text }]}>{boxesCount}</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Dodaj opakowania</Text>
                        <View style={styles.row}>
                            <TextInput
                                value={boxesInput}
                                onChangeText={handleBoxesInputChange}
                                keyboardType="decimal-pad"
                                returnKeyType="done"
                                onSubmitEditing={handleSubmitBoxes}
                                blurOnSubmit={false}
                                editable={!isPaused}
                                placeholder="Np. 24"
                                placeholderTextColor={colors.textSecondary}
                                style={[
                                    styles.input,
                                    styles.inputCompact,
                                    {
                                        backgroundColor: isPaused ? colors.cardBackground : colors.inputBackground,
                                        borderColor: colors.border,
                                        color: colors.text,
                                        opacity: isPaused ? 0.7 : 1,
                                    }
                                ]}
                            />
                            <TouchableOpacity
                                onPress={handleSubmitBoxes}
                                disabled={!canSubmitBoxes}
                                style={[
                                    styles.confirmButton,
                                    { backgroundColor: colors.butBackground },
                                    !canSubmitBoxes && styles.confirmButtonDisabled,
                                ]}
                            >
                                <Text style={[styles.confirmButtonText, { color: colors.butText }]}>Zatwierdź</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.hintText, { color: canSubmitBoxes ? colors.textSecondary : (colors.warning || '#d97706') }]}>{boxesInputHint}</Text>
                        <Text style={[styles.label, styles.subtractLabel, { color: colors.textSecondary }]}>Umniejsz opakowania</Text>
                        <View style={styles.row}>
                            <TextInput
                                value={subtractBoxesInput}
                                onChangeText={handleSubtractBoxesInputChange}
                                keyboardType="decimal-pad"
                                returnKeyType="done"
                                onSubmitEditing={handleSubtractBoxes}
                                blurOnSubmit={false}
                                editable={!isPaused}
                                placeholder="Np. 5"
                                placeholderTextColor={colors.textSecondary}
                                style={[
                                    styles.input,
                                    styles.inputCompact,
                                    {
                                        backgroundColor: isPaused ? colors.cardBackground : colors.inputBackground,
                                        borderColor: colors.border,
                                        color: colors.text,
                                        opacity: isPaused ? 0.7 : 1,
                                    }
                                ]}
                            />
                            <TouchableOpacity
                                onPress={handleSubtractBoxes}
                                disabled={!canSubtractBoxes}
                                style={[
                                    styles.confirmButton,
                                    { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder, borderWidth: 1 },
                                    !canSubtractBoxes && styles.confirmButtonDisabled,
                                ]}
                            >
                                <Text style={[styles.confirmButtonText, { color: colors.outButText }]}>Umniejsz</Text>
                            </TouchableOpacity>
                        </View>

                    </View>

                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Czas podsekcji</Text>
                        <Text style={[styles.value, { color: colors.text }]}>{formatElapsed(subsectionTime)}</Text>
                    </View>

                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Statystyki (inne)</Text>
                        <Text style={[styles.statText, { color: colors.text }]}>Sklepy: {ordersCount}</Text>
                        <Text style={[styles.statText, { color: colors.text }]}>Cel/godz: {goal || 'brak'}</Text>
                        <Text style={[styles.statText, { color: colors.text }]}>Do celu: {boxesRemainingToGoal}</Text>
                        <Text style={[styles.statText, { color: isOverGoal ? (colors.success || '#16a34a') : colors.text }]}>Status: {isOverGoal ? 'cel osiągnięty' : 'w trakcie'}</Text>
                    </View>
                </View>
            </ScrollView>

            <SessionActionBar
                isPaused={isPaused}
                onResume={handleResume}
                onPause={() => setShowPauseModal(true)}
                onFinish={handleFinishSession}
                colors={colors}
                bottomInset={insets.bottom}
                finishConfirmTitle="Zakończ sesję"
                finishConfirmMessage="Czy na pewno chcesz zakończyć sesję kompletacji?"
            />

            <PauseModal
                visible={showPauseModal}
                onClose={() => setShowPauseModal(false)}
                onConfirm={handlePauseConfirm}
            />

            <Modal
                visible={showEditBoxesModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowEditBoxesModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Edytuj liczbę opakowań</Text>
                        <Text style={[styles.modalNote, { color: colors.textSecondary }]}>Edycja ilości opakowań nie wpływa na liczbę zamówień.</Text>

                        <TextInput
                            value={editedBoxesCount}
                            onChangeText={handleEditedBoxesCountChange}
                            keyboardType="decimal-pad"
                            returnKeyType="done"
                            onSubmitEditing={handleConfirmEditBoxes}
                            placeholder="Np. 24"
                            placeholderTextColor={colors.textSecondary}
                            style={[
                                styles.modalInput,
                                {
                                    backgroundColor: colors.inputBackground,
                                    borderColor: colors.border,
                                    color: colors.text,
                                },
                            ]}
                        />

                        <View style={styles.modalButtonsRow}>
                            <TouchableOpacity
                                onPress={() => setShowEditBoxesModal(false)}
                                style={[styles.modalButton, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]}
                            >
                                <Text style={[styles.modalButtonText, { color: colors.outButText }]}>Anuluj</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleConfirmEditBoxes}
                                style={[styles.modalButton, { backgroundColor: colors.butBackground }]}
                            >
                                <Text style={[styles.modalButtonText, { color: colors.butText }]}>Zatwierdź</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingTop: 16,
        paddingBottom: 120,
    },
    contentInner: {
        paddingHorizontal: 24,
        paddingBottom: 24,
        gap: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 8,
    },
    card: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    subtractLabel: {
        marginTop: 10,
    },
    value: {
        fontSize: 22,
        fontWeight: '700',
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 18,
        fontWeight: '600',
    },
    inputCompact: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    wideStatsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        marginBottom: 12,
    },
    wideStatsColumn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    wideStatsDivider: {
        width: 1,
        height: '70%',
    },
    wideStatsLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    wideStatsValue: {
        fontSize: 22,
        fontWeight: '700',
    },
    confirmButton: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
    },
    confirmButtonDisabled: {
        opacity: 0.45,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    hintText: {
        fontSize: 13,
        marginTop: 8,
    },
    chipsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '700',
    },
    statText: {
        fontSize: 16,
        marginTop: 2,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalCard: {
        width: '100%',
        maxWidth: 460,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    modalNote: {
        fontSize: 14,
        marginTop: 8,
        lineHeight: 20,
    },
    modalInput: {
        marginTop: 14,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 18,
        fontWeight: '600',
    },
    modalButtonsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    modalButton: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        paddingVertical: 11,
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: 15,
        fontWeight: '700',
    },
});
