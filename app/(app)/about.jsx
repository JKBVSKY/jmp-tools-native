import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../_hooks/useColors';
import ThemedView from '../../components/ThemedView';

export default function About() {
  const colors = useColors();

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View>
        <Text style={[styles.text, { color: colors.text }]}>About screen</Text>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 20 },
});
