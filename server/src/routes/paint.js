import { Router } from "express";
import PaintTransaction from "../models/PaintTransaction.js";
import { allowRoles } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.worker) filter.worker = req.query.worker;
    if (req.query.paintName)
      filter.paintName = new RegExp(req.query.paintName, "i");
    const transactions = await PaintTransaction.find(filter)
      .populate("worker", "name type")
      .populate("client", "name")
      .sort({ date: -1, createdAt: -1 });
    const balances = transactions.reduce((result, item) => {
      const key = item.paintName;
      result[key] ||= {
        paintName: key,
        unit: item.unit,
        balance: 0,
        issued: 0,
        used: 0,
        purchased: 0,
      };
      const bucket = result[key];
      const quantity = Number(item.quantity || 0);
      if (["ISSUED", "PURCHASED", "ADJUSTMENT"].includes(item.kind))
        bucket.balance += quantity;
      if (["USED", "RETURNED"].includes(item.kind)) bucket.balance -= quantity;
      if (item.kind === "ISSUED") bucket.issued += quantity;
      if (item.kind === "PURCHASED") bucket.purchased += quantity;
      if (item.kind === "USED") bucket.used += quantity;
      return result;
    }, {});
    res.json({ transactions, balances: Object.values(balances) });
  }),
);

router.post(
  "/",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const { paintName, kind, quantity, date } = req.body;
    if (!paintName || !kind || !quantity || !date)
      throw new ApiError(
        400,
        "Paint name, movement, quantity and date are required.",
      );
    const transaction = await PaintTransaction.create({
      ...req.body,
      createdBy: req.user.id,
    });
    await transaction.populate([
      { path: "worker", select: "name type" },
      { path: "client", select: "name" },
    ]);
    res.status(201).json({ transaction });
  }),
);

router.delete(
  "/:id",
  allowRoles("OWNER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const transaction = await PaintTransaction.findByIdAndDelete(req.params.id);
    if (!transaction) throw new ApiError(404, "Paint movement not found.");
    res.json({ deletedId: transaction.id });
  }),
);

export default router;
