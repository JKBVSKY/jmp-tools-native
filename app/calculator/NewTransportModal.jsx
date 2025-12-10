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
} from "react-native";
import { Switch } from 'react-native';
import { useColors } from '../../_hooks/useColors';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

const db = getFirestore();

export default function NewTransportModal({ visible, onClose, onAdd }) {
  const colors = useColors();

  const getFieldConfigs = () => ({
    pallets: {
      min: 1,
      max: 50,
      label: 'Pallets',
    },
    gate: {
      min: 1,
      max: 53,
      label: 'Gate',
      // Gate stays static - or fetch from DB if you want
    },
    shop: {
      numbers: shopNumbers || [],  // Use fetched data
      label: 'Shop',
    },
    trailer: {
      numbers: trailerNumbers || [],  // Use fetched data
      label: 'Trailer',
    },
  });

  // Helper function to generate number range
  const generateRange = (min, max) => {
    const range = [];
    for (let i = min; i <= max; i++) {
      range.push(i);
    }
    return range;
  };

  // Updated filterOptions function
  const filterOptions = (value, fieldName) => {
    const config = getFieldConfigs()[fieldName];

    // Determine which array to use
    let allOptions = [];
    if (config.numbers && config.numbers.length > 0) {  // ← Check if numbers exist
      allOptions = config.numbers.sort((a, b) => a - b);
    } else {
      allOptions = generateRange(config.min, config.max);
    }

    // If no input value, return first 10 items
    if (!value) {
      return allOptions.slice(0, 10);
    }

    // Filter: numbers that START WITH the input value
    const filtered = allOptions.filter(option =>
      option.toString().startsWith(value.toString())
    );

    return filtered.slice(0, 10);
  };

  const [form, setForm] = useState({
    shop: "",
    gate: "",
    trailer: "",
    pallets: "",
  });

  // NEW: State for "Pallets in progress" checkbox
  const [palletsInProgress, setPalletsInProgress] = useState(false);

  // New state for dynamic data
  const [shopNumbers, setShopNumbers] = useState([]);
  const [trailerNumbers, setTrailerNumbers] = useState([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);

  // Existing state for dropdown
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [filteredOptions, setFilteredOptions] = useState([]);

  // Refs
  const scrollViewRef = useRef(null);
  const palletsInputRef = useRef(null);
  const shopInputRef = useRef(null);
  const gateInputRef = useRef(null);
  const trailerInputRef = useRef(null);

  // Add this useEffect to fetch data when modal becomes visible
  useEffect(() => {
    if (visible) {
      fetchNumbersFromDatabase();
    }
  }, [visible]);

  // Update the fetch function to use Firestore
  const fetchNumbersFromDatabase = async () => {
    try {
      setLoadingNumbers(true);

      // Fetch shop numbers
      const shopsSnapshot = await getDocs(collection(db, 'shopNumbers'));
      const shops = shopsSnapshot.docs
        .map(doc => doc.data().number)
        .sort((a, b) => a - b);

      // Fetch trailer numbers
      const trailersSnapshot = await getDocs(collection(db, 'trailerNumbers'));
      const trailers = trailersSnapshot.docs
        .map(doc => doc.data().number)
        .sort((a, b) => a - b);

      setShopNumbers(shops);
      setTrailerNumbers(trailers);

    } catch (error) {
      console.error('Error fetching numbers from Firestore:', error);
      // Fallback to empty arrays or defaults
      setShopNumbers([]);
      setTrailerNumbers([]);
    } finally {
      setLoadingNumbers(false);
    }
  };

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
    setActiveDropdown(null);
    setFilteredOptions([]);
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

  const handleInputFocus = (fieldName) => {
    setActiveDropdown(fieldName);

    // For gate field, show filtered options starting from middle value (25)
    if (fieldName === 'gate' && !form.gate) {
      const config = getFieldConfigs()[fieldName];
      const allOptions = generateRange(config.min, config.max);
      const filtered = allOptions.filter(option => option >= 25).slice(0, 10);
      setFilteredOptions(filtered);
    } else {
      // For other fields, use normal filtering
      const filtered = filterOptions(form[fieldName], fieldName);
      setFilteredOptions(filtered);
    }

    // Scroll the input into view
    scrollToInput(fieldName);
  };

  const handleInputChange = (name, value) => {
    // Update form value
    handleChange(name, value);

    // Update dropdown options if field is numeric
    if (['gate', 'shop', 'trailer'].includes(name)) {
      const filtered = filterOptions(value, name);
      setFilteredOptions(filtered);
    }
  };

  const handleSelectFromDropdown = (fieldName, value) => {
    setForm((prev) => ({ ...prev, [fieldName]: value.toString() }));
    setActiveDropdown(null);
    setFilteredOptions([]);
  };

  const handleInputBlur = () => { };

  const scrollToInput = (fieldName) => {
    // Map field names to their refs
    const refMap = {
      pallets: palletsInputRef,
      shop: shopInputRef,
      gate: gateInputRef,
      trailer: trailerInputRef,
    };

    const inputRef = refMap[fieldName];

    setTimeout(() => {
      inputRef?.current?.measure((fx, fy, width, height, px, py) => {
        scrollViewRef?.current?.scrollTo({
          y: py - 100,  // Scroll with 100px padding from top
          animated: true
        });
      });
    }, 100);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
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
                  New Transport
                </Text>
                <Text style={[styles.description, { color: colors.phText }]}>
                  Add details for the new transport
                </Text>

                {/* First Row: Pallets and Shop */}
                <View style={styles.inputRow}>
                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Pallets *</Text>
                    <TextInput
                      ref={palletsInputRef}
                      style={[
                        styles.inputSmall, { color: colors.text },
                        !isPalletsValid && form.pallets ? styles.inputError : null
                      ]}
                      value={form.pallets}
                      onChangeText={(value) => handleChange("pallets", value)}
                      placeholder="Pallets"
                      placeholderTextColor={colors.phText}
                      keyboardType="numeric"
                      onFocus={() => handleInputFocus('pallets')}
                      editable={!palletsInProgress}
                    />
                    {!isPalletsValid && form.pallets && (
                      <Text style={styles.errorText}>
                        Must be valid
                      </Text>
                    )}
                  </View>

                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Shop</Text>
                    <TextInput
                      ref={shopInputRef}
                      style={[styles.inputSmall, { color: colors.text }]}
                      value={form.shop}
                      onChangeText={(value) => handleInputChange("shop", value)}
                      placeholder="Shop"
                      placeholderTextColor={colors.phText}
                      keyboardType="numeric"
                      onFocus={() => handleInputFocus('shop')}
                      onBlur={handleInputBlur}
                    />
                    {activeDropdown === 'shop' && filteredOptions.length > 0 && (
                      <View style={styles.dropdown} pointerEvents="box-none">
                        <ScrollView
                          scrollEnabled={filteredOptions.length > 8}
                          nestedScrollEnabled={true}
                          style={{ maxHeight: 200 }}
                          keyboardShouldPersistTaps="handled"
                        >
                          {filteredOptions.map((option) => (
                            <TouchableOpacity
                              key={option}
                              style={styles.dropdownItem}
                              onPress={() => handleSelectFromDropdown('shop', option)}
                              activeOpacity={0.8}
                              touchSoundDisabled={true}
                            >
                              <Text style={[styles.dropdownItemText, { color: colors.phText }]}>{option}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.checkboxContainer}>
                  <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                    Pallets in progress
                  </Text>
                  <Switch
                    value={palletsInProgress}
                    onValueChange={handlePalletsInProgressChange}
                    trackColor={{ false: "#333", true: colors.butBackground }}
                    thumbColor={ "#fff" }
                  />
                </View>

                {/* Second Row: Gate and Trailer */}
                <View style={styles.inputRow}>
                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Gate</Text>
                    <TextInput
                      ref={gateInputRef}
                      style={[styles.inputSmall, { color: colors.text }]}
                      value={form.gate}
                      onChangeText={(value) => handleInputChange("gate", value)}
                      placeholder="Gate"
                      placeholderTextColor={colors.phText}
                      keyboardType="numeric"
                      onFocus={() => handleInputFocus('gate')}
                      onBlur={handleInputBlur}
                    />
                    {activeDropdown === 'gate' && filteredOptions.length > 0 && (
                      <View style={styles.dropdown} pointerEvents="box-none">
                        <ScrollView
                          scrollEnabled={filteredOptions.length > 8}
                          nestedScrollEnabled={true}
                          style={{ maxHeight: 200 }}
                          keyboardShouldPersistTaps="handled"
                        >
                          {filteredOptions.map((option) => (
                            <TouchableOpacity
                              key={option}
                              style={styles.dropdownItem}
                              onPress={() => handleSelectFromDropdown('gate', option)}
                              activeOpacity={0.8}
                              touchSoundDisabled={true}
                            >
                              <Text style={[styles.dropdownItemText, { color: colors.phText }]}>{option}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <View style={styles.inputHalf}>
                    <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Trailer</Text>
                    <TextInput
                      ref={trailerInputRef}
                      style={[styles.inputSmall, { color: colors.text }]}
                      value={form.trailer}
                      onChangeText={(value) => handleInputChange("trailer", value)}
                      placeholder="Trailer"
                      placeholderTextColor={colors.phText}
                      keyboardType="numeric"
                      onFocus={() => handleInputFocus('trailer')}
                      onBlur={handleInputBlur}
                    />
                    {activeDropdown === 'trailer' && filteredOptions.length > 0 && (
                      <View style={styles.dropdown} pointerEvents="box-none">
                        <ScrollView
                          scrollEnabled={filteredOptions.length > 8}
                          nestedScrollEnabled={true}
                          style={{ maxHeight: 200 }}
                          keyboardShouldPersistTaps="handled"
                        >
                          {filteredOptions.map((option) => (
                            <TouchableOpacity
                              key={option}
                              style={styles.dropdownItem}
                              onPress={() => handleSelectFromDropdown('trailer', option)}
                              activeOpacity={0.8}
                              touchSoundDisabled={true}
                            >
                              <Text style={[styles.dropdownItemText, { color: colors.phText }]}>{option}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>

                {/* Button Container */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { borderColor: colors.border }]}
                    onPress={handleClose}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                      Cancel
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
                        Add Transport
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
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    overflow: 'hidden',
    zIndex: 1000,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 20,
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