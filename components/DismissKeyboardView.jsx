import React from 'react';
import {
  Keyboard,
  Platform,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

export default function DismissKeyboardView({ children, style, ...rest }) {
  if (Platform.OS === 'web') {
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[{ flex: 1 }, style]} {...rest}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
}