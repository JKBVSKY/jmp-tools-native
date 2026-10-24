const MAX_DIGITS_BY_FIELD = {
  shop: 4,
  secondShop: 4,
  gate: 2,
  trailer: 6,
};

export const normalizeTransportInput = (name, value) => {
  const maxDigits = MAX_DIGITS_BY_FIELD[name];
  if (maxDigits === undefined) return value;

  const digits = value.replace(/\D/g, "").slice(0, maxDigits);
  if (name === "gate" && digits !== "" && Number(digits) > 53) {
    return null;
  }

  return digits;
};
