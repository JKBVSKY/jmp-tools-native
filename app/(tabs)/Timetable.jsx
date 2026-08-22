import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Gesture,
    GestureDetector,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useColors } from "../../hooks/useColors";
import { useAuth } from "../../context/AuthContext";

const STORAGE_KEY = '@jmp_tools_timetable';
const NOTIFICATIONS_ENABLED_KEY =
    '@jmp_tools_notifications_enabled';

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

const SHIFT_PRESETS = {
    morning: {
        label: 'Rano',
        start: '06:00',
        end: '14:15',
    },

    afternoon: {
        label: 'Popołudnie',
        start: '13:45',
        end: '22:00',
    },

    night: {
        label: 'Nocka',
        start: '21:45',
        end: '06:00',
    },
};

const Timetable = () => {
    const colors = useColors();
    const { isGuest } = useAuth();

    const [currentDate, setCurrentDate] = useState(new Date());

    const [schedule, setSchedule] = useState({});

    const [loading, setLoading] = useState(true);

    // Single-day modal
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);

    // Multi-day selection
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedDays, setSelectedDays] = useState([]);
    const dayLayoutsRef = useRef({});
    const dragSelectionStartRef = useRef(null);
    const lastDragDayRef = useRef(null);

    const [isDraggingSelection, setIsDraggingSelection] =
        useState(false);

    // Form
    const [shiftType, setShiftType] = useState('work');
    const [startTime, setStartTime] = useState('06:00');
    const [endTime, setEndTime] = useState('14:00');
    const [selectedPreset, setSelectedPreset] = useState(null);

    //  Modal functions 
    const applyShiftPreset = (presetKey) => {
        const preset = SHIFT_PRESETS[presetKey];

        setSelectedPreset(presetKey);
        setStartTime(preset.start);
        setEndTime(preset.end);
    };

    const adjustTime = (time, minutes) => {
        if (!/^\d{2}:\d{2}$/.test(time)) {
            return time;
        }

        const [hours, mins] = time.split(':').map(Number);

        let totalMinutes = hours * 60 + mins + minutes;

        // Obsługa przejścia przez północ
        totalMinutes =
            ((totalMinutes % 1440) + 1440) % 1440;

        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;

        return `${String(newHours).padStart(2, '0')}:${String(
            newMinutes
        ).padStart(2, '0')}`;
    };

    const adjustStartTime = (minutes) => {
        setStartTime((currentTime) =>
            adjustTime(currentTime, minutes)
        );

        setSelectedPreset(null);
    };

    const adjustEndTime = (minutes) => {
        setEndTime((currentTime) =>
            adjustTime(currentTime, minutes)
        );

        setSelectedPreset(null);
    };

    const selectDayRange = (startKey, endKey) => {
        const startIndex = monthDays.findIndex(
            (item) => item.key === startKey
        );

        const endIndex = monthDays.findIndex(
            (item) => item.key === endKey
        );

        if (startIndex === -1 || endIndex === -1) {
            return;
        }

        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);

        const range = monthDays
            .slice(from, to + 1)
            .map((item) => item.key);

        setSelectedDays(range);
    };

    const getDayFromPosition = (y) => {
        for (const item of monthDays) {
            const layout = dayLayoutsRef.current[item.key];

            if (!layout) {
                continue;
            }

            const start = layout.y;
            const end = layout.y + layout.height;

            if (y >= start && y <= end) {
                return item.key;
            }
        }

        return null;
    };

    /*
    * -----------------------------
    * Notifications
    * -----------------------------
    */

    const testScheduleAllShifts = async () => {
        await scheduleShiftReminder(schedule);

        const futureShifts = getAllFutureWorkShifts(schedule);

        if (futureShifts.length === 0) {
            Alert.alert(
                'Test powiadomień',
                'Brak przyszłych zmian typu work – nie zaplanowano powiadomień.'
            );
            return;
        }

        const message =
            `Liczba przyszłych zmian: ${futureShifts.length}\n\n` +
            futureShifts
                .map(
                    ({ date }) =>
                        `- ${date.toLocaleString('pl-PL')} (powiadomienie 10h przed)`
                )
                .join('\n');

        Alert.alert('Test powiadomień', message);
    };

    const getAllFutureWorkShifts = (schedule) => {
        const now = new Date();
        const shifts = [];

        const entries = Object.entries(schedule);

        for (const [dateKey, entry] of entries) {
            if (entry.type !== 'work') continue;

            // dateKey: "YYYY-MM-DD"
            const [year, month, day] = dateKey.split('-').map(Number);
            const shiftDate = new Date(year, month - 1, day);

            // Godzina rozpoczęcia, np. "06:00"
            const [hours, mins] = (entry.start || '06:00').split(':').map(Number);
            shiftDate.setHours(hours, mins, 0, 0);

            // Tylko przyszłe zmiany
            if (shiftDate <= now) continue;

            shifts.push({
                dateKey,
                shift: entry,
                date: shiftDate,
            });
        }

        // Opcjonalnie posortuj chronologicznie
        shifts.sort((a, b) => a.date.getTime() - b.date.getTime());

        return shifts;
    };

    const sendTestNotification = async () => {
        // 1. Sprawdź uprawnienia
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            Alert.alert('Brak uprawnień', 'Nie można wysłać powiadomienia testowego.');
            return;
        }

        // 2. Zaplanuj powiadomienie za 5 sekund
        const trigger = {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 5,
        };

        await Notifications.scheduleNotificationAsync({
            content: {
                title: 'Test powiadomienia',
                body: 'Jeśli to widzisz, powiadomienia działają!',
                sound: true,
            },
            trigger,
        });

        Alert.alert(
            'Powiadomienie zaplanowane',
            'Za 5 sekund powinno przyjść powiadomienie testowe.'
        );
    };

    const getNextWorkShift = (schedule) => {
        const now = new Date();
        let nextShift = null;
        let nextShiftDate = null;

        const entries = Object.entries(schedule);

        for (const [dateKey, entry] of entries) {
            if (entry.type !== 'work') continue;

            // dateKey: "YYYY-MM-DD"
            const [year, month, day] = dateKey.split('-').map(Number);
            const shiftDate = new Date(year, month - 1, day);

            // Godzina rozpoczęcia, np. "06:00"
            const [hours, mins] = (entry.start || '06:00').split(':').map(Number);
            shiftDate.setHours(hours, mins, 0, 0);

            // Interesują nas tylko przyszłe zmiany
            if (shiftDate <= now) continue;

            if (!nextShiftDate || shiftDate < nextShiftDate) {
                nextShiftDate = shiftDate;
                nextShift = { dateKey, ...entry };
            }
        }

        return nextShiftDate ? { shift: nextShift, date: nextShiftDate } : null;
    };

    const scheduleShiftReminder = async (schedule) => {
        const notificationsEnabled = await AsyncStorage.getItem(
            NOTIFICATIONS_ENABLED_KEY
        );

        if (notificationsEnabled !== 'true') {
            await Notifications.cancelAllScheduledNotificationsAsync();
            return;
        }

        // 1. Anuluj wszystkie wcześniej zaplanowane powiadomienia o zmianach
        await Notifications.cancelAllScheduledNotificationsAsync();

        const futureShifts = getAllFutureWorkShifts(schedule);
        if (futureShifts.length === 0) {
            console.log('Brak przyszłych zmian typu work do powiadomienia');
            return;
        }

        // 2. Sprawdź uprawnienia
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.warn('Brak uprawnień na powiadomienia');
            return;
        }

        // 3. Zaplanuj po jednym powiadomieniu na każdą zmianę
        const scheduledIds = [];

        for (const { shift, date } of futureShifts) {
            const reminderDate = new Date(date.getTime() - 10 * 60 * 60 * 1000);
            const now = new Date();

            // Nie planuj powiadomień w przeszłości
            if (reminderDate <= now) {
                continue;
            }

            const dateStr = date.toLocaleDateString('pl-PL', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
            });

            const content = {
                title: 'Nadchodząca zmiana',
                body: `Masz pracę ${dateStr} o ${shift.start}.`,
                sound: true,
                data: {
                    type: 'shift_reminder',
                    dateKey: shift.date,
                },
            };

            const trigger = {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: reminderDate,
            };

            const notificationId = await Notifications.scheduleNotificationAsync({
                content,
                trigger,
            });

            scheduledIds.push(notificationId);
        }

        console.log(
            `Zaplanowano ${scheduledIds.length} powiadomień o zmianach.`,
            scheduledIds
        );
    };
    /*
    * -----------------------------
    * GESTURE
    * -----------------------------
    */

    const rangeGesture = Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(400)

        .onBegin(() => {
            setIsDraggingSelection(true);
        })

        .onStart((event) => {
            const dayKey = getDayFromPosition(event.y);
            if (!dayKey) {
                return;
            }

            // jeśli multi select był wyłączony, włącz go „automatycznie”
            if (!selectionMode) {
                setSelectionMode(true);
                // czyścimy poprzednie zaznaczenie, zaczynamy od tego dnia
                setSelectedDays([dayKey]);
            } else {
                // jeśli już był włączony, możesz zdecydować czy czyścić,
                // czy dorzucać: tutaj też zaczynamy nowy zakres
                setSelectedDays([dayKey]);
            }

            dragSelectionStartRef.current = dayKey;
            lastDragDayRef.current = dayKey;
        })

        .onUpdate((event) => {
            const startKey = dragSelectionStartRef.current;
            if (!startKey) {
                return;
            }

            const dayKey = getDayFromPosition(event.y);
            if (!dayKey) {
                return;
            }

            if (dayKey === lastDragDayRef.current) return;
            lastDragDayRef.current = dayKey;
            selectDayRange(startKey, dayKey);
        })
        .onEnd(() => {
            dragSelectionStartRef.current = null;
            lastDragDayRef.current = null;
            setIsDraggingSelection(false);
        })
        .onFinalize(() => {
            dragSelectionStartRef.current = null;
            lastDragDayRef.current = null;
            setIsDraggingSelection(false);
        });

    /*
     * --------------------------------------------------
     * LOAD
     * --------------------------------------------------
     */

    useEffect(() => {
        if (isGuest) {
            setLoading(false);
            return;
        }

        loadSchedule();
    }, [isGuest]);

    const loadSchedule = async () => {
        try {
            const savedSchedule = await AsyncStorage.getItem(STORAGE_KEY);

            if (savedSchedule) {
                const parsed = JSON.parse(savedSchedule);
                setSchedule(parsed);

                // Ustaw powiadomienie na podstawie zapisanego grafiku
                await scheduleShiftReminder(parsed);
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

            // Zaplanuj powiadomienie na podstawie nowego grafiku
            await scheduleShiftReminder(newSchedule);
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
        dayLayoutsRef.current = {};
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

            const matchingPreset = Object.entries(
                SHIFT_PRESETS
            ).find(
                ([, preset]) =>
                    preset.start === existing.start &&
                    preset.end === existing.end
            );

            setSelectedPreset(
                matchingPreset ? matchingPreset[0] : null
            );
        } else {
            setShiftType('work');
            setStartTime('06:00');
            setEndTime('14:00');
            setSelectedPreset('morning');
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
        setSelectedPreset('morning');

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
                onLayout={(event) => {
                    const { y, height } = event.nativeEvent.layout;

                    const previous = dayLayoutsRef.current[key];
                    if (previous?.y === y && previous?.height === height) return;
                    dayLayoutsRef.current[key] = { y, height };
                }}
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

                        <View style={{ alignItems: 'stretch' }}></View>
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

                                    <View style={styles.presetContainer}>
                                        {Object.entries(SHIFT_PRESETS).map(
                                            ([presetKey, preset]) => {
                                                const selected =
                                                    selectedPreset === presetKey;

                                                return (
                                                    <Pressable
                                                        key={presetKey}
                                                        onPress={() =>
                                                            applyShiftPreset(presetKey)
                                                        }
                                                        style={[
                                                            styles.presetButton,
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
                                                                styles.presetButtonText,
                                                                {
                                                                    color: selected
                                                                        ? colors.butText
                                                                        : colors.outButText,
                                                                },
                                                            ]}
                                                        >
                                                            {preset.label}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            }
                                        )}
                                    </View>

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
                                                onChangeText={(value) => {
                                                    setStartTime(value);
                                                    setSelectedPreset(null);
                                                }}
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
                                            <View style={styles.adjustButtons}>
                                                <Pressable
                                                    onPress={() => adjustStartTime(-15)}
                                                    style={({ pressed }) => [
                                                        styles.adjustButton,
                                                        {
                                                            backgroundColor: colors.outButBackground,
                                                            borderColor: colors.outButBorder,
                                                        },
                                                        pressed && styles.pressed,
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.adjustButtonText,
                                                            { color: colors.outButText },
                                                        ]}
                                                    >
                                                        −15
                                                    </Text>
                                                </Pressable>

                                                <Pressable
                                                    onPress={() => adjustStartTime(15)}
                                                    style={({ pressed }) => [
                                                        styles.adjustButton,
                                                        {
                                                            backgroundColor: colors.outButBackground,
                                                            borderColor: colors.outButBorder,
                                                        },
                                                        pressed && styles.pressed,
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.adjustButtonText,
                                                            { color: colors.outButText },
                                                        ]}
                                                    >
                                                        +15
                                                    </Text>
                                                </Pressable>
                                            </View>
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
                                                onChangeText={(value) => {
                                                    setEndTime(value);
                                                    setSelectedPreset(null);
                                                }}
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
                                            <View style={styles.adjustButtons}>
                                                <Pressable
                                                    onPress={() => adjustEndTime(-15)}
                                                    style={({ pressed }) => [
                                                        styles.adjustButton,
                                                        {
                                                            backgroundColor: colors.outButBackground,
                                                            borderColor: colors.outButBorder,
                                                        },
                                                        pressed && styles.pressed,
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.adjustButtonText,
                                                            { color: colors.outButText },
                                                        ]}
                                                    >
                                                        −15
                                                    </Text>
                                                </Pressable>

                                                <Pressable
                                                    onPress={() => adjustEndTime(15)}
                                                    style={({ pressed }) => [
                                                        styles.adjustButton,
                                                        {
                                                            backgroundColor: colors.outButBackground,
                                                            borderColor: colors.outButBorder,
                                                        },
                                                        pressed && styles.pressed,
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.adjustButtonText,
                                                            { color: colors.outButText },
                                                        ]}
                                                    >
                                                        +15
                                                    </Text>
                                                </Pressable>
                                            </View>
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

    if (isGuest) {
        return (
            <SafeAreaView
                edges={["top"]}
                style={[styles.guestContainer, { backgroundColor: colors.background }]}
            >
                <Ionicons name="lock-closed-outline" size={48} color={colors.iconColor} />
                <Text style={[styles.guestTitle, { color: colors.title }]}>
                    Grafik pracy jest niedostępny
                </Text>
                <Text style={[styles.guestMessage, { color: colors.textSecondary }]}>
                    Zarejestruj konto, aby korzystać z grafiku pracy.
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView
            edges={['top']}
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
                scrollEnabled={!isDraggingSelection}
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

                <GestureDetector gesture={rangeGesture}>
                    <View style={styles.scheduleContainer}>
                        {monthDays.map(renderDay)}
                    </View>
                </GestureDetector>
            </ScrollView>

            {renderModal()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    guestContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },

    guestTitle: {
        marginTop: 16,
        fontSize: 20,
        fontWeight: "700",
        textAlign: "center",
    },

    guestMessage: {
        marginTop: 8,
        fontSize: 15,
        lineHeight: 22,
        textAlign: "center",
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
        paddingBottom: 24,
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
    presetContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },

    presetButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    presetButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    adjustButtons: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 6,
    },

    adjustButton: {
        flex: 1,
        height: 34,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    adjustButtonText: {
        fontSize: 12,
        fontWeight: '700',
    },
});

export default Timetable;