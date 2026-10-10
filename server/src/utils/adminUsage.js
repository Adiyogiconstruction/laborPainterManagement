const DAY_MS = 24 * 60 * 60 * 1000;
const INDIA_OFFSET_MS = 330 * 60 * 1000;

export function currentUsageDate(now = new Date()) {
  return new Date(new Date(now).getTime() + INDIA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function getUsagePeriodRange(period, dateValue) {
  if (!["day", "week", "month", "year"].includes(period)) {
    throw new Error("Period must be day, week, month or year.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue || "")) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }

  const anchor = new Date(`${dateValue}T00:00:00.000Z`);
  if (
    Number.isNaN(anchor.getTime()) ||
    anchor.toISOString().slice(0, 10) !== dateValue
  ) {
    throw new Error("Date is invalid.");
  }

  const start = new Date(anchor);
  const end = new Date(anchor);
  if (period === "day") {
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (period === "week") {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    end.setTime(start.getTime() + 7 * DAY_MS);
  } else if (period === "month") {
    start.setUTCDate(1);
    end.setTime(start.getTime());
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else {
    start.setUTCMonth(0, 1);
    end.setTime(start.getTime());
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  }

  return {
    start: new Date(start.getTime() - INDIA_OFFSET_MS),
    end: new Date(end.getTime() - INDIA_OFFSET_MS),
  };
}

export function summarizeAdminUsage(
  sessions,
  periodStart,
  periodEnd,
  now = new Date(),
) {
  const nowTime = new Date(now).getTime();
  const startBoundary = new Date(periodStart).getTime();
  const endBoundary = Math.min(
    new Date(periodEnd).getTime(),
    nowTime,
  );
  let totalMilliseconds = 0;
  let sessionCount = 0;
  let activeSessionCount = 0;

  for (const session of sessions) {
    const startedAt = new Date(session.startedAt).getTime();
    const expiresAt = new Date(session.expiresAt).getTime();
    const endedAt = session.endedAt
      ? new Date(session.endedAt).getTime()
      : nowTime;
    const overlapStart = Math.max(startedAt, startBoundary);
    const overlapEnd = Math.min(endedAt, expiresAt, endBoundary);
    const duration = Math.max(0, overlapEnd - overlapStart);
    if (duration === 0) continue;

    totalMilliseconds += duration;
    sessionCount += 1;
    if (!session.endedAt && expiresAt > nowTime && startedAt <= nowTime) {
      activeSessionCount += 1;
    }
  }

  return { totalMilliseconds, sessionCount, activeSessionCount };
}
