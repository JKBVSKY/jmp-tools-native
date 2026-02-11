import Svg, { Rect, Polygon } from 'react-native-svg';

export default function PalletTier4({ size = 48 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="6" y="34" width="52" height="12" rx="3" fill="#FDBA74" />
      <Rect x="6" y="20" width="52" height="12" rx="3" fill="#FB923C" />
      <Polygon points="32,6 36,14 28,14" fill="#F97316" />
    </Svg>
  );
}