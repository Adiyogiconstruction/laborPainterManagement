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
  asyncHandler(async (_req, res) => {
    const [
      labourCount,
      painterCount,
      assignments,
      payments,
      latestPayments,
      payableByType,
    ] = await Promise.all([
      Worker.countDocuments({ type: "LABOUR", active: true }),
      Worker.countDocuments({ type: "PAINTER", active: true }),
      Assignment.find({ status: { $ne: "CANCELLED" } })
        .populate("worker", "name type")
        .populate("client", "name")
        .sort({ startDate: -1 }),
      Payment.find().lean(),
      Payment.find()
        .populate("worker", "name type")
        .populate("client", "name")
        .populate("assignment", "siteName type")
        .sort({ paidOn: -1, createdAt: -1 })
        .limit(8),
      Attendance.aggregate([
        {
          $lookup: {
            from: "workers",
            localField: "worker",
            foreignField: "_id",
            as: "worker",
          },
        },
        { $unwind: "$worker" },
        {
          $group: {
            _id: "$worker.type",
            total: { $sum: "$payableAmount" },
          },
        },
      ]),
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
        worker: assignment.worker?.name,
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
        activePainters: painterCount,
        labourPayable: payableByWorkerType.LABOUR || 0,
        painterPayable: payableByWorkerType.PAINTER || 0,
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
