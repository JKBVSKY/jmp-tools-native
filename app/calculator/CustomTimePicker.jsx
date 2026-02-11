import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '../../_hooks/useColors';

const { height } = Dimensions.get('window');

export default function CustomTimePicker({ 
  initialHours = '00', 
  initialMinutes = '00',
  initialSeconds = '00',
  onConfirm, 
  onCancel 
}) {
  const colors = useColors();
  const [hours, setHours] = useState(parseInt(initialHours, 10));
  const [minutes, setMinutes] = useState(parseInt(initialMinutes, 10));
  const [seconds, setSeconds] = useState(parseInt(initialSeconds, 10));

  const hours24 = Array.from({ length: 24 }, (_, i) => i);
  const mins60 = Array.from({ length: 60 }, (_, i) => i);
  const secs60 = Array.from({ length: 60 }, (_, i) => i);

  const handleConfirm = () => {
    onConfirm(
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0')
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={[styles.headerButton, { color: colors.text }]}>Anuluj</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Wybór Czasu</Text>
        <TouchableOpacity onPress={handleConfirm}>
          <Text style={[styles.headerButton, { color: colors.selection, fontWeight: 'bold' }]}>OK</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.timeDisplay}>
        <Text style={[styles.timeValue, { color: colors.text }]}>
          {String(hours).padStart(2, '0')}
        </Text>
        <Text style={[styles.timeSeparator, { color: colors.text }]}>:</Text>
        <Text style={[styles.timeValue, { color: colors.text }]}>
          {String(minutes).padStart(2, '0')}
        </Text>
        <Text style={[styles.timeSeparator, { color: colors.text }]}>:</Text>
        <Text style={[styles.timeValue, { color: colors.text }]}>
          {String(seconds).padStart(2, '0')}
        </Text>
      </View>

      <View style={styles.pickersContainer}>
        {/* Hours Picker */}
        <View style={styles.pickerColumn}>
          <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Godzina</Text>
          <ScrollView
            style={[styles.scrollPicker, { borderColor: colors.border }]}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const offset = e.nativeEvent.contentOffset.y;
              const index = Math.round(offset / 40);
              setHours(Math.max(0, Math.min(23, index)));
            }}
          >
            {hours24.map((h) => (
              <TouchableOpacity
                key={h}
                onPress={() => setHours(h)}
                style={[
                  styles.pickerItem,
                  h === hours && [styles.pickerItemActive, { backgroundColor: colors.border }]
                ]}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    { color: h === hours ? colors.selection : colors.text },
                    h === hours && { fontWeight: 'bold', fontSize: 18 }
                  ]}
                >
                  {String(h).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Minutes Picker */}
        <View style={styles.pickerColumn}>
          <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Minuta</Text>
          <ScrollView
            style={[styles.scrollPicker, { borderColor: colors.border }]}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const offset = e.nativeEvent.contentOffset.y;
              const index = Math.round(offset / 40);
              setMinutes(Math.max(0, Math.min(59, index)));
            }}
          >
            {mins60.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMinutes(m)}
                style={[
                  styles.pickerItem,
                  m === minutes && [styles.pickerItemActive, { backgroundColor: colors.border }]
                ]}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    { color: m === minutes ? colors.selection : colors.text },
                    m === minutes && { fontWeight: 'bold', fontSize: 18 }
                  ]}
                >
                  {String(m).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Seconds Picker */}
        <View style={styles.pickerColumn}>
          <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Sekunda</Text>
          <ScrollView
            style={[styles.scrollPicker, { borderColor: colors.border }]}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const offset = e.nativeEvent.contentOffset.y;
              const index = Math.round(offset / 40);
              setSeconds(Math.max(0, Math.min(59, index)));
            }}
          >
            {secs60.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSeconds(s)}
                style={[
                  styles.pickerItem,
                  s === seconds && [styles.pickerItemActive, { backgroundColor: colors.border }]
                ]}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    { color: s === seconds ? colors.selection : colors.text },
                    s === seconds && { fontWeight: 'bold', fontSize: 18 }
                  ]}
                >
                  {String(s).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: height * 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerButton: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  timeValue: {
    fontSize: 48,
    fontWeight: 'bold',
    minWidth: 80,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 48,
    fontWeight: 'bold',
    marginHorizontal: 4,
  },
  pickersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  scrollPicker: {
    borderWidth: 1,
    borderRadius: 12,
    height: 200,
    paddingHorizontal: 8,
  },
  pickerItem: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemActive: {
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 16,
  },
});
