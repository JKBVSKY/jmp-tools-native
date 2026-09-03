import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { addDoc, collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import MlkitOcr from 'react-native-mlkit-ocr';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { useColors } from '../../hooks/useColors';
import { StorageManager } from '../../utils/StorageManager';

const ADMIN_EMAILS = ['jakub.jaskola7@gmail.com'];
const LOCAL_SCHEDULE_KEY_PREFIX = 'scheduleItemsLocalV2';
const ASYNC_LOCAL_SCHEDULE_KEY_PREFIX = 'scheduleItemsLocalV3';
const DEBUG_CROP_HANDLES = false;
const EDGE_HANDLE_SIZE = 44;
const CORNER_HANDLE_SIZE = 48;
const MIN_CROP_WIDTH = 24;
const MIN_CROP_HEIGHT = 80;
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DEBUG_CROP_GESTURES = false;

const toFiniteNumber = (...values) => {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
};

const getNodeRect = (node) => {
  const frame = node?.frame || node?.bounds || node?.bounding || node?.boundingBox || node?.rect;
  if (!frame || typeof frame !== 'object') {
    return { x: null, y: null, width: null, height: null };
  }

  const x = toFiniteNumber(frame.x, frame.left, frame.origin?.x, frame.minX);
  const y = toFiniteNumber(frame.y, frame.top, frame.origin?.y, frame.minY);
  const width = toFiniteNumber(frame.width, frame.size?.width, frame.w);
  const height = toFiniteNumber(frame.height, frame.size?.height, frame.h);
  const right = toFiniteNumber(frame.right, frame.maxX);
  const bottom = toFiniteNumber(frame.bottom, frame.maxY);

  const normalizedWidth = Number.isFinite(width)
    ? width
    : Number.isFinite(right) && Number.isFinite(x)
      ? right - x
      : null;
  const normalizedHeight = Number.isFinite(height)
    ? height
    : Number.isFinite(bottom) && Number.isFinite(y)
      ? bottom - y
      : null;

  return {
    x,
    y,
    width: normalizedWidth,
    height: normalizedHeight,
  };
};

const flattenOcrEntries = (blocks) => {
  if (!Array.isArray(blocks)) return [];

  const entries = [];

  blocks.forEach((block) => {
    const blockText = String(block?.text || '').trim();
    const blockRect = getNodeRect(block);
    const lines = Array.isArray(block?.lines) ? block.lines : [];

    if (lines.length > 0) {
      lines.forEach((line) => {
        const lineText = String(line?.text || '').trim();
        if (!lineText) return;
        const lineRect = getNodeRect(line);
        entries.push({
          text: lineText,
          x: Number.isFinite(lineRect.x) ? lineRect.x : blockRect.x,
          y: Number.isFinite(lineRect.y) ? lineRect.y : blockRect.y,
          height: Number.isFinite(lineRect.height) ? lineRect.height : blockRect.height,
        });
      });
      return;
    }

    if (blockText) {
      entries.push({
        text: blockText,
        x: blockRect.x,
        y: blockRect.y,
        height: blockRect.height,
      });
    }
  });

  return entries;
};

const groupEntriesIntoRows = (entries) => {
  if (!entries.length) return [];

  const sortable = [...entries].sort((a, b) => {
    const yA = Number.isFinite(a.y) ? a.y : Number.MAX_SAFE_INTEGER;
    const yB = Number.isFinite(b.y) ? b.y : Number.MAX_SAFE_INTEGER;
    if (yA !== yB) return yA - yB;
    const xA = Number.isFinite(a.x) ? a.x : Number.MAX_SAFE_INTEGER;
    const xB = Number.isFinite(b.x) ? b.x : Number.MAX_SAFE_INTEGER;
    return xA - xB;
  });

  const heights = sortable
    .map((entry) => Number(entry.height))
    .filter((height) => Number.isFinite(height) && height > 0)
    .sort((a, b) => a - b);

  const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 18;
  const rowTolerance = Math.max(8, Math.min(24, Math.round(medianHeight * 0.7)));

  const rows = [];
  for (const entry of sortable) {
    if (!rows.length) {
      rows.push({ y: entry.y, entries: [entry] });
      continue;
    }

    const lastRow = rows[rows.length - 1];
    const rowY = Number.isFinite(lastRow.y) ? lastRow.y : entry.y;
    const entryY = Number.isFinite(entry.y) ? entry.y : rowY;

    if (!Number.isFinite(rowY) || Math.abs(entryY - rowY) <= rowTolerance) {
      lastRow.entries.push(entry);
      if (Number.isFinite(entryY) && Number.isFinite(rowY)) {
        lastRow.y = (rowY + entryY) / 2;
      }
    } else {
      rows.push({ y: entryY, entries: [entry] });
    }
  }

  return rows
    .map((row) => {
      const sortedEntries = [...row.entries].sort((a, b) => {
        const xA = Number.isFinite(a.x) ? a.x : Number.MAX_SAFE_INTEGER;
        const xB = Number.isFinite(b.x) ? b.x : Number.MAX_SAFE_INTEGER;
        return xA - xB;
      });

      return sortedEntries.map((entry) => entry.text).join(' ').replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);
};

const extractNumberTokens = (text) => {
  const matches = String(text || '').match(/\d+/g);
  return matches || [];
};

const buildNrScanFromBlocks = (blocks) => {
  const entries = flattenOcrEntries(blocks);
  if (!entries.length) {
    return {
      rawText: '',
      parserText: '',
      nrNumbers: [],
      info: 'Brak wpisow OCR.',
    };
  }

  const rows = groupEntriesIntoRows(entries);
  const nrNumbers = [];

  rows.forEach((rowText) => {
    const rowNumbers = extractNumberTokens(rowText);
    rowNumbers.forEach((token) => nrNumbers.push(token));
  });

  const rawText = entries.map((entry) => entry.text).filter(Boolean).join('\n');

  return {
    rawText,
    parserText: nrNumbers.join('\n'),
    nrNumbers,
    info: `Znaleziono ${nrNumbers.length} numerow NR.`,
  };
};

const formatTimestamp = (value) => {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const toInteger = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
};

const normalizeScheduleItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => ({
    id: String(item?.id || `local-${Date.now()}-${index}`),
    lp: String(item?.lp ?? ''),
    nr: String(item?.nr ?? ''),
    pasy: String(item?.pasy ?? ''),
    createdAt: item?.createdAt ? new Date(item.createdAt) : new Date(),
  }));
};

const buildRowsFromLpRange = (lpStartValue, lpEndValue, nrNumbers) => {
  const start = toInteger(lpStartValue);
  const end = toInteger(lpEndValue);

  if (start === null || end === null) {
    return { rows: [], error: 'Uzupełnij wartości początku i końca LP.' };
  }

  if (start < 0 || end < 0) {
    return { rows: [], error: 'LP nie może być ujemne.' };
  }

  if (end < start) {
    return { rows: [], error: 'Ostatni LP musi być większy lub równy pierwszemu LP.' };
  }

  const rangeCount = end - start + 1;
  const rowCount = Math.max(rangeCount, nrNumbers.length);
  const timestampSeed = Date.now();

  const rows = Array.from({ length: rowCount }, (_, index) => ({
    id: `scanned-${timestampSeed}-${index}`,
    lp: index < rangeCount ? String(start + index) : '',
    nr: index < nrNumbers.length ? String(nrNumbers[index]) : '',
    pasy: '',
    createdAt: new Date(),
  }));

  return { rows, error: '' };
};

const getNormalizedLpValue = (value) => String(value ?? '').trim();

const findDuplicateLpValues = (scheduleItems) => {
  const counts = new Map();

  scheduleItems.forEach((item) => {
    const lpValue = getNormalizedLpValue(item?.lp);
    if (!lpValue) return;
    counts.set(lpValue, (counts.get(lpValue) || 0) + 1);
  });

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([lpValue]) => lpValue)
    .sort((left, right) => Number(left) - Number(right));
};

const getLocalScheduleKey = (userId) => {
  const safeUserId = String(userId || 'guest').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${LOCAL_SCHEDULE_KEY_PREFIX}_${safeUserId}`;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function ScheduleScreen() {
  const colors = useColors();
  const { user, isGuest } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [verificationItems, setVerificationItems] = useState([]);
  const [rawOcrText, setRawOcrText] = useState('');
  const [parseDebug, setParseDebug] = useState([]);
  const [rawPreviewVisible, setRawPreviewVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [tempPhotoUri, setTempPhotoUri] = useState(null);
  const [isCropModalVisible, setIsCropModalVisible] = useState(false);
  const [sourceImageSize, setSourceImageSize] = useState(null);
  const [imageLayout, setImageLayout] = useState(null);
  const [cropRect, setCropRect] = useState(null);
  const [imageTransform, setImageTransform] = useState({ scale: MIN_SCALE, translateX: 0, translateY: 0 });
  const [pinchDiagnostics, setPinchDiagnostics] = useState({ active: false, eventScale: 1, appliedScale: MIN_SCALE, translateX: 0, translateY: 0 });
  const [lastCrop, setLastCrop] = useState(null);
  const [lastCropPreviewVisible, setLastCropPreviewVisible] = useState(false);
  const [cropDiagnostics, setCropDiagnostics] = useState(null);
  const [ocrDiagnostics, setOcrDiagnostics] = useState(null);

  const [verificationMode, setVerificationMode] = useState('scan');
  const [scannedNrNumbers, setScannedNrNumbers] = useState([]);
  const [lpStartInput, setLpStartInput] = useState('1');
  const [lpEndInput, setLpEndInput] = useState('');
  const [rangeError, setRangeError] = useState('');
  const persistTimerRef = React.useRef(null);
  const cropRectRef = useRef(null);
  const cropGestureStartRef = useRef(null);
  const imageLayoutRef = useRef(null);
  const imageTransformRef = useRef(imageTransform);
  const cropInteractionStartRef = useRef(null);
  const resizeGestureActiveRef = useRef(false);
  const scrollViewRef = useRef(null);
  const rowPositionsRef = useRef({});
  const scale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(MIN_SCALE);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const pinchStartDistance = useSharedValue(0);

  const logPinchDiagnostic = useCallback((message, data) => {
    if (DEBUG_CROP_GESTURES) console.log('[Schedule crop]', message, data);
  }, []);

  const updatePinchDiagnostics = useCallback((nextDiagnostics) => {
    setPinchDiagnostics(nextDiagnostics);
  }, []);

  const isAdmin = !!user?.email && !isGuest && ADMIN_EMAILS.includes(user.email.toLowerCase());
  const scheduleCollection = user ? collection(db, 'users', user.id, 'scheduleItems') : null;
  const localStorageKey = getLocalScheduleKey(user?.id);
  const asyncLocalStorageKey = `${ASYNC_LOCAL_SCHEDULE_KEY_PREFIX}_${String(user?.id || 'guest').replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  useEffect(() => {
    if (!tempPhotoUri) {
      setSourceImageSize(null);
      setImageLayout(null);
      setCropRect(null);
      cropRectRef.current = null;
      setImageTransform({ scale: MIN_SCALE, translateX: 0, translateY: 0 });
      imageTransformRef.current = { scale: MIN_SCALE, translateX: 0, translateY: 0 };
      scale.value = MIN_SCALE;
      translateX.value = 0;
      translateY.value = 0;
      savedScale.value = MIN_SCALE;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      return undefined;
    }

    let cancelled = false;
    Image.getSize(
      tempPhotoUri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) setSourceImageSize({ width, height });
      },
      () => {
        if (!cancelled) setSourceImageSize(null);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [tempPhotoUri, savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY]);

  useEffect(() => {
    imageLayoutRef.current = imageLayout;
  }, [imageLayout]);

  const commitImageTransform = useCallback((nextTransform) => {
    const safeTransform = {
      scale: clamp(Number(nextTransform.scale) || MIN_SCALE, MIN_SCALE, MAX_SCALE),
      translateX: Number(nextTransform.translateX) || 0,
      translateY: Number(nextTransform.translateY) || 0,
    };
    imageTransformRef.current = safeTransform;
    setImageTransform(safeTransform);
    setPinchDiagnostics((previous) => ({
      ...previous,
      active: false,
      eventScale: safeTransform.scale,
      appliedScale: safeTransform.scale,
      translateX: safeTransform.translateX,
      translateY: safeTransform.translateY,
    }));
    if (DEBUG_CROP_GESTURES) {
      console.log('[Schedule crop] pinch end scale:', safeTransform.scale);
    }
  }, []);

  const getTransformedImageBounds = useCallback((layout = imageLayoutRef.current, transform = imageTransformRef.current) => {
    if (!layout?.displayedWidth || !layout?.displayedHeight) return null;
    const centerX = layout.imageOffsetX + layout.displayedWidth / 2;
    const centerY = layout.imageOffsetY + layout.displayedHeight / 2;
    const width = layout.displayedWidth * transform.scale;
    const height = layout.displayedHeight * transform.scale;
    return {
      left: centerX - width / 2 + transform.translateX,
      top: centerY - height / 2 + transform.translateY,
      right: centerX + width / 2 + transform.translateX,
      bottom: centerY + height / 2 + transform.translateY,
    };
  }, []);

  const clampImageTransform = useCallback((nextTransform) => {
    const layout = imageLayoutRef.current;
    if (!layout?.width || !layout?.height || !layout.displayedWidth || !layout.displayedHeight) {
      return nextTransform;
    }
    const safeScale = clamp(Number(nextTransform.scale) || MIN_SCALE, MIN_SCALE, MAX_SCALE);
    const maxTranslateX = Math.max(0, (layout.displayedWidth * safeScale - layout.width) / 2);
    const maxTranslateY = Math.max(0, (layout.displayedHeight * safeScale - layout.height) / 2);
    return {
      scale: safeScale,
      translateX: clamp(Number(nextTransform.translateX) || 0, -maxTranslateX, maxTranslateX),
      translateY: clamp(Number(nextTransform.translateY) || 0, -maxTranslateY, maxTranslateY),
    };
  }, []);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  const imageGestures = useMemo(() => {
    const layoutWidth = imageLayout?.width || 0;
    const layoutHeight = imageLayout?.height || 0;
    const displayedWidth = imageLayout?.displayedWidth || 0;
    const displayedHeight = imageLayout?.displayedHeight || 0;
    const clampGestureTranslation = (value, zoom, size, containerSize) => {
      'worklet';
      const maxTranslation = Math.max(0, (size * zoom - containerSize) / 2);
      return Math.min(Math.max(value, -maxTranslation), maxTranslation);
    };
    const pinch = Gesture.Pinch()
      .onStart((event) => {
        savedScale.value = scale.value;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        pinchStartDistance.value = 1;
        if (DEBUG_CROP_GESTURES) {
          runOnJS(logPinchDiagnostic)('pinch start', {
            touches: event.numberOfPointers,
            initialDistance: pinchStartDistance.value,
            scale: scale.value,
          });
          runOnJS(updatePinchDiagnostics)({ active: true, eventScale: 1, appliedScale: scale.value, translateX: translateX.value, translateY: translateY.value });
        }
      })
      .onUpdate((event) => {
        const nextScale = Math.min(Math.max(savedScale.value * event.scale, MIN_SCALE), MAX_SCALE);
        scale.value = nextScale;
        translateX.value = clampGestureTranslation(savedTranslateX.value, nextScale, displayedWidth, layoutWidth);
        translateY.value = clampGestureTranslation(savedTranslateY.value, nextScale, displayedHeight, layoutHeight);
        if (DEBUG_CROP_GESTURES) {
          runOnJS(logPinchDiagnostic)('pinch update', {
            touches: event.numberOfPointers,
            currentDistance: event.scale,
            calculatedScale: nextScale,
          });
          runOnJS(updatePinchDiagnostics)({ active: true, eventScale: event.scale, appliedScale: nextScale, translateX: translateX.value, translateY: translateY.value });
        }
      })
      .onEnd(() => {
        runOnJS(commitImageTransform)({
          scale: scale.value,
          translateX: translateX.value,
          translateY: translateY.value,
        });
      });
    const pan = Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .onStart(() => {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        translateX.value = clampGestureTranslation(savedTranslateX.value + event.translationX, scale.value, displayedWidth, layoutWidth);
        translateY.value = clampGestureTranslation(savedTranslateY.value + event.translationY, scale.value, displayedHeight, layoutHeight);
      })
      .onEnd(() => {
        runOnJS(commitImageTransform)({
          scale: scale.value,
          translateX: translateX.value,
          translateY: translateY.value,
        });
      });
    return Gesture.Simultaneous(pinch, pan);
  }, [commitImageTransform, imageLayout, logPinchDiagnostic, scale, translateX, translateY, savedScale, savedTranslateX, savedTranslateY, pinchStartDistance, updatePinchDiagnostics]);

  const applyDebugTransform = (nextScale) => {
    const safeScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const nextTransform = clampImageTransform({
      scale: safeScale,
      translateX: imageTransformRef.current.translateX,
      translateY: imageTransformRef.current.translateY,
    });
    scale.value = nextTransform.scale;
    translateX.value = nextTransform.translateX;
    translateY.value = nextTransform.translateY;
    savedScale.value = nextTransform.scale;
    savedTranslateX.value = nextTransform.translateX;
    savedTranslateY.value = nextTransform.translateY;
    commitImageTransform(nextTransform);
  };

  const resetDebugTransform = () => {
    scale.value = MIN_SCALE;
    translateX.value = 0;
    translateY.value = 0;
    savedScale.value = MIN_SCALE;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    commitImageTransform({ scale: MIN_SCALE, translateX: 0, translateY: 0 });
  };

  useEffect(() => {
    if (!sourceImageSize || !imageLayout?.width || !imageLayout?.height) return;

    const imageRatio = sourceImageSize.width / sourceImageSize.height;
    const containerRatio = imageLayout.width / imageLayout.height;
    const displayedWidth = imageRatio > containerRatio
      ? imageLayout.width
      : imageLayout.height * imageRatio;
    const displayedHeight = imageRatio > containerRatio
      ? imageLayout.width / imageRatio
      : imageLayout.height;
    const imageOffsetX = (imageLayout.width - displayedWidth) / 2;
    const imageOffsetY = (imageLayout.height - displayedHeight) / 2;
    if (
      imageLayout.displayedWidth === displayedWidth &&
      imageLayout.displayedHeight === displayedHeight &&
      imageLayout.imageOffsetX === imageOffsetX &&
      imageLayout.imageOffsetY === imageOffsetY
    ) {
      return;
    }
    const nextImageLayout = {
      ...imageLayout,
      imageOffsetX,
      imageOffsetY,
      displayedWidth,
      displayedHeight,
    };
    setImageLayout(nextImageLayout);

    const initialRect = {
      left: imageOffsetX + displayedWidth * 0.25,
      top: imageOffsetY + displayedHeight * 0.1,
      width: displayedWidth * 0.5,
      height: displayedHeight * 0.8,
    };
    setCropRect(initialRect);
    cropRectRef.current = initialRect;
  }, [sourceImageSize, imageLayout]);

  const updateCropRect = useCallback((handle, dx, dy) => {
    const start = cropGestureStartRef.current;
    const layout = imageLayoutRef.current;
    const bounds = getTransformedImageBounds();
    if (!start || !layout?.width || !layout?.height || !bounds) return;

    const minWidth = Math.min(MIN_CROP_WIDTH, layout.width);
    const minHeight = Math.min(MIN_CROP_HEIGHT, layout.height);
    const imageLeft = clamp(bounds.left, 0, layout.width - minWidth);
    const imageTop = clamp(bounds.top, 0, layout.height - minHeight);
    const imageRight = clamp(bounds.right, minWidth, layout.width);
    const imageBottom = clamp(bounds.bottom, minHeight, layout.height);
    let left = start.left;
    let top = start.top;
    let right = start.left + start.width;
    let bottom = start.top + start.height;

    if (handle.includes('left')) left = clamp(start.left + dx, imageLeft, right - minWidth);
    if (handle.includes('right')) right = clamp(start.left + start.width + dx, left + minWidth, imageRight);
    if (handle.includes('top')) top = clamp(start.top + dy, imageTop, bottom - minHeight);
    if (handle.includes('bottom')) bottom = clamp(start.top + start.height + dy, top + minHeight, imageBottom);

    const nextRect = {
      left: clamp(left, imageLeft, imageRight - minWidth),
      top: clamp(top, imageTop, imageBottom - minHeight),
      width: clamp(right - left, minWidth, imageRight - left),
      height: clamp(bottom - top, minHeight, imageBottom - top),
    };
    cropRectRef.current = nextRect;
    setCropRect(nextRect);
  }, [getTransformedImageBounds]);

  const cropResponders = useMemo(() => {
    const handles = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
    return handles.reduce((responders, handle) => {
      responders[handle] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          resizeGestureActiveRef.current = true;
          cropGestureStartRef.current = cropRectRef.current;
        },
        onPanResponderMove: (_, gestureState) => updateCropRect(handle, gestureState.dx, gestureState.dy),
        onPanResponderRelease: () => {
          resizeGestureActiveRef.current = false;
          cropGestureStartRef.current = null;
        },
        onPanResponderTerminate: () => {
          resizeGestureActiveRef.current = false;
          cropGestureStartRef.current = null;
        },
      });
      return responders;
    }, {});
  }, [updateCropRect]);

  const isResizeHandlePoint = useCallback((point, rect) => {
    if (!point || !rect) return false;
    const cornerSize = CORNER_HANDLE_SIZE;
    const edgeSize = EDGE_HANDLE_SIZE;
    const corners = [
      { left: rect.left - cornerSize / 2, top: rect.top - cornerSize / 2 },
      { left: rect.left + rect.width - cornerSize / 2, top: rect.top - cornerSize / 2 },
      { left: rect.left - cornerSize / 2, top: rect.top + rect.height - cornerSize / 2 },
      { left: rect.left + rect.width - cornerSize / 2, top: rect.top + rect.height - cornerSize / 2 },
    ];
    if (corners.some((corner) => point.x >= corner.left && point.x <= corner.left + cornerSize
      && point.y >= corner.top && point.y <= corner.top + cornerSize)) {
      return true;
    }

    return (
      (point.x >= rect.left - edgeSize / 2 && point.x <= rect.left + edgeSize / 2
        && point.y >= rect.top && point.y <= rect.top + rect.height)
      || (point.x >= rect.left + rect.width - edgeSize / 2
        && point.x <= rect.left + rect.width + edgeSize / 2
        && point.y >= rect.top && point.y <= rect.top + rect.height)
      || (point.y >= rect.top - edgeSize / 2 && point.y <= rect.top + edgeSize / 2
        && point.x >= rect.left && point.x <= rect.left + rect.width)
      || (point.y >= rect.top + rect.height - edgeSize / 2
        && point.y <= rect.top + rect.height + edgeSize / 2
        && point.x >= rect.left && point.x <= rect.left + rect.width)
    );
  }, []);

  const updateCropPosition = useCallback((dx, dy) => {
    const start = cropInteractionStartRef.current;
    const layout = imageLayoutRef.current;
    const imageBounds = getTransformedImageBounds();
    if (!start?.cropRect || !layout || !imageBounds) return;

    const minLeft = Math.max(0, imageBounds.left);
    const minTop = Math.max(0, imageBounds.top);
    const maxRight = Math.min(layout.width, imageBounds.right);
    const maxBottom = Math.min(layout.height, imageBounds.bottom);
    const maxLeft = Math.max(minLeft, maxRight - start.cropRect.width);
    const maxTop = Math.max(minTop, maxBottom - start.cropRect.height);
    const nextRect = {
      ...start.cropRect,
      left: clamp(start.cropRect.left + dx, minLeft, maxLeft),
      top: clamp(start.cropRect.top + dy, minTop, maxTop),
    };
    cropRectRef.current = nextRect;
    setCropRect(nextRect);
  }, [getTransformedImageBounds]);

  const cropPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (event) => {
      const rect = cropRectRef.current;
      const point = { x: Number(event?.nativeEvent?.locationX), y: Number(event?.nativeEvent?.locationY) };
      const touches = event?.nativeEvent?.touches || [];
      const localRect = rect && { left: 0, top: 0, width: rect.width, height: rect.height };
      return Boolean(touches.length <= 1 && rect && Number.isFinite(point.x) && Number.isFinite(point.y)
        && point.x >= 0 && point.x <= rect.width
        && point.y >= 0 && point.y <= rect.height
        && !isResizeHandlePoint(point, localRect) && !resizeGestureActiveRef.current);
    },
    onPanResponderGrant: () => {
      cropInteractionStartRef.current = { cropRect: cropRectRef.current };
    },
    onPanResponderMove: (_, gestureState) => updateCropPosition(gestureState.dx, gestureState.dy),
    onPanResponderRelease: () => {
      cropInteractionStartRef.current = null;
    },
    onPanResponderTerminate: () => {
      cropInteractionStartRef.current = null;
    },
  }), [isResizeHandlePoint, updateCropPosition]);

  const suggestedLpEnd = useMemo(() => {
    const start = toInteger(lpStartInput);
    if (start === null || scannedNrNumbers.length === 0) return '';
    return String(start + scannedNrNumbers.length - 1);
  }, [lpStartInput, scannedNrNumbers]);

  const persistLocalItems = async (nextItems) => {
    const serializable = nextItems.map((item, index) => ({
      id: String(item?.id || `local-${Date.now()}-${index}`),
      lp: String(item?.lp ?? ''),
      nr: String(item?.nr ?? ''),
      pasy: String(item?.pasy ?? ''),
      createdAt: item?.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
    }));
    await AsyncStorage.setItem(asyncLocalStorageKey, JSON.stringify(serializable));
  };

  useEffect(() => {
    let cancelled = false;

    const loadLocalItems = async () => {
      setLoading(true);
      try {
        let raw = await AsyncStorage.getItem(asyncLocalStorageKey);
        if (!raw) {
          raw = await StorageManager.getItem(localStorageKey);
          if (raw) await AsyncStorage.setItem(asyncLocalStorageKey, raw);
        }
        if (cancelled) return;
        if (!raw) {
          setItems([]);
          return;
        }

        const parsed = JSON.parse(raw);
        setItems(normalizeScheduleItems(parsed));
      } catch (error) {
        console.error('Load local schedule error:', error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadLocalItems();

    return () => {
      cancelled = true;
    };
  }, [asyncLocalStorageKey, localStorageKey]);

  useEffect(() => () => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
  }, []);

  const filteredItems = useMemo(() => {
    const queryText = searchText.trim().toLowerCase();
    const matchingItems = !queryText
      ? items
      : items.filter((item) =>
          [item.lp, item.nr]
            .concat(item.pasy)
            .map((value) => String(value || '').toLowerCase())
            .some((value) => value.includes(queryText))
        );

    return [...matchingItems].sort((left, right) => {
      const leftLp = Number(left.lp);
      const rightLp = Number(right.lp);

      if (Number.isFinite(leftLp) && Number.isFinite(rightLp) && leftLp !== rightLp) {
        return leftLp - rightLp;
      }

      return String(left.lp || '').localeCompare(String(right.lp || ''), 'pl', { numeric: true });
    });
  }, [items, searchText]);

  const updateItemField = (id, field, value) => {
    const next = items.map((item) => (item.id === id ? { ...item, [field]: value } : item));
    setItems(next);
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      void persistLocalItems(next);
    }, 600);
  };

  const clearAllItems = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(asyncLocalStorageKey),
        StorageManager.removeItem(localStorageKey),
      ]);
      setItems([]);
    } catch (error) {
      console.error('Clear local schedule error:', error);
      Alert.alert('Błąd', 'Nie udało się wyczyścić listy lokalnej.');
    }
  };

  const handleClearPress = () => {
    if (!isAdmin) return;

    Alert.alert('Wyczyść harmonogram', 'Czy na pewno chcesz usunąć wszystkie lokalne pozycje?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyczyść',
        style: 'destructive',
        onPress: async () => {
          await clearAllItems();
        },
      },
    ]);
  };

  const saveVerificationItems = async () => {
    if (!isAdmin) return;

    setIsSaving(true);

    try {
      const normalized = normalizeScheduleItems(verificationItems);
      const nextItems = verificationMode === 'scan' ? [...items, ...normalized] : normalized;
      const overlappingLpValues = findDuplicateLpValues(nextItems);

      if (overlappingLpValues.length > 0) {
        Alert.alert(
          'Nakładające się LP',
          `Nie można dodać skanu, ponieważ te LP już istnieją: ${overlappingLpValues.join(', ')}`
        );
        return;
      }

      setItems(nextItems);
      await persistLocalItems(nextItems);
      setVerificationVisible(false);
      Alert.alert(
        'Zapisano lokalnie',
        verificationMode === 'scan'
          ? 'Nowy skan został dołączony do lokalnej tabeli.'
          : 'Tabela została zapisana na urządzeniu.'
      );
    } catch (error) {
      console.error('Verification local save error:', error);
      Alert.alert('Błąd', 'Nie udało się zapisać danych lokalnie.');
    } finally {
      setIsSaving(false);
    }
  };

  const pushLocalItemsToFirestore = async () => {
    if (!isAdmin || !user || !scheduleCollection) return;

    if (!items.length) {
      Alert.alert('Brak danych', 'Najpierw zapisz lokalnie przynajmniej jeden wiersz.');
      return;
    }

    setIsSharing(true);

    try {
      const snapshot = await getDocs(scheduleCollection);
      const batch = writeBatch(db);
      snapshot.docs.forEach((docItem) => {
        batch.delete(doc(db, 'users', user.id, 'scheduleItems', docItem.id));
      });
      await batch.commit();

      for (const item of items) {
        await addDoc(scheduleCollection, {
          lp: String(item.lp || ''),
          nr: String(item.nr || ''),
          pasy: String(item.pasy || ''),
          createdAt: item.createdAt || new Date(),
        });
      }

      Alert.alert('Udostępniono', 'Lokalna tabela została wysłana do Firestore.');
    } catch (error) {
      console.error('Share schedule error:', error);
      Alert.alert('Błąd', 'Nie udało się udostępnić danych do Firestore.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleSharePress = () => {
    if (!isAdmin) return;

    Alert.alert('Udostępnij harmonogram', 'Czy na pewno chcesz wysłać lokalną tabelę do Firestore?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Udostępnij',
        onPress: async () => {
          await pushLocalItemsToFirestore();
        },
      },
    ]);
  };

  const getPickedImageUri = (result) => {
    if (!result || result.canceled) return null;
    if (Array.isArray(result.assets) && result.assets.length > 0) {
      return result.assets[0]?.uri ?? null;
    }
    return null;
  };

  const recognizeTextFromImage = async (uri) => {
    try {
      if (!uri) return null;

      const textBlocks = await MlkitOcr.detectFromUri(uri);
      const entries = flattenOcrEntries(textBlocks);
      setOcrDiagnostics({
        status: Array.isArray(textBlocks) && textBlocks.length ? 'tekst' : 'brak tekstu',
        blockCount: Array.isArray(textBlocks) ? textBlocks.length : 0,
        entryCount: entries.length,
        blocksText: entries.map((entry) => entry.text).filter(Boolean).join('\n'),
        parserNumbers: [],
      });
      if (!Array.isArray(textBlocks) || textBlocks.length === 0) return null;

      const result = buildNrScanFromBlocks(textBlocks);
      setOcrDiagnostics((previous) => ({
        ...previous,
        parserNumbers: result.nrNumbers,
      }));
      return result;
    } catch (error) {
      console.log('Text recognition error:', error);
      setOcrDiagnostics({ status: 'błąd OCR', error: String(error?.message || error), blockCount: 0, entryCount: 0, blocksText: '', parserNumbers: [] });
      return null;
    }
  };

  const pickImage = async (source) => {
    try {
      const permissionMethod =
        source === 'camera'
          ? ImagePicker.requestCameraPermissionsAsync
          : ImagePicker.requestMediaLibraryPermissionsAsync;

      const permission = await permissionMethod();
      if (!permission.granted) {
        Alert.alert('Brak uprawnień', 'Proszę zezwolić na dostęp do aparatu lub galerii.');
        return null;
      }

      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        base64: false,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      return getPickedImageUri(result);
    } catch (error) {
      console.log('Image picker error:', error);
      Alert.alert('Skanowanie niedostępne', 'Nie udało się otworzyć aparatu lub galerii.');
      return null;
    }
  };

  const rebuildRowsFromRange = (nextStartValue, nextEndValue) => {
    const buildResult = buildRowsFromLpRange(nextStartValue, nextEndValue, scannedNrNumbers);

    if (buildResult.error) {
      setRangeError(buildResult.error);
      return;
    }

    setRangeError('');
    setVerificationItems(buildResult.rows);
  };

  const processScannedImage = async (uri) => {
    if (!uri) return;

    const ocrData = await recognizeTextFromImage(uri);

    const rawPreviewSections = [
      ocrData?.info ? `[INFO]\n${ocrData.info}` : '',
      ocrData?.parserText ? `[NR NUMBERS]\n${ocrData.parserText}` : '',
      ocrData?.rawText ? `[FULL OCR]\n${ocrData.rawText}` : '',
    ].filter(Boolean);
    setRawOcrText(rawPreviewSections.join('\n\n'));

    if (!ocrData?.nrNumbers?.length) {
      setParseDebug([]);
      setRawPreviewVisible(true);
      Alert.alert(
        'Brak numerów',
        'Nie znaleziono żadnych liczb NR. Otworzono podgląd surowego OCR do diagnostyki.'
      );
      return;
    }

    const startValue = '1';
    const endValue = String(ocrData.nrNumbers.length);

    setVerificationMode('scan');
    setScannedNrNumbers(ocrData.nrNumbers);
    setLpStartInput(startValue);
    setLpEndInput(endValue);
    setRangeError('');
    setParseDebug([
      `Rozpoznane numery NR: ${ocrData.nrNumbers.length}`,
      `Sugerowany zakres LP: ${startValue}-${endValue}`,
    ]);

    const buildResult = buildRowsFromLpRange(startValue, endValue, ocrData.nrNumbers);
    setVerificationItems(buildResult.rows);
    setVerificationVisible(true);
  };

  const handleScanPress = () => {
    if (!isAdmin) return;

    Alert.alert(
      'Skanuj dokument',
      'Wybierz źródło obrazu i przytnij zdjęcie tak, aby było widać tylko kolumnę NR.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Galeria',
          onPress: async () => {
            const uri = await pickImage('gallery');
            if (uri) {
              setTempPhotoUri(uri);
              setIsCropModalVisible(true);
            }
          },
        },
        {
          text: 'Aparat',
          onPress: async () => {
            const uri = await pickImage('camera');
            if (uri) {
              setTempPhotoUri(uri);
              setIsCropModalVisible(true);
            }
          },
        },
      ]
    );
  };

  const handleEditPress = () => {
    if (!isAdmin) return;
    if (!items.length) {
      Alert.alert('Brak danych', 'Nie ma jeszcze lokalnych pozycji do edycji.');
      return;
    }

    setVerificationMode('edit');
    setScannedNrNumbers([]);
    setLpStartInput('');
    setLpEndInput('');
    setRangeError('');
    setVerificationItems(normalizeScheduleItems(items));
    setVerificationVisible(true);
  };

  const addVerificationRow = () => {
    setVerificationItems((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}-${prev.length}`,
        lp: '',
        nr: '',
        pasy: '',
        createdAt: new Date(),
      },
    ]);
  };

  const removeLastVerificationRow = () => {
    setVerificationItems((prev) => prev.slice(0, -1));
  };

  const clearVerificationRows = () => {
    setVerificationItems([]);
  };

  const scrollVerificationToIndex = useCallback((index, animated = true) => {
    if (!scrollViewRef.current || !Number.isInteger(index)) return;

    const rowY = rowPositionsRef.current[index];
    if (rowY === undefined) return;

    scrollViewRef.current.scrollTo({
      y: Math.max(0, rowY - 20),
      animated,
    });
  }, []);

  const handleVerificationInputFocus = useCallback((index) => {
    requestAnimationFrame(() => scrollVerificationToIndex(index));
  }, [scrollVerificationToIndex]);

  const renderTableHeader = () => (
    <View style={[styles.tableHeaderRow, { backgroundColor: colors.navBackground, borderColor: colors.border }]}> 
      <View style={[styles.tableHeaderCell, styles.tableLpCell, { borderColor: colors.border }]}>
        <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>LP</Text>
      </View>
      <View style={[styles.tableHeaderCell, styles.tableNrCell, { borderColor: colors.border }]}>
        <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>NR</Text>
      </View>
      <View style={[styles.tableHeaderCell, styles.tablePasyCell, { borderColor: colors.border }]}>
        <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>Pasy</Text>
      </View>
    </View>
  );

  const renderRow = ({ item, index }) => {
    const rowBackground = index % 2 === 0 ? colors.cardBackground : colors.background;

    return (
      <View style={[styles.tableRow, { backgroundColor: rowBackground, borderColor: colors.border }]}> 
        <View style={[styles.tableCell, styles.tableLpCell, { borderColor: colors.border }]}> 
          <TextInput
            value={String(item.lp ?? '')}
            onChangeText={(value) => updateItemField(item.id, 'lp', value)}
            editable={isAdmin}
            keyboardType="number-pad"
            inputMode="numeric"
            style={[
              styles.tableInput,
              { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.background },
            ]}
          />
        </View>
        <View style={[styles.tableCell, styles.tableNrCell, { borderColor: colors.border }]}>
          <TextInput
            value={String(item.nr ?? '')}
            onChangeText={(value) => updateItemField(item.id, 'nr', value)}
            editable={isAdmin}
            keyboardType="number-pad"
            inputMode="numeric"
            style={[
              styles.tableInput,
              { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.background },
            ]}
          />
        </View>
        <View style={[styles.tableCell, styles.tablePasyCell, { borderColor: colors.border }]}> 
          <TextInput
            value={String(item.pasy ?? '')}
            onChangeText={(value) => updateItemField(item.id, 'pasy', value)}
            editable={isAdmin}
            keyboardType="number-pad"
            inputMode="numeric"
            style={[
              styles.tableInput,
              { color: colors.text, borderColor: colors.inputBorder, backgroundColor: colors.background },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderVerificationRow = ({ item, index }) => (
    <View
      key={item.id}
      onLayout={(event) => {
        rowPositionsRef.current[index] = event.nativeEvent.layout.y;
      }}
      style={[styles.verificationRow, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}
    > 
      <Text style={[styles.verificationTimestamp, { color: colors.grayIconColor }]}> {formatTimestamp(item.createdAt)} </Text>
      <View style={styles.rowFields}>
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LP</Text>
          <TextInput
            value={String(item.lp ?? '')}
            onFocus={() => handleVerificationInputFocus(index)}
            onChangeText={(value) => {
              setVerificationItems((prev) =>
                prev.map((row) => (row.id === item.id ? { ...row, lp: value } : row))
              );
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            style={[
              styles.fieldInput,
              { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder },
            ]}
          />
        </View>
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>NR</Text>
          <TextInput
            value={String(item.nr ?? '')}
            onFocus={() => handleVerificationInputFocus(index)}
            onChangeText={(value) => {
              setVerificationItems((prev) =>
                prev.map((row) => (row.id === item.id ? { ...row, nr: value } : row))
              );
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            style={[
              styles.fieldInput,
              { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder },
            ]}
          />
        </View>
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Pasy</Text>
          <TextInput
            value={String(item.pasy ?? '')}
            onFocus={() => handleVerificationInputFocus(index)}
            onChangeText={(value) => {
              setVerificationItems((prev) =>
                prev.map((row) => (row.id === item.id ? { ...row, pasy: value } : row))
              );
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            style={[
              styles.fieldInput,
              { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder },
            ]}
          />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <Stack.Screen options={{ title: 'Harmonogram' }} />

      <View style={[styles.header, { backgroundColor: colors.navBackground, borderColor: colors.border }]}> 
        <View style={styles.headerTextContainer}>
          <Text style={[styles.title, { color: colors.text }]}>Harmonogram</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Skanuj NR, zapisz lokalnie, potem udostępnij</Text>
        </View>

        {isAdmin ? (
          <View style={styles.headerButtons}>
            <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.butBackground }]} onPress={handleScanPress}>
              <Text style={[styles.headerButtonText, { color: colors.butText }]}>Skanuj</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.butBackground }]} onPress={handleEditPress}>
              <Text style={[styles.headerButtonText, { color: colors.butText }]}>Edytuj</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.butBackground }]} onPress={handleClearPress}>
              <Text style={[styles.headerButtonText, { color: colors.butText }]}>Wyczyść</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.butBackground }]}
              onPress={handleSharePress}
              disabled={isSharing || !items.length}
            >
              {isSharing ? (
                <ActivityIndicator color={colors.butText} />
              ) : (
                <Text style={[styles.headerButtonText, { color: colors.butText, opacity: items.length ? 1 : 0.55 }]}>Udostępnij</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.butBackground }]}
              onPress={() => setRawPreviewVisible(true)}
              disabled={!rawOcrText}
            >
              <Text style={[styles.headerButtonText, { color: colors.butText, opacity: rawOcrText ? 1 : 0.55 }]}>OCR</Text>
            </TouchableOpacity>
            {lastCrop ? (
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: colors.butBackground }]}
                onPress={() => setLastCropPreviewVisible(true)}
              >
                <Text style={[styles.headerButtonText, { color: colors.butText }]}>Crop</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.content, { backgroundColor: colors.background }]}> 
        <View style={[styles.searchWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
          <TextInput
            placeholder="Szukaj w harmonogramie..."
            placeholderTextColor={colors.phText}
            value={searchText}
            onChangeText={setSearchText}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
            keyboardType="number-pad"
            inputMode="numeric"
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.sIconColor} size="large" />
          </View>
        ) : (
          <View style={[styles.tableWrapper, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}> 
            {renderTableHeader()}
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              renderItem={renderRow}
              style={styles.tableList}
              contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Brak zapisanych lokalnie pozycji.</Text>
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
      </View>

      <Modal visible={verificationVisible} animationType="slide" transparent={false}>
        <View
          style={[styles.verificationModalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}
        >
          <View style={styles.verificationTopPanel}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Weryfikacja</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Sprawdź tabelę i zapisz ją lokalnie.</Text>

            {verificationMode === 'scan' ? (
              <View style={[styles.rangeEditor, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}> 
                <Text style={[styles.rangeEditorTitle, { color: colors.text }]}>Zakres LP</Text>
                <Text style={[styles.rangeEditorMeta, { color: colors.textSecondary }]}>Rozpoznano NR: {scannedNrNumbers.length}</Text>
                <View style={styles.rangeInputsRow}>
                  <View style={styles.rangeInputItem}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Pierwszy LP</Text>
                    <TextInput
                      value={lpStartInput}
                      onFocus={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
                      onChangeText={setLpStartInput}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      style={[
                        styles.fieldInput,
                        { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder },
                      ]}
                    />
                  </View>
                  <View style={styles.rangeInputItem}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Ostatni LP</Text>
                    <TextInput
                      value={lpEndInput}
                      onFocus={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
                      onChangeText={setLpEndInput}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      style={[
                        styles.fieldInput,
                        { backgroundColor: colors.background, color: colors.text, borderColor: colors.inputBorder },
                      ]}
                    />
                  </View>
                </View>

                <Text style={[styles.rangeEditorMeta, { color: colors.textSecondary }]}>Sugerowany ostatni LP: {suggestedLpEnd || '-'}</Text>

                <View style={styles.rangeButtonsRow}>
                  <TouchableOpacity
                    style={[styles.smallActionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => {
                      if (!suggestedLpEnd) return;
                      setLpEndInput(suggestedLpEnd);
                    }}
                  >
                    <Text style={[styles.smallActionButtonText, { color: colors.text }]}>Ustaw sugerowany koniec</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallActionButton, { backgroundColor: colors.butBackground, borderColor: colors.border }]}
                    onPress={() => rebuildRowsFromRange(lpStartInput, lpEndInput)}
                  >
                    <Text style={[styles.smallActionButtonText, { color: colors.butText }]}>Utwórz LP/NR</Text>
                  </TouchableOpacity>
                </View>

                {rangeError ? (
                  <Text style={[styles.rangeErrorText, { color: colors.textSecondary }]}>{rangeError}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.verificationActionsRow}>
              <TouchableOpacity
                style={[styles.smallActionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={addVerificationRow}
              >
                <Text style={[styles.smallActionButtonText, { color: colors.text }]}>Dodaj na końcu</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallActionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={removeLastVerificationRow}
                disabled={!verificationItems.length}
              >
                <Text
                  style={[
                    styles.smallActionButtonText,
                    { color: colors.text, opacity: verificationItems.length ? 1 : 0.5 },
                  ]}
                >
                  Usuń ostatni
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallActionButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={clearVerificationRows}
                disabled={!verificationItems.length}
              >
                <Text
                  style={[
                    styles.smallActionButtonText,
                    { color: colors.text, opacity: verificationItems.length ? 1 : 0.5 },
                  ]}
                >
                  Usuń tabelę
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.verificationScrollView}
            contentContainerStyle={styles.verificationScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator
          >
            {verificationItems.length ? (
              verificationItems.map((item, index) => (
                renderVerificationRow({ item, index })
              ))
            ) : (
              <Text style={{ color: colors.textSecondary }}>Brak pozycji do weryfikacji.</Text>
            )}
          </ScrollView>

          <View style={[styles.modalActions, styles.verificationModalFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}> 
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={() => setVerificationVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.butBackground }]}
              onPress={saveVerificationItems}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.butText} />
              ) : (
                <Text style={[styles.modalButtonText, { color: colors.butText }]}>Zapisz lokalnie</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={rawPreviewVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Raw OCR Preview</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Sprawdź, jakie liczby OCR rozpoznał dla NR.</Text>

            <View style={[styles.rawPreviewBox, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}> 
              <ScrollView contentContainerStyle={{ padding: 10 }}>
                <Text style={[styles.rawPreviewText, { color: colors.text }]}>
                  {rawOcrText || 'Brak surowego tekstu OCR. Najpierw wykonaj skan.'}
                </Text>
                {ocrDiagnostics ? (
                  <Text
                    style={[styles.rawPreviewText, { color: colors.textSecondary }]}
                  >
                    Bloki: {ocrDiagnostics.blockCount}; wpisy: {ocrDiagnostics.entryCount}; status: {ocrDiagnostics.status}
                    {'\n'}Tekst bloków: {ocrDiagnostics.blocksText || '-'}
                    {'\n'}Liczby parsera: {ocrDiagnostics.parserNumbers?.join(', ') || '-'}
                    {ocrDiagnostics.error ? `\nBłąd: ${ocrDiagnostics.error}` : ''}
                  </Text>
                ) : null}

                {parseDebug.length > 0 ? (
                  <>
                    <Text style={[styles.rawPreviewDebugTitle, { color: colors.textSecondary }]}>Informacje skanowania:</Text>
                    <Text style={[styles.rawPreviewText, { color: colors.textSecondary }]}>{parseDebug.join('\n')}</Text>
                  </>
                ) : null}
              </ScrollView>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.butBackground, borderColor: colors.border }]}
                onPress={() => setRawPreviewVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.butText }]}>Zamknij</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={lastCropPreviewVisible} animationType="slide" transparent onRequestClose={() => setLastCropPreviewVisible(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Ostatni crop</Text>
            {lastCrop ? (
              <>
                <Image source={{ uri: lastCrop.uri }} style={styles.lastCropImage} resizeMode="contain" />
                <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>URI: {lastCrop.uri}</Text>
                <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>Wymiary: {lastCrop.width} x {lastCrop.height}</Text>
                <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>Crop: {JSON.stringify(lastCrop.crop)}</Text>
                {cropDiagnostics ? (
                  <ScrollView style={styles.cropDebugScroll} nestedScrollEnabled>
                    <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>Diagnostyka mapowania: {JSON.stringify(cropDiagnostics, null, 2)}</Text>
                  </ScrollView>
                ) : null}
              </>
            ) : <Text style={{ color: colors.textSecondary }}>Brak wykonanego cropa.</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.butBackground }]}
                onPress={() => setLastCropPreviewVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.butText }]}>Zamknij</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isCropModalVisible} animationType="slide" transparent={false} onRequestClose={() => setIsCropModalVisible(false)}>
        <SafeAreaView
          style={[
            styles.cropContainer,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={[styles.cropHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setIsCropModalVisible(false)}>
              <Text style={{ color: colors.text, fontSize: 16 }}>Anuluj</Text>
            </TouchableOpacity>
            <Text style={[styles.cropHeaderTitle, { color: colors.text }]}>Kadrowanie dokumentu</Text>
            <View style={{ width: 48 }} />
          </View>

          <View style={styles.cropWorkspace}>
            <Text style={[styles.cropInstruction, { color: colors.textSecondary }]}>
              Przeciągnij krawędzie, aby zmienić rozmiar. Przeciągnij środek, aby przesunąć ramkę. Użyj dwóch palców, aby przybliżyć lub oddalić obraz.
            </Text>
            {DEBUG_CROP_GESTURES ? (
              <View
                style={[styles.cropDebugPanel, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}
              >
                <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>Pinch active: {pinchDiagnostics.active ? 'tak' : 'nie'}</Text>
                <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>Pinch event scale: {pinchDiagnostics.eventScale.toFixed(3)}</Text>
                <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>Applied scale: {pinchDiagnostics.appliedScale.toFixed(2)}x</Text>
                <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>Translate X: {pinchDiagnostics.translateX.toFixed(1)}</Text>
                <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>Translate Y: {pinchDiagnostics.translateY.toFixed(1)}</Text>
                <View style={styles.cropDebugButtons}>
                  <TouchableOpacity style={styles.cropDebugButton} onPress={() => applyDebugTransform(imageTransform.scale - 0.25)}><Text>Zoom -</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.cropDebugButton} onPress={() => applyDebugTransform(imageTransform.scale + 0.25)}><Text>Zoom +</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.cropDebugButton} onPress={resetDebugTransform}><Text>Reset</Text></TouchableOpacity>
                </View>
                {cropDiagnostics ? (
                  <ScrollView style={styles.cropDebugScroll} nestedScrollEnabled>
                    <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>{JSON.stringify(cropDiagnostics, null, 2)}</Text>
                  </ScrollView>
                ) : null}
                {ocrDiagnostics ? (
                  <Text style={[styles.cropZoomDebug, { color: colors.textSecondary }]}>OCR: {JSON.stringify(ocrDiagnostics)}</Text>
                ) : null}
              </View>
            ) : null}
            <GestureDetector gesture={imageGestures}>
              <View
                style={[styles.imageWrapper, { borderColor: colors.border }]}
                onLayout={({ nativeEvent: { layout } }) => {
                  setImageLayout((previous) => ({
                    ...previous,
                    width: layout.width,
                    height: layout.height,
                  }));
                }}
              >
              {tempPhotoUri ? (
                <Animated.Image
                  source={{ uri: tempPhotoUri }}
                  style={[styles.cropImage, animatedImageStyle]}
                  resizeMode="contain"
                />
              ) : null}
              {cropRect ? (
                <View
                  style={styles.cropInteractionLayer}
                  pointerEvents="box-none"
                >
                  <View
                    pointerEvents="none"
                    style={[
                      styles.cropFrame,
                      {
                        left: cropRect.left,
                        top: cropRect.top,
                        width: cropRect.width,
                        height: cropRect.height,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <View pointerEvents="none" style={[styles.cornerTL, { borderColor: colors.primary }]} />
                    <View pointerEvents="none" style={[styles.cornerTR, { borderColor: colors.primary }]} />
                    <View pointerEvents="none" style={[styles.cornerBL, { borderColor: colors.primary }]} />
                    <View pointerEvents="none" style={[styles.cornerBR, { borderColor: colors.primary }]} />
                  </View>
                  <View
                    {...cropPanResponder.panHandlers}
                    style={[
                      styles.cropPanHandle,
                      {
                        left: cropRect.left,
                        top: cropRect.top,
                        width: cropRect.width,
                        height: cropRect.height,
                      },
                    ]}
                  />
                  {['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].map(
                    (handle) => (
                      <View
                        key={handle}
                        {...cropResponders[handle].panHandlers}
                        style={[
                          styles.cropHandle,
                          handle.includes('-') ? styles.cropCornerHandle : styles.cropEdgeHandle,
                          {
                            backgroundColor: DEBUG_CROP_HANDLES
                              ? handle.includes('-')
                                ? 'rgba(255, 120, 0, 0.25)'
                                : 'rgba(0, 150, 255, 0.18)'
                              : 'transparent',
                            ...(handle === 'left' && {
                              left: cropRect.left - EDGE_HANDLE_SIZE / 2,
                              top: cropRect.top,
                              width: EDGE_HANDLE_SIZE,
                              height: cropRect.height,
                            }),
                            ...(handle === 'right' && {
                              left: cropRect.left + cropRect.width - EDGE_HANDLE_SIZE / 2,
                              top: cropRect.top,
                              width: EDGE_HANDLE_SIZE,
                              height: cropRect.height,
                            }),
                            ...(handle === 'top' && {
                              left: cropRect.left,
                              top: cropRect.top - EDGE_HANDLE_SIZE / 2,
                              width: cropRect.width,
                              height: EDGE_HANDLE_SIZE,
                            }),
                            ...(handle === 'bottom' && {
                              left: cropRect.left,
                              top: cropRect.top + cropRect.height - EDGE_HANDLE_SIZE / 2,
                              width: cropRect.width,
                              height: EDGE_HANDLE_SIZE,
                            }),
                            ...(handle === 'top-left' && {
                              left: cropRect.left - CORNER_HANDLE_SIZE / 2,
                              top: cropRect.top - CORNER_HANDLE_SIZE / 2,
                              width: CORNER_HANDLE_SIZE,
                              height: CORNER_HANDLE_SIZE,
                            }),
                            ...(handle === 'top-right' && {
                              left: cropRect.left + cropRect.width - CORNER_HANDLE_SIZE / 2,
                              top: cropRect.top - CORNER_HANDLE_SIZE / 2,
                              width: CORNER_HANDLE_SIZE,
                              height: CORNER_HANDLE_SIZE,
                            }),
                            ...(handle === 'bottom-left' && {
                              left: cropRect.left - CORNER_HANDLE_SIZE / 2,
                              top: cropRect.top + cropRect.height - CORNER_HANDLE_SIZE / 2,
                              width: CORNER_HANDLE_SIZE,
                              height: CORNER_HANDLE_SIZE,
                            }),
                            ...(handle === 'bottom-right' && {
                              left: cropRect.left + cropRect.width - CORNER_HANDLE_SIZE / 2,
                              top: cropRect.top + cropRect.height - CORNER_HANDLE_SIZE / 2,
                              width: CORNER_HANDLE_SIZE,
                              height: CORNER_HANDLE_SIZE,
                            }),
                          },
                        ]}
                      />
                    )
                  )}
                </View>
              ) : null}
              </View>
            </GestureDetector>
          </View>

          <View style={styles.cropFooter}> 
            <TouchableOpacity
              style={[styles.cropSaveButton, { backgroundColor: colors.butBackground }]}
              onPress={async () => {
                try {
                  if (!tempPhotoUri || !cropRect || !sourceImageSize || !imageLayout?.displayedWidth) {
                    Alert.alert('Błąd kadrowania', 'Obraz nie jest jeszcze gotowy do kadrowania.');
                    return;
                  }

                  const transform = imageTransformRef.current;
                  const centerX = imageLayout.imageOffsetX + imageLayout.displayedWidth / 2;
                  const centerY = imageLayout.imageOffsetY + imageLayout.displayedHeight / 2;
                  const displayedCropLeft = (cropRect.left - centerX - transform.translateX) / transform.scale + centerX;
                  const displayedCropTop = (cropRect.top - centerY - transform.translateY) / transform.scale + centerY;
                  const scaleX = sourceImageSize.width / imageLayout.displayedWidth;
                  const scaleY = sourceImageSize.height / imageLayout.displayedHeight;
                  const originX = clamp(
                    Math.round((displayedCropLeft - imageLayout.imageOffsetX) * scaleX),
                    0,
                    sourceImageSize.width - 1
                  );
                  const originY = clamp(
                    Math.round((displayedCropTop - imageLayout.imageOffsetY) * scaleY),
                    0,
                    sourceImageSize.height - 1
                  );
                  const width = clamp(
                    Math.round((cropRect.width / transform.scale) * scaleX),
                    1,
                    sourceImageSize.width - originX
                  );
                  const height = clamp(
                    Math.round((cropRect.height / transform.scale) * scaleY),
                    1,
                    sourceImageSize.height - originY
                  );
                  setCropDiagnostics({
                    sourceImageSize,
                    imageLayout,
                    imageOffsetX: imageLayout.imageOffsetX,
                    imageOffsetY: imageLayout.imageOffsetY,
                    displayedWidth: imageLayout.displayedWidth,
                    displayedHeight: imageLayout.displayedHeight,
                    cropRect,
                    imageTransform: transform,
                    originX,
                    originY,
                    width,
                    height,
                  });
                  const actions = [{ crop: { originX, originY, width, height } }];

                  const manipulateResult = await ImageManipulator.manipulateAsync(
                    tempPhotoUri,
                    actions,
                    { format: ImageManipulator.SaveFormat.JPEG, quality: 1 }
                  );
                  setLastCrop({
                    uri: manipulateResult.uri,
                    width: manipulateResult.width,
                    height: manipulateResult.height,
                    crop: { originX, originY, width, height },
                  });

                  setIsCropModalVisible(false);
                  await processScannedImage(manipulateResult.uri);
                } catch (error) {
                  console.error("Błąd ImageManipulator:", error);
                  Alert.alert('Błąd kadrowania', 'Nie udało się przyciąć obrazu.');
                }
              }}
            >
              <Text style={styles.cropSaveButtonText}>Zatwierdź i wytnij</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTextContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerButton: {
    width: 72,
    height: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  headerButtonText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchWrapper: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 14,
  },
  searchInput: {
    fontSize: 14,
    minHeight: 40,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  tableWrapper: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tableList: {
    flex: 1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 72,
    borderBottomWidth: 1,
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  tableLpCell: {
    flex: 1,
  },
  tableNrCell: {
    flex: 1,
  },
  tablePasyCell: {
    flex: 1,
    borderRightWidth: 0,
  },
  tableInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'android' ? 6 : 10,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  verificationModalContainer: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  verificationTopPanel: {
    flexShrink: 0,
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    height: '88%',
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  verificationActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  verificationScrollView: {
    flex: 1,
    flexBasis: 0,
    minHeight: 0,
  },
  verificationScrollContent: {
    paddingVertical: 8,
    paddingBottom: 400,
  },
  verificationModalFooter: {
    flexShrink: 0,
  },
  rangeEditor: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  rangeEditorTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  rangeEditorMeta: {
    fontSize: 12,
    marginBottom: 8,
  },
  rangeInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeInputItem: {
    flex: 1,
  },
  rangeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeErrorText: {
    fontSize: 12,
    marginTop: 8,
  },
  verificationRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  verificationTimestamp: {
    fontSize: 12,
    marginBottom: 10,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldContainer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'android' ? 6 : 10,
    fontSize: 14,
    fontWeight: '600',
  },
  smallActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  rawPreviewBox: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 220,
    maxHeight: 360,
    marginBottom: 8,
  },
  rawPreviewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  rawPreviewDebugTitle: {
    fontSize: 12,
    marginTop: 12,
    marginBottom: 6,
  },
  cropContainer: { flex: 1 },
  cropHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, borderBottomWidth: 1 },
  cropHeaderTitle: { fontSize: 16, fontWeight: 'bold' },
  cropWorkspace: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, marginVertical: 16 },
  cropZoomDebug: { textAlign: 'center', fontSize: 12, marginBottom: 6 },
  cropDebugPanel: { width: '100%', maxHeight: 260, borderWidth: 1, borderRadius: 10, padding: 8, marginBottom: 8 },
  cropDebugButtons: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 4 },
  cropDebugButton: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 8 },
  cropDebugScroll: { maxHeight: 130, marginTop: 4 },
  imageWrapper: { position: 'relative', width: '100%', height: '85%', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  cropImage: { width: '100%', height: '100%', opacity: 0.6 },
  cropInteractionLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  cropFrame: { position: 'absolute', borderWidth: 2, borderStyle: 'solid', backgroundColor: 'transparent' },
  cropPanHandle: { position: 'absolute', zIndex: 15, backgroundColor: 'transparent' },
  cropHandle: { position: 'absolute' },
  cropEdgeHandle: { zIndex: 20 },
  cropCornerHandle: { zIndex: 30 },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1 },
  cornerTL: { position: 'absolute', top: -2, left: -2, width: 12, height: 12, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { position: 'absolute', bottom: -2, left: -2, width: 12, height: 12, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderBottomWidth: 4, borderRightWidth: 4 },
  cropInstruction: { textAlign: 'center', fontSize: 13, paddingHorizontal: 32, marginBottom: 16 },
  cropFooter: { paddingHorizontal: 16, paddingTop: 8 },
  cropPreviewButton: { minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  cropPreviewButtonText: { fontSize: 14, fontWeight: '700' },
  lastCropImage: { width: '100%', height: 360, marginBottom: 8 },
  cropSaveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12 },
  cropSaveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});