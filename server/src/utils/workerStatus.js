export const workerStatuses = ["ACTIVE", "INACTIVE", "WENT_HOME"];

export function getWorkerLabourStatus(worker) {
  return (
    worker?.labourStatus ||
    (worker?.active === false ? "INACTIVE" : "ACTIVE")
  );
}

export function applyWorkerStatusFilter(workerFilter, status, fallback) {
  const selectedStatus = status || fallback;
  if (!workerStatuses.includes(selectedStatus) && selectedStatus !== "ALL") {
    return false;
  }
  if (selectedStatus === "ACTIVE") {
    workerFilter.active = true;
  } else if (selectedStatus === "INACTIVE") {
    workerFilter.active = false;
    workerFilter.labourStatus = { $ne: "WENT_HOME" };
  } else if (selectedStatus === "WENT_HOME") {
    workerFilter.labourStatus = "WENT_HOME";
  }
  return true;
}
