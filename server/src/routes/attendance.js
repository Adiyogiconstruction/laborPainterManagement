import { Router } from "express";
import Attendance from "../models/Attendance.js";
import Worker from "../models/Worker.js";
import AttendanceSheet from "../models/AttendanceSheet.js";
import {
  getCompanyWorkerRates,
  loadCompanyWorkerRateHistory,
} from "../utils/companyWorkerRates.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { recordAdminActivity } from "../utils/adminActivity.js";
import {
  buildAttendanceMap,
  calculatePayableAmount,
  getWorkUnits,
  normalizeAttendanceStatus,
} from "../utils/attendanceUtils.js";

const router = Router();

const asDateOnly = (value) => {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const nextDate = (value) => {
  const date = asDateOnly(value);
  date.setDate(date.getDate() + 1);
  return date;
};

const toDateString = (value) => {
  const date = asDateOnly(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const type = "LABOUR";
    const dateValue = req.query.date || new Date().toISOString().slice(0, 10);
    const dateKey = toDateString(dateValue);
    const start = asDateOnly(dateValue);
    const end = nextDate(dateValue);

    const workers = await Worker.find({
      active: true,
      type,
      deletedAt: null,
    }).sort({ name: 1 });

    const records = await Attendance.find({
      type,
      date: { $gte: start, $lt: end },
    }).populate("worker", "name type phone skill");

    const attendanceByWorker = buildAttendanceMap(records);
    const sheet = await AttendanceSheet.findOne({
      type: "ALL",
      date: start,
    });
    const rateContext = await loadCompanyWorkerRateHistory(workers, start);

    const rows = workers.map((worker) => {
      const workerId = String(worker._id);
      const effectiveRates = getCompanyWorkerRates(worker, start, rateContext);
      const status = attendanceByWorker[workerId]?.[dateKey] || "NOT_MARKED";
      const record = records.find(
        (item) => String(item.worker?._id || item.worker) === workerId,
      );
      return {
        ...worker.toObject(),
        overtimeHourlyRate: effectiveRates.overtimeRate,
        status,
        workUnits: record?.workUnits ?? getWorkUnits(status),
        hours: record?.hours ?? 8,
        checkIn: record?.checkIn || "",
        checkOut: record?.checkOut || "",
        overtimeHours: record?.overtimeHours ?? 0,
        leaveReason: record?.leaveReason || "",
        notes: record?.notes || "",
        payableAmount: record?.payableAmount ?? 0,
        dailyRate: record?.dailyRate ?? effectiveRates.dailyRate,
        overtimeRate: record?.overtimeRate ?? effectiveRates.overtimeRate,
        locked: Boolean(record?.locked ?? sheet?.locked),
      };
    });

    const summary = rows.reduce(
      (result, worker) => {
        result[worker.status] = (result[worker.status] || 0) + 1;
        return result;
      },
      {
        NOT_MARKED: 0,
        PRESENT: 0,
        DOUBLE_PRESENT: 0,
        TRIPLE_PRESENT: 0,
        HALF_DAY: 0,
        ABSENT: 0,
        LEAVE: 0,
      },
    );
    const typeSummary = rows.reduce(
      (result, worker) => {
        const group = result[worker.type] || {
          total: 0,
          PRESENT: 0,
          HALF_DAY: 0,
          ABSENT: 0,
          LEAVE: 0,
          NOT_MARKED: 0,
          DOUBLE_PRESENT: 0,
          TRIPLE_PRESENT: 0,
          payable: 0,
        };
        group.total += 1;
        group[worker.status] += 1;
        group.payable += Number(worker.payableAmount || 0);
        result[worker.type] = group;
        return result;
      },
      {
        LABOUR: {
          total: 0,
          PRESENT: 0,
          HALF_DAY: 0,
          ABSENT: 0,
          LEAVE: 0,
          NOT_MARKED: 0,
          DOUBLE_PRESENT: 0,
          TRIPLE_PRESENT: 0,
          payable: 0,
        },
      },
    );

    res.json({
      type,
      date: dateKey,
      workers: rows,
      summary,
      typeSummary,
      locked: Boolean(sheet?.locked),
      canEdit: ["OWNER", "ADMIN"].includes(req.user.role),
    });
  }),
);

router.get(
  "/monthly",
  asyncHandler(async (req, res) => {
    const month = String(req.query.month || "");
    const type = "LABOUR";
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new ApiError(400, "Month must use YYYY-MM format.");
    }
    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 1);
    const days = new Date(year, monthNumber, 0).getDate();
    const [workers, records, sheet] = await Promise.all([
      Worker.find({
        type,
        deletedAt: null,
      }).sort({ name: 1 }),
      Attendance.find({
        type,
        date: { $gte: start, $lt: end },
      }).select("worker date status overtimeHours dailyRate overtimeRate payableAmount"),
      AttendanceSheet.findOne({
        type: "ALL",
        date: start,
      }),
    ]);
    const attendance = records.map((record) => ({
      worker: String(record.worker),
      date: toDateString(record.date),
      status: record.status,
      overtimeHours: record.overtimeHours || 0,
      dailyRate: record.dailyRate || 0,
      overtimeRate: record.overtimeRate || 0,
      payableAmount: record.payableAmount || 0,
    }));
    const rateContext = await loadCompanyWorkerRateHistory(
      workers,
      new Date(end.getTime() - 1),
    );
    res.json({
      month,
      days,
      locked: Boolean(sheet?.locked),
      canEdit: ["OWNER", "ADMIN"].includes(req.user.role),
      workers: workers.map((worker) => ({
        ...worker.toObject(),
        dailyRate: getCompanyWorkerRates(
          worker,
          new Date(end.getTime() - 1),
          rateContext,
        ).dailyRate,
        overtimeHourlyRate: getCompanyWorkerRates(
          worker,
          new Date(end.getTime() - 1),
          rateContext,
        ).overtimeRate,
        rateHistory: (
          rateContext.ratesByWorker.get(String(worker._id)) || []
        ).map((rate) => ({
          applicableFrom: rate.applicableFrom.toISOString().slice(0, 10),
          dailyRate: rate.labourDailyRate,
          overtimeRate: rate.labourOvertimeRate,
        })),
      })),
      attendance,
    });
  }),
);

router.post(
  "/bulk",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const { month, entries = [] } = req.body;
    if (!/^\d{4}-\d{2}$/.test(String(month || ""))) {
      throw new ApiError(400, "Month must use YYYY-MM format.");
    }
    if (!Array.isArray(entries)) {
      throw new ApiError(400, "Attendance entries must be an array.");
    }
    const [year, monthNumber] = String(month).split("-").map(Number);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 1);
    const sheet = await AttendanceSheet.findOne({
      type: "ALL",
      date: start,
      locked: true,
    });
    if (sheet) throw new ApiError(409, "This month is locked.");

    const workerIds = [
      ...new Set(entries.map((entry) => String(entry.worker))),
    ];
    const [workers, existingRecords] = await Promise.all([
      Worker.find({
        _id: { $in: workerIds },
        deletedAt: null,
      }),
      Attendance.find({
        worker: { $in: workerIds },
        date: { $gte: start, $lt: end },
      }),
    ]);
    const workersById = new Map(
      workers.map((worker) => [String(worker._id), worker]),
    );
    const rateContext = await loadCompanyWorkerRateHistory(
      workers,
      new Date(end.getTime() - 1),
    );
    const existingByKey = new Map(
      existingRecords.map((record) => [
        `${record.worker}:${toDateString(record.date)}`,
        record,
      ]),
    );
    const operations = [];
    for (const entry of entries) {
      const worker = workersById.get(String(entry.worker));
      if (!worker || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date))) continue;
      const entryDate = new Date(`${entry.date}T00:00:00`);
      if (entryDate < start || entryDate >= end) continue;
      const key = `${worker._id}:${entry.date}`;
      const existing = existingByKey.get(key);
      if (existing?.locked) {
        throw new ApiError(409, `Attendance for ${entry.date} is locked.`);
      }
      const status = normalizeAttendanceStatus(entry.status);
      if (status === "NOT_MARKED") {
        operations.push({
          deleteOne: { filter: { worker: worker._id, date: entryDate } },
        });
        continue;
      }
      const overtimeHours = Number(
        entry.overtimeHours ?? existing?.overtimeHours ?? 0,
      );
      const effectiveRates = getCompanyWorkerRates(
        worker,
        entryDate,
        rateContext,
      );
      const assignedCompany = rateContext.companyByName.get(worker.companyName);
      const dailyRate = Number(
        existing?.dailyRate ?? effectiveRates.dailyRate,
      );
      const overtimeRate = Number(
        entry.overtimeRate ??
          existing?.overtimeRate ??
          effectiveRates.overtimeRate,
      );
      const companyDailyRate = Number(
        existing?.companyDailyRate ?? effectiveRates.companyDailyRate,
      );
      operations.push({
        updateOne: {
          filter: { worker: worker._id, date: entryDate },
          update: {
            $set: {
              worker: worker._id,
              company: existing?.company ?? assignedCompany?._id ?? null,
              companyName: existing?.companyName ?? worker.companyName ?? "",
              type: worker.type,
              date: entryDate,
              status,
              workUnits: getWorkUnits(status),
              hours: existing?.hours ?? 8,
              checkIn: existing?.checkIn || "",
              checkOut: existing?.checkOut || "",
              overtimeHours,
              dailyRate,
              overtimeRate,
              companyDailyRate,
              workZone: existing?.workZone || worker.workZone,
              payableAmount: calculatePayableAmount({
                dailyRate,
                overtimeHours,
                overtimeRate,
                status,
              }),
              leaveReason: existing?.leaveReason || "",
              notes: existing?.notes || "",
              locked: false,
              lockedAt: null,
              lockedBy: null,
              updatedBy: req.user.id,
            },
            $setOnInsert: { createdBy: req.user.id },
          },
          upsert: true,
          setDefaultsOnInsert: false,
        },
      });
    }
    if (operations.length) await Attendance.bulkWrite(operations);
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} bulk updated attendance for ${month}.`,
      { month, section: "attendance", entries: operations.length },
    );
    res.json({ saved: operations.length });
  }),
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const {
      worker,
      date,
      status,
      notes,
      leaveReason,
      checkIn,
      checkOut,
      hours,
      overtimeHours,
      overtimeRate,
      locked,
    } = req.body;

    if (!worker || !date) {
      throw new ApiError(400, "Worker and date are required for attendance.");
    }

    if (["OWNER", "ADMIN"].includes(req.user.role) === false) {
      throw new ApiError(
        403,
        "Only admin and owner can change attendance records.",
      );
    }

    const workerRecord = await Worker.findOne({
      _id: worker,
      deletedAt: null,
    });
    if (!workerRecord) throw new ApiError(404, "Worker not found.");
    const workerType = workerRecord.type;
    const baseDate = asDateOnly(date);
    const existing = await Attendance.findOne({ worker, date: baseDate });
    if (existing?.locked) {
      throw new ApiError(409, "This day's attendance is locked.");
    }
    const normalizedStatus = normalizeAttendanceStatus(status);
    const rateContext = await loadCompanyWorkerRateHistory(
      [workerRecord],
      asDateOnly(date),
    );
    const effectiveRates = getCompanyWorkerRates(
      workerRecord,
      asDateOnly(date),
      rateContext,
    );
    const assignedCompany = rateContext.companyByName.get(
      workerRecord.companyName,
    );
    const rateSnapshot = Number(
      existing?.dailyRate ?? effectiveRates.dailyRate,
    );
    const workUnits = getWorkUnits(normalizedStatus);
    const normalizedHours = Number(hours || 8);
    const normalizedOvertime = Number(overtimeHours || 0);
    const finalOvertimeRate = Number(
      overtimeRate ?? existing?.overtimeRate ?? effectiveRates.overtimeRate,
    );
    const companyDailyRate = Number(
      existing?.companyDailyRate ?? effectiveRates.companyDailyRate,
    );
    const attendanceZone = existing?.workZone || workerRecord.workZone;
    const payableAmount = calculatePayableAmount({
      dailyRate: rateSnapshot,
      overtimeHours: normalizedOvertime,
      overtimeRate: finalOvertimeRate,
      status: normalizedStatus,
    });

    const attendance = await Attendance.findOneAndUpdate(
      { worker, date: baseDate },
      {
        worker,
        company: existing?.company ?? assignedCompany?._id ?? null,
        companyName: existing?.companyName ?? workerRecord.companyName ?? "",
        type: workerType,
        date: baseDate,
        status: normalizedStatus,
        workUnits,
        hours: normalizedHours,
        checkIn: checkIn || "",
        checkOut: checkOut || "",
        overtimeHours: normalizedOvertime,
        dailyRate: rateSnapshot,
        overtimeRate: finalOvertimeRate,
        companyDailyRate,
        workZone: attendanceZone,
        payableAmount,
        leaveReason: leaveReason || "",
        notes: notes || "",
        locked: Boolean(locked),
        lockedAt: Boolean(locked) ? new Date() : null,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    ).populate("worker", "name type phone skill");

    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} updated attendance for ${attendance?.worker?.name || workerRecord.name} on ${date}.`,
      { workerId: workerRecord.id, date, section: "attendance" },
    );
    res.json({ attendance });
  }),
);

router.post(
  "/copy-yesterday",
  asyncHandler(async (req, res) => {
    const { date, userId } = req.body;

    if (!date) {
      throw new ApiError(400, "Date is required.");
    }

    if (["OWNER", "ADMIN"].includes(req.user.role) === false) {
      throw new ApiError(
        403,
        "Only admin and owner can copy daily attendance.",
      );
    }

    const targetDate = asDateOnly(date);
    const yesterday = new Date(targetDate);
    yesterday.setDate(yesterday.getDate() - 1);

    const sourceRows = await Attendance.find({
      date: yesterday,
    });

    const rows = sourceRows.map((item) => ({
      ...item.toObject(),
      _id: undefined,
      date: targetDate,
      locked: false,
      lockedAt: null,
      lockedBy: null,
      createdBy: userId || req.user.id,
      updatedBy: req.user.id,
    }));

    if (!rows.length) {
      return res.json({ copied: 0 });
    }

    await Attendance.deleteMany({
      date: targetDate,
    });
    const inserted = await Attendance.insertMany(rows);
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} copied attendance from yesterday to ${date}.`,
      { date, section: "attendance", copied: inserted.length },
    );
    res.json({ copied: inserted.length });
  }),
);

router.patch(
  "/lock-month",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const { month, locked = true } = req.body;
    if (!/^\d{4}-\d{2}$/.test(String(month || ""))) {
      throw new ApiError(400, "Month must use YYYY-MM format.");
    }
    const [year, monthNumber] = String(month).split("-").map(Number);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 1);
    const sheet = await AttendanceSheet.findOneAndUpdate(
      { type: "ALL", date: start },
      {
        type: "ALL",
        date: start,
        locked: Boolean(locked),
        lockedAt: locked ? new Date() : null,
        lockedBy: locked ? req.user.id : null,
      },
      { upsert: true, new: true },
    );
    await Attendance.updateMany(
      { date: { $gte: start, $lt: end } },
      {
        $set: {
          locked: Boolean(locked),
          lockedAt: locked ? new Date() : null,
          lockedBy: locked ? req.user.id : null,
        },
      },
    );
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} ${locked ? "locked" : "unlocked"} attendance for ${month}.`,
      { month, locked, section: "attendance" },
    );
    res.json({ locked: Boolean(locked), sheet });
  }),
);

router.patch(
  "/lock",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const { date, locked = true } = req.body;
    if (!date) {
      throw new ApiError(400, "Date is required.");
    }
    const baseDate = asDateOnly(date);
    const sheet = await AttendanceSheet.findOneAndUpdate(
      { type: "ALL", date: baseDate },
      {
        type: "ALL",
        date: baseDate,
        locked,
        lockedAt: locked ? new Date() : null,
        lockedBy: locked ? req.user.id : null,
      },
      { upsert: true, new: true },
    );

    await Attendance.updateMany(
      { date: baseDate },
      {
        locked,
        lockedAt: locked ? new Date() : null,
        lockedBy: locked ? req.user.id : null,
      },
    );

    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} ${locked ? "locked" : "unlocked"} attendance for ${date}.`,
      { date, locked, section: "attendance" },
    );

    const payableSummary = await Attendance.aggregate([
      { $match: { date: baseDate } },
      {
        $group: {
          _id: "$type",
          payable: { $sum: "$payableAmount" },
          workers: { $sum: 1 },
        },
      },
    ]);
    res.json({ sheet, locked, payableSummary });
  }),
);

export default router;
