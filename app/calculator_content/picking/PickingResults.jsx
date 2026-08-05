import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useCalculator } from '../../../context/CalculatorContext';
import { useColors } from '../../../hooks/useColors';
import { appConfirm } from '../../../utils/crossPlatformAlert';
import { PICKING_SUBSECTIONS } from './usePickingLogic';

const formatElapsed = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
};

export default function PickingResults({
  sessionTime,
  startTime,
  endTime,
  boxesCount,
  ordersCount,
  subsection,
  boxesRateGoal,
  pickingSubsectionGoals,
  pickingSubsectionStats,
}) {
  const calc = useCalculator();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const normalizedStats = (() => {
    if (pickingSubsectionStats && typeof pickingSubsectionStats === 'object') {
      return pickingSubsectionStats;
    }
    return {};
  })();

  const normalizedGoals = (() => {
    if (pickingSubsectionGoals && typeof pickingSubsectionGoals === 'object') {
      return pickingSubsectionGoals;
    }
    return {};
  })();

  const hasAnySavedSubsectionStats = Object.keys(normalizedStats).length > 0;
  const fallbackStats = hasAnySavedSubsectionStats
    ? normalizedStats
    : (subsection
      ? {
        [subsection]: {
          boxesCount: Number(boxesCount || 0),
          ordersCount: Number(ordersCount || 0),
          sessionTime: Number(sessionTime || 0),
        },
      }
      : {});

  const subsectionEntries = PICKING_SUBSECTIONS
    .map((key) => {
      const item = fallbackStats[key];
      if (!item) return null;

      const itemBoxes = Number(item.boxesCount || 0);
      const itemOrders = Number(item.ordersCount || 0);
      const itemTime = Number(item.sessionTime || 0);
      const itemRate = itemTime > 0 ? itemBoxes / (itemTime / 3600) : 0;

      if (itemBoxes <= 0 && itemOrders <= 0 && itemTime <= 0) {
        return null;
      }

      return {
        subsection: key,
        boxesCount: itemBoxes,
        ordersCount: itemOrders,
        sessionTime: itemTime,
        boxesRate: Number.isFinite(itemRate) ? itemRate : 0,
        boxesRateGoal: Number(normalizedGoals[key] ?? ((key === subsection) ? boxesRateGoal : 0) ?? 0),
      };
    })
    .filter(Boolean);

  const handleFinish = async () => {
    await calc.clearState();
    calc.updateState({ mode: 'init' });
  };

  const handleDiscard = async () => {
    appConfirm(
      'Odrzuć sesję',
      'Czy na pewno chcesz odrzucić tę sesję kompletacji?',
      async () => {
        await calc.clearState();
        calc.updateState({ mode: 'init' });
      }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.title }]}>Sesja kompletacji zakończona</Text>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.textSecondary }]}>Czas sesji</Text>
          <Text style={[styles.value, { color: colors.text }]}>{formatElapsed(sessionTime)}</Text>
        </View>

        {subsectionEntries.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
            <Text style={[styles.label, { color: colors.textSecondary }]}>Podsekcje</Text>
            <Text style={[styles.valueSmall, { color: colors.text }]}>Brak danych podsekcji.</Text>
          </View>
        ) : (
          subsectionEntries.map((entry) => (
            <View
              key={entry.subsection}
              style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            >
              <Text style={[styles.label, { color: colors.textSecondary }]}>Podsekcja {entry.subsection}</Text>
              <View style={styles.statsRow}>
                <Text style={[styles.statKey, { color: colors.textSecondary }]}>Czas pracy</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{formatElapsed(entry.sessionTime)}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={[styles.statKey, { color: colors.textSecondary }]}>Paczki</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{entry.boxesCount}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={[styles.statKey, { color: colors.textSecondary }]}>Zamówienia</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{entry.ordersCount}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={[styles.statKey, { color: colors.textSecondary }]}>Wynik / godz</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{entry.boxesRate.toFixed(2)}</Text>
              </View>
              <Text style={[styles.subValue, { color: colors.textSecondary }]}>Cel: {entry.boxesRateGoal || 'brak'}</Text>
            </View>
          ))
        )}

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.textSecondary }]}>Start</Text>
          <Text style={[styles.valueSmall, { color: colors.text }]}>{startTime ? new Date(startTime).toLocaleString() : 'Brak'}</Text>
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Koniec</Text>
          <Text style={[styles.valueSmall, { color: colors.text }]}>{endTime ? new Date(endTime).toLocaleString() : 'Brak'}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.navBackground, borderTopColor: colors.border, paddingBottom: insets.bottom }]}> 
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]} onPress={handleDiscard}>
          <Ionicons name="close-circle-outline" size={20} color={colors.outButText} />
          <Text style={[styles.buttonText, { color: colors.outButText }]}>Odrzuć</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, { backgroundColor: colors.butBackground }]} onPress={handleFinish}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.butText} />
          <Text style={[styles.buttonText, { color: colors.butText }]}>Zakończ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 120,
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
  },
  valueSmall: {
    fontSize: 16,
    fontWeight: '600',
  },
  subValue: {
    marginTop: 6,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  statKey: {
    fontSize: 14,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
