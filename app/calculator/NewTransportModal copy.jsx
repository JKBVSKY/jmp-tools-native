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
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

const db = getFirestore();

export default function NewTransportModal({ visible, onClose, onAdd }) {
  const colors = useColors();

  const getFieldConfigs = () => ({
    gate: {
      min: 1,
      max: 53,
      label: 'Gate',
      // Gate stays static - or fetch from DB if you want
    },
    shop: {
      numbers: shopNumbers,  // Use fetched data
      label: 'Shop',
    },
    trailer: {
      numbers: trailerNumbers,  // Use fetched data
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
    if (config.numbers) {
      // Use database numbers
      allOptions = config.numbers.sort((a, b) => a - b);
    } else {
      // Use static range (for gate)
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
  const [showOptional, setShowOptional] = useState(false);

  // New state for dynamic data
  const [shopNumbers, setShopNumbers] = useState([]);
  const [trailerNumbers, setTrailerNumbers] = useState([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);

  // Existing state for dropdown
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [filteredOptions, setFilteredOptions] = useState([]);

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

      console.log('Fetched shops:', shops);
      console.log('Fetched trailers:', trailers);
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

  const handleInputFocus = (fieldName) => {
    setActiveDropdown(fieldName);
    const filtered = filterOptions(form[fieldName], fieldName);
    setFilteredOptions(filtered);
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >

      <View style={styles.modalContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            
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
                      onChangeText={(value) => handleInputChange("shop", value)}
                      placeholder="Shop number"
                      placeholderTextColor={colors.phText}
                      keyboardType="numeric"
                      onFocus={() => handleInputFocus('shop')}
                      onBlur={handleInputBlur}
                    />
                    {activeDropdown === 'shop' && filteredOptions.length > 0 && (
                      <View style={styles.dropdown}>
                        <ScrollView
                          scrollEnabled={filteredOptions.length > 8}
                          nestedScrollEnabled={true}
                          style={{ maxHeight: 200 }}
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

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Gate</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={form.gate}
                      onChangeText={(value) => handleInputChange("gate", value)}
                      placeholder="Gate number"
                      placeholderTextColor={colors.phText}
                      keyboardType="numeric"
                      onFocus={() => handleInputFocus('gate')}
                      onBlur={handleInputBlur}
                    />
                    {activeDropdown === 'gate' && filteredOptions.length > 0 && (
                      <View style={styles.dropdown}>
                        <ScrollView
                          scrollEnabled={filteredOptions.length > 8}
                          nestedScrollEnabled={true}
                          style={{ maxHeight: 200 }}
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

                  <View style={styles.inputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Trailer</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={form.trailer}
                      onChangeText={(value) => handleInputChange("trailer", value)}
                      placeholder="Trailer number"
                      placeholderTextColor={colors.phText}
                      keyboardType="numeric"
                      onFocus={() => handleInputFocus('trailer')}
                      onBlur={handleInputBlur}
                    />
                    {activeDropdown === 'trailer' && filteredOptions.length > 0 && (
                      <View style={styles.dropdown}>
                        <ScrollView
                          scrollEnabled={filteredOptions.length > 8}
                          nestedScrollEnabled={true}
                          style={{ maxHeight: 200 }}
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
});