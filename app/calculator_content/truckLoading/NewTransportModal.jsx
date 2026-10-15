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

  const adjustPallets = (amount) => {
    if (palletsInProgress) return;

    const currentValue = Number(form.pallets) || 0;
    const nextValue = Math.round((currentValue + amount) * 100) / 100;

    if (nextValue > 0 && nextValue <= 50) {
      handleChange("pallets", String(nextValue));
    }
  };

  const renderPalletAdjustmentChip = (amount) => (
    <TouchableOpacity
      key={amount}
      accessibilityLabel={`${amount > 0 ? "Dodaj" : "Odejmij"} ${Math.abs(amount).toFixed(2)} palety`}
      accessibilityRole="button"
      onPress={() => adjustPallets(amount)}
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
        {amount > 0 ? "+" : ""}{amount.toFixed(2)}
      </Text>
    </TouchableOpacity>
  );

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

                <View style={styles.modalHeaderSection}>
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
                    <View style={styles.transportHeaderText}>
                      <Text style={[styles.title, { color: colors.text }]}>Nowy transport</Text>
                      <Text style={[styles.description, { color: colors.textSecondary }]}>
                        Uzupełnij dane transportu
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.headerDivider, { backgroundColor: colors.border }]} />

                <View style={styles.inputSection}>
                  <View style={styles.inputSectionHeader}>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>Dane transportu</Text>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      {inputPage + 1} z 2
                    </Text>
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
                        <View style={styles.palletInputRow}>
                          <View style={[styles.inputWithIcon, styles.palletInput]}>
                            <MaterialCommunityIcons name="shipping-pallet" size={18} color={colors.inputIconColor} style={styles.inputIcon} />
                            <TextInput
                              style={[
                                styles.inputSmall,
                                styles.palletTextInput,
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
                          </View>
                          {renderPalletAdjustmentChip(-0.25)}
                          {renderPalletAdjustmentChip(0.25)}
                        </View>
                        {!isPalletsValid && form.pallets && <Text style={styles.errorText}>Must be valid</Text>}
                      </View>
                      <View style={styles.inputField}>
                        <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Sklep</Text>
                        <View style={styles.inputWithIcon}>
                          <MaterialCommunityIcons name="store-outline" size={18} color={colors.inputIconColor} style={styles.inputIcon} />
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
                      </View>
                      {connectedShops && (
                        <View style={styles.inputField}>
                          <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Sklep 2</Text>
                          <View style={styles.inputWithIcon}>
                            <MaterialCommunityIcons name="store-outline" size={18} color={colors.inputIconColor} style={styles.inputIcon} />
                            <TextInput
                              ref={secondShopInputRef}
                              style={[
                                styles.inputSmall,
                                {
                                  backgroundColor: colors.inputBackground,
                                  color: colors.text,
                                  borderColor: colors.border
                                }
                              ]}
                              value={form.secondShop}
                              onChangeText={(value) => handleInputChange("secondShop", value)}
                              placeholder="Sklep 2"
                              placeholderTextColor={colors.phText}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      )}
                    </View>
                    <View style={[styles.inputPage, { width: inputPagerWidth || '100%' }]}>
                      <View style={styles.inputField}>
                        <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Brama</Text>
                        <View style={styles.inputWithIcon}>
                          <MaterialCommunityIcons name="gate" size={18} color={colors.inputIconColor} style={styles.inputIcon} />
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
                      </View>
                      <View style={styles.inputField}>
                        <Text style={[styles.inputLabelHalf, { color: colors.text }]}>Naczepa</Text>
                        <View style={styles.inputWithIcon}>
                          <MaterialCommunityIcons name="truck-trailer" size={18} color={colors.inputIconColor} style={styles.inputIcon} />
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
                </View>
                <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

                <View style={styles.actionsSection}>
                  <Text style={[styles.sectionLabel, styles.palletSuggestionsTitle, { color: colors.text }]}>
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
    position: 'relative',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    paddingTop: 44,
  },
  modalHeaderSection: {
    position: 'relative',
  },
  headerDivider: {
    height: 1,
    marginHorizontal: 36,
    marginBottom: 8,
  },
  sectionDivider: {
    height: 1,
    marginHorizontal: 36,
    marginVertical: 14,
  },
  inputSection: {
    width: '100%',
    paddingTop: 12,
  },
  inputSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 36,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionsSection: {
    marginHorizontal: 36,
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
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
    paddingHorizontal: 20,
  },
  transportHeaderIcon: {
    width: 72,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  transportHeaderText: {
    height: 76,
    flex: 1,
    justifyContent: 'center',
    marginLeft: 12,
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
    textAlign: 'left',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    textAlign: 'left',
    marginBottom: 0,
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
    paddingTop: 18,
    paddingBottom: 12,
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
    left: -8,
  },
  chevronRight: {
    right: -8,
  },
  chevronButtonDisabled: {
    opacity: 0.55,
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    marginBottom: 10,
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
    height: 46,
    padding: 10,
    paddingLeft: 36,
    fontSize: 14,
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 10,
    top: 14,
    zIndex: 1,
  },
  palletSuggestionsTitle: {
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
  palletInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  palletInput: {
    flex: 1,
  },
  palletTextInput: {
    paddingLeft: 10,
    textAlign: 'center',
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