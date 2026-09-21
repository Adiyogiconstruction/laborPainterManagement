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
    const type = ["LABOUR", "PAINTER"].includes(req.query.type)
      ? req.query.type
      : "ALL";
    const dateValue = req.query.date || new Date().toISOString().slice(0, 10);
    const dateKey = toDateString(dateValue);
    const start = asDateOnly(dateValue);
    const end = nextDate(dateValue);

    const workers = await Worker.find({
      active: true,
      ...(type === "ALL" ? {} : { type }),
    }).sort({ name: 1 });

    const records = await Attendance.find({
      ...(type === "ALL" ? {} : { type }),
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
        PAINTER: {
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
