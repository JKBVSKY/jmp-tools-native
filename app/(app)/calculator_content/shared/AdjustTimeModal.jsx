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
  Alert,
} from "react-native";
import { useColors } from '@/_hooks/useColors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CustomTimePicker from './CustomTimePicker';
import { getFinishTimeRange, isFinishTimeValid } from '@/_utils/timeUtils';

export default function AdjustTimeModal({ visible, onClose, onConfirm, initialTime, type = 'start', startTime = null }) {
  const colors = useColors();

  // Define content based on type
  const getModalContent = () => {
    const contents = {
      start: {
        title: 'Czas rozpoczęcia',
        description: 'Wybierz czas "strzelenia" pierwszej palety.'
      },
      finish: {
        title: 'Czas zakończenia',
        description: 'Wybierz kiedy kalkulator ma zakończyć pracę (w przypadku, gdy użytkownik zapomni manualnie wyłączyć).'
      }
    };
    return contents[type] || contents.start;
  };

  const { title, description } = getModalContent();

  // Get time constraints for finish type
  const timeRange = type === 'finish' && startTime ? getFinishTimeRange(startTime) : null;

  // Parse initial time into hours, minutes, seconds
  const getTimeComponents = (timestamp) => {
    let date = timestamp ? new Date(timestamp) : new Date();
    return {
      hours: String(date.getHours()).padStart(2, '0'),
      minutes: String(date.getMinutes()).padStart(2, '0'),
      seconds: String(date.getSeconds()).padStart(2, '0')
    };
  };

  const initial = getTimeComponents(initialTime);
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [seconds, setSeconds] = useState(initial.seconds);
  const [validationError, setValidationError] = useState('');

  // Update when modal opens with new initialTime
  useEffect(() => {
    if (visible) {
      const { hours: h, minutes: m, seconds: s } = getTimeComponents(initialTime);
      setHours(h);
      setMinutes(m);
      setSeconds(s);
      setValidationError('');
    }
  }, [initialTime, visible]);

  // Handle "Now" button - set to current time
  const handleSetNow = () => {
    const now = new Date();
    setHours(String(now.getHours()).padStart(2, '0'));
    setMinutes(String(now.getMinutes()).padStart(2, '0'));
    setSeconds(String(now.getSeconds()).padStart(2, '0'));
    setValidationError('');
  };

  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const handleOpenTimePicker = () => {
    setShowCustomPicker(true);
  };

  const handleCustomPickerConfirm = (h, m, s) => {
    setHours(h);
    setMinutes(m);
    setSeconds(s);
    setShowCustomPicker(false);
    setValidationError('');
  };

  const handleTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      setHours(String(selectedDate.getHours()).padStart(2, '0'));
      setMinutes(String(selectedDate.getMinutes()).padStart(2, '0'));
      setSeconds('00');
    }
  };

  // Validate and format input
  const handleHoursChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 2) return;

    const num = parseInt(cleaned, 10);

    // For finish type, validate against max hours
    if (type === 'finish' && timeRange && cleaned.length === 2) {
      const maxHours = parseInt(timeRange.maxHours, 10);
      if (num > maxHours) return;
    } else if (cleaned.length === 2 && num > 23) {
      return;
    }

    setHours(cleaned);
    setValidationError('');
  };

  const handleMinutesChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 2) return;

    const num = parseInt(cleaned, 10);
    if (cleaned.length === 2 && num > 59) return;

    setMinutes(cleaned);
    setValidationError('');
  };

  const handleSecondsChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 2) return;

    const num = parseInt(cleaned, 10);
    if (cleaned.length === 2 && num > 59) return;

    setSeconds(cleaned);
    setValidationError('');
  };

  // Check if all fields are filled with 2 digits
  const isValid = hours.length === 2 && minutes.length === 2 && seconds.length === 2;

  const handleOk = () => {
    if (!isValid) return;

    const now = new Date();
    const adjusted = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      parseInt(hours, 10),
      parseInt(minutes, 10),
      parseInt(seconds, 10)
    ).getTime();

    // For finish type, validate against start time
    if (type === 'finish' && startTime) {
      if (!isFinishTimeValid(adjusted, startTime)) {
        setValidationError(
          `Czas musi być między ${timeRange.minHours}:${timeRange.minMinutes} a ${timeRange.maxHours}:${timeRange.maxMinutes}`
        );
        return;
      }
    }

    onConfirm(adjusted);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={ styles.modalContainer }>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {description}
              </Text>

              {/* Show time range for finish type */}
              {type === 'finish' && timeRange && (
                <Text style={[styles.rangeInfo, { color: colors.textSecondary }]}>
                  Zakres: {timeRange.minHours}:{timeRange.minMinutes} - {timeRange.maxHours}:{timeRange.maxMinutes}
                </Text>
              )}

              {/* Helper buttons row */}
              <View style={styles.helperButtonsRow}>
                <TouchableOpacity
                  style={[styles.helperButton, { borderColor: colors.primary }]}
                  onPress={handleSetNow}
                >
                  <MaterialCommunityIcons name="clock-outline" size={16} color={colors.text} />
                  <Text style={[styles.helperButtonText, { color: colors.text }]}>Teraz</Text>
                </TouchableOpacity>

                {Platform.OS === 'android' && (
                  <TouchableOpacity
                    style={[styles.helperButton, { borderColor: colors.primary }]}
                    onPress={handleOpenTimePicker}
                  >
                    <MaterialCommunityIcons name="calendar-clock" size={16} color={colors.text} />
                    <Text style={[styles.helperButtonText, { color: colors.text }]}>Wybierz</Text>
                  </TouchableOpacity>
                )}
              </View>

            {/* Time Input Row */}
            <View style={styles.timeInputContainer}>
              {/* Hours */}
              <TextInput
                style={[
                  styles.timeInput,
                  {
                    color: colors.text,
                    borderColor: hours.length === 2 ? colors.selection : colors.border
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

              {/* Minutes */}
              <TextInput
                style={[
                  styles.timeInput,
                  {
                    color: colors.text,
                    borderColor: minutes.length === 2 ? colors.selection : colors.border
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

              {/* Seconds */}
              <TextInput
                style={[
                  styles.timeInput,
                  {
                    color: colors.text,
                    borderColor: seconds.length === 2 ? colors.selection : colors.border
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

              {/* Helper text */}
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                Format: HH : MM : SS
              </Text>

              {/* Validation error */}
              {validationError && (
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                  {validationError}
                </Text>
              )}

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={onClose}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>Anuluj</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.okButton,
                    { backgroundColor: isValid ? colors.butBackground : '#999' }
                  ]}
                  onPress={handleOk}
                  disabled={!isValid}
                >
                  <Text style={styles.okButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
              {showCustomPicker && (
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
                    <CustomTimePicker
                      onConfirm={handleCustomPickerConfirm}
                      onCancel={() => setShowCustomPicker(false)}
                    />
                   </View>
              )}
      </View>
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
  rangeInfo: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
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
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
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