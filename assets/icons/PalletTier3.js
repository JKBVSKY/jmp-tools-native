import Svg, { Rect, Circle } from 'react-native-svg';

export default function PalletTier3({ size = 48 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="8" y="30" width="48" height="14" rx="3" fill="#A78BFA" />
      <Rect x="8" y="14" width="48" height="14" rx="3" fill="#C4B5FD" />
      <Circle cx="32" cy="52" r="4" fill="#6D28D9" />
    </Svg>
  );
}