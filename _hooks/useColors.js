import { useThemeContext } from '../_context/ThemeContext';
import { Colors } from '../constants/Colors';

/**
 * Returns the currently active theme colors (light or dark)
 */
export const useColors = () => {
  const { theme } = useThemeContext(); // 'light' or 'dark'
  return Colors[theme];               // Returns Colors.light or Colors.dark
};

export default useColors;