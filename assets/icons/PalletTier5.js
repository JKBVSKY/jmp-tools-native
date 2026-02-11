import Svg, { Rect } from 'react-native-svg';

export default function PalletTier5({ size = 48 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="10" y="36" width="44" height="10" rx="3" fill="#F87171" />
      <Rect x="10" y="24" width="44" height="10" rx="3" fill="#EF4444" />
      <Rect x="10" y="12" width="44" height="10" rx="3" fill="#B91C1C" />
    </Svg>
  );
}