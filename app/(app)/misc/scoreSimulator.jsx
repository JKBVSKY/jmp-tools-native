// ScoreSimulator.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors.js'; // dostosuj ścieżkę

// Kolory wyniku – możesz podmienić na własne z motywu
const RESULT_COLORS = {
  red: '#EF4444',
  orange: '#F97316',
  yellow: '#EAB308',
  green: '#22C55E',
};

const ScoreSimulator = () => {
  const colorScheme = useColorScheme(); // 'dark' | 'light' | null
  const isDark = colorScheme === 'dark';

  const palette = isDark ? Colors.dark : Colors.light;

  const styles = useMemo(() => createStyles(palette), [palette]);

  const [startTime, setStartTime] = useState(null); // Date | null
  const [endTime, setEndTime] = useState(null);     // Date | null
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [pallets, setPallets] = useState('');
  const [error, setError] = useState('');
  const [avgPalletsPerHour, setAvgPalletsPerHour] = useState(null);
  const [durationLabel, setDurationLabel] = useState('');
  const [maxUntilLabel, setMaxUntilLabel] = useState('');


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
    if (value > 39 && value <= 43) return RESULT_COLORS.orange;
    if (value > 43 && value <= 47.99) return RESULT_COLORS.yellow;
    if (value >= 48) return RESULT_COLORS.green;

    return palette.text;
  };

  const handleCalculate = () => {
    setError('');
    setAvgPalletsPerHour(null);
    setDurationLabel('');
    setMaxUntilLabel('');

    if (!startTime || !endTime || !pallets) {
      setError('Uzupełnij wszystkie pola.');
      return;
    }

    const startSeconds = secondsFromDate(startTime);
    const endSeconds = secondsFromDate(endTime);

    const secondsInDay = 24 * 3600;
    let diffSeconds;

    if (startSeconds === endSeconds) {
      setError(
        'Czas pracy nie może wynosić 0 godzin. Zmień godzinę rozpoczęcia lub zakończenia.'
      );
      return;
    } else if (endSeconds > startSeconds) {
      // Ten sam dzień
      diffSeconds = endSeconds - startSeconds;
    } else {
      // Zakończenie po północy – następny dzień
      diffSeconds = (secondsInDay - startSeconds) + endSeconds;
    }

    // Palety
    const normalizedPalletsStr = pallets.replace(',', '.').trim();
    const palletsPattern = /^(?:[1-9]\d*)(?:\.(?:25|50|75))?$/;

    if (!palletsPattern.test(normalizedPalletsStr)) {
      setError(
        'Liczba palet musi być większa od 0. Dozwolone są tylko wartości całkowite (1, 2, 3, …) oraz końcówki .25, .50, .75.'
      );
      return;
    }

    const palletsNumber = parseFloat(normalizedPalletsStr);

    if (Number.isNaN(palletsNumber) || palletsNumber <= 0) {
      setError('Liczba palet musi być większa od 0.');
      return;
    }

    const hoursWorked = diffSeconds / 3600;
    const avg = palletsNumber / hoursWorked;

    setAvgPalletsPerHour(avg);
    setDurationLabel(formatDuration(diffSeconds));

    // NOWA LOGIKA: godzina, gdy średnia spadnie do 48 palet/h
    if (avg > 48) {
      // t = P / 48 (w godzinach od startu)
      const hoursTo48 = palletsNumber / 48;
      const totalSecondsFromStart = Math.round(hoursTo48 * 3600);

      const targetSecondsOfDay =
        (startSeconds + totalSecondsFromStart) % secondsInDay;

      const targetHours = Math.floor(targetSecondsOfDay / 3600);
      const targetMinutes = Math.floor(
        (targetSecondsOfDay % 3600) / 60
      );

      const hh = String(targetHours).padStart(2, '0');
      const mm = String(targetMinutes).padStart(2, '0');

      setMaxUntilLabel(`${hh}:${mm}`);
    } else {
      setMaxUntilLabel('');
    }
  };


  const handleClear = () => {
    setStartTime(null);
    setEndTime(null);
    setShowStartPicker(false);
    setShowEndPicker(false);
    setPallets('');
    setError('');
    setAvgPalletsPerHour(null);
    setDurationLabel('');
    setMaxUntilLabel('');
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
      <View style={styles.card}>
        <Text style={styles.title}>Przelicz średnią</Text>
        <Text style={styles.description}>
          Uzupełnij dane i kliknij „Oblicz”, aby obliczyć średnią liczbę palet na godzinę.
        </Text>

        {/* Czas rozpoczęcia */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Czas rozpoczęcia</Text>
          <TouchableOpacity
            style={styles.timeInputButton}
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
              is24Hour
              display="default"
              onChange={onChangeStartTime}
            />
          )}
        </View>

        {/* Czas zakończenia */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Czas zakończenia</Text>
          <TouchableOpacity
            style={styles.timeInputButton}
            onPress={() => {
              // Ustaw aktualny czas urządzenia jako domyślny
              const now = new Date();
              setEndTime(now);
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
              is24Hour
              display="default"
              onChange={onChangeEndTime}
            />
          )}
        </View>

        {/* Liczba palet */}
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
      padding: 16,
      backgroundColor: palette.background,
      justifyContent: 'center',
    },
    card: {
      borderRadius: 16,
      padding: 20,
      backgroundColor: palette.cardBackground,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
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
    },
    formGroup: {
      marginBottom: 12,
    },
    label: {
      fontSize: 13,
      color: palette.textSecondary,
      marginBottom: 6,
    },
    // „Pseudo-input” dla wyboru czasu
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
