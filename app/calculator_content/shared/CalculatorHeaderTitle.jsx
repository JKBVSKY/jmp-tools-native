import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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

function StatsBar({ stats, colors }) {
  return (
    <View style={styles.statsBar}>
      {stats.map(({ icon, value }, index) => (
        <View
          key={index}
          style={[
            styles.stat,
            index < stats.length - 1 && styles.statWithDivider,
            { borderColor: colors.border },
          ]}
        >
          {icon}
          <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

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

  const palletsLoaded = (calc.trucksHistory || []).reduce(
    (sum, truck) => sum + Number(truck.pallets || 0),
    0,
  );
  const sessionTime = Number(calc.sessionTime || 0);
  const palletsRate = sessionTime > 0
    ? (palletsLoaded / (sessionTime / 3600)).toFixed(2)
    : '0.00';
  const forcedFinishTime = calc.forcedFinishTime;

  const { title, subtitle } = getHeaderContent(calc);

  const levelData = profile ? calculateLevelFromXP(profile.totalXP) : null;
  const xpForNextLevel = profile ? profile.level * 1000 : 1000;
  const levelProgress = levelData ? (levelData.currentXP / xpForNextLevel) * 100 : 0;

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const truckStats = [
    {
      icon: <Ionicons name="speedometer" color={colors.iconColor} size={24} />,
      value: palletsRate,
    },
    {
      icon: (
        <MaterialCommunityIcons
          name="shipping-pallet"
          color={colors.iconColor}
          size={24}
        />
      ),
      value: palletsLoaded,
    },
    {
      icon: <Ionicons name="time" color={colors.iconColor} size={24} />,
      value: formatTime(sessionTime),
    },
    {
      icon: (
        <MaterialCommunityIcons
          name="flag-checkered"
          color={colors.iconColor}
          size={24}
        />
      ),
      value: new Date(forcedFinishTime).toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    },
  ];

  const boxesCount = Number(calc.boxesCount || 0);
  const subsectionStats = calc.subsection
    ? calc.pickingSubsectionStats?.[calc.subsection]
    : null;
  const activePickingElapsed = calc.activePickingSubsection === calc.subsection
    && calc.activePickingStartedAt
    && !calc.isPaused
    ? Math.max(0, Math.floor((Date.now() - calc.activePickingStartedAt) / 1000))
    : 0;
  const pickingTime = Number(subsectionStats?.sessionTime || 0) + activePickingElapsed;
  const boxesRate = pickingTime > 0
    ? (boxesCount / (pickingTime / 3600)).toFixed(2)
    : '0.00';
  const pickingStats = [
    {
      icon: <Ionicons name="speedometer" color={colors.iconColor} size={24} />,
      value: boxesRate,
    },
    {
      icon: <MaterialCommunityIcons name="package-variant" color={colors.iconColor} size={24} />,
      value: boxesCount,
    },
    {
      icon: <Ionicons name="time" color={colors.iconColor} size={24} />,
      value: formatTime(sessionTime),
    },
    {
      icon: (
        <MaterialCommunityIcons
          name="flag-checkered"
          color={colors.iconColor}
          size={24}
        />
      ),
      value: new Date(forcedFinishTime).toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    },
  ];

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

      {['truck-loading', 'picking'].includes(calc.sessionType) &&
        ['working', 'paused'].includes(calc.mode) && (
          <StatsBar
            stats={calc.sessionType === 'picking' ? pickingStats : truckStats}
            colors={colors}
          />
        )}
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
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  statWithDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  statValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});