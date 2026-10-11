const dayMs = 24 * 60 * 60 * 1000;

export function getAssignmentDaysInRange(
  assignment,
  rangeStart,
  rangeEnd,
  today,
) {
  const assignmentEnd = assignment.endDate
    ? new Date(assignment.endDate)
    : rangeEnd < today
      ? rangeEnd
      : today;
  const overlapStart = Math.max(
    new Date(assignment.startDate).getTime(),
    rangeStart.getTime(),
  );
  const overlapEnd = Math.min(assignmentEnd.getTime(), rangeEnd.getTime());
  return overlapStart > overlapEnd
    ? 0
    : Math.floor((overlapEnd - overlapStart) / dayMs) + 1;
}
