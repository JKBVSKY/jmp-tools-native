import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '../../_hooks/useColors';
import Spacer from '../../components/Spacer';

export default function TimeConverter() {
  const colors = useColors();
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
        throw new Error('Use format HH:MM or HH:MM:SS');
      }

      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseInt(parts[2]) || 0;

      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
        throw new Error('Invalid time values');
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
        throw new Error('Enter a number between 0 and 24');
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
        setError('Please enter a time');
        return;
      }
      convertToDecimal(standardTime);
    } else {
      if (!decimalTime.trim()) {
        setError('Please enter a decimal number');
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

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="calendar-clock"
          size={32}
          color={colors.text}
        />
        <Text style={[styles.title, { color: colors.title }]}>Time Converter</Text>
      </View>

      <Spacer height={24} />

      {/* Mode Selector */}
      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === 'toDecimal' && [styles.modeButtonActive, { backgroundColor: colors.butBackground }],
            { borderColor: colors.border }
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
            To Decimal
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === 'toStandard' && [styles.modeButtonActive, { backgroundColor: colors.butBackground }],
            { borderColor: colors.border }
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
            To Standard
          </Text>
        </TouchableOpacity>
      </View>

      <Spacer height={24} />

      {/* Input Card */}
      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>
          {mode === 'toDecimal' ? 'Enter Time (HH:MM:SS)' : 'Enter Decimal Hours'}
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

      <Spacer height={16} />

      {/* Convert Button */}
      <TouchableOpacity
        style={[styles.convertButton, { backgroundColor: colors.primary }]}
        onPress={handleConvert}
      >
        <MaterialCommunityIcons name="arrow-right" size={20} color={colors.text} />
        <Text style={[styles.convertButtonText, { color: colors.text }]}>Convert</Text>
      </TouchableOpacity>

      <Spacer height={16} />

      {/* Result Card */}
      {result && (
        <View style={[styles.resultCard, { backgroundColor: colors.cardBackground, borderColor: colors.selection }]}>
          <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Result</Text>
          <Spacer height={8} />
          <Text style={[styles.resultValue, { color: colors.selection }]}>
            {result}
          </Text>
          <Spacer height={12} />
          <TouchableOpacity
            style={[styles.copyButton, { backgroundColor: colors.selection + '20' }]}
            onPress={() => {
              // Implement copy to clipboard functionality
              alert('Result: ' + result);
            }}
          >
            <MaterialCommunityIcons name="content-copy" size={16} color={colors.selection} />
            <Text style={[styles.copyButtonText, { color: colors.selection }]}>Copy Result</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={[styles.errorCard, { backgroundColor: colors.selection + '15', borderColor: colors.selection }]}>
          <MaterialCommunityIcons name="alert-circle" size={20} color={colors.selection} />
          <Text style={[styles.errorText, { color: colors.selection }]}>{error}</Text>
        </View>
      )}

      <Spacer height={16} />

      {/* Info Cards */}
      <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="information" size={20} color={colors.text} />
        <Text style={[styles.infoTitle, { color: colors.title }]}>How it works</Text>
        <Spacer height={8} />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          {mode === 'toDecimal'
            ? '14:30:45 = 14 + (30/60) + (45/3600) = 14.5125 hours'
            : '14.5125 = 14 hours, 30 minutes, 45 seconds'}
        </Text>
      </View>

      <Spacer height={16} />

      {/* Clear Button */}
      <TouchableOpacity
        style={[styles.clearButton, { borderColor: colors.border }]}
        onPress={handleClear}
      >
        <MaterialCommunityIcons name="refresh" size={18} color={colors.text} />
        <Text style={[styles.clearButtonText, { color: colors.text }]}>Clear All</Text>
      </TouchableOpacity>

      <Spacer height={32} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
    gap: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
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
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    borderWidth: 0,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
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
  },
  convertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
  },
  convertButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
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
    marginTop: 12,
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
    borderRadius: 20,
    borderWidth: 2,
    gap: 6,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
