export function appendWorkerStatusTransition(
  history,
  previousStatus,
  nextStatus,
  changedAt = new Date(),
) {
  const events = [...(Array.isArray(history) ? history : [])];
  const normalize = (status) =>
    typeof status === "boolean" ? (status ? "ACTIVE" : "INACTIVE") : status;
  const previous = normalize(previousStatus);
  const next = normalize(nextStatus);
  if (previous === next) return events;
  const eventFor = (status, date) =>
    typeof status === "boolean"
      ? { active: status, changedAt: date }
      : {
          active: status === "ACTIVE",
          labourStatus: status,
          changedAt: date,
        };
  if (!events.length) {
    events.push(eventFor(previousStatus, null));
  }
  events.push(eventFor(nextStatus, changedAt));
  return events;
}
