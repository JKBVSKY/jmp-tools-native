import { Platform } from 'react-native';

export const WebStyles = {
  isWeb: Platform.OS === 'web',
  
  // Container max-width for desktop
  containerMaxWidth: 1200,
  
  // Font size adjustments
  adjustFontSize: (size) => Platform.OS === 'web' ? size * 1.1 : size,
  
  // Padding adjustments for larger screens
  getPadding: (size) => Platform.OS === 'web' ? size * 1.5 : size,
};