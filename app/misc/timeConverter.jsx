import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import Spacer from '../../components/Spacer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';

export default function TimeConverter() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('toDecimal'); // 'toDecimal' or 'toStandard'
  const [standardTime, setStandardTime] = useState('');
  const [decimalTime, setDecimalTime] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  // Convert HH:MM:SS to decimal hours
  const convertToDecimal = (time) => {
    try {
      setError('');
      const parts = time.split(':');

      if (parts.length < 2 || parts.length > 3) {
        throw new Error('Proszę wprowadzić czas w formacie HH:MM lub HH:MM:SS');
      }

      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseInt(parts[2]) || 0;

      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
        throw new Error('Proszę wprowadzić poprawne wartości czasu');
      }

      const decimal = (hours + minutes / 60 + seconds / 3600).toFixed(4);
      setResult(parseFloat(decimal).toString());
      setDecimalTime('');
    } catch (err) {
      setError(err.message);
      setResult('');
    }
  };

  // Convert decimal hours to HH:MM:SS
  const convertToStandard = (decimal) => {
    try {
      setError('');
      const num = parseFloat(decimal);

      if (isNaN(num) || num < 0 || num > 24) {
        throw new Error('Proszę wprowadzić liczbę między 0 a 24');
      }

      const hours = Math.floor(num);
      const minutesDecimal = (num - hours) * 60;
      const minutes = Math.floor(minutesDecimal);
      const seconds = Math.round((minutesDecimal - minutes) * 60);

      const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setResult(formatted);
      setStandardTime('');
    } catch (err) {
      setError(err.message);
      setResult('');
    }
  };

  const handleConvert = () => {
    if (mode === 'toDecimal') {
      if (!standardTime.trim()) {
        setError('Proszę wprowadzić czas w formacie HH:MM lub HH:MM:SS');
        return;
      }
      convertToDecimal(standardTime);
    } else {
      if (!decimalTime.trim()) {
        setError('Proszę wprowadzić liczbę dziesiętną');
        return;
      }
      convertToStandard(decimalTime);
    }
  };

  const handleClear = () => {
    setStandardTime('');
    setDecimalTime('');
    setResult('');
    setError('');
  };

  const handleCopyResult = async () => {
    if (!result) {
      Alert.alert('Brak wyniku', 'Najpierw wykonaj przeliczenie.');
      return;
    }

    await Clipboard.setStringAsync(result);
    Alert.alert('Skopiowano', 'Wynik został zapisany do schowka.');
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.navBackground }]}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Wybierz tryb konwersji, wprowadź czas i kliknij „Przelicz”, aby zobaczyć wynik. Możesz konwertować między formatem standardowym (HH:MM:SS) a dziesiętnym (godziny dziesiętne).
        </Text>

        {/* Mode Selector */}
        <View style={styles.modeContainer}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'toDecimal' ? [styles.modeButtonActive, { backgroundColor: colors.butBackground, borderColor: colors.butBorder }] : { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder },
            ]}
            onPress={() => {
              setMode('toDecimal');
              handleClear();
            }}
          >
            <Text
              style={[
                styles.modeButtonText,
                mode === 'toDecimal' ? { color: colors.butText } : { color: colors.text }
              ]}
            >
              Na Dziesiętny
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'toStandard' ? [styles.modeButtonActive, { backgroundColor: colors.butBackground, borderColor: colors.butBorder }]
                : { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder },
            ]}
            onPress={() => {
              setMode('toStandard');
              handleClear();
            }}
          >
            <Text
              style={[
                styles.modeButtonText,
                mode === 'toStandard' ? { color: colors.butText } : { color: colors.text }
              ]}
            >
              Na Standardowy
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={{ flex: 1 }}

      >
        <View style={styles.content}>
          <View style={styles.contentTop}>
            {/* Input Card */}
            <View style={styles.card}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {mode === 'toDecimal' ? 'Wprowadź Czas (HH:MM:SS)' : 'Wprowadź Godziny (dziesiętne)'}
              </Text>
              <Spacer height={12} />

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: error ? colors.selection : colors.inputBorder,
                    color: colors.text
                  }
                ]}
                placeholder={mode === 'toDecimal' ? '14:30:45' : '14.5'}
                placeholderTextColor={colors.phText}
                value={mode === 'toDecimal' ? standardTime : decimalTime}
                onChangeText={(text) => {
                  if (mode === 'toDecimal') {
                    setStandardTime(text);
                  } else {
                    setDecimalTime(text);
                  }
                  setError('');
                  setResult('');
                }}
                keyboardType={mode === 'toDecimal' ? 'default' : 'decimal-pad'}
              />
            </View>

            {/* Error Message */}
            {error && (
              <View style={[styles.errorCard, { backgroundColor: colors.selection + '15', borderColor: colors.selection }]}>
                <MaterialCommunityIcons name="alert-circle" size={20} color={colors.selection} />
                <Text style={[styles.errorText, { color: colors.selection }]}>{error}</Text>
              </View>
            )}

            {/* Convert Button */}
            <TouchableOpacity
              style={[styles.convertButton, { backgroundColor: colors.butBackground, }]}
              onPress={handleConvert}
            >
              <MaterialCommunityIcons name="arrow-right" size={20} color={colors.text} />
              <Text style={[styles.convertButtonText, { color: colors.butText }]}>Przelicz</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contentMid}>
            {/* Result Card */}
            {result && (
              <View style={[styles.resultCard, { backgroundColor: colors.cardBackground, borderColor: colors.selection }]}>
                <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Wynik</Text>
                <Spacer height={8} />
                <Text style={[styles.resultValue, { color: colors.selection }]}>
                  {result}
                </Text>
                <Spacer height={12} />
                <TouchableOpacity
                  style={[styles.copyButton, { backgroundColor: colors.selection + '20' }]}
                  onPress={handleCopyResult}
                >
                  <MaterialCommunityIcons name="content-copy" size={16} color={colors.selection} />
                  <Text style={[styles.copyButtonText, { color: colors.selection }]}>Kopiuj Wynik</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.contentBottom}>
            {/* Info Cards */}
            <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 2 }]}>
              <MaterialCommunityIcons name="information" size={20} color={colors.text} />
              <Text style={[styles.infoTitle, { color: colors.title }]}>Jak to działa</Text>
              <Spacer height={8} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                {mode === 'toDecimal'
                  ? '14:30:45 = 14 + (30/60) + (45/3600) = 14.5125 godzin'
                  : '14.5125 = 14 godzin, 30 minut, 45 sekund'}
              </Text>
            </View>
            {/* Clear Button */}
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]}
              onPress={handleClear}
            >
              <MaterialCommunityIcons name="refresh" size={18} color={colors.text} />
              <Text style={[styles.clearButtonText, { color: colors.text }]}>Wyczyść Wszystko</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 5,
  },
  header: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginBottom: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'flex-start',
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
  },
  convertButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  resultCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    marginVertical: 16,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  resultValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  infoCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginVertical: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    gap: 6,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
