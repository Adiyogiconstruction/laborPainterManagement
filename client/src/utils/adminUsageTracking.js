export const ADMIN_USAGE_IDLE_THRESHOLD_MS = 5 * 60 * 1000;
export const ADMIN_USAGE_PULSE_INTERVAL_MS = 60 * 1000;

export const isAdminUsageActive = (lastActivityAt, now = Date.now()) => {
  const lastActivityTime = Number(lastActivityAt);
  return (
    Number.isFinite(lastActivityTime) &&
    lastActivityTime <= now &&
    now - lastActivityTime <= ADMIN_USAGE_IDLE_THRESHOLD_MS
  );
};
