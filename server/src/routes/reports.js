import { Router } from "express";
import Assignment from "../models/Assignment.js";
import Payment from "../models/Payment.js";
import Attendance from "../models/Attendance.js";
import Worker from "../models/Worker.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { dateRange } from "../utils/serializers.js";

const router = Router();

router.get(
  "/operations",
  asyncHandler(async (req, res) => {
    const assignmentFilter = {};
    const paymentFilter = {};
    assignmentFilter.type = "LABOUR";
    if (req.query.status) assignmentFilter.status = req.query.status;
    if (req.query.worker) assignmentFilter.worker = req.query.worker;
    if (req.query.client) assignmentFilter.client = req.query.client;
    if (req.query.worker) paymentFilter.worker = req.query.worker;
    if (req.query.client) paymentFilter.client = req.query.client;
    const range = dateRange(req.query);
    if (range) {
      assignmentFilter.startDate = range;
      paymentFilter.paidOn = range;
    }
    const [assignments, payments] = await Promise.all([
      Assignment.find(assignmentFilter)
        .populate("worker", "name type")
        .populate("client", "name")
        .sort({ startDate: -1 }),
      Payment.find(paymentFilter)
        .populate("worker", "name type")
        .populate("client", "name")
        .populate("assignment", "siteName")
        .sort({ paidOn: -1 }),
    ]);
    const paymentSummaries = payments.reduce(
      (summary, payment) => {
        summary.inflow += payment.flow === "INFLOW" ? payment.amount : 0;
        summary.outflow += payment.flow === "OUTFLOW" ? payment.amount : 0;
        summary.advance += payment.kind === "ADVANCE" ? payment.amount : 0;
        return summary;
      },
      { inflow: 0, outflow: 0, advance: 0 },
    );
    const workSummaries = assignments.reduce(
      (summary, assignment) => {
        summary.billed += assignment.billingAmount;
        summary.payout += assignment.payoutAmount;
        summary.headCount += assignment.headCount;
        return summary;
      },
      { billed: 0, payout: 0, headCount: 0 },
    );
    res.json({
      assignments,
      payments,
      summary: {
        ...paymentSummaries,
        ...workSummaries,
        profit: workSummaries.billed - workSummaries.payout,
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
    if (req.query.worker) workerFilter._id = req.query.worker;
    const [workers, attendance] = await Promise.all([
      Worker.find(workerFilter).sort({ name: 1 }),
      Attendance.find({
        ...(type === "ALL" ? {} : { type }),
        ...(req.query.worker ? { worker: req.query.worker } : {}),
        date: {
          $gte: new Date(`${from}T00:00:00.000Z`),
          $lte: new Date(`${to}T23:59:59.999Z`),
        },
      })
        .populate("worker", "name type")
        .populate("assignment", "siteName workDescription"),
    ]);

    const rows = attendance.map((item) => ({
      id: item._id,
      worker: item.worker?.name,
      type: item.type,
      assignment: item.assignment?.siteName || "—",
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
