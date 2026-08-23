import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import ThemedCard from '../../../components/ThemedCard';
import { XPEarnedNotification } from '../../../components/XPEarnedNotification';

export default function SessionXPHeader({
  colors,
  profile,
  levelData,
  xpForNextLevel,
  levelProgress,
  leveledUpMessage,
  showXPFloatingText,
  floatingAnim,
  floatingXPAmount,
  notificationState = { visible: false, xp: 0 },
  setNotificationState = () => {},
  showProgressCard = true,
  showNotifications = true,
  showFloatingXP = true,
}) {
  return (
    <>
      {showProgressCard && (leveledUpMessage ? (
        <Reanimated.View
          key="level-up-banner"
          entering={FadeInUp.springify().damping(14).stiffness(120)}
          exiting={FadeOutUp.duration(220)}
        >
          <View style={[styles.levelUpBanner, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
            <Ionicons name="star" size={24} style={{ color: colors.iconColor }} />
            <Text style={[styles.levelUpText, { color: colors.text }]}>Nowy poziom: {leveledUpMessage} !🎉</Text>
            <Ionicons name="star" size={24} style={{ color: colors.iconColor }} />
          </View>
        </Reanimated.View>
      ) : (
        profile && (
          <Reanimated.View
            key="xp-card"
            entering={FadeInUp.springify().damping(14).stiffness(120)}
            exiting={FadeOutUp.duration(220)}
          >
            <ThemedCard style={[styles.levelCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
              <View>
                <Text style={[styles.levelTitle, { color: colors.title }]}>Poziom {profile?.level || 1}</Text>
              </View>
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: colors.iconColor, width: `${Math.min(levelProgress, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: colors.textSecondary }]}> 
                  {levelData?.currentXP || 0} / {xpForNextLevel} XP
                </Text>
              </View>
            </ThemedCard>
          </Reanimated.View>
        )
      ))}

      {showNotifications ? (
        <XPEarnedNotification
          visible={notificationState.visible}
          xpAmount={notificationState.xp}
          onDismiss={() => setNotificationState({ visible: false, xp: 0 })}
        />
      ) : null}

      {showFloatingXP && showXPFloatingText && floatingAnim && (
        <Animated.View
          style={[
            styles.floatingXPText,
            {
              opacity: floatingAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
              transform: [
                {
                  translateY: floatingAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -60],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.floatingXPValue, { color: colors.text }]}>+{floatingXPAmount} XP</Text>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  levelCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 24,
    marginVertical: 16,
    borderRadius: 16,
    gap: 32,
    borderWidth: 1,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  progressContainer: {
    flex: 1,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 5,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  floatingXPText: {
    position: 'absolute',
    top: 200,
    alignSelf: 'center',
    zIndex: 1000,
  },
  floatingXPValue: {
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  levelUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 21,
    marginHorizontal: 24,
    marginVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    gap: 10,
  },
  levelUpText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});