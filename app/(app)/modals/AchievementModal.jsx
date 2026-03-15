// AchievementModal.jsx - New file to add to your project

import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/_hooks/useColors';

export const AchievementModal = ({ visible, achievement, onClose, userStats, isUnlocked }) => {
  const colors = useColors();

  // Calculate progress based on achievement type
  const getProgressData = () => {
    if (!achievement || !userStats) return { current: 0, total: 100, percent: 0 };

    const stats = userStats;

    switch (achievement.id) {
      case 'achievement_first_shift':
        return {
          current: Math.min(stats.totalSessions, 1),
          total: 1,
          percent: Math.min((stats.totalSessions / 1) * 100, 100),
          label: `${stats.totalSessions} / 1 sesja`,
        };

      case 'achievement_speed_hunter':
        // Per-session pallets - shows current session pallet count
        return {
          current: Math.min(stats.palletsLoadedInSession || 0, 400),  // ✅ Use session pallets
          total: 400,
          percent: Math.min(((stats.palletsLoadedInSession || 0) / 400) * 100, 100),  // ✅ FIX percent calc
          label: `${stats.palletsLoadedInSession || 0} / 400 palet w sesji`,
        };

      case 'achievement_consistency':
        const avgScore = stats.totalSessions > 0
          ? (stats.totalScore / stats.totalSessions)
          : 0;
        return {
          current: avgScore,
          total: 10,
          percent: Math.min((avgScore / 8.5) * 100, 100),
          label: `Średnia: ${avgScore.toFixed(2)} / 8.5`,
        };

      case 'achievement_night_owl':
        return {
          current: stats.nightShiftsCompleted || 0,
          total: 20,
          percent: Math.min(((stats.nightShiftsCompleted || 0) / 20) * 100, 100),
          label: `${stats.nightShiftsCompleted || 0} / 20 zmian nocnych`,
        };

        case 'achievement_master_loader':
          const currentLevel = stats.level || 0;  // ✅ Use level directly!
          return {
            current: currentLevel,
            total: 50,
            percent: Math.min((currentLevel / 50) * 100, 100),
            label: `Poziom ${currentLevel} / 50`
          };

      case 'achievement_perfectionist':
        return {
          current: stats.perfectScores || 0,
          total: 5,
          percent: Math.min(((stats.perfectScores || 0) / 5) * 100, 100),
          label: `${stats.perfectScores || 0} / 5 idealnych wyników`,
        };

      case 'achievement_pallets_1':
        return {
          current: stats.palletsLoaded || 0,
          total: 1000,
          percent: Math.min(((stats.palletsLoaded || 0) / 1000) * 100, 100),
          label: `${stats.palletsLoaded || 0} / 1000 palet`,
        };

      case 'achievement_pallets_2':
        return {
          current: stats.palletsLoaded || 0,
          total: 5000,
          percent: Math.min(((stats.palletsLoaded || 0) / 5000) * 100, 100),
          label: `${stats.palletsLoaded || 0} / 5000 palet`,
        };

      case 'achievement_pallets_3':
        return {
          current: stats.palletsLoaded || 0,
          total: 10000,
          percent: Math.min(((stats.palletsLoaded || 0) / 10000) * 100, 100),
          label: `${stats.palletsLoaded || 0} / 10000 palet`,
        };

      case 'achievement_pallets_4':
        return {
          current: stats.palletsLoaded || 0,
          total: 25000,
          percent: Math.min(((stats.palletsLoaded || 0) / 25000) * 100, 100),
          label: `${stats.palletsLoaded || 0} / 25000 palet`,
        };

      case 'achievement_pallets_5':
        return {
          current: stats.palletsLoaded || 0,
          total: 50000,
          percent: Math.min(((stats.palletsLoaded || 0) / 50000) * 100, 100),
          label: `${stats.palletsLoaded || 0} / 50000 palet`,
        };

      case 'achievement_pallets_6':
        return {
          current: stats.palletsLoaded || 0,
          total: 100000,
          percent: Math.min(((stats.palletsLoaded || 0) / 100000) * 100, 100),
          label: `${stats.palletsLoaded || 0} / 100000 palet`,
        };

      case 'achievement_marathon':
        return {
          current: stats.totalTimeWorked || 0,
          total: 100,
          percent: Math.min(((stats.totalTimeWorked || 0) / 100) * 100, 100),
          label: `${(stats.totalTimeWorked || 0).toFixed(1)} / 100 godzin`,
        };

      default:
        return { current: 0, total: 100, percent: 0, label: 'N/A' };
    }
  };

  const progressData = getProgressData();

  if (!achievement) return null;

    const renderIcon = (icon) => {
      if (typeof icon === 'string') {
        return <Text style={styles.achievementIcon}>{icon}</Text>;
      }

      if (typeof icon === 'function' || (typeof icon === 'object' && icon?.render)) {
        const IconComponent = icon;
        return <IconComponent size={48} />;
      }

      return null;
    };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.borderColor,
            }
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons
              name="close"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Achievement Icon */}
            <View style={[
              styles.iconContainer,
              {
                backgroundColor: isUnlocked
                  ? 'rgba(34, 197, 94, 0.1)'
                  : 'rgba(107, 114, 128, 0.1)'
              }
            ]}>
              <Text style={styles.icon}>{renderIcon(achievement.icon)}</Text>
              {isUnlocked && (
                <View style={styles.unlockedBadge}>
                  <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
                </View>
              )}
            </View>

            {/* Achievement Name */}
            <Text style={[styles.achievementName, { color: colors.text }]}>
              {achievement.name}
            </Text>

            {/* Status Badge */}
            <View style={[
              styles.statusBadge,
              {
                backgroundColor: isUnlocked
                  ? 'rgba(34, 197, 94, 0.2)'
                  : 'rgba(107, 114, 128, 0.2)'
              }
            ]}>
              <Text style={[
                styles.statusText,
                { color: isUnlocked ? '#22c55e' : '#6b7280' }
              ]}>
                {isUnlocked ? '✓ ODBLOKOWANE' : '🔒 ZABLOKOWANE'}
              </Text>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Opis
              </Text>
              <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
                {achievement.description}
              </Text>
            </View>

            {/* Requirements/Rules */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Wymagania
              </Text>
              <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
                {achievement.requirement}
              </Text>
            </View>

            {/* Progress Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Postęp
              </Text>

              {/* Progress Bar */}
              <View style={[
                styles.progressBarContainer,
                { backgroundColor: colors.borderColor }
              ]}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.min(progressData.percent, 100)}%`,
                      backgroundColor: isUnlocked ? '#22c55e' : '#3b82f6',
                    }
                  ]}
                />
              </View>

              {/* Progress Text */}
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {progressData.label}
              </Text>

              {/* Progress Percentage */}
              <Text style={[styles.percentText, { color: colors.text }]}>
                {Math.round(Math.min(progressData.percent, 100))}%
              </Text>
            </View>

            {/* Motivational Message */}
            {!isUnlocked && (
              <View style={[
                styles.motivationBox,
                { backgroundColor: 'rgba(59, 130, 246, 0.1)' }
              ]}>
                <Ionicons name="sparkles" size={20} color="#3b82f6" />
                <Text style={[styles.motivationText, { color: '#3b82f6' }]}>
                  Pamiętaj! Każdy postęp to zwycięstwo!
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Close Button at Bottom */}
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeModalButton,
              { backgroundColor: colors.primary }
            ]}
          >
            <Text style={styles.closeModalButtonText}>Zamknij</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 50,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 56,
  },
  unlockedBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
  },
  achievementName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 13,
    lineHeight: 20,
  },
  progressBarContainer: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    marginBottom: 4,
  },
  percentText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  motivationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 12,
  },
  motivationText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  closeModalButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    margin: 20,
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
