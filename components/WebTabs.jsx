import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Platform } from 'react-native';
import PagerView from 'react-native-pager-view';

/**
 * Wrapper that uses PagerView on mobile, scrollable tabs on web
 */
export function TabbedView({ children, onPageSelected, pageMargin, style }) {
  if (Platform.OS === 'web') {
    // On web, render children as regular views with scroll
    return (
      <ScrollView 
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false}
        style={[styles.webContainer, style]}
      >
        {children}
      </ScrollView>
    );
  }

  // On mobile, use PagerView
  return (
    <PagerView
      style={style}
      onPageSelected={onPageSelected}
      pageMargin={pageMargin}
    >
      {children}
    </PagerView>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
  },
});