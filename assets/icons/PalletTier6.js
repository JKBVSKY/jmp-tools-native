import Svg, { Rect } from 'react-native-svg';

export default function PalletTier6({ size = 48 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* pedestal */}
      <Rect x="18" y="44" width="28" height="6" rx="2" fill="#111827" />

      {/* golden pallet */}
      <Rect x="10" y="22" width="44" height="18" rx="4" fill="#FACC15" />
      <Rect x="14" y="26" width="12" height="10" fill="#EAB308" />
      <Rect x="28" y="26" width="12" height="10" fill="#EAB308" />
      <Rect x="42" y="26" width="8" height="10" fill="#EAB308" />
    </Svg>
  );
}