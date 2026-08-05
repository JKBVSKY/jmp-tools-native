import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { appConfirm } from '../../../utils/crossPlatformAlert';

export default function SessionActionBar({
  isPaused,
  onResume,
  onPause,
  onFinish,
  colors,
  bottomInset = 0,
  finishConfirmTitle = 'Zakończ sesję',
  finishConfirmMessage = 'Czy na pewno chcesz zakończyć tę sesję?',
}) {
  if (isPaused) {
    return (
      <View
        style={[
          styles.footer,
          styles.footerRow,
          {
            backgroundColor: colors.navBackground,
            borderTopColor: colors.border,
            paddingBottom: Math.max(bottomInset, 12),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.actionButton, styles.resumeButton, { backgroundColor: colors.butBackground }]}
          onPress={onResume}
        >
          <Ionicons name="play" size={20} color={colors.butText} />
          <Text style={[styles.actionButtonText, { color: colors.butText }]}>Wznów</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.footer,
        styles.footerRow,
        {
          backgroundColor: colors.navBackground,
          borderTopColor: colors.border,
          paddingBottom: Math.max(bottomInset, 12),
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.butBackground }]}
        onPress={onPause}
      >
        <Ionicons name="pause-outline" size={20} color={colors.butText} />
        <Text style={[styles.actionButtonText, { color: colors.butText }]}>Zatrzymaj</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.butBackground }]}
        onPress={() => appConfirm(finishConfirmTitle, finishConfirmMessage, onFinish)}
      >
        <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.butText} />
        <Text style={[styles.actionButtonText, { color: colors.butText }]}>Zakończ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resumeButton: {
    minHeight: 52,
    paddingVertical: 14,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
