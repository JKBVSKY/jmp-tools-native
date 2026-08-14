import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { addDoc, collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import MlkitOcr from 'react-native-mlkit-ocr';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { useColors } from '../../hooks/useColors';
import { StorageManager } from '../../utils/StorageManager';

const ADMIN_EMAILS = ['jakub.jaskola7@gmail.com'];
const LOCAL_SCHEDULE_KEY_PREFIX = 'scheduleItemsLocalV2';

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

export default function ScheduleScreen() {
  const colors = useColors();
  const { user, isGuest } = useAuth();

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

  const [verificationMode, setVerificationMode] = useState('scan');
  const [scannedNrNumbers, setScannedNrNumbers] = useState([]);
  const [lpStartInput, setLpStartInput] = useState('1');
  const [lpEndInput, setLpEndInput] = useState('');
  const [rangeError, setRangeError] = useState('');

  const isAdmin = !!user?.email && !isGuest && ADMIN_EMAILS.includes(user.email.toLowerCase());
  const scheduleCollection = user ? collection(db, 'users', user.id, 'scheduleItems') : null;
  const localStorageKey = getLocalScheduleKey(user?.id);

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
    await StorageManager.setItem(localStorageKey, JSON.stringify(serializable));
  };

  useEffect(() => {
    let cancelled = false;

    const loadLocalItems = async () => {
      setLoading(true);
      try {
        const raw = await StorageManager.getItem(localStorageKey);
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
  }, [localStorageKey]);

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
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, [field]: value } : item));
      void persistLocalItems(next);
      return next;
    });
  };

  const clearAllItems = async () => {
    try {
      await StorageManager.removeItem(localStorageKey);
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
      if (!Array.isArray(textBlocks) || textBlocks.length === 0) return null;

      return buildNrScanFromBlocks(textBlocks);
    } catch (error) {
      console.log('Text recognition error:', error);
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
        allowsEditing: true,
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
            await processScannedImage(uri);
          },
        },
        {
          text: 'Aparat',
          onPress: async () => {
            const uri = await pickImage('camera');
            await processScannedImage(uri);
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

  const renderVerificationRow = ({ item }) => (
    <View style={[styles.verificationRow, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}> 
      <Text style={[styles.verificationTimestamp, { color: colors.grayIconColor }]}> {formatTimestamp(item.createdAt)} </Text>
      <View style={styles.rowFields}>
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>LP</Text>
          <TextInput
            value={String(item.lp ?? '')}
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
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Brak zapisanych lokalnie pozycji.</Text>
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
      </View>

      <Modal visible={verificationVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background, borderColor: colors.border }]}> 
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

            <FlatList
              data={verificationItems}
              keyExtractor={(item) => item.id}
              renderItem={renderVerificationRow}
              contentContainerStyle={{ paddingVertical: 8 }}
              ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>Brak pozycji do weryfikacji.</Text>}
              keyboardShouldPersistTaps="handled"
            />

            <View style={styles.modalActions}>
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
        </View>
      </Modal>

      <Modal visible={rawPreviewVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background, borderColor: colors.border }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Raw OCR Preview</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Sprawdź, jakie liczby OCR rozpoznał dla NR.</Text>

            <View style={[styles.rawPreviewBox, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}> 
              <ScrollView contentContainerStyle={{ padding: 10 }}>
                <Text style={[styles.rawPreviewText, { color: colors.text }]}>
                  {rawOcrText || 'Brak surowego tekstu OCR. Najpierw wykonaj skan.'}
                </Text>

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
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '88%',
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
});