export function getAutoStartTime(now = new Date()) {
  const h = now.getHours();
  const m = now.getMinutes();

  // Helper to create a Date with today's date and given hour/minute
  const todayAt = (hour, minute = 0) => {
    const d = new Date(now);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  };

  // 06:00 - 09:59 -> 06:00
  if ((h > 6 && h < 10) || (h === 6 && m >= 0) || (h === 10 && m === 0)) {
    return todayAt(6, 0);
  }

  // 10:00 - 11:59 -> 10:00
  if ((h > 10 && h < 12) || (h === 10 && m >= 0) || (h === 12 && m === 0)) {
    return todayAt(10, 0);
  }

  // 12:00 - 13:29 -> 12:00
  if ((h > 12 && h < 13) || (h === 12 && m >= 0) || (h === 13 && m < 30)) {
    return todayAt(12, 0);
  }

  // 13:30 - 21:44 -> 13:30
  if ((h > 13 && h < 21) || (h === 13 && m >= 30) || (h === 21 && m < 45)) {
    return todayAt(13, 30);
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