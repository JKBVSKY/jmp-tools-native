const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const getLocalDateKey = (date) =>
  [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const parseTime = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const getWorkInterval = (entry) => {
  if (!isRecord(entry) || entry.type !== 'work') {
    return null;
  }

  const start = parseTime(entry.start);
  const end = parseTime(entry.end);
  if (start === null || end === null || start === end) {
    return null;
  }

  return { start, end };
};

const isCurrentDayShiftActive = (entry, currentMinute) => {
  const interval = getWorkInterval(entry);
  if (!interval) {
    return false;
  }

  if (interval.start < interval.end) {
    return interval.start <= currentMinute && currentMinute < interval.end;
  }

  return interval.start <= currentMinute;
};

const isPreviousDayNightShiftActive = (entry, currentMinute) => {
  const interval = getWorkInterval(entry);
  return Boolean(
    interval &&
      interval.start > interval.end &&
      currentMinute < interval.end
  );
};

export const isSessionStartAllowed = (schedule, isReady, now) => {
  if (
    isReady !== true ||
    !isRecord(schedule) ||
    !(now instanceof Date) ||
    !Number.isFinite(now.getTime())
  ) {
    return false;
  }

  const currentMinute =
    now.getHours() * 60 +
    now.getMinutes() +
    now.getSeconds() / 60 +
    now.getMilliseconds() / 60000;

  const todayKey = getLocalDateKey(now);
  const previousDate = new Date(now);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousDayKey = getLocalDateKey(previousDate);

  return (
    isCurrentDayShiftActive(schedule[todayKey], currentMinute) ||
    isPreviousDayNightShiftActive(schedule[previousDayKey], currentMinute)
  );
};
