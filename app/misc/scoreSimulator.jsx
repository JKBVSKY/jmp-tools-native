// ScoreSimulator.js
import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    useColorScheme,
    Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../constants/Colors.js';

const CALCULATION_MODES = {
    detailed: 'detailed',
    simple: 'simple',
};

const RESULT_COLORS = {
    red: '#EF4444',
    orange: '#F97316',
    yellow: '#EAB308',
    green: '#22C55E',
};

const ScoreSimulator = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const palette = isDark ? Colors.dark : Colors.light;
    const styles = useMemo(() => createStyles(palette), [palette]);

    const [calculationMode, setCalculationMode] = useState(CALCULATION_MODES.detailed);
    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const [workedTimeInput, setWorkedTimeInput] = useState('');
    const [pallets, setPallets] = useState('');
    const [error, setError] = useState('');
    const [avgPalletsPerHour, setAvgPalletsPerHour] = useState(null);
    const [durationLabel, setDurationLabel] = useState('');
    const [maxUntilLabel, setMaxUntilLabel] = useState('');

    const [startTimeWebValue, setStartTimeWebValue] = useState('');
    const [endTimeWebValue, setEndTimeWebValue] = useState('');

    const parseWebTimeToDate = (value) => {
        const match = /^(\d{2}):(\d{2})$/.exec(value);
        if (!match) return null;

        const hours = Number(match[1]);
        const minutes = Number(match[2]);

        if (hours > 23 || minutes > 59) return null;

        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    };

    const parseDurationInputToSeconds = (value) => {
        const normalized = value.replace(',', '.').trim();
        if (!normalized) return null;

        const decimalMatch = /^\d+(?:\.\d+)?$/.exec(normalized);
        if (decimalMatch) {
            const hours = Number(normalized);
            if (Number.isNaN(hours) || hours <= 0) return null;
            return Math.round(hours * 3600);
        }

        const timeMatch = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(normalized);
        if (!timeMatch) return null;

        const hours = Number(timeMatch[1]);
        const minutes = Number(timeMatch[2]);
        const seconds = timeMatch[3] ? Number(timeMatch[3]) : 0;

        if (
            Number.isNaN(hours) ||
            Number.isNaN(minutes) ||
            Number.isNaN(seconds) ||
            hours < 0 ||
            minutes < 0 ||
            minutes > 59 ||
            seconds < 0 ||
            seconds > 59
        ) {
            return null;
        }

        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
        return totalSeconds > 0 ? totalSeconds : null;
    };

    const parsePalletsInput = (value) => {
        const normalizedPalletsStr = value.replace(',', '.').trim();
        const palletsPattern = /^(?:[1-9]\d*)(?:\.(?:25|50|75))?$/;

        if (!palletsPattern.test(normalizedPalletsStr)) {
            return {
                error:
                    'Liczba palet musi być większa od 0. Dozwolone są tylko wartości całkowite (1, 2, 3, …) oraz końcówki .25, .50, .75.',
            };
        }

        const palletsNumber = parseFloat(normalizedPalletsStr);

        if (Number.isNaN(palletsNumber) || palletsNumber <= 0) {
            return { error: 'Liczba palet musi być większa od 0.' };
        }

        return { value: palletsNumber };
    };

    const clearResults = () => {
        setError('');
        setAvgPalletsPerHour(null);
        setDurationLabel('');
        setMaxUntilLabel('');
    };

    const handleModeChange = (mode) => {
        if (mode === calculationMode) return;
        setCalculationMode(mode);
        clearResults();
    };

    const handleWebStartTimeChange = (value) => {
        setStartTimeWebValue(value);

        const parsed = parseWebTimeToDate(value);
        if (parsed) {
            setStartTime(parsed);
        }
    };

    const handleWebEndTimeChange = (value) => {
        setEndTimeWebValue(value);

        const parsed = parseWebTimeToDate(value);
        if (parsed) {
            setEndTime(parsed);
        }
    };

    const secondsFromDate = (date) => {
        if (!date) return null;
        return (
            date.getHours() * 3600 +
            date.getMinutes() * 60 +
            date.getSeconds()
        );
    };

    const formatTimeLabel = (date) => {
        if (!date) return 'Wybierz czas';
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    };

    const formatDuration = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours}h ${minutes}m ${seconds}s`;
    };

    const getResultColor = (value) => {
        if (value == null) return palette.text;
        if (value < 39) return RESULT_COLORS.red;
        if (value <= 43) return RESULT_COLORS.orange;
        if (value <= 47.99) return RESULT_COLORS.yellow;
        return RESULT_COLORS.green;
    };

    const handleCalculate = () => {
        clearResults();

        const palletsResult = parsePalletsInput(pallets);
        if (palletsResult.error) {
            setError(palletsResult.error);
            return;
        }

        const palletsNumber = palletsResult.value;
        let diffSeconds = null;
        let startSeconds = null;

        if (calculationMode === CALCULATION_MODES.detailed) {
            if (!startTime || !endTime) {
                setError('Uzupełnij wszystkie pola.');
                return;
            }

            startSeconds = secondsFromDate(startTime);
            const endSeconds = secondsFromDate(endTime);
            const secondsInDay = 24 * 3600;

            if (startSeconds === endSeconds) {
                setError(
                    'Czas pracy nie może wynosić 0 godzin. Zmień godzinę rozpoczęcia lub zakończenia.'
                );
                return;
            }

            if (endSeconds > startSeconds) {
                diffSeconds = endSeconds - startSeconds;
            } else {
                diffSeconds = (secondsInDay - startSeconds) + endSeconds;
            }
        } else {
            if (!workedTimeInput.trim()) {
                setError('Uzupełnij wszystkie pola.');
                return;
            }

            diffSeconds = parseDurationInputToSeconds(workedTimeInput);
            if (!diffSeconds) {
                setError('Czas pracy wpisz jako HH:MM, HH:MM:SS albo liczbę godzin, np. 8.5.');
                return;
            }
        }

        if (!diffSeconds) {
            setError('Uzupełnij wszystkie pola.');
            return;
        }

        const hoursWorked = diffSeconds / 3600;
        const avg = palletsNumber / hoursWorked;

        setAvgPalletsPerHour(avg);
        setDurationLabel(formatDuration(diffSeconds));

        if (calculationMode === CALCULATION_MODES.detailed && avg > 48) {
            const hoursTo48 = palletsNumber / 48;
            const totalSecondsFromStart = Math.round(hoursTo48 * 3600);
            const targetSecondsOfDay =
                (startSeconds + totalSecondsFromStart) % (24 * 3600);

            const targetHours = Math.floor(targetSecondsOfDay / 3600);
            const targetMinutes = Math.floor((targetSecondsOfDay % 3600) / 60);

            const hh = String(targetHours).padStart(2, '0');
            const mm = String(targetMinutes).padStart(2, '0');

            setMaxUntilLabel(`${hh}:${mm}`);
        } else {
            setMaxUntilLabel('');
        }
    };

    const handleClear = () => {
        setCalculationMode(CALCULATION_MODES.detailed);
        setStartTime(null);
        setEndTime(null);
        setStartTimeWebValue('');
        setEndTimeWebValue('');
        setWorkedTimeInput('');
        setShowStartPicker(false);
        setShowEndPicker(false);
        setPallets('');
        clearResults();
    };

    const onChangeStartTime = (event, selectedDate) => {
        setShowStartPicker(false);
        if (selectedDate) {
            setStartTime(selectedDate);
        }
    };

    const onChangeEndTime = (event, selectedDate) => {
        setShowEndPicker(false);
        if (selectedDate) {
            setEndTime(selectedDate);
        }
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.description}>
                    Uzupełnij dane i kliknij „Oblicz”, aby obliczyć średnią liczbę palet na godzinę.
                </Text>
                <View style={styles.modeContainer}>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            calculationMode === CALCULATION_MODES.detailed
                                ? [
                                    styles.modeButtonActive,
                                    { backgroundColor: palette.butBackground, borderColor: palette.butBorder },
                                ]
                                : { backgroundColor: palette.outButBackground, borderColor: palette.outButBorder },
                        ]}
                        onPress={() => handleModeChange(CALCULATION_MODES.detailed)}
                    >
                        <Text
                            style={[
                                styles.modeButtonText,
                                calculationMode === CALCULATION_MODES.detailed
                                    ? { color: palette.butText }
                                    : { color: palette.text },
                            ]}
                        >
                            Tryb szczegółowy
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            calculationMode === CALCULATION_MODES.simple
                                ? [
                                    styles.modeButtonActive,
                                    { backgroundColor: palette.butBackground, borderColor: palette.butBorder },
                                ]
                                : { backgroundColor: palette.outButBackground, borderColor: palette.outButBorder },
                        ]}
                        onPress={() => handleModeChange(CALCULATION_MODES.simple)}
                    >
                        <Text
                            style={[
                                styles.modeButtonText,
                                calculationMode === CALCULATION_MODES.simple
                                    ? { color: palette.butText }
                                    : { color: palette.text },
                            ]}
                        >
                            Tryb prosty
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.content}>

                <Text style={styles.modeDescription}>
                    {calculationMode === CALCULATION_MODES.detailed
                        ? 'Tryb szczegółowy: wybierz godzinę rozpoczęcia i zakończenia oraz wpisz liczbę palet.'
                        : 'Tryb uproszczony: wpisz łączny czas pracy i liczbę palet.'}
                </Text>

                {calculationMode === CALCULATION_MODES.detailed ? (
                    <>
                        {Platform.OS === 'web' ? (
                            <TextInput
                                style={[styles.input, { marginBottom: 12 }]}
                                value={startTimeWebValue}
                                placeholder="HH:MM"
                                placeholderTextColor={palette.phText}
                                onChangeText={handleWebStartTimeChange}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        ) : (
                            <>
                                <Text style={styles.label}>Czas rozpoczęcia</Text>
                                <TouchableOpacity
                                    style={[styles.timeInputButton, { marginBottom: 12 }]}
                                    onPress={() => setShowStartPicker(true)}
                                >
                                    <Text
                                        style={[
                                            styles.timeInputText,
                                            !startTime && styles.timeInputPlaceholder,
                                        ]}
                                    >
                                        {formatTimeLabel(startTime)}
                                    </Text>
                                </TouchableOpacity>

                                {showStartPicker && (
                                    <DateTimePicker
                                        value={startTime || new Date()}
                                        mode="time"
                                        is24Hour={true}
                                        display="default"
                                        onChange={onChangeStartTime}
                                    />
                                )}
                            </>
                        )}

                        {Platform.OS === 'web' ? (
                            <TextInput
                                style={[styles.input, { marginBottom: 12 }]}
                                value={endTimeWebValue}
                                placeholder="HH:MM"
                                placeholderTextColor={palette.phText}
                                onChangeText={handleWebEndTimeChange}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        ) : (
                            <>
                                <Text style={styles.label}>Czas zakończenia</Text>
                                <TouchableOpacity
                                    style={[styles.timeInputButton, { marginBottom: 12 }]}
                                    onPress={() => {
                                        const now = new Date();
                                        setEndTime(endTime || now);
                                        setShowEndPicker(true);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.timeInputText,
                                            !endTime && styles.timeInputPlaceholder,
                                        ]}
                                    >
                                        {formatTimeLabel(endTime)}
                                    </Text>
                                </TouchableOpacity>

                                {showEndPicker && (
                                    <DateTimePicker
                                        value={endTime || new Date()}
                                        mode="time"
                                        is24Hour={true}
                                        display="default"
                                        onChange={onChangeEndTime}
                                    />
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Łączny czas pracy</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Np. 8:30, 8:30:15 lub 8.5"
                            placeholderTextColor={palette.phText}
                            value={workedTimeInput}
                            onChangeText={setWorkedTimeInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                )}

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Liczba palet</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Np. 12, 12.25, 12.50, 12.75"
                        placeholderTextColor={palette.phText}
                        value={pallets}
                        onChangeText={setPallets}
                        keyboardType="decimal-pad"
                    />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {avgPalletsPerHour != null && (
                    <View style={styles.resultContainer}>
                        <Text style={styles.resultLabel}>Średnia palet na godzinę</Text>
                        <Text
                            style={[
                                styles.resultValue,
                                { color: getResultColor(avgPalletsPerHour) },
                            ]}
                        >
                            {avgPalletsPerHour.toFixed(2)}
                        </Text>

                        {durationLabel ? (
                            <Text style={styles.resultSubLabel}>
                                Czas pracy: {durationLabel}
                            </Text>
                        ) : null}

                        {maxUntilLabel ? (
                            <Text style={styles.resultSubLabel}>
                                48 o godzinie: {maxUntilLabel}
                            </Text>
                        ) : null}
                    </View>
                )}

                <View style={styles.buttonsRow}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleCalculate}
                    >
                        <Text style={styles.primaryButtonText}>Oblicz</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={handleClear}
                    >
                        <Text style={styles.secondaryButtonText}>Wyczyść</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const createStyles = (palette) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: palette.background,
        },
        header: {
            paddingHorizontal: 32,
            paddingVertical: 16,
            backgroundColor: palette.navBackground,
            marginBottom: 32,
        },
        content: {
            flex: 1,
            paddingHorizontal: 32,
        },
        title: {
            fontSize: 22,
            fontWeight: '700',
            color: palette.title,
            marginBottom: 4,
        },
        description: {
            fontSize: 14,
            color: palette.textSecondary,
            marginBottom: 16,
            marginTop: 4,
        },
        modeContainer: {
            flexDirection: 'row',
            gap: 12,
        },
        modeButton: {
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 16,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        modeButtonText: {
            fontSize: 14,
            fontWeight: '600',
        },
        modeDescription: {
            fontSize: 13,
            color: palette.textSecondary,
            marginBottom: 16,
            lineHeight: 18,
        },
        formGroup: {
            marginBottom: 12,
        },
        label: {
            fontSize: 13,
            color: palette.textSecondary,
            marginBottom: 6,
        },
        timeInputButton: {
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.inputBorder,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: palette.inputBackground,
            justifyContent: 'center',
        },
        timeInputText: {
            fontSize: 15,
            color: palette.text,
        },
        timeInputPlaceholder: {
            color: palette.phText,
        },
        input: {
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.inputBorder,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: palette.text,
            backgroundColor: palette.inputBackground,
            fontSize: 15,
        },
        errorText: {
            color: '#EF4444',
            fontSize: 13,
            marginTop: 4,
            marginBottom: 8,
        },
        resultContainer: {
            marginTop: 16,
            marginBottom: 12,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.uiBackground ?? palette.inputBackground,
        },
        resultLabel: {
            fontSize: 13,
            color: palette.textSecondary,
            marginBottom: 4,
        },
        resultValue: {
            fontSize: 28,
            fontWeight: '700',
        },
        resultSubLabel: {
            marginTop: 4,
            fontSize: 13,
            color: palette.textSecondary,
        },
        buttonsRow: {
            flexDirection: 'row',
            marginTop: 8,
            columnGap: 10,
        },
        primaryButton: {
            flex: 1,
            backgroundColor: palette.butBackground,
            borderRadius: 999,
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: palette.butBorder,
        },
        primaryButtonText: {
            color: palette.butText,
            fontSize: 15,
            fontWeight: '600',
        },
        secondaryButton: {
            flex: 1,
            backgroundColor: palette.outButBackground,
            borderRadius: 999,
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: palette.outButBorder,
        },
        secondaryButtonText: {
            color: palette.outButText,
            fontSize: 15,
            fontWeight: '500',
        },
    });

export default ScoreSimulator;