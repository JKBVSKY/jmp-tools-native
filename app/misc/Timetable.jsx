import React, { useEffect, useMemo, useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    Modal,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColors } from '../../hooks/useColors';

const STORAGE_KEY = '@jmp_tools_timetable';

const MONTHS = [
    'styczeń',
    'luty',
    'marzec',
    'kwiecień',
    'maj',
    'czerwiec',
    'lipiec',
    'sierpień',
    'wrzesień',
    'październik',
    'listopad',
    'grudzień',
];

const DAYS = [
    'NIE',
    'PON',
    'WTO',
    'ŚRO',
    'CZW',
    'PIĄ',
    'SOB',
];

const SHIFT_TYPES = {
    work: 'Praca',
    free: 'Wolne',
    vacation: 'Urlop',
    sick: 'L4',
};

const Timetable = () => {
    const colors = useColors();

    const [currentDate, setCurrentDate] = useState(new Date());

    const [schedule, setSchedule] = useState({});

    const [loading, setLoading] = useState(true);

    // Single-day modal
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);

    // Multi-day selection
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedDays, setSelectedDays] = useState([]);

    // Form
    const [shiftType, setShiftType] = useState('work');
    const [startTime, setStartTime] = useState('06:00');
    const [endTime, setEndTime] = useState('14:00');

    /*
     * --------------------------------------------------
     * LOAD
     * --------------------------------------------------
     */

    useEffect(() => {
        loadSchedule();
    }, []);

    const loadSchedule = async () => {
        try {
            const savedSchedule = await AsyncStorage.getItem(
                STORAGE_KEY
            );

            if (savedSchedule) {
                setSchedule(JSON.parse(savedSchedule));
            }
        } catch (error) {
            console.error('Error loading timetable:', error);
        } finally {
            setLoading(false);
        }
    };

    /*
     * --------------------------------------------------
     * SAVE
     * --------------------------------------------------
     */

    const saveSchedule = async (newSchedule) => {
        try {
            await AsyncStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(newSchedule)
            );

            setSchedule(newSchedule);
        } catch (error) {
            console.error('Error saving timetable:', error);

            Alert.alert(
                'Błąd',
                'Nie udało się zapisać grafiku.'
            );
        }
    };

    /*
     * --------------------------------------------------
     * DATE HELPERS
     * --------------------------------------------------
     */

    const getDateKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    };

    const formatDate = (date) => {
        return `${String(date.getDate()).padStart(2, '0')}.${String(
            date.getMonth() + 1
        ).padStart(2, '0')}`;
    };

    const getDayName = (date) => {
        return DAYS[date.getDay()];
    };

    /*
     * --------------------------------------------------
     * MONTH
     * --------------------------------------------------
     */

    const changeMonth = (amount) => {
        setCurrentDate(
            (previous) =>
                new Date(
                    previous.getFullYear(),
                    previous.getMonth() + amount,
                    1
                )
        );

        // Czyścimy zaznaczenie po zmianie miesiąca.
        setSelectedDays([]);
        setSelectionMode(false);
    };

    /*
     * --------------------------------------------------
     * MONTH DAYS
     * --------------------------------------------------
     */

    const monthDays = useMemo(() => {
        const days = [];

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const numberOfDays = new Date(
            year,
            month + 1,
            0
        ).getDate();

        for (let day = 1; day <= numberOfDays; day++) {
            const date = new Date(year, month, day);

            days.push({
                date,
                key: getDateKey(date),
            });
        }

        return days;
    }, [currentDate]);

    /*
     * --------------------------------------------------
     * SINGLE DAY
     * --------------------------------------------------
     */

    const openSingleDay = (date) => {
        const key = getDateKey(date);
        const existing = schedule[key];

        setSelectedDate(date);

        if (existing) {
            setShiftType(existing.type || 'work');
            setStartTime(existing.start || '06:00');
            setEndTime(existing.end || '14:00');
        } else {
            setShiftType('work');
            setStartTime('06:00');
            setEndTime('14:00');
        }

        setModalVisible(true);
    };

    /*
     * --------------------------------------------------
     * MULTI SELECT
     * --------------------------------------------------
     */

    const toggleSelectionMode = () => {
        setSelectionMode((previous) => !previous);
        setSelectedDays([]);
    };

    const toggleDaySelection = (key) => {
        setSelectedDays((previous) => {
            if (previous.includes(key)) {
                return previous.filter(
                    (selectedKey) => selectedKey !== key
                );
            }

            return [...previous, key];
        });
    };

    const selectAllDays = () => {
        const allKeys = monthDays.map((item) => item.key);

        setSelectedDays(allKeys);
    };

    const clearSelectedDays = () => {
        setSelectedDays([]);
    };

    /*
     * --------------------------------------------------
     * MULTI-DAY MODAL
     * --------------------------------------------------
     */

    const openMultiDayModal = () => {
        if (selectedDays.length === 0) {
            Alert.alert(
                'Brak wybranych dni',
                'Najpierw wybierz przynajmniej jeden dzień.'
            );

            return;
        }

        setShiftType('work');
        setStartTime('06:00');
        setEndTime('14:00');

        setModalVisible(true);
    };

    /*
     * --------------------------------------------------
     * SAVE SINGLE / MULTIPLE
     * --------------------------------------------------
     */

    const handleSave = async () => {
        // MULTI-DAY
        if (selectionMode) {
            if (selectedDays.length === 0) {
                return;
            }

            const newSchedule = {
                ...schedule,
            };

            selectedDays.forEach((key) => {
                const entry = {
                    date: key,
                    type: shiftType,
                };

                if (shiftType === 'work') {
                    entry.start = startTime;
                    entry.end = endTime;
                }

                newSchedule[key] = entry;
            });

            await saveSchedule(newSchedule);

            setModalVisible(false);
            setSelectedDays([]);
            setSelectionMode(false);

            return;
        }

        // SINGLE DAY
        if (!selectedDate) {
            return;
        }

        const key = getDateKey(selectedDate);

        const entry = {
            date: key,
            type: shiftType,
        };

        if (shiftType === 'work') {
            entry.start = startTime;
            entry.end = endTime;
        }

        const newSchedule = {
            ...schedule,
            [key]: entry,
        };

        await saveSchedule(newSchedule);

        setModalVisible(false);
    };

    /*
     * --------------------------------------------------
     * DELETE SINGLE DAY
     * --------------------------------------------------
     */

    const handleDelete = () => {
        if (!selectedDate) {
            return;
        }

        const key = getDateKey(selectedDate);

        Alert.alert(
            'Usuń wpis',
            'Czy na pewno chcesz usunąć ten dzień z grafiku?',
            [
                {
                    text: 'Anuluj',
                    style: 'cancel',
                },
                {
                    text: 'Usuń',
                    style: 'destructive',
                    onPress: async () => {
                        const newSchedule = {
                            ...schedule,
                        };

                        delete newSchedule[key];

                        await saveSchedule(newSchedule);

                        setModalVisible(false);
                    },
                },
            ]
        );
    };

    /*
     * --------------------------------------------------
     * TODAY
     * --------------------------------------------------
     */

    const todayKey = getDateKey(new Date());

    /*
     * --------------------------------------------------
     * MONTH TITLE
     * --------------------------------------------------
     */

    const monthTitle =
        MONTHS[currentDate.getMonth()].charAt(0).toUpperCase() +
        MONTHS[currentDate.getMonth()].slice(1);

    /*
     * --------------------------------------------------
     * RENDER DAY
     * --------------------------------------------------
     */

    const renderDay = ({ date, key }) => {
        const entry = schedule[key];

        const isToday = key === todayKey;

        const isSelected = selectedDays.includes(key);

        const isWork = entry?.type === 'work';

        let value = 'Nie ustawiono';

        if (entry) {
            if (entry.type === 'work') {
                value = `${entry.start} – ${entry.end}`;
            } else {
                value = SHIFT_TYPES[entry.type];
            }
        }

        const handlePress = () => {
            if (selectionMode) {
                toggleDaySelection(key);
            } else {
                openSingleDay(date);
            }
        };

        return (
            <Pressable
                key={key}
                onPress={handlePress}
                style={({ pressed }) => [
                    styles.scheduleItem,
                    {
                        backgroundColor: isSelected
                            ? colors.inputBackground
                            : colors.cardBackground,

                        borderColor: isSelected
                            ? colors.butBackground
                            : isToday
                                ? colors.butBackground
                                : colors.headerBorder,
                    },

                    isToday && styles.todayItem,

                    isSelected && styles.selectedItem,

                    pressed && styles.pressed,
                ]}
            >
                {/* SELECTION CHECK */}

                {selectionMode && (
                    <View
                        style={[
                            styles.checkbox,
                            {
                                borderColor: isSelected
                                    ? colors.butBackground
                                    : colors.outButBorder,

                                backgroundColor: isSelected
                                    ? colors.butBackground
                                    : 'transparent',
                            },
                        ]}
                    >
                        {isSelected && (
                            <Ionicons
                                name="checkmark"
                                size={16}
                                color={colors.butText}
                            />
                        )}
                    </View>
                )}

                {/* DATE */}

                <View style={styles.dateContainer}>
                    <Text
                        style={[
                            styles.dayText,
                            {
                                color: isToday
                                    ? colors.textRed
                                    : colors.textSecondary,
                            },
                        ]}
                    >
                        {getDayName(date)}
                    </Text>

                    <Text
                        style={[
                            styles.dateText,
                            { color: colors.title },
                        ]}
                    >
                        {formatDate(date)}
                    </Text>
                </View>

                {/* SHIFT */}

                <View style={styles.shiftContainer}>
                    <Text
                        style={[
                            styles.shiftText,
                            {
                                color: entry
                                    ? colors.text
                                    : colors.textSecondary,
                            },
                        ]}
                    >
                        {value}
                    </Text>

                    {entry && (
                        <Text
                            style={[
                                styles.workLabel,
                                {
                                    color: isWork
                                        ? colors.textRed
                                        : colors.textSecondary,
                                },
                            ]}
                        >
                            {SHIFT_TYPES[entry.type]}
                        </Text>
                    )}
                </View>

                {!selectionMode && (
                    <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={colors.grayIconColor}
                    />
                )}
            </Pressable>
        );
    };

    /*
     * --------------------------------------------------
     * MODAL
     * --------------------------------------------------
     */

    const renderModal = () => {
        if (!selectedDate && !selectionMode) {
            return null;
        }

        const isMultiDay = selectionMode;

        const selectedKey = selectedDate
            ? getDateKey(selectedDate)
            : null;

        const isEditing =
            !isMultiDay &&
            selectedKey &&
            !!schedule[selectedKey];

        return (
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View
                        style={[
                            styles.modalOverlay,
                            { backgroundColor: 'rgba(0,0,0,0.65)' },
                        ]}
                    >
                        <View
                            style={[
                                styles.modalContainer,
                                {
                                    backgroundColor: colors.cardBackground,
                                },
                            ]}
                        >
                            {/* HEADER */}

                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            styles.modalTitle,
                                            { color: colors.title },
                                        ]}
                                    >
                                        {isMultiDay
                                            ? 'Ustaw dla wybranych dni'
                                            : isEditing
                                                ? 'Edytuj dzień'
                                                : 'Dodaj dzień'}
                                    </Text>

                                    <Text
                                        style={[
                                            styles.modalDate,
                                            { color: colors.textSecondary },
                                        ]}
                                    >
                                        {isMultiDay
                                            ? `Wybrano ${selectedDays.length} ${selectedDays.length === 1
                                                ? 'dzień'
                                                : selectedDays.length < 5
                                                    ? 'dni'
                                                    : 'dni'
                                            }`
                                            : selectedDate?.toLocaleDateString(
                                                'pl-PL',
                                                {
                                                    weekday: 'long',
                                                    day: '2-digit',
                                                    month: 'long',
                                                }
                                            )}
                                    </Text>
                                </View>

                                <Pressable
                                    onPress={() => setModalVisible(false)}
                                    style={styles.closeButton}
                                >
                                    <Ionicons
                                        name="close"
                                        size={24}
                                        color={colors.iconColor}
                                    />
                                </Pressable>
                            </View>

                            {/* TYPE */}

                            <Text
                                style={[
                                    styles.sectionTitle,
                                    { color: colors.cardTitle },
                                ]}
                            >
                                Typ dnia
                            </Text>

                            <View style={styles.typeContainer}>
                                {Object.entries(SHIFT_TYPES).map(
                                    ([type, label]) => {
                                        const selected = shiftType === type;

                                        return (
                                            <Pressable
                                                key={type}
                                                onPress={() => setShiftType(type)}
                                                style={[
                                                    styles.typeButton,
                                                    {
                                                        backgroundColor: selected
                                                            ? colors.butBackground
                                                            : colors.outButBackground,

                                                        borderColor: selected
                                                            ? colors.butBorder
                                                            : colors.outButBorder,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.typeButtonText,
                                                        {
                                                            color: selected
                                                                ? colors.butText
                                                                : colors.outButText,
                                                        },
                                                    ]}
                                                >
                                                    {label}
                                                </Text>
                                            </Pressable>
                                        );
                                    }
                                )}
                            </View>

                            {/* HOURS */}

                            {shiftType === 'work' && (
                                <View>
                                    <Text
                                        style={[
                                            styles.sectionTitle,
                                            { color: colors.cardTitle },
                                        ]}
                                    >
                                        Godziny pracy
                                    </Text>

                                    <View style={styles.timeRow}>
                                        <View style={styles.timeInputContainer}>
                                            <Text
                                                style={[
                                                    styles.inputLabel,
                                                    {
                                                        color: colors.textSecondary,
                                                    },
                                                ]}
                                            >
                                                Od
                                            </Text>

                                            <TextInput
                                                value={startTime}
                                                onChangeText={setStartTime}
                                                keyboardType="numbers-and-punctuation"
                                                maxLength={5}
                                                placeholder="06:00"
                                                placeholderTextColor={
                                                    colors.phText
                                                }
                                                style={[
                                                    styles.timeInput,
                                                    {
                                                        backgroundColor:
                                                            colors.inputBackground,
                                                        borderColor:
                                                            colors.inputBorder,
                                                        color: colors.text,
                                                    },
                                                ]}
                                            />
                                        </View>

                                        <Text
                                            style={[
                                                styles.timeSeparator,
                                                { color: colors.textSecondary },
                                            ]}
                                        >
                                            –
                                        </Text>

                                        <View style={styles.timeInputContainer}>
                                            <Text
                                                style={[
                                                    styles.inputLabel,
                                                    {
                                                        color: colors.textSecondary,
                                                    },
                                                ]}
                                            >
                                                Do
                                            </Text>

                                            <TextInput
                                                value={endTime}
                                                onChangeText={setEndTime}
                                                keyboardType="numbers-and-punctuation"
                                                maxLength={5}
                                                placeholder="14:00"
                                                placeholderTextColor={
                                                    colors.phText
                                                }
                                                style={[
                                                    styles.timeInput,
                                                    {
                                                        backgroundColor:
                                                            colors.inputBackground,
                                                        borderColor:
                                                            colors.inputBorder,
                                                        color: colors.text,
                                                    },
                                                ]}
                                            />
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* ACTIONS */}

                            <View style={styles.modalActions}>
                                {!isMultiDay && isEditing && (
                                    <Pressable
                                        onPress={handleDelete}
                                        style={({ pressed }) => [
                                            styles.deleteButton,
                                            {
                                                borderColor: colors.outButBorder,
                                            },
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <Ionicons
                                            name="trash-outline"
                                            size={20}
                                            color={colors.textRed}
                                        />
                                    </Pressable>
                                )}

                                <Pressable
                                    onPress={() => setModalVisible(false)}
                                    style={({ pressed }) => [
                                        styles.cancelButton,
                                        {
                                            backgroundColor:
                                                colors.outButBackground,
                                            borderColor: colors.outButBorder,
                                        },
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.cancelButtonText,
                                            { color: colors.outButText },
                                        ]}
                                    >
                                        Anuluj
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={handleSave}
                                    style={({ pressed }) => [
                                        styles.saveButton,
                                        {
                                            backgroundColor: colors.butBackground,
                                            borderColor: colors.butBorder,
                                        },
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.saveButtonText,
                                            { color: colors.butText },
                                        ]}
                                    >
                                        {isMultiDay
                                            ? 'Ustaw dni'
                                            : 'Zapisz'}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        );
    };

    /*
     * --------------------------------------------------
     * MAIN UI
     * --------------------------------------------------
     */

    return (
        <SafeAreaView
            style={[
                styles.container,
                { backgroundColor: colors.background },
            ]}
        >
            {/* HEADER */}

            <View
                style={[
                    styles.header,
                    {
                        backgroundColor: colors.navBackground,
                        borderBottomColor: colors.headerBorder,
                    },
                ]}
            >
                <Text
                    style={[
                        styles.headerTitle,
                        { color: colors.title },
                    ]}
                >
                    Grafik pracy
                </Text>

                <Pressable
                    onPress={toggleSelectionMode}
                    style={({ pressed }) => [
                        styles.headerButton,
                        pressed && styles.pressed,
                    ]}
                >
                    <Ionicons
                        name={
                            selectionMode
                                ? 'close-outline'
                                : 'checkbox-outline'
                        }
                        size={24}
                        color={colors.iconColor}
                    />
                </Pressable>
            </View>

            {/* CONTENT */}

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* MONTH */}

                <View style={styles.monthHeader}>
                    <Pressable
                        onPress={() => changeMonth(-1)}
                        style={({ pressed }) => [
                            styles.monthButton,
                            {
                                backgroundColor: colors.cardBackground,
                                borderColor: colors.headerBorder,
                            },
                            pressed && styles.pressed,
                        ]}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={20}
                            color={colors.iconColor}
                        />
                    </Pressable>

                    <View style={styles.monthTitleContainer}>
                        <Text
                            style={[
                                styles.monthTitle,
                                { color: colors.title },
                            ]}
                        >
                            {monthTitle} {currentDate.getFullYear()}
                        </Text>

                        <Text
                            style={[
                                styles.monthSubtitle,
                                { color: colors.textSecondary },
                            ]}
                        >
                            {selectionMode
                                ? `Wybrano ${selectedDays.length}`
                                : 'Twój grafik'}
                        </Text>
                    </View>

                    <Pressable
                        onPress={() => changeMonth(1)}
                        style={({ pressed }) => [
                            styles.monthButton,
                            {
                                backgroundColor: colors.cardBackground,
                                borderColor: colors.headerBorder,
                            },
                            pressed && styles.pressed,
                        ]}
                    >
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={colors.iconColor}
                        />
                    </Pressable>
                </View>

                {/* SELECTION CONTROLS */}

                {selectionMode && (
                    <View
                        style={[
                            styles.selectionControls,
                            {
                                backgroundColor: colors.cardBackground,
                                borderColor: colors.headerBorder,
                            },
                        ]}
                    >
                        <Pressable
                            onPress={selectAllDays}
                            style={({ pressed }) => [
                                styles.selectionControlButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Ionicons
                                name="checkmark-done-outline"
                                size={18}
                                color={colors.iconColor}
                            />

                            <Text
                                style={[
                                    styles.selectionControlText,
                                    { color: colors.text },
                                ]}
                            >
                                Wszystkie
                            </Text>
                        </Pressable>

                        <View
                            style={[
                                styles.selectionDivider,
                                { backgroundColor: colors.breakLine },
                            ]}
                        />

                        <Pressable
                            onPress={clearSelectedDays}
                            style={({ pressed }) => [
                                styles.selectionControlButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Ionicons
                                name="refresh-outline"
                                size={18}
                                color={colors.iconColor}
                            />

                            <Text
                                style={[
                                    styles.selectionControlText,
                                    { color: colors.text },
                                ]}
                            >
                                Wyczyść
                            </Text>
                        </Pressable>
                    </View>
                )}

                {/* DAYS */}

                <View style={styles.scheduleContainer}>
                    {monthDays.map(renderDay)}
                </View>
            </ScrollView>

            {/* BOTTOM */}

            <View
                style={[
                    styles.bottomActions,
                    {
                        backgroundColor: colors.botBarBackground,
                        borderTopColor: colors.headerBorder,
                    },
                ]}
            >
                {selectionMode ? (
                    <Pressable
                        onPress={openMultiDayModal}
                        disabled={selectedDays.length === 0}
                        style={({ pressed }) => [
                            styles.actionButton,
                            {
                                backgroundColor:
                                    selectedDays.length > 0
                                        ? colors.butBackground
                                        : colors.disabledButBackground,

                                borderColor:
                                    selectedDays.length > 0
                                        ? colors.butBorder
                                        : colors.disabledButBorder,
                            },
                            pressed && styles.pressed,
                        ]}
                    >
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={21}
                            color={
                                selectedDays.length > 0
                                    ? colors.butText
                                    : colors.disabledButText
                            }
                        />

                        <Text
                            style={[
                                styles.actionButtonText,
                                {
                                    color:
                                        selectedDays.length > 0
                                            ? colors.butText
                                            : colors.disabledButText,
                                },
                            ]}
                        >
                            Ustaw zaznaczone
                            {selectedDays.length > 0
                                ? ` (${selectedDays.length})`
                                : ''}
                        </Text>
                    </Pressable>
                ) : (
                    <>
                        <Pressable
                            onPress={() => openSingleDay(null)}
                            style={({ pressed }) => [
                                styles.actionButton,
                                {
                                    backgroundColor:
                                        colors.outButBackground,
                                    borderColor: colors.outButBorder,
                                },
                                pressed && styles.pressed,
                            ]}
                        >
                            <Ionicons
                                name="create-outline"
                                size={21}
                                color={colors.outButText}
                            />

                            <Text
                                style={[
                                    styles.actionButtonText,
                                    { color: colors.outButText },
                                ]}
                            >
                                Dodaj ręcznie
                            </Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [
                                styles.actionButton,
                                {
                                    backgroundColor: colors.butBackground,
                                    borderColor: colors.butBorder,
                                },
                                pressed && styles.pressed,
                            ]}
                        >
                            <Ionicons
                                name="scan-outline"
                                size={21}
                                color={colors.butText}
                            />

                            <Text
                                style={[
                                    styles.actionButtonText,
                                    { color: colors.butText },
                                ]}
                            >
                                Skanuj grafik
                            </Text>
                        </Pressable>
                    </>
                )}
            </View>

            {renderModal()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    header: {
        height: 60,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
    },

    headerTitle: {
        fontSize: 21,
        fontWeight: '700',
    },

    headerButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },

    content: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 120,
    },

    monthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },

    monthButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    monthTitleContainer: {
        alignItems: 'center',
        flex: 1,
    },

    monthTitle: {
        fontSize: 19,
        fontWeight: '700',
    },

    monthSubtitle: {
        marginTop: 3,
        fontSize: 13,
    },

    /*
     * MULTI SELECTION
     */

    selectionControls: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },

    selectionControlButton: {
        flex: 1,
        height: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
    },

    selectionControlText: {
        fontSize: 13,
        fontWeight: '600',
    },

    selectionDivider: {
        width: 1,
        height: 24,
    },

    /*
     * DAYS
     */

    scheduleContainer: {
        gap: 10,
    },

    scheduleItem: {
        minHeight: 76,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 15,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },

    todayItem: {
        borderWidth: 2,
    },

    selectedItem: {
        borderWidth: 2,
    },

    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 7,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },

    dateContainer: {
        width: 64,
    },

    dayText: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 3,
    },

    dateText: {
        fontSize: 17,
        fontWeight: '700',
    },

    shiftContainer: {
        flex: 1,
        paddingLeft: 8,
    },

    shiftText: {
        fontSize: 16,
        fontWeight: '600',
    },

    workLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },

    /*
     * BOTTOM
     */

    bottomActions: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: 10,
    },

    actionButton: {
        flex: 1,
        minHeight: 52,
        borderRadius: 13,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },

    actionButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },

    pressed: {
        opacity: 0.7,
    },

    /*
     * MODAL
     */

    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },

    modalContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 30,
    },

    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },

    modalTitle: {
        fontSize: 21,
        fontWeight: '700',
    },

    modalDate: {
        fontSize: 14,
        marginTop: 4,
    },

    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },

    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 10,
    },

    typeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 22,
    },

    typeButton: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
    },

    typeButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },

    timeRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 24,
    },

    timeInputContainer: {
        flex: 1,
    },

    inputLabel: {
        fontSize: 12,
        marginBottom: 6,
    },

    timeInput: {
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 17,
    },

    timeSeparator: {
        fontSize: 20,
        paddingHorizontal: 10,
        paddingBottom: 12,
    },

    modalActions: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },

    deleteButton: {
        width: 50,
        height: 50,
        borderRadius: 11,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    cancelButton: {
        flex: 1,
        height: 50,
        borderRadius: 11,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },

    saveButton: {
        flex: 1,
        height: 50,
        borderRadius: 11,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    saveButtonText: {
        fontSize: 15,
        fontWeight: '700',
    },
});

export default Timetable;