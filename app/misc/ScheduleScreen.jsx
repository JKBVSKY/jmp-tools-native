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
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import MlkitOcr from 'react-native-mlkit-ocr';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { useColors } from '../../hooks/useColors';

const ADMIN_EMAILS = ['jakub.jaskola7@gmail.com'];

const IGNORED_COLUMN_KEYWORDS = [
  'sklep',
  'godz',
  'calak',
  'palety',
  'brama',
  'pasy',
  'laczenia',
  'lacz',
];

const toAscii = (value) =>
  String(value || '')
    .replace(/[ąĄ]/g, 'a')
    .replace(/[ćĆ]/g, 'c')
    .replace(/[ęĘ]/g, 'e')
    .replace(/[łŁ]/g, 'l')
    .replace(/[ńŃ]/g, 'n')
    .replace(/[óÓ]/g, 'o')
    .replace(/[śŚ]/g, 's')
    .replace(/[żŻźŹ]/g, 'z');

const normalizeOcrLine = (line) =>
  toAscii(line)
    .toLowerCase()
    .replace(/\|/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeForHeaderMatch = (line) =>
  normalizeOcrLine(line)
    .replace(/\s+/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/5/g, 's');

const formatTimestamp = (value) => {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const isLikelyLp = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return false;
  return num >= 1000 && num <= 9990 && num % 10 === 0;
};

const isLikelyNextLp = (currentLp, candidate) => {
  const curr = Number(currentLp);
  const next = Number(candidate);
  if (!Number.isFinite(curr) || !Number.isFinite(next)) return false;

  // LP in this sheet usually increases by 10 row-by-row.
  return isLikelyLp(candidate) && next - curr === 10;
};

const shouldIgnoreLine = (normalizedLine) => {
  if (!normalizedLine) return true;

  if (normalizedLine.includes('lp') && normalizedLine.includes('nr')) {
    return true;
  }

  return IGNORED_COLUMN_KEYWORDS.some((keyword) => normalizedLine.includes(keyword));
};

const extractNumericTokens = (line) => {
  const matches = String(line || '').match(/\d{3,5}/g);
  return matches || [];
};

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

const buildLeftBandText = (blocks) => {
  const entries = flattenOcrEntries(blocks);
  if (!entries.length) {
    return {
      rawText: '',
      parserText: '',
      leftBandText: '',
      leftBandInfo: 'Brak wpisow OCR.',
    };
  }

  const rawText = entries.map((entry) => entry.text).filter(Boolean).join('\n');

  const positionableEntries = entries.filter((entry) => Number.isFinite(entry.x));
  const numericPositionableEntries = positionableEntries.filter((entry) =>
    extractNumericTokens(entry.text).length > 0 && !shouldIgnoreLine(normalizeOcrLine(entry.text))
  );

  let leftBandEntries = entries;
  let leftBandInfo = 'Brak danych pozycyjnych - fallback do pelnego OCR.';

  if (numericPositionableEntries.length >= 2) {
    const xs = numericPositionableEntries.map((entry) => entry.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const span = Math.max(1, maxX - minX);
    const leftBandMaxX = minX + span * 0.5;

    leftBandEntries = entries.filter(
      (entry) => !Number.isFinite(entry.x) || entry.x <= leftBandMaxX
    );
    leftBandInfo = `Left band x<=${leftBandMaxX.toFixed(1)} (min=${minX.toFixed(1)}, max=${maxX.toFixed(1)})`;
  }

  const parserRows = groupEntriesIntoRows(leftBandEntries);
  const parserText = parserRows.join('\n');

  return {
    rawText,
    parserText,
    leftBandText: parserText,
    leftBandInfo,
  };
};

const parseScheduleText = (text) => {
  if (!text) return { rows: [], debug: [] };

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headerIndex = lines.findIndex((line) => {
    const normalized = normalizeForHeaderMatch(line);
    return normalized.includes('lp') && normalized.includes('nr');
  });

  const dataLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;
  const rows = [];
  const debug = [];
  let pendingLp = null;
  let pendingSource = '';
  let lastAcceptedLp = null;

  const pushUncertainMissingNr = (lpValue, source) => {
    if (!lpValue) return;
    rows.push({
      lp: lpValue,
      nr: '',
      createdAt: new Date(),
      uncertain: true,
      uncertainReason: 'Brak NR w OCR. Uzupełnij ręcznie.',
    });
    debug.push(`! Brak NR dla LP ${lpValue} <- ${source}`);
  };

  for (let i = 0; i < dataLines.length; i += 1) {
    const rawLine = dataLines[i];
    const cleaned = rawLine.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
    const normalized = normalizeOcrLine(cleaned);

    if (shouldIgnoreLine(normalized)) {
      continue;
    }

    const numericTokens = extractNumericTokens(cleaned);
    if (!numericTokens.length) continue;

    const hasLetters = /[a-zA-Z]/.test(toAscii(cleaned));
    const lpCandidate = numericTokens.find((token) => isLikelyLp(token));

    if (pendingLp && numericTokens.length >= 2) {
      const firstToken = numericTokens[0];
      const secondToken = numericTokens[1];
      const lineStartsWithNextLp = isLikelyNextLp(pendingLp, firstToken);
      const secondTokenLooksLikeNr = secondToken && !isLikelyLp(secondToken);

      // Example:
      // pending: 2090
      // current line: 2100 1307
      // This means previous LP is missing NR, but current line is a complete new row.
      if (lineStartsWithNextLp && secondTokenLooksLikeNr) {
        pushUncertainMissingNr(pendingLp, pendingSource || cleaned);
        pendingLp = null;
        pendingSource = '';
      }
    }

    if (pendingLp && numericTokens.length >= 1) {
      const nrFromPending = numericTokens[0];

      // If next token looks like next LP, do not pair LP->LP as LP/NR.
      if (isLikelyNextLp(pendingLp, nrFromPending)) {
        pushUncertainMissingNr(pendingLp, pendingSource || cleaned);
        pendingLp = nrFromPending;
        pendingSource = cleaned;
        continue;
      }

      rows.push({
        lp: pendingLp,
        nr: nrFromPending,
        createdAt: new Date(),
        uncertain: true,
        uncertainReason: 'Scalono LP i NR z dwoch osobnych linii OCR.',
      });
      debug.push(`~ ${pendingLp} + ${nrFromPending} (merge)`);
      lastAcceptedLp = pendingLp;
      pendingLp = null;
      pendingSource = '';
      continue;
    }

    if (numericTokens.length >= 2) {
      const lp = lpCandidate || numericTokens[0];
      const lpIndex = numericTokens.indexOf(lp);
      const nr = numericTokens[lpIndex + 1] || numericTokens.find((token) => token !== lp) || '';

      if (!lp || !nr) continue;

      // If OCR gave two sequential LP-like values, treat as missing NR for first LP.
      if (isLikelyNextLp(lp, nr)) {
        pushUncertainMissingNr(lp, cleaned);
        pendingLp = nr;
        pendingSource = cleaned;
        continue;
      }

      const lpBreaksSequence =
        lastAcceptedLp && isLikelyLp(lp) ? Number(lp) - Number(lastAcceptedLp) > 20 : false;

      const uncertain = !isLikelyLp(lp) || hasLetters || lpBreaksSequence;
      rows.push({
        lp,
        nr,
        createdAt: new Date(),
        uncertain,
        uncertainReason: uncertain ? 'Wiersz zawiera dodatkowy tekst lub nietypowy uklad OCR.' : '',
      });
      lastAcceptedLp = isLikelyLp(lp) ? lp : lastAcceptedLp;
      if (uncertain) {
        debug.push(`? ${lp} ${nr} <- ${cleaned}`);
      }
      continue;
    }

    if (numericTokens.length === 1 && isLikelyLp(numericTokens[0])) {
      pendingLp = numericTokens[0];
      pendingSource = cleaned;
      continue;
    }

    if (numericTokens.length === 1 && pendingLp) {
      rows.push({
        lp: pendingLp,
        nr: numericTokens[0],
        createdAt: new Date(),
        uncertain: true,
        uncertainReason: 'Scalono LP i NR z dwoch osobnych linii OCR.',
      });
      debug.push(`~ ${pendingLp} + ${numericTokens[0]} (merge)`);
      pendingLp = null;
      pendingSource = '';
      continue;
    }
  }

  if (pendingLp) {
    pushUncertainMissingNr(pendingLp, pendingSource);
  }

  const dedupedRows = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.lp}-${row.nr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedRows.push(row);
  }

  // Second-pass cleanup: if NR looks like an LP value from this same scan,
  // prefer empty NR over a likely wrong LP->NR assignment.
  const lpValues = new Set(
    dedupedRows
      .map((row) => String(row.lp || '').trim())
      .filter((value) => value.length > 0)
  );

  const sanitizedRows = dedupedRows.map((row, index) => {
    const nrValue = String(row.nr || '').trim();
    if (!nrValue) return row;

    const nrLooksLikeLp = isLikelyLp(nrValue);
    if (!nrLooksLikeLp) return row;

    const nrIsKnownLp = lpValues.has(nrValue) && nrValue !== String(row.lp || '').trim();

    const prevLp = index > 0 ? String(dedupedRows[index - 1]?.lp || '').trim() : '';
    const nextLp = index < dedupedRows.length - 1 ? String(dedupedRows[index + 1]?.lp || '').trim() : '';
    const nrNearNeighbourLp =
      (prevLp && Math.abs(Number(nrValue) - Number(prevLp)) <= 20) ||
      (nextLp && Math.abs(Number(nrValue) - Number(nextLp)) <= 20);

    const shouldClearNr = nrIsKnownLp || nrNearNeighbourLp;
    if (!shouldClearNr) return row;

    debug.push(`! Wyczyszczono podejrzane NR=${nrValue} dla LP=${row.lp} (wyglada jak LP)`);

    return {
      ...row,
      nr: '',
      uncertain: true,
      uncertainReason: 'NR wyglada jak wartosc LP. Wyczyszczono do recznej weryfikacji.',
    };
  });

  return { rows: sanitizedRows, debug };
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

  const isAdmin = !!user?.email && !isGuest && ADMIN_EMAILS.includes(user.email.toLowerCase());
  const scheduleCollection = user ? collection(db, 'users', user.id, 'scheduleItems') : null;

  useEffect(() => {
    if (!scheduleCollection) {
      setLoading(false);
      return;
    }

    const q = query(scheduleCollection, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setItems(data);
        setLoading(false);
      },
      (error) => {
        console.log('Schedule subscription error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [scheduleCollection]);

  const filteredItems = useMemo(() => {
    const queryText = searchText.trim().toLowerCase();
    const matchingItems = !queryText
      ? items
      : items.filter((item) =>
          [item.lp, item.nr]
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

  const hasEmptyVerificationFields = useMemo(
    () => verificationItems.some((item) => !String(item.lp || '').trim() || !String(item.nr || '').trim()),
    [verificationItems]
  );

  const updateItemField = (id, field, value) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const saveInlineItem = async (item) => {
    if (!isAdmin || !user || !item?.id) return;

    try {
      await updateDoc(doc(db, 'users', user.id, 'scheduleItems', item.id), {
        lp: item.lp,
        nr: item.nr,
      });
    } catch (error) {
      console.error('Inline item save error:', error);
      Alert.alert('Błąd', 'Nie udało się zapisać zmian w wierszu.');
    }
  };

  const clearAllItems = async () => {
    if (!scheduleCollection || !user) return;

    try {
      const snapshot = await getDocs(scheduleCollection);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.docs.forEach((docItem) => {
        batch.delete(doc(db, 'users', user.id, 'scheduleItems', docItem.id));
      });
      await batch.commit();
    } catch (error) {
      console.error('Clear schedule error:', error);
      Alert.alert('Błąd', 'Nie udało się wyczyścić listy.');
    }
  };

  const handleClearPress = () => {
    if (!isAdmin) return;

    Alert.alert('Wyczyść harmonogram', 'Czy na pewno chcesz usunąć wszystkie zeskanowane pozycje?', [
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
    if (!isAdmin || !user || !scheduleCollection) return;

    if (hasEmptyVerificationFields) {
      Alert.alert('Uzupełnij pola', 'Przed zapisaniem uzupełnij wszystkie wartości LP i NR.');
      return;
    }

    setIsSaving(true);

    try {
      const snapshot = await getDocs(scheduleCollection);
      const batch = writeBatch(db);
      snapshot.docs.forEach((docItem) => batch.delete(doc(db, 'users', user.id, 'scheduleItems', docItem.id)));
      await batch.commit();

      for (const item of verificationItems) {
        await addDoc(scheduleCollection, {
          lp: item.lp,
          nr: item.nr,
          createdAt: item.createdAt || new Date(),
        });
      }

      setVerificationVisible(false);
      Alert.alert('Gotowe', 'Zapisano harmonogram.');
    } catch (error) {
      console.error('Verification save error:', error);
      Alert.alert('Błąd', 'Nie udało się zapisać danych z weryfikacji.');
    } finally {
      setIsSaving(false);
    }
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

      const prepared = buildLeftBandText(textBlocks);
      return {
        ...prepared,
        textBlocks,
      };
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

  const processScannedImage = async (uri) => {
    if (!uri) return;

    const ocrData = await recognizeTextFromImage(uri);

    const rawPreviewSections = [
      ocrData?.leftBandInfo ? `[INFO]\n${ocrData.leftBandInfo}` : '',
      ocrData?.leftBandText ? `[LEFT BAND OCR]\n${ocrData.leftBandText}` : '',
      ocrData?.rawText ? `[FULL OCR]\n${ocrData.rawText}` : '',
    ].filter(Boolean);
    setRawOcrText(rawPreviewSections.join('\n\n'));

    if (!ocrData?.parserText) {
      Alert.alert(
        'OCR niedostępne',
        'Nie udało się rozpoznać tekstu. Upewnij się, że obraz jest wyraźny i spróbuj ponownie.'
      );
      return;
    }

    const parseResult = parseScheduleText(ocrData.parserText);
    const parsedRows = parseResult.rows;
    setParseDebug(parseResult.debug || []);
    if (!parsedRows.length) {
      setRawPreviewVisible(true);
      Alert.alert('Brak danych', 'Nie udało się sparsować LP/NR. Otworzono podgląd surowego OCR do diagnostyki.');
      return;
    }

    setVerificationItems(
      parsedRows.map((item, index) => ({
        ...item,
        id: `scanned-${Date.now()}-${index}`,
        createdAt: item.createdAt || new Date(),
      }))
    );
    setVerificationVisible(true);
  };

  const handleScanPress = () => {
    if (!isAdmin) return;

    Alert.alert('Skanuj dokument', 'Wybierz źródło obrazu i przytnij zdjęcie tak, aby było widać tylko kolumny LP i NR.', [
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
    ]);
  };

  const handleEditPress = () => {
    if (!isAdmin) return;
    if (!items.length) {
      Alert.alert('Brak danych', 'Nie ma jeszcze zeskanowanych pozycji do edycji.');
      return;
    }
    setVerificationItems(items.map((item) => ({ ...item })));
    setVerificationVisible(true);
  };

  const renderTableHeader = () => (
    <View style={[styles.tableHeaderRow, { backgroundColor: colors.navBackground, borderColor: colors.border }]}>
      <View style={[styles.tableHeaderCell, styles.tableLpCell, { borderColor: colors.border }]}>
        <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>LP</Text>
      </View>
      <View style={[styles.tableHeaderCell, styles.tableNrCell, { borderColor: colors.border }]}>
        <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>NR</Text>
      </View>
    </View>
  );

  const renderRow = ({ item, index }) => {
    const isUncertain = !!item.uncertain;
    const rowBackground = index % 2 === 0 ? colors.cardBackground : colors.background;

    return (
      <View style={[styles.tableRow, { backgroundColor: rowBackground, borderColor: colors.border }]}> 
        <View style={[styles.tableCell, styles.tableLpCell, { borderColor: colors.border }]}>
          <TextInput
            value={String(item.lp ?? '')}
            onChangeText={(value) => updateItemField(item.id, 'lp', value)}
            onEndEditing={() => saveInlineItem(item)}
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
            onEndEditing={() => saveInlineItem(item)}
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
              setVerificationItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, lp: value } : row)));
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
              setVerificationItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, nr: value } : row)));
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
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Skanuj i zarządzaj swoim harmonogramem</Text>
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
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Brak zeskanowanych pozycji.</Text>
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Weryfikacja skanu</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Sprawdź i popraw dane przed zapisaniem.</Text>
            {hasEmptyVerificationFields ? (
              <Text style={[styles.validationMessage, { color: colors.textSecondary }]}>Wszystkie pola LP i NR muszą być uzupełnione przed zapisem.</Text>
            ) : null}

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
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.butBackground }]}
                onPress={saveVerificationItems}
                disabled={isSaving || hasEmptyVerificationFields}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.butText} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: colors.butText, opacity: hasEmptyVerificationFields ? 0.6 : 1 }]}>Save</Text>
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
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Skopiuj ten tekst i sprawdź, jak OCR widzi kolumny LP/NR.</Text>

            <View style={[styles.rawPreviewBox, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}> 
              <ScrollView contentContainerStyle={{ padding: 10 }}>
                <Text style={[styles.rawPreviewText, { color: colors.text }]}>
                  {rawOcrText || 'Brak surowego tekstu OCR. Najpierw wykonaj skan.'}
                </Text>

                {parseDebug.length > 0 ? (
                  <>
                    <Text style={[styles.rawPreviewDebugTitle, { color: colors.textSecondary }]}>Analiza parsera (niepewne/scalone):</Text>
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
                <Text style={[styles.modalButtonText, { color: colors.butText }]}>Close</Text>
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
    fontSize: 13,
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
    paddingBottom: 16,
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
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
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
    flex: 0.95,
  },
  tableNrCell: {
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
    maxHeight: '85%',
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
  validationMessage: {
    fontSize: 12,
    marginBottom: 12,
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
  uncertainText: {
    fontSize: 12,
    marginTop: 2,
  },
});