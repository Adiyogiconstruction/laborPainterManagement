import { Router } from "express";
import Payment from "../models/Payment.js";
import Worker from "../models/Worker.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";
import { recordAdminActivity } from "../utils/adminActivity.js";
import { dateRange, pick } from "../utils/serializers.js";

const router = Router();
const editable = [
  "kind",
  "amount",
  "paidOn",
  "worker",
  "method",
  "reference",
  "notes",
];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = { deletedAt: null };
    ["kind", "worker", "method"].forEach((field) => {
      if (req.query[field]) filter[field] = req.query[field];
    });
    if (req.query.type) {
      const workers = await Worker.find({ type: req.query.type }).select("_id");
      filter.worker = { $in: workers.map((item) => item._id) };
    }
    const range = dateRange(req.query);
    if (range) filter.paidOn = range;
    const payments = await Payment.find(filter)
      .populate("worker", "name type")
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
    data.flow = "OUTFLOW";
    if (!data.kind || !data.amount)
      throw new ApiError(400, "Payment type and amount are required.");
    if (data.kind === "OTHER" && !String(data.notes || "").trim())
      throw new ApiError(
        400,
        "Please specify the other payment type in notes.",
      );
    const payment = await Payment.create({ ...data, createdBy: req.user.id });
    await payment.populate([{ path: "worker", select: "name type" }]);
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} recorded a payment of ${payment.amount} for ${payment.worker?.name || "a worker"}.`,
      { paymentId: payment.id, section: "payments" },
    );
    res.status(201).json({ payment });
  }),
);

router.get(
  "/deleted",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (_req, res) => {
    const payments = await Payment.find({ deletedAt: { $ne: null } })
      .populate("worker", "name type")
      .sort({ deletedAt: -1, updatedAt: -1 })
      .limit(200);
    res.json({ payments });
  }),
);

router.patch(
  "/:id/restore",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw new ApiError(404, "Payment not found.");
    if (!payment.deletedAt) {
      throw new ApiError(400, "This payment is not deleted.");
    }
    payment.deletedAt = null;
    payment.deletedBy = null;
    await payment.save();
    await recordAdminActivity(
      req,
      "UPDATE",
      `${req.user.name} restored a payment record.`,
      { paymentId: payment.id, section: "payments", restored: true },
    );
    res.json({ payment });
  }),
);

router.delete(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw new ApiError(404, "Payment not found.");
    if (payment.deletedAt) {
      throw new ApiError(
        400,
        "This payment is already deleted and is in the recycle bin.",
      );
    }
    payment.deletedAt = new Date();
    payment.deletedBy = req.user.id;
    await payment.save();
    await recordAdminActivity(
      req,
      "DELETE",
      `${req.user.name} moved a payment record for ${payment.reference || "this payment"} to recycle bin.`,
      { paymentId: payment.id, section: "payments" },
    );
    res.json({ deletedId: payment.id });
  }),
);

export default router;
