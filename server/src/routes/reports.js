import { Router } from "express";
import Payment from "../models/Payment.js";
import Attendance from "../models/Attendance.js";
import Worker from "../models/Worker.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { dateRange } from "../utils/serializers.js";

const router = Router();

router.get(
  "/operations",
  asyncHandler(async (req, res) => {
    const paymentFilter = {};
    const workerFilter = { type: req.query.type || "LABOUR" };
    for (const field of ["companyName", "teamName", "workZone", "skill"]) {
      if (req.query[field]) workerFilter[field] = req.query[field];
    }
    if (req.query.worker) workerFilter._id = req.query.worker;
    const scopedWorkers = await Worker.find(workerFilter).select("_id");
    paymentFilter.worker = { $in: scopedWorkers.map((worker) => worker._id) };
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
        summary.advance += payment.kind === "ADVANCE" ? payment.amount : 0;
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
    const workerFilter = { active: true, type };
    for (const field of ["companyName", "teamName", "workZone", "skill"]) {
      if (req.query[field]) workerFilter[field] = req.query[field];
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

    const summary = rows.reduce(
      (accumulator, item) => {
        accumulator[item.status] = (accumulator[item.status] || 0) + 1;
        accumulator.payable += Number(item.payableAmount || 0);
        return accumulator;
      },
      {
        PRESENT: 0,
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
