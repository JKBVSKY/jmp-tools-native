import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useColors } from '../../hooks/useColors';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const LOCATION_OPTIONS = ['Biuro', 'B35', 'Biuro KJ', 'R - P01', 'R - P21', 'Własna lokacja'];
const PALLET_TYPE_OPTIONS = ['Komplet', 'PX', 'Techniczne', 'Kontener', 'Slov', 'R', 'Inne'];

const formatTimestamp = (value) => {
  if (!value) return '';

  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const normalizeLookupValue = (value) => String(value ?? '').trim().toLowerCase();

const getDisplayLocation = (item) => {
  if (item?.location === 'Własna lokacja') {
    return item?.customLocation || 'Własna lokacja';
  }

  return item?.location || 'Brak lokacji';
};

const getDisplayType = (item) => {
  if (item?.type === 'Inne') {
    return item?.customType || 'Inne';
  }

  return item?.type || 'Brak typu';
};

export default function Mapping() {
  const colors = useColors();
  const { user, isGuest } = useAuth();
  const router = useRouter();

  const [mappings, setMappings] = useState([]);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [location, setLocation] = useState(LOCATION_OPTIONS[0]);
  const [customLocation, setCustomLocation] = useState('');
  const [shopNumber, setShopNumber] = useState('');
  const [type, setType] = useState('');
  const [customType, setCustomType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterLocation, setFilterLocation] = useState(null);
  const [filterType, setFilterType] = useState(null);

  const isDisabled = !user || isGuest;

  const scheduleLookup = useMemo(() => {
    const lookup = new Map();

    scheduleItems.forEach((item) => {
      const shopKey = normalizeLookupValue(item?.nr);
      if (!shopKey || lookup.has(shopKey)) {
        return;
      }

      lookup.set(shopKey, String(item?.lp ?? '').trim());
    });

    return lookup;
  }, [scheduleItems]);

  const resolveLpNumber = (value) => {
    const key = normalizeLookupValue(value);
    return scheduleLookup.get(key) || '';
  };

  const availableLocationFilters = useMemo(() => {
    const values = new Set();
    mappings.forEach((item) => values.add(getDisplayLocation(item)));
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [mappings]);

  const availableTypeFilters = useMemo(() => {
    const values = new Set();
    mappings.forEach((item) => values.add(getDisplayType(item)));
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [mappings]);

  const isFilterActive = !!filterLocation || !!filterType;

  const filteredMappings = useMemo(() => {
    return mappings.filter((item) => {
      const matchesLocation = !filterLocation || getDisplayLocation(item) === filterLocation;
      const matchesType = !filterType || getDisplayType(item) === filterType;
      return matchesLocation && matchesType;
    });
  }, [mappings, filterLocation, filterType]);

  const groupedMappings = useMemo(() => {
    const groups = new Map();

    filteredMappings.forEach((item) => {
      const key = getDisplayLocation(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
  }, [filteredMappings]);

  const openFilterModal = () => {
    setFilterModalVisible(true);
  };

  const closeFilterModal = () => {
    setFilterModalVisible(false);
  };

  const clearFilters = () => {
    setFilterLocation(null);
    setFilterType(null);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setLocation(LOCATION_OPTIONS[0]);
    setCustomLocation('');
    setShopNumber('');
    setType('');
    setCustomType('');
    setError('');
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setLocation(item?.location || LOCATION_OPTIONS[0]);
    setCustomLocation(item?.customLocation || '');
    setShopNumber(String(item?.shopNumber || ''));
    setType(item?.type || '');
    setCustomType(item?.customType || '');
    setError('');
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalVisible(false);
    setEditingItem(null);
    setError('');
  };

  useEffect(() => {
    if (!user?.id) {
      setMappings([]);
      setScheduleItems([]);
      setLoadingMappings(false);
      setLoadingSchedule(false);
      return undefined;
    }

    setLoadingMappings(true);
    const mappingsQuery = query(
      collection(db, 'users', user.id, 'palletMappings'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeMappings = onSnapshot(
      mappingsQuery,
      (snapshot) => {
        setMappings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoadingMappings(false);
      },
      (snapError) => {
        console.log('Error fetching mappings:', snapError);
        setLoadingMappings(false);
      }
    );

    setLoadingSchedule(true);
    const scheduleQuery = query(collection(db, 'users', user.id, 'scheduleItems'));

    const unsubscribeSchedule = onSnapshot(
      scheduleQuery,
      (snapshot) => {
        setScheduleItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoadingSchedule(false);
      },
      (snapError) => {
        console.log('Error fetching schedule items:', snapError);
        setLoadingSchedule(false);
      }
    );

    return () => {
      unsubscribeMappings();
      unsubscribeSchedule();
    };
  }, [user?.id]);

  const handleSave = async () => {
    const trimmedShop = shopNumber.trim();
    const trimmedCustomLocation = customLocation.trim();
    const trimmedCustomType = customType.trim();

    if (!location) {
      setError('Wybierz lokację.');
      return;
    }

    if (location === 'Własna lokacja' && !trimmedCustomLocation) {
      setError('Podaj własną lokację.');
      return;
    }

    if (!trimmedShop) {
      setError('Podaj numer Sklep.');
      return;
    }

    if (!/^\d+$/.test(trimmedShop)) {
      setError('Sklep musi być liczbą.');
      return;
    }

    if (!type) {
      setError('Wybierz typ.');
      return;
    }

    if (type === 'Inne' && !trimmedCustomType) {
      setError('Podaj typ dla opcji Inne.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      location,
      customLocation: location === 'Własna lokacja' ? trimmedCustomLocation : null,
      shopNumber: trimmedShop,
      type,
      customType: type === 'Inne' ? trimmedCustomType : null,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingItem?.id) {
        await updateDoc(doc(db, 'users', user.id, 'palletMappings', editingItem.id), payload);
      } else {
        await addDoc(collection(db, 'users', user.id, 'palletMappings'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      setModalVisible(false);
      setEditingItem(null);
    } catch (saveError) {
      console.log('Error saving mapping:', saveError);
      setError('Nie udało się zapisać mapowania. Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Usuń mapowanie', 'Na pewno chcesz usunąć ten wpis?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', user.id, 'palletMappings', item.id));
          } catch (deleteError) {
            console.log('Error deleting mapping:', deleteError);
            Alert.alert('Błąd', 'Nie udało się usunąć mapowania.');
          }
        },
      },
    ]);
  };

  const renderMappingRow = (item, index) => {
    const lpNumber = resolveLpNumber(item?.shopNumber);

    return (
      <View
        key={item.id}
        style={[styles.itemRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}
      >
        <View style={styles.itemHeaderRow}>
          <View style={styles.itemInfo}>
            <Text style={[styles.cardText, { color: colors.text, fontWeight: '600' }]}>Sklep: {item?.shopNumber || '-'}</Text>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>Typ: {getDisplayType(item)}</Text>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>LP: {lpNumber || 'Brak'}</Text>
            <Text style={[styles.timestamp, { color: colors.grayIconColor }]}>Utworzono: {formatTimestamp(item?.createdAt) || '-'}</Text>
            <Pressable
              onPress={() => {
                const focusZoneName = (item.location || '').trim();

                router.push({
                  pathname: '/misc/WarehouseMap',
                  params: { focusZoneName },
                });
              }}
              disabled={isDisabled}
              style={[
                styles.mapButton,
                {
                  backgroundColor: colors.outButBackground,
                  borderColor: colors.outButBorder,
                  opacity: isDisabled ? 0.6 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 16,
                },
              ]}
            >
              <MaterialCommunityIcons name="map-marker-radius" size={22} color={colors.outButText} style={{ marginBottom: 6 }} />
              <Text style={[styles.mapButtonText, { color: colors.outButText }]}>Pokaż na mapie</Text>
            </Pressable>
          </View>

          <View style={styles.itemActions}>
            <TouchableOpacity
              onPress={() => openEditModal(item)}
              style={[
                styles.iconButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.cardBackground,
                },
              ]}
            >
              <Text style={[styles.iconButtonText, { color: colors.textSecondary }]}>✎</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={[
                styles.iconButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.cardBackground,
                },
              ]}
            >
              <Text style={[styles.iconButtonText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderGroup = ({ item: group }) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.groupTitle, { color: colors.title }]} numberOfLines={1}>
        {group.key} <Text style={[styles.groupCount, { color: colors.textSecondary }]}>({group.items.length})</Text>
      </Text>
      {group.items.map((mappingItem, index) => renderMappingRow(mappingItem, index))}
    </View>
  );

  if (loadingMappings || loadingSchedule) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.sIconColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Lokalizator Palet</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Zapisuj lokalizacje palet, przypisz sklep i sprawdzaj LP z harmonogramu.</Text>

        <View style={styles.headerActionsRow}>
          <TouchableOpacity
            onPress={openCreateModal}
            disabled={isDisabled}
            style={[
              styles.addButton,
              {
                backgroundColor: colors.butBackground,
                borderColor: colors.butBorder,
                opacity: isDisabled ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.addButtonText, { color: colors.butText }]}>Dodaj</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openFilterModal}
            style={[
              styles.filterButton,
              isFilterActive
                ? { backgroundColor: colors.butBackground, borderColor: colors.butBorder }
                : { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder },
            ]}
          >
            <Text style={[styles.filterButtonText, { color: isFilterActive ? colors.butText : colors.outButText }]}>
              Filtruj{isFilterActive ? ' •' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={groupedMappings}
        keyExtractor={(group) => group.key}
        renderItem={renderGroup}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {isFilterActive ? 'Brak wyników dla wybranych filtrów.' : 'Brak zapisanych mapowań.'}
          </Text>
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.backdrop}>
          <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.title }]}>{editingItem ? 'Edytuj mapowanie' : 'Dodaj mapowanie'}</Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Lokacja</Text>
              <View style={[styles.optionList, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.optionScroll}>
                  {LOCATION_OPTIONS.map((option) => {
                    const selected = location === option;

                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setLocation(option)}
                        style={[
                          styles.optionButton,
                          selected && {
                            backgroundColor: colors.butBackground,
                            borderColor: colors.butBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.optionText, { color: selected ? colors.butText : colors.text }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {location === 'Własna lokacja' ? (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Własna lokacja</Text>
                  <TextInput
                    value={customLocation}
                    onChangeText={setCustomLocation}
                    placeholder="Wpisz lokację"
                    placeholderTextColor={colors.phText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      },
                    ]}
                  />
                </>
              ) : null}

              <Text style={[styles.label, { color: colors.textSecondary }]}>Sklep</Text>
              <TextInput
                value={shopNumber}
                onChangeText={setShopNumber}
                placeholder="Numer sklepu"
                placeholderTextColor={colors.phText}
                keyboardType="number-pad"
                inputMode="numeric"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Typ</Text>
              <View style={[styles.optionList, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.optionScroll}>
                  {PALLET_TYPE_OPTIONS.map((option) => {
                    const selected = type === option;

                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setType(option)}
                        style={[
                          styles.optionButton,
                          selected && {
                            backgroundColor: colors.butBackground,
                            borderColor: colors.butBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.optionText, { color: selected ? colors.butText : colors.text }]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {type === 'Inne' ? (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Inny typ</Text>
                  <TextInput
                    value={customType}
                    onChangeText={setCustomType}
                    placeholder="Wpisz typ"
                    placeholderTextColor={colors.phText}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.inputBorder,
                        color: colors.text,
                      },
                    ]}
                  />
                </>
              ) : null}

              {error ? <Text style={[styles.error, { color: colors.textRed }]}>{error}</Text> : null}

              <View style={styles.buttonsRow}>
                <TouchableOpacity
                  onPress={closeModal}
                  disabled={saving}
                  style={[
                    styles.outlinedButton,
                    {
                      borderColor: colors.outButBorder,
                      backgroundColor: colors.outButBackground,
                    },
                  ]}
                >
                  <Text style={[styles.outlinedText, { color: colors.outButText }]}>Anuluj</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor: colors.butBackground,
                      borderColor: colors.butBorder,
                      opacity: saving ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.primaryText, { color: colors.butText }]}>{saving ? 'Zapisywanie...' : 'OK'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={filterModalVisible} animationType="slide" transparent onRequestClose={closeFilterModal}>
        <View style={styles.backdrop}>
          <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.title }]}>Filtruj palety</Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Lokacja</Text>
              <View style={[styles.optionList, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.optionScroll}>
                  {[{ label: 'Wszystkie', value: null }, ...availableLocationFilters.map((value) => ({ label: value, value }))].map((option) => {
                    const selected = filterLocation === option.value;

                    return (
                      <TouchableOpacity
                        key={option.label}
                        onPress={() => setFilterLocation(option.value)}
                        style={[
                          styles.optionButton,
                          selected && {
                            backgroundColor: colors.butBackground,
                            borderColor: colors.butBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.optionText, { color: selected ? colors.butText : colors.text }]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Typ</Text>
              <View style={[styles.optionList, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={styles.optionScroll}>
                  {[{ label: 'Wszystkie', value: null }, ...availableTypeFilters.map((value) => ({ label: value, value }))].map((option) => {
                    const selected = filterType === option.value;

                    return (
                      <TouchableOpacity
                        key={option.label}
                        onPress={() => setFilterType(option.value)}
                        style={[
                          styles.optionButton,
                          selected && {
                            backgroundColor: colors.butBackground,
                            borderColor: colors.butBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.optionText, { color: selected ? colors.butText : colors.text }]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.buttonsRow}>
                <TouchableOpacity
                  onPress={clearFilters}
                  disabled={!isFilterActive}
                  style={[
                    styles.outlinedButton,
                    {
                      borderColor: colors.outButBorder,
                      backgroundColor: colors.outButBackground,
                      opacity: isFilterActive ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text style={[styles.outlinedText, { color: colors.outButText }]}>Wyczyść</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={closeFilterModal}
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor: colors.butBackground,
                      borderColor: colors.butBorder,
                    },
                  ]}
                >
                  <Text style={[styles.primaryText, { color: colors.butText }]}>Gotowe</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  addButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  mapButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  filterButton: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  groupCount: {
    fontSize: 13,
    fontWeight: '400',
  },
  itemRow: {
    paddingVertical: 10,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    borderWidth: 1,
    borderRadius: 999,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardText: {
    marginTop: 5,
    fontSize: 13,
  },
  timestamp: {
    marginTop: 8,
    fontSize: 11,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContainer: {
    borderRadius: 18,
    padding: 16,
    maxHeight: '86%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  optionList: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 180,
  },
  optionScroll: {
    maxHeight: 180,
  },
  optionButton: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 14,
  },
  error: {
    marginTop: 10,
    fontSize: 13,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  outlinedButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  outlinedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
});