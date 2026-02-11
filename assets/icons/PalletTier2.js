import Svg, { Rect } from 'react-native-svg';

export default function PalletTier2({ size = 48 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="6" y="28" width="52" height="18" rx="4" fill="#60A5FA" />
      <Rect x="10" y="12" width="52" height="18" rx="4" fill="#93C5FD" />
    </Svg>
  );
}