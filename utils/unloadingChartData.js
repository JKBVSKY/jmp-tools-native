const WEEKDAY_SHORT = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];
const WEEKDAY_FULL = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
const MONTH_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const MONTH_NOMINATIVE = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const MONTH_GENITIVE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

const SUMMARY_TITLES = {
  week: 'Średnia tygodniowa',
  month: 'Średnia miesięczna',
  year: 'Średnia roczna',
};

export const NO_DATA_TEXT = 'Brak danych';
const TRUCK_UNIT = 'palet/h';

const pad2 = (value) => String(value).padStart(2, '0');
const getDayKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const getMonthKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

export const toFiniteNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const readSessionDate = (session) => {
  if (!session.date) return null;
  const date = new Date(session.date);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Returns { date, pallets, seconds } for a valid truck-loading session, otherwise null.
// Readers passed to buildUnloadingChart use the same shape; `pallets` holds the unit count.
const readValidSession = (session) => {
  if (!session || typeof session !== 'object' || session.sessionType === 'picking') return null;

  const pallets = toFiniteNumber(session.palletsLoaded);
  const seconds = toFiniteNumber(session.sessionTime ?? session.loadingTime);
  if (pallets === null || pallets < 0 || seconds === null || seconds <= 0) return null;

  const date = readSessionDate(session);
  if (!date) return null;

  return { date, pallets, seconds };
};

// Time-weighted rate: total pallets / total hours. Returns null when there is no valid time.
const toRate = (totals) => (
  totals && totals.seconds > 0 ? totals.pallets / (totals.seconds / 3600) : null
);

const addToTotals = (target, pallets, seconds) => {
  target.pallets += pallets;
  target.seconds += seconds;
};

export const formatRate = (value) => (
  String(Number(value.toFixed(1))).replace('.', ',')
);

export const formatRateText = (value, unit = TRUCK_UNIT) => (
  value === null || value === undefined ? NO_DATA_TEXT : `${formatRate(value)} ${unit}`
);

// Buckets describe the whole axis of the chart; a bucket without sessions has value === null.
const buildBuckets = (period, now) => {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === 'week') {
    const mondayOffset = (now.getDay() + 6) % 7;
    const todayKey = getDayKey(now);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(year, month, now.getDate() - mondayOffset + index);
      const key = getDayKey(date);
      return {
        key,
        label: WEEKDAY_SHORT[index],
        a11yName: `${WEEKDAY_FULL[index]}, ${date.getDate()} ${MONTH_GENITIVE[date.getMonth()]}`,
        title: `${WEEKDAY_FULL[index]}, ${date.getDate()} ${MONTH_GENITIVE[date.getMonth()]}`,
        isCurrent: key === todayKey,
      };
    });
  }

  if (period === 'month') {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = getDayKey(now);
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const key = getDayKey(new Date(year, month, day));
      const title = `${day} ${MONTH_GENITIVE[month]} ${year}`;
      return {
        key,
        // Only some days get an axis label so 28-31 columns stay readable.
        label: day === 1 || day % 5 === 0 ? String(day) : '',
        a11yName: title,
        title,
        isCurrent: key === todayKey,
      };
    });
  }

  const currentMonthKey = getMonthKey(now);
  return Array.from({ length: 12 }, (_, index) => {
    const key = getMonthKey(new Date(year, index, 1));
    const title = `${MONTH_NOMINATIVE[index]} ${year}`;
    return {
      key,
      label: MONTH_SHORT[index],
      a11yName: title,
      title,
      isCurrent: key === currentMonthKey,
    };
  });
};

const isInRange = (period, date, now) => {
  if (period === 'year') return date.getFullYear() === now.getFullYear();
  if (period === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  return true;
};

export const buildUnloadingChart = (
  sessions,
  period,
  now = new Date(),
  { readSession = readValidSession, unit = TRUCK_UNIT } = {}
) => {
  const buckets = buildBuckets(period, now);
  const totalsByKey = new Map(buckets.map((bucket) => [bucket.key, { pallets: 0, seconds: 0 }]));
  const rangeTotals = { pallets: 0, seconds: 0 };
  const getKey = period === 'year' ? getMonthKey : getDayKey;

  (Array.isArray(sessions) ? sessions : []).forEach((session) => {
    const valid = readSession(session);
    if (!valid || !isInRange(period, valid.date, now)) return;

    // Sessions belong to the local day/month they started in.
    const bucketTotals = totalsByKey.get(getKey(valid.date));
    if (!bucketTotals) return;

    addToTotals(bucketTotals, valid.pallets, valid.seconds);
    addToTotals(rangeTotals, valid.pallets, valid.seconds);
  });

  const withValues = buckets.map((bucket) => ({
    ...bucket,
    value: toRate(totalsByKey.get(bucket.key)),
  }));
  const maxValue = withValues.reduce(
    (max, bucket) => (bucket.value !== null && bucket.value > max ? bucket.value : max),
    0
  );

  return {
    period,
    unit,
    summaryTitle: SUMMARY_TITLES[period],
    summaryRate: toRate(rangeTotals),
    buckets: withValues.map((bucket) => ({
      ...bucket,
      valueText: bucket.value !== null ? formatRate(bucket.value) : null,
      heightRatio: bucket.value !== null && maxValue > 0 ? bucket.value / maxValue : 0,
    })),
  };
};

// Text shown above the chart: the selected bucket, or the summary of the whole range.
export const getUnloadingChartMetric = (chart, selectedBucket) => (
  selectedBucket
    ? { title: selectedBucket.title, value: formatRateText(selectedBucket.value, chart.unit) }
    : { title: chart.summaryTitle, value: formatRateText(chart.summaryRate, chart.unit) }
);
