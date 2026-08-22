import { View } from 'react-native'
import { useColors } from '../hooks/useColors'
import React from 'react'

const ThemedView = ({ style, ...props }) => {
  const colors = useColors()
  return (
    <View 
      style={[{backgroundColor: colors.background}, style]}
      {...props}
    />
  )
}

export default ThemedView