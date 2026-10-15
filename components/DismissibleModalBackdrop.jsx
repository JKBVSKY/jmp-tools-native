import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function DismissibleModalBackdrop({ onPress, children }) {
  return (
    <View style={styles.backdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        accessible={false}
      />
      <View style={styles.content} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
});
