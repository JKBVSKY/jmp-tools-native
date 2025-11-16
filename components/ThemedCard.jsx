import { View, useColorScheme } from 'react-native'
import { Colors } from '../constants/Colors'
import React from 'react'

const ThemedView = ({ style, ...props }) => {
  const colorScheme = useColorScheme()
  const themeColors = Colors[colorScheme] ?? Colors.light

  return (
    <View 
      style={[{backgroundColor: themeColors.uiBackground}, styles.card, 
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