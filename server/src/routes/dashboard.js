import { Router } from "express";
import Worker from "../models/Worker.js";
import Assignment from "../models/Assignment.js";
import Payment from "../models/Payment.js";
import Attendance from "../models/Attendance.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const moneyBy = (items, predicate) =>
  items
    .filter(predicate)
    .reduce((total, item) => total + Number(item.amount || 0), 0);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const type = "LABOUR";
    const workerFilter = type ? { type } : {};
    const workers = await Worker.find(workerFilter).select("_id");
    const workerIds = workers.map((worker) => worker._id);
    const assignmentRows = await Assignment.find(type ? { type } : {}).select(
      "_id",
    );
    const assignmentIds = assignmentRows.map((assignment) => assignment._id);
    const paymentScope = type
      ? {
          $or: [
            { worker: { $in: workerIds } },
            { assignment: { $in: assignmentIds } },
          ],
        }
      : {};
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
    const [labourCount, assignments, payments, latestPayments, payableByType] =
      await Promise.all([
        Worker.countDocuments({ ...workerFilter, active: true }),
        Assignment.find({
          status: { $ne: "CANCELLED" },
          ...(type ? { type } : {}),
        })
          .populate("worker", "name type")
          .populate("client", "name")
          .sort({ startDate: -1 }),
        Payment.find(paymentScope).lean(),
        Payment.find(paymentScope)
          .populate("worker", "name type")
          .populate("client", "name")
          .populate("assignment", "siteName type")
          .sort({ paidOn: -1, createdAt: -1 })
          .limit(8),
        Attendance.aggregate(attendancePipeline),
      ]);

    const payoutTotal = assignments.reduce(
      (sum, item) => sum + Number(item.payoutAmount || 0),
      0,
    );
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
    const paymentByAssignment = new Map();
    payments.forEach((payment) => {
      if (payment.flow !== "OUTFLOW" || !payment.assignment) return;
      const key = String(payment.assignment);
      paymentByAssignment.set(
        key,
        (paymentByAssignment.get(key) || 0) + Number(payment.amount || 0),
      );
    });
    const outstanding = assignments
      .map((assignment) => ({
        id: assignment.id,
        type: assignment.type,
        worker: assignment.client?.name,
        siteName: assignment.siteName,
        status: assignment.status,
        payableDue: Math.max(
          0,
          Number(assignment.payoutAmount || 0) -
            (paymentByAssignment.get(String(assignment._id)) || 0),
        ),
      }))
      .filter((item) => item.payableDue > 0)
      .sort((a, b) => b.payableDue - a.payableDue)
      .slice(0, 8);
    res.json({
      summary: {
        activeLabour: labourCount,
        labourPayable: payableByWorkerType.LABOUR || 0,
        activeAssignments: assignments.filter(
          (item) => item.status === "ACTIVE",
        ).length,
        totalWorkerCost: payoutTotal,
        workerPaid: paidToWorkers,
        totalExpense: expenses,
        advances,
        dueToWorkers: Math.max(0, payoutTotal - paidToWorkers),
      },
      latestPayments,
      outstanding,
    });
  }),
);

export default router;
