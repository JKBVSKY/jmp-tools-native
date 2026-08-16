import React, { useState } from 'react';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useThemeContext } from '../../context/ThemeContext';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    Gesture,
    GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withDecay,
} from 'react-native-reanimated';
import WarehouseMapSvg from '../../assets/maps/warehouse-map-light.svg';
import { useLocalSearchParams } from 'expo-router';

const ZONES = {
    'Biuro': {
        x: 603,
        y: 778,
        width: 40,
        height: 120,
        zoom: 6,
    },
    'B35': {
        x: 1003,
        y: 778,
        width: 30,
        height: 118,
        zoom: 6,
    },
    'Biuro KJ': {
        x: 1360,
        y: 445,
        width: 55,
        height: 65,
        zoom: 4,
    },
    'R - P01': {
        x: 602,
        y: 100,
        width: 258,
        height: 24,
        zoom: 4,
    },
    'R - P21': {
        x: 364,
        y: 356,
        width: 184,
        height: 14,
        zoom: 4,
    },
};

const MAP_WIDTH = 1536;
const MAP_HEIGHT = 1024;
const MAX_ZOOM = 10;

const clamp = (value, min, max) => {
    'worklet';

    return Math.min(Math.max(value, min), max);
};

export default function WarehouseMap() {
    const { focusZoneName } = useLocalSearchParams();

    const [viewport, setViewport] = useState({
        width: 0,
        height: 0,
    });

    const { theme } = useThemeContext();

    const scale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    const startScale = useSharedValue(1);
    const startTranslateX = useSharedValue(0);
    const startTranslateY = useSharedValue(0);

    const pinchFocalX = useSharedValue(0);
    const pinchFocalY = useSharedValue(0);

    const didInitialize = useSharedValue(false);
    const highlightedZone = useSharedValue(null);
    const highlightOpacity = useSharedValue(0);
    const highlightScale = useSharedValue(1);

    const cachedScale = useSharedValue(0);
    const cachedScaledWidth = useSharedValue(0);
    const cachedScaledHeight = useSharedValue(0);
    const cachedBounds = useSharedValue({
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
    });

    const minScale =
        viewport.width > 0 && viewport.height > 0
            ? Math.min(
                viewport.width / MAP_WIDTH,
                viewport.height / MAP_HEIGHT,
            )
            : 1;

    const maxScale = minScale * MAX_ZOOM;

    useEffect(() => {
        if (!focusZoneName) {
            return;
        }

        if (!viewport.width || !viewport.height) {
            // viewport jeszcze nie jest zmierzony – poczekaj na kolejną zmianę
            return;
        }

        const id = setTimeout(() => {
            focusOnZone(focusZoneName);
        }, 100);

        return () => clearTimeout(id);
    }, [focusZoneName, viewport.width, viewport.height]);

    const getBounds = (currentScale) => {
        'worklet';

        if (currentScale === cachedScale.value) {
            return cachedBounds.value;
        }

        const scaledWidth = MAP_WIDTH * currentScale;
        const scaledHeight = MAP_HEIGHT * currentScale;

        const maxX = Math.max(
            0,
            (scaledWidth - viewport.width) / 2,
        );

        const maxY = Math.max(
            0,
            (scaledHeight - viewport.height) / 2,
        );

        const bounds = {
            minX: -maxX,
            maxX,
            minY: -maxY,
            maxY,
        };

        cachedScale.value = currentScale;
        cachedScaledWidth.value = scaledWidth;
        cachedScaledHeight.value = scaledHeight;
        cachedBounds.value = bounds;

        return bounds;
    };

    const clampTranslation = (
        nextX,
        nextY,
        currentScale,
    ) => {
        'worklet';

        const bounds = getBounds(currentScale);

        return {
            x: clamp(nextX, bounds.minX, bounds.maxX),
            y: clamp(nextY, bounds.minY, bounds.maxY),
        };
    };

    const panGesture = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onStart(() => {
            startTranslateX.value = translateX.value;
            startTranslateY.value = translateY.value;
        })
        .onUpdate((event) => {
            const next = clampTranslation(
                startTranslateX.value + event.translationX,
                startTranslateY.value + event.translationY,
                scale.value,
            );

            translateX.value = next.x;
            translateY.value = next.y;
        })
        .onEnd((event) => {
            const bounds = getBounds(scale.value);

            translateX.value = withDecay({
                velocity: event.velocityX,
                clamp: [bounds.minX, bounds.maxX],
            });

            translateY.value = withDecay({
                velocity: event.velocityY,
                clamp: [bounds.minY, bounds.maxY],
            });
        });

    const pinchGesture = Gesture.Pinch()
        .onStart((event) => {
            startScale.value = scale.value;
            startTranslateX.value = translateX.value;
            startTranslateY.value = translateY.value;

            pinchFocalX.value = event.focalX - viewport.width / 2;
            pinchFocalY.value = event.focalY - viewport.height / 2;
        })
        .onUpdate((event) => {
            const nextScale = clamp(
                startScale.value * event.scale,
                minScale,
                maxScale,
            );

            /*
              Focal point is measured relative to the map viewport.
              Coordinates are converted to a point relative
              to the viewport centre.
            */
            const focalX = pinchFocalX.value;
            const focalY = pinchFocalY.value;

            /*
              Keeps the map point located under the user's fingers
              in that same location while scaling.
            */
            const scaleRatio = nextScale / startScale.value;

            const nextX =
                focalX -
                (focalX - startTranslateX.value) * scaleRatio;

            const nextY =
                focalY -
                (focalY - startTranslateY.value) * scaleRatio;

            const next = clampTranslation(
                nextX,
                nextY,
                nextScale,
            );

            scale.value = nextScale;
            translateX.value = next.x;
            translateY.value = next.y;
        })
        .onEnd(() => {
            const next = clampTranslation(
                translateX.value,
                translateY.value,
                scale.value,
            );

            translateX.value = withSpring(next.x);
            translateY.value = withSpring(next.y);
        });

    const doubleTapZoomFactor = 1.8;

    const doubleTapMaxDelayMs = 300;
    const doubleTapMaxMovePx = 100;

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(doubleTapMaxDelayMs)
        .maxDeltaX(doubleTapMaxMovePx)
        .maxDeltaY(doubleTapMaxMovePx)
        .onEnd((event) => {
            if (!viewport.width || !viewport.height) {
                return;
            }

            const currentScale = scale.value;
            const targetScale = clamp(
                currentScale * doubleTapZoomFactor,
                minScale,
                maxScale,
            );

            const focalX = event.x - viewport.width / 2;
            const focalY = event.y - viewport.height / 2;

            const scaleRatio = targetScale / currentScale;

            const nextX =
                focalX -
                (focalX - translateX.value) * scaleRatio;

            const nextY =
                focalY -
                (focalY - translateY.value) * scaleRatio;

            const next = clampTranslation(
                nextX,
                nextY,
                targetScale,
            );

            scale.value = withSpring(targetScale);
            translateX.value = withSpring(next.x);
            translateY.value = withSpring(next.y);
        });

    const gesture = Gesture.Simultaneous(
        panGesture,
        pinchGesture,
        doubleTapGesture,
    );

    const mapStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    const zoomBy = (zoomFactor) => {
        if (!viewport.width || !viewport.height) {
            return;
        }

        const nextScale = clamp(
            scale.value * zoomFactor,
            minScale,
            maxScale,
        );

        const next = clampTranslation(
            translateX.value,
            translateY.value,
            nextScale,
        );

        scale.value = withSpring(nextScale);
        translateX.value = withSpring(next.x);
        translateY.value = withSpring(next.y);
    };

    const resetMap = () => {
        scale.value = withSpring(minScale);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
    };

    const animateZoneHighlight = (zoneName) => {
        const zone = ZONES[zoneName];

        if (!zone) {
            return;
        }

        highlightedZone.value = zoneName;

        // Reset animacji
        highlightOpacity.value = 0;
        highlightScale.value = 0.96;

        // Pojawienie się ramki
        highlightOpacity.value = withSpring(1, {
            damping: 12,
            stiffness: 180,
        });

        // Delikatne "rozszerzenie" ramki
        highlightScale.value = withSpring(1, {
            damping: 10,
            stiffness: 160,
        });
    };

    const focusOnZone = (zoneName) => {
        const zone = ZONES[zoneName];
        if (!zone) {
            return;
        }

        // Środek strefy w układzie mapy
        const zoneCenterX = zone.x + zone.width / 2;
        const zoneCenterY = zone.y + zone.height / 2;

        // Docelowa skala
        const targetScale = clamp(
            minScale * zone.zoom,
            minScale,
            maxScale,
        );

        // Chcemy, żeby środek strefy był na środku viewportu.
        // Nasz układ: najpierw translate, potem scale.
        // Dla punktu p na mapie, jego pozycja na ekranie to:
        //   screenX = (p.x + translateX) * scale
        // Chcemy: screenX = viewport.width / 2
        // Stąd:
        //   translateX = viewport.width / (2 * scale) - p.x

        const nextScale = targetScale;

        const mapCenterX = MAP_WIDTH / 2;
        const mapCenterY = MAP_HEIGHT / 2;

        const nextTranslateX =
            (mapCenterX - zoneCenterX) * nextScale;

        const nextTranslateY =
            (mapCenterY - zoneCenterY) * nextScale;

        const next = clampTranslation(
            nextTranslateX,
            nextTranslateY,
            nextScale,
        );

        scale.value = withSpring(nextScale);
        translateX.value = withSpring(next.x);
        translateY.value = withSpring(next.y);

        animateZoneHighlight(zoneName);
    };

    const highlightStyle = useAnimatedStyle(() => {
        const zone = highlightedZone.value
            ? ZONES[highlightedZone.value]
            : null;

        if (!zone) {
            return {
                opacity: 0,
            };
        }

        return {
            position: 'absolute',
            left: zone.x,
            top: zone.y,
            width: zone.width,
            height: zone.height,

            opacity: highlightOpacity.value,

            transform: [
                { scale: highlightScale.value },
            ],

            borderWidth: 3,
            borderColor: '#00aaff',
            backgroundColor: 'rgba(0, 170, 255, 0.08)',

            borderRadius: 4,
            zIndex: 10,
        };
    });

    return (
        <>
            <StatusBar
                style={theme === 'dark'}
                backgroundColor="#ffffff"
                translucent={false}
            />
            <View style={styles.container}>
                <View
                    style={styles.viewport}
                    onLayout={(event) => {
                        const { width, height } =
                            event.nativeEvent.layout;

                        setViewport({ width, height });

                        if (height > 0 && !didInitialize.value) {
                            const initialScale = Math.min(
                                width / MAP_WIDTH,
                                height / MAP_HEIGHT,
                            );

                            scale.value = initialScale;
                            translateX.value = 0;
                            translateY.value = 0;
                            didInitialize.value = true;
                        }
                    }}
                >
                    {viewport.width > 0 && (
                        <GestureDetector gesture={gesture}>
                            <View style={styles.gestureArea}>
                                <Animated.View
                                    style={[
                                        styles.map,
                                        {
                                            width: MAP_WIDTH,
                                            height: MAP_HEIGHT,
                                        },
                                        mapStyle,
                                    ]}
                                >
                                    <WarehouseMapSvg
                                        width={MAP_WIDTH}
                                        height={MAP_HEIGHT}
                                    />

                                    <Animated.View style={highlightStyle} />
                                </Animated.View>
                            </View>
                        </GestureDetector>
                    )}
                </View>

                <View style={styles.controls}>
                    <Pressable
                        style={styles.controlButton}
                        onPress={() => zoomBy(1.35)}
                    >
                        <Text style={styles.controlText}>+</Text>
                    </Pressable>

                    <Pressable
                        style={styles.controlButton}
                        onPress={() => zoomBy(1 / 1.35)}
                    >
                        <Text style={styles.controlText}>−</Text>
                    </Pressable>

                    <Pressable
                        style={styles.controlButton}
                        onPress={resetMap}
                    >
                        <Text style={styles.resetText}>⌂</Text>
                    </Pressable>
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    viewport: {
        flex: 1,
        overflow: 'hidden',
    },
    gestureArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    map: {
        position: 'absolute',
    },
    controls: {
        position: 'absolute',
        right: 18,
        bottom: 28,
        gap: 8,
    },
    controlButton: {
        width: 46,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: '#ffffff',
        elevation: 5,
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowRadius: 5,
    },
    controlText: {
        fontSize: 28,
        fontWeight: '600',
    },
    resetText: {
        fontSize: 22,
        fontWeight: '600',
    },
});