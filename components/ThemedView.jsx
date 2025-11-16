import { View, useColorScheme } from 'react-native'
import { Colors } from '../constants/Colors'
import React from 'react'

const ThemedView = ({ style, ...props }) => {
  const colorScheme = useColorScheme()
  const themeColors = Colors[colorScheme] ?? Colors.light
  return (
    <View 
      style={[{backgroundColor: themeColors.background}, style]}
      {...props}
    />
  )
}

export default ThemedView