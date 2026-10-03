export function appendWorkerStatusTransition(
  history,
  previousStatus,
  nextStatus,
  changedAt = new Date(),
) {
  const events = [...(Array.isArray(history) ? history : [])];
  if (previousStatus === nextStatus) return events;
  if (!events.length) {
    events.push({ active: previousStatus, changedAt: null });
  }
  events.push({ active: nextStatus, changedAt });
  return events;
}
