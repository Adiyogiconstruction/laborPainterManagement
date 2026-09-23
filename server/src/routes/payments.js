import { Router } from "express";
import Payment from "../models/Payment.js";
import Assignment from "../models/Assignment.js";
import Worker from "../models/Worker.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { dateRange, pick } from "../utils/serializers.js";

const router = Router();
const editable = [
  "flow",
  "kind",
  "amount",
  "paidOn",
  "worker",
  "client",
  "assignment",
  "method",
  "reference",
  "notes",
];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    ["flow", "kind", "worker", "client", "assignment"].forEach((field) => {
      if (req.query[field]) filter[field] = req.query[field];
    });
    if (req.query.type) {
      const [assignments, workers] = await Promise.all([
        Assignment.find({ type: req.query.type }).select("_id"),
        Worker.find({ type: req.query.type }).select("_id"),
      ]);
      filter.$or = [
        { assignment: { $in: assignments.map((item) => item._id) } },
        { worker: { $in: workers.map((item) => item._id) } },
      ];
    }
    const range = dateRange(req.query);
    if (range) filter.paidOn = range;
    const payments = await Payment.find(filter)
      .populate("worker", "name type")
      .populate("client", "name")
      .populate("assignment", "siteName workDescription type")
      .sort({ paidOn: -1, createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 500));
    res.json({ payments });
  }),
);

router.post(
  "/",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const data = pick(req.body, editable);
    if (!data.flow || !data.kind || !data.amount)
      throw new ApiError(400, "Flow, type and amount are required.");
    if (data.assignment) {
      const assignment = await Assignment.findById(data.assignment);
      if (!assignment) throw new ApiError(404, "Work record not found.");
      if (req.body.type && req.body.type !== assignment.type)
        throw new ApiError(400, "Payment does not belong to this workspace.");
      if (data.flow === "INFLOW") data.client = assignment.client;
      if (data.flow === "OUTFLOW" && data.kind !== "EXPENSE")
        data.worker = assignment.worker;
    }
    if (data.flow !== "OUTFLOW")
      throw new ApiError(400, "Only workforce payouts can be recorded here.");
    if (data.kind === "OTHER" && !String(data.notes || "").trim())
      throw new ApiError(
        400,
        "Please specify the other payment type in notes.",
      );
    const payment = await Payment.create({ ...data, createdBy: req.user.id });
    await payment.populate([
      { path: "worker", select: "name type" },
      { path: "client", select: "name" },
      { path: "assignment", select: "siteName workDescription type" },
    ]);
    res.status(201).json({ payment });
  }),
);

router.delete(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw new ApiError(404, "Payment not found.");
    await payment.deleteOne();
    res.json({ deletedId: payment.id });
  }),
);

export default router;
