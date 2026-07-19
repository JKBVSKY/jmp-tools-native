import React, { useState } from 'react';
import { View, Text, Button, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MlkitOcr from 'react-native-mlkit-ocr';

export default function ScheduleScreen() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (res.cancelled) return;
    await runOcr(res.uri);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.cancelled) return;
    await runOcr(res.uri);
  }

  async function runOcr(uri) {
    try {
      setLoading(true);
      setResults([]);
      // MlkitOcr provides detectFromUri or detectFromFile depending on platform
      const textBlocks = await MlkitOcr.detectFromUri(uri);
      setResults(textBlocks || []);
    } catch (e) {
      setResults([{ text: `Error: ${e.message || e}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ML Kit OCR Test</Text>
      <View style={styles.buttons}>
        <Button title="Pick from Gallery" onPress={pickFromGallery} />
        <Button title="Take Photo" onPress={takePhoto} />
      </View>

      {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

      <ScrollView style={styles.results} contentContainerStyle={{ padding: 12 }}>
        {results.length === 0 && !loading && (
          <Text style={styles.hint}>No results yet — pick an image or take a photo.</Text>
        )}
        {results.map((r, i) => (
          <View key={i} style={styles.block}>
            <Text style={styles.blockText}>{r.text || JSON.stringify(r)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  results: { flex: 1, marginTop: 12 },
  hint: { color: '#666' },
  block: { marginBottom: 12, padding: 10, backgroundColor: '#f4f4f4', borderRadius: 6 },
  blockText: { color: '#111' },
});