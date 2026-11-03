import Attendance from "../models/Attendance.js";
import {
  getCompanyWorkerRates,
  loadCompanyWorkerRateHistory,
} from "./companyWorkerRates.js";
import { calculatePayableAmount } from "./attendanceUtils.js";

const localDateKey = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => ["year", "month", "day"].includes(type))
      .map(({ type, value: part }) => [type, part]),
  );
  return `${values.year}-${values.month}-${values.day}`;
};

export function isAttendanceOnOrAfterRateDate(attendanceDate, applicableFrom) {
  const rateDateKey = new Date(applicableFrom).toISOString().slice(0, 10);
  return localDateKey(attendanceDate) >= rateDateKey;
}

export function getAttendanceRateDate(attendanceDate) {
  return new Date(`${localDateKey(attendanceDate)}T00:00:00.000Z`);
}

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
    .lean()
    .then((records) =>
      records.filter((record) =>
        isAttendanceOnOrAfterRateDate(record.date, applicableFrom),
      ),
    );
  if (!attendance.length) return 0;

  const rateContext = await loadCompanyWorkerRateHistory(
    [worker],
    getAttendanceRateDate(attendance[attendance.length - 1].date),
  );
  const operations = attendance.map((record) => {
    const rates = getCompanyWorkerRates(
      worker,
      getAttendanceRateDate(record.date),
      rateContext,
    );
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
