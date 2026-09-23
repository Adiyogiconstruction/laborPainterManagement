import { Router } from "express";
import Attendance from "../models/Attendance.js";
import Worker from "../models/Worker.js";
import AttendanceSheet from "../models/AttendanceSheet.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
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
    }).sort({ name: 1 });

    const records = await Attendance.find({
      type,
      date: { $gte: start, $lt: end },
    }).populate("worker", "name type phone skill");

    const attendanceByWorker = buildAttendanceMap(records);
    const sheet = await AttendanceSheet.findOne({
      type: "ALL",
      assignment: null,
      date: start,
    });

    const rows = workers.map((worker) => {
      const workerId = String(worker._id);
      const status = attendanceByWorker[workerId]?.[dateKey] || "NOT_MARKED";
      const record = records.find(
        (item) => String(item.worker?._id || item.worker) === workerId,
      );
      return {
        ...worker.toObject(),
        status,
        workUnits: record?.workUnits ?? getWorkUnits(status),
        hours: record?.hours ?? 8,
        checkIn: record?.checkIn || "",
        checkOut: record?.checkOut || "",
        overtimeHours: record?.overtimeHours ?? 0,
        leaveReason: record?.leaveReason || "",
        notes: record?.notes || "",
        payableAmount: record?.payableAmount ?? 0,
        dailyRate: record?.dailyRate ?? Number(worker.defaultDailyRate || 0),
        overtimeRate:
          record?.overtimeRate ?? Number(worker.overtimeHourlyRate || 0),
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
        active: true,
        type,
      }).sort({ name: 1 }),
      Attendance.find({
        type,
        date: { $gte: start, $lt: end },
      }).select("worker date status overtimeHours overtimeRate payableAmount"),
      AttendanceSheet.findOne({
        type: "ALL",
        assignment: null,
        date: start,
      }),
    ]);
    const attendance = records.map((record) => ({
      worker: String(record.worker),
      date: toDateString(record.date),
      status: record.status,
      overtimeHours: record.overtimeHours || 0,
      overtimeRate: record.overtimeRate || 0,
      payableAmount: record.payableAmount || 0,
    }));
    res.json({
      month,
      days,
      locked: Boolean(sheet?.locked),
      workers: workers.map((worker) => ({
        ...worker.toObject(),
        dailyRate: Number(worker.defaultDailyRate || 0),
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
      assignment: null,
      date: start,
      locked: true,
    });
    if (sheet) throw new ApiError(409, "This month is locked.");

    const workerIds = [
      ...new Set(entries.map((entry) => String(entry.worker))),
    ];
    const [workers, existingRecords] = await Promise.all([
      Worker.find({ _id: { $in: workerIds }, active: true }),
      Attendance.find({
        worker: { $in: workerIds },
        date: { $gte: start, $lt: end },
      }),
    ]);
    const workersById = new Map(
      workers.map((worker) => [String(worker._id), worker]),
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
      const overtimeRate = Number(
        entry.overtimeRate ??
          existing?.overtimeRate ??
          worker.overtimeHourlyRate ??
          0,
      );
      operations.push({
        updateOne: {
          filter: { worker: worker._id, date: entryDate },
          update: {
            worker: worker._id,
            type: worker.type,
            assignment: null,
            date: entryDate,
            status,
            workUnits: getWorkUnits(status),
            hours: existing?.hours ?? 8,
            checkIn: existing?.checkIn || "",
            checkOut: existing?.checkOut || "",
            overtimeHours,
            dailyRate: Number(worker.defaultDailyRate || 0),
            overtimeRate,
            payableAmount: calculatePayableAmount({
              dailyRate: Number(worker.defaultDailyRate || 0),
              overtimeHours,
              overtimeRate,
              status,
            }),
            leaveReason: existing?.leaveReason || "",
            notes: existing?.notes || "",
            locked: false,
            lockedAt: null,
            lockedBy: null,
            createdBy: req.user.id,
            updatedBy: req.user.id,
          },
          upsert: true,
        },
      });
    }
    if (operations.length) await Attendance.bulkWrite(operations);
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

    const workerRecord = await Worker.findById(worker);
    if (!workerRecord) throw new ApiError(404, "Worker not found.");
    const workerType = workerRecord.type;
    const baseDate = asDateOnly(date);
    const existing = await Attendance.findOne({ worker, date: baseDate });
    if (existing?.locked) {
      throw new ApiError(409, "This day's attendance is locked.");
    }
    const normalizedStatus = normalizeAttendanceStatus(status);
    const rateSnapshot = Number(workerRecord.defaultDailyRate ?? 0);
    const workUnits = getWorkUnits(normalizedStatus);
    const normalizedHours = Number(hours || 8);
    const normalizedOvertime = Number(overtimeHours || 0);
    const finalOvertimeRate = Number(
      overtimeRate ?? workerRecord.overtimeHourlyRate ?? 0,
    );
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
        type: workerType,
        assignment: null,
        date: baseDate,
        status: normalizedStatus,
        workUnits,
        hours: normalizedHours,
        checkIn: checkIn || "",
        checkOut: checkOut || "",
        overtimeHours: normalizedOvertime,
        dailyRate: rateSnapshot,
        overtimeRate: finalOvertimeRate,
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
      assignment: null,
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
    res.json({ copied: inserted.length });
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
      { type: "ALL", assignment: null, date: baseDate },
      {
        type: "ALL",
        assignment: null,
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
