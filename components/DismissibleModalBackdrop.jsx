import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

export default function DismissibleModalBackdrop({ onPress, children }) {
  return (
    <Pressable style={styles.backdrop} onPress={onPress} accessible={false}>
      <Pressable
        style={styles.content}
        onPress={(event) => event.stopPropagation()}
        accessible={false}
      >
        {children}
      </Pressable>
    </Pressable>
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
