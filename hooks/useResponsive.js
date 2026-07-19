import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();

  const isSmallPhone = width <= 375;
  const isPhone = width >= 375 && width < 768;
  const isTablet = width >= 768;

  return {
    width,
    height,
    fontScale,
    isSmallPhone,
    isPhone,
    isTablet,
    spacing: isSmallPhone ? 12 : 16,
    screenPadding: isSmallPhone ? 16 : 24,
    cardPadding: isSmallPhone ? 14 : 18,
    titleSize: isSmallPhone ? 20 : 24,
    subtitleSize: isSmallPhone ? 15 : 17,
    valueSize: isSmallPhone ? 16 : 20,
  };
}