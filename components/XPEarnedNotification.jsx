// components/XPEarnedNotification.jsx
import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { useColors } from '../_hooks/useColors';

export function XPEarnedNotification({ xpAmount, visible, onDismiss }) {
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const colors = useColors();

  useEffect(() => {
    if (visible) {
      // Animate in with slide + fade + scale
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 8 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -150,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => onDismiss?.());
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [visible, slideAnim, opacityAnim, scaleAnim, onDismiss]);

  if (!visible && slideAnim._value === -150) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
          opacity: opacityAnim,
        },
      ]}
    >
      <View
        style={[
          styles.content,
          {
            backgroundColor: colors.butBackground, // ✅ Primary red button color
            borderColor: colors.butBorder, // ✅ Darker red border
          },
        ]}
      >
        {/* Left Icon Section */}
        <View style={styles.iconSection}>
          <Text style={styles.ghostIcon}>👻</Text>
        </View>

        {/* Text Content */}
        <View style={styles.textSection}>
          <Text
            style={[
              styles.title,
              {
                color: colors.butText, // ✅ White text
              },
            ]}
          >
            You earned XP!
          </Text>
          <Text
            style={[
              styles.xpAmount,
              {
                color: colors.butText, // ✅ White text
              },
            ]}
          >
            +{xpAmount} XP 🎉
          </Text>
        </View>

        {/* Right Decoration */}
        <View style={styles.decorSection}>
          <Text style={styles.sparkle}>✨</Text>
        </View>
      </View>

      {/* Glow effect background */}
      <View
        style={[
          styles.glowBackground,
          {
            backgroundColor: colors.butBackground,
            opacity: 0.15,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 10,
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,

    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,

    // Gap between sections
    gap: 12,
  },

  glowBackground: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    height: 56,
    borderRadius: 12,
    zIndex: -1,
  },

  iconSection: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },

  ghostIcon: {
    fontSize: 28,
    marginRight: 4,
  },

  textSection: {
    flex: 1,
    justifyContent: 'center',
  },

  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.5,
  },

  xpAmount: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  decorSection: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 32,
  },

  sparkle: {
    fontSize: 20,
    marginLeft: 4,
  },
});
