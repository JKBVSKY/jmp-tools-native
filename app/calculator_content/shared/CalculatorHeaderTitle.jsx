import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { calculateLevelFromXP } from '../../../constants/LevelSystem';
import { useCalculator } from '../../../context/CalculatorContext';
import { useUserProfile } from '../../../context/UserProfileContext';
import { useColors } from '../../../hooks/useColors';

const SESSION_TYPE_LABEL = {
  'truck-loading': 'Załadunek',
  picking: 'Kompletacja',
};

const MODE_LABEL = {
  init: 'Konfiguracja sesji',
  working: 'Aktywna sesja',
  paused: 'Sesja wstrzymana',
  results: 'Podsumowanie sesji',
};

const FALLBACK_MODE_SUBTITLE = 'Kalkulator sesji';

function getHeaderContent(calc) {
  const sessionType = calc?.sessionType || 'truck-loading';
  const mode = calc?.mode || 'init';
  const sectionLabel = SESSION_TYPE_LABEL[sessionType] || 'Kalkulator';

  let subtitle = MODE_LABEL[mode] || FALLBACK_MODE_SUBTITLE;

  if (sessionType === 'picking' && (mode === 'working' || mode === 'paused')) {
    subtitle = calc?.subsection
      ? `${subtitle} - ${calc.subsection}`
      : subtitle;
  }

  return {
    title: sectionLabel,
    subtitle,
  };
}

export default function CalculatorHeaderTitle() {
  const calc = useCalculator();
  const { profile } = useUserProfile();
  const colors = useColors();

  const { title, subtitle } = getHeaderContent(calc);

  const levelData = profile ? calculateLevelFromXP(profile.totalXP) : null;
  const xpForNextLevel = profile ? profile.level * 1000 : 1000;
  const levelProgress = levelData ? (levelData.currentXP / xpForNextLevel) * 100 : 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <View style={styles.textBlock}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.title }]}>{title}</Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>

        {profile ? (
          <View style={[styles.levelPill, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <Text style={[styles.levelPillText, { color: colors.text }]}>Lv {profile.level}</Text>
          </View>
        ) : null}
      </View>

      {profile ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.iconColor,
                  width: `${Math.min(levelProgress, 100)}%`,
                },
              ]}
            />
          </View>
          <Text numberOfLines={1} style={[styles.progressText, { color: colors.textSecondary }]}>
            {levelData?.currentXP || 0} / {xpForNextLevel} XP
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minWidth: 210,
    maxWidth: 400,
    paddingVertical: 8,
    marginRight: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 1,
  },
  levelPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  levelPillText: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressWrap: {
    marginTop: 5,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
});