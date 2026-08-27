// app/onboarding.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '../hooks/useColors';
import { StorageManager } from '../utils/StorageManager';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PAGES = [
  {
    key: 'welcome',
    title: 'Witaj w JMP Tools!',
    subtitle: 'Twoje centrum kontroli wydajności.',
    image: require('../assets/icon_welcome.png'),
  },
  {
    key: 'motivation',
    title: 'Zacznij mieć kontrolę nad swoją wydajnością.',
    subtitle:
      'Śledź swoje wyniki, rozwijaj się i osiągaj swoje cele każdego dnia.',
    image: require('../assets/icon_welcome.png'),
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const scrollRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // If onboarding already seen, skip straight to welcome
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const flag = await StorageManager.getItem('hasSeenWelcome');
      if (!isMounted) return;

      if (flag === 'true') {
        router.replace('/(auth)/welcome');
      } else {
        setIsReady(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const finishOnboarding = async () => {
    await StorageManager.setItem('hasSeenWelcome', 'true');
    router.replace('/(auth)/welcome');
  };

  const handleNext = () => {
    if (currentIndex < PAGES.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          x: nextIndex * SCREEN_WIDTH,
          animated: true,
        });
      }
    } else {
      // Last page → “Zaczynajmy”
      finishOnboarding();
    }
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  if (!isReady) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.butBackground} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const x = event.nativeEvent.contentOffset.x;
          const index = Math.round(x / SCREEN_WIDTH);
          if (index !== currentIndex) {
            setCurrentIndex(index);
          }
        }}
      >
        {PAGES.map((page) => (
          <View
            key={page.key}
            style={[
              styles.page,
              { width: SCREEN_WIDTH },
            ]}
          >
            <Image
              source={page.image}
              style={styles.image}
              resizeMode="contain"
            />
            <Text
              style={[
                styles.title,
                { color: colors.title },
              ]}
            >
              {page.title}
            </Text>
            {page.subtitle ? (
              <Text
                style={[
                  styles.subtitle,
                  { color: colors.textSecondary },
                ]}
              >
                {page.subtitle}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotsRow}>
        {PAGES.map((page, index) => (
          <View
            key={page.key}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === currentIndex
                    ? colors.tabDotActive
                    : colors.tabDotInactive,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.buttonsRow}>
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: colors.butBackground },
          ]}
          onPress={handleNext}
        >
          <Text
            style={[
              styles.buttonText,
              { color: colors.butText },
            ]}
          >
            {currentIndex === PAGES.length - 1
              ? 'Zaczynajmy'
              : 'Dalej'}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.secondaryButton,
            {
              backgroundColor: colors.outButBackground,
              borderColor: colors.outButBorder,
            },
          ]}
          onPress={handleSkip}
        >
          <Text
            style={[
              styles.buttonText,
              { color: colors.outButText },
            ]}
          >
            Pomiń
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 32,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  image: {
    width: '80%',
    height: 220,
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    marginBottom: 48,
  },
  primaryButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});