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
  ScrollView
} from "react-native";
import { useColors } from '../../_hooks/useColors';

export default function NewTransportModal({ visible, onClose, onAdd }) {
  const colors = useColors();
  const [form, setForm] = useState({
    shop: "",
    gate: "",
    trailer: "",
    pallets: "",
  });
  const [showOptional, setShowOptional] = useState(false);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    onClose();
    setForm({ shop: "", gate: "", trailer: "", pallets: "" });
    setShowOptional(false);
  };

  const isPalletsValid = form.pallets &&
    Number(form.pallets) > 0 &&
    (Number(form.pallets) * 100) % 25 === 0;

  const handleAdd = () => {
    if (isPalletsValid) {
      onAdd(form);
      handleClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.title, { color: colors.text }]}>New Transport</Text>
              <Text style={[styles.description, { color: colors.text }]}>
                Add details for the new transport
              </Text>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Pallets *</Text>
                <TextInput
                  style={[
                    styles.input, { color: colors.text }, 
                    !isPalletsValid && form.pallets ? styles.inputError : null
                  ]}
                  value={form.pallets}
                  onChangeText={(value) => handleChange("pallets", value)}
                  placeholder="Enter number of pallets"
                  placeholderTextColor={colors.phText}
                  keyboardType="numeric"
                />
                {!isPalletsValid && form.pallets && (
                  <Text style={styles.errorText}>
                    Must be a positive number divisible by 0.25
                  </Text>
                )}
              </View>

              {!showOptional && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowOptional(true)}
                >
                  <Text style={[styles.showMoreText, { color: colors.text }]}>+ Show optional fields</Text>
                </TouchableOpacity>
              )}

              {showOptional && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Shop</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={form.shop}
                      onChangeText={(value) => handleChange("shop", value)}
                      placeholder="Shop number"
                      placeholderTextColor={colors.phText}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Gate</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={form.gate}
                      onChangeText={(value) => handleChange("gate", value)}
                      placeholder="Gate number"
                      placeholderTextColor={colors.phText}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Trailer</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={form.trailer}
                      onChangeText={(value) => handleChange("trailer", value)}
                      placeholder="Trailer number"
                      placeholderTextColor={colors.phText}
                    />
                  </View>
                </>
              )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.outButBackground }]} onPress={handleClose}>
                  <Text style={[styles.cancelButtonText, { color: colors.outButText }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.addButton, { backgroundColor: colors.butBackground },
                    !isPalletsValid && styles.addButtonDisabled
                  ]}
                  onPress={handleAdd}
                  disabled={!isPalletsValid}
                >
                  <Text style={[
                    styles.addButtonText, { color: colors.butText },
                    !isPalletsValid && styles.addButtonTextDisabled
                  ]}>
                    Add Transport
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
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
  showMoreButton: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  showMoreText: {
    fontSize: 14,
    textDecorationLine: 'underline',
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
});