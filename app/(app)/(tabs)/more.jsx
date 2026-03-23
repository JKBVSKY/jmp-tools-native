// app/(app)/(tabs)/more.jsx
import React from 'react';
import { View } from 'react-native';

export default function MorePlaceholder() {
  // We never actually navigate here; tabBarButton handles presses.
  return <View style={{ flex: 1 }} />;
}
