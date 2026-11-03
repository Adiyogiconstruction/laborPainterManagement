const dayMs = 24 * 60 * 60 * 1000;

export function calculateAttendanceProfit({
  companyDailyRate,
  companyOvertimeRate = 0,
  labourDailyRate,
  labourOvertimeRate = 0,
  workUnits,
  overtimeHours = 0,
}) {
  const companyDutyBilling = companyDailyRate * workUnits;
  const companyOvertimeBilling = companyOvertimeRate * overtimeHours;
  const labourDutySalary = labourDailyRate * workUnits;
  const labourOvertimeSalary = labourOvertimeRate * overtimeHours;
  const companyBilling = companyDutyBilling + companyOvertimeBilling;
  const labourSalary = labourDutySalary + labourOvertimeSalary;

  return {
    companyBilling,
    labourSalary,
    dutyProfit: companyDutyBilling - labourDutySalary,
    overtimeProfit: companyOvertimeBilling - labourOvertimeSalary,
  };
}

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

export function summarizeAssignmentAttendance(
  assignment,
  attendance,
  rangeStart,
  rangeEnd,
  today,
) {
  const workerIds = new Set((assignment.workerIds || []).map(String));
  if (!workerIds.size) return null;

  const start = Math.max(
    new Date(assignment.startDate).getTime(),
    rangeStart.getTime(),
  );
  const end = Math.min(
    assignment.endDate ? new Date(assignment.endDate).getTime() : today.getTime(),
    rangeEnd.getTime(),
    today.getTime(),
  );
  if (start > end) return { labourDays: 0, profit: 0 };

  return attendance.reduce(
    (summary, record) => {
      const date = new Date(record.date).getTime();
      if (
        !workerIds.has(String(record.worker)) ||
        date < start ||
        date > end
      ) {
        return summary;
      }

      const workUnits = Number(record.workUnits) || 0;
      const overtimeHours = Number(record.overtimeHours) || 0;
      const dailyRate = Number(
        record.companyDailyRate ?? assignment.companyLabourRate ?? 0,
      );
      const overtimeRate = Number(
        record.companyOvertimeRate ?? assignment.companyOvertimeRate ?? 0,
      );
      const labourPay = Number(
        record.payableAmount ??
          (Number(record.dailyRate || 0) * workUnits +
            Number(record.overtimeRate || 0) * overtimeHours),
      );

      if (workUnits > 0) summary.labourDays += 1;
      summary.profit +=
        dailyRate * workUnits + overtimeRate * overtimeHours - labourPay;
      return summary;
    },
    { labourDays: 0, profit: 0 },
  );
}
