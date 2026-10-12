import React, { useState, useRef } from "react";
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from "../../../hooks/useColors";
import DismissibleModalBackdrop from "../../../components/DismissibleModalBackdrop";

export default function NewTransportModal({ visible, onClose, onAdd }) {
  const colors = useColors();

  const [form, setForm] = useState({
    shop: "",
    secondShop: "",
    gate: "",
    trailer: "",
    pallets: "",
  });

  const [palletsInProgress, setPalletsInProgress] = useState(false);
  const [connectedShops, setConnectedShops] = useState(false);
  const [inputPage, setInputPage] = useState(0);
  const [inputPagerWidth, setInputPagerWidth] = useState(0);

  // Refs
  const shopInputRef = useRef(null);
  const secondShopInputRef = useRef(null);
  const gateInputRef = useRef(null);
  const trailerInputRef = useRef(null);
  const inputPagerRef = useRef(null);

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
    setInputPage(0);
    inputPagerRef.current?.scrollTo({ x: 0, animated: false });
    setForm({ shop: "", secondShop: "", gate: "", trailer: "", pallets: "" });
    setPalletsInProgress(false);
    setConnectedShops(false);
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

  const handleConnectedShopsChange = (value) => {
    setConnectedShops(value);
    if (value === true) {
      setForm((prev) => ({ ...prev, secondShop: "" }));
    }
  };

  const handleInputChange = (name, value) => {
    // Update form value
    handleChange(name, value);
  };

  const goToInputPage = (page) => {
    const nextPage = Math.max(0, Math.min(1, page));
    setInputPage(nextPage);
    if (inputPagerWidth) {
      inputPagerRef.current?.scrollTo({ x: nextPage * inputPagerWidth, animated: true });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <DismissibleModalBackdrop onPress={handleClose}>
          <View style={styles.modalViewport}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.modalContent, { backgroundColor: colors.background }] }>
                <TouchableOpacity
                  accessibilityLabel="Zamknij"
                  accessibilityRole="button"
                  onPress={handleClose}
                  style={styles.closeButton}
                >
                  <Text style={[styles.closeButtonText, { color: colors.text }]}>×</Text>
                </TouchableOpacity>

                <View style={styles.transportHeader}>
                  <View style={styles.transportHeaderIcon}>
                    <MaterialCommunityIcons
                      name="truck-outline"
                      size={68}
                      color={colors.butBackground}
                    />
                    <View style={[styles.transportHeaderBadge, { borderColor: colors.background }]}>
                      <MaterialCommunityIcons name="plus" size={15} color="#fff" />
                    </View>
                  </View>
                  <Text style={[styles.title, { color: colors.text }]}>Nowy transport</Text>
                </View>

                <View
                  style={[styles.inputPagerFrame, connectedShops && styles.inputPagerFrameConnected]}
                >
                  <TouchableOpacity
                    accessibilityLabel="Poprzednie pola"
                    accessibilityRole="button"
                    disabled={inputPage === 0}
                    onPress={() => goToInputPage(inputPage - 1)}
                    style={[styles.chevronButton, styles.chevronLeft, inputPage === 0 && styles.chevronButtonDisabled]}
                  >
                    <Ionicons name="chevron-back" size={22} color={inputPage === 0 ? colors.disabledButText : colors.butBackground} />
                  </TouchableOpacity>

                  <ScrollView
                    ref={inputPagerRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.inputPager}
                    contentContainerStyle={styles.inputPagerContent}
                    nestedScrollEnabled
                    onLayout={(event) => setInputPagerWidth(event.nativeEvent.layout.width)}
                    onMomentumScrollEnd={(event) => {
                      if (inputPagerWidth) {
                        setInputPage(Math.round(event.nativeEvent.contentOffset.x / inputPagerWidth));
                      }
                    }}
                  >
                    <View style={[styles.inputPage, { width: inputPagerWidth || '100%' }]}>
                      <View style={styles.inputField}>
                        <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Palety *</Text>
                        <TextInput
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
                          onSubmitEditing={handleAdd}
                          placeholder={palletsInProgress ? "W TRAKCIE" : "Palety"}
                          placeholderTextColor={palletsInProgress ? "red" : colors.phText}
                          keyboardType="numeric"
                          editable={!palletsInProgress}
                        />
                        {!isPalletsValid && form.pallets && <Text style={styles.errorText}>Must be valid</Text>}
                      </View>
                      <View style={styles.inputField}>
                        <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Sklep</Text>
                        <TextInput
                          ref={shopInputRef}
                          style={[styles.inputSmall, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                          value={form.shop}
                          onChangeText={(value) => handleInputChange("shop", value)}
                          placeholder="Sklep"
                          placeholderTextColor={colors.phText}
                          keyboardType="numeric"
                        />
                      </View>
                      {connectedShops && (
                        <View style={styles.inputField}>
                          <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Sklep 2</Text>
                          <TextInput
                            ref={secondShopInputRef}
                            style={[styles.inputSmall, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={form.secondShop}
                            onChangeText={(value) => handleInputChange("secondShop", value)}
                            placeholder="Sklep 2"
                            placeholderTextColor={colors.phText}
                            keyboardType="numeric"
                          />
                        </View>
                      )}
                    </View>
                    <View style={[styles.inputPage, { width: inputPagerWidth || '100%' }]}>
                      <View style={styles.inputField}>
                        <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Brama</Text>
                        <TextInput
                          ref={gateInputRef}
                          style={[styles.inputSmall, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                          value={form.gate}
                          onChangeText={(value) => handleInputChange("gate", value)}
                          placeholder="Brama"
                          placeholderTextColor={colors.phText}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.inputField}>
                        <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Naczepa</Text>
                        <TextInput
                          ref={trailerInputRef}
                          style={[styles.inputSmall, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                          value={form.trailer}
                          onChangeText={(value) => handleInputChange("trailer", value)}
                          placeholder="Naczepa"
                          placeholderTextColor={colors.phText}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </ScrollView>

                  <TouchableOpacity
                    accessibilityLabel="Następne pola"
                    accessibilityRole="button"
                    disabled={inputPage === 1}
                    onPress={() => goToInputPage(inputPage + 1)}
                    style={[styles.chevronButton, styles.chevronRight, inputPage === 1 && styles.chevronButtonDisabled]}
                  >
                    <Ionicons name="chevron-forward" size={22} color={inputPage === 1 ? colors.disabledButText : colors.butBackground} />
                  </TouchableOpacity>
                </View>
                <View style={styles.pageIndicator} accessibilityLabel={`Strona ${inputPage + 1} z 2`}>
                  {[0, 1].map((page) => (
                    <View
                      key={page}
                      style={[
                        styles.pageDot,
                        inputPage === page && styles.pageDotActive,
                        { backgroundColor: inputPage === page ? colors.iconColor : colors.grayIconColor }
                      ]}
                    />
                  ))}
                </View>

                <Text style={[styles.palletSuggestionsTitle, { color: colors.textSecondary }]}>
                  Szybki wybór palet
                </Text>
                <View style={styles.palletSuggestions}>
                  {[18, 21, 22, 24, 33].map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      accessibilityLabel={`Ustaw ${amount} palet`}
                      accessibilityRole="button"
                      onPress={() => handleChange("pallets", String(amount))}
                      disabled={palletsInProgress}
                      style={[
                        styles.palletSuggestion,
                        {
                          borderColor: palletsInProgress ? colors.disabledButBorder : colors.outButBorder,
                          backgroundColor: palletsInProgress ? colors.disabledButBackground : colors.outButBackground,
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.palletSuggestionText,
                          { color: palletsInProgress ? colors.disabledButText : colors.outButText }
                        ]}
                      >
                        {amount}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.toggleCardsRow}>
                  <TouchableOpacity
                    accessibilityRole="switch"
                    accessibilityState={{ checked: palletsInProgress }}
                    onPress={() => handlePalletsInProgressChange(!palletsInProgress)}
                    style={[
                      styles.toggleCard,
                      {
                        backgroundColor: palletsInProgress ? colors.butBackground : colors.inputBackground,
                        borderColor: palletsInProgress ? colors.butBackground : colors.border,
                      }
                    ]}
                  >
                    <Text style={[styles.toggleCardIndicator, { color: palletsInProgress ? colors.butText : colors.grayIconColor }]}>
                      {palletsInProgress ? "✓" : "○"}
                    </Text>
                    <Text style={[styles.toggleCardLabel, { color: palletsInProgress ? colors.butText : colors.text }]}>
                      Palety w trakcie
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="switch"
                    accessibilityState={{ checked: connectedShops }}
                    onPress={() => handleConnectedShopsChange(!connectedShops)}
                    style={[
                      styles.toggleCard,
                      {
                        backgroundColor: connectedShops ? colors.butBackground : colors.inputBackground,
                        borderColor: connectedShops ? colors.butBackground : colors.border,
                      }
                    ]}
                  >
                    <Text style={[styles.toggleCardIndicator, { color: connectedShops ? colors.butText : colors.grayIconColor }]}>
                      {connectedShops ? "✓" : "○"}
                    </Text>
                    <Text style={[styles.toggleCardLabel, { color: connectedShops ? colors.butText : colors.text }]}>
                      Łączenie
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Button Container */}
                <View style={styles.buttonContainer}>
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
                      Dodaj
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
          </View>
        </DismissibleModalBackdrop>
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
  modalViewport: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '100%',
  },
  modalScrollView: {
    width: '100%',
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    paddingTop: 52,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 32,
  },
  transportHeader: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    paddingHorizontal: 36,
  },
  transportHeaderIcon: {
    width: 72,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  transportHeaderBadge: {
    position: 'absolute',
    top: 1,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 20,
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
  inputPagerFrame: {
    height: 190,
    position: 'relative',
    marginBottom: 16,
  },
  inputPagerFrameConnected: {
    height: 230,
  },
  inputPager: {
    flex: 1,
    marginHorizontal: 36,
  },
  inputPagerContent: {
    flexGrow: 1,
  },
  inputPage: {
    flex: 1,
    gap: 14,
  },
  inputField: {
    width: '100%',
  },
  chevronButton: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  chevronLeft: {
    left: 0,
  },
  chevronRight: {
    right: 0,
  },
  chevronButtonDisabled: {
    opacity: 0.55,
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginTop: -4,
    marginBottom: 12,
  },
  pageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pageDotActive: {
    width: 18,
    borderRadius: 4,
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
  palletSuggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
    marginBottom: 8,
  },
  palletSuggestions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  palletSuggestion: {
    minWidth: 52,
    height: 46,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  palletSuggestionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  toggleCard: {
    flex: 1,
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 4,
  },
  toggleCardIndicator: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  toggleCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});