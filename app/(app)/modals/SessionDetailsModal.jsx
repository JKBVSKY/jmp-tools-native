import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function SessionDetailsModal({
  visible,
  onClose,
  colors,
  rateColor,
  animatedRate,
  sessionStats,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.backdropOverlay} />
        <View style={styles.contentWrapper}>
          <View
            style={[
              styles.container,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.title, { color: colors.text }]}>Szczegółowe statystyki sesji</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Tutaj możesz zobaczyć szczegółowe statystyki bieżącej sesji obliczeniowej.
            </Text>

            <View
              style={[
                styles.heroContainer,
                {
                  backgroundColor: `${rateColor}14`,
                  borderColor: `${rateColor}40`,
                },
              ]}
            >
              <View style={styles.heroGlowLayer} pointerEvents="none">
                <View
                  style={[
                    styles.heroGlowOrb,
                    {
                      backgroundColor: `${rateColor}20`,
                      top: -18,
                      right: -24,
                      width: 140,
                      height: 140,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.heroGlowOrb,
                    {
                      backgroundColor: `${rateColor}12`,
                      bottom: -26,
                      left: -20,
                      width: 180,
                      height: 180,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.heroLabel, { color: colors.text }]}>Średnia aktualna (palety/godz)</Text>
              <Text
                style={[
                  styles.heroValue,
                  {
                    color: rateColor,
                    textShadowColor: `${rateColor}80`,
                  },
                ]}
              >
                {animatedRate}
              </Text>
            </View>

            {sessionStats.map((stat) => (
              <View key={stat.label} style={styles.statRow}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.cardInCardBackground,
                  borderColor: colors.border,
                },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.closeButtonText, { color: colors.text }]}>Zamknij</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    zIndex: 1,
  },
  container: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  heroContainer: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 24,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 32,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  heroGlowLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  heroGlowOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.9,
  },
  heroLabel: {
    fontSize: 14,
    paddingTop: 8,
    marginBottom: 8,
    zIndex: 1,
    fontWeight: '600',
  },
  heroValue: {
    fontSize: 56,
    fontWeight: '800',
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    zIndex: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 24,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
