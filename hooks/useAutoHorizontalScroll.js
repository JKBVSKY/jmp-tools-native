// @/_hooks/useAutoHorizontalScroll.js
import { useCallback, useEffect, useRef } from 'react';
import { ScrollView } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function useAutoHorizontalScroll({
  enabled = true,
  speed = 25,            // px / second
  pauseAtEdgesMs = 2000,
  idleToResumeMs = 5000,
} = {}) {
  const animatedRef = useAnimatedRef();
  const containerWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const idleTimerRef = useRef(null);

  const offset = useSharedValue(0);
  const direction = useSharedValue(1); // 1 right, -1 left
  const pausedByUser = useSharedValue(false);

  const getMaxOffset = useCallback(() => {
    return Math.max(0, contentWidthRef.current - containerWidthRef.current);
  }, []);

  const startAnimation = useCallback(() => {
    if (!enabled) return;

    const maxOffset = getMaxOffset();
    if (maxOffset <= 0) return;

    cancelAnimation(offset);

    const target = direction.value === 1 ? maxOffset : 0;
    const distance = Math.abs(target - offset.value);
    const duration = (distance / speed) * 1000;

    offset.value = withSequence(
      withTiming(target, { duration, easing: Easing.linear }),
      withDelay(
        pauseAtEdgesMs,
        withTiming(target, { duration: 1 }, (finished) => {
          if (finished) {
            direction.value = direction.value === 1 ? -1 : 1;
            runOnJS(startAnimation)();
          }
        })
      )
    );
  }, [enabled, getMaxOffset, offset, direction, speed, pauseAtEdgesMs]);

  const pauseAutoScroll = useCallback(() => {
    pausedByUser.value = true;
    cancelAnimation(offset);

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(() => {
      pausedByUser.value = false;
      startAnimation();
    }, idleToResumeMs);
  }, [idleToResumeMs, offset, pausedByUser, startAnimation]);

  const handleLayout = useCallback((event) => {
    containerWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  const handleContentSizeChange = useCallback((width) => {
    contentWidthRef.current = width;
    if (enabled) {
      startAnimation();
    }
  }, [enabled, startAnimation]);

  const handleUserInteraction = useCallback(() => {
    pauseAutoScroll();
  }, [pauseAutoScroll]);

  const handleMomentumScrollEnd = useCallback((event) => {
    offset.value = event.nativeEvent.contentOffset.x;
  }, [offset]);

  const handleScrollEndDrag = useCallback((event) => {
    offset.value = event.nativeEvent.contentOffset.x;
  }, [offset]);

  useAnimatedReaction(
    () => offset.value,
    (x) => {
      scrollTo(animatedRef, x, 0, false);
    }
  );

  useEffect(() => {
    if (enabled) {
      startAnimation();
    } else {
      cancelAnimation(offset);
    }

    return () => {
      cancelAnimation(offset);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [enabled, startAnimation, offset]);

  return {
    scrollRef: animatedRef,
    handleLayout,
    handleContentSizeChange,
    handleUserInteraction,
    handleMomentumScrollEnd,
    handleScrollEndDrag,
  };
}