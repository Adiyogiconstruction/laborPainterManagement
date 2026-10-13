import Attendance from "../models/Attendance.js";
import {
  getCompanyWorkerRates,
  loadCompanyWorkerRateHistory,
} from "./companyWorkerRates.js";
import { calculatePayableAmount } from "./attendanceUtils.js";

export async function recalculateAttendanceForWorkerRate(
  worker,
  applicableFrom,
  updatedBy,
) {
  const firstApplicableAttendanceDate = new Date(applicableFrom);
  firstApplicableAttendanceDate.setUTCHours(0, 0, 0, 0);
  firstApplicableAttendanceDate.setUTCDate(
    firstApplicableAttendanceDate.getUTCDate() - 1,
  );
  const attendance = await Attendance.find({
    worker: worker._id,
    date: { $gte: firstApplicableAttendanceDate },
  })
    .select("date status overtimeHours")
    .sort({ date: 1 })
    .lean();
  if (!attendance.length) return 0;

  const rateContext = await loadCompanyWorkerRateHistory(
    [worker],
    attendance[attendance.length - 1].date,
  );
  const operations = attendance.map((record) => {
    const rates = getCompanyWorkerRates(worker, record.date, rateContext);
    return {
      updateOne: {
        filter: { worker: worker._id, date: record.date },
        update: {
          $set: {
            dailyRate: rates.dailyRate,
            overtimeRate: rates.overtimeRate,
            companyDailyRate: rates.companyDailyRate,
            companyOvertimeRate: rates.companyOvertimeRate,
            payableAmount: calculatePayableAmount({
              dailyRate: rates.dailyRate,
              overtimeHours: record.overtimeHours,
              overtimeRate: rates.overtimeRate,
              status: record.status,
            }),
            updatedBy,
          },
        },
      },
    };
  });
  await Attendance.bulkWrite(operations);
  return attendance.length;
}
