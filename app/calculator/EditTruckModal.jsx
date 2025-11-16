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

export default function EditTruckModal({ visible, truck, onClose, onSave }) {
  const [form, setForm] = useState({
    shop: "",
    gate: "",
    trailer: "",
    pallets: "",
  });

  useEffect(() => {
    if (truck) {
      setForm({
        shop: truck.shop || "",
        gate: truck.gate || "",
        trailer: truck.trailer || "",
        pallets: truck.pallets || "",
      });
    }
  }, [truck, visible]);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const isPalletsValid = form.pallets && 
    Number(form.pallets) > 0 && 
    (Number(form.pallets) * 100) % 25 === 0;

  const handleSave = () => {
    if (isPalletsValid) {
      onSave({ ...truck, ...form });
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Edit Transport</Text>
              <Text style={styles.description}>
                Edit transport #{truck?.displayId}
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Pallets *</Text>
                <TextInput
                  style={[
                    styles.input,
                    !isPalletsValid && form.pallets ? styles.inputError : null
                  ]}
                  value={form.pallets}
                  onChangeText={(value) => handleChange("pallets", value)}
                  placeholder="Enter number of pallets"
                  keyboardType="numeric"
                />
                {!isPalletsValid && form.pallets && (
                  <Text style={styles.errorText}>
                    Must be a positive number divisible by 0.25
                  </Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Shop</Text>
                <TextInput
                  style={styles.input}
                  value={form.shop}
                  onChangeText={(value) => handleChange("shop", value)}
                  placeholder="Shop number"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Gate</Text>
                <TextInput
                  style={styles.input}
                  value={form.gate}
                  onChangeText={(value) => handleChange("gate", value)}
                  placeholder="Gate number"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Trailer</Text>
                <TextInput
                  style={styles.input}
                  value={form.trailer}
                  onChangeText={(value) => handleChange("trailer", value)}
                  placeholder="Trailer number"
                />
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.saveButton,
                    !isPalletsValid && styles.saveButtonDisabled
                  ]} 
                  onPress={handleSave}
                  disabled={!isPalletsValid}
                >
                  <Text style={[
                    styles.saveButtonText,
                    !isPalletsValid && styles.saveButtonTextDisabled
                  ]}>
                    Save Changes
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
    backgroundColor: 'white',
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
    color: '#b30000',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#444',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#333',
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
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  cancelButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#c50000',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#999',
  },
});