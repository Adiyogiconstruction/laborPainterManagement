import { Router } from "express";
import Payment from "../models/Payment.js";
import Attendance from "../models/Attendance.js";
import Worker from "../models/Worker.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { dateRange } from "../utils/serializers.js";
import { applyWorkerStatusFilter } from "../utils/workerStatus.js";

const router = Router();

const validDateOnly = (value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const validateDateRange = (query) => {
  if (!validDateOnly(query.from) || !validDateOnly(query.to)) {
    return false;
  }
  return !(query.from && query.to && query.from > query.to);
};

const addWorkerAttributeFilter = (workerFilter, field, value) => {
  if (!value) return;
  workerFilter[field] =
    value === "Unassigned" ? { $in: ["", null] } : value;
};

router.get(
  "/operations",
  asyncHandler(async (req, res) => {
    if (!validateDateRange(req.query)) {
      return res.status(400).json({ message: "Choose a valid report date range." });
    }
    const paymentFilter = { deletedAt: null };
    const workerFilter = { type: req.query.type || "LABOUR", deletedAt: null };
    if (!applyWorkerStatusFilter(workerFilter, req.query.workerStatus, "ALL")) {
      return res.status(400).json({ message: "Choose a valid labour status." });
    }
    for (const field of ["companyName", "teamName", "workZone", "skill"]) {
      addWorkerAttributeFilter(workerFilter, field, req.query[field]);
    }
    if (req.query.worker) workerFilter._id = req.query.worker;
    const scopedWorkers = await Worker.find(workerFilter).select("_id");
    const workerIds = scopedWorkers.map((worker) => worker._id);
    const hasWorkforceFilter = Boolean(
      req.query.worker ||
        req.query.companyName ||
        req.query.teamName ||
        req.query.workZone ||
        req.query.skill,
    );
    paymentFilter.$or = [
      { worker: { $in: workerIds } },
      ...(!hasWorkforceFilter
        ? [{ flow: "OUTFLOW", kind: "EXPENSE" }]
        : []),
    ];
    if (req.query.kind) paymentFilter.kind = req.query.kind;
    if (req.query.method) paymentFilter.method = req.query.method;
    const range = dateRange(req.query);
    if (range) paymentFilter.paidOn = range;
    const payments = await Payment.find(paymentFilter)
      .populate("worker", "name type")
      .sort({ paidOn: -1 });
    const paymentSummaries = payments.reduce(
      (summary, payment) => {
        summary.inflow += payment.flow === "INFLOW" ? payment.amount : 0;
        summary.outflow += payment.flow === "OUTFLOW" ? payment.amount : 0;
        summary.advance +=
          payment.flow === "OUTFLOW" &&
          ["ADVANCE", "TRAVEL_ADVANCE"].includes(payment.kind)
            ? payment.amount
            : 0;
        return summary;
      },
      { inflow: 0, outflow: 0, advance: 0 },
    );
    res.json({
      payments,
      summary: {
        ...paymentSummaries,
      },
    });
  }),
);

router.get(
  "/attendance",
  asyncHandler(async (req, res) => {
    if (!validateDateRange(req.query)) {
      return res.status(400).json({ message: "Choose a valid report date range." });
    }
    const type = "LABOUR";
    const from =
      req.query.from ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10);
    const to =
      req.query.to ||
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10);
    const workerFilter = { deletedAt: null, type };
    if (!applyWorkerStatusFilter(workerFilter, req.query.workerStatus, "ACTIVE")) {
      return res.status(400).json({ message: "Choose a valid labour status." });
    }
    for (const field of ["companyName", "teamName", "workZone", "skill"]) {
      addWorkerAttributeFilter(workerFilter, field, req.query[field]);
    }
    if (req.query.worker) workerFilter._id = req.query.worker;
    const workers = await Worker.find(workerFilter).sort({ name: 1 });
    const attendance = await Attendance.find({
      ...(type === "ALL" ? {} : { type }),
      worker: { $in: workers.map((worker) => worker._id) },
      date: {
        $gte: new Date(`${from}T00:00:00.000Z`),
        $lte: new Date(`${to}T23:59:59.999Z`),
      },
    }).populate("worker", "name type");

    const rows = attendance.map((item) => ({
      id: item._id,
      worker: item.worker?.name,
      type: item.type,
      date: item.date,
      status: item.status,
      workUnits: item.workUnits,
      payableAmount: item.payableAmount,
    }));

    const attendanceByWorkerDate = new Map(
      attendance.map((item) => [
        `${String(item.worker?._id || item.worker)}:${item.date.toISOString().slice(0, 10)}`,
        item,
      ]),
    );
    const startDate = new Date(`${from}T00:00:00.000Z`);
    const endDate = new Date(`${to}T00:00:00.000Z`);
    const workerSummaries = workers.map((worker) => {
      const records = [];
      const counts = {
        PRESENT: 0,
        DOUBLE_PRESENT: 0,
        TRIPLE_PRESENT: 0,
        ABSENT: 0,
        HALF_DAY: 0,
        LEAVE: 0,
        NOT_MARKED: 0,
      };
      for (
        const current = new Date(startDate);
        current <= endDate;
        current.setUTCDate(current.getUTCDate() + 1)
      ) {
        const dateKey = current.toISOString().slice(0, 10);
        const item = attendanceByWorkerDate.get(`${worker._id}:${dateKey}`);
        const status = item?.status || "NOT_MARKED";
        counts[status] += 1;
        records.push({
          date: dateKey,
          status,
          workUnits: item?.workUnits || 0,
          payableAmount: item?.payableAmount || 0,
        });
      }
      return {
        workerId: worker._id,
        workerName: worker.name,
        type: worker.type,
        ...counts,
        totalDays: records.length,
        payable: records.reduce(
          (total, record) => total + Number(record.payableAmount || 0),
          0,
        ),
        records,
      };
    });

    const summary = workerSummaries.reduce(
      (accumulator, item) => {
        accumulator.PRESENT += item.PRESENT;
        accumulator.DOUBLE_PRESENT += item.DOUBLE_PRESENT;
        accumulator.TRIPLE_PRESENT += item.TRIPLE_PRESENT;
        accumulator.ABSENT += item.ABSENT;
        accumulator.HALF_DAY += item.HALF_DAY;
        accumulator.LEAVE += item.LEAVE;
        accumulator.NOT_MARKED += item.NOT_MARKED;
        accumulator.payable += item.payable;
        return accumulator;
      },
      {
        PRESENT: 0,
        DOUBLE_PRESENT: 0,
        TRIPLE_PRESENT: 0,
        HALF_DAY: 0,
        ABSENT: 0,
        LEAVE: 0,
        NOT_MARKED: 0,
        payable: 0,
      },
    );

    res.json({ rows, summary, workerSummaries, from, to });
  }),
);

export default router;
