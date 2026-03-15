import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TouchableOpacity } from 'react-native';
import { useAuth } from '@/_context/AuthContext';
import { useUserProfile } from '@/_context/UserProfileContext';
import { useColors } from '@/_hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { ACHIEVEMENTS, calculateLevelFromXP } from '@/constants/LevelSystem';
import { useRouter } from 'expo-router';
import { AchievementModal } from '@/app/(app)/modals/AchievementModal';

export default function Profile() {
  const { user, isGuest, signOut } = useAuth();
  const { profile, isLoading } = useUserProfile();
  const colors = useColors();
  const router = useRouter();
  const [selectedAchievement, setSelectedAchievement] = React.useState(null);
  const [modalVisible, setModalVisible] = React.useState(false);

  // ✅ HANDLE GUEST USERS
  if (isGuest) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1 }]}>
          <Ionicons name="person-outline" size={80} color={colors.iconColor} />
          <Text style={[styles.userName, { color: colors.title }]}>Gość</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            Przeglądasz jako gość
          </Text>
        </View>

        <View style={[styles.guestCard, { backgroundColor: colors.inputBackground, borderColor: colors.border, borderWidth: 1 }]}>
          <Ionicons name="information-circle" size={24} color={colors.iconColor} />
          <Text style={[styles.guestTitle, { color: colors.title }]}>Utwórz Konto</Text>
          <Text style={[styles.guestText, { color: colors.textSecondary }]}>
            Zarejestruj się, aby odblokować pełną wersję! Śledź swoje postępy, zdobywaj XP, odblokowuj osiągnięcia i rywalizuj w rankingach.
          </Text>

          <View style={styles.guestFeatures}>
            <View style={styles.featureRow}>
              <Ionicons name="star" size={20} color={colors.iconColor} />
              <Text style={[styles.featureText, { color: colors.text }]}>System XP i Poziomów</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="trophy" size={20} color={colors.iconColor} />
              <Text style={[styles.featureText, { color: colors.text }]}>Zdobywaj Osiągnięcia</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="bar-chart" size={20} color={colors.iconColor} />
              <Text style={[styles.featureText, { color: colors.text }]}>Statystyki i Rankingi</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="cloud-upload" size={20} color={colors.iconColor} />
              <Text style={[styles.featureText, { color: colors.text }]}>Synchronizacja w Chmurze</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.signUpButton, { backgroundColor: colors.butBackground }]}
          onPress={() => {
            signOut();
            router.replace('/(auth)/register');
          }}
        >
          <Ionicons name="pencil" size={20} color={colors.butText} />
          <Text style={[styles.buttonText, { color: colors.butText }]}>Utwórz Konto Teraz..</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginButton, { backgroundColor: colors.inputBackground, borderColor: colors.border, borderWidth: 1 }]}
          onPress={() => {
            signOut();
            router.replace('/(auth)/login');
          }}
        >
          <Ionicons name="log-in" size={20} color={colors.iconColor} />
          <Text style={[styles.buttonText, { color: colors.textSecondary }]}>..lub Zaloguj Się</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    );
  }

  // ✅ HANDLE LOADING
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 10 }]}>Ładowanie profilu...</Text>
      </View>
    );
  }

  // ✅ HANDLE ERROR
  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle" size={50} color={colors.primary} />
        <Text style={[styles.errorText, { color: colors.title, marginTop: 10 }]}>Błąd ładowania profilu</Text>
        <Text style={[styles.errorSubText, { color: colors.textSecondary, marginTop: 5 }]}>Proszę spróbować ponownie później</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary, marginTop: 20 }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: colors.butText }]}>Powrót</Text>
        </TouchableOpacity>
      </View>
    );
  }

// ✅ HANDLE ACHIEVEMENTS
const handleAchievementPress = (achievement) => {
  setSelectedAchievement(achievement);
  setModalVisible(true);
};

  // ✅ CALCULATE LEVEL PROGRESS CORRECTLY
  const levelData = calculateLevelFromXP(profile.totalXP);

  // Calculate XP needed for NEXT level
  const xpForNextLevel = profile.level * 1000;

  // Calculate current XP in this level (how much we've earned towards next level)
  const xpInCurrentLevel = levelData.currentXP;

  // Calculate percentage to next level
  const levelProgress = (xpInCurrentLevel / xpForNextLevel) * 100;
  const remainingXP = xpForNextLevel - xpInCurrentLevel;
  const remainingPercent = 100 - levelProgress;

  // ✅ FORMAT TIME
  const formatTime = (hours) => {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  // ✅ CALCULATE AVERAGE SCORE
  const avgScore = profile.stats.totalSessions > 0
    ? (profile.stats.totalScore / profile.stats.totalSessions).toFixed(1)
    : 0;

  // ✅ GET ALL ACHIEVEMENTS
  const allAchievements = Object.values(ACHIEVEMENTS).map(achievement => ({
    ...achievement,
    unlocked: profile.achievements.includes(achievement.id),
  }));

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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.profileImageContainer}>
          <Ionicons name="person-circle" size={100} color={colors.iconColor} />
        </View>
        <Text style={[styles.userName, { color: colors.title }]}>
          {user?.name || user?.email || 'User'}
        </Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
          {user?.email || 'email@example.com'}
        </Text>
      </View>

      {/* Level Card */}
      <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="medal" size={24} color={colors.iconColor} />
          <Text style={[styles.cardTitle, { color: colors.title }]}>Poziom {profile.level}</Text>
        </View>

        <View style={styles.levelInfo}>
          <Text style={[styles.xpText, { color: colors.textSecondary }]}>
            {profile.totalXP} zdobyte XP łącznie
          </Text>
        </View>

        {/* ✅ XP Progress Display */}
        <View style={styles.xpProgressContainer}>
          <Text style={[styles.xpProgressText, { color: colors.text }]}>
            {xpInCurrentLevel} / {xpForNextLevel} XP
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressBarBackground, { backgroundColor: colors.inputBackground, borderColor: colors.border, borderWidth: 1 }]}>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: colors.iconColor,
                width: `${Math.min(levelProgress, 100)}%`,
              },
            ]}
          />
        </View>

        {/* ✅ FIXED: Show remaining percentage to next level */}
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {Math.round(remainingPercent)}% do Poziomu {profile.level + 1}
        </Text>
      </View>

      {/* Statistics Card */}
      <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="bar-chart" size={24} color={colors.iconColor} />
          <Text style={[styles.cardTitle, { color: colors.title }]}>Statystyki</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statItem, { borderRightColor: colors.border, borderRightWidth: 1, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <Ionicons name="time" size={28} color={colors.iconColor} />
            <Text style={[styles.statValue, { color: colors.title }]}>
              {formatTime(profile.stats.totalTimeWorked)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ogólny czas pracy</Text>
          </View>

          <View style={[styles.statItem, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <Ionicons name="cube" size={28} color={colors.iconColor} />
            <Text style={[styles.statValue, { color: colors.title }]}>
              {profile.stats.palletsLoaded}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Palety załadowane</Text>
          </View>

          <View style={[styles.statItem, { borderRightColor: colors.border, borderRightWidth: 1 }]}>
            <Ionicons name="star" size={28} color={colors.iconColor} />
            <Text style={[styles.statValue, { color: colors.title }]}>
              {avgScore}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ocena</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="trending-up" size={28} color={colors.iconColor} />
            <Text style={[styles.statValue, { color: colors.title }]}>
              {profile.stats.totalTimeWorked > 0
                ? Math.floor(profile.stats.palletsLoaded / profile.stats.totalTimeWorked)
                : 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Średnia ogólna</Text>
          </View>
        </View>
      </View>

      {/* Achievements Card */}
        {/* Achievements Card */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor, borderWidth: 1 }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="trophy" size={24} color={colors.iconColor} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Osiągnięcia
            </Text>
          </View>

          <View style={styles.achievementsGrid}>
            {allAchievements.map((achievement) => (
              <Pressable
                key={achievement.id}
                style={({ pressed }) => [
                        styles.achievementItem,
                        {
                          backgroundColor: achievement.unlocked
                            ? 'rgba(34, 197, 94, 0.12)' // Lighter green background
                            : 'rgba(107, 114, 128, 0.08)', // Subtle gray background
                          borderColor: achievement.unlocked
                            ? colors.primary // Green border for unlocked
                            : colors.borderColor, // Gray border for locked
                          opacity: pressed ? 0.7 : 1,
                        }
                      ]}
                onPress={() => handleAchievementPress(achievement)}
              >

                {/* Lock Icon in Corner */}
                {!achievement.unlocked && (
                  <View style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                  }}>
                    <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
                  </View>
                )}

                {/* Unlocked Check Badge */}
                {achievement.unlocked && (
                  <View style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                  }}>
                    <Ionicons name="checkmark-circle" size={18} color={'rgba(34, 197, 94, 1)'} />
                  </View>
                )}

                <Text style={styles.achievementIcon}>{renderIcon(achievement.icon)}</Text>
                  <Text
                    style={[
                      styles.achievementName,
                      {
                        color: achievement.unlocked ? colors.text : colors.textSecondary,
                      }
                    ]}
                  >
                    {achievement.name}
                  </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.achievementCounter, { color: colors.textSecondary }]}>
            {profile.achievements.length} z {allAchievements.length} odblokowano
          </Text>
        </View>

      {/* Sessions Info */}
      <View style={[styles.infoCard, { backgroundColor: colors.inputBackground, borderColor: colors.primary, borderWidth: 1 }]}>
        <Ionicons name="information-circle" size={20} color={colors.iconColor} />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          {profile.stats.totalSessions} sesji ukończonych łącznie
        </Text>
      </View>

      <View style={{ height: 30 }} />
    <AchievementModal
      visible={modalVisible}
      achievement={selectedAchievement}
      onClose={() => setModalVisible(false)}
      userStats={{
          ...profile.stats,
          level: profile.level,
          totalXP: profile.totalXP
      }}
      isUnlocked={selectedAchievement ? profile.achievements.includes(selectedAchievement.id) : false}
    />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  errorSubText: {
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 25,
    borderRadius: 12,
    marginBottom: 20,
  },
  profileImageContainer: {
    marginBottom: 15,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  levelInfo: {
    marginBottom: 10,
  },
  xpText: {
    fontSize: 14,
    marginBottom: 8,
  },
  xpProgressContainer: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  xpProgressText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressBarBackground: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 15,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 12,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    justifyContent: 'space-between', // Better distribution
  },
  achievementItem: {
    width: '31%', // 3 columns with small gaps
    aspectRatio: 1, // Square cards
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.8,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 16,
    position: 'relative',
  },
  achievementIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  achievementName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  achievementCounter: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  infoCard: {
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 13,
    flex: 1,
  },
  guestCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
  },
  guestText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  guestFeatures: {
    width: '100%',
    marginTop: 15,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    marginLeft: 10,
    fontSize: 14,
    flex: 1,
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 8,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
});