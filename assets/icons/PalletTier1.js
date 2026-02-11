import Svg, { Rect } from 'react-native-svg';

export default function PalletTier1({ size = 48 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="8" y="20" width="48" height="24" rx="4" fill="#9CA3AF" />
      <Rect x="12" y="24" width="12" height="16" fill="#6B7280" />
      <Rect x="26" y="24" width="12" height="16" fill="#6B7280" />
      <Rect x="40" y="24" width="12" height="16" fill="#6B7280" />
    </Svg>
  );
}
