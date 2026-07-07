// constants/reportTypes.js
export const REPORT_TYPES = [
  { value: 'damaged_sealing_rope', label: 'Brak linki lub uszkodzona linka z plombownicy' },
  { value: 'short_sealing_rope', label: 'Za krótka linka z plombownicy' },
  { value: 'no_strap_handle', label: 'Brak paska do ściągnięcia rolety' },
  { value: 'no_handle', label: 'Brak rączki do otwierania/zamykania rolety' },
  { value: 'damage', label: 'Uszkodzona naczepa' },
];

export const getReportTypeLabel = (value) => {
  return REPORT_TYPES.find((type) => type.value === value)?.label || value;
};