export const ATTENDANCE_STATUS = {
  NOT_MARKED: { label: "Not marked", weight: 0 },
  PRESENT: { label: "Present", weight: 1 },
  DOUBLE_PRESENT: { label: "Double present (2P)", weight: 2 },
  HALF_DAY: { label: "Half day", weight: 0.5 },
  ABSENT: { label: "Absent", weight: 0 },
  LEAVE: { label: "Leave", weight: 0 },
};

export const ATTENDANCE_OPTIONS = Object.entries(ATTENDANCE_STATUS).map(
  ([value, config]) => ({
    value,
    label: config.label,
  }),
);

export function normalizeAttendanceStatus(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");

  const map = {
    NOT_MARKED: "NOT_MARKED",
    PRESENT: "PRESENT",
    DOUBLE_PRESENT: "DOUBLE_PRESENT",
    "2P": "DOUBLE_PRESENT",
    HALF_DAY: "HALF_DAY",
    HALFDAY: "HALF_DAY",
    ABSENT: "ABSENT",
    LEAVE: "LEAVE",
  };

  return map[normalized] || "NOT_MARKED";
}

export function getWorkUnits(status) {
  const normalized = normalizeAttendanceStatus(status);
  if (normalized === "PRESENT") return 1;
  if (normalized === "DOUBLE_PRESENT") return 2;
  if (normalized === "HALF_DAY") return 0.5;
  return 0;
}

export function toDateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function buildAttendanceMap(records = []) {
  return records.reduce((accumulator, record) => {
    const workerId = String(record.worker?._id || record.worker || "");
    if (!workerId) return accumulator;
    const dateKey = toDateKey(record.date);
    if (!dateKey) return accumulator;
    accumulator[workerId] ??= {};
    accumulator[workerId][dateKey] = normalizeAttendanceStatus(record.status);
    return accumulator;
  }, {});
}

export function calculatePayableAmount({
  dailyRate = 0,
  overtimeHours = 0,
  overtimeRate = 0,
  status,
}) {
  const workUnits = getWorkUnits(status);
  const base = Number(dailyRate || 0) * workUnits;
  const overtime = Number(overtimeHours || 0) * Number(overtimeRate || 0);
  return Number((base + overtime).toFixed(2));
}
