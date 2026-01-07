/**
 * Calculates the automatic forced finish time based on current time
 * Handles night shift scenarios where finish time might be next day
 */
export const getAutoForcedFinishTime = () => {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;

  let finishHours, finishMinutes;

  // Define time ranges and corresponding finish times
  if (currentTimeInMinutes >= 6 * 60 && currentTimeInMinutes < 10 * 60) {
    // 06:00 - 09:59 → finish at 14:15
    finishHours = 14;
    finishMinutes = 15;
  } else if (currentTimeInMinutes >= 10 * 60 && currentTimeInMinutes < 12 * 60) {
    // 10:00 - 11:59 → finish at 18:15
    finishHours = 18;
    finishMinutes = 15;
  } else if (currentTimeInMinutes >= 12 * 60 && currentTimeInMinutes < 13.5 * 60) {
    // 12:00 - 13:29 → finish at 20:15
    finishHours = 20;
    finishMinutes = 15;
  } else if (currentTimeInMinutes >= 13.5 * 60 && currentTimeInMinutes < 21.75 * 60) {
    // 13:30 - 21:44 → finish at 21:45
    finishHours = 21;
    finishMinutes = 45;
  } else {
    // 21:45 - 05:59 (night shift) → finish at 06:00 NEXT DAY
    finishHours = 6;
    finishMinutes = 0;
  }

  // Create the finish time
  const finishTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    finishHours,
    finishMinutes,
    0
  );

  // If current time is in night shift (21:45 - 23:59) and finish time is 06:00,
  // add one day to finish time
  if (currentTimeInMinutes >= 21.75 * 60 && finishHours === 6) {
    finishTime.setDate(finishTime.getDate() + 1);
  }

  return finishTime.getTime();
};

/**
 * Validates if the finish time is within acceptable range of start time
 * Finish time must be: startTime < finishTime <= startTime + 12 hours
 */
export const isFinishTimeValid = (finishTime, startTime) => {
  const startMs = new Date(startTime).getTime();
  const finishMs = new Date(finishTime).getTime();
  const maxDurationMs = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

  // Finish must be after start
  if (finishMs <= startMs) {
    return false;
  }

  // Finish must not exceed start + 12 hours
  if (finishMs > startMs + maxDurationMs) {
    return false;
  }

  return true;
};

/**
 * Gets the minimum and maximum allowed times for finish time picker
 * based on start time
 */
export const getFinishTimeRange = (startTime) => {
  const startDate = new Date(startTime);
  const startHours = startDate.getHours();
  const startMinutes = startDate.getMinutes();
  const startSeconds = startDate.getSeconds();

  // Minimum: 1 second after start time
  const minTime = new Date(startDate);
  minTime.setSeconds(minTime.getSeconds() + 1);

  // Maximum: start time + 12 hours
  const maxTime = new Date(startDate);
  maxTime.setHours(maxTime.getHours() + 12);

  return {
    minHours: String(minTime.getHours()).padStart(2, '0'),
    minMinutes: String(minTime.getMinutes()).padStart(2, '0'),
    minSeconds: String(minTime.getSeconds()).padStart(2, '0'),
    maxHours: String(maxTime.getHours()).padStart(2, '0'),
    maxMinutes: String(maxTime.getMinutes()).padStart(2, '0'),
    maxSeconds: String(maxTime.getSeconds()).padStart(2, '0'),
  };
};
