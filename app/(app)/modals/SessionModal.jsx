import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/_hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';

export default function SessionModal({ visible, onClose, onOptionSelect, options = [
    { key: 'zaladunek', label: 'Załadunek', route: '/(app)/calculator_content/calculator', icon: 'flash-outline' },
    { key: 'kompletacja', label: 'Kompletacja', icon: 'layers-outline' },
    { key: 'wsparcie', label: 'Wsparcie', icon: 'help-circle-outline' },
    { key: 'owijarki', label: 'Owijarki', icon: 'settings-outline' },
] }) {
    const colors = useColors();
    const [gridWidth, setGridWidth] = useState(0);
    const tileSize = gridWidth > 0 ? (gridWidth - 12) / 2 : undefined;

    const handleOptionPress = (opt) => {
        if (opt.route) {
            // Option with route - navigate
            onOptionSelect(opt.route);
        } else {
            // Placeholder option - show coming soon message
            Alert.alert('Niedostępne', 'Dostępne wkrótce...', [{ text: 'OK' }]);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.modalContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={[styles.modalTitle, { color: colors.text}]}>Wybierz Sekcję</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View
                        style={styles.optionsGrid}
                        onLayout={({ nativeEvent }) => setGridWidth(nativeEvent.layout.width)}
                    >
                        {options.map((opt) => (
                            <TouchableOpacity
                                key={opt.key}
                                style={[styles.optionButton, {
                                    width: tileSize,
                                    height: tileSize,
                                    overflow: 'hidden',
                                    backgroundColor: colors.cardBackground,
                                    opacity: 0.9,
                                }]}
                                onPress={() => handleOptionPress(opt)}
                            >
                                <LinearGradient
                                    colors={[
                                        'transparent',
                                        'rgba(225, 213, 211, 0.04)',
                                        'rgba(225, 213, 211, 0.14)',
                                    ]}
                                    start={{ x: 0.3, y: 0.2 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.cornerGradientLarge}
                                />
                                <Ionicons name={opt.icon || 'checkmark-circle'} size={32} color={colors.iconColor} />
                                <Text style={[styles.optionText, { color: colors.text }]}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.44)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContainer: {
        width: '100%',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
    },
    closeButton: {

    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        padding: 8,
        textAlign: 'left',
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    optionButton: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginVertical: 6,
        gap: 10,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    cornerGradientLarge: {
        position: 'absolute',
        right: -18,
        bottom: -18,
        width: 200,
        height: 200,
        borderTopLeftRadius: 120,
    },

});


