import { Router } from "express";
import Worker from "../models/Worker.js";
import Payment from "../models/Payment.js";
import Attendance from "../models/Attendance.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const moneyBy = (items, predicate) =>
  items
    .filter(predicate)
    .reduce((total, item) => total + Number(item.amount || 0), 0);

const dateKey = (value) => new Date(value).toISOString().slice(0, 10);

const rangeDates = (from, to) => {
  const now = new Date();
  const start = from
    ? new Date(`${from}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = to
    ? new Date(`${to}T23:59:59.999Z`)
    : new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      );
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  )
    return null;
  return { start, end };
};

const countByWorkerField = (workers, field) =>
  workers.reduce((result, worker) => {
    const value = worker[field] || "Unassigned";
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const type = "LABOUR";
    const workerFilter = type ? { type } : {};
    const workers = await Worker.find(workerFilter).select("_id");
    const workerIds = workers.map((worker) => worker._id);
    const paymentScope = type ? { worker: { $in: workerIds } } : {};
    const attendancePipeline = [
      {
        $lookup: {
          from: "workers",
          localField: "worker",
          foreignField: "_id",
          as: "worker",
        },
      },
      { $unwind: "$worker" },
      ...(type ? [{ $match: { "worker.type": type } }] : []),
      {
        $group: {
          _id: "$worker.type",
          total: { $sum: "$payableAmount" },
        },
      },
    ];
    const [labourCount, payments, latestPayments, payableByType] =
      await Promise.all([
        Worker.countDocuments({ ...workerFilter, active: true }),
        Payment.find(paymentScope).lean(),
        Payment.find(paymentScope)
          .populate("worker", "name type")
          .sort({ paidOn: -1, createdAt: -1 })
          .limit(8),
        Attendance.aggregate(attendancePipeline),
      ]);

    const paidToWorkers = moneyBy(
      payments,
      (item) => item.flow === "OUTFLOW" && item.worker,
    );
    const payableByWorkerType = Object.fromEntries(
      payableByType.map((item) => [item._id, Number(item.total || 0)]),
    );
    const expenses = moneyBy(payments, (item) => item.flow === "OUTFLOW");
    const advances = moneyBy(
      payments,
      (item) => item.flow === "OUTFLOW" && item.kind === "ADVANCE",
    );
    res.json({
      summary: {
        activeLabour: labourCount,
        labourPayable: payableByWorkerType.LABOUR || 0,
        totalWorkerCost: payableByWorkerType.LABOUR || 0,
        workerPaid: paidToWorkers,
        totalExpense: expenses,
        advances,
        dueToWorkers: Math.max(
          0,
          (payableByWorkerType.LABOUR || 0) - paidToWorkers,
        ),
      },
      latestPayments,
      outstanding: [],
    });
  }),
);

router.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const type = "LABOUR";
    const range = rangeDates(req.query.from, req.query.to);
    if (!range) {
      return res.status(400).json({ message: "Invalid dashboard date range." });
    }
    const workerFilter = { active: true, type };
    for (const field of ["companyName", "teamName", "workZone", "skill"]) {
      if (req.query[field]) workerFilter[field] = req.query[field];
    }
    if (req.query.worker) workerFilter._id = req.query.worker;
    const workers = await Worker.find(workerFilter).select(
      "_id name companyName teamName workZone skill",
    );
    const workerIds = workers.map((worker) => worker._id);
    const attendanceFilter = {
      worker: { $in: workerIds },
      date: { $gte: range.start, $lte: range.end },
    };
    const paymentFilter = {
      worker: { $in: workerIds },
      flow: "OUTFLOW",
      paidOn: { $gte: range.start, $lte: range.end },
    };
    if (req.query.kind) paymentFilter.kind = req.query.kind;
    if (req.query.method) paymentFilter.method = req.query.method;
    const lifetimeAttendanceFilter = { worker: { $in: workerIds } };
    const lifetimePaymentFilter = {
      ...lifetimeAttendanceFilter,
      flow: "OUTFLOW",
    };
    const [attendance, payments, lifetimePayable, lifetimePaid] =
      await Promise.all([
        Attendance.find(attendanceFilter).select(
          "worker date status workUnits overtimeHours payableAmount",
        ),
        Payment.find(paymentFilter)
          .populate("worker", "name")
          .sort({ paidOn: -1, createdAt: -1 }),
        Attendance.aggregate([
          { $match: lifetimeAttendanceFilter },
          { $group: { _id: "$worker", total: { $sum: "$payableAmount" } } },
        ]),
        Payment.aggregate([
          { $match: lifetimePaymentFilter },
          { $group: { _id: "$worker", total: { $sum: "$amount" } } },
        ]),
      ]);

    const dailyAttendance = {};
    const workerRangeStats = new Map(
      workers.map((worker) => [
        String(worker._id),
        {
          workerId: worker._id,
          workerName: worker.name,
          present: 0,
          absent: 0,
          leave: 0,
          halfDay: 0,
          overtimeHours: 0,
          records: 0,
        },
      ]),
    );
    for (const item of attendance) {
      const key = dateKey(item.date);
      dailyAttendance[key] ||= {
        date: key,
        present: 0,
        doublePresent: 0,
        halfDay: 0,
        absent: 0,
        leave: 0,
        notMarked: 0,
        payable: 0,
      };
      const day = dailyAttendance[key];
      if (item.status === "PRESENT") day.present += 1;
      if (item.status === "DOUBLE_PRESENT") day.doublePresent += 1;
      if (item.status === "HALF_DAY") day.halfDay += 1;
      if (item.status === "ABSENT") day.absent += 1;
      if (item.status === "LEAVE") day.leave += 1;
      day.payable += Number(item.payableAmount || 0);
      const workerStats = workerRangeStats.get(String(item.worker));
      if (workerStats) {
        workerStats.records += 1;
        workerStats.overtimeHours += Number(item.overtimeHours || 0);
        if (item.status === "PRESENT" || item.status === "DOUBLE_PRESENT")
          workerStats.present += 1;
        if (item.status === "ABSENT") workerStats.absent += 1;
        if (item.status === "LEAVE") workerStats.leave += 1;
        if (item.status === "HALF_DAY") workerStats.halfDay += 1;
      }
    }
    const dailyPayments = {};
    const paymentKinds = {};
    for (const payment of payments) {
      const key = dateKey(payment.paidOn);
      dailyPayments[key] ||= { date: key, paid: 0, count: 0 };
      dailyPayments[key].paid += Number(payment.amount || 0);
      dailyPayments[key].count += 1;
      paymentKinds[payment.kind] =
        (paymentKinds[payment.kind] || 0) + Number(payment.amount || 0);
    }
    const payableByWorker = new Map(
      lifetimePayable.map((item) => [
        String(item._id),
        Number(item.total || 0),
      ]),
    );
    const paidByWorker = new Map(
      lifetimePaid.map((item) => [String(item._id), Number(item.total || 0)]),
    );
    const dueByWorker = workers
      .map((worker) => {
        const payable = payableByWorker.get(String(worker._id)) || 0;
        const paid = paidByWorker.get(String(worker._id)) || 0;
        return {
          workerId: worker._id,
          workerName: worker.name,
          due: Math.max(0, payable - paid),
          overpaid: Math.max(0, paid - payable),
        };
      })
      .filter((item) => item.due > 0 || item.overpaid > 0)
      .sort((left, right) => right.due - left.due)
      .slice(0, 10);
    const days = Math.ceil((range.end - range.start) / 86400000);
    const expected = workers.length * days;
    const present = attendance.filter((item) =>
      ["PRESENT", "DOUBLE_PRESENT"].includes(item.status),
    ).length;
    const payable = attendance.reduce(
      (total, item) => total + Number(item.payableAmount || 0),
      0,
    );
    const overtimeHours = attendance.reduce(
      (total, item) => total + Number(item.overtimeHours || 0),
      0,
    );
    const paid = payments.reduce(
      (total, item) => total + Number(item.amount || 0),
      0,
    );
    const exceptions = [...workerRangeStats.values()]
      .map((item) => ({ ...item, notMarked: Math.max(0, days - item.records) }))
      .filter((item) => item.absent || item.leave || item.notMarked)
      .sort(
        (left, right) =>
          right.notMarked + right.absent - (left.notMarked + left.absent),
      )
      .slice(0, 10);
    res.json({
      range: { from: dateKey(range.start), to: dateKey(range.end) },
      workers: workers.map((worker) => ({
        id: worker._id,
        name: worker.name,
      })),
      kpis: {
        activeWorkers: workers.length,
        attendanceRate: expected
          ? Number(((present / expected) * 100).toFixed(1))
          : 0,
        present,
        payable,
        paid,
        lifetimeDue: dueByWorker.reduce((total, item) => total + item.due, 0),
        overtimeHours,
        unmarked: Math.max(0, expected - attendance.length),
      },
      attendanceByDate: Object.values(dailyAttendance).sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
      paymentsByDate: Object.values(dailyPayments).sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
      paymentKinds,
      dueByWorker,
      exceptions,
      composition: {
        company: countByWorkerField(workers, "companyName"),
        team: countByWorkerField(workers, "teamName"),
        workZone: countByWorkerField(workers, "workZone"),
        skill: countByWorkerField(workers, "skill"),
      },
      latestPayments: payments.slice(0, 8),
    });
  }),
);

export default router;
