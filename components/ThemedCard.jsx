import { View, StyleSheet } from 'react-native'
import { useColors } from '../hooks/useColors'
import React from 'react'

const ThemedView = ({ style, ...props }) => {
  const colors = useColors()

  return (
    <View
      style={[{backgroundColor: colors.uiBackground}, styles.card,
      style]}
      {...props}
    />
  )
}

export default ThemedView

const styles = StyleSheet.create({
  card: {
    borderRadius: 5,
    padding: 20
  }
})