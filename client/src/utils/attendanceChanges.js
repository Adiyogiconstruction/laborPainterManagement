const unmarkedCell = { status: "NOT_MARKED", overtimeHours: 0 };

const cellFor = (cells, workerId, date) =>
  cells[`${workerId}:${date}`] || unmarkedCell;

export function buildDirtyAttendanceEntries({
  workers,
  days,
  month,
  cells,
  originalCells,
}) {
  return workers.flatMap((worker) =>
    Array.from({ length: days }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, "0")}`;
      const current = cellFor(cells, worker._id, date);
      const original = cellFor(originalCells, worker._id, date);
      if (
        current.status === original.status &&
        Number(current.overtimeHours || 0) ===
          Number(original.overtimeHours || 0)
      ) {
        return null;
      }
      return {
        worker: worker._id,
        date,
        status: current.status,
        overtimeHours: current.overtimeHours || 0,
        ...(current.status === "NOT_MARKED" ? { clear: true } : {}),
      };
    }).filter(Boolean),
  );
}
