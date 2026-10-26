import { buildUnloadingChart, readSessionDate, toFiniteNumber } from './unloadingChartData';

export const PICKING_UNIT = 'pacz/h';

// Sums boxes and time only from valid entries of the selected subsection; session-level
// sessionTime/totalBoxes are intentionally ignored. Returns null when no valid entry exists.
const readPickingSession = (session, subsection) => {
  if (!session || typeof session !== 'object' || session.sessionType !== 'picking') return null;

  const entries = session.picking?.subsectionEntries;
  if (!Array.isArray(entries)) return null;

  const date = readSessionDate(session);
  if (!date) return null;

  let boxes = 0;
  let seconds = 0;
  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object' || entry.subsection !== subsection) return;

    const entryBoxes = toFiniteNumber(entry.boxesCount);
    const entrySeconds = toFiniteNumber(entry.sessionTime);
    if (entryBoxes === null || entryBoxes < 0 || entrySeconds === null || entrySeconds <= 0) return;

    boxes += entryBoxes;
    seconds += entrySeconds;
  });

  return seconds > 0 ? { date, pallets: boxes, seconds } : null;
};

export const buildPickingChart = (sessions, period, subsection, now = new Date()) => (
  buildUnloadingChart(sessions, period, now, {
    readSession: (session) => readPickingSession(session, subsection),
    unit: PICKING_UNIT,
  })
);
