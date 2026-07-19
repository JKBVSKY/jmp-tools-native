export function getAutoStartTime(now = new Date()) {
  const h = now.getHours();
  const m = now.getMinutes();

  // Helper to create a Date with today's date and given hour/minute
  const todayAt = (hour, minute = 0) => {
    const d = new Date(now);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  };

  // 06:00 - 14:14 -> 06:00
  if ((h > 6 && h < 14) || (h === 6 && m >= 0) || (h === 14 && m < 15)) {
    return todayAt(6, 0);
  }

  // 13:45 - 21:59 -> 13:45
  if ((h > 13 && h < 22) || (h === 13 && m >= 45) || (h === 22 && m < 0)) {
    return todayAt(13, 45);
  }

  // 21:45 - 05:59 -> 21:45 (previous day if before 6:00)
  if ((h === 21 && m >= 45) || h > 21 || h < 6 || (h === 6 && m === 0)) {
    // If before 6:00, set to yesterday 21:45
    if (h < 6 || (h === 6 && m === 0)) {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      d.setHours(21, 45, 0, 0);
      return d.getTime();
    }
    // Otherwise, today at 21:45
    return todayAt(21, 45);
  }

  // Fallback: now
  return now.getTime();
}