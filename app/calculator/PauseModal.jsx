import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert
} from "react-native";
import { useColors } from '../../_hooks/useColors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CustomTimePicker from './CustomTimePicker';


export default function PauseModal({ visible, onClose, onConfirm }) {
  const colors = useColors();

  // Parse current time into hours, minutes, seconds
  const getTimeComponents = (date = new Date()) => {
    return {
      hours: String(date.getHours()).padStart(2, '0'),
      minutes: String(date.getMinutes()).padStart(2, '0'),
      seconds: String(date.getSeconds()).padStart(2, '0')
    };
  };

  const initial = getTimeComponents();
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [seconds, setSeconds] = useState(initial.seconds);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      const { hours: h, minutes: m, seconds: s } = getTimeComponents();
      setHours(h);
      setMinutes(m);
      setSeconds(s);
    }
  }, [visible]);

  // Handle "Now" button - set to current time
  const handleSetNow = () => {
    const now = new Date();
    setHours(String(now.getHours()).padStart(2, '0'));
    setMinutes(String(now.getMinutes()).padStart(2, '0'));
    setSeconds(String(now.getSeconds()).padStart(2, '0'));
  };

  // Handle custom time picker
  const handleOpenTimePicker = () => {
    setShowCustomPicker(true);
  };

  const handleCustomPickerConfirm = (h, m, s) => {
    setHours(h);
    setMinutes(m);
    setSeconds(s);
    setShowCustomPicker(false);
  };

  // Validate and format input
  const handleHoursChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 2) return;
    const num = parseInt(cleaned, 10);
    if (cleaned.length === 2 && num > 23) return;
    setHours(cleaned);
  };

  const handleMinutesChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 2) return;
    const num = parseInt(cleaned, 10);
    if (cleaned.length === 2 && num > 59) return;
    setMinutes(cleaned);
  };

  const handleSecondsChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 2) return;
    const num = parseInt(cleaned, 10);
    if (cleaned.length === 2 && num > 59) return;
    setSeconds(cleaned);
  };

  // Check if all fields are filled with 2 digits
  const isValid = hours.length === 2 && minutes.length === 2 && seconds.length === 2;

  const handleOk = () => {
    if (!isValid) return;

    // Format as "HH:MM:SS" string
    const pauseTimeStr = `${hours}:${minutes}:${seconds}`;
    onConfirm(pauseTimeStr);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              Zatrzymaj
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Kiedy chcesz się zatrzymać?
            </Text>

            {/* Helper buttons row */}
            <View style={styles.helperButtonsRow}>
              <TouchableOpacity
                style={[styles.helperButton, { borderColor: colors.border }]}
                onPress={handleSetNow}
              >
                <MaterialCommunityIcons name="clock-check" size={18} color={colors.text} />
                <Text style={[styles.helperButtonText, { color: colors.text }]}>Teraz</Text>
              </TouchableOpacity>

              {Platform.OS === 'android' && (
                <TouchableOpacity
                  style={[styles.helperButton, { borderColor: colors.border }]}
                  onPress={handleOpenTimePicker}
                >
                  <MaterialCommunityIcons name="clock-outline" size={18} color={colors.text} />
                  <Text style={[styles.helperButtonText, { color: colors.text }]}>Wybierz czas</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Time Input Row */}
            <View style={styles.timeInputContainer}>
              <TextInput
                style={[
                  styles.timeInput,
                  {
                    color: colors.text,
                    borderColor: hours.length === 2 ? '#999' : colors.border
                  }
                ]}
                value={hours}
                onChangeText={handleHoursChange}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="00"
                placeholderTextColor={colors.textSecondary}
                selectTextOnFocus
              />

              <Text style={[styles.separator, { color: colors.text }]}>:</Text>

              <TextInput
                style={[
                  styles.timeInput,
                  {
                    color: colors.text,
                    borderColor: minutes.length === 2 ? '#999' : colors.border
                  }
                ]}
                value={minutes}
                onChangeText={handleMinutesChange}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="00"
                placeholderTextColor={colors.textSecondary}
                selectTextOnFocus
              />

              <Text style={[styles.separator, { color: colors.text }]}>:</Text>

              <TextInput
                style={[
                  styles.timeInput,
                  {
                    color: colors.text,
                    borderColor: seconds.length === 2 ? '#999' : colors.border
                  }
                ]}
                value={seconds}
                onChangeText={handleSecondsChange}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="00"
                placeholderTextColor={colors.textSecondary}
                selectTextOnFocus
              />
            </View>

            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Format: HH : MM : SS
            </Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  Anuluj
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.okButton,
                  {
                    backgroundColor: isValid ? colors.butBackground : colors.border,
                    opacity: isValid ? 1 : 0.5
                  }
                ]}
                onPress={handleOk}
                disabled={!isValid}
              >
                <Text style={styles.okButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {/* Custom Time Picker */}
        {showCustomPicker && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
            <CustomTimePicker
              initialHours={hours}
              initialMinutes={minutes}
              initialSeconds={seconds}
              onConfirm={handleCustomPickerConfirm}
              onCancel={() => setShowCustomPicker(false)}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  helperButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  helperButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  helperButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  timeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeInput: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 70,
  },
  separator: {
    fontSize: 28,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  helperText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    textAlign: 'center',
    fontSize: 16,
  },
  okButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  okButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
