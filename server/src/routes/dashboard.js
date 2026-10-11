import { Router } from "express";
import Worker from "../models/Worker.js";
import Payment from "../models/Payment.js";
import Attendance from "../models/Attendance.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { summarizeDashboardPayments } from "../utils/dashboardPayments.js";

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
    const liveWorkerFilter = { ...workerFilter, deletedAt: null };
    const workers = await Worker.find(liveWorkerFilter).select("_id");
    const workerIds = workers.map((worker) => worker._id);
    const workerIdSet = new Set(workerIds.map(String));
    const paymentScope = { deletedAt: null };
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
      ...(type
        ? [{ $match: { "worker.type": type, "worker.deletedAt": null } }]
        : []),
      {
        $group: {
          _id: "$worker.type",
          total: { $sum: "$payableAmount" },
        },
      },
    ];
    const [labourCount, payments, latestPayments, payableByType] =
      await Promise.all([
        Worker.countDocuments({ ...liveWorkerFilter, active: true }),
        Payment.find(paymentScope).lean(),
        Payment.find(paymentScope)
          .populate("worker", "name type")
          .sort({ paidOn: -1, createdAt: -1 })
          .limit(8),
        Attendance.aggregate(attendancePipeline),
      ]);

    const paidToWorkers = moneyBy(
      payments,
      (item) =>
        item.flow === "OUTFLOW" &&
        workerIdSet.has(String(item.worker || "")),
    ) -
      moneyBy(
        payments,
        (item) =>
          item.flow === "INFLOW" &&
          workerIdSet.has(String(item.worker || "")),
      );
    const payableByWorkerType = Object.fromEntries(
      payableByType.map((item) => [item._id, Number(item.total || 0)]),
    );
    const expenses = moneyBy(
      payments,
      (item) => item.flow === "OUTFLOW" && item.kind === "EXPENSE",
    );
    const advances = moneyBy(
      payments,
      (item) =>
        item.flow === "OUTFLOW" &&
        item.kind === "ADVANCE" &&
        workerIdSet.has(String(item.worker || "")),
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
    const workerFilter = { active: true, deletedAt: null, type };
    for (const field of ["companyName", "teamName", "workZone", "skill"]) {
      if (req.query[field]) {
        workerFilter[field] =
          field === "companyName" && req.query[field] === "Unassigned"
            ? { $in: ["", null] }
            : req.query[field];
      }
    }
    if (req.query.worker) workerFilter._id = req.query.worker;
    const workers = await Worker.find(workerFilter).select(
      "_id name companyName teamName workZone skill",
    );
    let range;
    if (req.query.period === "ALL") {
      const workerIds = workers.map((worker) => worker._id);
      const [firstAttendance, firstPayment] = await Promise.all([
        workerIds.length
          ? Attendance.findOne({ worker: { $in: workerIds } })
              .sort({ date: 1 })
              .select("date")
          : null,
        Payment.findOne({
          deletedAt: null,
          $or: [
            ...(workerIds.length ? [{ worker: { $in: workerIds } }] : []),
            { flow: "OUTFLOW", kind: "EXPENSE" },
          ],
        })
          .sort({ paidOn: 1 })
          .select("paidOn"),
      ]);
      const firstDate = [
        firstAttendance?.date,
        firstPayment?.paidOn,
      ]
        .filter(Boolean)
        .sort((left, right) => new Date(left) - new Date(right))[0];
      const end = new Date();
      end.setUTCHours(23, 59, 59, 999);
      range = {
        start: firstDate
          ? new Date(new Date(firstDate).setUTCHours(0, 0, 0, 0))
          : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())),
        end,
      };
    } else {
      range = rangeDates(req.query.from, req.query.to);
    }
    if (!range) {
      return res.status(400).json({ message: "Invalid dashboard date range." });
    }
    const days = Math.ceil((range.end - range.start) / 86400000);
    const workerIds = workers.map((worker) => worker._id);
    const workerCompany = new Map();
    const workerZone = new Map();
    const companyStats = new Map();
    const zoneStats = new Map();
    const ensureZoneStats = (zone) => {
      if (!zoneStats.has(zone)) {
        zoneStats.set(zone, {
          zone,
          active: 0,
          inactive: 0,
          present: 0,
          absent: 0,
          marked: 0,
          overtimeHours: 0,
          payable: 0,
          paid: 0,
          due: 0,
        });
      }
      return zoneStats.get(zone);
    };
    for (const worker of workers) {
      const company = worker.companyName || "Unassigned";
      const zone = worker.workZone || "Unassigned";
      const workerId = String(worker._id);
      workerCompany.set(workerId, company);
      workerZone.set(workerId, zone);
      ensureZoneStats(zone).active += 1;
      if (!companyStats.has(company)) {
        companyStats.set(company, {
          company,
          labour: 0,
          present: 0,
          absent: 0,
          marked: 0,
          payable: 0,
          paid: 0,
          overtimeHours: 0,
        });
      }
      companyStats.get(company).labour += 1;
    }
    const attendanceFilter = {
      worker: { $in: workerIds },
      date: { $gte: range.start, $lte: range.end },
    };
    const paymentFilter = {
      deletedAt: null,
      paidOn: { $gte: range.start, $lte: range.end },
      $or: [
        { worker: { $in: workerIds } },
        { flow: "OUTFLOW", kind: "EXPENSE" },
      ],
    };
    const inactiveWorkerFilter = { ...workerFilter, active: false };
    if (req.query.kind) paymentFilter.kind = req.query.kind;
    if (req.query.method) paymentFilter.method = req.query.method;
    const lifetimeAttendanceFilter = { worker: { $in: workerIds } };
    const lifetimePaymentFilter = { ...lifetimeAttendanceFilter, deletedAt: null };
    const [
      attendance,
      payments,
      lifetimePayable,
      lifetimePaid,
      inactiveWorkerRows,
    ] =
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
          {
            $group: {
              _id: "$worker",
              total: {
                $sum: {
                  $cond: [
                    { $eq: ["$flow", "OUTFLOW"] },
                    "$amount",
                    { $multiply: ["$amount", -1] },
                  ],
                },
              },
            },
          },
        ]),
        Worker.find(inactiveWorkerFilter).select("_id workZone"),
      ]);
    for (const worker of inactiveWorkerRows) {
      const zone = worker.workZone || "Unassigned";
      ensureZoneStats(zone).inactive += 1;
    }

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
          payable: 0,
        },
      ]),
    );
    for (const item of attendance) {
      const key = dateKey(item.date);
      dailyAttendance[key] ||= {
        date: key,
        present: 0,
        doublePresent: 0,
        triplePresent: 0,
        halfDay: 0,
        absent: 0,
        leave: 0,
        notMarked: 0,
        payable: 0,
      };
      const day = dailyAttendance[key];
      if (item.status === "PRESENT") day.present += 1;
      if (item.status === "DOUBLE_PRESENT") day.doublePresent += 1;
      if (item.status === "TRIPLE_PRESENT") day.triplePresent += 1;
      if (item.status === "HALF_DAY") day.halfDay += 1;
      if (item.status === "ABSENT") day.absent += 1;
      if (item.status === "LEAVE") day.leave += 1;
      day.payable += Number(item.payableAmount || 0);
      const workerStats = workerRangeStats.get(String(item.worker));
      const companyStatsForWorker = companyStats.get(
        workerCompany.get(String(item.worker)),
      );
      const zoneStatsForWorker = zoneStats.get(workerZone.get(String(item.worker)));
      if (zoneStatsForWorker) {
        zoneStatsForWorker.payable += Number(item.payableAmount || 0);
        zoneStatsForWorker.overtimeHours += Number(item.overtimeHours || 0);
        if (item.status !== "NOT_MARKED") zoneStatsForWorker.marked += 1;
        if (["PRESENT", "DOUBLE_PRESENT", "TRIPLE_PRESENT", "HALF_DAY"].includes(item.status)) {
          zoneStatsForWorker.present += 1;
        }
        if (item.status === "ABSENT") zoneStatsForWorker.absent += 1;
      }
      if (companyStatsForWorker) {
        companyStatsForWorker.payable += Number(item.payableAmount || 0);
        companyStatsForWorker.overtimeHours += Number(item.overtimeHours || 0);
        if (item.status !== "NOT_MARKED") {
          companyStatsForWorker.marked += 1;
        }
        if (
          ["PRESENT", "DOUBLE_PRESENT", "TRIPLE_PRESENT", "HALF_DAY"].includes(item.status)
        ) {
          companyStatsForWorker.present += 1;
        }
        if (item.status === "ABSENT") companyStatsForWorker.absent += 1;
      }
      if (workerStats) {
        if (item.status !== "NOT_MARKED") workerStats.records += 1;
        workerStats.overtimeHours += Number(item.overtimeHours || 0);
        workerStats.payable += Number(item.payableAmount || 0);
        if (["PRESENT", "DOUBLE_PRESENT", "TRIPLE_PRESENT"].includes(item.status))
          workerStats.present += 1;
        if (item.status === "ABSENT") workerStats.absent += 1;
        if (item.status === "LEAVE") workerStats.leave += 1;
        if (item.status === "HALF_DAY") workerStats.halfDay += 1;
      }
    }
    const dailyPayments = {};
    const periodPaidByWorker = new Map();
    for (const payment of payments) {
      const paymentWorkerId = String(payment.worker?._id || payment.worker);
      if (workerZone.has(paymentWorkerId)) {
        periodPaidByWorker.set(
          paymentWorkerId,
          (periodPaidByWorker.get(paymentWorkerId) || 0) +
            (payment.flow === "INFLOW" ? -1 : 1) * Number(payment.amount || 0),
        );
        const key = dateKey(payment.paidOn);
        dailyPayments[key] ||= { date: key, paid: 0, count: 0 };
        dailyPayments[key].paid +=
          (payment.flow === "INFLOW" ? -1 : 1) * Number(payment.amount || 0);
        dailyPayments[key].count += 1;
      }
      const company = workerCompany.get(paymentWorkerId);
      const companyStatsForWorker = companyStats.get(company);
      if (companyStatsForWorker) {
        companyStatsForWorker.paid +=
          (payment.flow === "INFLOW" ? -1 : 1) * Number(payment.amount || 0);
      }
      const zone = workerZone.get(paymentWorkerId);
      const zoneStatsForWorker = zoneStats.get(zone);
      if (zoneStatsForWorker) {
        zoneStatsForWorker.paid +=
          (payment.flow === "INFLOW" ? -1 : 1) * Number(payment.amount || 0);
      }
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
      .filter((item) => item.due > 0)
      .sort((left, right) => right.due - left.due);
    const managementWorkers = workers.map((worker) => {
      const stats = workerRangeStats.get(String(worker._id));
      const workerId = String(worker._id);
      const lifetimePayableAmount = payableByWorker.get(workerId) || 0;
      const lifetimePaidAmount = paidByWorker.get(workerId) || 0;
      return {
        workerId: worker._id,
        workerName: worker.name,
        company: worker.companyName || "Unassigned",
        team: worker.teamName || "Unassigned",
        location: worker.workZone || "Unassigned",
        present: stats.present,
        absent: stats.absent,
        leave: stats.leave,
        halfDay: stats.halfDay,
        unmarked: Math.max(0, days - stats.records),
        overtimeHours: stats.overtimeHours,
        payable: stats.payable,
        paid: periodPaidByWorker.get(workerId) || 0,
        lifetimeDue: Math.max(0, lifetimePayableAmount - lifetimePaidAmount),
      };
    });
    for (const worker of workers) {
      const zoneStatsForWorker = zoneStats.get(
        workerZone.get(String(worker._id)),
      );
      if (zoneStatsForWorker) {
        const payable = payableByWorker.get(String(worker._id)) || 0;
        const paid = paidByWorker.get(String(worker._id)) || 0;
        zoneStatsForWorker.due += Math.max(0, payable - paid);
      }
    }
    const expected = workers.length * days;
    const present = attendance.filter((item) =>
      ["PRESENT", "DOUBLE_PRESENT", "TRIPLE_PRESENT", "HALF_DAY"].includes(item.status),
    ).length;
    const payable = attendance.reduce(
      (total, item) => total + Number(item.payableAmount || 0),
      0,
    );
    const overtimeHours = attendance.reduce(
      (total, item) => total + Number(item.overtimeHours || 0),
      0,
    );
    const paymentSummary = summarizeDashboardPayments(
      payments,
      new Set(workerZone.keys()),
    );
    const {
      paid,
      advancePaid,
      expenseTotal,
      otherOutflowTotal,
      paymentKinds,
      expenseBreakdown,
    } = paymentSummary;
    const companySummary = [...companyStats.values()]
      .map((item) => ({
        ...item,
        attendanceRate: item.labour * days
          ? Number(((item.present / (item.labour * days)) * 100).toFixed(1))
          : 0,
        unmarked: Math.max(0, item.labour * days - item.marked),
      }))
      .sort(
        (left, right) =>
          right.labour - left.labour ||
          left.company.localeCompare(right.company),
      );
    const exceptions = [...workerRangeStats.values()]
      .map((item) => ({ ...item, notMarked: Math.max(0, days - item.records) }))
      .filter(
        (item) =>
          item.absent ||
          item.leave ||
          item.halfDay ||
          item.overtimeHours ||
          item.notMarked,
      )
      .sort(
        (left, right) =>
          right.notMarked + right.absent - (left.notMarked + left.absent),
      );
    const zoneSummary = [...zoneStats.values()]
      .map((item) => {
        const expected = item.active * days;
        return {
          ...item,
          labour: item.active + item.inactive,
          attendanceRate: expected
            ? Number(((item.present / expected) * 100).toFixed(1))
            : 0,
          unmarked: Math.max(0, expected - item.marked),
        };
      })
      .sort(
        (left, right) =>
          right.labour - left.labour || left.zone.localeCompare(right.zone),
      );
    res.json({
      range: { from: dateKey(range.start), to: dateKey(range.end) },
      workers: workers.map((worker) => ({
        id: worker._id,
        name: worker.name,
      })),
      kpis: {
        activeWorkers: workers.length,
        inactiveWorkers: inactiveWorkerRows.length,
        attendanceRate: expected
          ? Number(((present / expected) * 100).toFixed(1))
          : 0,
        present,
        payable,
        paid,
        lifetimeDue: dueByWorker.reduce((total, item) => total + item.due, 0),
        advancePaid,
        expenseTotal,
        otherOutflowTotal,
        overtimeHours,
        unmarked: Math.max(
          0,
          expected -
            attendance.filter((item) => item.status !== "NOT_MARKED").length,
        ),
      },
      attendanceByDate: Object.values(dailyAttendance).sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
      paymentsByDate: Object.values(dailyPayments).sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
      paymentKinds,
      expenseBreakdown,
      dueByWorker: dueByWorker.slice(0, 10),
      managementWorkers,
      exceptions,
      companySummary,
      zoneSummary,
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
