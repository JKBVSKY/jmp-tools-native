import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import { useColors } from "@/_hooks/useColors";

export default function NewTransportModal({ visible, onClose, onAdd }) {
  const colors = useColors();

  const [form, setForm] = useState({
    shop: "",
    gate: "",
    trailer: "",
    pallets: "",
  });

  // State for "Pallets in progress" checkbox
  const [palletsInProgress, setPalletsInProgress] = useState(false);

  // Refs
  const scrollViewRef = useRef(null);
  const palletsInputRef = useRef(null);
  const shopInputRef = useRef(null);
  const gateInputRef = useRef(null);
  const trailerInputRef = useRef(null);

  const handleChange = (name, value) => {
    if (name === "pallets") {
      // Allow decimals and empty string
      if (value === '' || !isNaN(value)) {
        const numValue = Number(value);
        // Only update if empty or if number is between 0 and 50
        if (value === '' || (numValue > 0 && numValue <= 50)) {
          setForm((prev) => ({ ...prev, [name]: value }));
        }
      }
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleClose = () => {
    onClose();
    setForm({ shop: "", gate: "", trailer: "", pallets: "" });
    setPalletsInProgress(false);
  };

  const isPalletsValid = form.pallets &&
    Number(form.pallets) > 0 &&
    (Number(form.pallets) * 100) % 25 === 0;

  const canAddTransport = isPalletsValid || palletsInProgress;

  const handleAdd = () => {
    if (canAddTransport) {
      // If "Pallets in progress" is checked, don't include pallets in the form
      const dataToAdd = {
        ...form,
        palletsInProgress: palletsInProgress,
      };
      onAdd(dataToAdd);
      handleClose();
    }
  };

  // NEW: Handler for switch toggle - clears pallets when switch is turned ON
  const handlePalletsInProgressChange = (value) => {
    setPalletsInProgress(value);
    // Clear pallets input when switch is turned ON
    if (value === true) {
      setForm((prev) => ({ ...prev, pallets: "" }));
    }
  };

  const handleInputChange = (name, value) => {
    // Update form value
    handleChange(name, value);
  };

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        if (palletsInputRef.current) {
          palletsInputRef.current.focus();
        }
      }, 300); // small delay so Modal is fully shown
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
        >
          <ScrollView
            ref={scrollViewRef}
            style={{ width: '100%' }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
            scrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <View style={[styles.modalContent, { backgroundColor: colors.background }]}>

                {/* Title */}
                <Text style={[styles.title, { color: colors.text }]}>
                  Nowy Transport
                </Text>
                <Text style={[styles.description, { color: colors.phText }]}>
                  Dodaj szczegóły dotyczące nowego transportu.
                </Text>

                {/* First Row: Pallets and Shop */}
                <View style={styles.inputRow}>
                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Sklep</Text>
                    <TextInput
                      ref={shopInputRef}
                      style={[
                        styles.inputSmall,
                        {
                          backgroundColor: colors.inputBackground,
                          color: colors.text,
                          borderColor: colors.border
                        }
                      ]}
                      value={form.shop}
                      onChangeText={(value) => handleInputChange("shop", value)}
                      placeholder="Sklep"
                      placeholderTextColor={colors.phText}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Palety *</Text>
                    <TextInput
                      ref={palletsInputRef}
                      style={[
                        styles.inputSmall,
                        {
                          backgroundColor: palletsInProgress ? 'transparent' : colors.inputBackground,
                          color: colors.text,
                          borderColor: palletsInProgress ? 'red' : colors.border
                        },
                        !isPalletsValid && form.pallets && styles.inputError
                      ]}
                      value={form.pallets}
                      onChangeText={(value) => handleChange("pallets", value)}
                      placeholder={palletsInProgress ? "W TRAKCIE" : "Palety"}
                      placeholderTextColor={palletsInProgress ? "red" : colors.phText}
                      keyboardType="numeric"
                      editable={!palletsInProgress}
                    />
                    {!isPalletsValid && form.pallets && (
                      <Text style={styles.errorText}>
                        Must be valid
                      </Text>
                    )}
                  </View>
                </View>

                {/* Second Row: Gate and Trailer */}
                <View style={styles.inputRow}>
                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Brama</Text>
                    <TextInput
                      ref={gateInputRef}
                      style={[
                        styles.inputSmall,
                        {
                          backgroundColor: colors.inputBackground,
                          color: colors.text,
                          borderColor: colors.border
                        }
                      ]}
                      value={form.gate}
                      onChangeText={(value) => handleInputChange("gate", value)}
                      placeholder="Brama"
                      placeholderTextColor={colors.phText}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Naczepa</Text>
                    <TextInput
                      ref={trailerInputRef}
                      style={[
                        styles.inputSmall,
                        {
                          backgroundColor: colors.inputBackground,
                          color: colors.text,
                          borderColor: colors.border
                        }
                      ]}
                      value={form.trailer}
                      onChangeText={(value) => handleInputChange("trailer", value)}
                      placeholder="Naczepa"
                      placeholderTextColor={colors.phText}
                      keyboardType="numeric"
                    />

                  </View>
                </View>

                {/* Pallets in Progress Switch */}
                <View style={[styles.checkboxContainer, { backgroundColor: colors.inputBackground, borderRadius: 8, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.checkboxLabel, { color: colors.text }]}>Palety w trakcie</Text>
                  <Switch
                    value={palletsInProgress}
                    onValueChange={handlePalletsInProgressChange}
                    trackColor={{ false: "#333", true: colors.butBackground }}
                    thumbColor={"#fff"}
                  />
                </View>

                {/* Button Container */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: colors.outButBackground, borderColor: colors.border }]}
                    onPress={handleClose}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                      Anuluj
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAdd}
                    disabled={!canAddTransport}
                    style={[
                      styles.addButton,
                      canAddTransport
                        ? { backgroundColor: colors.butBackground || '#2B8087' }
                        : { backgroundColor: colors.disabled || '#ccc' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.addButtonText,
                        canAddTransport
                          ? { color: colors.buttonText || '#fff' }
                          : { color: colors.disabledText || '#999' },
                      ]}
                    >
                      Dodaj Transport
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
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
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  cancelButtonText: {
    textAlign: 'center',
    fontSize: 16,
  },
  addButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: '#999',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },

  inputHalf: {
    flex: 1,
  },

  inputLabelHalf: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },

  inputSmall: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});